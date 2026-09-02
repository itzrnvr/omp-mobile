/*
 * PURPOSE: Vertical flexbox layout primitive. Sets flexDirection column,
 * gap, alignment, and justification. Children flow top-to-bottom.
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

export interface StackProps {
  gap?: SpacingToken;
  align?: FlexAlign;
  justify?: FlexJustify;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Stack({
  gap = "md",
  align = "stretch",
  justify = "flex-start",
  children,
  style,
}: StackProps) {
  return (
    <View
      style={[
        styles.stack,
        {
          gap: spacing[gap],
          alignItems: align,
          justifyContent: justify,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flexDirection: "column",
  },
});
