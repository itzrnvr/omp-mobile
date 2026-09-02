/*
 * PURPOSE: Scrollable message list for the chat screen.
 * Auto-scrolls to bottom when new messages arrive.
 */

import React, { useRef, useEffect } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";
import { ChatMessage } from "./ChatMessage";
import { Text } from "../ui/Text";
import type { OmpMessage } from "../../types";

interface MessageListProps {
  messages: OmpMessage[];
  streamingText?: string;
  isGenerating?: boolean;
}

export function MessageList({ messages, streamingText, isGenerating }: MessageListProps) {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length, streamingText]);

  // Build display messages: real messages + optional streaming text
  const displayMessages: OmpMessage[] = [...messages];
  if (streamingText && isGenerating) {
    displayMessages.push({
      role: "assistant",
      content: [{ type: "text", text: streamingText }],
    });
  }

  if (displayMessages.length === 0) {
    return (
      <View style={styles.empty}>
        <Text size="lg" color="textMuted">No messages yet</Text>
        <Text size="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
          Send a message to start the conversation
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={displayMessages}
      keyExtractor={(_, index) => String(index)}
      renderItem={({ item, index }) => (
        <ChatMessage
          message={item}
          isStreaming={isGenerating && index === displayMessages.length - 1}
        />
      )}
      contentContainerStyle={styles.list}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
});
