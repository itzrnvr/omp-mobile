/*
 * PURPOSE: Global Icon component — real vector icons via @expo/vector-icons.
 *
 * HISTORY:
 * - Ionicons rendered blank in the DEV client (font not loaded), so we briefly
 *   fell back to unicode glyphs. That looked like placeholder slop.
 * - Release builds bundle the icon font natively, so Ionicons work there.
 *   This component keeps a small named API and maps to Ionicons names, so all
 *   call sites stay stable.
 *
 * GOTCHA: if icons ever render blank again, check whether the running build is
 * a dev client (fonts load from Metro there and can fail) vs release (bundled).
 */

import React from "react";
import { Ionicons } from "@expo/vector-icons";

export type IconName =
  | "add"
  | "back"
  | "chat"
  | "chat-outline"
  | "settings"
  | "home"
  | "send"
  | "stop"
  | "chevron-down"
  | "chevron-forward"
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

const MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  add: "add",
  back: "arrow-back",
  chat: "chatbubbles",
  "chat-outline": "chatbubbles-outline",
  settings: "settings-outline",
  home: "home",
  send: "arrow-up",
  stop: "stop",
  "chevron-down": "chevron-down",
  "chevron-forward": "chevron-forward",
  "chevron-up": "chevron-up",
  check: "checkmark",
  close: "close",
  sync: "sync",
  ellipse: "ellipse-outline",
  bulb: "bulb-outline",
  code: "code-slash",
  "cloud-offline": "cloud-offline-outline",
  copy: "copy-outline",
  retry: "refresh",
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = "#f2f2f2" }: IconProps) {
  return <Ionicons name={MAP[name]} size={size} color={color} />;
}
