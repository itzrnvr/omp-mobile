/*
 * PURPOSE: TextInput wrapper with optional label, themed surface
 * background, border, and auto-grow for multiline. Passes through all
 * standard TextInputProps.
 */

import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  type TextInputProps,
} from "react-native";
import { colors, spacing, fontSizes, radii } from "../../theme";
import { Text } from "./Text";

export interface InputProps extends Omit<TextInputProps, "style"> {
  /** Label rendered above the input. */
  label?: string;
  /** Grow height to fit content (requires multiline). */
  autoGrow?: boolean;
  /** Container style (label + input wrapper). */
  style?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  autoGrow = false,
  multiline = false,
  style,
  placeholderTextColor,
  onContentSizeChange,
  ...rest
}: InputProps) {
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );

  const handleContentSizeChange =
    autoGrow && multiline
      ? (e: { nativeEvent: { contentSize: { height: number } } }) => {
          setContentHeight(e.nativeEvent.contentSize.height);
          onContentSizeChange?.(
            e as Parameters<NonNullable<TextInputProps["onContentSizeChange"]>>[0],
          );
        }
      : onContentSizeChange;

  return (
    <View style={style}>
      {label != null && (
        <Text size="sm" weight="medium" color="textSecondary" style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          autoGrow && contentHeight != null && { height: contentHeight },
        ]}
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        multiline={multiline}
        {...rest}
        onContentSizeChange={handleContentSizeChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
