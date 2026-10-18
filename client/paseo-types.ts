import type { getPaseoClient } from "@getpaseo/plugin/client";

// Derive types from the host-provided SDK. Direct imports of client/protocol
// declarations require locally installed packages during Git-source compilation.
export type PaseoApi = ReturnType<typeof getPaseoClient>;
export type PaseoWorkspaceListResult = Awaited<ReturnType<PaseoApi["workspaces"]["list"]>>;
export type PaseoAgentListResult = Awaited<ReturnType<PaseoApi["agents"]["list"]>>;
export type PaseoWorkspace = PaseoWorkspaceListResult["entries"][number];
export type PaseoAgent = PaseoAgentListResult["entries"][number]["agent"];
export type PaseoProject = Awaited<ReturnType<PaseoApi["projects"]["list"]>>["projects"][number];

type EventSubscription = ReturnType<PaseoApi["observeEvents"]>;
type EventObserver = Parameters<EventSubscription["subscribe"]>[0];
export type SessionOutboundMessage = Parameters<EventObserver["update"]>[0];

export type OwnedSubscription<T> = Omit<EventSubscription, "ready" | "subscribe"> & {
  readonly ready: Promise<T & { subscriptionId: string }>;
  subscribe(observer: {
    snapshot(value: T & { subscriptionId: string }): void;
    update(event: SessionOutboundMessage): void;
    error?(error: unknown): void;
  }): () => void;
};
