/*
 * PURPOSE: Sessions screen — list of past OMP conversations with search.
 * Tap a session to open it in the Chat screen.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { colors, spacing, fontSizes, radii } from "../theme";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Stack } from "../components/ui/Stack";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SessionSummary } from "../types";
import type { NavigationProp } from "../navigation";

export function SessionsScreen({ navigation }: { navigation: NavigationProp }) {
  const insets = useSafeAreaInsets();
  const { sessions, refreshSessions, wsStatus, loadingSessions } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshSessions();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSessions();
    setRefreshing(false);
  };

  const handleOpenSession = (session: SessionSummary) => {
    navigation.getParent()?.navigate("Chat", { sessionId: session.id });
  };

  const renderItem = ({ item }: { item: SessionSummary }) => (
    <Pressable onPress={() => handleOpenSession(item)} style={styles.sessionItem}>
      <Card padding="md">
        <Stack gap="xs">
          <View style={styles.headerRow}>
            <Text size="md" weight="medium" color="text" numberOfLines={1} style={styles.title}>
              {item.title || "Untitled"}
            </Text>
            <Badge size="sm" variant="light">
              {item.messageCount} msgs
            </Badge>
          </View>
          <Text size="xs" color="textMuted" numberOfLines={1}>
            {item.cwd}
          </Text>
          <Text size="xs" color="textMuted">
            {formatDate(item.timestamp)}
          </Text>
        </Stack>
      </Card>
    </Pressable>
  );

  if (wsStatus !== "connected") {
    return (
      <View style={styles.empty}>
        <Ionicons name="cloud-offline" size={40} color={colors.textMuted} />
        <Text size="md" color="textMuted" style={{ marginTop: spacing.md }}>
          Not connected to server
        </Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
        <Text size="md" color="textMuted" style={{ marginTop: spacing.md }}>
          No sessions yet
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={[styles.list, { paddingTop: Math.max(insets.top + spacing.sm, spacing.lg) }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
    />
  );
}

function formatDate(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return String(timestamp);
  }
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: 100,
  },
  sessionItem: {
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
