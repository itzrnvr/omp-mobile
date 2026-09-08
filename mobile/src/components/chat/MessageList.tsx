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

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
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
  const lastTextIdx = (() => {
    for (let i = turn.assistantMsgs.length - 1; i >= 0; i--) {
      if (meaningfulText(turn.assistantMsgs[i])) return i;
    }
    return -1;
  })();
  for (let mi = 0; mi < turn.assistantMsgs.length; mi++) {
    const msg = turn.assistantMsgs[mi];
    if (mi !== lastTextIdx) {
      const mid = meaningfulText(msg);
      if (mid) steps.push({ kind: "text", text: mid });
    }
    for (const block of msg.content || []) {
      if (block.type === "thinking" && block.thinking && block.thinking.trim()) {
        steps.push({ kind: "reasoning", text: block.thinking });
      } else if (block.type === "tool_use" || block.type === "toolCall") {
        // omp JSONL history uses block type "toolCall" (pi format):
        // {type,id,name,arguments}; live stream uses tool_call_* events.
        // Accept both so restored sessions show their tool rows (2026-09-05).
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

function meaningfulText(msg: { content?: unknown[] }): string {
  const blocks = (msg.content || []) as { type?: string; text?: string }[];
  return blocks
    .filter((b) => b.type === "text" && b.text && /[\w]/.test(b.text))
    .map((b) => b.text || "")
    .join("\n")
    .trim();
}

// Only the FINAL assistant response renders below the widget; intermediate
// responses live INSIDE the worked group as entries (user spec 2026-09-05).
function turnText(turn: Turn): string {
  const parts: string[] = [];
  for (const msg of turn.assistantMsgs) {
    const txt = meaningfulText(msg);
    if (txt) parts.push(txt);
  }
  return parts.length ? parts[parts.length - 1] : "";
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
      {/* 44dp visible target + hitSlop = ~56dp effective (Material min 48). */}
      <Pressable
        onPress={doCopy}
        accessibilityLabel="Copy response"
        style={styles.actionBtn}
        hitSlop={6}
      >
        <Icon name={copied ? "check" : "copy"} size={20} color={copied ? colors.link : "#8e8e8e"} />
      </Pressable>
      <Pressable
        onPress={onFork}
        accessibilityLabel="Branch conversation from here"
        style={styles.actionBtn}
        hitSlop={6}
      >
        <Icon name="branch" size={20} color="#8e8e8e" />
      </Pressable>
    </View>
  );
}

interface MessageListProps {
  isGenerating?: boolean;
  toolCalls?: ToolCallInfo[];
  notices?: { level: string; message: string }[];
  /** Current IME height so the list reserves space above the lifted composer. */
  kbHeight?: number;
}

/** Memoized rows: unchanged turns skip re-render entirely while streaming,
 * so per-delta cost is just the live footer (2026-09-05 perf fix). */
const UserRow = React.memo(function UserRow({ msg }: { msg: OmpMessage }) {
  return <ChatMessage message={msg} />;
});

const TurnRow = React.memo(function TurnRow({
  turn,
  onFork,
}: {
  turn: Turn;
  onFork: (t: Turn) => void;
}) {
  const steps = buildSteps(turn);
  const text = turnText(turn);
  const meta = turnMeta(turn);
  // Turn with neither steps nor meaningful text = filler; render nothing.
  if (steps.length === 0 && !text) return null;
  return (
    <View style={styles.turn}>
      <Trace steps={steps} durationMs={meta.duration} defaultOpen={steps.length > 0 && !text} />
      {text ? (
        <>
          <View style={styles.sep} />
          <View style={styles.answerWrap}>
            <MarkdownView markdown={text} />
          </View>
          <ActionRow text={text} onFork={() => onFork(turn)} />
        </>
      ) : steps.length === 0 ? (
        <RNText style={styles.emptyResponse}>(empty response)</RNText>
      ) : null}
    </View>
  );
});

export function MessageList({
  isGenerating,
  toolCalls,
  notices,
  kbHeight,
}: MessageListProps) {
  const listRef = useRef<FlatList>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [liveOpen, setLiveOpen] = useState(true);
  // Selector subscriptions only: a whole-store subscription re-rendered the
  // whole list on every streaming delta (lag/glitch storm, 2026-09-05).
  // Per-delta fields are selected HERE (not passed from ChatScreen) so the
  // screen shell never re-renders mid-stream (dropped-tap fix, 2026-09-06).
  const messages = useStore((s) => s.messages);
  const streamingText = useStore((s) => s.streamingText);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const forkSession = useStore((s) => s.forkSession);
  const historyTruncated = useStore((s) => s.historyTruncated);
  const liveSteps = useStore((s) => s.liveSteps);

  const handleForkCb = useCallback(
    (turn: Turn) => {
      void (async () => {
        if (!currentSessionId) return;
        const newId = await forkSession(currentSessionId, turn.messageCount);
        if (newId) openChat(newId);
      })();
    },
    [currentSessionId, forkSession],
  );

  const handleFork = async (turn: Turn) => {
    if (!currentSessionId) return;
    const newId = await forkSession(currentSessionId, turn.messageCount);
    if (newId) openChat(newId);
  };

  // Pin rule: follow the bottom unless the user took over by dragging.
  // The pin releases ONLY on user drag (onScrollBeginDrag) and re-engages
  // when the user scrolls back to the bottom (drag/momentum end) or taps
  // the jump button. It must NOT gate on per-event distance the rest of the
  // time: VirtualizedList estimate re-measures change contentSize without a
  // scroll event and permanently disengage a distance-gated pin.
  // Pin with the REAL content height: scrollToOffset(MAX_SAFE_INTEGER) does
  // NOT clamp on this RN/Android (blank-list root cause, proven by A/B on
  // emulator 2026-09-06). Finite offsets always clamp.
  const userHoldRef = useRef(false);
  const contentHeightRef = useRef(0);
  const handleContentSize = (_w: number, h: number) => {
    contentHeightRef.current = h;
    // Pin on EVERY size change (growth and shrink) unless the user is
    // holding the scroll. Shrink re-pin matters: after a live turn commits,
    // the streaming footer is replaced by shorter committed rows and the
    // offset can end up past the new content end (blank tail).
    if (!userHoldRef.current) {
      listRef.current?.scrollToOffset({ offset: h, animated: false });
    }
  };

  const distFromBottom = (event: {
    nativeEvent: {
      contentOffset: { y: number };
      layoutMeasurement: { height: number };
      contentSize: { height: number };
    };
  }) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    return contentSize.height - (contentOffset.y + layoutMeasurement.height);
  };

  const handleScroll = (event: {
    nativeEvent: {
      contentOffset: { y: number };
      layoutMeasurement: { height: number };
      contentSize: { height: number };
    };
  }) => {
    // Scroll-button visibility only — never touches the pin (estimate races).
    setShowScrollButton(distFromBottom(event) > 200);
  };

  const handleBeginDrag = () => {
    userHoldRef.current = true;
  };

  const handleEndDrag = (event: {
    nativeEvent: {
      contentOffset: { y: number };
      layoutMeasurement: { height: number };
      contentSize: { height: number };
    };
  }) => {
    // User released: re-engage the pin iff parked at the bottom.
    const near = distFromBottom(event) < 120;
    userHoldRef.current = !near;
    setShowScrollButton(!near && distFromBottom(event) > 200);
  };

  const items = useMemo(() => groupTurns(messages), [messages]);

  const hasContent = items.length > 0 || !!isGenerating;
  const prevCount = useRef(0);
  // Bulk history load settle: VirtualizedList sizes off-screen cells with
  // ESTIMATES; the real content height lands smaller after cells measure,
  // and Android does not always re-fire onContentSizeChange on that shrink —
  // the pin offset ends up past the content end (blank tail). Two finite
  // re-pins (60ms/400ms) let the estimate settle, then land on true bottom.
  useEffect(() => {
    const delta = items.length - prevCount.current;
    prevCount.current = items.length;
    if (delta <= 1) return;
    const pin = () => {
      if (!userHoldRef.current) {
        listRef.current?.scrollToOffset({ offset: contentHeightRef.current, animated: false });
      }
    };
    const t1 = setTimeout(pin, 60);
    const t2 = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [items.length]);

  // Re-open the working group at the start of each turn.
  useEffect(() => {
    if (isGenerating) setLiveOpen(true);
  }, [isGenerating]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, i) => (item.kind === "user" ? "u" + i : "t" + i)}
        onScroll={handleScroll}
        onScrollBeginDrag={handleBeginDrag}
        onScrollEndDrag={handleEndDrag}
        onMomentumScrollEnd={handleEndDrag}
        onContentSizeChange={handleContentSize}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.list, { paddingBottom: spacing.md + 132 + (kbHeight || 0) }]}
        ListHeaderComponent={
          <>
            {historyTruncated ? (
              <RNText style={styles.truncNote}>
                {"Showing last " + historyTruncated.shown + " of " + historyTruncated.total + " messages"}
              </RNText>
            ) : null}
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
        renderItem={({ item }) =>
          item.kind === "user" ? (
            <UserRow msg={item.msg} />
          ) : (
            <TurnRow turn={item.turn} onFork={handleForkCb} />
          )
        }
        ListFooterComponent={
          isGenerating ? (
            <View style={styles.turn}>
              <Trace
                steps={liveSteps as TraceStep[]}
                isStreaming
                open={liveOpen}
                onToggle={() => setLiveOpen((o) => !o)}
              />
              {streamingText && liveOpen ? (
                <View style={styles.answerWrap}>
                  <MarkdownView markdown={streamingText + " ▋"} isStreaming />
                </View>
              ) : null}
            </View>
          ) : null
        }
      />
      {showScrollButton && (
        <Pressable
          style={styles.scrollButton}
          onPress={() => {
            userHoldRef.current = false;
            listRef.current?.scrollToOffset({ offset: contentHeightRef.current, animated: false });
          }}
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
  truncNote: { color: colors.textMuted, fontSize: 12, paddingBottom: spacing.xs },
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
  actions: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -10, marginTop: 6 },
  actionBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
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
