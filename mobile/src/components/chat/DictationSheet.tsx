/*
 * PURPOSE: Voice dictation via a WebView running the Web Speech API
 * (webkitSpeechRecognition on Android Chrome). Chosen because the native
 * @react-native-voice/voice package dragged in legacy android.support libs
 * (requiring jetifier) and coincided with a total touch-input failure on
 * device; this implementation adds no native modules.
 *
 * Behavior: sheet opens → recognition starts → partial/final transcripts are
 * posted back and appended to the composer input; pulsing mic while active.
 */

import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Text as RNText, Animated } from "react-native";
import { WebView } from "react-native-webview";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import { colors, spacing } from "../../theme";

const HTML = `<!doctype html><html><body>
<script>
let rec = null;
function start() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'unsupported' })); return; }
  rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
    window.ReactNativeWebView.postMessage(JSON.stringify({ text }));
  };
  rec.onerror = (e) => window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.error }));
  rec.onend = () => { try { rec.start(); } catch (e) {} };
  rec.start();
}
start();
</script></body></html>`;

export interface DictationSheetProps {
  visible: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

function PulseDot() {
  const opacity = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.dot, { opacity }]} />;
}

export function DictationSheet({ visible, onClose, onTranscript }: DictationSheetProps) {
  const [status, setStatus] = useState("listening");

  useEffect(() => {
    if (visible) setStatus("listening");
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <PulseDot />
        <RNText style={styles.title}>Listening…</RNText>
        <RNText style={styles.hint}>
          {status === "listening"
            ? "Speak now — words appear in the composer."
            : "Speech recognition unavailable: " + status}
        </RNText>
        <View style={styles.webviewBox}>
          {visible && (
            <WebView
              source={{ html: HTML }}
              style={styles.webview}
              onMessage={(e) => {
                try {
                  const msg = JSON.parse(e.nativeEvent.data);
                  if (msg.text) onTranscript(msg.text);
                  if (msg.error) setStatus(msg.error);
                } catch {
                  // ignore malformed
                }
              }}
            />
          )}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", gap: spacing.sm, paddingBottom: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.link },
  title: { fontSize: 16, fontWeight: "600", color: colors.text },
  hint: { fontSize: 13, color: "#8a8a8a", textAlign: "center", paddingHorizontal: spacing.lg },
  webviewBox: { width: "100%", height: 80, opacity: 0.01 },
  webview: { flex: 1 },
});
