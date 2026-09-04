/*
 * PURPOSE: Sessions screen — list of past OMP conversations.
 * Tap a session to open it in the Chat screen.
 *
 * KEY DECISIONS:
 * - Borderless rows separated by hairlines (reference design), not stacked
 *   bordered cards — card stacks read as generic/slop.
 * - Loading state while the first list_sessions round-trip is in flight.
 * - Timestamps from OMP session filenames encode time with dashes
 *   (2026-05-07T11-42-14); formatDate restores colons before parsing.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from "react-native";
import { colors, spacing } from "../theme";
import { Text } from "../components/ui/Text";
import { Icon } from "../components/ui/Icon";
import { Input } from "../components/ui/Input";
import { useStore } from "../store";
import { openChat } from "../navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SessionSummary } from "../types";
import type { NavigationProp } from "../navigation";

export function SessionsScreen({ navigation }: { navigation: NavigationProp }) {
  const insets = useSafeAreaInsets();
  const { sessions, refreshSessions, wsStatus, loadingSessions } = useStore();
  const { deleteSession } = useStore();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) ||
          (s.cwd || "").toLowerCase().includes(q),
      )
    : sessions;

  useEffect(() => {
    refreshSessions();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSessions();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: SessionSummary }) => (
    <Pressable
      onPress={() => openChat(item.id)}
      onLongPress={() =>
        Alert.alert("Delete session?", item.title || "Untitled", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteSession(item.id) },
        ])
      }
      style={styles.sessionRow}
    >
      <View style={styles.rowMain}>
        <Text size="md" weight="medium" color="text" numberOfLines={1}>
          {item.title || "Untitled"}
        </Text>
        <Text size="xs" color="textMuted" numberOfLines={1} style={styles.meta}>
          {item.cwd} · {formatDate(item.timestamp)} · {item.messageCount} msgs
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );

  if (wsStatus !== "connected") {
    return (
      <View style={styles.empty}>
        <Icon name="cloud-offline" size={36} color={colors.textMuted} />
        <Text size="md" color="textMuted" style={{ marginTop: spacing.md }}>
          Not connected to server
        </Text>
      </View>
    );
  }

  if (loadingSessions && sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="sync" size={28} color={colors.textMuted} />
        <Text size="md" color="textMuted" style={{ marginTop: spacing.md }}>
          Loading sessions…
        </Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="chat-outline" size={36} color={colors.textMuted} />
        <Text size="md" color="textMuted" style={{ marginTop: spacing.md }}>
          No sessions yet
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      ListHeaderComponent={
        <View style={styles.searchWrap}>
          <Icon name="search" size={15} color={colors.textMuted} />
          <View style={styles.searchInput}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search sessions"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      }
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.list, { paddingTop: Math.max(insets.top + spacing.sm, spacing.lg) }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
    />
  );
}

function formatDate(timestamp: string): string {
  try {
    const normalized = timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
    const d = new Date(normalized);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return String(timestamp);
  }
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1 },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowMain: { flex: 1 },
  meta: { marginTop: 3 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
