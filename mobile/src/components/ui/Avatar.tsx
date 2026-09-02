/*
 * PURPOSE: Circular avatar — shows a single-character label or custom icon
 * on a colored background. Used for chat roles, user profiles, etc.
 */

import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { colors, type FontSizeToken } from "../../theme";
import { Text } from "./Text";

export interface AvatarProps {
  /** Diameter in px. Defaults to 36. */
  size?: number;
  /** Background hex color. Defaults to the accent color. */
  color?: string;
  /** Single character or short initials shown centered. */
  label?: string;
  /** Custom icon node (takes priority over label). */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({
  size = 36,
  color = colors.accent,
  label,
  icon,
  style,
}: AvatarProps) {
  // Font size scales with the avatar diameter.
  const textSize: FontSizeToken =
    size <= 24 ? "xs" : size <= 32 ? "sm" : "md";

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    >
      {icon ?? (
        <Text
          size={textSize}
          weight="semibold"
          color={colors.bg}
        >
          {label ?? ""}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
});
