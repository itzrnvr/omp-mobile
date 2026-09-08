/*
 * PURPOSE: The working/worked chain-of-thought widget — STATIC by design.
 * Previous versions used per-entry FadeIn Animated views, LayoutAnimation
 * collapses and blinking dot loops; those were a major source of list
 * glitches. Now: plain conditional rendering, one 1s timer for the live
 * seconds counter, per-entry expand is a simple state toggle.
 *
 * Entries: reasoning (sparkle), tool (wrench, expandable args/result),
 * intermediate response (chat icon). Header: "Working · Ns" while streaming,
 * "Worked for Xs" when done; tap toggles the body.
 */

import React, { useEffect, useState } from "react";
import { View, Pressable, Text as RNText, StyleSheet } from "react-native";
import { Icon } from "../ui/Icon";
import { colors, spacing } from "../../theme";

export interface TraceStep {
  kind: "reasoning" | "tool" | "text";
  text?: string;
  name?: string;
  args?: string;
  result?: string;
  status?: "running" | "done";
  id?: string;
  isError?: boolean;
  dur?: string;
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + "s";
  return Math.floor(s / 60) + "m " + (s % 60) + "s";
}

function ToolBody({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable style={styles.toolHead} onPress={() => setOpen((o) => !o)} hitSlop={8}>
        <RNText style={styles.toolName}>{step.name || "tool"}</RNText>
        <RNText style={styles.toolStatus}>
          {step.status === "running" ? "…" : step.isError ? "error" : "done"}
        </RNText>
        <Icon name={open ? "chevron-down" : "chevron-forward"} size={13} color="#606060" />
      </Pressable>
      {open && step.args ? (
        <RNText style={styles.mono}>ARGS{"\n"}{step.args}</RNText>
      ) : null}
      {open && step.result ? (
        <RNText style={styles.mono} numberOfLines={40}>RESULT{"\n"}{step.result}</RNText>
      ) : null}
    </View>
  );
}

export function Trace({
  steps,
  durationMs,
  isStreaming,
  open,
  onToggle,
  defaultOpen,
}: {
  steps: TraceStep[];
  durationMs?: number;
  isStreaming?: boolean;
  open?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(!!defaultOpen);
  const [secs, setSecs] = useState(0);
  const expanded = open !== undefined ? open : internalOpen;

  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Fresh turn restarts the clock (stale secs read 476s on a new turn).
  useEffect(() => {
    if (isStreaming) setSecs(0);
  }, [isStreaming]);

  // Completed turns: never show running indicators.
  const effSteps = isStreaming ? steps : steps.map((s) => (s.kind === "tool" ? { ...s, status: "done" as const } : s));

  return (
    <View>
      <Pressable
        style={styles.header}
        hitSlop={10}
        onPress={() => (onToggle ? onToggle() : setInternalOpen((o) => !o))}
      >
        <RNText style={styles.headerText}>
          {isStreaming ? `Working · ${secs}s` : `Worked for ${formatDuration(durationMs || 0)}`}
        </RNText>
        <Icon name={expanded ? "chevron-down" : "chevron-forward"} size={14} color="#606060" />
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          {effSteps.map((step, i) => (
            <View key={i} style={styles.row}>
              <Icon
                name={step.kind === "reasoning" ? "sparkle" : step.kind === "text" ? "chat-outline" : "wrench"}
                size={11}
                color="#8e8e8e"
              />
              <View style={styles.rowBody}>
                {step.kind === "tool" ? (
                  <ToolBody step={step} />
                ) : (
                  <>
                    <RNText style={styles.label}>
                      {step.kind === "reasoning" ? "Reasoning" : "Response"}
                    </RNText>
                    <RNText style={styles.text}>{step.text}</RNText>
                  </>
                )}
              </View>
            </View>
          ))}
          {isStreaming && effSteps.length === 0 ? (
            <RNText style={styles.text}>thinking…</RNText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  headerText: { fontSize: 13, color: "#8e8e8e" },
  // Uniform rhythm: every step gets the same vertical slot (row padding) and
  // the same inter-step gap, so reasoning/tool/response rows look consistent.
  body: { paddingLeft: spacing.md, gap: 10, paddingBottom: spacing.xs },
  row: { flexDirection: "row", gap: 8, paddingVertical: 4, alignItems: "flex-start" },
  rowBody: { flex: 1, gap: 2 },
  label: { fontSize: 12, color: "#8e8e8e" },
  text: { fontSize: 13.5, lineHeight: 19, color: "#b5b5b5" },
  toolHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  toolName: { fontSize: 13.5, color: "#9ccafa", fontWeight: "600" },
  toolStatus: { fontSize: 11.5, color: "#8e8e8e" },
  mono: {
    fontFamily: "monospace",
    fontSize: 11.5,
    lineHeight: 16,
    color: "#a8a8a8",
    backgroundColor: "#1b1b1b",
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
  },
});
