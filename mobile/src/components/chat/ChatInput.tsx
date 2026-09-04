/*
 * PURPOSE: Chat composer ported from the agent-mobile-ui reference design
 * (ChatGPT-mobile style): one rounded card (#2d2d2d, radius 28) with the input
 * on top and a single control row below:
 *   [thinking badge ▾]  …spacer…  [model ▾]  [send circle]
 * The send button is a 38px circle: muted gray when idle, light when ready,
 * red with a stop glyph while generating.
 *
 * KEY DECISIONS:
 * - Thinking + model buttons open the ChatScreen picker popover (single source
 *   of truth for model/thinking/folder selection).
 * - No mic/attach buttons: those would be fake features on this bridge.
 */

import React from "react";
import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { colors, spacing, fontSizes, radii } from "../../theme";
import { Text } from "../ui/Text";
import { Icon } from "../ui/Icon";

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
  bottomInset?: number;
  /** Current thinking level label (e.g. "high"). */
  thinkingLabel?: string;
  /** Current model short label (e.g. "GLM-5.2"). */
  modelLabel?: string;
  /** Opens the model/thinking picker popover. */
  onOpenPicker?: () => void;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onCancel,
  isGenerating,
  placeholder = "Ask for follow-up changes",
  bottomInset = 0,
  thinkingLabel,
  modelLabel,
  onOpenPicker,
}: ChatInputProps) {
  const canSend = value.trim().length > 0 && !isGenerating;

  return (
    <View style={[styles.container, { paddingBottom: spacing.md + bottomInset }]}>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          selectionColor={colors.accent}
        />
        <View style={styles.row}>
          <Pressable style={styles.pill} onPress={onOpenPicker} accessibilityLabel="Thinking level">
            <Text size="sm" color="textSecondary">{thinkingLabel || "high"}</Text>
            <Icon name="chevron-down" size={11} color={colors.textMuted} />
          </Pressable>

          <View style={styles.spacer} />

          <Pressable style={styles.pill} onPress={onOpenPicker} accessibilityLabel="Model">
            <Text size="sm" weight="medium" color="text" numberOfLines={1}>
              {modelLabel || "Model"}
            </Text>
            <Icon name="chevron-down" size={12} color={colors.textMuted} />
          </Pressable>

          {isGenerating ? (
            <Pressable
              style={[styles.send, styles.sendStop]}
              onPress={onCancel}
              accessibilityLabel="Stop generating"
            >
              <Icon name="stop" size={15} color="#ffffff" />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.send, canSend && styles.sendReady]}
              onPress={onSend}
              disabled={!canSend}
              accessibilityLabel="Send message"
            >
              <Icon name="send" size={17} color={canSend ? colors.bg : colors.bg} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  input: {
    color: colors.text,
    fontSize: fontSizes.md,
    lineHeight: 22,
    minHeight: 24,
    maxHeight: 132,
    padding: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 150,
  },
  spacer: { flex: 1 },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.sendIdle,
    alignItems: "center",
    justifyContent: "center",
  },
  sendReady: {
    backgroundColor: colors.text,
  },
  sendStop: {
    backgroundColor: colors.error,
  },
});
