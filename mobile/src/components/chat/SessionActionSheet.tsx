/*
 * PURPOSE: Long-press session action sheet (user requirement): bottom sheet with
 * Copy session ID, Rename (inline input), Delete (two-tap confirm inside the
 * sheet). Uses the shared Sheet chrome.
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Text as RNText } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Sheet } from "../ui/Sheet";
import { Input } from "../ui/Input";
import { Icon } from "../ui/Icon";
import { colors, spacing, radii } from "../../theme";
import { useStore } from "../../store";
import type { SessionSummary } from "../../types";

export interface SessionActionSheetProps {
  session: SessionSummary | null;
  onClose: () => void;
}

export function SessionActionSheet({ session, onClose }: SessionActionSheetProps) {
  const { deleteSession, renameSession } = useStore();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (session) {
      setRenaming(false);
      setTitle(session.title || "");
      setConfirmDelete(false);
      setCopied(false);
    }
  }, [session]);

  if (!session) return null;

  return (
    <Sheet visible={!!session} onClose={onClose}>
      <RNText style={styles.sheetTitle} numberOfLines={1}>
        {session.title || "Untitled"}
      </RNText>

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => {
          Clipboard.setStringAsync(session.id).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={18} color={copied ? colors.link : "#8e8e8e"} />
        <RNText style={styles.rowLabel}>Copy session ID</RNText>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => setRenaming((r) => !r)}
      >
        <Icon name="rename" size={18} color="#8e8e8e" />
        <RNText style={styles.rowLabel}>Rename</RNText>
        <Icon name={renaming ? "chevron-up" : "chevron-down"} size={14} color="#8e8e8e" />
      </Pressable>

      {renaming && (
        <View style={styles.renameBox}>
          <Input value={title} onChangeText={setTitle} autoCapitalize="none" autoCorrect={false} />
          <Pressable
            style={styles.applyRename}
            onPress={() => {
              renameSession(session.id, title.trim() || "Untitled");
              onClose();
            }}
          >
            <RNText style={styles.applyRenameText}>Save name</RNText>
          </Pressable>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => {
          if (!confirmDelete) {
            setConfirmDelete(true);
            return;
          }
          deleteSession(session.id);
          onClose();
        }}
      >
        <Icon name="trash" size={18} color={confirmDelete ? colors.error : "#8e8e8e"} />
        <RNText style={[styles.rowLabel, confirmDelete && styles.rowLabelDanger]}>
          {confirmDelete ? "Confirm delete" : "Delete"}
        </RNText>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
  rowPressed: { backgroundColor: "#2c2c2c" },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text },
  rowLabelDanger: { color: colors.error },
  renameBox: { paddingHorizontal: 12, paddingBottom: spacing.sm, gap: spacing.sm },
  applyRename: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: "#2d2d2d",
  },
  applyRenameText: { fontSize: 14, fontWeight: "500", color: colors.text },
});
