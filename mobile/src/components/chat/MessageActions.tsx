/*
 * PURPOSE: Action buttons for messages inspired by AI Elements.
 * Horizontal row of small icon buttons that appear on assistant messages.
 * Exports: MessageActions (container), MessageAction (individual button).
 */

import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { colors, spacing, radii } from "../../theme";
import { Text } from "../ui/Text";

// ─── MessageActions ──────────────────────────────────────────────────────────

export interface MessageActionsProps {
  children: React.ReactNode;
}

export function MessageActions({ children }: MessageActionsProps) {
  return <View style={styles.container}>{children}</View>;
}

// ─── MessageAction ───────────────────────────────────────────────────────────

export interface MessageActionProps {
  /** Icon element (e.g. Ionicons). */
  icon: React.ReactNode;
  /** Text label shown next to the icon. */
  label: string;
  /** Called when the button is pressed. */
  onPress: () => void;
  /** Whether the action is in an active/toggled state. */
  active?: boolean;
}

export function MessageAction({
  icon,
  label,
  onPress,
  active = false,
}: MessageActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        active && styles.actionActive,
        pressed && styles.actionPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text size="xs" color={active ? "text" : "textMuted"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionActive: {
    backgroundColor: colors.surfaceActive,
    borderColor: colors.border,
  },
  actionPressed: {
    backgroundColor: colors.surfaceHover,
  },
});
