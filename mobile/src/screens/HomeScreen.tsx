/*
 * PURPOSE: Home screen — connection status dashboard + one primary action.
 *
 * KEY DECISIONS:
 * - Single primary action ("New conversation"). Sessions/Settings live in the
 *   tab bar; duplicating them here was competing navigation / decorative noise.
 * - Borderless surface card with label/value rows and hairline-free spacing.
 * - Tunnel status + URL shown read-only (the tunnel auto-starts server-side).
 */

import React, { useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { colors, spacing } from "../theme";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Stack } from "../components/ui/Stack";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { useStore } from "../store";
import { openChat } from "../navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { serverStatus, wsStatus, tunnelUrl, tunnelStatus } = useStore();
  const { sessions, refreshSessions } = useStore();

  useEffect(() => {
    refreshSessions();
  }, []);

  const statusColor = wsStatus === "connected" ? "success" : wsStatus === "connecting" ? "warning" : "error";
  const statusLabel = wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting..." : "Disconnected";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + spacing.sm, spacing.lg) }]}
    >
      <Card padding="lg">
        <Stack gap="md">
          <View style={styles.rowBetween}>
            <Text size="lg" weight="semibold" color="text">Server</Text>
            <Badge color={statusColor as "success" | "warning" | "error"} dot size="md">
              {statusLabel}
            </Badge>
          </View>
          {serverStatus && (
            <Stack gap="xs">
              <InfoRow label="OMP" value={serverStatus.ompVersion} />
              <InfoRow label="Uptime" value={formatUptime(serverStatus.uptime)} />
              <InfoRow label="Sessions" value={String(serverStatus.totalSessions)} />
              <InfoRow label="Active" value={String(serverStatus.activeSessions)} />
            </Stack>
          )}
          <View style={styles.rowBetween}>
            <Text size="sm" color="textMuted">Tunnel</Text>
            <Text size="sm" color="textSecondary">
              {tunnelStatus === "active" ? "Active" : tunnelStatus === "starting" ? "Starting…" : "Off"}
            </Text>
          </View>
          {tunnelUrl ? (
            <Text size="xs" color="textMuted" numberOfLines={1}>{tunnelUrl}</Text>
          ) : null}
        </Stack>
      </Card>

      <Button variant="light" size="lg" fullWidth onPress={() => openChat()}>
        New conversation
      </Button>

      {sessions.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" weight="medium" color="textMuted" style={styles.sectionLabel}>
            RECENT
          </Text>
          {sessions.slice(0, 4).map((s) => (
            <Pressable key={s.id} style={styles.recentRow} onPress={() => openChat(s.id)}>
              <Text size="sm" color="text" numberOfLines={1} style={styles.recentTitle}>
                {s.title || "Untitled"}
              </Text>
              <Icon name="chevron-forward" size={14} color={colors.textMuted} />
            </Pressable>
          ))}
        </Stack>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text size="sm" color="textMuted">{label}</Text>
      <Text size="sm" color="text" weight="medium">{value}</Text>
    </View>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 100 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { letterSpacing: 0.8, marginTop: spacing.sm },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  recentTitle: { flex: 1 },
});
