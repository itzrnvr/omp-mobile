/*
 * PURPOSE: Chat screen — reference topbar (menu | title | +), message list,
 * composer, and hosts for the model sheet, drawer, and settings sheet.
 *
 * KEY DECISIONS:
 * - Navigation IA: no bottom tabs; the drawer (recents) + topbar replace them.
 * - Attachments: pickers (expo-image-picker / expo-document-picker) → base64 →
 *   WS upload → server writes cwd/.attachments → 'uploaded' adds the chip and
 *   the path note is appended to the input so the agent can read the file.
 * - Hardware back closes any open overlay first.
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, BackHandler, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { colors, spacing } from "../theme";
import { Text } from "../components/ui/Text";
import { Icon } from "../components/ui/Icon";
import { Sheet } from "../components/ui/Sheet";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { ModelSheet } from "../components/chat/ModelSheet";
import { Drawer } from "../components/nav/Drawer";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useStore } from "../store";
import { openChat } from "../navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MODEL_PRESETS } from "../types";

export function ChatScreen({ route }: { route: { params?: { sessionId?: string } } }) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    messages,
    streamingText,
    streamingThinking,
    isGenerating,
    sendMessage,
    cancelGeneration,
    loadSession,
    startNewSession,
    selectedModel,
    selectedCwd,
    toolCalls,
    notices,
    sessionTitle,
    wsStatus,
    uploadAttachment,
    addAttachment,
    serverStatus,
  } = useStore();

  const sessionId = route?.params?.sessionId;

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
    else startNewSession();
  }, [sessionId]);

  // Hardware back closes overlays before exiting.
  useEffect(() => {
    const onBack = () => {
      if (drawerOpen || sheetOpen || settingsOpen) {
        setDrawerOpen(false);
        setSheetOpen(false);
        setSettingsOpen(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [drawerOpen, sheetOpen, settingsOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const uploadPicked = async (uri: string, name: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    uploadAttachment(name, base64);
    setInput((v) => (v ? v + " " : "") + `[attached: .attachments/${name}] `);
  };

  const onAttachFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    await uploadPicked(asset.uri, asset.name || "file.bin");
  };

  const onTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const name = "photo-" + Date.now() + ".jpg";
    await uploadPicked(asset.uri, name);
  };

  const onPasteLink = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setInput((v) => (v ? v + " " : "") + text);
  };

  if (wsStatus !== "connected") {
    return (
      <View style={styles.disconnected}>
        <Text size="lg" color="textMuted">Not connected to server</Text>
      </View>
    );
  }

  const modelLabel =
    (serverStatus?.models || []).find((m) => m.value === selectedModel)?.label ||
    MODEL_PRESETS.find((m) => m.value === selectedModel)?.label ||
    (selectedModel ? selectedModel.split("/").pop() || selectedModel : "Model");

  return (
    <View style={styles.container}>
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => setDrawerOpen(true)} accessibilityLabel="Open menu">
          <Icon name="menu" size={22} color="#a3a3a3" />
        </Pressable>
        <Text size="md" weight="semibold" color="text" numberOfLines={1} style={styles.title}>
          {sessionTitle || "New conversation"}
        </Text>
        <Pressable onPress={() => openChat()} accessibilityLabel="New chat">
          <Icon name="add" size={22} color="#a3a3a3" />
        </Pressable>
      </View>

      <MessageList
        messages={messages}
        streamingText={streamingText}
        streamingThinking={streamingThinking}
        isGenerating={isGenerating}
        toolCalls={toolCalls}
        notices={notices}
      />

      <ChatInput
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        onCancel={cancelGeneration}
        isGenerating={isGenerating}
        bottomInset={insets.bottom}
        modelLabel={modelLabel}
        onOpenModel={() => setSheetOpen(true)}
        onAttachFiles={() => void onAttachFiles()}
        onTakePhoto={() => void onTakePhoto()}
        onPasteLink={() => void onPasteLink()}
      />

      <ModelSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      <Drawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenSession={(id) => openChat(id)}
        onNewChat={() => openChat()}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Sheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        panelStyle={{ height: "78%" }}
      >
        {/* SettingsScreen provides its own ScrollView; nesting another one
            caused the bottom clipping/overflow. */}
        <View style={styles.settingsWrap}>
          <SettingsScreen embedded />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  disconnected: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  title: { flex: 1, textAlign: "center", paddingHorizontal: spacing.sm },
  settingsWrap: { flex: 1 },
});
