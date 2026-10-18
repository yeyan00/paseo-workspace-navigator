import type { ReactNode } from "react";
import {
  FlatList,
  Modal as NativeModal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createElement } from "react";
import * as Icons from "lucide-react";
export { FlatList, ScrollView, TextInput };

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function Icon({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const Component = (
    Icons as unknown as Record<string, React.ComponentType<{ size: number; color?: string }>>
  )[name];
  return Component ? createElement(Component, { size, color }) : null;
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <NativeModal
      transparent
      visible={open}
      animationType="none"
      onRequestClose={() => onOpenChange(false)}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0009",
          padding: 20,
        }}
      >
        <View
          accessibilityRole="none"
          style={{
            width: "100%",
            maxWidth: 480,
            maxHeight: "90%",
            backgroundColor: "#111722",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#2a3342",
          }}
        >
          <View
            style={{
              padding: 20,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#eef2f8", fontSize: 18, fontWeight: "600" }}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sort"
              onPress={() => onOpenChange(false)}
            >
              <Icon name="X" color="#9ba7b9" size={20} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </NativeModal>
  );
}
Modal.Content = function Content({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
      {children}
    </ScrollView>
  );
};
