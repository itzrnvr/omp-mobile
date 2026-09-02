/*
 * PURPOSE: Horizontal flexbox layout primitive. Sets flexDirection row,
 * gap, alignment, justification, and optional wrapping. Children flow
 * left-to-right.
 */

import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { spacing, type SpacingToken } from "../../theme";

type FlexAlign = "flex-start" | "center" | "flex-end" | "stretch";
type FlexJustify =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between";

export interface GroupProps {
  gap?: SpacingToken;
  align?: FlexAlign;
  justify?: FlexJustify;
  wrap?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Group({
  gap = "md",
  align = "center",
  justify = "flex-start",
  wrap = false,
  children,
  style,
}: GroupProps) {
  return (
    <View
      style={[
        styles.group,
        {
          gap: spacing[gap],
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? "wrap" : "nowrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
  },
});
