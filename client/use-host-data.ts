import { getPaseoClient, useHosts } from "@getpaseo/plugin/client";
import type { PaseoApi } from "./paseo-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { createHostObserver, type HostObserver } from "./host-observer";
import type { HostData } from "./types";

export function useHostData() {
  const hosts = useHosts();
  const [snapshots, setSnapshots] = useState<Record<string, Omit<HostData, "host">>>({});
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [reconcileVersion, setReconcileVersion] = useState(0);
  const observers = useRef(new Map<string, { api: PaseoApi; observer: HostObserver }>());
  const retry = useCallback(() => setRefreshVersion((version) => version + 1), []);
  const refreshHost = useCallback((hostId: string) => {
    observers.current.get(hostId)?.observer.stop();
    observers.current.delete(hostId);
    // Preserve every snapshot, especially cached hosts that are now offline.
    setReconcileVersion((version) => version + 1);
  }, []);
  useEffect(() => {
    const active = observers.current;
    for (const entry of active.values()) entry.observer.stop();
    active.clear();
    setSnapshots({});
    // This effect only resets on an explicit retry, not on one host disconnecting.
  }, [refreshVersion]);
  useEffect(() => {
    const active = observers.current;
    // Bind the identity at the subscription boundary, independently of list order.
    function observeHost(hostId: string) {
      try {
        const api = getPaseoClient(hostId);
        if (active.get(hostId)?.api === api) return;
        active.get(hostId)?.observer.stop();
        const observer = createHostObserver(api, (data) => {
          if (active.get(hostId)?.observer !== observer) return;
          setSnapshots((current) => ({ ...current, [hostId]: data }));
        });
        active.set(hostId, { api, observer });
        observer.start();
      } catch (error) {
        setSnapshots((current) => ({
          ...current,
          [hostId]: {
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
    const reconcile = () => {
      for (const [id, entry] of active) {
        if (!hosts.some((host) => host.serverId === id && host.status === "online")) {
          entry.observer.stop();
          active.delete(id);
        }
      }
      for (const host of hosts) {
        if (host.status !== "online") continue;
        observeHost(host.serverId);
      }
    };
    reconcile();
    // Also detect an online connection being replaced without a status change.
    const interval = setInterval(reconcile, 15_000);
    return () => clearInterval(interval);
  }, [hosts, refreshVersion, reconcileVersion]);
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
  return { data, retry, refreshHost };
}
