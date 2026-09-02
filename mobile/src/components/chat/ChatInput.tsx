/*
 * PURPOSE: Chat composer following ChatKit design guidelines.
 * Elevated pill-shaped composer with focus glow, states for
 * empty/typing/streaming. Attachment and tool area at bottom.
 */

import React from "react";
import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { colors, spacing, fontSizes, radii } from "../../theme";
import { Ionicons } from "@expo/vector-icons";

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onCancel,
  isGenerating,
  placeholder = "Ask anything...",
}: ChatInputProps) {
  const canSend = value.trim().length > 0 && !isGenerating;
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={styles.container}>
      <View style={[styles.composer, focused && styles.composerFocused]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={8000}
          editable={!isGenerating}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical="top"
        />
        {isGenerating ? (
          <Pressable style={styles.stopButton} onPress={onCancel}>
            <Ionicons name="stop" size={16} color={colors.error} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.sendButton, canSend && styles.sendButtonActive]}
            onPress={onSend}
            disabled={!canSend}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={canSend ? colors.bg : colors.textMuted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
  },
  // ChatKit: elevated pill composer, 20px radius, subtle border
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radii.composer,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  // ChatKit: focus state — accent border + glow
  composerFocused: {
    borderColor: colors.accentStrong,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
    padding: 0,
    margin: 0,
    minHeight: 24,
    maxHeight: 120,
    lineHeight: 22,
  },
  // Send button: circular, accent when active
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonActive: {
    backgroundColor: colors.accent,
  },
  // Stop button: circular with error border
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.error,
  },
});
