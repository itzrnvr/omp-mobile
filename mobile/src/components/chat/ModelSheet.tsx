/*
 * PURPOSE: Model picker bottom sheet:
 *   1. RECENT strip (non-collapsible) — recently used models, one-tap.
 *   2. SEARCH input filtering the full catalog by name/provider/id.
 *   3. PROVIDERS — collapsible groups from the server catalog (omp models.yml),
 *      each row: bold name + provider/id + context window, blue check on select.
 *   4. REASONING segmented control + FOLDER input (our additions).
 * Sheet chrome from ui/Sheet (grabber, #242424, r22, slide .3s).
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Text as RNText,
  LayoutAnimation,
} from "react-native";
import { Sheet } from "../ui/Sheet";
import { FolderPicker } from "./FolderPicker";
import { Input } from "../ui/Input";
import { Icon } from "../ui/Icon";
import { colors, spacing, radii } from "../../theme";
import { useStore } from "../../store";
import { MODEL_PRESETS, THINKING_LEVELS, type ThinkingLevel, type ModelCatalogEntry } from "../../types";

function fmtCtx(n: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + "M";
  return (n / 1000).toFixed(0) + "K";
}

export interface ModelSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ModelSheet({ visible, onClose }: ModelSheetProps) {
  const {
    selectedModel,
    setSelectedModel,
    thinkingLevel,
    setThinkingLevel,
    selectedCwd,
    setSelectedCwd,
    recentModels,
    serverStatus,
  } = useStore();
  const refreshStatus = useStore((s) => s.refreshStatus);
  const [query, setQuery] = useState("");
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({});
  const [folderOpen, setFolderOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuery("");
      const current = selectedModel ? selectedModel.split("/")[0] : "";
      setOpenProviders((prev) => ({ ...prev, [current]: true }));
      // catalog arrives via WS status; re-request in case it was missed
      // (reconnect race) so the sheet never shows the offline preset fallback
      refreshStatus();
    }
  }, [visible, selectedCwd, selectedModel, refreshStatus]);

  // Full catalog from the server; fall back to local presets when offline.
  const catalog: ModelCatalogEntry[] = useMemo(() => {
    const fromServer = serverStatus?.models || [];
    if (fromServer.length > 0) return fromServer;
    return MODEL_PRESETS.map((m) => ({
      value: m.value,
      label: m.label,
      provider: m.value.split("/")[0],
      reasoning: false,
      contextWindow: 0,
      desc: m.desc,
    }));
  }, [serverStatus]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? catalog.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.value.toLowerCase().includes(q),
      )
    : catalog;

  const providers: { name: string; models: ModelCatalogEntry[] }[] = [];
  for (const m of filtered) {
    let group = providers.find((g) => g.name === m.provider);
    if (!group) {
      group = { name: m.provider, models: [] };
      providers.push(group);
    }
    group.models.push(m);
  }

  const recents = recentModels
    .map((v) => catalog.find((m) => m.value === v))
    .filter((m): m is ModelCatalogEntry => !!m);

  const toggleProvider = (name: string) => {
    LayoutAnimation.easeInEaseOut();
    setOpenProviders((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const pick = (value: string) => {
    setSelectedModel(value);
    onClose();
  };

  return (
    <>
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {recents.length > 0 && (
          <>
            <RNText style={styles.sectionTitle}>RECENT</RNText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentRow}>
              {recents.map((m) => (
                <Pressable
                  key={m.value}
                  style={[styles.chip, selectedModel === m.value && styles.chipActive]}
                  onPress={() => pick(m.value)}
                >
                  <RNText style={[styles.chipText, selectedModel === m.value && styles.chipTextActive]}>
                    {m.label}
                  </RNText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <RNText style={[styles.sectionTitle, recents.length > 0 && styles.sectionGap]}>
          PROVIDERS
          <RNText style={styles.providerCount}>
            {"  ·  " + providers.length + " providers · " + catalog.length + " models"}
          </RNText>
        </RNText>
        <View style={styles.searchWrap}>
          <Icon name="search" size={15} color="#8e8e8e" />
          <View style={styles.searchInput}>
            <TextInput
              style={styles.searchField}
              value={query}
              onChangeText={setQuery}
              placeholder="Search models"
              placeholderTextColor="#606060"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <RNText style={[styles.sectionTitle, styles.sectionGap]}>REASONING</RNText>
        <View style={styles.segmented}>
          {THINKING_LEVELS.map((lvl) => (
            <Pressable
              key={lvl}
              style={[styles.segment, thinkingLevel === lvl && styles.segmentActive]}
              onPress={() => setThinkingLevel(lvl as ThinkingLevel)}
            >
              <RNText style={[styles.segmentText, thinkingLevel === lvl && styles.segmentTextActive]}>
                {lvl}
              </RNText>
            </Pressable>
          ))}
        </View>

        {providers.map((group) => {
          const open = !!openProviders[group.name] || q.length > 0;
          return (
            <View key={group.name} style={styles.providerBlock}>
              <Pressable style={styles.providerRow} onPress={() => toggleProvider(group.name)}>
                <RNText style={styles.providerName}>
                  {group.name}
                  <RNText style={styles.providerCount}> · {group.models.length}</RNText>
                </RNText>
                <Icon name={open ? "chevron-up" : "chevron-down"} size={14} color="#8e8e8e" />
              </Pressable>
              {open &&
                group.models.map((m) => (
                  <Pressable
                    key={m.value}
                    style={({ pressed }) => [styles.modelRow, pressed && styles.modelRowPressed]}
                    onPress={() => pick(m.value)}
                  >
                    <View style={styles.modelText}>
                      <RNText style={styles.modelName}>{m.label}</RNText>
                      <RNText style={styles.modelDesc}>
                        {m.value}
                        {m.contextWindow ? ` · ${fmtCtx(m.contextWindow)} ctx` : ""}
                        {m.reasoning ? " · reasoning" : ""}
                      </RNText>
                    </View>
                    {selectedModel === m.value ? (
                      <Icon name="check" size={20} color={colors.link} />
                    ) : null}
                  </Pressable>
                ))}
            </View>
          );
        })}
        {providers.length === 0 && (
          <RNText style={styles.noResults}>No models match “{query}”</RNText>
        )}


        <RNText style={[styles.sectionTitle, styles.sectionGap]}>FOLDER</RNText>
        <Pressable style={styles.folderTrigger} onPress={() => setFolderOpen(true)}>
          <Icon name="folder" size={18} color="#9ccafa" />
          <RNText style={styles.folderTriggerText} numberOfLines={1}>
            {selectedCwd || "Choose a folder on the PC…"}
          </RNText>
          <Icon name="chevron-forward" size={14} color="#606060" />
        </Pressable>
      </ScrollView>
    </Sheet>
    <FolderPicker visible={folderOpen} onClose={() => setFolderOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: "#7c7c7c",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  sectionGap: { marginTop: spacing.lg },
  recentRow: { paddingHorizontal: 12, marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    marginRight: 8,
  },
  chipActive: { borderColor: colors.link },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.text },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginHorizontal: 12,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1 },
  searchField: { color: colors.text, fontSize: 14, paddingVertical: 4 },
  providerBlock: { marginBottom: spacing.xs },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
  providerName: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
  providerCount: { fontSize: 12, color: "#6f6f6f", fontWeight: "400" },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginLeft: 12,
    borderRadius: 13,
  },
  modelRowPressed: { backgroundColor: "#2c2c2c" },
  modelText: { flex: 1 },
  modelName: { fontSize: 16, fontWeight: "600", color: colors.text },
  modelDesc: { fontSize: 12.5, color: "#8a8a8a", marginTop: 2 },
  noResults: {
    color: "#8a8a8a",
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#1b1b1b",
    borderRadius: radii.md,
    padding: 3,
    gap: 2,
    marginHorizontal: 12,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  segmentActive: { backgroundColor: "#2d2d2d" },
  segmentText: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  segmentTextActive: { color: colors.text },
  folderTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "#2d2d2d",
    marginBottom: spacing.md,
  },
  folderTriggerText: { flex: 1, fontSize: 13, color: colors.textSecondary },
});
