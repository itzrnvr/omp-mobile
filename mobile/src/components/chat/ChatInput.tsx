/*
 * PURPOSE: Chat composer following AI Elements PromptInput + ChatGPT gray design.
 * Elevated pill shape with spacious padding, soft corners, focus state.
 * States: empty → typing → streaming (stop button).
 * Toolbar area for attachments and tools.
 */

import React from "react";
import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { colors, spacing, fontSizes, radii } from "../../theme";
import { Ionicons } from "@expo/vector-icons";

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
  bottomInset?: number;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onCancel,
  isGenerating,
  placeholder = "Ask anything...",
  bottomInset = 0,
}: ChatInputProps) {
  const canSend = value.trim().length > 0 && !isGenerating;
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[styles.container, { paddingBottom: spacing.md + bottomInset }]}>
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
              size={20}
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
  },
  // ChatGPT-style: warm gray pill, spacious, soft corners
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radii.composer,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    minHeight: 52,
  },
  composerFocused: {
    borderColor: colors.textMuted,
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
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonActive: {
    backgroundColor: colors.accent,
  },
  stopButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.error,
  },
});
