import { getPaseoClient, useHosts } from "@getpaseo/plugin/client";
import type { PaseoApi } from "./paseo-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { HostObserver } from "./host-observer";
import type { HostData } from "./types";

export function useHostData() {
  const hosts = useHosts();
  const [snapshots, setSnapshots] = useState<Record<string, Omit<HostData, "host">>>({});
  const [refreshVersion, setRefreshVersion] = useState(0);
  const observers = useRef(new Map<string, { api: PaseoApi; observer: HostObserver }>());
  const retry = useCallback(() => setRefreshVersion((version) => version + 1), []);
  useEffect(() => {
    const active = observers.current;
    for (const entry of active.values()) entry.observer.stop();
    active.clear();
    setSnapshots({});
    // This effect only resets on an explicit retry, not on one host disconnecting.
  }, [refreshVersion]);
  useEffect(() => {
    const active = observers.current;
    const reconcile = () => {
      for (const [id, entry] of active) {
        if (!hosts.some((host) => host.serverId === id && host.status === "online")) {
          entry.observer.stop();
          active.delete(id);
        }
      }
      for (const host of hosts) {
        if (host.status !== "online") continue;
        try {
          const api = getPaseoClient(host.serverId);
          if (active.get(host.serverId)?.api === api) continue;
          active.get(host.serverId)?.observer.stop();
          const observer = new HostObserver(api, (data) =>
            setSnapshots((current) => ({ ...current, [host.serverId]: data })),
          );
          active.set(host.serverId, { api, observer });
          observer.start();
        } catch (error) {
          setSnapshots((current) => ({
            ...current,
            [host.serverId]: {
              projects: [],
              workspaces: [],
              agents: [],
              loading: false,
              projectsReady: false,
              error: error instanceof Error ? error.message : String(error),
            },
          }));
        }
      }
    };
    reconcile();
    // Also detect an online connection being replaced without a status change.
    const interval = setInterval(reconcile, 15_000);
    return () => clearInterval(interval);
  }, [hosts, refreshVersion]);
  useEffect(
    () => () => {
      for (const entry of observers.current.values()) entry.observer.stop();
      observers.current.clear();
    },
    [],
  );
  const data: HostData[] = hosts.map((host) => ({
    ...(snapshots[host.serverId] ?? {
      projects: [],
      workspaces: [],
      agents: [],
      loading: host.status === "online",
      projectsReady: false,
      error: null,
    }),
    host,
    ...(host.status !== "online" ? { loading: false, projectsReady: false } : {}),
  }));
  return { data, retry };
}
