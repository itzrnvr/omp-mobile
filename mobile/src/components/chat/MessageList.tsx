/*
 * PURPOSE: Message list grouped into turns, rendering the reference layout:
 *   user bubble → working group (Trace) → hairline sep → markdown answer →
 *   ActionRow (copy with 1.6s check morph + fork/branch).
 *
 * KEY DECISIONS:
 * - Turns group assistant + toolResult messages; toolResult pairs to tool_use
 *   by toolCallId for the RESULT boxes.
 * - Auto-scrolls to bottom on new content and every 250ms while generating
 *   (reference behavior).
 * - Streaming text shows a caret (▋) while live.
 * - toolResult / developer / system messages never render standalone.
 */

import React, { useRef, useEffect, useState } from "react";
import { FlatList, View, StyleSheet, Pressable, Text as RNText } from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors, spacing } from "../../theme";
import { ChatMessage } from "./ChatMessage";
import { Trace, type TraceStep } from "./Trace";
import { MarkdownView } from "./MarkdownView";
import { Text } from "../ui/Text";
import { Icon } from "../ui/Icon";
import type { OmpMessage, ToolCallInfo } from "../../types";
import { useStore } from "../../store";
import { openChat } from "../../navigation";

interface Turn {
  assistantMsgs: OmpMessage[];
  results: OmpMessage[];
  messageCount: number;
}

type Item = { kind: "user"; msg: OmpMessage } | { kind: "turn"; turn: Turn };

function groupTurns(messages: OmpMessage[]): Item[] {
  const items: Item[] = [];
  let running = 0;
  for (const msg of messages) {
    running++;
    if (msg.role === "user") {
      items.push({ kind: "user", msg });
    } else if (msg.role === "assistant") {
      const last = items[items.length - 1];
      if (last && last.kind === "turn") {
        last.turn.assistantMsgs.push(msg);
        last.turn.messageCount = running;
      } else {
        items.push({
          kind: "turn",
          turn: { assistantMsgs: [msg], results: [], messageCount: running },
        });
      }
    } else if (msg.role === "toolResult") {
      const last = items[items.length - 1];
      if (last && last.kind === "turn") {
        last.turn.results.push(msg);
        last.turn.messageCount = running;
      }
    }
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
          status: result ? "done" : "done",
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

/** Copy (morphs to blue check for 1.6s) + fork/branch, per reference ActionRow. */
function ActionRow({ text, onFork }: { text: string; onFork: () => void }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    Clipboard.setStringAsync(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <View style={styles.actions}>
      <Pressable onPress={doCopy} accessibilityLabel="Copy response">
        <Icon name={copied ? "check" : "copy"} size={19} color={copied ? colors.link : "#8e8e8e"} />
      </Pressable>
      <Pressable onPress={onFork} accessibilityLabel="Branch conversation from here">
        <Icon name="branch" size={19} color="#8e8e8e" />
      </Pressable>
    </View>
  );
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
  const { currentSessionId, forkSession } = useStore();

  const handleFork = async (turn: Turn) => {
    if (!currentSessionId) return;
    const newId = await forkSession(currentSessionId, turn.messageCount);
    if (newId) openChat(newId);
  };

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, streamingText, streamingThinking, toolCalls?.length, notices?.length]);

  // Reference: keep pinned to bottom every 250ms while a turn is working.
  useEffect(() => {
    if (!isGenerating) return;
    const id = setInterval(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 250);
    return () => clearInterval(id);
  }, [isGenerating]);

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

  const items = groupTurns(messages);

  const liveSteps: TraceStep[] = [];
  if (streamingThinking) liveSteps.push({ kind: "reasoning", text: streamingThinking });
  for (const tc of toolCalls || []) {
    liveSteps.push({ kind: "tool", name: tc.name, args: tc.args || undefined, status: tc.status === "done" ? "done" : "running" });
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
                <>
                  <View style={styles.sep} />
                  <View style={styles.answerWrap}>
                    <MarkdownView markdown={text} />
                  </View>
                  <ActionRow text={text} onFork={() => void handleFork(item.turn)} />
                </>
              ) : steps.length === 0 ? (
                <RNText style={styles.emptyResponse}>(empty response)</RNText>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={
          isGenerating ? (
            <View style={styles.turn}>
              <Trace steps={liveSteps} isStreaming />
              {streamingText ? (
                <View style={styles.answerWrap}>
                  <MarkdownView markdown={streamingText + " ▋"} />
                </View>
              ) : null}
            </View>
          ) : null
        }
      />
      {showScrollButton && (
        <Pressable
          style={styles.scrollButton}
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
        >
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
  // Full-bleed hairline between the working group and the final answer.
  sep: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginVertical: 20,
    marginLeft: -spacing.lg,
    marginRight: -spacing.lg,
  },
  answerWrap: { marginTop: 2 },
  emptyResponse: { color: colors.textMuted, fontSize: 14, marginTop: spacing.sm },
  actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18 },
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
