/*
 * PURPOSE: Message list grouped into turns, rendering the reference trace UI.
 *
 * KEY DECISIONS:
 * - Messages are grouped into turns: a user message, then the assistant
 *   messages + toolResult messages that follow it. toolResult messages are
 *   paired to tool_use blocks by toolCallId and shown inside the trace.
 * - Each turn renders: Trace (collapsible "Worked for Xs" rail of reasoning +
 *   tool steps with args/result boxes), then bubbleless assistant text, then a
 *   muted metadata row (model · duration).
 * - While generating, a live Trace shows streaming thinking + running tools and
 *   the streaming text bubble with a caret.
 * - toolResult / developer / system messages are never rendered standalone.
 */

import React, { useRef, useEffect, useState } from "react";
import { FlatList, View, StyleSheet, Pressable } from "react-native";
import { colors, spacing } from "../../theme";
import { ChatMessage } from "./ChatMessage";
import { Trace, type TraceStep } from "./Trace";
import { Text } from "../ui/Text";
import { Icon } from "../ui/Icon";
import type { OmpMessage, ToolCallInfo } from "../../types";

interface Turn {
  assistantMsgs: OmpMessage[];
  results: OmpMessage[];
}

type Item = { kind: "user"; msg: OmpMessage } | { kind: "turn"; turn: Turn };

function groupTurns(messages: OmpMessage[]): Item[] {
  const items: Item[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      items.push({ kind: "user", msg });
    } else if (msg.role === "assistant") {
      const last = items[items.length - 1];
      if (last && last.kind === "turn") last.turn.assistantMsgs.push(msg);
      else items.push({ kind: "turn", turn: { assistantMsgs: [msg], results: [] } });
    } else if (msg.role === "toolResult") {
      const last = items[items.length - 1];
      if (last && last.kind === "turn") last.turn.results.push(msg);
    }
    // developer/system messages are intentionally not rendered
  }
  return items;
}

function buildSteps(turn: Turn): TraceStep[] {
  const byCallId = new Map<string, OmpMessage>();
  for (const r of turn.results) {
    if (r.toolCallId) byCallId.set(r.toolCallId, r);
  }
  const steps: TraceStep[] = [];
  for (const msg of turn.assistantMsgs) {
    for (const block of msg.content || []) {
      if (block.type === "thinking" && block.thinking) {
        steps.push({ kind: "reasoning", text: block.thinking });
      } else if (block.type === "tool_use") {
        const result = block.id ? byCallId.get(block.id) : undefined;
        const resultText = result?.content
          ?.map((c) => (c.type === "text" ? c.text || "" : ""))
          .join("\n")
          .trim();
        steps.push({
          kind: "tool",
          name: block.name,
          args: block.arguments ? JSON.stringify(block.arguments, null, 2) : undefined,
          result: resultText || undefined,
          isError: result?.isError,
        });
      }
    }
  }
  return steps;
}

function turnText(turn: Turn): string {
  const parts: string[] = [];
  for (const msg of turn.assistantMsgs) {
    for (const block of msg.content || []) {
      if (block.type === "text" && block.text) parts.push(block.text);
    }
  }
  return parts.join("\n\n");
}

function turnMeta(turn: Turn): { model?: string; duration?: number } {
  for (let i = turn.assistantMsgs.length - 1; i >= 0; i--) {
    const m = turn.assistantMsgs[i];
    if (m.model || m.duration !== undefined) return { model: m.model, duration: m.duration };
  }
  return {};
}

function modelShort(model: string): string {
  return model.split("/").pop() || model;
}

interface MessageListProps {
  messages: OmpMessage[];
  streamingText?: string;
  streamingThinking?: string;
  isGenerating?: boolean;
  toolCalls?: ToolCallInfo[];
  notices?: { level: string; message: string }[];
}

export function MessageList({
  messages,
  streamingText,
  streamingThinking,
  isGenerating,
  toolCalls,
  notices,
}: MessageListProps) {
  const listRef = useRef<FlatList>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length, streamingText, streamingThinking, toolCalls?.length, notices?.length]);

  const handleScroll = (event: {
    nativeEvent: {
      contentOffset: { y: number };
      layoutMeasurement: { height: number };
      contentSize: { height: number };
    };
  }) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setShowScrollButton(distanceFromBottom > 200);
  };

  const scrollToBottom = () => {
    listRef.current?.scrollToEnd({ animated: true });
  };

  const items = groupTurns(messages);

  // Live steps while generating: streaming thinking + running tools.
  const liveSteps: TraceStep[] = [];
  if (streamingThinking) liveSteps.push({ kind: "reasoning", text: streamingThinking });
  for (const tc of toolCalls || []) {
    liveSteps.push({ kind: "tool", name: tc.name, args: tc.args || undefined });
  }

  const hasContent = items.length > 0 || !!isGenerating;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, i) => (item.kind === "user" ? "u" + i : "t" + i)}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {!hasContent && (
              <View style={styles.empty}>
                <Icon name="chat-outline" size={40} color={colors.textMuted} />
                <Text size="md" color="textMuted" style={{ marginTop: spacing.md }}>
                  No messages yet
                </Text>
                <Text size="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
                  Send a message to start the conversation
                </Text>
              </View>
            )}
            {(notices || []).length > 0 && (
              <View style={styles.notices}>
                {(notices || []).map((n, i) => (
                  <Text key={i} size="xs" color="textMuted">
                    {n.message}
                  </Text>
                ))}
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === "user") {
            return <ChatMessage message={item.msg} />;
          }
          const steps = buildSteps(item.turn);
          const text = turnText(item.turn);
          const meta = turnMeta(item.turn);
          return (
            <View style={styles.turn}>
              <Trace steps={steps} durationMs={meta.duration} />
              {text ? (
                <Text size="md" color="text" style={styles.assistantText}>
                  {text}
                </Text>
              ) : null}
              {!text && steps.length === 0 && (
                <Text size="sm" color="textMuted" style={styles.assistantText}>
                  (empty response)
                </Text>
              )}
              {(meta.model || meta.duration !== undefined) && (
                <View style={styles.metaRow}>
                  {meta.model && (
                    <Text size="xs" color="textMuted">{modelShort(meta.model)}</Text>
                  )}
                  {meta.duration !== undefined && (
                    <Text size="xs" color="textMuted">
                      {(meta.duration / 1000).toFixed(1) + "s"}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          isGenerating ? (
            <View style={styles.turn}>
              <Trace steps={liveSteps} isStreaming />
              {streamingText ? (
                <Text size="md" color="text" style={styles.assistantText}>
                  {streamingText + " ▋"}
                </Text>
              ) : null}
            </View>
          ) : null
        }
      />
      {showScrollButton && (
        <Pressable style={styles.scrollButton} onPress={scrollToBottom}>
          <Icon name="chevron-down" size={18} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl * 3 },
  notices: { gap: 2, paddingBottom: spacing.xs },
  turn: { gap: spacing.xs },
  assistantText: { lineHeight: 23, marginTop: spacing.sm },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  scrollButton: {
    position: "absolute",
    bottom: spacing.lg,
    alignSelf: "center",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
