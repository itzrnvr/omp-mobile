/*
 * PURPOSE: Chat screen following ChatKit design guidelines.
 * Model picker is a compact popover (not horizontal scroll).
 * Composer is elevated pill. Header has model badge with chevron.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, TextInput, ScrollView } from "react-native";
import { colors, spacing, radii } from "../theme";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { Text } from "../components/ui/Text";
import { Icon } from "../components/ui/Icon";
import { useStore } from "../store";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MODEL_PRESETS, THINKING_LEVELS } from "../types";
import type { ThinkingLevel } from "../types";

export function ChatScreen({ route }: { route: { params?: { sessionId?: string } } }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [cwdInput, setCwdInput] = useState("");
  const {
    messages,
    streamingText,
    streamingThinking,
    isGenerating,
    currentSessionId,
    selectedModel,
    thinkingLevel,
    selectedCwd,
    toolCalls,
    notices,
    sessionTitle,
    sendMessage,
    cancelGeneration,
    loadSession,
    startNewSession,
    setSelectedModel,
    setThinkingLevel,
    setSelectedCwd,
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
        <Text size="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
          Go to Settings to configure your server connection
        </Text>
      </View>
    );
  }

  const modelLabel = MODEL_PRESETS.find((m) => m.value === selectedModel)?.label || selectedModel || "Default";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header with model badge + chevron */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Icon name="back" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text size="md" weight="medium" color="text" numberOfLines={1} style={styles.title}>
          {sessionTitle || "New conversation"}
        </Text>
        <Pressable
          style={styles.newChatButton}
          onPress={() => startNewSession()}
          accessibilityLabel="New conversation"
        >
          <Icon name="add" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Compact popover model picker (ChatKit style) */}
      {showPicker && (
        <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.pickerPopover} onPress={(e) => e.stopPropagation()}>
            {/* Model options — stacked list with name + description */}
            <Text size="xs" weight="medium" color="textMuted" style={styles.pickerSection}>MODEL</Text>
            {MODEL_PRESETS.map((m) => (
              <Pressable
                key={m.value}
                style={[styles.modelOption, selectedModel === m.value && styles.modelOptionActive]}
                onPress={() => setSelectedModel(m.value)}
              >
                <Text size="sm" weight="medium" color={selectedModel === m.value ? "accent" : "text"}>
                  {m.label}
                </Text>
                <Text size="xs" color="textMuted">{m.value.split("/").pop()}</Text>
              </Pressable>
            ))}

            {/* Thinking level */}
            <Text size="xs" weight="medium" color="textMuted" style={styles.pickerSection}>THINKING</Text>
            <View style={styles.thinkingRow}>
              {THINKING_LEVELS.map((lvl) => (
                <Pressable
                  key={lvl}
                  style={[styles.thinkingPill, thinkingLevel === lvl && styles.thinkingPillActive]}
                  onPress={() => setThinkingLevel(lvl as ThinkingLevel)}
                >
                  <Text size="xs" weight="medium" color={thinkingLevel === lvl ? "text" : "textSecondary"}>
                    {lvl}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Working directory */}
            <Text size="xs" weight="medium" color="textMuted" style={styles.pickerSection}>FOLDER</Text>
            <View style={styles.cwdRow}>
              <TextInput
                style={styles.cwdInput}
                value={cwdInput}
                onChangeText={(t) => { setCwdInput(t); setSelectedCwd(t); }}
                placeholder="C:\\Users\\babys\\tmp"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </Pressable>
        </Pressable>
      )}

      {/* Messages */}
      <View style={styles.messagesContainer}>
        <MessageList
          messages={messages}
          streamingText={streamingText}
          streamingThinking={streamingThinking}
          isGenerating={isGenerating}
          toolCalls={toolCalls}
          notices={notices}
        />
      </View>

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
        onOpenPicker={() => setShowPicker(true)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bg,
  },
  title: { flex: 1 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  newChatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // Popover overlay (tap to dismiss)
  pickerOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    zIndex: 100,
  },
  // ChatKit: compact popover — surface-2 bg, 12px radius, shadow
  pickerPopover: {
    position: "absolute",
    top: 56,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: "hidden",
  },
  pickerSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  // Model option: stacked list with name + description
  modelOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  modelOptionActive: {
    backgroundColor: colors.surfaceHover,
  },
  // Thinking pills
  thinkingRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  thinkingPill: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thinkingPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  // CWD input
  cwdRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cwdInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.inputBg,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 12,
    fontFamily: "monospace",
  },

  messagesContainer: { flex: 1 },
  disconnected: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
