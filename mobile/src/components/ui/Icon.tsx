/*
 * PURPOSE: Global Icon component that renders via system fonts (emoji + unicode
 * symbols) so icons ALWAYS render — no external font dependency (Ionicons/expo-font
 * fails to load in this dev environment, leaving blank glyphs).
 *
 * Maps semantic icon names to universally-available glyphs:
 *   - Emoji (💬 🏠 💡 ☁) render via Android's Noto Color Emoji
 *   - Symbols (+ ⚙ ✓ ✕ ▾ ↑ ■ ↻ </>) render via Noto Sans Symbols
 *
 * Usage: <Icon name="add" size={22} color={colors.accent} />
 */

import React from "react";
import { Text, StyleSheet } from "react-native";

export type IconName =
  | "add"
  | "chat"
  | "chat-outline"
  | "settings"
  | "home"
  | "send"
  | "stop"
  | "chevron-down"
  | "chevron-up"
  | "check"
  | "close"
  | "sync"
  | "ellipse"
  | "bulb"
  | "code"
  | "cloud-offline"
  | "copy"
  | "retry";

const GLYPHS: Record<IconName, string> = {
  add: "+",
  chat: "\u{1F4AC}",        // 💬 speech balloon
  "chat-outline": "\u{1F5E8}", // 🗨 left speech bubble
  settings: "\u2699",       // ⚙ gear
  home: "\u{1F3E0}",        // 🏠 house
  send: "\u2191",           // ↑ up arrow
  stop: "\u25A0",           // ■ black square
  "chevron-down": "\u25BE", // ▾ down triangle
  "chevron-up": "\u25B4",    // ▴ up triangle
  check: "\u2713",          // ✓ check mark
  close: "\u2715",          // ✕ multiplication x
  sync: "\u21BB",           // ↻ clockwise arrow
  ellipse: "\u25CB",          // ○ white circle
  bulb: "\u{1F4A1}",        // 💡 bulb
  code: "</>",
  "cloud-offline": "\u2601", // ☁ cloud
  copy: "\u2398",           // ⎘ copy
  retry: "\u21BA",          // ↺ counter-clockwise
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = "#ECECEC" }: IconProps) {
  return (
    <Text style={[styles.icon, { fontSize: size, color, lineHeight: size + 4 }]}>
      {GLYPHS[name]}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    textAlign: "center",
    includeFontPadding: false,
  },
});
