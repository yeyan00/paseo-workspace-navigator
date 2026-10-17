import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { NavigatorView } from "./navigator-view";
import { useHostData } from "./use-host-data";
import { usePreferences } from "./use-preferences";

export function NavigatorScreen(props: PluginScreenProps) {
  // The host picker can switch installations without changing this screen's
  // component type. Never carry an in-flight settings queue to another host.
  return <HostNavigator key={props.host.id} {...props} />;
}

function HostNavigator(props: PluginScreenProps) {
  const { data, retry } = useHostData();
  const preferences = usePreferences();
  return (
    <NavigatorView
      {...props}
      data={data}
      preferences={preferences.preferences}
      change={preferences.change}
      ready={preferences.ready}
      preferencesLoading={preferences.loading}
      preferencesError={preferences.error}
      retryPreferences={preferences.retry}
      refresh={retry}
    />
  );
}
