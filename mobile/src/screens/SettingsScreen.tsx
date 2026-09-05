/*
 * PURPOSE: Settings screen — read-only connection status + token.
 *
 * KEY DECISIONS:
 * - No manual server-URL or tunnel-URL entry: the app auto-connects through the
 *   persistent Cloudflare tunnel whose current URL is published to a fixed gist
 *   pointer (see store bootstrapConnect). Users never type a URL.
 * - Shows the resolved tunnel URL and live connection status for transparency.
 * - Token is masked with a show/hide toggle (pre-filled, rarely edited).
 */

import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { colors, spacing, radii } from "../theme";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Stack } from "../components/ui/Stack";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { useStore } from "../store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function SettingsScreen({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { serverUrl, token, wsStatus, serverStatus, setToken } = useStore();
  const [showToken, setShowToken] = useState(false);

  const connected = wsStatus === "connected";
  const badgeColor = connected ? "success" : wsStatus === "connecting" ? "warning" : "error";
  const badgeLabel = connected ? "Connected" : wsStatus === "connecting" ? "Connecting" : "Offline";

  return (
    <ScrollView
      style={embedded ? styles.embeddedScroll : styles.container}
      contentContainerStyle={
        embedded
          ? [styles.content, { paddingBottom: spacing.lg }]
          : [styles.content, { paddingTop: Math.max(insets.top + spacing.sm, spacing.lg) }]
      }
    >
      <Stack gap="md">
        <Card>
          <Stack gap="md">
            <View style={styles.rowBetween}>
              <Text size="lg" weight="semibold" color="text">Connection</Text>
              <Badge color={badgeColor} dot>{badgeLabel}</Badge>
            </View>

            <View style={styles.rowBetween}>
              <Text size="sm" color="textMuted">Tunnel</Text>
              <Text size="sm" color="textSecondary" numberOfLines={1} style={styles.url}>
                {serverUrl ? serverUrl.replace(/^wss?:\/\//, "") : "resolving…"}
              </Text>
            </View>

            {serverStatus && (
              <>
                <View style={styles.rowBetween}>
                  <Text size="sm" color="textMuted">OMP</Text>
                  <Text size="sm" color="textSecondary">{serverStatus.ompVersion || "—"}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text size="sm" color="textMuted">Sessions</Text>
                  <Text size="sm" color="textSecondary">{serverStatus.totalSessions ?? 0}</Text>
                </View>
              </>
            )}
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <Text size="lg" weight="semibold" color="text">Auth Token</Text>
            <View style={styles.tokenRow}>
              <View style={styles.tokenInput}>
                <Input
                  value={token}
                  onChangeText={setToken}
                  secureTextEntry={!showToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Pressable
                onPress={() => setShowToken((s) => !s)}
                style={styles.eyeButton}
                accessibilityLabel={showToken ? "Hide token" : "Show token"}
              >
                <Icon name={showToken ? "close" : "check"} size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text size="xs" color="textMuted">
              Pre-filled for this personal install. Connection is automatic via the tunnel.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  embeddedScroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  url: { flexShrink: 1, marginLeft: spacing.md },
  tokenRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tokenInput: { flex: 1 },
  eyeButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
});
