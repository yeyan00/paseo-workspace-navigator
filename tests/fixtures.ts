import type { PaseoAgent, PaseoProject, PaseoWorkspace } from "@getpaseo/client";
import {
  AgentSnapshotPayloadSchema,
  WorkspaceDescriptorPayloadSchema,
} from "@getpaseo/protocol/messages";
import type { HostData } from "../client/types";

export function project(id: string, name = id): PaseoProject {
  return {
    projectId: id,
    projectDisplayName: name,
    projectRootPath: `/dev/${id}`,
    projectKind: "git",
  };
}

export function workspace(
  id: string,
  projectId: string,
  overrides: Partial<PaseoWorkspace> = {},
): PaseoWorkspace {
  return WorkspaceDescriptorPayloadSchema.parse({
    id,
    projectId,
    projectDisplayName: projectId,
    projectRootPath: `/dev/${projectId}`,
    workspaceDirectory: `/dev/${projectId}/${id}`,
    projectKind: "git",
    workspaceKind: "worktree",
    name: id,
    status: "done",
    activityAt: null,
    statusEnteredAt: null,
    ...overrides,
  });
}

export function agent(
  id: string,
  workspaceId: string,
  overrides: Partial<PaseoAgent> = {},
): PaseoAgent {
  return AgentSnapshotPayloadSchema.parse({
    id,
    workspaceId,
    provider: "claude",
    cwd: "/dev",
    model: null,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-17T10:00:00Z",
    lastUserMessageAt: null,
    status: "idle",
    capabilities: {
      supportsStreaming: true,
      supportsSessionPersistence: true,
      supportsDynamicModes: false,
      supportsMcpServers: false,
      supportsReasoningStream: false,
      supportsToolInvocations: true,
    },
    currentModeId: null,
    availableModes: [],
    pendingPermissions: [],
    persistence: null,
    title: id,
    ...overrides,
  });
}

export function host(id: string, overrides: Partial<HostData> = {}): HostData {
  return {
    host: { serverId: id, label: id, status: "online" },
    projects: [],
    workspaces: [],
    agents: [],
    loading: false,
    projectsReady: true,
    error: null,
    ...overrides,
  };
}
