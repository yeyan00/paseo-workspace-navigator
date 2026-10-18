import type { PaseoApi } from "./paseo-types";
import type { ProjectNode, WorkspaceNode } from "./types";

export interface CreateWorkspaceDraft {
  title: string;
  mode: "directory" | "worktree";
  baseRef: string;
  branchName: string;
}

export function createWorkspaceOptions(
  project: ProjectNode,
  draft: CreateWorkspaceDraft,
  idempotencyKey: string,
): Parameters<PaseoApi["workspaces"]["create"]>[0] {
  if (!project.path.trim() || !project.id) throw new Error("Project directory is unavailable");
  if (draft.mode === "worktree" && project.kind !== "git")
    throw new Error("Worktrees require a Git project");
  const title = draft.title.trim();
  return {
    idempotencyKey,
    ...(title ? { title } : {}),
    source:
      draft.mode === "directory"
        ? { kind: "directory", path: project.path, projectId: project.id }
        : {
            kind: "worktree",
            cwd: project.path,
            projectId: project.id,
            action: "branch-off",
            ...(draft.baseRef.trim() ? { refName: draft.baseRef.trim() } : {}),
            ...(draft.branchName.trim() ? { branchName: draft.branchName.trim() } : {}),
          },
  };
}

/** The SDK returns archive errors in the payload; success must be checked explicitly. */
export async function archiveWorkspace(
  api: PaseoApi,
  workspace: Pick<WorkspaceNode, "id">,
): Promise<void> {
  const result = await api.workspaces.archive(workspace.id);
  if (result.error) throw new Error(result.error);
  if (!result.archivedAt) throw new Error("Host did not confirm workspace archival");
}
