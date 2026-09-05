/*
 * PURPOSE: Circular progress ring for the context-usage indicator (user spec:
 * "the context indicator icon should be a circle progress bar").
 * Track #3a3a3a; progress arc colored by fill ratio (blue < 60%, amber < 85%,
 * red above). Drawn with react-native-svg, rotated -90° so it starts at 12 o'clock.
 */

import React from "react";
import Svg, { Circle } from "react-native-svg";

export interface ContextRingProps {
  /** 0..1 fill ratio. */
  pct: number;
  size?: number;
  strokeWidth?: number;
}

function ringColor(pct: number): string {
  if (pct >= 0.85) return "#ef4444";
  if (pct >= 0.6) return "#f59e0b";
  return "#4aa8ff";
}

export function ContextRing({ pct, size = 18, strokeWidth = 2.5 }: ContextRingProps) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#3a3a3a"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={ringColor(clamped)}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${c * clamped} ${c}`}
        strokeLinecap="round"
      />
    </Svg>
  );
}
