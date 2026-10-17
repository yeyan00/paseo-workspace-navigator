import type {
  OwnedSubscription,
  PaseoApi,
  PaseoAgent,
  PaseoAgentListResult,
  PaseoProject,
  PaseoWorkspace,
  PaseoWorkspaceListResult,
} from "@getpaseo/client";
import type { SessionOutboundMessage } from "@getpaseo/protocol/messages";
import type { HostData } from "./types";

const PAGE_SIZE = 200;
const MAX_PAGES = 500;

type DirectoryResult<T> = {
  entries: T[];
  pageInfo: { nextCursor: string | null; hasMore: boolean };
};
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** One host owns its listeners. Unmount/retry never disposes the shared Paseo API. */
export class HostObserver {
  private stopped = false;
  private cleanups: (() => void)[] = [];
  private projectData = new Map<string, PaseoProject>();
  private workspaceData = new Map<string, PaseoWorkspace>();
  private agentData = new Map<string, PaseoAgent>();
  private pending = new Set(["projects", "workspaces", "agents"]);
  private failures = new Map<string, string>();
  private projectsReady = false;

  constructor(
    private api: PaseoApi,
    private publish: (data: Omit<HostData, "host">) => void,
  ) {}

  private emit = () => {
    if (this.stopped) return;
    this.publish({
      projects: [...this.projectData.values()],
      workspaces: [...this.workspaceData.values()],
      agents: [...this.agentData.values()],
      loading: this.pending.size > 0,
      projectsReady: this.projectsReady,
      error: this.failures.size ? [...this.failures.values()].join("; ") : null,
    });
  };

  start(): void {
    this.startProjects();
    void this.startDirectory<PaseoWorkspace, PaseoWorkspaceListResult>({
      name: "workspaces",
      list: () => this.api.workspaces.list({ page: { limit: PAGE_SIZE }, subscribe: {} }),
      page: (cursor) => this.api.workspaces.list({ page: { limit: PAGE_SIZE, cursor } }),
      key: (workspace) => workspace.id,
      replace: (items) => {
        this.workspaceData = items;
      },
      update: (event, items) => {
        if (event.type !== "workspace_update") return;
        const update = event.payload;
        if (update.kind === "upsert") items.set(update.workspace.id, update.workspace);
        else items.delete(update.id);
      },
    });
    void this.startDirectory<PaseoAgent, PaseoAgentListResult>({
      name: "agents",
      list: () => this.api.agents.list({ page: { limit: PAGE_SIZE }, subscribe: {} }),
      page: (cursor) => this.api.agents.list({ page: { limit: PAGE_SIZE, cursor } }),
      entries: (page) => page.entries.map((entry) => entry.agent),
      key: (agent) => agent.id,
      replace: (items) => {
        this.agentData = items;
      },
      update: (event, items) => {
        if (event.type !== "agent_update") return;
        const update = event.payload;
        if (update.kind === "upsert" && !update.agent.archivedAt)
          items.set(update.agent.id, update.agent);
        else items.delete(update.kind === "remove" ? update.agentId : update.agent.id);
      },
    });
  }

  private startProjects(): void {
    let generation = 0;
    let loading = false;
    let buffered: SessionOutboundMessage[] = [];
    const apply = (event: SessionOutboundMessage) => {
      if (event.type !== "project.update") return;
      if (event.payload.kind === "upsert")
        this.projectData.set(event.payload.project.projectId, event.payload.project);
      else this.projectData.delete(event.payload.projectId);
    };
    try {
      const subscription = this.api.observeEvents(["project.update"]);
      this.track(subscription);
      this.cleanups.push(
        subscription.subscribe({
          snapshot: () => {
            const current = ++generation;
            loading = true;
            buffered = [];
            this.pending.add("projects");
            void this.api.projects
              .list()
              .then((result) => {
                if (this.stopped || current !== generation) return;
                this.projectData = new Map(
                  result.projects.map((project) => [project.projectId, project]),
                );
                for (const update of buffered) apply(update);
                buffered = [];
                loading = false;
                this.projectsReady = true;
                this.pending.delete("projects");
                this.failures.delete("projects");
                this.emit();
              })
              .catch((error) => {
                if (this.stopped || current !== generation) return;
                loading = false;
                buffered = [];
                this.fail("projects", error);
              });
          },
          update: (event) => {
            if (loading) buffered.push(event);
            else {
              apply(event);
              this.emit();
            }
          },
          error: (error) => this.fail("projects", error),
        }),
      );
    } catch (error) {
      this.fail("projects", error);
    }
  }

  private async startDirectory<
    T,
    Result extends { pageInfo: { nextCursor: string | null; hasMore: boolean } },
  >(options: {
    name: string;
    list(): Promise<Result & { subscription: OwnedSubscription<Result> }>;
    page(cursor: string): Promise<Result>;
    entries?(result: Result): T[];
    key(item: T): string;
    replace(items: Map<string, T>): void;
    update(event: SessionOutboundMessage, items: Map<string, T>): void;
  }): Promise<void> {
    const entries =
      options.entries ?? ((result: Result) => (result as Result & DirectoryResult<T>).entries);
    let generation = 0;
    let loading = false;
    let items = new Map<string, T>();
    let buffered: SessionOutboundMessage[] = [];
    try {
      const first = await options.list();
      this.track(first.subscription);
      if (this.stopped) return;
      this.cleanups.push(
        first.subscription.subscribe({
          snapshot: (snapshot) => {
            const current = ++generation;
            loading = true;
            buffered = [];
            this.pending.add(options.name);
            void (async () => {
              const next = new Map(entries(snapshot).map((item) => [options.key(item), item]));
              let page: Result = snapshot;
              const seen = new Set<string>();
              for (let count = 1; page.pageInfo.hasMore; count++) {
                const cursor = page.pageInfo.nextCursor;
                if (!cursor || seen.has(cursor) || count >= MAX_PAGES)
                  throw new Error(`${options.name}: directory is incomplete; retry to refresh`);
                seen.add(cursor);
                page = await options.page(cursor);
                if (this.stopped || current !== generation) return;
                for (const item of entries(page)) next.set(options.key(item), item);
              }
              if (this.stopped || current !== generation) return;
              for (const event of buffered) options.update(event, next);
              buffered = [];
              loading = false;
              items = next;
              options.replace(items);
              this.pending.delete(options.name);
              this.failures.delete(options.name);
              this.emit();
            })().catch((error) => {
              if (this.stopped || current !== generation) return;
              // Keep the previous complete directory rather than presenting a
              // truncated first page as the full host.
              loading = false;
              buffered = [];
              this.fail(options.name, error);
            });
          },
          update: (event) => {
            if (loading) buffered.push(event);
            else {
              options.update(event, items);
              options.replace(items);
              this.emit();
            }
          },
          error: (error) => this.fail(options.name, error),
        }),
      );
    } catch (error) {
      this.fail(options.name, error);
    }
  }

  private fail(name: string, error: unknown): void {
    this.pending.delete(name);
    this.failures.set(name, `${name}: ${message(error)}`);
    this.emit();
  }

  private track(subscription: Pick<OwnedSubscription<unknown>, "release">): void {
    const release = () => {
      void subscription.release().catch(() => {});
    };
    if (this.stopped) release();
    else this.cleanups.push(release);
  }

  stop(): void {
    this.stopped = true;
    for (const cleanup of this.cleanups.reverse()) cleanup();
    this.cleanups = [];
  }
}
