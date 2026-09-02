/*
 * PURPOSE: Horizontal or vertical hairline divider using the theme border
 * color. Useful for separating sections inside cards or lists.
 */

import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { colors } from "../../theme";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  /** Theme color key or hex. Defaults to the theme border color. */
  color?: string;
  /** Line thickness in px. Defaults to 1. */
  thickness?: number;
  style?: StyleProp<ViewStyle>;
}

export function Divider({
  orientation = "horizontal",
  color = colors.border,
  thickness = 1,
  style,
}: DividerProps) {
  return (
    <View
      style={[
        orientation === "horizontal" ? styles.horizontal : styles.vertical,
        {
          backgroundColor: color,
          ...(orientation === "horizontal"
            ? { height: thickness }
            : { width: thickness }),
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    width: "100%",
    height: 1,
  },
  vertical: {
    height: "100%",
    width: 1,
  },
});
