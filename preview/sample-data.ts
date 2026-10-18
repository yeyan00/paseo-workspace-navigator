import type {
  OwnedSubscription,
  PaseoApi,
  PaseoWorkspace,
  SubscriptionObserver,
} from "@getpaseo/client";
import type { PluginHostSummary } from "@getpaseo/plugin/client";
import type { SessionOutboundMessage } from "@getpaseo/protocol/messages";
import { host, project, workspace } from "../tests/fixtures";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
// Public screenshots must use fictional data, never a developer's host/project names.
export const demoHosts: PluginHostSummary[] = [
  { serverId: "local", label: "Demo Laptop", status: "online" },
  { serverId: "remote", label: "Demo Server", status: "online" },
  { serverId: "offline", label: "Demo Sandbox", status: "offline" },
];
const data = [
  host("local", {
    projects: [
      project("paseo", "demo-cli"),
      project("navigator", "demo-tools"),
      project("website", "demo-app"),
      project("empty", "demo-starter"),
    ],
    workspaces: [
      workspace("navigation", "navigator", {
        name: "Add project search",
        status: "running",
        statusEnteredAt: ago(8),
      }),
      workspace("main", "navigator", {
        name: "main",
        statusEnteredAt: ago(90),
        gitRuntime: { currentBranch: "main" },
      }),
      workspace("login", "paseo", {
        name: "Improve help output",
        status: "attention",
        statusEnteredAt: ago(12),
      }),
      workspace("layout", "website", { name: "Update sample layout", statusEnteredAt: ago(46) }),
    ],
  }),
  host("remote", {
    projects: [project("api", "demo-api"), project("paseo", "demo-cli")],
    workspaces: [
      workspace("index", "api", {
        name: "Add example endpoint",
        status: "running",
        statusEnteredAt: ago(25),
      }),
      workspace("permission", "api", {
        name: "Review sample migration",
        status: "needs_input",
        statusEnteredAt: ago(15),
      }),
      workspace("build", "paseo", {
        name: "Check demo build",
        status: "failed",
        statusEnteredAt: ago(120),
      }),
    ],
  }),
];
const pageInfo = { nextCursor: null, prevCursor: null, hasMore: false };
for (const entry of data) {
  if (entry.projects.some((project) => !project.projectDisplayName.startsWith("demo-"))) {
    throw new Error("Public preview projects must use demo-prefixed fictional names");
  }
}
function channel<T>(get: () => T) {
  const listeners = new Set<SubscriptionObserver<T & { subscriptionId: string }>>();
  return {
    subscription(): OwnedSubscription<T> {
      return {
        subscriptionId: "preview",
        ready: Promise.resolve({ ...get(), subscriptionId: "preview" }),
        subscribe(listener) {
          listeners.add(listener);
          listener.snapshot({ ...get(), subscriptionId: "preview" });
          return () => {
            listeners.delete(listener);
          };
        },
        release: async () => {},
      };
    },
    update(event: SessionOutboundMessage) {
      for (const listener of listeners) listener.update(event);
    },
  };
}
const workspaceChannels = new Map<
  string,
  ReturnType<
    typeof channel<{ requestId: string; entries: PaseoWorkspace[]; pageInfo: typeof pageInfo }>
  >
>();
export const demoApis: Record<string, PaseoApi> = {};
let createdCount = 0;
for (const entry of data) {
  const workspaces = channel(() => ({
    requestId: "demo",
    entries: [...entry.workspaces],
    pageInfo,
  }));
  // Deliberately resolve hosts out of order so browser checks exercise identity binding.
  const delay = () =>
    new Promise<void>((resolve) => setTimeout(resolve, entry.host.serverId === "local" ? 120 : 10));
  const agents = channel(() => ({ requestId: "demo", entries: [], pageInfo }));
  const projects = channel(() => ({ events: [] }));
  workspaceChannels.set(entry.host.serverId, workspaces);
  function emitWorkspace(next: PaseoWorkspace) {
    entry.workspaces = [...entry.workspaces.filter((item) => item.id !== next.id), next];
    workspaces.update({ type: "workspace_update", payload: { kind: "upsert", workspace: next } });
  }
  const creations = new Map<string, { id: string }>();
  demoApis[entry.host.serverId] = {
    projects: {
      list: async () => {
        await delay();
        return { projects: entry.projects };
      },
    },
    observeEvents: () => projects.subscription(),
    workspaces: {
      create: async (options: Parameters<PaseoApi["workspaces"]["create"]>[0]) => {
        if (options.idempotencyKey && creations.has(options.idempotencyKey))
          return creations.get(options.idempotencyKey);
        const id = `created-${++createdCount}`;
        const projectId = options.source.projectId!;
        if (options.title === "fail-create") throw new Error("Sample creation failure");
        const next = workspace(id, projectId, {
          name: options.title || "New sample workspace",
          workspaceKind: options.source.kind === "worktree" ? "worktree" : "directory",
          workspaceDirectory:
            options.source.kind === "directory" ? options.source.path : `/demo/worktrees/${id}`,
          statusEnteredAt: null,
        });
        emitWorkspace(next);
        const result = { id };
        if (options.idempotencyKey) creations.set(options.idempotencyKey, result);
        // Simulate a lost response after a successful daemon-side creation.
        if (options.title === "retry-response")
          throw new Error("Sample response lost; retry safely");
        return result;
      },
      ref: (id: string) => ({
        setTitle: async (title: string) => {
          const existing = entry.workspaces.find((item) => item.id === id);
          if (!existing) throw new Error("Workspace no longer exists");
          if (title === "fail-rename") throw new Error("Sample rename failure");
          emitWorkspace({ ...existing, name: title });
          return { title };
        },
      }),
      archive: async (id: string) => {
        const existing = entry.workspaces.find((item) => item.id === id);
        if (existing?.name === "fail-archive")
          return { archivedAt: null, error: "Sample archive failure" };
        entry.workspaces = entry.workspaces.filter((item) => item.id !== id);
        workspaces.update({ type: "workspace_update", payload: { kind: "remove", id } });
        return {
          requestId: "archive",
          workspaceId: id,
          archivedAt: new Date().toISOString(),
          error: null,
        };
      },
      list: async () => {
        await delay();
        return {
          requestId: "demo",
          entries: entry.workspaces,
          pageInfo,
          subscription: workspaces.subscription(),
        };
      },
    },
    agents: {
      list: async () => {
        await delay();
        return {
          requestId: "demo",
          entries: [],
          pageInfo,
          subscription: agents.subscription(),
        };
      },
    },
  } as unknown as PaseoApi;
}
export function finishDemoExecution() {
  const entry = data[0];
  const next = workspace("navigation", "navigator", {
    name: "Add project search",
    statusEnteredAt: new Date().toISOString(),
  });
  entry.workspaces = entry.workspaces.map((workspace) =>
    workspace.id === next.id ? next : workspace,
  );
  workspaceChannels
    .get("local")
    ?.update({ type: "workspace_update", payload: { kind: "upsert", workspace: next } });
}
