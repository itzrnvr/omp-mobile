/*
 * PURPOSE: Settings screen — configure server connection (URL + token).
 * Also shows connection status and quick-connect button.
 */

import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { colors, spacing, radii } from "../theme";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Stack } from "../components/ui/Stack";
import { Badge } from "../components/ui/Badge";
import { useStore } from "../store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    serverUrl,
    token,
    wsStatus,
    serverStatus,
    setServerUrl,
    setToken,
    connect,
    disconnect,
  } = useStore();

  const [urlInput, setUrlInput] = useState(serverUrl || "ws://localhost:9090");
  const [tokenInput, setTokenInput] = useState(token || "4fb2d675-e5d5-455f-8146-7402a464006c");
  const [tunnelUrlInput, setTunnelUrlInput] = useState("");

  const handleConnect = () => {
    setServerUrl(urlInput);
    setToken(tokenInput);
    connect();
  };

  const handleConnectTunnel = () => {
    if (tunnelUrlInput.trim()) {
      const wsUrl = tunnelUrlInput.trim().replace(/^http/, "ws");
      setServerUrl(wsUrl);
      connect();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + spacing.sm, spacing.lg) }]}>
      <Card padding="lg">
        <Stack gap="md">
          <View style={styles.rowBetween}>
            <Text size="lg" weight="semibold" color="text">Connection</Text>
            <Badge
              color={wsStatus === "connected" ? "success" : wsStatus === "connecting" ? "warning" : "error" as "success" | "warning" | "error"}
              dot
              size="md"
            >
              {wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting..." : "Disconnected"}
            </Badge>
          </View>
          {serverStatus && (
            <Text size="xs" color="textMuted">
              OMP {serverStatus.ompVersion} · {serverStatus.totalSessions} sessions
            </Text>
          )}
        </Stack>
      </Card>

      <Card padding="lg">
        <Stack gap="md">
          <Text size="md" weight="semibold" color="text">Local Network</Text>
          <Text size="xs" color="textMuted">Connect to the bridge server on your local network</Text>
          <Input label="Server URL" value={urlInput} onChangeText={setUrlInput} placeholder="ws://192.168.1.100:9090" />
          <Input label="Auth Token" value={tokenInput} onChangeText={setTokenInput} placeholder="Paste the token from the bridge server" />
          <Button variant="filled" size="md" fullWidth onPress={handleConnect}>Connect</Button>
          {wsStatus === "connected" && (
            <Button variant="outline" size="md" fullWidth onPress={disconnect}>Disconnect</Button>
          )}
        </Stack>
      </Card>

      <Card padding="lg">
        <Stack gap="md">
          <Text size="md" weight="semibold" color="text">Remote Tunnel</Text>
          <Text size="xs" color="textMuted">Connect via Cloudflare Tunnel URL for access outside your network</Text>
          <Input label="Tunnel URL" value={tunnelUrlInput} onChangeText={setTunnelUrlInput} placeholder="https://xxx-xxx.trycloudflare.com" />
          <Button variant="light" size="md" fullWidth onPress={handleConnectTunnel}>Connect via Tunnel</Button>
        </Stack>
      </Card>

      <Card padding="lg">
        <Stack gap="sm">
          <Text size="sm" weight="medium" color="text">How to get started</Text>
          <Text size="xs" color="textMuted">{"1. Start the bridge server on your PC:\n   bun run D:/omp-mobile/server/src/index.ts\n\n2. Copy the auth token from the server output\n\n3. Enter the server URL and token above\n\n4. For remote access, start a tunnel from the Home screen"}</Text>
        </Stack>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
