import { getPaseoClient, type PluginScreenProps } from "@getpaseo/plugin/client";
import { copyText, Icon, Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Language } from "./i18n";
import { messages } from "./i18n";
import {
  archiveWorkspace,
  createWorkspaceOptions,
  type CreateWorkspaceDraft,
} from "./workspace-actions";
import type { ProjectNode, WorkspaceNode } from "./types";

export type ActionTarget =
  | { kind: "create" | "project"; project: ProjectNode }
  | { kind: "workspace" | "rename" | "archive"; workspace: WorkspaceNode };

export function RowAction({
  label,
  icon,
  onPress,
  disabled,
  color,
}: {
  label: string;
  icon: string;
  onPress(): void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 40,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
      })}
    >
      <Icon name={icon} size={17} color={color} />
    </Pressable>
  );
}

export function WorkspaceControls(props: {
  target: ActionTarget;
  setTarget(target: ActionTarget | null): void;
  theme: PluginScreenProps["theme"];
  navigation: PluginScreenProps["navigation"];
  language: Language;
  hostLabel: string | undefined;
  online: boolean;
  onCreated(project: ProjectNode): void;
  onChanged(hostId: string): void;
  notify(message: string): void;
}) {
  const { target, setTarget, theme, navigation, online, onCreated, onChanged, notify } = props;
  const t = messages[props.language];
  const c = theme.colors;
  const [name, setName] = useState(
    target.kind === "rename" && "workspace" in target ? target.workspace.name : "",
  );
  const [mode, setMode] = useState<CreateWorkspaceDraft["mode"]>("directory");
  const [baseRef, setBaseRef] = useState("");
  const [branchName, setBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const creationAttempt = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const hostId = "project" in target ? target.project.hostId : target.workspace.hostId;
  const entityName = "project" in target ? target.project.name : target.workspace.name;
  const title =
    target.kind === "create"
      ? t.newWorkspace
      : target.kind === "rename"
        ? t.rename
        : target.kind === "archive"
          ? t.archive
          : target.kind === "project"
            ? t.projectMenu
            : t.workspaceMenu;

  async function perform(operation: () => Promise<void>, requiresOnline = true) {
    if (busy.current) return;
    if (requiresOnline && !online) {
      setError(t.actionOffline);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function button(
    label: string,
    onPress: () => void,
    options: { disabled?: boolean; destructive?: boolean } = {},
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={pending || options.disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 44,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          opacity: pending || options.disabled ? 0.45 : pressed ? 0.7 : 1,
          backgroundColor: c.surface1,
        })}
      >
        <Text style={{ color: options.destructive ? c.statusDanger : c.foreground, fontSize: 13 }}>
          {label}
        </Text>
      </Pressable>
    );
  }
  function field(
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder?: string,
  ) {
    return (
      <View style={{ gap: 7 }}>
        <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.foregroundMuted}
          editable={!pending}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={256}
          style={{
            minHeight: 44,
            color: c.foreground,
            backgroundColor: c.surface1,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
          }}
        />
      </View>
    );
  }
  const copy = (value: string) =>
    void perform(async () => {
      await copyText(value);
      if (!mounted.current) return;
      notify(t.copied);
      setTarget(null);
    }, false);

  return (
    <Modal
      title={title}
      open
      onOpenChange={(open) => {
        if (!open && !busy.current) setTarget(null);
      }}
    >
      <Modal.Content>
        <View style={{ gap: 16 }}>
          <Text testID="action-host" style={{ color: c.foregroundMuted, fontSize: 12 }}>
            {props.hostLabel ?? hostId} · {hostId}
          </Text>
          <Text style={{ color: c.foreground, fontWeight: "600" }}>{entityName}</Text>
          {!online && (
            <Text style={{ color: c.statusWarning, fontSize: 12 }}>{t.actionOffline}</Text>
          )}
          {target.kind === "create" && (
            <>
              <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{target.project.path}</Text>
              {field(t.workspaceName, name, setName, t.optionalTitle)}
              <View style={{ gap: 8 }}>
                {(
                  [
                    "directory",
                    ...(target.project.kind === "git" ? ["worktree" as const] : []),
                  ] as const
                ).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: mode === value }}
                    disabled={pending}
                    onPress={() => setMode(value)}
                    style={{
                      padding: 12,
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: mode === value ? c.accent : c.border,
                      borderRadius: 8,
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <Icon
                      name={mode === value ? "CircleDot" : "Circle"}
                      size={16}
                      color={mode === value ? c.accent : c.foregroundMuted}
                    />
                    <Text style={{ color: c.foreground }}>
                      {value === "directory" ? t.directoryMode : t.worktreeMode}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: c.foregroundMuted, fontSize: 12, lineHeight: 19 }}>
                {mode === "directory" ? t.directoryHint : t.worktreeHint}
              </Text>
              {mode === "worktree" && (
                <>
                  {field(t.baseRef, baseRef, setBaseRef, t.baseRefPlaceholder)}
                  {field(t.branchName, branchName, setBranchName, t.branchPlaceholder)}
                </>
              )}
              <Text style={{ color: c.foregroundMuted, fontSize: 12, lineHeight: 19 }}>
                {t.createHint}
              </Text>
              {button(
                t.create,
                () =>
                  void perform(async () => {
                    const draft = { title: name, mode, baseRef, branchName };
                    const signature = JSON.stringify([target.project.key, draft]);
                    if (creationAttempt.current?.signature !== signature)
                      creationAttempt.current = {
                        signature,
                        key: `navigator-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      };
                    const created = await getPaseoClient(hostId).workspaces.create(
                      createWorkspaceOptions(target.project, draft, creationAttempt.current.key),
                    );
                    if (!mounted.current) return;
                    onCreated(target.project);
                    notify(t.created);
                    setTarget(null);
                    try {
                      navigation?.openWorkspace({ workspaceId: created.id, serverId: hostId });
                    } catch {
                      notify(t.createdOpenFailed);
                    }
                  }),
                { disabled: !online || !navigation?.openWorkspace },
              )}
            </>
          )}
          {target.kind === "project" && (
            <>
              {button(
                t.newWorkspace,
                () => setTarget({ kind: "create", project: target.project }),
                { disabled: !online || !navigation?.openWorkspace },
              )}
              {button(t.copyPath, () => copy(target.project.path))}
            </>
          )}
          {target.kind === "workspace" && (
            <>
              {button(t.rename, () => setTarget({ kind: "rename", workspace: target.workspace }), {
                disabled: !online,
              })}
              {button(t.copyPath, () => copy(target.workspace.directory))}
              {target.workspace.branch &&
                button(t.copyBranch, () => copy(target.workspace.branch!))}
              {button(
                t.archive,
                () => setTarget({ kind: "archive", workspace: target.workspace }),
                { disabled: !online, destructive: true },
              )}
            </>
          )}
          {target.kind === "rename" && (
            <>
              {field(t.workspaceName, name, setName)}
              {button(
                t.save,
                () =>
                  void perform(async () => {
                    if (!name.trim()) throw new Error(t.nameRequired);
                    await getPaseoClient(hostId)
                      .workspaces.ref(target.workspace.id)
                      .setTitle(name.trim());
                    if (!mounted.current) return;
                    onChanged(hostId);
                    notify(t.saved);
                    setTarget(null);
                  }),
                { disabled: !online || !name.trim() },
              )}
            </>
          )}
          {target.kind === "archive" && (
            <>
              <Text style={{ color: c.foregroundMuted, fontSize: 13, lineHeight: 21 }}>
                {t.archiveHint}
              </Text>
              {target.workspace.kind === "worktree" && (
                <Text style={{ color: c.statusWarning, fontSize: 13, lineHeight: 21 }}>
                  {t.archiveWorktreeHint}
                </Text>
              )}
              {button(
                t.archiveConfirm,
                () =>
                  void perform(async () => {
                    await archiveWorkspace(getPaseoClient(hostId), target.workspace);
                    if (!mounted.current) return;
                    onChanged(hostId);
                    notify(t.archived);
                    setTarget(null);
                  }),
                { disabled: !online, destructive: true },
              )}
            </>
          )}
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ color: c.statusDanger, fontSize: 12, lineHeight: 19 }}
            >
              {error}
            </Text>
          )}
          {pending && <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{t.busy}</Text>}
          {button(t.cancel, () => setTarget(null))}
        </View>
      </Modal.Content>
    </Modal>
  );
}
