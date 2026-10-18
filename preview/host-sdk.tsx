// Development-only host adapter. Production uses Paseo's real SDK and connections.
import { useCallback, useSyncExternalStore } from "react";
import type { PaseoApi } from "@getpaseo/client";
import type { PluginHostSummary } from "@getpaseo/plugin/client";
import type { SettingsDefinition } from "@getpaseo/plugin";
import type { ZodType } from "zod";
import { defaultPreferences, preferencesSchema } from "../shared/preferences";
import { demoApis, demoHosts } from "./sample-data";

let hosts: readonly PluginHostSummary[] = demoHosts;
const hostListeners = new Set<() => void>();
export function useHosts() {
  return useSyncExternalStore(
    (listener) => {
      hostListeners.add(listener);
      return () => {
        hostListeners.delete(listener);
      };
    },
    () => hosts,
  );
}
export function disconnectRemote() {
  hosts = hosts.map((host) =>
    host.serverId === "remote"
      ? { ...host, status: host.status === "online" ? "offline" : "online" }
      : host,
  );
  for (const listener of hostListeners) listener();
}
export function reorderDemoHosts() {
  hosts = [...hosts].reverse();
  for (const listener of hostListeners) listener();
}
export function getPaseoClient(serverId: string): PaseoApi {
  const host = hosts.find((host) => host.serverId === serverId);
  if (host?.status !== "online") throw new Error("Host is disconnected");
  return demoApis[serverId];
}

const storageKey = "workspace-navigator-preview";
let values = defaultPreferences();
try {
  values = preferencesSchema.parse(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
} catch {
  /* A fresh demo profile. */
}
let revision = 0;
let snapshot = { status: "ready" as const, values, revision: String(revision) };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function useSettings(_definition: SettingsDefinition<ZodType>) {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  const save = useCallback(async (next: unknown, expected: string) => {
    if (expected !== snapshot.revision) return false;
    values = preferencesSchema.parse(next);
    localStorage.setItem(storageKey, JSON.stringify(values));
    snapshot = { status: "ready", values, revision: String(++revision) };
    for (const listener of listeners) listener();
    return true;
  }, []);
  return {
    ...state,
    saving: false,
    saveError: null,
    save,
    reset: async () => save(defaultPreferences(), snapshot.revision),
    reload: async () => {},
  };
}
