/*
 * PURPOSE: Typography component — themed text with size, weight, color, and
 * alignment from the OMP Mobile design tokens. Accepts any color key from the
 * theme palette or a raw hex string. Used by every other UI component.
 */

import React from "react";
import {
  Text as RNText,
  StyleSheet,
  type TextStyle,
  type TextProps as RNTextProps,
} from "react-native";
import {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  type FontSizeToken,
  type FontWeightToken,
  type ColorToken,
} from "../../theme";

/** Line-height token derived from the theme lineHeights scale. */
type LineHeightToken = keyof typeof lineHeights;

export interface TextProps extends Omit<RNTextProps, "style"> {
  /** Font size token (xs … title). Defaults to "md". */
  size?: FontSizeToken;
  /** Font weight token. Defaults to "regular". */
  weight?: FontWeightToken;
  /** Theme color key ("text", "accent", …) or raw hex string. Defaults to "text". */
  color?: ColorToken | string;
  /** Text alignment. Defaults to "left". */
  align?: "left" | "center" | "right";
  /** Optional line-height token override. */
  lineHeight?: LineHeightToken;
  /** Extra styles merged last (overrides theme values). */
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
}

/** Resolve a color key or pass through a raw hex string. */
function resolveColor(color: ColorToken | string): string {
  return (colors as Record<string, string>)[color] ?? color;
}

export function Text({
  size = "md",
  weight = "regular",
  color = "text",
  align = "left",
  lineHeight,
  style,
  children,
  ...rest
}: TextProps) {
  const themed: TextStyle = {
    fontSize: fontSizes[size],
    fontWeight: fontWeights[weight],
    color: resolveColor(color),
    textAlign: align,
  };

  if (lineHeight) {
    themed.lineHeight = lineHeights[lineHeight];
  }

  return (
    <RNText style={[styles.base, themed, style]} {...rest}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {},
});
