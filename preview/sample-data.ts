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
      workspace("main", "navigator", { name: "main", statusEnteredAt: ago(90) }),
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
for (const entry of data) {
  const workspaces = channel(() => ({
    requestId: "demo",
    entries: [...entry.workspaces],
    pageInfo,
  }));
  const agents = channel(() => ({ requestId: "demo", entries: [], pageInfo }));
  const projects = channel(() => ({ events: [] }));
  workspaceChannels.set(entry.host.serverId, workspaces);
  demoApis[entry.host.serverId] = {
    projects: { list: async () => ({ projects: entry.projects }) },
    observeEvents: () => projects.subscription(),
    workspaces: {
      list: async () => ({
        requestId: "demo",
        entries: entry.workspaces,
        pageInfo,
        subscription: workspaces.subscription(),
      }),
    },
    agents: {
      list: async () => ({
        requestId: "demo",
        entries: [],
        pageInfo,
        subscription: agents.subscription(),
      }),
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
