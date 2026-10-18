import { describe, expect, it, vi } from "vitest";
import type { PaseoApi } from "../client/paseo-types";
import { archiveWorkspace, createWorkspaceOptions } from "../client/workspace-actions";
import { buildTree } from "../client/tree-model";
import { defaultPreferences } from "../shared/preferences";
import { host, project } from "./fixtures";

const target = buildTree(
  [host("remote", { projects: [project("p1")] })],
  defaultPreferences(),
  "",
)[0].projects[0];
describe("workspace mutations", () => {
  it("creates a fresh workspace in the exact project directory without implicitly starting an agent", () => {
    expect(
      createWorkspaceOptions(
        target,
        { title: "  New task ", mode: "directory", baseRef: "ignored", branchName: "ignored" },
        "attempt-1",
      ),
    ).toEqual({
      idempotencyKey: "attempt-1",
      title: "New task",
      source: { kind: "directory", path: "/dev/p1", projectId: "p1" },
    });
  });
  it("creates an isolated worktree with optional ref and branch, and leaves absent names to the daemon", () => {
    expect(
      createWorkspaceOptions(
        target,
        { title: "", mode: "worktree", baseRef: " main ", branchName: " feature/demo " },
        "attempt-2",
      ),
    ).toEqual({
      idempotencyKey: "attempt-2",
      source: {
        kind: "worktree",
        cwd: "/dev/p1",
        projectId: "p1",
        action: "branch-off",
        refName: "main",
        branchName: "feature/demo",
      },
    });
    expect(
      createWorkspaceOptions(
        target,
        { title: "", mode: "worktree", baseRef: "", branchName: "" },
        "attempt-3",
      ).source,
    ).not.toHaveProperty("refName");
  });
  it("rejects worktrees for non-Git projects and missing project paths", () => {
    const draft = { title: "", mode: "worktree" as const, baseRef: "", branchName: "" };
    expect(() => createWorkspaceOptions({ ...target, kind: "directory" }, draft, "a")).toThrow(
      "Git",
    );
    expect(() => createWorkspaceOptions({ ...target, path: "" }, draft, "a")).toThrow(
      "unavailable",
    );
  });
  it("does not report archive success when the SDK resolves a payload containing an error", async () => {
    const archive = vi.fn(async () => ({ error: "worktree is dirty", archivedAt: null }));
    const api = { workspaces: { archive } } as unknown as PaseoApi;
    await expect(archiveWorkspace(api, { id: "w1" })).rejects.toThrow("dirty");
    expect(archive).toHaveBeenCalledWith("w1");
  });
  it("requires confirmed archival and propagates transport failures", async () => {
    const archive = vi
      .fn()
      .mockResolvedValueOnce({ error: null, archivedAt: null })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ error: null, archivedAt: "2026-10-18T00:00:00Z" });
    const api = { workspaces: { archive } } as unknown as PaseoApi;
    await expect(archiveWorkspace(api, { id: "w1" })).rejects.toThrow("confirm");
    await expect(archiveWorkspace(api, { id: "w1" })).rejects.toThrow("offline");
    await expect(archiveWorkspace(api, { id: "w1" })).resolves.toBeUndefined();
  });
});
