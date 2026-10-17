import type { PluginServerContext } from "@getpaseo/plugin/server";
import { navigatorPreferences } from "./shared/preferences";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(navigatorPreferences);
  return () => {};
}
