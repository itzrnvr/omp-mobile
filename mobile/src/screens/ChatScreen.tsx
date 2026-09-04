/*
 * PURPOSE: Chat screen — conversation view with live streaming, composer, and a
 * bottom-drawer picker for model / reasoning / folder.
 *
 * KEY DECISIONS:
 * - Picker is a BOTTOM DRAWER (sheet), not a popover: model list rows with
 *   checkmarks, a segmented reasoning control, and folder selection.
 * - Header shows: back, title, context-token chip, new-chat.
 * - Sub-header shows the current working folder (tap → drawer) and a live
 *   activity indicator while generating ("Working…" + spinner).
 * - Streaming: server forwards OMP events live; store appends deltas.
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { KeyboardAvoidingView, Platform } from "react-native";
import { colors, spacing, radii } from "../theme";
import { Text } from "../components/ui/Text";
import { Icon } from "../components/ui/Icon";
import { Input } from "../components/ui/Input";
import { Stack } from "../components/ui/Stack";
import { BottomDrawer } from "../components/ui/BottomDrawer";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { useStore } from "../store";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MODEL_PRESETS, THINKING_LEVELS } from "../types";
import type { ThinkingLevel } from "../types";

function formatTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export function ChatScreen({ route }: { route: { params?: { sessionId?: string } } }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [cwdInput, setCwdInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    messages,
    streamingText,
    streamingThinking,
    isGenerating,
    sendMessage,
    cancelGeneration,
    loadSession,
    startNewSession,
    setSelectedModel,
    setThinkingLevel,
    selectedModel,
    thinkingLevel,
    selectedCwd,
    setSelectedCwd,
    toolCalls,
    notices,
    sessionTitle,
    contextTokens,
    wsStatus,
  } = useStore();

  const sessionId = route?.params?.sessionId;

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
    else startNewSession();
  }, [sessionId]);

  useEffect(() => {
    setCwdInput(selectedCwd || "");
  }, [selectedCwd]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  if (wsStatus !== "connected") {
    return (
      <View style={styles.disconnected}>
        <Text size="lg" color="textMuted">Not connected to server</Text>
      </View>
    );
  }

  const modelLabel = MODEL_PRESETS.find((m) => m.value === selectedModel)?.label || selectedModel || "Model";
  const folderName = selectedCwd ? selectedCwd.split(/[\\/]/).filter(Boolean).pop() : "default folder";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      {/* Header: back / title / context / new chat */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Icon name="back" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text size="md" weight="medium" color="text" numberOfLines={1} style={styles.title}>
          {sessionTitle || "New conversation"}
        </Text>
        {contextTokens > 0 && (
          <View style={styles.ctxChip}>
            <Text size="xs" color="textMuted">{formatTokens(contextTokens)} ctx</Text>
          </View>
        )}
        <Pressable style={styles.iconButton} onPress={() => startNewSession()} accessibilityLabel="New conversation">
          <Icon name="add" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Sub-header: folder + activity */}
      <View style={styles.subHeader}>
        <Pressable style={styles.folderChip} onPress={() => setDrawerOpen(true)}>
          <Icon name="folder" size={14} color={colors.textMuted} />
          <Text size="xs" color="textMuted" numberOfLines={1}>{folderName}</Text>
        </Pressable>
        {isGenerating && (
          <View style={styles.activity}>
            <Icon name="sync" size={12} color={colors.textMuted} />
            <Text size="xs" color="textMuted">Working…</Text>
          </View>
        )}
      </View>

      <MessageList
        messages={messages}
        streamingText={streamingText}
        streamingThinking={streamingThinking}
        isGenerating={isGenerating}
        toolCalls={toolCalls}
        notices={notices}
      />

      {/* Composer */}
      <ChatInput
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        onCancel={cancelGeneration}
        isGenerating={isGenerating}
        placeholder={isGenerating ? "Generating..." : "Ask for follow-up changes"}
        bottomInset={insets.bottom}
        thinkingLabel={thinkingLevel}
        modelLabel={modelLabel}
        onOpenPicker={() => setDrawerOpen(true)}
      />

      {/* Bottom drawer: model / reasoning / folder */}
      <BottomDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Stack gap="lg" style={{ paddingBottom: spacing.md }}>
            <Stack gap="xs">
              <Text size="xs" weight="medium" color="textMuted" style={styles.sectionLabel}>MODEL</Text>
              {MODEL_PRESETS.map((m) => (
                <Pressable
                  key={m.value}
                  style={styles.modelRow}
                  onPress={() => setSelectedModel(m.value)}
                >
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Text size="sm" weight="medium" color="text">{m.label}</Text>
                    <Text size="xs" color="textMuted">{m.value.split("/").pop()}</Text>
                  </Stack>
                  {selectedModel === m.value && (
                    <Icon name="check" size={16} color={colors.text} />
                  )}
                </Pressable>
              ))}
            </Stack>

            <Stack gap="xs">
              <Text size="xs" weight="medium" color="textMuted" style={styles.sectionLabel}>REASONING</Text>
              <View style={styles.segmented}>
                {THINKING_LEVELS.map((lvl) => (
                  <Pressable
                    key={lvl}
                    style={[styles.segment, thinkingLevel === lvl && styles.segmentActive]}
                    onPress={() => setThinkingLevel(lvl as ThinkingLevel)}
                  >
                    <Text
                      size="xs"
                      weight="medium"
                      color={thinkingLevel === lvl ? "text" : "textMuted"}
                    >
                      {lvl}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Stack>

            <Stack gap="xs">
              <Text size="xs" weight="medium" color="textMuted" style={styles.sectionLabel}>FOLDER</Text>
              <Input
                value={cwdInput}
                onChangeText={setCwdInput}
                placeholder="e.g. D:/projects/app"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.applyFolder}
                onPress={() => {
                  setSelectedCwd(cwdInput.trim() || "");
                  setDrawerOpen(false);
                }}
              >
                <Text size="sm" weight="medium" color="text">Use this folder</Text>
              </Pressable>
            </Stack>
          </Stack>
        </ScrollView>
      </BottomDrawer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  disconnected: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1 },
  ctxChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  folderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    maxWidth: "60%",
  },
  activity: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionLabel: { letterSpacing: 0.8 },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: colors.bgSecondary,
  },
  applyFolder: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
});
