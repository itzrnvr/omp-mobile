/*
 * PURPOSE: Real folder picker sheet (user requirement 2026-09-05): replaces
 * the FOLDER text input in the model sheet with a navigable directory browser
 * backed by the bridge server (GET /api/fs, POST /api/fs/mkdir).
 *
 * FEATURES: drive roots on Windows (empty path), up/home buttons, directory
 * list (FlatList = virtualized), inline new-folder create, "Use this folder"
 * commits the path as the session cwd.
 *
 * NOTE: paths are PC-side (the server's filesystem), never device paths.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  Text as RNText,
} from "react-native";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import { colors, spacing, radii } from "../../theme";
import { useStore } from "../../store";

interface DirEntry {
  name: string;
  path: string;
}

interface FsListing {
  path: string;
  parent: string | null;
  home: string;
  dirs: DirEntry[];
}

export interface FolderPickerProps {
  visible: boolean;
  onClose: () => void;
}

export function FolderPicker({ visible, onClose }: FolderPickerProps) {
  const { serverUrl, token, selectedCwd, setSelectedCwd } = useStore();
  const [path, setPath] = useState<string>(selectedCwd || "");
  const [listing, setListing] = useState<FsListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const httpBase = serverUrl
    ? serverUrl.replace(/^ws/, "http").replace(/\/$/, "")
    : "";

  const load = useCallback(
    async (p: string) => {
      if (!httpBase) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          httpBase + "/api/fs?path=" + encodeURIComponent(p),
          { headers: { Authorization: "Bearer " + token } },
        );
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = (await res.json()) as FsListing;
        setListing(data);
        setPath(data.path);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [httpBase, token],
  );

  useEffect(() => {
    if (visible) {
      setNewName("");
      void load(selectedCwd || "");
    }
  }, [visible, selectedCwd, load]);

  const createFolder = async () => {
    const name = newName.trim();
    if (!name || !listing || !listing.path) return;
    const target = listing.path + "\\" + name;
    try {
      const res = await fetch(httpBase + "/api/fs/mkdir", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: target }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = (await res.json()) as FsListing;
      setListing(data);
      setNewName("");
    } catch (e) {
      setError(String(e));
    }
  };

  const displayPath = listing ? listing.path || "This PC" : path || "This PC";

  return (
    <Sheet visible={visible} onClose={onClose} panelStyle={{ height: "72%" }}>
      <View style={styles.head}>
        <Pressable
          style={styles.navBtn}
          onPress={() => listing?.parent != null && void load(listing.parent)}
          disabled={!listing || listing.parent == null}
        >
          <Icon name="back" size={18} color="#b5b5b5" />
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => void load(listing?.home || "")}>
          <Icon name="folder" size={18} color="#b5b5b5" />
        </Pressable>
        <RNText style={styles.path} numberOfLines={1}>
          {displayPath}
        </RNText>
        {loading ? <ActivityIndicator size="small" color="#8e8e8e" /> : null}
      </View>

      <View style={styles.createRow}>
        <TextInput
          style={styles.createInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="New folder name"
          placeholderTextColor="#606060"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void createFolder()}
        />
        <Pressable
          style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
          onPress={() => void createFolder()}
        >
          <RNText style={styles.createBtnText}>Create</RNText>
        </Pressable>
      </View>

      {error ? <RNText style={styles.error}>{error}</RNText> : null}

      <FlatList
        data={listing?.dirs || []}
        keyExtractor={(d) => d.path}
        initialNumToRender={20}
        windowSize={9}
        removeClippedSubviews
        bounces={false}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => void load(item.path)}>
            <Icon name="folder" size={18} color="#9ccafa" />
            <RNText style={styles.rowName} numberOfLines={1}>
              {item.name}
            </RNText>
            <Icon name="chevron-forward" size={14} color="#606060" />
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <RNText style={styles.empty}>No subfolders here</RNText>
          )
        }
      />

      <View style={styles.footer}>
        <Pressable
          style={styles.useBtn}
          onPress={() => {
            if (listing) setSelectedCwd(listing.path || "");
            onClose();
          }}
        >
          <RNText style={styles.useBtnText}>Use this folder</RNText>
        </Pressable>
        {selectedCwd ? (
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              setSelectedCwd("");
              onClose();
            }}
          >
            <RNText style={styles.clearBtnText}>Clear</RNText>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: "#2d2d2d",
    alignItems: "center",
    justifyContent: "center",
  },
  path: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  createRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  createInput: {
    flex: 1,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: "#2d2d2d",
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  createBtn: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  error: { color: "#ff8a8a", fontSize: 12, paddingBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
  },
  rowName: { flex: 1, fontSize: 14, color: colors.text },
  empty: {
    paddingVertical: spacing.lg,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  useBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  useBtnText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  clearBtn: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { color: colors.textMuted, fontSize: 14 },
});
