/*
 * PURPOSE: Composer, 1:1 with the reference (images 1,2,4,6,7):
 *   card #2d2d2d r28 padding 19/16/13; input 18px placeholder #606060;
 *   row gap 17: [+] attach popover · [shield+chev, blue/orange] mode popover ·
 *   [activity while working] · [context button → ContextPopover] · spacer ·
 *   [model 17/500 + chev] model sheet · [mic → DictationSheet] · [send 38px circle].
 *   Attachment chips render above the input.
 *
 * KEY DECISIONS:
 * - Popovers are hosted here (absolute above the row) so they anchor correctly.
 * - Mic uses a WebView Web-Speech dictation sheet (no native voice module —
 *   the native lib dragged in legacy support libs and broke the build).
 * - Shield color: blue (#7cb6f0) for ask/auto, orange for readonly (image 7).
 */

import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, Text as RNText } from "react-native";
import { colors, spacing } from "../../theme";
import { Icon } from "../ui/Icon";
import { PopoverMenu } from "../ui/PopoverMenu";
import { ContextPopover } from "./ContextPopover";
import { DictationSheet } from "./DictationSheet";
import { useStore } from "../../store";

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
  bottomInset?: number;
  modelLabel: string;
  onOpenModel: () => void;
  onAttachFiles: () => void;
  onTakePhoto: () => void;
  onPasteLink: () => void;
}

type Panel = "plus" | "shield" | "ctx" | null;

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onCancel,
  isGenerating,
  placeholder = "Ask for follow-up changes",
  bottomInset = 0,
  modelLabel,
  onOpenModel,
  onAttachFiles,
  onTakePhoto,
  onPasteLink,
}: ChatInputProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [dictationOpen, setDictationOpen] = useState(false);
  const { approvalMode, setApprovalMode, attachments, clearAttachments, lastUsage } = useStore();

  const canSend = value.trim().length > 0 && !isGenerating;

  const onTranscript = (text: string) => {
    onChangeText((value ? value + " " : "") + text);
  };

  const shieldColor = approvalMode === "readonly" ? "#f59e0b" : colors.link;
  const ctxLabel = lastUsage
    ? lastUsage.totalTokens >= 1000
      ? (lastUsage.totalTokens / 1000).toFixed(1) + "K"
      : String(lastUsage.totalTokens)
    : null;

  return (
    <View style={[styles.container, { paddingBottom: spacing.md + bottomInset }]}>
      {/* popovers anchored above the composer card */}
      <View style={styles.popoverHost} pointerEvents="box-none">
        <PopoverMenu
          visible={panel === "plus"}
          onClose={() => setPanel(null)}
          items={[
            { label: "Attach files", icon: "paperclip", onPress: onAttachFiles },
            { label: "Take a photo", icon: "camera", onPress: onTakePhoto },
            { label: "Paste a link", icon: "link", onPress: onPasteLink },
          ]}
        />
        <PopoverMenu
          visible={panel === "shield"}
          onClose={() => setPanel(null)}
          items={[
            {
              label: "Auto-run tools",
              checked: approvalMode === "auto",
              onPress: () => setApprovalMode("auto"),
            },
            {
              label: "Ask before running",
              checked: approvalMode === "ask",
              onPress: () => setApprovalMode("ask"),
            },
            {
              label: "Read-only mode",
              checked: approvalMode === "readonly",
              onPress: () => setApprovalMode("readonly"),
            },
          ]}
        />
        <ContextPopover visible={panel === "ctx"} onClose={() => setPanel(null)} />
      </View>

      <View style={styles.card}>
        {attachments.length > 0 && (
          <View style={styles.chips}>
            {attachments.map((a, i) => (
              <View key={a + i} style={styles.chip}>
                <RNText style={styles.chipText} numberOfLines={1}>
                  {a.split(/[\\/]/).pop()}
                </RNText>
              </View>
            ))}
            <Pressable onPress={clearAttachments}>
              <Icon name="close" size={14} color="#8e8e8e" />
            </Pressable>
          </View>
        )}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#606060"
          multiline
          textAlignVertical="top"
          selectionColor={colors.accent}
        />
        <View style={styles.row}>
          <Pressable onPress={() => setPanel(panel === "plus" ? null : "plus")} accessibilityLabel="Add">
            <Icon name="add" size={24} color="#a3a3a3" />
          </Pressable>
          <Pressable
            style={styles.shieldGroup}
            onPress={() => setPanel(panel === "shield" ? null : "shield")}
            accessibilityLabel="Tool approval mode"
          >
            <Icon name="shield" size={22} color={shieldColor} />
            <Icon name="chevron-down" size={13} color={shieldColor} />
          </Pressable>
          {isGenerating && (
            <View style={styles.activity}>
              <Icon name="activity" size={16} color="#a3a3a3" />
            </View>
          )}
          <Pressable
            onPress={() => setPanel(panel === "ctx" ? null : "ctx")}
            accessibilityLabel="Context usage"
          >
            <View style={styles.ctxButton}>
              <Icon name="sync" size={14} color="#a3a3a3" />
              {ctxLabel ? <RNText style={styles.ctxText}>{ctxLabel}</RNText> : null}
            </View>
          </Pressable>
          <View style={styles.spacer} />
          <Pressable style={styles.modelButton} onPress={onOpenModel} accessibilityLabel="Model">
            <RNText style={styles.modelLabel} numberOfLines={1}>
              {modelLabel}
            </RNText>
            <Icon name="chevron-down" size={15} color="#9a9a9a" />
          </Pressable>
          <Pressable
            style={styles.micButton}
            onPress={() => setDictationOpen(true)}
            accessibilityLabel="Voice input"
          >
            <Icon name="mic" size={22} color="#a3a3a3" />
          </Pressable>
          {isGenerating ? (
            <Pressable
              style={[styles.send, styles.sendStop]}
              onPress={onCancel}
              accessibilityLabel="Stop"
            >
              <Icon name="stop" size={16} color="#ffffff" />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.send, canSend && styles.sendReady]}
              onPress={onSend}
              disabled={!canSend}
              accessibilityLabel="Send"
            >
              <Icon name="send" size={19} color="#171717" />
            </Pressable>
          )}
        </View>
      </View>

      <DictationSheet
        visible={dictationOpen}
        onClose={() => setDictationOpen(false)}
        onTranscript={onTranscript}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, backgroundColor: colors.bg },
  popoverHost: { position: "absolute", left: 0, right: 0, bottom: 70, top: 0 },
  card: {
    backgroundColor: "#2d2d2d",
    borderRadius: 28,
    paddingTop: 19,
    paddingBottom: 13,
    paddingHorizontal: 16,
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 160,
  },
  chipText: { fontSize: 12, color: colors.textSecondary },
  input: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    minHeight: 26,
    maxHeight: 140,
    paddingVertical: 2,
    paddingHorizontal: 8,
    paddingBottom: 26,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 17, paddingHorizontal: 4 },
  shieldGroup: { flexDirection: "row", alignItems: "center", gap: 5 },
  activity: { flexDirection: "row", alignItems: "center" },
  ctxButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#242424",
  },
  ctxText: { fontFamily: "monospace", fontSize: 12, color: "#9b9b9b" },
  spacer: { flex: 1 },
  modelButton: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 150 },
  modelLabel: { fontSize: 17, fontWeight: "500", color: "#ececec" },
  micButton: { alignItems: "center", justifyContent: "center" },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#969696",
    alignItems: "center",
    justifyContent: "center",
  },
  sendReady: { backgroundColor: "#f2f2f2" },
  sendStop: { backgroundColor: colors.error },
});
