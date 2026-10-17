import { useSettings } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyPreferenceChange,
  defaultPreferences,
  navigatorPreferences,
  type PreferenceChange,
} from "../shared/preferences";

/** Serialize settings writes and rebase operations once after a revision conflict. */
export function usePreferences() {
  const settings = useSettings(navigatorPreferences);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [queue, setQueue] = useState<{ id: number; change: PreferenceChange }[]>([]);
  const nextId = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const change = useCallback((operation: PreferenceChange) => {
    if (settingsRef.current.status !== "ready") return;
    setQueue((current) => [...current, { id: ++nextId.current, change: operation }]);
  }, []);

  useEffect(() => {
    if (busy.current || error || queue.length === 0 || settings.status !== "ready") return;
    busy.current = true;
    const batch = queue;
    void (async () => {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const current = settingsRef.current;
          if (current.status !== "ready") throw new Error("Preferences are unavailable");
          const values = batch.reduce(
            (value, item) => applyPreferenceChange(value, item.change),
            current.values,
          );
          const saved = await current.save(values, current.revision);
          if (!mounted.current) return;
          if (saved) {
            const ids = new Set(batch.map((item) => item.id));
            setQueue((pending) => pending.filter((item) => !ids.has(item.id)));
            return;
          }
          await current.reload();
          // Let React publish the latest settings revision before rebasing.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (mounted.current)
          setError(
            "Preferences could not be saved. Your changes are kept in this view; retry to save them.",
          );
      } catch (failure) {
        if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        busy.current = false;
        if (mounted.current) setRetryVersion((version) => version + 1);
      }
    })();
  }, [queue, settings, error, retryVersion]);

  const preferences = queue.reduce(
    (value, item) => applyPreferenceChange(value, item.change),
    settings.status === "ready" ? settings.values : defaultPreferences(),
  );
  const retry = useCallback(() => {
    setError(null);
    void settingsRef.current.reload();
    setRetryVersion((version) => version + 1);
  }, []);
  return {
    preferences,
    change,
    ready: settings.status === "ready",
    loading: settings.status === "loading",
    error:
      error ??
      (settings.status === "error" || settings.status === "invalid" ? settings.error : null),
    retry,
  };
}
