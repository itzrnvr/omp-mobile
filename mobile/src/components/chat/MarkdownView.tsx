/*
 * PURPOSE: Markdown + LaTeX rendering for assistant messages on Expo SDK 53.
 *   - react-native-markdown-display (view-based, no nested FlatList) for
 *     CommonMark-ish markdown with a dark theme.
 *   - Block math ($$...$$) typeset with KaTeX inside a WebView rendered as a
 *     dark card (Android WebView ignores transparency).
 *
 * HISTORY:
 * - react-native-enriched-markdown: codegen spec fails on RN 0.79. Removed.
 * - react-native-math-view: published package requires a native component it
 *   does not ship -> SIGABRT at require time. Removed.
 * - react-native-marked: renders an internal white FlatList (white boxes +
 *   nested same-direction scroll). Removed in favor of markdown-display.
 * - Inline $...$ math renders as mono text (no native typesetter on SDK 53).
 */

import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import MarkdownDisplay from "react-native-markdown-display";
import { WebView } from "react-native-webview";
import { colors } from "../../theme";

const MONO = "monospace";
const INLINE_MATH_RE = /(\$[^$\n]+\$)/g;
const IS_INLINE_MATH_RE = /^\$[^$\n]+\$$/;
const BLOCK_MATH_RE = /\$\$([\s\S]+?)\$\$/g;

const mdStyles = {
  body: { color: colors.text, fontSize: 15, lineHeight: 23 },
  heading1: { color: colors.text, fontSize: 22, lineHeight: 28, marginTop: 6, marginBottom: 8 },
  heading2: { color: colors.text, fontSize: 19, lineHeight: 25, marginTop: 6, marginBottom: 6 },
  heading3: { color: colors.text, fontSize: 17, lineHeight: 23, marginTop: 4, marginBottom: 4 },
  heading4: { color: colors.text, fontSize: 16, lineHeight: 22, marginTop: 4, marginBottom: 4 },
  heading5: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
  heading6: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  strong: { color: colors.text, fontWeight: "600" as const },
  em: { color: colors.textSecondary },
  s: { color: colors.textMuted },
  link: { color: colors.link },
  code_inline: {
    fontFamily: MONO,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  fence: {
    backgroundColor: "#1b1b1b",
    borderColor: "#2f2f2f",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    color: colors.textSecondary,
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 19,
  },
  code_block: {
    backgroundColor: "#1b1b1b",
    borderColor: "#2f2f2f",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    color: colors.textSecondary,
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 19,
  },
  blockquote: {
    borderColor: colors.border,
    borderLeftWidth: 2,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
    color: colors.textSecondary,
  },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginVertical: 2 },
  hr: { backgroundColor: colors.borderSubtle, height: 1, marginVertical: 10 },
};

/** Inline $...$ math as mono text; plain text passes through. */
function renderInlineMath(text: string): React.ReactNode {
  const parts = text.split(INLINE_MATH_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    IS_INLINE_MATH_RE.test(part) ? (
      <RNText key={i} style={{ fontFamily: MONO, color: colors.text }}>
        {part}
      </RNText>
    ) : (
      part
    ),
  );
}

const rules = {
  text: (
    node: { key: string; content: string },
    _children: React.ReactNode,
    _parent: unknown,
    styles: Record<string, unknown>,
  ) => (
    <RNText key={node.key} style={styles.body as object}>
      {renderInlineMath(node.content)}
    </RNText>
  ),
};

function katexHtml(tex: string): string {
  const escaped = JSON.stringify(tex);
  return [
    "<!doctype html><html><head>",
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">',
    '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>',
    "<style>html,body{background:#1b1b1b;margin:0;padding:8px 10px;color:#f2f2f2;overflow:hidden}</style>",
    "</head><body><div id=\"m\"></div>",
    "<script>",
    "try { katex.render(" + escaped + ", document.getElementById(\"m\"), { throwOnError: false, displayMode: true }); }",
    "catch (e) { document.getElementById(\"m\").textContent = " + escaped + "; }",
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

type Segment = { kind: "md"; text: string } | { kind: "math"; tex: string };

function splitBlockMath(md: string): Segment[] {
  const segments: Segment[] = [];
  const re = new RegExp(BLOCK_MATH_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) segments.push({ kind: "md", text: md.slice(last, m.index) });
    segments.push({ kind: "math", tex: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < md.length) segments.push({ kind: "md", text: md.slice(last) });
  return segments;
}

export interface MarkdownViewProps {
  markdown: string;
  isStreaming?: boolean;
}

export function MarkdownView({ markdown }: MarkdownViewProps) {
  const segments = splitBlockMath(markdown);
  return (
    <View style={wrap.wrap}>
      {segments.map((seg, i) =>
        seg.kind === "math" ? (
          <View key={i} style={wrap.mathBlock}>
            <MathBlock tex={seg.tex} />
          </View>
        ) : (
          <MarkdownDisplay key={i} style={mdStyles} rules={rules}>
            {seg.text}
          </MarkdownDisplay>
        ),
      )}
    </View>
  );
}

const wrap = StyleSheet.create({
  wrap: { marginTop: 2 },
  mathBlock: { marginVertical: 8 },
});
