import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { FlatList, Icon, Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Switch, Text, View, type ViewStyle } from "react-native";
import { buildTree } from "./tree-model";
import { messages, relativeTime } from "./i18n";
import type { HostData, HostNode, ProjectNode, WorkspaceNode } from "./types";
import type { PreferenceChange, Preferences } from "../shared/preferences";

export interface NavigatorViewProps extends PluginScreenProps {
  data: HostData[];
  preferences: Preferences;
  change(operation: PreferenceChange): void;
  ready: boolean;
  preferencesLoading: boolean;
  preferencesError: string | null;
  retryPreferences(): void;
  refresh(): void;
}

type Row =
  | { kind: "host"; key: string; host: HostNode; expanded: boolean }
  | { kind: "project"; key: string; project: ProjectNode; expanded: boolean; online: boolean }
  | { kind: "workspace"; key: string; workspace: WorkspaceNode; online: boolean }
  | { kind: "notice"; key: string; text: string; error?: boolean; indent: number };

export function NavigatorView({
  theme,
  layout,
  navigation,
  data,
  preferences,
  change,
  ready,
  preferencesLoading,
  preferencesError,
  retryPreferences,
  refresh,
}: NavigatorViewProps) {
  const t = messages[preferences.language];
  const c = theme.colors;
  const [query, setQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  const tree = useMemo(() => buildTree(data, preferences, query), [data, preferences, query]);
  const searching = query.trim().length > 0;
  const collapsed = new Set(preferences.collapsed);
  const rows: Row[] = [];
  for (const host of tree) {
    const expanded = searching || !collapsed.has(host.key);
    const online = host.host.status === "online";
    rows.push({ kind: "host", key: host.key, host, expanded });
    if (!expanded) continue;
    if (host.loading)
      rows.push({ kind: "notice", key: `${host.key}-loading`, text: t.loading, indent: 1 });
    if (!online)
      rows.push({ kind: "notice", key: `${host.key}-offline`, text: t.offlineHint, indent: 1 });
    if (host.error && online)
      rows.push({
        kind: "notice",
        key: `${host.key}-error`,
        text: host.error,
        error: true,
        indent: 1,
      });
    if (!host.loading && online && !host.error && host.projects.length === 0)
      rows.push({ kind: "notice", key: `${host.key}-empty`, text: t.noProjects, indent: 1 });
    for (const project of host.projects) {
      const projectExpanded = searching || !collapsed.has(project.key);
      rows.push({ kind: "project", key: project.key, project, expanded: projectExpanded, online });
      if (!projectExpanded) continue;
      if (project.workspaces.length === 0)
        rows.push({ kind: "notice", key: `${project.key}-empty`, text: t.noWorkspaces, indent: 2 });
      for (const workspace of project.workspaces)
        rows.push({ kind: "workspace", key: workspace.key, workspace, online });
    }
  }
  const padding = layout.compact ? 14 : 24;
  const text = { color: c.foreground };
  const muted = { color: c.foregroundMuted };
  const statusColor = (status: WorkspaceNode["status"]) =>
    status === "running"
      ? c.accent
      : status === "failed"
        ? c.statusDanger
        : status === "needs_input"
          ? c.statusWarning
          : status === "attention"
            ? c.statusSuccess
            : c.foregroundMuted;
  const allKeys = data.flatMap((entry) => {
    const host = buildTree([entry], preferences, "")[0];
    return host ? [host.key, ...host.projects.map((project) => project.key)] : [];
  });
  const toggle = (key: string) => change({ type: "collapse", key, value: !collapsed.has(key) });
  const buttonStyle: ViewStyle = {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  };
  function Button({
    label,
    icon,
    action,
    disabled = false,
  }: {
    label: string;
    icon: string;
    action(): void;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={action}
        style={({ pressed }) => [
          buttonStyle,
          { opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? c.surface2 : c.surface1 },
        ]}
      >
        <Icon name={icon} size={15} color={c.foregroundMuted} />
        <Text style={[text, { fontSize: 12 }]}>{label}</Text>
      </Pressable>
    );
  }
  const totalProjects = tree.reduce((sum, host) => sum + host.projects.length, 0);
  const totalWorkspaces = tree.reduce(
    (sum, host) =>
      sum + host.projects.reduce((count, project) => count + project.workspaces.length, 0),
    0,
  );
  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "notice")
      return (
        <View style={{ paddingLeft: 28 * item.indent + 18, paddingVertical: 12, paddingRight: 16 }}>
          <Text
            style={{
              color: item.error ? c.statusDanger : c.foregroundMuted,
              fontSize: 12,
              lineHeight: 19,
            }}
          >
            {item.text}
          </Text>
        </View>
      );
    if (item.kind === "host") {
      const { host, expanded } = item;
      return (
        <Pressable
          testID={`host-${host.host.serverId}`}
          accessibilityRole="button"
          accessibilityLabel={host.host.label}
          accessibilityState={{ expanded }}
          onPress={() => toggle(host.key)}
          disabled={!ready || searching}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            marginTop: 12,
            borderRadius: 10,
            backgroundColor: pressed ? c.surface2 : c.surface1,
            borderWidth: 1,
            borderColor: c.border,
          })}
        >
          <Icon
            name={expanded ? "ChevronDown" : "ChevronRight"}
            size={15}
            color={c.foregroundMuted}
          />
          <Icon name="Server" size={18} color={c.foreground} />
          <Text numberOfLines={1} style={[text, { fontWeight: "700", fontSize: 14, flex: 1 }]}>
            {host.host.label}
          </Text>
          <Text style={[muted, { fontSize: 11 }]}>
            {host.projects.length} {t.projects}
          </Text>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: host.host.status === "online" ? c.statusSuccess : c.foregroundMuted,
            }}
          />
          {!layout.compact && <Text style={[muted, { fontSize: 11 }]}>{t[host.host.status]}</Text>}
        </Pressable>
      );
    }
    if (item.kind === "project") {
      const { project, expanded } = item;
      return (
        <Pressable
          testID={`project-${project.hostId}-${project.id}`}
          accessibilityRole="button"
          accessibilityLabel={project.name}
          accessibilityState={{ expanded }}
          disabled={!ready || searching}
          onPress={() => toggle(project.key)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 13,
            paddingLeft: 28,
            paddingRight: 14,
            borderRadius: 8,
            backgroundColor: pressed ? c.surface1 : c.surface0,
          })}
        >
          <Icon
            name={expanded ? "ChevronDown" : "ChevronRight"}
            size={14}
            color={c.foregroundMuted}
          />
          <Icon
            name={project.kind === "git" ? "FolderGit2" : "Folder"}
            size={18}
            color={project.running ? c.accent : c.foregroundMuted}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={1} style={[text, { fontWeight: "600", fontSize: 14 }]}>
              {project.name}
            </Text>
            <Text numberOfLines={1} style={[muted, { fontSize: 11 }]}>
              {layout.compact ? relativeTime(project.finishedAt, now, t) : project.path}
            </Text>
          </View>
          {project.running && <Text style={{ color: c.accent, fontSize: 11 }}>{t.running}</Text>}
          <Text style={[muted, { fontSize: 11 }]}>{project.totalWorkspaces}</Text>
          {!layout.compact && (
            <Text style={[muted, { fontSize: 11, width: 110, textAlign: "right" }]}>
              {relativeTime(project.finishedAt, now, t)}
            </Text>
          )}
        </Pressable>
      );
    }
    const { workspace, online } = item;
    return (
      <Pressable
        testID={`workspace-${workspace.hostId}-${workspace.id}`}
        accessibilityRole="button"
        accessibilityLabel={workspace.name}
        accessibilityHint={workspace.directory}
        disabled={!online || !navigation?.openWorkspace}
        onPress={() => {
          try {
            setOpenError(null);
            navigation?.openWorkspace({ workspaceId: workspace.id, serverId: workspace.hostId });
          } catch (error) {
            setOpenError(
              `${t.openFailed}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 12,
          paddingLeft: 64,
          paddingRight: 14,
          borderRadius: 8,
          opacity: online ? 1 : 0.5,
          backgroundColor: pressed ? c.surface2 : c.surface0,
        })}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: statusColor(workspace.status),
          }}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={[text, { fontSize: 13 }]} numberOfLines={1}>
            {workspace.name}
          </Text>
          {layout.compact ? (
            <Text style={[muted, { fontSize: 11 }]}>
              {relativeTime(workspace.finishedAt, now, t)}
            </Text>
          ) : (
            workspace.branch &&
            workspace.branch !== workspace.name && (
              <Text numberOfLines={1} style={[muted, { fontSize: 11 }]}>
                {workspace.branch}
              </Text>
            )
          )}
        </View>
        <Text style={{ color: statusColor(workspace.status), fontSize: 11 }}>
          {t[workspace.status]}
        </Text>
        {!layout.compact && (
          <Text style={[muted, { fontSize: 11, width: 110, textAlign: "right" }]}>
            {relativeTime(workspace.finishedAt, now, t)}
          </Text>
        )}
        <Icon name="ArrowUpRight" size={13} color={c.foregroundMuted} />
      </Pressable>
    );
  };
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface0,
        paddingHorizontal: padding,
        paddingTop: padding,
      }}
    >
      <View style={{ gap: 7, marginBottom: 20 }}>
        <Text
          accessibilityRole="header"
          style={[
            text,
            { fontSize: layout.compact ? 22 : 28, fontWeight: "700", letterSpacing: -0.7 },
          ]}
        >
          {t.title}
        </Text>
        <Text style={[muted, { fontSize: 13 }]}>{t.subtitle}</Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 200,
            minHeight: 40,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 9,
            paddingHorizontal: 12,
            backgroundColor: c.surface1,
          }}
        >
          <Icon name="Search" size={16} color={c.foregroundMuted} />
          <TextInput
            accessibilityLabel={t.search}
            placeholder={t.search}
            placeholderTextColor={c.foregroundMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 13, color: c.foreground, paddingVertical: 10 }}
          />
          {!!query && (
            <Pressable
              accessibilityLabel={t.clear}
              accessibilityRole="button"
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <Icon name="X" size={15} color={c.foregroundMuted} />
            </Pressable>
          )}
        </View>
        <Button
          label={t.sort}
          icon="ArrowDownUp"
          action={() => setSortOpen(true)}
          disabled={!ready}
        />
        <Button
          label={preferences.language === "zh" ? "EN" : "中文"}
          icon="Languages"
          action={() =>
            change({ type: "language", value: preferences.language === "zh" ? "en" : "zh" })
          }
          disabled={!ready}
        />
        <Button label={t.refresh} icon="RefreshCw" action={refresh} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <Text style={[muted, { flex: 1, fontSize: 11 }]}>
          {tree.length} {t.hosts} · {totalProjects} {t.projects} · {totalWorkspaces} {t.workspaces}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!ready || searching}
          onPress={() => change({ type: "collapseMany", keys: allKeys, value: false })}
        >
          <Text style={{ color: c.accent, fontSize: 11 }}>{t.expand}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!ready || searching}
          onPress={() => change({ type: "collapseMany", keys: allKeys, value: true })}
        >
          <Text style={{ color: c.accent, fontSize: 11 }}>{t.collapse}</Text>
        </Pressable>
      </View>
      {preferencesLoading && (
        <Text style={[muted, { paddingVertical: 8 }]}>{t.preferencesLoading}</Text>
      )}
      {!!preferencesError && (
        <View style={{ paddingVertical: 10, gap: 6 }}>
          <Text style={{ color: c.statusDanger, fontSize: 12 }}>
            {t.preferencesError}: {preferencesError}
          </Text>
          <Button label={t.retry} icon="RefreshCw" action={retryPreferences} />
        </View>
      )}
      {!navigation?.openWorkspace && (
        <Text style={{ color: c.statusWarning, paddingVertical: 8 }}>{t.navigationMissing}</Text>
      )}
      {!!openError && (
        <Text style={{ color: c.statusDanger, paddingVertical: 8 }}>{openError}</Text>
      )}
      <FlatList<Row>
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        initialNumToRender={30}
        ListEmptyComponent={
          <View style={{ padding: 40, gap: 12, alignItems: "center" }}>
            <Icon name={data.length ? "SearchX" : "Server"} size={30} color={c.foregroundMuted} />
            <Text style={[text, { fontWeight: "600" }]}>{data.length ? t.noMatch : t.noHosts}</Text>
            <Text style={[muted, { textAlign: "center", fontSize: 12 }]}>
              {data.length ? t.noMatchHint : t.noHostsHint}
            </Text>
          </View>
        }
      />
      <Modal
        title={t.sort}
        icon={<Icon name="ArrowDownUp" size={18} color={c.foreground} />}
        open={sortOpen}
        onOpenChange={setSortOpen}
      >
        <Modal.Content>
          <View style={{ gap: 20 }}>
            <View style={{ gap: 8 }}>
              {(["finished", "name"] as const).map((sort) => (
                <Pressable
                  key={sort}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: preferences.sort === sort }}
                  onPress={() => change({ type: "sort", value: sort })}
                  style={[
                    buttonStyle,
                    { backgroundColor: preferences.sort === sort ? c.surface2 : c.surface0 },
                  ]}
                >
                  <Icon
                    name={preferences.sort === sort ? "CircleDot" : "Circle"}
                    size={16}
                    color={preferences.sort === sort ? c.accent : c.foregroundMuted}
                  />
                  <Text style={text}>{t[sort]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["desc", "asc"] as const).map((direction) => (
                <Pressable
                  key={direction}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: preferences.direction === direction }}
                  onPress={() => change({ type: "direction", value: direction })}
                  style={[
                    buttonStyle,
                    {
                      flex: 1,
                      backgroundColor:
                        preferences.direction === direction ? c.surface2 : c.surface0,
                    },
                  ]}
                >
                  <Icon
                    name={direction === "desc" ? "ArrowDown" : "ArrowUp"}
                    size={16}
                    color={preferences.direction === direction ? c.accent : c.foregroundMuted}
                  />
                  <Text style={[text, { flexShrink: 1, fontSize: 12 }]}>
                    {preferences.sort === "finished"
                      ? direction === "desc"
                        ? t.newest
                        : t.oldest
                      : direction === "desc"
                        ? t.descending
                        : t.ascending}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[text, { fontWeight: "600" }]}>{t.runningFirst}</Text>
                <Text style={[muted, { fontSize: 12 }]}>{t.runningHint}</Text>
              </View>
              <Switch
                accessibilityLabel={t.runningFirst}
                value={preferences.runningFirst}
                onValueChange={(value) => change({ type: "runningFirst", value })}
                trackColor={{ false: c.border, true: c.accent }}
              />
            </View>
            <Text style={[muted, { fontSize: 12, lineHeight: 19 }]}>{t.sortHint}</Text>
            <Text style={[muted, { fontSize: 12, lineHeight: 19 }]}>{t.completedHint}</Text>
            <Text style={[muted, { fontSize: 11, lineHeight: 18 }]}>{t.savedOnHost}</Text>
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}
