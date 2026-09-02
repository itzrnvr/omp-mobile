/*
 * PURPOSE: Scrollable message list for the chat screen.
 * Auto-scrolls to bottom. Shows streaming text, thinking, tool calls, notices.
 */

import React, { useRef, useEffect } from "react";
import { FlatList, View, StyleSheet, Pressable } from "react-native";
import { colors, spacing, radii } from "../../theme";
import { ChatMessage } from "./ChatMessage";
import { Text } from "../ui/Text";
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

  useEffect(() => {
    if (messages.length > 0 || streamingText || streamingThinking) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length, streamingText, streamingThinking, toolCalls?.length, notices?.length]);

  const displayMessages: OmpMessage[] = [...messages];

  // Build a streaming assistant message if we have any streaming content
  if (isGenerating && (streamingText || streamingThinking)) {
    const content: { type: string; text?: string; thinking?: string }[] = [];
    if (streamingThinking) content.push({ type: "thinking", thinking: streamingThinking });
    if (streamingText) content.push({ type: "text", text: streamingText });
    displayMessages.push({ role: "assistant", content: content as never });
  }

  if (displayMessages.length === 0 && !isGenerating) {
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
      ListFooterComponent={
        isGenerating ? (
          <View>
            {/* Active tool calls */}
            {toolCalls && toolCalls.length > 0 && (
              <View style={styles.toolCallsContainer}>
                {toolCalls.map((tc) => (
                  <ToolCallView key={tc.id} tc={tc} />
                ))}
              </View>
            )}
            {/* Notices */}
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
            {/* Generating indicator */}
            <View style={styles.generatingIndicator}>
              <Text size="xs" color="textMuted">{"● ● ●"}</Text>
            </View>
          </View>
        ) : null
      }
    />
  );
}

function ToolCallView({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = React.useState(false);
  const statusIcon = tc.status === "running" ? "○" : tc.status === "done" ? "●" : "✕";
  const statusColor = tc.status === "running" ? "warning" : tc.status === "done" ? "success" : "error";

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={styles.toolCall}>
      <View style={styles.toolCallHeader}>
        <Text size="xs" weight="medium" color={statusColor as "success" | "warning" | "error"}>
          {statusIcon + " " + tc.name}
        </Text>
        <Text size="xs" color="textMuted">{expanded ? "▾" : "▸"}</Text>
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
  list: { paddingVertical: spacing.md },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  toolCallsContainer: { paddingHorizontal: spacing.lg, gap: spacing.xs, marginBottom: spacing.xs },
  toolCall: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolCallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toolCallArgs: {
    marginTop: spacing.xs,
    fontFamily: "monospace",
    lineHeight: 16,
  },
  noticesContainer: { paddingHorizontal: spacing.lg, gap: spacing.xs, marginBottom: spacing.xs },
  notice: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  generatingIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
});
