/*
 * PURPOSE: Minimal markdown renderer — pure Text for everything except block
 * math. Block math ($$...$$) in COMMITTED messages renders via a self-sizing
 * KaTeX WebView card; while streaming it stays mono text (no WebView churn
 * mid-stream — that was the old glitch source). Math-free turns mount zero
 * WebViews, so the plain-Text fast path covers the common case.
 * Supports: headings, bullets, numbered lists, fenced code (mono block),
 * $$ math blocks, inline `code` and **bold**.
 *
 * HISTORY:
 * - react-native-enriched-markdown: codegen spec fails on RN 0.79. Removed.
 * - react-native-math-view: missing native component -> SIGABRT. Removed.
 * - react-native-marked: internal white FlatList. Removed.
 * - Inline $...$ math renders as plain text (no native typesetter on SDK 53).
 */

import React from "react";
import { Text as RNText, View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { colors, spacing } from "../../theme";

function katexHtml(tex: string): string {
  const escaped = JSON.stringify(tex);
  return [
    "<!doctype html><html><head>",
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">',
    '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>',
    "<style>html,body{background:#1b1b1b;margin:0;padding:8px 10px;color:#f2f2f2;overflow:hidden}</style>",
    '</head><body><div id="m"></div>',
    "<script>",
    'try { katex.render(' + escaped + ', document.getElementById("m"), { throwOnError: false, displayMode: true }); }',
    'catch (e) { document.getElementById("m").textContent = ' + escaped + "; }",
    "window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));",
    "</script></body></html>",
  ].join("\n");
}

function MathBlock({ tex }: { tex: string }) {
  const [height, setHeight] = React.useState(60);
  return (
    <WebView
      source={{ html: katexHtml(tex) }}
      style={{
        height,
        backgroundColor: "#1b1b1b",
        borderColor: "#2f2f2f",
        borderWidth: 1,
        borderRadius: 10,
        marginVertical: 6,
      }}
      scrollEnabled={false}
      javaScriptEnabled
      onMessage={(e) => {
        const h = parseInt(e.nativeEvent.data, 10);
        if (Number.isFinite(h) && h > 0) setHeight(h + 4);
      }}
    />
  );
}

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

export function MarkdownView({ markdown, isStreaming }: { markdown: string; isStreaming?: boolean }) {
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
  const renderMath = (key: string, tex: string) => {
    if (isStreaming) {
      out.push(
        <RNText key={key} style={styles.block}>
          {tex}
        </RNText>,
      );
    } else {
      out.push(<MathBlock key={key} tex={tex} />);
    }
  };
  const flushMath = (key: string) => {
    if (math && math.length) renderMath(key, math.join("\n"));
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
      const t = line.trim();
      if (t.length > 4 && t.endsWith("$$")) {
        // Single-line block math: $$...$$
        renderMath("mi" + i, t.slice(2, -2));
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
