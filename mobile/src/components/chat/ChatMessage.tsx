/*
 * PURPOSE: Chat message component following ChatKit design guidelines.
 * - User messages: contained bubble with asymmetric corners (18px 18px 5px 18px)
 * - Assistant messages: BUBBLELESS — open text block, transparent background
 * - Thinking blocks: collapsible, dimmed surface
 * - Tool calls: bordered cards with expandable args
 * - Metadata: 11px muted, shown below message
 * - Streaming: cursor indicator on last block
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
  const content = message.content || [];
  const textBlocks = content.filter((c) => c.type === "text");
  const thinkingBlocks = content.filter((c) => c.type === "thinking");
  const toolBlocks = content.filter((c) => c.type === "tool_use");

  if (isUser) {
    // ── User message: contained bubble, right-aligned, asymmetric corners ──
    return (
      <View style={styles.userContainer}>
        <View style={styles.userBubble}>
          {textBlocks.map((block, i) => (
            <Text key={i} size="md" color="text" style={styles.userText}>
              {block.text || ""}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  // ── Assistant message: bubbleless, left-aligned, transparent bg ──
  return (
    <View style={styles.assistantContainer}>
      <View style={styles.assistantContent}>
        {/* Thinking blocks */}
        {thinkingBlocks.map((block, i) => (
          <ThinkingBlock key={"t" + i} text={block.thinking || ""} />
        ))}

        {/* Text content */}
        {textBlocks.map((block, i) => (
          <Text
            key={"x" + i}
            size="md"
            color="text"
            style={styles.assistantText}
          >
            {block.text || ""}
            {isStreaming && i === textBlocks.length - 1 ? " \u258B" : ""}
          </Text>
        ))}

        {/* Tool calls */}
        {toolBlocks.map((block, i) => (
          <View key={"c" + i} style={styles.toolCallCard}>
            <Text size="xs" weight="medium" color="textSecondary">
              {"\u2699 " + (block.toolName || "tool")}
            </Text>
          </View>
        ))}

        {/* Metadata bar */}
        {(message.model || message.cost || message.duration) && !isStreaming && (
          <View style={styles.metadataBar}>
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
          {"\u2756 Thinking " + (expanded ? "\u25BE" : "\u25B8")}
        </Text>
      </View>
      <Text size="sm" color="textMuted" style={styles.thinkingText}>
        {expanded ? text : preview}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // User: right-aligned, contained bubble, asymmetric corners
  userContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "80%",
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.userMessage,
    borderRadius: radii.xl,
    borderBottomRightRadius: 5, // ChatKit asymmetric corner
  },
  userText: {
    lineHeight: lineHeights.md,
  },

  // Assistant: bubbleless, left-aligned, transparent
  assistantContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  assistantContent: {
    maxWidth: "92%",
    gap: spacing.xs,
  },
  assistantText: {
    lineHeight: lineHeights.md,
  },

  // Thinking: collapsible dimmed block
  thinkingBlock: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xs,
  },
  thinkingHeader: {
    marginBottom: spacing.xs,
  },
  thinkingText: {
    lineHeight: lineHeights.sm,
  },

  // Tool call: bordered card
  toolCallCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },

  // Metadata: compact, muted, horizontal
  metadataBar: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
