/*
 * PURPOSE: The "working / worked-for" chain-of-thought component, 1:1 with the
 * reference (agent-mobile-ui):
 *   - Header button: pulsing live-dot + "Working · {live}s" while running;
 *     "Worked for {dur}" when done; right chevron rotates 90° when open.
 *   - Auto-opens while working; auto-collapses when the turn completes.
 *   - Collapse/expand animated (LayoutAnimation, ~.28s).
 *   - Trace rail: entries padding-left 36; 2px rail #2c2c2c (none on last);
 *     22px circular nodes (#242424 / border #3a3a3a / icon #8e8e8e);
 *     entries fade-in on mount.
 *   - Reasoning entry: sparkle node, "Reasoning · {dur}" label (13/600 #8e8e8e),
 *     text 14.5 #b5b5b5 (streams live via deltas = free typewriter).
 *   - Tool entry: wrench node, blue (#9ccafa) 14/600 name + [done: blue check |
 *     running: 3 blinking dots] + chevron (rotates 180° when open); expandable
 *     ARGUMENTS + RESULT mono boxes (#1b1b1b / #2f2f2f / r10 / 12.5 mono #a8a8a8).
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text as RNText,
  Animated,
  LayoutAnimation,
  ScrollView,
} from "react-native";
import { colors, spacing } from "../../theme";
import { Icon } from "../ui/Icon";

export interface TraceStep {
  kind: "reasoning" | "tool";
  text?: string;
  name?: string;
  args?: string;
  result?: string;
  isError?: boolean;
  status?: "running" | "done";
  dur?: string;
}

export interface TraceProps {
  steps: TraceStep[];
  durationMs?: number;
  isStreaming?: boolean;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Pulsing 7px dot while working (livePulse 1.1s). */
function LiveDot() {
  const opacity = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

/** Three blinking dots for a running tool (blink 1.1s staggered). */
function RunningDots() {
  const dots = [0, 1, 2].map(() => useRef(new Animated.Value(0.25)).current);
  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 440, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 660, useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.runningDots}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.runningDot, { opacity: v }]} />
      ))}
    </View>
  );
}

/** Entry fade-in (traceIn .3s: opacity 0→1, translateY 4→0). */
function FadeIn({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ToolStep({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false);
  const done = step.status !== "running";
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotate, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open, rotate]);

  const toggle = () => {
    LayoutAnimation.easeInEaseOut();
    setOpen((o) => !o);
  };

  return (
    <View>
      <Pressable style={styles.toolTitleRow} onPress={toggle}>
        <RNText style={[styles.toolName, step.isError && styles.toolNameError]}>
          {step.name || "tool"}
        </RNText>
        {done ? (
          <Icon name="check" size={13} color={colors.link} />
        ) : (
          <RunningDots />
        )}
        <Animated.View
          style={{
            transform: [
              {
                rotate: rotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "180deg"],
                }),
              },
            ],
          }}
        >
          <Icon name="chevron-down" size={13} color={colors.link} />
        </Animated.View>
      </Pressable>
      {open && (
        <View>
          {step.args ? (
            <>
              <RNText style={styles.argsLabel}>ARGUMENTS</RNText>
              <ScrollView style={styles.argsBox} nestedScrollEnabled>
                <RNText style={styles.argsText}>{step.args}</RNText>
              </ScrollView>
            </>
          ) : null}
          {step.result ? (
            <>
              <RNText style={styles.argsLabel}>RESULT</RNText>
              <ScrollView style={styles.argsBox} nestedScrollEnabled>
                <RNText style={styles.argsText}>{step.result}</RNText>
              </ScrollView>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function Trace({ steps, durationMs, isStreaming }: TraceProps) {
  const [open, setOpen] = useState(!!isStreaming);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (isStreaming) setOpen(true);
    else setOpen(false);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  if (steps.length === 0 && !isStreaming) return null;

  const toggle = () => {
    LayoutAnimation.easeInEaseOut();
    setOpen((o) => !o);
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.header} onPress={toggle}>
        {isStreaming && <LiveDot />}
        <RNText style={styles.headerText}>
          {isStreaming ? `Working · ${secs}s` : `Worked for ${formatDuration(durationMs || 0)}`}
        </RNText>
        <Icon
          name={open ? "chevron-down" : "chevron-forward"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      {open && (
        <View style={styles.trace}>
          {steps.map((step, i) => {
            const last = i === steps.length - 1 && !isStreaming;
            return (
              <FadeIn key={i}>
                <View style={[styles.entry, last && styles.entryLast]}>
                  <View style={styles.node}>
                    <Icon
                      name={step.kind === "reasoning" ? "sparkle" : "wrench"}
                      size={11}
                      color="#8e8e8e"
                    />
                  </View>
                  {!last && <View style={styles.rail} />}
                  <View style={styles.entryBody}>
                    {step.kind === "reasoning" ? (
                      <>
                        <RNText style={styles.traceLabel}>
                          {"Reasoning" + (step.dur ? " · " + step.dur : "")}
                        </RNText>
                        <RNText style={styles.traceText}>{step.text}</RNText>
                      </>
                    ) : (
                      <ToolStep step={step} />
                    )}
                  </View>
                </View>
              </FadeIn>
            );
          })}
          {isStreaming && (
            <View style={styles.entry}>
              <View style={styles.node}>
                <Icon name="sync" size={11} color="#8e8e8e" />
              </View>
              <View style={styles.entryBody}>
                <RNText style={styles.traceText}>thinking…</RNText>
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
    gap: 7,
    paddingVertical: 2,
  },
  headerText: { color: colors.textMuted, fontSize: 14 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.link,
  },
  trace: { marginTop: 14 },
  entry: { position: "relative", paddingLeft: 36, paddingBottom: 22 },
  entryLast: { paddingBottom: 2 },
  node: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  rail: {
    position: "absolute",
    left: 10,
    top: 28,
    bottom: 4,
    width: 2,
    borderRadius: 1,
    backgroundColor: "#2c2c2c",
  },
  entryBody: { flex: 1 },
  traceLabel: { fontSize: 13, fontWeight: "600", color: "#8e8e8e", marginBottom: 4 },
  traceText: { fontSize: 14.5, lineHeight: 22, color: "#b5b5b5" },
  toolTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  toolName: { color: colors.link, fontSize: 14, fontWeight: "600" },
  toolNameError: { color: colors.error },
  runningDots: { flexDirection: "row", gap: 3, alignItems: "center", marginLeft: 2 },
  runningDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.link },
  argsLabel: {
    marginTop: 13,
    fontSize: 11,
    letterSpacing: 0.9,
    color: "#6f6f6f",
    fontWeight: "600",
  },
  argsBox: {
    marginTop: 6,
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 10,
    padding: 10,
    maxHeight: 180,
  },
  argsText: {
    fontFamily: "monospace",
    fontSize: 12.5,
    lineHeight: 20,
    color: "#a8a8a8",
  },
});
