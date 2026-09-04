/*
 * PURPOSE: Surface container with optional border, padding, radius, and
 * elevation. The base building block for grouped content in the dark theme.
 */

import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import {
  colors,
  spacing,
  radii,
  type SpacingToken,
  type RadiusToken,
} from "../../theme";

export type CardElevation = "none" | "sm" | "md";

export interface CardProps {
  /** Padding token. Defaults to "lg". */
  padding?: SpacingToken;
  /** Radius token. Defaults to "lg". */
  radius?: RadiusToken;
  /** Shadow preset. Defaults to "none" (border does the visual separation). */
  elevation?: CardElevation;
  /** Show 1px border in theme border color. Defaults to true. */
  /** Show 1px border in theme border color. Defaults to false (reference design uses borderless surfaces + hairline separators). */
  border?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const ELEVATION: Record<CardElevation, ViewStyle> = {
  none: {},
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
};

export function Card({
  padding = "lg",
  radius = "lg",
  elevation = "none",
  border = false,
  children,
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          padding: spacing[padding],
          borderRadius: radii[radius],
        },
        border && styles.border,
        ELEVATION[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  border: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
