/*
 * PURPOSE: Button component with Mantine-inspired variants.
 * filled  — solid accent background with dark text.
 * outline — transparent with colored border + text.
 * subtle  — transparent, colored text only; surface tint on press.
 * light   — faint accent background with accent text.
 *
 * Press states use Pressable's `pressed` flag. Loading shows a spinner.
 */

import React from "react";
import {
  Pressable,
  View,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import {
  colors,
  spacing,
  fontSizes,
  radii,
  type ColorToken,
} from "../../theme";
import { Text } from "./Text";

export type ButtonVariant = "filled" | "outline" | "subtle" | "light";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Theme color key or hex. Defaults to "accent". */
  color?: ColorToken | string;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Optional node rendered to the left of the label. */
  icon?: React.ReactNode;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Resolve a theme key to its hex value, or pass a raw hex through. */
function resolveColor(color: ColorToken | string): string {
  return (colors as Record<string, string>)[color] ?? color;
}

/** Append 2-digit alpha to a #RRGGBB hex (RN supports 8-digit hex). */
function withAlpha(hex: string, alpha: string): string {
  if (hex.length === 7 && hex.startsWith("#")) return `${hex}${alpha}`;
  return hex;
}

const SIZE_CONFIG: Record<
  ButtonSize,
  { paddingV: number; paddingH: number; radius: number; fontKey: keyof typeof fontSizes }
> = {
  sm: { paddingV: 6, paddingH: 12, radius: radii.sm, fontKey: "sm" },
  md: { paddingV: 10, paddingH: 16, radius: radii.md, fontKey: "md" },
  lg: { paddingV: 14, paddingH: 20, radius: radii.lg, fontKey: "lg" },
};

export function Button({
  variant = "filled",
  size = "md",
  color = "accent",
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  onPress,
  children,
  style,
}: ButtonProps) {
  const resolved = resolveColor(color);
  const isDisabled = disabled || loading;
  const cfg = SIZE_CONFIG[size];

  // Background + border per variant (press-aware).
  const variantBg = (pressed: boolean): ViewStyle => {
    switch (variant) {
      case "filled":
        return { backgroundColor: pressed ? withAlpha(resolved, "DD") : resolved };
      case "outline":
        return {
          backgroundColor: pressed ? withAlpha(resolved, "15") : "transparent",
          borderWidth: 1,
          borderColor: resolved,
        };
      case "subtle":
        return { backgroundColor: pressed ? colors.surfaceHover : "transparent" };
      case "light":
        return { backgroundColor: pressed ? withAlpha(resolved, "33") : withAlpha(resolved, "22") };
    }
  };

  // Text color per variant.
  const textColor: ColorToken | string =
    variant === "filled" ? colors.bg : resolved;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: cfg.paddingV,
          paddingHorizontal: cfg.paddingH,
          borderRadius: cfg.radius,
        },
        variantBg(pressed),
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === "filled" ? colors.bg : resolved}
            style={styles.loader}
          />
        ) : (
          icon ? <View style={styles.icon}>{icon}</View> : null
        )}
        <Text size={cfg.fontKey} weight="medium" color={textColor}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
  },
  fullWidth: {
    alignSelf: "stretch",
    width: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  icon: {
    justifyContent: "center",
    alignItems: "center",
  },
  loader: {
    marginRight: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
});
