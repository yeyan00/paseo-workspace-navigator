import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { NavigatorScreen } from "../client/navigator";
import { disconnectRemote } from "./host-sdk";
import { finishDemoExecution } from "./sample-data";
import type { PluginTheme } from "@getpaseo/plugin";
import "./style.css";

const theme: PluginTheme = {
  colors: {
    surface0: "#0c1016",
    surface1: "#141b25",
    surface2: "#1e2938",
    border: "#283343",
    foreground: "#e5edf7",
    foregroundMuted: "#8e9cb1",
    accent: "#75b7ff",
    accentForeground: "#0c1016",
    statusSuccess: "#72c8a1",
    statusWarning: "#e7bc72",
    statusDanger: "#f08b96",
  },
};

function App() {
  const { width } = useWindowDimensions();
  const [opened, setOpened] = useState("");
  return (
    <View style={{ height: "100%", flex: 1, maxWidth: 1100, width: "100%", alignSelf: "center" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          padding: 12,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
          flexWrap: "wrap",
        }}
      >
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
          LOCAL PREVIEW · SAMPLE DATA
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish demo execution"
          onPress={finishDemoExecution}
        >
          <Text style={{ color: theme.colors.accent, fontSize: 11 }}>模拟执行完成</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle remote connection"
          onPress={disconnectRemote}
        >
          <Text style={{ color: theme.colors.accent, fontSize: 11 }}>切换远端连接</Text>
        </Pressable>
        <Text testID="opened-target" style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
          {opened}
        </Text>
      </View>
      <NavigatorScreen
        host={{ id: "local", label: "本机" }}
        theme={theme}
        layout={{ compact: width < 640, platform: "web" }}
        params={{}}
        navigation={{
          openWorkspace: ({ workspaceId, serverId }) => setOpened(`${serverId}/${workspaceId}`),
          openAgent: () => {},
        }}
      />
    </View>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
