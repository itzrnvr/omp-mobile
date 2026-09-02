/*
 * PURPOSE: Mantine-inspired gray dark theme for OMP Mobile.
 * Defines color tokens, spacing scale, typography, and radii.
 * Inspired by Mantine UI's dark palette but with a gray-forward aesthetic
 * similar to Vercel/Linear dark modes.
 *
 * DESIGN PRINCIPLES:
 * - High contrast text on very dark backgrounds for readability
 * - Subtle borders that separate without being noisy
 * - Gray accent color (not blue/purple) per user request
 * - Consistent 4px-based spacing system
 */

// ─── Color Tokens ─────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg: "#0B0C0E",           // App background (darkest)
  bgSecondary: "#111316",  // Tab bar, headers
  surface: "#151619",      // Cards, inputs, elevated surfaces
  surfaceHover: "#1C1D21", // Hover states
  surfaceActive: "#232529", // Active/pressed states

  // Borders
  border: "#26282D",
  borderSubtle: "#1E2024",

  // Text
  text: "#E4E6EA",         // Primary text (high contrast)
  textSecondary: "#9BA1AA", // Secondary text
  textMuted: "#61676F",    // Muted/placeholder text
  textWhite: "#FAFAFA",    // Pure white text for emphasis

  // Accent (gray-forward)
  accent: "#8B8D92",       // Primary accent
  accentBright: "#B0B3B8", // Brighter accent for hover/active
  accentDim: "#5C5E63",    // Dimmed accent

  // Semantic
  success: "#4ADE80",
  successDim: "#22C55E33",
  warning: "#FBBF24",
  warningDim: "#FBBF2433",
  error: "#F87171",
  errorDim: "#F8717133",
  info: "#60A5FA",
  infoDim: "#60A5FA33",

  // Role colors (chat avatars)
  user: "#6B7280",         // User messages
  assistant: "#8B8D92",    // Assistant messages
  system: "#61676F",        // System messages

  // Status indicators
  online: "#4ADE80",
  offline: "#61676F",
  connecting: "#FBBF24",
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
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
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
  md: 20,
  lg: 22,
  xl: 26,
  xxl: 30,
  title: 34,
} as const;

// ─── Radii ────────────────────────────────────────────────────────────────────

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

// ─── Type ────────────────────────────────────────────────────────────────────

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type FontSizeToken = keyof typeof fontSizes;
export type FontWeightToken = keyof typeof fontWeights;
export type RadiusToken = keyof typeof radii;
