import { describe, expect, it } from "vitest";
import {
  applyPreferenceChange,
  defaultPreferences,
  preferencesSchema,
} from "../shared/preferences";

describe("preferences", () => {
  it("starts with running first and newest finished first, without creation or discovery records", () => {
    expect(defaultPreferences()).toEqual({
      sort: "finished",
      direction: "desc",
      runningFirst: true,
      language: "zh",
      collapsed: [],
    });
  });
  it("preserves other clients' preferences when rebasing a collapse change", () => {
    const current = { ...defaultPreferences(), direction: "asc" as const, collapsed: ["remote"] };
    expect(applyPreferenceChange(current, { type: "collapse", key: "local", value: true })).toEqual(
      { ...current, collapsed: ["remote", "local"] },
    );
  });
  it("makes collapse operations idempotent and expands only the requested keys", () => {
    const current = { ...defaultPreferences(), collapsed: ["a", "b"] };
    expect(
      applyPreferenceChange(current, { type: "collapseMany", keys: ["a", "a"], value: false })
        .collapsed,
    ).toEqual(["b"]);
    expect(
      applyPreferenceChange(current, { type: "collapse", key: "a", value: true }).collapsed,
    ).toEqual(["a", "b"]);
  });
  it("validates persisted sorting options", () => {
    expect(preferencesSchema.safeParse({ sort: "creation" }).success).toBe(false);
    expect(preferencesSchema.parse({ sort: "name", runningFirst: false }).sort).toBe("name");
  });
});
