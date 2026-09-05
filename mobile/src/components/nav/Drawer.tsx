/*
 * PURPOSE: Left drawer (reference): backdrop fade + slide-in; brand row
 * (sparkle + name) + X; "New chat" button (#2a2a2a r12); search input;
 * session list = RECENTS (top 8, newest first, across folders) followed by
 * COLLAPSIBLE PER-FOLDER groups (user requirement 2026-09-05: "sessions
 * grouped by folders collapsible and recent sessions at top"). While a search
 * query is active the list flattens to matching rows.
 *
 * Rows: title + 52-char preview, active #2c2c2c, long-press → action sheet,
 * and a blue pulsing dot when the session has a live omp run (server
 * broadcasts session_active; user requirement: active indicators in list).
 *
 * PERF NOTE: single virtualized FlatList over a heterogeneous item array
 * (headers + rows); ~600 sessions never mount at once.
 * TOUCH NOTE (2026-09-05): subtree stays MOUNTED always (instant open);
 * pointerEvents gating prevents the hidden backdrop from swallowing touches.
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  FlatList,
  LayoutAnimation,
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
const RECENT_COUNT = 8;

function preview(s: SessionSummary): string {
  const t = s.title || "No messages yet";
  return t.length > 52 ? t.slice(0, 52) + "…" : t;
}

function dirName(cwd?: string): string {
  if (!cwd) return "unknown";
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || cwd;
}

type Item =
  | { k: "rhead" }
  | { k: "rec"; s: SessionSummary }
  | { k: "ghead"; dir: string; count: number }
  | { k: "row"; s: SessionSummary };

export interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

function DrawerBase({ visible, onClose, onOpenSession, onNewChat, onOpenSettings }: DrawerProps) {
  const insets = useSafeAreaInsets();
  // Selectors only — whole-store subscription re-rendered the drawer on every
  // streaming delta and made it lag while a turn ran (2026-09-05).
  const sessions = useStore((s) => s.sessions);
  const refreshSessions = useStore((s) => s.refreshSessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const activeSessionIds = useStore((s) => s.activeSessionIds);
  const externalLive = useStore((s) => s.externalLive);
  const isGenerating = useStore((s) => s.isGenerating);
  const [query, setQuery] = useState("");
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({});
  const [actionSession, setActionSession] = useState<SessionSummary | null>(null);
  const slide = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

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

  // Shared pulse for every "running" dot (one driver, many listeners).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const q = query.trim().toLowerCase();
  const base = q
    ? sessions.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) || (s.cwd || "").toLowerCase().includes(q),
      )
    : sessions;
  // Live/active sessions pin to the top (2026-09-05): own running turn,
  // extension-owned (TUI streaming), or server-announced active.
  const liveIds = useMemo(() => {
    const set = new Set<string>();
    for (const [id, on] of Object.entries(activeSessionIds || {})) if (on) set.add(id);
    for (const [id, on] of Object.entries(externalLive || {})) if (on) set.add(id);
    if (isGenerating && currentSessionId) set.add(currentSessionId);
    return set;
  }, [activeSessionIds, externalLive, isGenerating, currentSessionId]);
  const filtered = useMemo(
    () => [...base.filter((s) => liveIds.has(s.id)), ...base.filter((s) => !liveIds.has(s.id))],
    [base, liveIds],
  );

  // Folder groups ordered by their newest session; current folder open by default.
  const currentDir = sessions.find((s) => s.id === currentSessionId)?.cwd || "";
  const groups: { dir: string; items: SessionSummary[] }[] = [];
  for (const s of filtered) {
    const d = s.cwd || "";
    let g = groups.find((x) => x.dir === d);
    if (!g) {
      g = { dir: d, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }

  const items: Item[] = [];
  if (q) {
    for (const s of filtered) items.push({ k: "row", s });
  } else {
    if (filtered.length > 0) {
      items.push({ k: "rhead" });
      for (const s of filtered.slice(0, RECENT_COUNT)) items.push({ k: "rec", s });
    }
    for (const g of groups) {
      items.push({ k: "ghead", dir: g.dir, count: g.items.length });
      const open = openDirs[g.dir] ?? g.dir === currentDir;
      if (open) for (const s of g.items) items.push({ k: "row", s });
    }
  }

  const toggleDir = (dir: string) => {
    LayoutAnimation.easeInEaseOut();
    setOpenDirs((prev) => {
      const cur = prev[dir] ?? dir === currentDir;
      return { ...prev, [dir]: !cur };
    });
  };

  const renderRow = (s: SessionSummary) => {
    const active = liveIds.has(s.id);
    return (
      <Pressable
        style={[styles.item, s.id === currentSessionId && styles.itemActive]}
        onPress={() => {
          onOpenSession(s.id);
          onClose();
        }}
        onLongPress={() => setActionSession(s)}
      >
        <View style={styles.itemTitleRow}>
          {active ? (
            <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
          ) : null}
          <RNText style={styles.itemTitle} numberOfLines={1}>
            {s.title || "Untitled"}
          </RNText>
        </View>
        <RNText style={styles.itemPreview} numberOfLines={1}>
          {preview(s)}
        </RNText>
      </Pressable>
    );
  };

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
            // keep the footer clear of the gesture bar on inset nav devices
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
          data={items}
          keyExtractor={(it, i) =>
            it.k === "ghead" ? "g:" + it.dir : it.k === "rhead" ? "rhead" : i + ":" + it.s.id
          }
          initialNumToRender={14}
          maxToRenderPerBatch={24}
          windowSize={7}
          removeClippedSubviews
          bounces={false}
          renderItem={({ item }) => {
            if (item.k === "rhead") {
              return <RNText style={styles.label}>RECENTS</RNText>;
            }
            if (item.k === "rec") return renderRow(item.s);
            if (item.k === "ghead") {
              const open = openDirs[item.dir] ?? item.dir === currentDir;
              return (
                <Pressable style={styles.groupHead} onPress={() => toggleDir(item.dir)}>
                  <Icon name="folder" size={15} color="#8e8e8e" />
                  <RNText style={styles.groupName} numberOfLines={1}>
                    {dirName(item.dir)}
                  </RNText>
                  <RNText style={styles.groupCount}>{item.count}</RNText>
                  <Icon
                    name={open ? "chevron-up" : "chevron-down"}
                    size={13}
                    color="#6f6f6f"
                  />
                </Pressable>
              );
            }
            return renderRow(item.s);
          }}
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
    paddingVertical: spacing.xs,
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
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: spacing.xs,
    marginTop: 4,
  },
  groupName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  groupCount: { fontSize: 11, color: "#6f6f6f" },
  item: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    marginBottom: 2,
  },
  itemActive: { backgroundColor: "#2c2c2c" },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.link,
  },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.text },
  itemPreview: { fontSize: 12, color: "#8a8a8a", marginTop: 2 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
    paddingHorizontal: spacing.xs,
  },
  footerText: { fontSize: 14, color: colors.textSecondary },
});

export const Drawer = React.memo(DrawerBase);
