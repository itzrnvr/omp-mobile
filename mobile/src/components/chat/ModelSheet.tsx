/*
 * PURPOSE: Model picker bottom sheet (user spec):
 *   1. RECENT strip on top (non-collapsible) — recently used models as chips for
 *      one-tap picking (persisted in AsyncStorage via store.recentModels).
 *   2. PROVIDERS — collapsible groups (provider = prefix before "/"), each
 *      containing its selectable models (17/600 name + 13.5 desc + blue check).
 *   3. REASONING segmented control + FOLDER input below (our additions).
 * Sheet chrome from ui/Sheet (grabber, #242424, r22, slide .3s).
 */

import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Text as RNText,
  LayoutAnimation,
} from "react-native";
import { Sheet } from "../ui/Sheet";
import { Input } from "../ui/Input";
import { Icon } from "../ui/Icon";
import { colors, spacing, radii } from "../../theme";
import { useStore } from "../../store";
import { MODEL_PRESETS, THINKING_LEVELS, type ThinkingLevel, type ModelPreset } from "../../types";

function providerOf(value: string): string {
  return value.split("/")[0] || value;
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
  } = useStore();
  const [cwdInput, setCwdInput] = useState(selectedCwd || "");
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      setCwdInput(selectedCwd || "");
      const current = selectedModel ? providerOf(selectedModel) : "";
      setOpenProviders((prev) => ({ ...prev, [current]: true }));
    }
  }, [visible, selectedCwd, selectedModel]);

  const providers: { name: string; models: ModelPreset[] }[] = [];
  for (const m of MODEL_PRESETS) {
    const p = providerOf(m.value);
    let group = providers.find((g) => g.name === p);
    if (!group) {
      group = { name: p, models: [] };
      providers.push(group);
    }
    group.models.push(m);
  }

  const recents = recentModels
    .map((v) => MODEL_PRESETS.find((m) => m.value === v))
    .filter((m): m is ModelPreset => !!m);

  const toggleProvider = (name: string) => {
    LayoutAnimation.easeInEaseOut();
    setOpenProviders((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
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
                  onPress={() => {
                    setSelectedModel(m.value);
                    onClose();
                  }}
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
        </RNText>
        {providers.map((group) => {
          const open = !!openProviders[group.name];
          return (
            <View key={group.name} style={styles.providerBlock}>
              <Pressable
                style={styles.providerRow}
                onPress={() => toggleProvider(group.name)}
              >
                <RNText style={styles.providerName}>{group.name}</RNText>
                <Icon
                  name={open ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#8e8e8e"
                />
              </Pressable>
              {open &&
                group.models.map((m) => (
                  <Pressable
                    key={m.value}
                    style={({ pressed }) => [styles.modelRow, pressed && styles.modelRowPressed]}
                    onPress={() => {
                      setSelectedModel(m.value);
                      onClose();
                    }}
                  >
                    <View style={styles.modelText}>
                      <RNText style={styles.modelName}>{m.label}</RNText>
                      {m.desc ? <RNText style={styles.modelDesc}>{m.desc}</RNText> : null}
                    </View>
                    {selectedModel === m.value ? (
                      <Icon name="check" size={20} color={colors.link} />
                    ) : null}
                  </Pressable>
                ))}
            </View>
          );
        })}

        <RNText style={[styles.sectionTitle, styles.sectionGap]}>REASONING</RNText>
        <View style={styles.segmented}>
          {THINKING_LEVELS.map((lvl) => (
            <Pressable
              key={lvl}
              style={[styles.segment, thinkingLevel === lvl && styles.segmentActive]}
              onPress={() => setThinkingLevel(lvl as ThinkingLevel)}
            >
              <RNText
                style={[styles.segmentText, thinkingLevel === lvl && styles.segmentTextActive]}
              >
                {lvl}
              </RNText>
            </Pressable>
          ))}
        </View>

        <RNText style={[styles.sectionTitle, styles.sectionGap]}>FOLDER</RNText>
        <View style={styles.folderWrap}>
          <Input
            value={cwdInput}
            onChangeText={setCwdInput}
            placeholder="e.g. D:/projects/app"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={styles.applyFolder}
            onPress={() => {
              setSelectedCwd(cwdInput.trim() || "");
              onClose();
            }}
          >
            <RNText style={styles.applyFolderText}>Use this folder</RNText>
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
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
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginLeft: 12,
    borderRadius: 13,
  },
  modelRowPressed: { backgroundColor: "#2c2c2c" },
  modelText: { flex: 1 },
  modelName: { fontSize: 17, fontWeight: "600", color: colors.text },
  modelDesc: { fontSize: 13.5, color: "#8a8a8a", marginTop: 2 },
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
  folderWrap: { paddingHorizontal: 12, paddingBottom: spacing.sm, gap: spacing.sm },
  applyFolder: {
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: "#2d2d2d",
  },
  applyFolderText: { fontSize: 14, fontWeight: "500", color: colors.text },
});
