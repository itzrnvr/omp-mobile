/*
 * PURPOSE: Global Icon component — real vector icons via @expo/vector-icons
 * (Ionicons), with a small named API so call sites stay stable.
 *
 * HISTORY: Ionicons rendered blank until expo-font loaded the font explicitly
 * (useFonts(Ionicons.font) at App root); release builds bundle it natively.
 */

import React from "react";
import { Ionicons } from "@expo/vector-icons";

export type IconName =
  | "add"
  | "back"
  | "branch"
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
  | "folder"
  | "bulb"
  | "code"
  | "cloud-offline"
  | "copy"
  | "retry"
  | "search"
  | "sparkle"
  | "wrench"
  | "menu"
  | "paperclip"
  | "camera"
  | "link"
  | "mic"
  | "shield"
  | "activity"
  | "rename"
  | "trash";

const MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  add: "add",
  back: "arrow-back",
  branch: "git-branch-outline",
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
  folder: "folder-outline",
  bulb: "bulb-outline",
  code: "code-slash",
  "cloud-offline": "cloud-offline-outline",
  copy: "copy-outline",
  retry: "refresh",
  search: "search",
  sparkle: "sparkles",
  wrench: "construct-outline",
  menu: "menu",
  paperclip: "attach",
  camera: "camera-outline",
  link: "link-outline",
  mic: "mic-outline",
  shield: "shield-checkmark-outline",
  activity: "pulse-outline",
  rename: "create-outline",
  trash: "trash-outline",
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = "#f2f2f2" }: IconProps) {
  return <Ionicons name={MAP[name]} size={size} color={color} />;
}
