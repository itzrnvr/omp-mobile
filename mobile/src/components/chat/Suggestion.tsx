/*
 * PURPOSE: Quick-reply suggestion chips inspired by AI Elements.
 * Horizontal scrollable row of pill-shaped chips.
 * Each chip: surface background, border, pressable.
 * Compact, spacious, soft corners (radii.lg).
 */

import React from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { colors, spacing, fontSizes, radii } from "../../theme";
import { Text } from "../ui/Text";

export interface SuggestionProps {
  /** List of suggestion strings to render as chips. */
  suggestions: string[];
  /** Called with the selected suggestion text. */
  onSelect: (suggestion: string) => void;
}

export function Suggestion({ suggestions, onSelect }: SuggestionProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {suggestions.map((suggestion, index) => (
        <Pressable
          key={index}
          onPress={() => onSelect(suggestion)}
          style={({ pressed }) => [
            styles.chip,
            pressed && styles.chipPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Suggestion: ${suggestion}`}
        >
          <Text size="sm" color="textSecondary" style={styles.chipText}>
            {suggestion}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  chipPressed: {
    backgroundColor: colors.surfaceActive,
    borderColor: colors.textMuted,
  },
  chipText: {
    flexShrink: 1,
  },
});
