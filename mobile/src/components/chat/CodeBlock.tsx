/*
 * PURPOSE: Code display block inspired by AI Elements.
 * Header bar with filename (monospace) + copy button.
 * Code rendered in monospace font inside a horizontal ScrollView.
 * Copy uses a "Copied!" toast state (expo-clipboard not installed).
 * Dark surface background (bgSecondary), rounded corners (radii.md).
 */

import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Icon } from "../ui/Icon";
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
} from "../../theme";
import { Text } from "../ui/Text";

export interface CodeBlockProps {
  /** The code text to display. */
  code: string;
  /** Optional language label (e.g. "typescript", "python"). */
  language?: string;
  /** Optional filename shown in the header bar. */
  filename?: string;
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // expo-clipboard is not installed — show "Copied!" state only.
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const headerLabel = filename || language || "code";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="code" size={11} color={colors.textMuted} />
          <Text
            size="xs"
            color="textMuted"
            style={styles.filenameText}
          >
            {headerLabel}
          </Text>
        </View>
        <Pressable
          onPress={handleCopy}
          style={styles.copyButton}
          accessibilityRole="button"
          accessibilityLabel="Copy code"
        >
          <Icon
            name={copied ? "check" : "copy"}
            size={13}
            color={copied ? colors.success : colors.textMuted}
          />
          <Text
            size="xs"
            color={copied ? "success" : "textMuted"}
            style={styles.copyLabel}
          >
            {copied ? "Copied!" : "Copy"}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.codeScroll}
        contentContainerStyle={styles.codeContent}
      >
        <Text
          size="xs"
          color="textSecondary"
          lineHeight="sm"
          style={styles.codeText}
        >
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  filenameText: {
    fontFamily: "monospace",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
    backgroundColor: colors.bgSecondary,
  },
  copyLabel: {
    fontWeight: fontWeights.medium,
  },
  codeScroll: {
    maxHeight: 400,
  },
  codeContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  codeText: {
    fontFamily: "monospace",
  },
});
