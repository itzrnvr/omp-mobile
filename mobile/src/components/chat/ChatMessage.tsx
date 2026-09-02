/*
 * PURPOSE: Chat message component — renders a single user or assistant message
 * with avatar, text content, thinking blocks, tool calls, and usage info.
 * Following Mantine-inspired spacing and typography.
 */

import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { colors, spacing, lineHeights, radii } from "../../theme";
import { Text } from "../ui/Text";
import { Avatar } from "../ui/Avatar";
import type { OmpMessage, OmpContentBlock } from "../../types";

interface ChatMessageProps {
  message: OmpMessage;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const roleColor = isUser ? colors.user : colors.assistant;

  const content = message.content || [];
  const textBlocks = content.filter((c) => c.type === "text");
  const thinkingBlocks = content.filter((c) => c.type === "thinking");
  const toolBlocks = content.filter((c) => c.type === "tool_use");

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && <Avatar size={32} color={roleColor} label="O" />}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {thinkingBlocks.length > 0 && (
          <View style={styles.thinkingSection}>
            {thinkingBlocks.map((block: OmpContentBlock, i: number) => (
              <ThinkingBlock key={i} text={block.thinking || ""} />
            ))}
          </View>
        )}

        {textBlocks.map((block: OmpContentBlock, i: number) => (
          <Text key={i} size="md" color="text" style={styles.textBlock}>
            {block.text || ""}
            {isStreaming && i === textBlocks.length - 1 ? " \u258B" : ""}
          </Text>
        ))}

        {toolBlocks.length > 0 && (
          <View style={styles.toolSection}>
            {toolBlocks.map((block: OmpContentBlock, i: number) => (
              <View key={i} style={styles.toolCall}>
                <Text size="xs" weight="medium" color="textSecondary">
                  {"🔧 " + (block.toolName || "tool")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!isUser && (message.cost || message.duration || message.model) && (
          <View style={styles.usageBar}>
            {message.model && (
              <Text size="xs" color="textMuted">{message.model}</Text>
            )}
            {message.cost !== undefined && message.cost > 0 && (
              <Text size="xs" color="textMuted">{"$" + message.cost.toFixed(4)}</Text>
            )}
            {message.duration !== undefined && (
              <Text size="xs" color="textMuted">
                {(message.duration / 1000).toFixed(1) + "s"}
              </Text>
            )}
          </View>
        )}
      </View>

      {isUser && <Avatar size={32} color={colors.user} label="U" />}
    </View>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const preview = text.slice(0, 80) + (text.length > 80 ? "..." : "");

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={styles.thinkingBlock}>
      <View style={styles.thinkingHeader}>
        <Text size="xs" weight="medium" color="textMuted">
          {"Thinking " + (expanded ? "\u25BE" : "\u25B8")}
        </Text>
      </View>
      <Text size="xs" color="textMuted" style={styles.thinkingText}>
        {expanded ? text : preview}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  userContainer: { justifyContent: "flex-end" },
  assistantContainer: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.xs,
  },
  userBubble: {
    backgroundColor: colors.surfaceActive,
    borderTopRightRadius: radii.xs,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xs,
  },
  textBlock: { lineHeight: lineHeights.md },
  thinkingSection: { gap: spacing.xs },
  thinkingBlock: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  thinkingHeader: { marginBottom: spacing.xs },
  thinkingText: { lineHeight: lineHeights.sm },
  toolSection: { gap: spacing.xs, marginTop: spacing.xs },
  toolCall: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  usageBar: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
