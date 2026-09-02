/*
 * PURPOSE: ChatKit Studio-inspired design system for OMP Mobile.
 * Updated based on analysis of https://chatkit.studio/playground and
 * OpenAI ChatKit design guidelines.
 *
 * KEY PRINCIPLES:
 * - Use color to express STATE, not identity
 * - Tonal layering instead of shadows for elevation
 * - Assistant messages are BUBBLELESS (transparent, open text)
 * - User messages have contained bubbles with asymmetric corners
 * - Model picker is a compact popover, not a horizontal scroll
 * - Composer is an elevated pill shape with focus glow
 * - Borders are subtle, never pure gray — slight blue tint
 * - Animation: 120-180ms ease-out
 *
 * COLOR SYSTEM (dark mode):
 * Near-black canvas with slight blue tint. Never pure black.
 *   bg:           #0D0F12  (canvas)
 *   bgSecondary:   #12151A  (sidebar/headers)
 *   surface:       #181C22  (cards/inputs)
 *   surfaceHover:  #20252D  (hover/active)
 *   surfaceActive: #282D37  (pressed)
 *   border:        #2A3039  (subtle, blue-tinted)
 *   borderSubtle:  #20252D
 *   text:          #F2F4F7  (primary, 4.5:1 contrast)
 *   textSecondary: #A5ADB9
 *   textMuted:     #737D8B
 *   accent:        #8AB4FF  (blue — used for active states only)
 *   accentStrong:  #5B91F5  (focus rings, active buttons)
 *   userMessage:   #242B35  (user bubble bg)
 *   assistantMsg:  transparent (no bubble)
 *   inputBg:       #171B21
 *
 * RADIUS:
 *   base:    10-12px  (cards, inputs)
 *   composer: 20px    (pill shape)
 *   button:   8-10px
 *   userBubble: 18px 18px 5px 18px (asymmetric)
 *   badge:    6px
 *
 * SPACING:
 *   Message gap: 20-28px between groups
 *   Content max-width: 720px (but mobile uses full width)
 *   Composer padding: 10px
 *
 * TYPOGRAPHY:
 *   Body:     15-16px
 *   Metadata: 11-12px, muted
 *   Code:     13-14px, monospace
 *   Section:   13-14px, medium weight
 */

// ─── Color Tokens (ChatKit-inspired) ────────────────────────────────────────

export const colors = {
  // Backgrounds (near-black, slight blue tint)
  bg: "#0D0F12",
  bgSecondary: "#12151A",
  surface: "#181C22",
  surfaceHover: "#20252D",
  surfaceActive: "#282D37",

  // Borders (subtle, never pure gray — blue-tinted)
  border: "#2A3039",
  borderSubtle: "#20252D",

  // Text (high contrast for accessibility)
  text: "#F2F4F7",
  textSecondary: "#A5ADB9",
  textMuted: "#737D8B",

  // Accent (blue — for active states only, not identity)
  accent: "#8AB4FF",
  accentStrong: "#5B91F5",
  accentDim: "#3A5A8C",

  // Semantic
  success: "#65D69A",
  warning: "#F0B86E",
  error: "#FF7B82",
  info: "#8AB4FF",

  // Message colors
  userMessage: "#242B35",
  assistantMessage: "transparent",

  // Input
  inputBg: "#171B21",

  // Status
  online: "#65D69A",
  offline: "#737D8B",
  connecting: "#F0B86E",
} as const;

// ─── Spacing Scale (4px base) ────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fontSizes = {
  xs: 11,     // metadata, badges
  sm: 13,     // secondary text, labels
  md: 15,     // body text (ChatKit recommends 15-16px)
  lg: 16,     // headings
  xl: 18,     // section titles
  xxl: 20,    // large headings
  xxxl: 24,   // titles
  title: 28,  // page titles
} as const;

export const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
} as const;

export const lineHeights = {
  xs: 16,
  sm: 18,
  md: 22,     // body text (1.4-1.5 ratio for 15px)
  lg: 24,
  xl: 28,
  xxl: 32,
  title: 36,
} as const;

// ─── Radii (ChatKit: soft/round) ──────────────────────────────────────────────

export const radii = {
  xs: 4,
  sm: 6,      // badges
  md: 10,     // cards, inputs (ChatKit base: 10-12px)
  lg: 12,     // cards
  xl: 18,     // composer (pill), user bubble
  composer: 20, // composer pill (ChatKit: 18-22px)
  pill: 999,
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────

export const durations = {
  fast: 120,   // ChatKit: 120-180ms
  normal: 180,
  slow: 280,
} as const;

// ─── Type ────────────────────────────────────────────────────────────────────

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type FontSizeToken = keyof typeof fontSizes;
export type FontWeightToken = keyof typeof fontWeights;
export type RadiusToken = keyof typeof radii;
