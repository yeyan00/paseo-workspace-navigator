import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const preferencesSchema = z.object({
  sort: z.enum(["finished", "name"]).default("finished"),
  direction: z.enum(["desc", "asc"]).default("desc"),
  runningFirst: z.boolean().default(true),
  language: z.enum(["zh", "en"]).default("zh"),
  collapsed: z.array(z.string()).default([]),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = (): Preferences => preferencesSchema.parse({});

export const navigatorPreferences = defineSettings({
  id: "navigator",
  scope: "host",
  version: 1,
  schema: preferencesSchema,
});

/** JSON tuple keys cannot collide when host or entity IDs contain separators. */
export function entityKey(hostId: string, kind: "project" | "workspace", id: string): string {
  return JSON.stringify([hostId, kind, id]);
}

export function hostKey(hostId: string): string {
  return JSON.stringify([hostId]);
}

export type PreferenceChange =
  | { type: "sort"; value: Preferences["sort"] }
  | { type: "direction"; value: Preferences["direction"] }
  | { type: "runningFirst"; value: boolean }
  | { type: "language"; value: Preferences["language"] }
  | { type: "collapse"; key: string; value: boolean }
  | { type: "collapseMany"; keys: string[]; value: boolean };

/** Operations are replayable on the latest revision after another client saves. */
export function applyPreferenceChange(current: Preferences, change: PreferenceChange): Preferences {
  switch (change.type) {
    case "sort":
      return current.sort === change.value ? current : { ...current, sort: change.value };
    case "direction":
      return { ...current, direction: change.value };
    case "runningFirst":
      return { ...current, runningFirst: change.value };
    case "language":
      return current.language === change.value ? current : { ...current, language: change.value };
    case "collapse":
    case "collapseMany": {
      const keys = change.type === "collapse" ? [change.key] : change.keys;
      const collapsed = new Set(current.collapsed);
      for (const key of keys) {
        if (change.value) collapsed.add(key);
        else collapsed.delete(key);
      }
      return { ...current, collapsed: [...collapsed] };
    }
  }
}
