/*
 * PURPOSE: The "working / worked-for" chain-of-thought component.
 *
 * SPEC (from user):
 * - One component per assistant turn with TWO text states:
 *     * "Working…" while the model is producing reasoning + tool calls.
 *     * "Worked for Xs" once the final response is produced; it then COLLAPSES.
 * - Expanded content is the CoT flow in order:
 *     Reasoning -> Tool call -> Reasoning -> Tool call -> ... -> (final answer
 *     rendered OUTSIDE this component, below it).
 * - Reasoning renders R1-style: muted secondary text, no box.
 * - Tool calls are NOT expandable cards: a blue tool-name line plus a capped,
 *   muted mono result line inline (the user picks a tool and sends a prompt;
 *   the call happens inside the working group).
 * - Visual language from the reference: 2px rail (#2c2c2c) connecting 22px
 *   circular nodes (#242424 bg, #3a3a3a border).
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Text as RNText } from "react-native";
import { colors, spacing } from "../../theme";
import { Icon } from "../ui/Icon";

export interface TraceStep {
  kind: "reasoning" | "tool";
  /** Reasoning text (R1-style). */
  text?: string;
  /** Tool name. */
  name?: string;
  /** Tool result text (shown capped, inline). */
  result?: string;
  isError?: boolean;
}

export interface TraceProps {
  steps: TraceStep[];
  /** Turn duration in ms (final assistant message). */
  durationMs?: number;
  isStreaming?: boolean;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function Trace({ steps, durationMs, isStreaming }: TraceProps) {
  // Expanded while working; collapses automatically when the turn completes.
  const [expanded, setExpanded] = useState(!!isStreaming);

  useEffect(() => {
    setExpanded(!!isStreaming);
  }, [isStreaming]);

  if (steps.length === 0 && !isStreaming) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((e) => !e)}
        accessibilityLabel={expanded ? "Collapse chain of thought" : "Expand chain of thought"}
      >
        {isStreaming ? (
          <>
            <Icon name="sync" size={14} color={colors.textMuted} />
            <RNText style={styles.headerText}>Working…</RNText>
          </>
        ) : (
          <>
            <RNText style={styles.headerText}>
              Worked for {formatDuration(durationMs || 0)}
            </RNText>
            <Icon
              name={expanded ? "chevron-up" : "chevron-forward"}
              size={13}
              color={colors.textMuted}
            />
          </>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.railWrap}>
          {steps.map((step, i) => {
            const last = i === steps.length - 1;
            return (
              <View key={i} style={styles.stepRow}>
                <View style={styles.nodeCol}>
                  <View style={styles.node}>
                    <Icon
                      name={step.kind === "reasoning" ? "bulb" : "code"}
                      size={11}
                      color={colors.textMuted}
                    />
                  </View>
                  {!last && <View style={styles.rail} />}
                </View>
                <View style={[styles.stepBody, last && styles.stepBodyLast]}>
                  {step.kind === "reasoning" ? (
                    <RNText style={styles.reasoningText}>{step.text}</RNText>
                  ) : (
                    <View>
                      <RNText
                        style={[styles.toolName, step.isError && styles.toolNameError]}
                        numberOfLines={1}
                      >
                        {step.name || "tool"}
                      </RNText>
                      {step.result ? (
                        <RNText style={styles.toolResult} numberOfLines={4}>
                          {step.result}
                        </RNText>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          {isStreaming && (
            <View style={styles.stepRow}>
              <View style={styles.nodeCol}>
                <View style={[styles.node, styles.nodeActive]}>
                  <Icon name="sync" size={11} color={colors.textMuted} />
                </View>
              </View>
              <View style={styles.stepBody}>
                <RNText style={styles.reasoningText}>thinking…</RNText>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xs },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs,
  },
  headerText: { color: colors.textMuted, fontSize: 13 },
  railWrap: { marginTop: spacing.xs, paddingLeft: 2 },
  stepRow: { flexDirection: "row" },
  nodeCol: { alignItems: "center", width: 22 },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeActive: { borderColor: colors.textMuted },
  rail: { flex: 1, width: 2, backgroundColor: "#2c2c2c", marginVertical: 2 },
  stepBody: { flex: 1, marginLeft: spacing.sm, paddingBottom: spacing.md },
  stepBodyLast: { paddingBottom: spacing.xs },
  // R1-style reasoning: muted secondary, generous line height, no box.
  reasoningText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  toolName: { color: colors.link, fontSize: 14, fontWeight: "500" },
  toolNameError: { color: colors.error },
  toolResult: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "monospace",
    marginTop: 2,
  },
});
