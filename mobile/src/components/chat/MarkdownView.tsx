/*
 * PURPOSE: Minimal markdown renderer — pure Text, no WebView, no KaTeX.
 * The previous react-native-markdown-display + KaTeX-WebView combo was the
 * main source of list glitches (heavy native views inside list rows).
 * Supports: headings, bullets, numbered lists, fenced code (mono block),
 * $$ math blocks (mono block, plain text), inline `code` and **bold**.
 */

import React from "react";
import { Text as RNText, View, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";

function inlineSegments(text: string, keyPrefix: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return (
        <RNText key={keyPrefix + i} style={styles.code}>
          {p.slice(1, -1)}
        </RNText>
      );
    }
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return (
        <RNText key={keyPrefix + i} style={styles.bold}>
          {p.slice(2, -2)}
        </RNText>
      );
    }
    return <RNText key={keyPrefix + i}>{p}</RNText>;
  });
}

export function MarkdownView({ markdown }: { markdown: string }) {
  const lines = (markdown || "").split("\n");
  const out: React.ReactNode[] = [];
  let fence: string[] | null = null;
  let math: string[] | null = null;

  const flushFence = (key: string) => {
    if (fence && fence.length) {
      out.push(
        <RNText key={key} style={styles.block}>
          {fence.join("\n")}
        </RNText>,
      );
    }
    fence = null;
  };
  const flushMath = (key: string) => {
    if (math && math.length) {
      out.push(
        <RNText key={key} style={styles.block}>
          {math.join("\n")}
        </RNText>,
      );
    }
    math = null;
  };

  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    if (line.trim().startsWith("```")) {
      if (fence) flushFence("f" + i);
      else fence = [];
      return;
    }
    if (fence) {
      fence.push(raw);
      return;
    }
    if (line.trim() === "$$" || line.trim().startsWith("$$")) {
      if (math) flushMath("m" + i);
      else math = [];
      if (line.trim().startsWith("$$") && line.trim().length > 2 && line.trim().endsWith("$$")) {
        out.push(<RNText key={"mi" + i} style={styles.block}>{line.trim().slice(2, -2)}</RNText>);
        math = null;
      }
      return;
    }
    if (math) {
      math.push(raw);
      return;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      out.push(
        <RNText key={"h" + i} style={styles.heading}>
          {inlineSegments(h[2], "h" + i)}
        </RNText>,
      );
      return;
    }
    const b = /^\s*[-*]\s+(.*)$/.exec(line);
    if (b) {
      out.push(
        <RNText key={"b" + i} style={styles.para}>
          <RNText style={styles.bullet}>• </RNText>
          {inlineSegments(b[1], "b" + i)}
        </RNText>,
      );
      return;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      out.push(
        <RNText key={"n" + i} style={styles.para}>
          {inlineSegments(line.trim(), "n" + i)}
        </RNText>,
      );
      return;
    }
    if (line.trim() === "") {
      out.push(<View key={"s" + i} style={styles.gap} />);
      return;
    }
    out.push(
      <RNText key={"p" + i} style={styles.para}>
        {inlineSegments(line, "p" + i)}
      </RNText>,
    );
  });
  flushFence("fend");
  flushMath("mend");

  return <View style={styles.wrap}>{out}</View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  para: { fontSize: 14.5, lineHeight: 21, color: colors.text },
  heading: { fontSize: 16, lineHeight: 23, fontWeight: "700", color: colors.text, marginTop: 6 },
  bullet: { color: colors.textMuted },
  block: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#a8a8a8",
    backgroundColor: "#1b1b1b",
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: 4,
    marginBottom: 4,
    fontFamily: "monospace",
  },
  code: { fontFamily: "monospace", fontSize: 13, color: "#d7d7d7", backgroundColor: "#242424" },
  bold: { fontWeight: "700", color: colors.text },
  gap: { height: 6 },
});
