/*
 * PURPOSE: Chat screen — full conversation interface with OMP.
 * Shows message history, streaming responses, and input bar.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { colors, spacing } from "../theme";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { Text } from "../components/ui/Text";
import { useStore } from "../store";

export function ChatScreen({ route }: { route: { params?: { sessionId?: string } } }) {
  const [input, setInput] = useState("");
  const {
    messages,
    streamingText,
    isGenerating,
    currentSessionId,
    sendMessage,
    cancelGeneration,
    loadSession,
    startNewSession,
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text size="sm" color="textMuted" weight="medium">
          {currentSessionId ? "Session" : "New conversation"}
        </Text>
      </View>

      <View style={styles.messagesContainer}>
        <MessageList
          messages={messages}
          streamingText={streamingText}
          isGenerating={isGenerating}
        />
      </View>

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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  messagesContainer: {
    flex: 1,
  },
  disconnected: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
