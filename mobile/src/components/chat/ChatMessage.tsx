/*
 * PURPOSE: Chat message component following AI Elements + ChatGPT gray design.
 * - User messages: contained bubble with asymmetric corners, warm gray bg
 * - Assistant messages: BUBBLELESS — transparent, open text
 * - Reasoning: collapsible with streaming indicator
 * - Tool calls: bordered cards with status
 * - Metadata: compact, muted, horizontal bar
 */

import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { colors, spacing, lineHeights, radii } from "../../theme";
import { Text } from "../ui/Text";
import type { OmpMessage, OmpContentBlock } from "../../types";

export interface ChatMessageProps {
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

  // Assistant: bubbleless, spacious
  return (
    <View style={styles.assistantContainer}>
      <View style={styles.assistantContent}>
        {/* Reasoning blocks — collapsible with streaming indicator */}
        {thinkingBlocks.map((block, i) => (
          <ReasoningBlock key={"r" + i} text={block.thinking || ""} isStreaming={isStreaming} />
        ))}

        {/* Text content — bubbleless, just text */}
        {textBlocks.map((block, i) => (
          <Text
            key={"t" + i}
            size="md"
            color="text"
            style={styles.assistantText}
          >
            {block.text || ""}
            {isStreaming && i === textBlocks.length - 1 ? " \u258B" : ""}
          </Text>
        ))}

        {/* Tool calls — bordered cards */}
        {toolBlocks.map((block, i) => (
          <View key={"c" + i} style={styles.toolCard}>
            <Text size="xs" weight="medium" color="textSecondary">
              {"\u2699 " + (block.toolName || "tool")}
            </Text>
          </View>
        ))}

        {/* Metadata — compact muted bar */}
        {(message.model || message.cost || message.duration) && !isStreaming && (
          <View style={styles.metadataBar}>
            {message.model && <Text size="xs" color="textMuted">{modelShort(message.model)}</Text>}
            {message.cost !== undefined && message.cost > 0 && (
              <Text size="xs" color="textMuted">{"$" + message.cost.toFixed(4)}</Text>
            )}
            {message.duration !== undefined && (
              <Text size="xs" color="textMuted">{(message.duration / 1000).toFixed(1) + "s"}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function ReasoningBlock({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  // Auto-expand while streaming, collapse when done
  const [expanded, setExpanded] = useState(isStreaming ?? false);

  React.useEffect(() => {
    if (isStreaming) setExpanded(true);
  }, [isStreaming]);

  return (
    <Pressable style={styles.reasoningBlock} onPress={() => setExpanded(!expanded)}>
      <Text size="xs" weight="medium" color="textMuted">
        {isStreaming
          ? "\u2756 Thinking..."
          : "\u2756 Thought " + (expanded ? "\u25BE" : "\u25B8")}
      </Text>
      {expanded && (
        <Text size="sm" color="textMuted" style={styles.reasoningText}>
          {text}
        </Text>
      )}
    </Pressable>
  );
}

function modelShort(model: string): string {
  const parts = model.split("/");
  return parts.length > 1 ? parts[parts.length - 1] : model;
}

const styles = StyleSheet.create({
  // User: right-aligned, warm gray bubble, asymmetric corners (soft)
  userContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "80%",
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.userMessage,
    borderRadius: radii.xl,
    borderBottomRightRadius: radii.sm,
  },
  userText: {
    lineHeight: lineHeights.md,
  },

  // Assistant: bubbleless, spacious, left-aligned
  assistantContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  assistantContent: {
    maxWidth: "92%",
    gap: spacing.sm,
  },
  assistantText: {
    lineHeight: lineHeights.md,
  },

  // Reasoning: collapsible, dimmed surface, soft corners
  reasoningBlock: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  reasoningText: {
    lineHeight: lineHeights.sm,
    marginTop: spacing.xs,
  },

  // Tool: bordered card
  toolCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Metadata: compact, muted
  metadataBar: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
