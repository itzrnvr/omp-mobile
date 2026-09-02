/*
 * PURPOSE: Home screen — server status dashboard, connection info, quick actions.
 * Shows OMP version, tunnel status, active sessions, and quick-launch buttons.
 */

import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { colors, spacing, radii } from "../theme";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Stack } from "../components/ui/Stack";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NavigationProp } from "../navigation";

export function HomeScreen({ navigation }: { navigation: NavigationProp }) {
  const insets = useSafeAreaInsets();
  const { serverStatus, wsStatus, tunnelUrl, tunnelStatus, startTunnel, stopTunnel } = useStore();

  const statusColor = wsStatus === "connected" ? "success" : wsStatus === "connecting" ? "warning" : "error";
  const statusLabel = wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting..." : "Disconnected";

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + spacing.sm, spacing.lg) }]}>
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
        </Stack>
      </Card>

      <Card padding="lg">
        <Stack gap="md">
          <View style={styles.rowBetween}>
            <Text size="lg" weight="semibold" color="text">Remote Tunnel</Text>
            <Badge
              color={tunnelStatus === "active" ? "success" : tunnelStatus === "starting" ? "warning" : "textMuted" as "success" | "warning" | "error"}
              dot
              size="md"
            >
              {tunnelStatus === "active" ? "Active" : tunnelStatus === "starting" ? "Starting..." : "Off"}
            </Badge>
          </View>
          {tunnelUrl && (
            <View style={styles.tunnelUrlBox}>
              <Text size="xs" color="info" style={styles.tunnelUrl}>{tunnelUrl}</Text>
            </View>
          )}
          <Button
            variant={tunnelStatus === "active" ? "outline" : "filled"}
            size="md"
            fullWidth
            loading={tunnelStatus === "starting"}
            disabled={tunnelStatus === "starting"}
            onPress={tunnelStatus === "active" ? stopTunnel : startTunnel}
          >
            {tunnelStatus === "active" ? "Stop Tunnel" : tunnelStatus === "starting" ? "Starting..." : "Start Tunnel"}
          </Button>
        </Stack>
      </Card>

      <Stack gap="sm">
        <Pressable style={styles.quickAction} onPress={() => navigation.getParent()?.navigate("Chat", {})}>
          <View style={styles.quickActionIcon}>
            <Text size="lg" weight="semibold" color="textSecondary">+</Text>
          </View>
          <Stack gap="xs">
            <Text size="md" weight="medium" color="text">New Conversation</Text>
            <Text size="xs" color="textMuted">Start chatting with OMP</Text>
          </Stack>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={() => navigation.navigate("SessionsTab")}>
          <View style={styles.quickActionIcon}>
            <Text size="lg" color="textSecondary">{"\u25C9"}</Text>
          </View>
          <Stack gap="xs">
            <Text size="md" weight="medium" color="text">Sessions</Text>
            <Text size="xs" color="textMuted">Browse past conversations</Text>
          </Stack>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={() => navigation.navigate("SettingsTab")}>
          <View style={styles.quickActionIcon}>
            <Text size="lg" color="textSecondary">{"\u2699"}</Text>
          </View>
          <Stack gap="xs">
            <Text size="md" weight="medium" color="text">Settings</Text>
            <Text size="xs" color="textMuted">Configure server connection</Text>
          </Stack>
        </Pressable>
      </Stack>
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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tunnelUrlBox: {
    backgroundColor: colors.bgSecondary, borderRadius: radii.sm,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  tunnelUrl: { fontFamily: "monospace" },
  quickAction: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  quickActionIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center",
  },
});
