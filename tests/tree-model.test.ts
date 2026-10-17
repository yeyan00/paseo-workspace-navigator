import { describe, expect, it } from "vitest";
import { buildTree, timestamp } from "../client/tree-model";
import { defaultPreferences, entityKey } from "../shared/preferences";
import { agent, host, project, workspace } from "./fixtures";

const early = "2026-10-10T10:00:00Z";
const late = "2026-10-17T10:00:00Z";

describe("navigator tree", () => {
  it("keeps hosts and same-ID projects separate, with running projects ahead of latest finished projects", () => {
    const data = [
      host("local", {
        projects: [project("a"), project("b"), project("c"), project("empty")],
        workspaces: [
          workspace("a", "a", { statusEnteredAt: late }),
          workspace("b", "b", { statusEnteredAt: early }),
          workspace("c", "c", { status: "running" }),
        ],
      }),
      host("remote", { projects: [project("a")] }),
    ];
    const tree = buildTree(data, defaultPreferences(), "");
    expect(tree.map((entry) => entry.host.serverId)).toEqual(["local", "remote"]);
    expect(tree[0].projects.map((entry) => entry.id)).toEqual(["c", "a", "b", "empty"]);
    expect(tree[0].projects[1].key).not.toBe(tree[1].projects[0].key);
  });

  it("supports oldest first while keeping unknown execution times last", () => {
    const data = [
      host("local", {
        workspaces: [
          workspace("new", "new", { statusEnteredAt: late }),
          workspace("old", "old", { statusEnteredAt: early }),
          workspace("unknown", "unknown"),
        ],
      }),
    ];
    const tree = buildTree(
      data,
      { ...defaultPreferences(), direction: "asc", runningFirst: false },
      "",
    );
    expect(tree[0].projects.map((entry) => entry.id)).toEqual(["old", "new", "unknown"]);
  });

  it("sorts names numerically in either direction and makes running priority optional", () => {
    const data = [
      host("local", {
        workspaces: [workspace("w", "p2", { status: "running" })],
        projects: [
          project("p2", "Project 2"),
          project("p10", "Project 10"),
          project("p1", "Project 1"),
        ],
      }),
    ];
    const preferences = {
      ...defaultPreferences(),
      sort: "name" as const,
      direction: "asc" as const,
      runningFirst: false,
    };
    expect(buildTree(data, preferences, "")[0].projects.map((entry) => entry.id)).toEqual([
      "p1",
      "p2",
      "p10",
    ]);
    expect(
      buildTree(data, { ...preferences, direction: "desc" }, "")[0].projects.map(
        (entry) => entry.id,
      ),
    ).toEqual(["p10", "p2", "p1"]);
    expect(buildTree(data, { ...preferences, runningFirst: true }, "")[0].projects[0].id).toBe(
      "p2",
    );
  });

  it("aggregates execution before search, keeping the newest hidden workspace's project rank", () => {
    const data = [
      host("local", {
        workspaces: [
          workspace("match", "a", { statusEnteredAt: early }),
          workspace("hidden", "a", { statusEnteredAt: late }),
          workspace("match-too", "b", { statusEnteredAt: "2026-10-15T10:00:00Z" }),
        ],
      }),
    ];
    const projects = buildTree(data, defaultPreferences(), "match")[0].projects;
    expect(projects.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(projects[0].workspaces.map((entry) => entry.id)).toEqual(["match"]);
    expect(projects[0].finishedAt).toBe(timestamp(late));
    expect(projects[0].totalWorkspaces).toBe(2);
  });

  it("ignores creation, user-message and streaming timestamps; uses completion/error attention timestamps", () => {
    const data = [
      host("local", {
        workspaces: [workspace("a", "a"), workspace("b", "b"), workspace("c", "c")],
        agents: [
          agent("a", "a", { updatedAt: late, lastUserMessageAt: late }),
          agent("b", "b", { attentionReason: "finished", attentionTimestamp: early }),
          agent("c", "c", { attentionReason: "error", attentionTimestamp: late }),
        ],
      }),
    ];
    const projects = buildTree(data, defaultPreferences(), "")[0].projects;
    expect(projects.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
    expect(projects[2].finishedAt).toBe(0);
  });

  it("updates a project's position when execution transitions from running to done", () => {
    const first = host("local", {
      workspaces: [
        workspace("a", "a", { status: "running" }),
        workspace("b", "b", { statusEnteredAt: early }),
      ],
    });
    expect(buildTree([first], defaultPreferences(), "")[0].projects[0].running).toBe(true);
    const done = {
      ...first,
      workspaces: [workspace("a", "a", { statusEnteredAt: late }), first.workspaces[1]],
    };
    const tree = buildTree([done], defaultPreferences(), "");
    expect(tree[0].projects[0].id).toBe("a");
    expect(tree[0].projects[0].running).toBe(false);
    expect(tree[0].projects[0].finishedAt).toBe(timestamp(late));
  });

  it("shows empty projects, filters by host and path, and excludes archiving workspaces", () => {
    const data = [
      host("local", {
        projects: [project("empty")],
        workspaces: [workspace("removed", "removed", { archivingAt: late })],
      }),
    ];
    expect(
      buildTree(data, defaultPreferences(), "local")[0].projects.map((entry) => entry.id),
    ).toEqual(["empty"]);
    expect(buildTree(data, defaultPreferences(), "/dev/empty")[0].projects).toHaveLength(1);
    expect(buildTree(data, defaultPreferences(), "no-match")).toHaveLength(0);
    expect(entityKey("a:b", "project", "c")).not.toBe(entityKey("a", "project", "b:c"));
  });
});
