/*
 * PURPOSE: Collapsible turn trace — the reference design's "Worked for 1m 35s ›"
 * pattern: one summary row that expands into a vertical rail of steps
 * (reasoning + tool calls with args/result boxes).
 *
 * KEY DECISIONS:
 * - Rail: 2px line (#2c2c2c) connecting 22px circular nodes (#242424 bg,
 *   #3a3a3a border) with a tiny glyph per step kind.
 * - Reasoning step: muted "Reasoning" label + secondary text.
 * - Tool step: title in colors.link (soft blue); tap toggles args + result
 *   boxes (mono, #1b1b1b bg, #2f2f2f border, 10px radius). Errors use colors.error.
 * - Auto-expands while streaming, collapses when the turn completes.
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { colors, spacing, radii } from "../../theme";
import { Text } from "../ui/Text";
import { Icon } from "../ui/Icon";

export interface TraceStep {
  kind: "reasoning" | "tool";
  /** Reasoning text. */
  text?: string;
  /** Tool name. */
  name?: string;
  /** Serialized tool arguments. */
  args?: string;
  /** Tool result text. */
  result?: string;
  isError?: boolean;
}

export interface TraceProps {
  steps: TraceStep[];
  /** Turn duration in ms (from the final assistant message). */
  durationMs?: number;
  isStreaming?: boolean;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function Trace({ steps, durationMs, isStreaming }: TraceProps) {
  const [expanded, setExpanded] = useState(!!isStreaming);
  const [openTools, setOpenTools] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpanded(!!isStreaming);
  }, [isStreaming]);

  if (steps.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((e) => !e)}
        accessibilityLabel={expanded ? "Collapse trace" : "Expand trace"}
      >
        {isStreaming ? (
          <>
            <Icon name="sync" size={14} color={colors.textMuted} />
            <Text size="sm" color="textMuted">Working…</Text>
          </>
        ) : (
          <>
            <Text size="sm" color="textMuted">
              Worked for {durationMs ? formatDuration(durationMs) : formatDuration(0)}
            </Text>
            <Icon name={expanded ? "chevron-up" : "chevron-forward"} size={13} color={colors.textMuted} />
          </>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.railWrap}>
          {steps.map((step, i) => {
            const last = i === steps.length - 1;
            const toolOpen = !!openTools[i];
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
                    <>
                      <Text size="xs" color="textMuted">Reasoning</Text>
                      <Text size="sm" color="textSecondary" style={styles.stepText}>
                        {step.text}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Pressable
                        style={styles.toolTitleRow}
                        onPress={() => setOpenTools((m) => ({ ...m, [i]: !m[i] }))}
                      >
                        <Text
                          size="sm"
                          weight="medium"
                          color={step.isError ? "error" : "text"}
                          style={styles.toolTitle}
                        >
                          {step.name || "tool"}
                        </Text>
                        <Icon
                          name={toolOpen ? "chevron-up" : "chevron-down"}
                          size={12}
                          color={colors.link}
                        />
                      </Pressable>
                      {toolOpen && (
                        <>
                          {step.args ? (
                            <View style={styles.box}>
                              <ScrollView style={styles.boxScroll} nestedScrollEnabled>
                                <Text size="xs" color="textMuted" style={styles.mono}>
                                  {step.args}
                                </Text>
                              </ScrollView>
                            </View>
                          ) : null}
                          {step.result ? (
                            <View style={styles.box}>
                              <ScrollView style={styles.boxScroll} nestedScrollEnabled>
                                <Text size="xs" color="textSecondary" style={styles.mono}>
                                  {step.result}
                                </Text>
                              </ScrollView>
                            </View>
                          ) : null}
                        </>
                      )}
                    </>
                  )}
                </View>
              </View>
            );
          })}
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
  rail: { flex: 1, width: 2, backgroundColor: "#2c2c2c", marginVertical: 2 },
  stepBody: { flex: 1, marginLeft: spacing.sm, paddingBottom: spacing.md },
  stepBodyLast: { paddingBottom: spacing.xs },
  stepText: { marginTop: 2, lineHeight: 21 },
  toolTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  toolTitle: { color: colors.link },
  box: {
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  boxScroll: { maxHeight: 160 },
  mono: { fontFamily: "monospace", lineHeight: 18 },
});
