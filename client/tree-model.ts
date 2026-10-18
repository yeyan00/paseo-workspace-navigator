import type { PaseoAgent } from "./paseo-types";
import { entityKey, hostKey, type Preferences } from "../shared/preferences";
import type { HostData, HostNode, ProjectNode, WorkspaceNode } from "./types";

export function timestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type Sortable = { name: string; id: string; running: boolean; finishedAt: number };
function compareNames(left: Sortable, right: Sortable) {
  return (
    left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) ||
    left.id.localeCompare(right.id)
  );
}

export function compareNodes(preferences: Preferences) {
  return (left: Sortable, right: Sortable): number => {
    if (preferences.runningFirst && left.running !== right.running) return left.running ? -1 : 1;
    const direction = preferences.direction === "asc" ? 1 : -1;
    if (preferences.sort === "name") return direction * compareNames(left, right);
    // Unknown execution times always stay last, including oldest-first mode.
    if (!!left.finishedAt !== !!right.finishedAt) return left.finishedAt ? -1 : 1;
    return direction * (left.finishedAt - right.finishedAt) || compareNames(left, right);
  };
}

function agentExecution(agents: readonly PaseoAgent[]) {
  const execution = new Map<string, { running: boolean; finishedAt: number }>();
  for (const agent of agents) {
    if (
      !agent.workspaceId ||
      agent.archivedAt ||
      (agent as PaseoAgent & { internal?: boolean }).internal
    )
      continue;
    const state = execution.get(agent.workspaceId) ?? { running: false, finishedAt: 0 };
    state.running ||= agent.status === "running" || agent.status === "initializing";
    // Never use updatedAt, createdAt or lastUserMessageAt as an execution end.
    if (agent.attentionReason === "finished" || agent.attentionReason === "error") {
      state.finishedAt = Math.max(state.finishedAt, timestamp(agent.attentionTimestamp));
    }
    execution.set(agent.workspaceId, state);
  }
  return execution;
}

/** Aggregate before search: filtering out a child must not alter its project's rank. */
export function buildTree(
  data: readonly HostData[],
  preferences: Preferences,
  query: string,
): HostNode[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.every((term) => text.toLocaleLowerCase().includes(term));
  const comparator = compareNodes(preferences);
  return data.flatMap((entry) => {
    const projects = new Map<string, ProjectNode>();
    const agents = agentExecution(entry.agents);
    for (const project of entry.projects) {
      projects.set(project.projectId, {
        key: entityKey(entry.host.serverId, "project", project.projectId),
        id: project.projectId,
        hostId: entry.host.serverId,
        name: project.projectDisplayName,
        path: project.projectRootPath,
        kind: project.projectKind,
        finishedAt: 0,
        running: false,
        workspaces: [],
        totalWorkspaces: 0,
      });
    }
    for (const workspace of entry.workspaces) {
      const visibility = workspace as typeof workspace & {
        background?: boolean;
        internal?: boolean;
      };
      if (visibility.background || visibility.internal || workspace.archivingAt) continue;
      let project = projects.get(workspace.projectId);
      if (!project) {
        project = {
          key: entityKey(entry.host.serverId, "project", workspace.projectId),
          id: workspace.projectId,
          hostId: entry.host.serverId,
          name: workspace.projectDisplayName,
          path: workspace.projectRootPath,
          kind: workspace.projectKind,
          finishedAt: 0,
          running: false,
          workspaces: [],
          totalWorkspaces: 0,
        };
        projects.set(project.id, project);
      }
      const execution = agents.get(workspace.id);
      const statusIsEnded =
        workspace.status === "done" ||
        workspace.status === "failed" ||
        workspace.status === "attention";
      const finishedAt = Math.max(
        execution?.finishedAt ?? 0,
        statusIsEnded ? timestamp(workspace.statusEnteredAt) : 0,
      );
      const running = workspace.status === "running" || (execution?.running ?? false);
      const node: WorkspaceNode = {
        key: entityKey(entry.host.serverId, "workspace", workspace.id),
        id: workspace.id,
        hostId: entry.host.serverId,
        name: workspace.name,
        directory: workspace.workspaceDirectory ?? workspace.projectRootPath,
        branch: workspace.gitRuntime?.currentBranch ?? null,
        kind: workspace.workspaceKind,
        status: running ? "running" : workspace.status,
        finishedAt,
        running,
      };
      project.workspaces.push(node);
      project.totalWorkspaces++;
      project.finishedAt = Math.max(project.finishedAt, finishedAt);
      project.running ||= running;
    }
    const allProjects = [...projects.values()].sort(comparator);
    let totalWorkspaces = 0;
    for (const project of allProjects) {
      project.workspaces.sort(comparator);
      totalWorkspaces += project.totalWorkspaces;
    }
    const visible = allProjects.flatMap((project) => {
      const parentText = `${entry.host.label} ${project.name} ${project.path}`;
      if (matches(parentText)) return [project];
      const workspaces = project.workspaces.filter((workspace) =>
        matches(`${parentText} ${workspace.name} ${workspace.directory} ${workspace.branch ?? ""}`),
      );
      return workspaces.length > 0 ? [{ ...project, workspaces }] : [];
    });
    if (terms.length > 0 && visible.length === 0 && !matches(entry.host.label)) return [];
    return [
      {
        ...entry,
        key: hostKey(entry.host.serverId),
        projects: visible,
        totalProjects: allProjects.length,
        totalWorkspaces,
      },
    ];
  });
}
