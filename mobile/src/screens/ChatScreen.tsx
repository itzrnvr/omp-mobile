/*
 * PURPOSE: Chat screen — full conversation interface with OMP.
 * Shows message history, streaming responses, reasoning, tool calls,
 * model selector, thinking level selector, working directory, and input bar.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, TextInput } from "react-native";
import { colors, spacing, radii } from "../theme";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { Text } from "../components/ui/Text";
import { useStore } from "../store";
import { MODEL_PRESETS, THINKING_LEVELS } from "../types";
import type { ThinkingLevel } from "../types";

export function ChatScreen({ route }: { route: { params?: { sessionId?: string } } }) {
  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
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
    if (sessionId) {
      loadSession(sessionId);
    } else {
      startNewSession();
    }
  }, [sessionId]);

  useEffect(() => {
    setCwdInput(selectedCwd || "");
  }, [selectedCwd]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleCwdChange = (text: string) => {
    setCwdInput(text);
    setSelectedCwd(text);
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
      {/* Header with model + thinking level */}
      <View style={styles.header}>
        <Pressable style={styles.modelBadge} onPress={() => setShowModelPicker(!showModelPicker)}>
          <Text size="xs" weight="medium" color="accent">{modelLabel}</Text>
          <Text size="xs" color="textMuted">{"  think:" + thinkingLevel}</Text>
        </Pressable>
        {sessionTitle && (
          <Text size="xs" color="textMuted" numberOfLines={1} style={styles.title}>{sessionTitle}</Text>
        )}
      </View>

      {/* Model picker dropdown */}
      {showModelPicker && (
        <View style={styles.modelPicker}>
          {/* Model presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelScroll}>
            {MODEL_PRESETS.map((m) => (
              <Pressable
                key={m.value}
                style={[styles.modelOption, selectedModel === m.value && styles.modelOptionActive]}
                onPress={() => { setSelectedModel(m.value); }}
              >
                <Text size="xs" weight="medium" color={selectedModel === m.value ? "text" : "textSecondary"}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Thinking level */}
          <View style={styles.thinkingRow}>
            <Text size="xs" color="textMuted">Thinking:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {THINKING_LEVELS.map((lvl) => (
                <Pressable
                  key={lvl}
                  style={[styles.thinkingOption, thinkingLevel === lvl && styles.thinkingOptionActive]}
                  onPress={() => setThinkingLevel(lvl as ThinkingLevel)}
                >
                  <Text size="xs" weight="medium" color={thinkingLevel === lvl ? "text" : "textSecondary"}>
                    {lvl}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Working directory */}
          <View style={styles.cwdRow}>
            <Text size="xs" color="textMuted">Folder:</Text>
            <TextInput
              style={styles.cwdInput}
              value={cwdInput}
              onChangeText={handleCwdChange}
              placeholder="C:\\Users\\babys\\tmp"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
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

      {/* Input */}
      <ChatInput
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        onCancel={cancelGeneration}
        isGenerating={isGenerating}
        placeholder={isGenerating ? "Generating..." : "Send a message..."}
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
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  modelBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { flex: 1, textAlign: "right" },
  modelPicker: {
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  modelScroll: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  modelOption: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelOptionActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  thinkingOption: {
    backgroundColor: colors.surface,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thinkingOptionActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cwdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  cwdInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
