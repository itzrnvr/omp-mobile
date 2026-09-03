/*
 * PURPOSE: Message list with AI Elements Conversation patterns.
 * Auto-scroll to bottom, scroll-to-bottom button when scrolled up,
 * spacious empty state, streaming thinking, tool calls, notices.
 * ChatGPT gray theme.
 */

import React, { useRef, useEffect, useState } from "react";
import { FlatList, View, StyleSheet, Pressable } from "react-native";
import { colors, spacing, radii } from "../../theme";
import { ChatMessage } from "./ChatMessage";
import { Text } from "../ui/Text";
import { Icon } from "../ui/Icon";
import type { OmpMessage, ToolCallInfo } from "../../types";

interface MessageListProps {
  messages: OmpMessage[];
  streamingText?: string;
  streamingThinking?: string;
  isGenerating?: boolean;
  toolCalls?: ToolCallInfo[];
  notices?: { level: string; message: string }[];
}

export function MessageList({ messages, streamingText, streamingThinking, isGenerating, toolCalls, notices }: MessageListProps) {
  const listRef = useRef<FlatList>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (messages.length > 0 || streamingText || streamingThinking) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length, streamingText, streamingThinking, toolCalls?.length, notices?.length]);

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    setShowScrollButton(!isAtBottom && contentSize.height > layoutMeasurement.height + 100);
  };

  const scrollToBottom = () => {
    listRef.current?.scrollToEnd({ animated: true });
    setShowScrollButton(false);
  };

  const displayMessages: OmpMessage[] = [...messages];

  if (isGenerating && (streamingText || streamingThinking)) {
    const content: { type: string; text?: string; thinking?: string }[] = [];
    if (streamingThinking) content.push({ type: "thinking", thinking: streamingThinking });
    if (streamingText) content.push({ type: "text", text: streamingText });
    displayMessages.push({ role: "assistant", content: content as never });
  }

  if (displayMessages.length === 0 && !isGenerating) {
    return (
      <View style={styles.empty}>
        <Icon name="chat-outline" size={44} color={colors.textMuted} />
        <Text size="lg" color="textSecondary" style={{ marginTop: spacing.lg }}>No messages yet</Text>
        <Text size="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
          Send a message to start the conversation
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          isGenerating ? (
            <View>
              {toolCalls && toolCalls.length > 0 && (
                <View style={styles.toolCallsContainer}>
                  {toolCalls.map((tc) => (
                    <ToolCallView key={tc.id} tc={tc} />
                  ))}
                </View>
              )}
              {notices && notices.length > 0 && (
                <View style={styles.noticesContainer}>
                  {notices.map((n, i) => (
                    <View key={i} style={styles.notice}>
                      <Text size="xs" color={n.level === "warning" ? "warning" : "textMuted"}>
                        {n.message}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.generatingIndicator}>
                <Text size="xs" color="textMuted">{"\u25CF \u25CF \u25CF"}</Text>
              </View>
            </View>
          ) : null
        }
      />
      {/* AI Elements: scroll-to-bottom button */}
      {showScrollButton && (
        <Pressable style={styles.scrollButton} onPress={scrollToBottom}>
          <Icon name="chevron-down" size={18} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

function ToolCallView({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = React.useState(false);
  const statusIcon = tc.status === "running" ? "\u25CB" : tc.status === "done" ? "\u25CF" : "\u2715";
  const statusColor = tc.status === "running" ? "warning" : tc.status === "done" ? "success" : "error";

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={styles.toolCall}>
      <View style={styles.toolCallHeader}>
        <Text size="xs" weight="medium" color={statusColor as "success" | "warning" | "error"}>
          {statusIcon + " " + tc.name}
        </Text>
        <Text size="xs" color="textMuted">{expanded ? "\u25BE" : "\u25B8"}</Text>
      </View>
      {expanded && tc.args && (
        <Text size="xs" color="textMuted" style={styles.toolCallArgs}>
          {tc.args.length > 200 ? tc.args.slice(0, 200) + "..." : tc.args}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingVertical: spacing.md },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  toolCallsContainer: { paddingHorizontal: spacing.xl, gap: spacing.xs, marginBottom: spacing.xs },
  toolCall: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolCallHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toolCallArgs: { marginTop: spacing.xs, fontFamily: "monospace", lineHeight: 16 },
  noticesContainer: { paddingHorizontal: spacing.xl, gap: spacing.xs, marginBottom: spacing.xs },
  notice: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  generatingIndicator: { flexDirection: "row", justifyContent: "center", paddingVertical: spacing.xs },
  // AI Elements: scroll-to-bottom button — floating, circular, bottom-right
  scrollButton: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
