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
export const demoHosts: PluginHostSummary[] = [
  { serverId: "local", label: "本机 · Development", status: "online" },
  { serverId: "remote", label: "开发服务器 · GPU", status: "online" },
  { serverId: "offline", label: "测试服务器", status: "offline" },
];
const data = [
  host("local", {
    projects: [
      project("paseo", "paseo"),
      project("navigator", "workspace-navigator"),
      project("website", "greenvalley-web"),
      project("empty", "new-project"),
    ],
    workspaces: [
      workspace("navigation", "navigator", {
        name: "Host 分组与项目排序",
        status: "running",
        statusEnteredAt: ago(8),
      }),
      workspace("main", "navigator", { name: "main", statusEnteredAt: ago(90) }),
      workspace("login", "paseo", {
        name: "修复登录回调",
        status: "attention",
        statusEnteredAt: ago(12),
      }),
      workspace("layout", "website", { name: "首页布局优化", statusEnteredAt: ago(46) }),
    ],
  }),
  host("remote", {
    projects: [project("api", "greenvalley-api"), project("paseo", "paseo")],
    workspaces: [
      workspace("index", "api", {
        name: "索引性能优化",
        status: "running",
        statusEnteredAt: ago(25),
      }),
      workspace("permission", "api", {
        name: "数据库迁移",
        status: "needs_input",
        statusEnteredAt: ago(15),
      }),
      workspace("build", "paseo", {
        name: "Windows 打包验证",
        status: "failed",
        statusEnteredAt: ago(120),
      }),
    ],
  }),
];
const pageInfo = { nextCursor: null, prevCursor: null, hasMore: false };
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
    name: "Host 分组与项目排序",
    statusEnteredAt: new Date().toISOString(),
  });
  entry.workspaces = entry.workspaces.map((workspace) =>
    workspace.id === next.id ? next : workspace,
  );
  workspaceChannels
    .get("local")
    ?.update({ type: "workspace_update", payload: { kind: "upsert", workspace: next } });
}
