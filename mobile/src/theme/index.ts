/*
 * PURPOSE: ChatGPT-inspired gray theme for OMP Mobile.
 * Adapted from AI Elements design system for mobile screens.
 * Warm grays, spacious design, soft corners, minimal accent.
 *
 * DESIGN PRINCIPLES:
 * - Warm gray palette (ChatGPT-like: #212121 base, not near-black)
 * - Spacious: larger padding, generous gaps between elements
 * - Soft corners: 12-24px border radius
 * - Minimal accent: text-white as accent, no blue/purple
 * - User messages: subtle bubble (#2F2F2F)
 * - Assistant messages: transparent (bubbleless)
 */

export const colors = {
  // Backgrounds (agent-mobile-ui reference palette)
  bg: "#171717",
  bgSecondary: "#1c1c1c",
  surface: "#242424",
  surfaceHover: "#2c2c2c",
  surfaceActive: "#333333",
  card: "#2d2d2d",

  // Borders (subtle)
  border: "#3a3a3a",
  borderSubtle: "#2a2a2a",

  // Text
  text: "#f2f2f2",
  textSecondary: "#b5b5b5",
  textMuted: "#9b9b9b",
  placeholder: "#606060",

  // Accent (minimal — ChatGPT uses almost no accent)
  accent: "#f2f2f2",
  accentStrong: "#FFFFFF",
  accentDim: "#9b9b9b",
  sendIdle: "#969696",

  // Semantic
  success: "#4ADE80",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#B4B4B4",

  // Messages
  userMessage: "#242424",
  assistantMessage: "transparent",

  // Input
  inputBg: "#2d2d2d",

  // Status
  online: "#4ADE80",
  offline: "#8E8E8E",
  connecting: "#F59E0B",
} as const;

// Spacious spacing (larger than before for mobile)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 19,
  xxl: 22,
  xxxl: 26,
  title: 30,
} as const;

export const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
} as const;

export const lineHeights = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 26,
  xl: 30,
  xxl: 34,
  title: 38,
} as const;

// Soft corners (larger radius for mobile)
export const radii = {
  xs: 6,
  sm: 8,
  md: 12,       // base (cards, inputs)
  lg: 16,       // larger cards
  xl: 20,       // user bubble
  composer: 24, // pill composer
  pill: 999,
} as const;

export const durations = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type FontSizeToken = keyof typeof fontSizes;
export type FontWeightToken = keyof typeof fontWeights;
export type RadiusToken = keyof typeof radii;
