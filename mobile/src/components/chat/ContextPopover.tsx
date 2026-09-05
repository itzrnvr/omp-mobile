/*
 * PURPOSE: Context usage popover (reference "Context windows" card, images 5/7),
 * anchored above the composer with the same chrome as PopoverMenu.
 *
 * HONESTY NOTE: the reference shows a category breakdown (Messages / MCP tools /
 * …) and a used/limit header. OMP usage events expose only input / output /
 * cacheRead / cacheWrite / totalTokens per turn, so we render those as the rows
 * and use the cache hit rate for the progress bar — same layout, real numbers.
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Animated, Text as RNText } from "react-native";
import { colors, spacing } from "../../theme";
import { useStore } from "../../store";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export interface ContextPopoverProps {
  visible: boolean;
  onClose: () => void;
}

export function ContextPopover({ visible, onClose }: ContextPopoverProps) {
  const { lastUsage } = useStore();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    } else {
      anim.setValue(0);
    }
  }, [visible, anim]);

  if (!visible) return null;

  const u = lastUsage;
  const total = u?.totalTokens ?? 0;
  const denom = (u?.input ?? 0) + (u?.cacheRead ?? 0);
  const hitRate = denom > 0 ? (u?.cacheRead ?? 0) / denom : 0;
  const rows: { label: string; value: number; dot: string }[] = u
    ? [
        { label: "Input tokens", value: u.input, dot: "#4aa8ff" },
        { label: "Output tokens", value: u.output, dot: "#4aa8ff" },
        { label: "Cache read", value: u.cacheRead, dot: "#3f7fc4" },
        { label: "Cache write", value: u.cacheWrite, dot: "#38618f" },
      ]
    : [];

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View
        style={[
          styles.card,
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) },
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.titleRow}>
          <RNText style={styles.title}>Context usage</RNText>
          <RNText style={styles.mono}>
            {fmt(total)} tok{u ? ` (${Math.round(hitRate * 100)}% cache)` : ""}
          </RNText>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(hitRate * 100)}%` }]} />
        </View>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: r.dot }]} />
            <RNText style={styles.rowLabel}>{r.label}</RNText>
            <RNText style={styles.mono}>
              {total > 0 ? ((r.value / total) * 100).toFixed(1) : "0.0"}%
            </RNText>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.row}>
          <RNText style={styles.rowLabel}>Average cache hit rate</RNText>
          <RNText style={styles.mono}>{Math.round(hitRate * 100)}%</RNText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject },
  card: {
    position: "absolute",
    bottom: 14,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: "#2d2d2d",
    borderWidth: 1,
    borderColor: "#3d3d3d",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: colors.text },
  mono: { fontFamily: "monospace", fontSize: 13, color: "#9b9b9b" },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3a3a3a",
    marginBottom: 14,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: "#4aa8ff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { flex: 1, fontSize: 14, color: "#9b9b9b" },
  divider: {
    height: 1,
    backgroundColor: "#3d3d3d",
    marginVertical: 8,
  },
});
