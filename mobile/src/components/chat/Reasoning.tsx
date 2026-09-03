/*
 * PURPOSE: Collapsible reasoning/thinking block inspired by AI Elements.
 * Shows the model's chain-of-thought reasoning with a streaming indicator.
 * Auto-opens during streaming, collapses when complete.
 * Pulsing dot animation while thinking; smooth expand/collapse via LayoutAnimation.
 * Dimmed surface (bgSecondary), soft corners (radii.md), subtle border.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  LayoutAnimation,
} from "react-native";
import { Icon } from "../ui/Icon";
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
} from "../../theme";
import { Text } from "../ui/Text";

export interface ReasoningProps {
  /** The reasoning / chain-of-thought text. */
  text: string;
  /** Whether the model is currently streaming reasoning tokens. */
  isStreaming?: boolean;
  /** Duration of reasoning in seconds — shown in the header when complete. */
  duration?: number;
}

export function Reasoning({ text, isStreaming = false, duration }: ReasoningProps) {
  const [expanded, setExpanded] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Auto-open when streaming starts; collapse when streaming ends.
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(isStreaming);
  }, [isStreaming]);

  // Pulsing dot animation while streaming.
  useEffect(() => {
    if (isStreaming) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(0);
  }, [isStreaming, pulseAnim]);

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  const headerLabel = isStreaming
    ? "Thinking..."
    : duration !== undefined
      ? `Thought for ${duration}s`
      : "Thought process";

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={headerLabel}
      >
        <View style={styles.headerLeft}>
          {isStreaming ? (
            <Animated.View
              style={[styles.pulseDot, { opacity: pulseOpacity }]}
            />
          ) : (
            <Icon name="bulb" size={13} color={colors.textMuted} />
          )}
          <Text size="sm" weight="medium" color="textMuted">
            {headerLabel}
          </Text>
        </View>
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          size={13}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          <Text
            size="xs"
            color="textMuted"
            lineHeight="sm"
            style={styles.reasoningText}
          >
            {text || ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  reasoningText: {
    fontFamily: "monospace",
  },
});
