import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { NavigatorScreen } from "./client/navigator";

function NavigatorItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="FolderTree"
      active={currentScreen?.screenId === "main"}
      onPress={() => openScreen({ screenId: "main" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "main", title: "Workspace Navigator", Component: NavigatorScreen });
  client.addSidebarHeaderItem({
    id: "navigator",
    title: "Workspace Navigator",
    Component: NavigatorItem,
  });
  client.addCommandCenterItem({
    id: "open-navigator",
    title: "Workspace Navigator",
    icon: "FolderTree",
    keywords: ["host", "project", "recent", "工作区", "项目"],
    context: "global",
    onSelect: ({ openScreen }) => openScreen({ screenId: "main" }),
  });
  return () => {};
}
