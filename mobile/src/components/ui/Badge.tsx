/*
 * PURPOSE: Small status pill — semantic color, three variants, optional
 * status dot. Used for connection state, model labels, counters, etc.
 */

import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { colors, spacing, fontSizes, fontWeights, radii } from "../../theme";
import { Text } from "./Text";

export type BadgeColor = "success" | "warning" | "error" | "info";
export type BadgeVariant = "filled" | "light" | "outline";

export interface BadgeProps {
  /** Semantic color key. Defaults to "info". */
  color?: BadgeColor;
  size?: "sm" | "md";
  variant?: BadgeVariant;
  /** Show a small dot before the label. */
  dot?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Append 2-digit alpha to #RRGGBB. */
function withAlpha(hex: string, alpha: string): string {
  if (hex.length === 7 && hex.startsWith("#")) return `${hex}${alpha}`;
  return hex;
}

const SIZE_CONFIG = {
  sm: {
    paddingV: 2,
    paddingH: 6,
    radius: radii.sm,
    fontKey: "xs" as const,
    dotSize: 6,
  },
  md: {
    paddingV: 4,
    paddingH: 10,
    radius: radii.md,
    fontKey: "sm" as const,
    dotSize: 8,
  },
};

export function Badge({
  color = "info",
  size = "md",
  variant = "light",
  dot = false,
  children,
  style,
}: BadgeProps) {
  const hex = colors[color];
  const cfg = SIZE_CONFIG[size];

  const containerStyle: ViewStyle =
    variant === "filled"
      ? { backgroundColor: hex }
      : variant === "light"
        ? { backgroundColor: withAlpha(hex, "22") }
        : { backgroundColor: "transparent", borderWidth: 1, borderColor: hex };

  const textColor = variant === "filled" ? colors.bg : hex;

  return (
    <View
      style={[
        styles.container,
        {
          paddingVertical: cfg.paddingV,
          paddingHorizontal: cfg.paddingH,
          borderRadius: cfg.radius,
        },
        containerStyle,
        style,
      ]}
    >
      {dot && (
        <View
          style={[
            styles.dot,
            {
              width: cfg.dotSize,
              height: cfg.dotSize,
              borderRadius: cfg.dotSize / 2,
              backgroundColor: hex,
            },
          ]}
        />
      )}
      <Text size={cfg.fontKey} weight="medium" color={textColor}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  dot: {},
});
