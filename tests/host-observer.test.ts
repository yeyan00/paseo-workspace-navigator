import { describe, expect, it, vi } from "vitest";
import type { OwnedSubscription, PaseoApi, SubscriptionObserver } from "@getpaseo/client";
import type { SessionOutboundMessage } from "@getpaseo/protocol/messages";
import { HostObserver } from "../client/host-observer";
import type { HostData } from "../client/types";
import { agent, project, workspace } from "./fixtures";

function stream<T>(snapshot: T) {
  const listeners = new Set<SubscriptionObserver<T & { subscriptionId: string }>>();
  const release = vi.fn(async () => {
    listeners.clear();
  });
  const subscription: OwnedSubscription<T> = {
    subscriptionId: "sub",
    ready: Promise.resolve({ ...snapshot, subscriptionId: "sub" }),
    release,
    subscribe(observer) {
      listeners.add(observer);
      observer.snapshot({ ...snapshot, subscriptionId: "sub" });
      return () => {
        listeners.delete(observer);
      };
    },
  };
  return {
    subscription,
    release,
    update(event: SessionOutboundMessage) {
      for (const listener of listeners) listener.update(event);
    },
    snapshot(next: T) {
      snapshot = next;
      for (const listener of listeners) listener.snapshot({ ...next, subscriptionId: "sub" });
    },
  };
}
const pageInfo = { nextCursor: null as string | null, prevCursor: null, hasMore: false };

function fixture() {
  const projects = stream({ events: [] });
  const workspaces = stream({ requestId: "w", entries: [workspace("w1", "p1")], pageInfo });
  const agents = stream({
    requestId: "a",
    entries: [{ agent: agent("a1", "w1"), project: null }],
    pageInfo,
  });
  const listProjects = vi.fn(async () => ({ projects: [project("p1")], requestId: "p" }));
  const listWorkspaces = vi.fn(
    async (options: { subscribe?: object; page?: { cursor?: string } }) => ({
      ...(await workspaces.subscription.ready),
      ...(options.subscribe ? { subscription: workspaces.subscription } : {}),
    }),
  );
  const listAgents = vi.fn(async () => ({
    ...(await agents.subscription.ready),
    subscription: agents.subscription,
  }));
  const dispose = vi.fn();
  const api = {
    observeEvents: () => projects.subscription,
    projects: { list: listProjects },
    workspaces: { list: listWorkspaces },
    agents: { list: listAgents },
    dispose,
  } as unknown as PaseoApi;
  let latest: Omit<HostData, "host"> | undefined;
  const publish = vi.fn((next: Omit<HostData, "host">) => {
    latest = next;
  });
  const observer = new HostObserver(api, publish);
  return {
    observer,
    projects,
    workspaces,
    agents,
    listProjects,
    listWorkspaces,
    listAgents,
    dispose,
    publish,
    get latest() {
      return latest;
    },
  };
}

describe("host directory lifecycle", () => {
  it("loads projects, workspaces and agents, then applies live updates and removals", async () => {
    const f = fixture();
    f.observer.start();
    await vi.waitFor(() => expect(f.latest?.loading).toBe(false));
    expect(f.latest?.projectsReady).toBe(true);
    expect(f.latest?.agents[0].id).toBe("a1");
    f.workspaces.update({
      type: "workspace_update",
      payload: { kind: "upsert", workspace: workspace("w2", "p1") },
    });
    f.agents.update({
      type: "agent_update",
      payload: { kind: "upsert", agent: agent("a1", "w1", { status: "running" }) },
    });
    expect(f.latest?.workspaces.map((entry) => entry.id)).toEqual(["w1", "w2"]);
    expect(f.latest?.agents[0].status).toBe("running");
    f.workspaces.update({ type: "workspace_update", payload: { kind: "remove", id: "w1" } });
    f.projects.update({ type: "project.update", payload: { kind: "remove", projectId: "p1" } });
    expect(f.latest?.workspaces.map((entry) => entry.id)).toEqual(["w2"]);
    expect(f.latest?.projects).toHaveLength(0);
    f.observer.stop();
  });

  it("reads every page and replays updates arriving during pagination after the snapshots", async () => {
    const f = fixture();
    f.workspaces.snapshot({
      requestId: "w",
      entries: [workspace("w1", "p1")],
      pageInfo: { ...pageInfo, nextCursor: "next", hasMore: true },
    });
    let resolve!: (value: Awaited<ReturnType<typeof f.listWorkspaces>>) => void;
    f.listWorkspaces.mockImplementation(async (options) =>
      options.subscribe
        ? {
            ...(await f.workspaces.subscription.ready),
            entries: [workspace("w1", "p1")],
            pageInfo: { ...pageInfo, nextCursor: "next", hasMore: true },
            subscription: f.workspaces.subscription,
          }
        : new Promise((accept) => {
            resolve = accept;
          }),
    );
    f.observer.start();
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    f.workspaces.update({
      type: "workspace_update",
      payload: { kind: "upsert", workspace: workspace("w1", "p1", { name: "new title" }) },
    });
    resolve({
      requestId: "page2",
      subscriptionId: "sub",
      entries: [workspace("w2", "p2")],
      pageInfo,
    });
    await vi.waitFor(() => expect(f.latest?.loading).toBe(false));
    expect(f.latest?.workspaces.map((entry) => entry.name)).toEqual(["new title", "w2"]);
    f.observer.stop();
  });

  it("replaces stale directories on reconnect instead of retaining removed entries", async () => {
    const f = fixture();
    f.observer.start();
    await vi.waitFor(() => expect(f.latest?.loading).toBe(false));
    f.workspaces.snapshot({ requestId: "new", entries: [workspace("w2", "p2")], pageInfo });
    await vi.waitFor(() => expect(f.latest?.workspaces.map((entry) => entry.id)).toEqual(["w2"]));
    f.observer.stop();
  });

  it("keeps independent sections when one directory request fails", async () => {
    const f = fixture();
    f.listAgents.mockRejectedValue(new Error("agents unavailable"));
    f.observer.start();
    await vi.waitFor(() => expect(f.latest?.loading).toBe(false));
    expect(f.latest?.projects).toHaveLength(1);
    expect(f.latest?.workspaces).toHaveLength(1);
    expect(f.latest?.error).toContain("agents unavailable");
    f.observer.stop();
  });

  it("releases every subscription without disposing the borrowed client", async () => {
    const f = fixture();
    f.observer.start();
    await vi.waitFor(() => expect(f.latest?.loading).toBe(false));
    f.observer.stop();
    expect(f.projects.release).toHaveBeenCalledOnce();
    expect(f.workspaces.release).toHaveBeenCalledOnce();
    expect(f.agents.release).toHaveBeenCalledOnce();
    expect(f.dispose).not.toHaveBeenCalled();
    const count = f.publish.mock.calls.length;
    f.workspaces.update({ type: "workspace_update", payload: { kind: "remove", id: "w1" } });
    expect(f.publish).toHaveBeenCalledTimes(count);
  });

  it("releases a subscription that resolves after unmount", async () => {
    const f = fixture();
    let resolve!: (value: Awaited<ReturnType<typeof f.listWorkspaces>>) => void;
    f.listWorkspaces.mockImplementation(
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );
    f.observer.start();
    f.observer.stop();
    resolve({
      ...(await f.workspaces.subscription.ready),
      subscription: f.workspaces.subscription,
    });
    await vi.waitFor(() => expect(f.workspaces.release).toHaveBeenCalledOnce());
    expect(f.dispose).not.toHaveBeenCalled();
  });
});
