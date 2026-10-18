import type { PaseoAgent, PaseoProject, PaseoWorkspace } from "./paseo-types";
import type { PluginHostSummary } from "@getpaseo/plugin/client";

export interface HostData {
  host: PluginHostSummary;
  projects: readonly PaseoProject[];
  workspaces: readonly PaseoWorkspace[];
  agents: readonly PaseoAgent[];
  loading: boolean;
  /** True only after the complete project directory was read. */
  projectsReady: boolean;
  error: string | null;
}

export interface WorkspaceNode {
  key: string;
  id: string;
  hostId: string;
  name: string;
  directory: string;
  branch: string | null;
  status: PaseoWorkspace["status"];
  finishedAt: number;
  running: boolean;
}

export interface ProjectNode {
  key: string;
  id: string;
  hostId: string;
  name: string;
  path: string;
  kind: PaseoProject["projectKind"];
  finishedAt: number;
  running: boolean;
  workspaces: WorkspaceNode[];
  totalWorkspaces: number;
}

export interface HostNode extends Omit<HostData, "projects" | "workspaces" | "agents"> {
  key: string;
  projects: ProjectNode[];
  totalProjects: number;
  totalWorkspaces: number;
}
