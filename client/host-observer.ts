import type {
  OwnedSubscription,
  PaseoApi,
  PaseoAgent,
  PaseoAgentListResult,
  PaseoProject,
  PaseoWorkspace,
  PaseoWorkspaceListResult,
  SessionOutboundMessage,
} from "./paseo-types";
import type { HostData } from "./types";

const PAGE_SIZE = 200;
const MAX_PAGES = 500;
type DirectoryResult<T> = {
  entries: T[];
  pageInfo: { nextCursor: string | null; hasMore: boolean };
};
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface HostObserver {
  start(): void;
  stop(): void;
}

/** Own subscriptions, not the borrowed API. Avoid classes: Hermes evaluates the bundle directly. */
export function createHostObserver(
  api: PaseoApi,
  publish: (data: Omit<HostData, "host">) => void,
): HostObserver {
  let stopped = false;
  let cleanups: (() => void)[] = [];
  let projectData = new Map<string, PaseoProject>();
  let workspaceData = new Map<string, PaseoWorkspace>();
  let agentData = new Map<string, PaseoAgent>();
  const pending = new Set(["projects", "workspaces", "agents"]);
  const failures = new Map<string, string>();
  let projectsReady = false;

  function emit() {
    if (stopped) return;
    publish({
      projects: [...projectData.values()],
      workspaces: [...workspaceData.values()],
      agents: [...agentData.values()],
      loading: pending.size > 0,
      projectsReady,
      error: failures.size ? [...failures.values()].join("; ") : null,
    });
  }

  function fail(name: string, error: unknown) {
    pending.delete(name);
    failures.set(name, `${name}: ${message(error)}`);
    emit();
  }

  function track(subscription: Pick<OwnedSubscription<unknown>, "release">) {
    const release = () => {
      void subscription.release().catch(() => {});
    };
    if (stopped) release();
    else cleanups.push(release);
  }

  function startProjects() {
    let generation = 0;
    let loading = false;
    let buffered: SessionOutboundMessage[] = [];
    const apply = (event: SessionOutboundMessage) => {
      if (event.type !== "project.update") return;
      if (event.payload.kind === "upsert")
        projectData.set(event.payload.project.projectId, event.payload.project);
      else projectData.delete(event.payload.projectId);
    };
    try {
      const subscription = api.observeEvents(["project.update"]);
      track(subscription);
      cleanups.push(
        subscription.subscribe({
          snapshot: () => {
            const current = ++generation;
            loading = true;
            buffered = [];
            pending.add("projects");
            void api.projects
              .list()
              .then((result) => {
                if (stopped || current !== generation) return;
                projectData = new Map(
                  result.projects.map((project) => [project.projectId, project]),
                );
                for (const update of buffered) apply(update);
                buffered = [];
                loading = false;
                projectsReady = true;
                pending.delete("projects");
                failures.delete("projects");
                emit();
              })
              .catch((error) => {
                if (stopped || current !== generation) return;
                loading = false;
                buffered = [];
                fail("projects", error);
              });
          },
          update: (event) => {
            if (loading) buffered.push(event);
            else {
              apply(event);
              emit();
            }
          },
          error: (error) => fail("projects", error),
        }),
      );
    } catch (error) {
      fail("projects", error);
    }
  }

  async function startDirectory<
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
      track(first.subscription);
      if (stopped) return;
      cleanups.push(
        first.subscription.subscribe({
          snapshot: (snapshot) => {
            const current = ++generation;
            loading = true;
            buffered = [];
            pending.add(options.name);
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
                if (stopped || current !== generation) return;
                for (const item of entries(page)) next.set(options.key(item), item);
              }
              if (stopped || current !== generation) return;
              for (const event of buffered) options.update(event, next);
              buffered = [];
              loading = false;
              items = next;
              options.replace(items);
              pending.delete(options.name);
              failures.delete(options.name);
              emit();
            })().catch((error) => {
              if (stopped || current !== generation) return;
              // Keep the previous complete directory instead of publishing a truncated page.
              loading = false;
              buffered = [];
              fail(options.name, error);
            });
          },
          update: (event) => {
            if (loading) buffered.push(event);
            else {
              options.update(event, items);
              options.replace(items);
              emit();
            }
          },
          error: (error) => fail(options.name, error),
        }),
      );
    } catch (error) {
      fail(options.name, error);
    }
  }

  return {
    start() {
      startProjects();
      void startDirectory<PaseoWorkspace, PaseoWorkspaceListResult>({
        name: "workspaces",
        list: () => api.workspaces.list({ page: { limit: PAGE_SIZE }, subscribe: {} }),
        page: (cursor) => api.workspaces.list({ page: { limit: PAGE_SIZE, cursor } }),
        key: (workspace) => workspace.id,
        replace: (items) => {
          workspaceData = items;
        },
        update: (event, items) => {
          if (event.type !== "workspace_update") return;
          if (event.payload.kind === "upsert")
            items.set(event.payload.workspace.id, event.payload.workspace);
          else items.delete(event.payload.id);
        },
      });
      void startDirectory<PaseoAgent, PaseoAgentListResult>({
        name: "agents",
        list: () => api.agents.list({ page: { limit: PAGE_SIZE }, subscribe: {} }),
        page: (cursor) => api.agents.list({ page: { limit: PAGE_SIZE, cursor } }),
        entries: (page) => page.entries.map((entry) => entry.agent),
        key: (agent) => agent.id,
        replace: (items) => {
          agentData = items;
        },
        update: (event, items) => {
          if (event.type !== "agent_update") return;
          const update = event.payload;
          if (update.kind === "upsert" && !update.agent.archivedAt)
            items.set(update.agent.id, update.agent);
          else items.delete(update.kind === "remove" ? update.agentId : update.agent.id);
        },
      });
    },
    stop() {
      stopped = true;
      for (const cleanup of cleanups.reverse()) cleanup();
      cleanups = [];
    },
  };
}
