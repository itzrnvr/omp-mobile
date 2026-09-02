/*
 * PURPOSE: Tool-call display card inspired by AI Elements.
 * Collapsible card with header showing tool name + animated status icon.
 * Status icons: pending (muted circle), running (warning spinner),
 * completed (success check), error (error cross).
 * Auto-opens when completed or error. Args in monospace, result in
 * a separated section. Surface background, border, soft corners (radii.md).
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
} from "../../theme";
import { Text } from "../ui/Text";

export type ToolStatus = "pending" | "running" | "completed" | "error";

export interface ToolProps {
  /** Tool name (e.g. "read", "bash", "edit"). */
  name: string;
  /** Serialized arguments string (JSON or plain text). */
  args?: string;
  /** Result / output string from the tool. */
  result?: string;
  /** Current execution status. */
  status: ToolStatus;
}

export function Tool({ name, args, result, status }: ToolProps) {
  const [expanded, setExpanded] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Auto-open when completed or error.
  useEffect(() => {
    if (status === "completed" || status === "error") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(true);
    }
  }, [status]);

  // Spinning animation while running.
  useEffect(() => {
    if (status === "running") {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
    spinAnim.setValue(0);
  }, [status, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={`Tool: ${name}, status: ${status}`}
      >
        <View style={styles.headerLeft}>
          <StatusIcon status={status} spin={spin} />
          <Text size="xs" weight="medium" color="textSecondary">
            {name}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={12}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {args !== undefined && args !== "" && (
            <View style={styles.section}>
              <Text size="xs" weight="medium" color="textMuted" style={styles.sectionLabel}>
                Arguments
              </Text>
              <Text
                size="xs"
                color="textMuted"
                lineHeight="sm"
                style={styles.monoText}
              >
                {args}
              </Text>
            </View>
          )}
          {result !== undefined && result !== "" && (
            <View style={styles.section}>
              <Text size="xs" weight="medium" color="textMuted" style={styles.sectionLabel}>
                Result
              </Text>
              <Text
                size="xs"
                color={status === "error" ? "error" : "textMuted"}
                lineHeight="sm"
                style={styles.monoText}
              >
                {result}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Status icon — renders the appropriate Ionicons icon per status. */
function StatusIcon({
  status,
  spin,
}: {
  status: ToolStatus;
  spin: Animated.AnimatedInterpolation<string>;
}) {
  switch (status) {
    case "pending":
      return (
        <Ionicons name="ellipse-outline" size={12} color={colors.textMuted} />
      );
    case "running":
      return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="sync" size={12} color={colors.warning} />
        </Animated.View>
      );
    case "completed":
      return (
        <Ionicons name="checkmark-circle" size={12} color={colors.success} />
      );
    case "error":
      return (
        <Ionicons name="close-circle" size={12} color={colors.error} />
      );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  monoText: {
    fontFamily: "monospace",
  },
});
