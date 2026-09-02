/*
 * PURPOSE: Chat input bar — text input with send/cancel button.
 * Grows with content, supports multiline, shows cancel when generating.
 */

import React from "react";
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator } from "react-native";
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
  placeholder = "Send a message...",
}: ChatInputProps) {
  const canSend = value.trim().length > 0 && !isGenerating;

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={8000}
          editable={!isGenerating}
          textAlignVertical="top"
        />
      </View>

      {isGenerating ? (
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="stop-circle" size={22} color={colors.error} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!canSend}
        >
          <Ionicons name="arrow-up" size={20} color={canSend ? colors.text : colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    maxHeight: 120,
  },
  input: {
    fontSize: fontSizes.md,
    color: colors.text,
    padding: 0,
    margin: 0,
    minHeight: 24,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.error,
  },
});
