/*
 * PURPOSE: Left drawer (reference): backdrop fade + slide-in; brand row
 * (sparkle + name) + X; "New chat" button (#2a2a2a r12); RECENTS label;
 * search input; VIRTUALIZED session rows (title + 52-char preview, active
 * #2c2c2c, long-press → SessionActionSheet); footer row opens Settings sheet.
 *
 * PERF NOTE (2026-09-05): the list was a ScrollView mapping ALL sessions
 * (~600 rows) which made the drawer take ~1s to appear. FlatList with
 * initialNumToRender/windowSize fixed the open delay.
 * TOUCH NOTE: returns null when hidden — an always-mounted opacity-0 backdrop
 * Pressable swallows every touch on screen.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  FlatList,
  Text as RNText,
  Dimensions,
} from "react-native";
import { colors, spacing } from "../../theme";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { useStore } from "../../store";
import { SessionActionSheet } from "../chat/SessionActionSheet";
import type { SessionSummary } from "../../types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WIDTH = Math.min(Dimensions.get("window").width * 0.82, 340);
const SLIDE_EASING = Easing.bezier(0.32, 0.72, 0.25, 1);

function preview(s: SessionSummary): string {
  const t = s.title || "No messages yet";
  return t.length > 52 ? t.slice(0, 52) + "…" : t;
}

export interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export function Drawer({ visible, onClose, onOpenSession, onNewChat, onOpenSettings }: DrawerProps) {
  const insets = useSafeAreaInsets();
  const { sessions, refreshSessions, currentSessionId } = useStore();
  const [query, setQuery] = useState("");
  const [actionSession, setActionSession] = useState<SessionSummary | null>(null);
  const slide = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) refreshSessions();
    Animated.parallel([
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: visible ? 0 : 1,
        duration: 300,
        easing: SLIDE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slide, fade, refreshSessions]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) || (s.cwd || "").toLowerCase().includes(q),
      )
    : sessions;

  // TOUCH NOTE (2026-09-05): the subtree stays MOUNTED at all times so opening
  // is instant (no remount of the list). Touch safety comes from pointerEvents:
  // hidden => root swallows nothing ("none"); visible => box-none plus the
  // backdrop Pressable (mounted only while visible) closes on tap.
  return (
    <View style={styles.root} pointerEvents={visible ? "box-none" : "none"}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        {visible ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} /> : null}
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            paddingTop: Math.max(insets.top, spacing.md),
            // keep the "Settings & server" footer clear of the gesture bar
            // on tablets/phones with inset nav (2026-09-05 tablet capture)
            paddingBottom: Math.max(insets.bottom, spacing.md),
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -WIDTH - 20],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.head}>
          <View style={styles.brand}>
            <Icon name="sparkle" size={16} color={colors.text} />
            <RNText style={styles.brandText}>OMP</RNText>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close menu">
            <Icon name="close" size={20} color="#a3a3a3" />
          </Pressable>
        </View>

        <Pressable style={styles.newChat} onPress={onNewChat}>
          <Icon name="add" size={18} color={colors.text} />
          <RNText style={styles.newChatText}>New chat</RNText>
        </Pressable>

        <RNText style={styles.label}>RECENTS</RNText>
        <View style={styles.searchWrap}>
          <Icon name="search" size={15} color="#8e8e8e" />
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

        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(s) => s.id}
          initialNumToRender={12}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews
          bounces={false}
          renderItem={({ item: s }) => (
            <Pressable
              style={[styles.item, s.id === currentSessionId && styles.itemActive]}
              onPress={() => {
                onOpenSession(s.id);
                onClose();
              }}
              onLongPress={() => setActionSession(s)}
            >
              <RNText style={styles.itemTitle} numberOfLines={1}>
                {s.title || "Untitled"}
              </RNText>
              <RNText style={styles.itemPreview} numberOfLines={1}>
                {preview(s)}
              </RNText>
            </Pressable>
          )}
        />

        <Pressable style={styles.footerRow} onPress={onOpenSettings}>
          <Icon name="settings" size={18} color="#8e8e8e" />
          <RNText style={styles.footerText}>Settings & server</RNText>
        </Pressable>
      </Animated.View>

      <SessionActionSheet session={actionSession} onClose={() => setActionSession(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: "#1c1c1c",
    borderRightWidth: 1,
    borderRightColor: "#2a2a2a",
    paddingHorizontal: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.md,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 15, fontWeight: "600", color: colors.text },
  newChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  newChatText: { fontSize: 14, fontWeight: "500", color: colors.text },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: "#6f6f6f",
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#242424",
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  searchInput: { flex: 1 },
  list: { flex: 1 },
  item: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    marginBottom: 2,
  },
  itemActive: { backgroundColor: "#2c2c2c" },
  itemTitle: { fontSize: 14, fontWeight: "500", color: colors.text },
  itemPreview: { fontSize: 12, color: "#8a8a8a", marginTop: 2 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  footerText: { fontSize: 14, color: colors.textSecondary },
});
