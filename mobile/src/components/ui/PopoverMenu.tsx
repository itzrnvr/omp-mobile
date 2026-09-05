/*
 * PURPOSE: Anchored popover menu, 1:1 with the reference: card floats above its
 * anchor (offsetBottom from container bottom), #2d2d2d, border #3d3d3d, r14,
 * padding 6, shadow 0 14px 36px rgba(0,0,0,.55), pop-in .16s (fade +
 * translateY(7) + scale .97). Items: padding 10/12, r9, pressed #3a3a3a,
 * icon #8e8e8e, blue check with opacity toggle on the selected row.
 * Renders null when hidden so it never intercepts touches.
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import { colors, spacing } from "../../theme";
import { Text } from "../ui/Text";
import { Icon, type IconName } from "../ui/Icon";

export interface PopoverItem {
  label: string;
  icon?: IconName;
  checked?: boolean;
  onPress: () => void;
}

export interface PopoverMenuProps {
  visible: boolean;
  onClose: () => void;
  items: PopoverItem[];
  align?: "left" | "right";
  /** Distance from the container bottom to anchor the card above. */
  offsetBottom?: number;
}

export function PopoverMenu({
  visible,
  onClose,
  items,
  align = "left",
  offsetBottom = 14,
}: PopoverMenuProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    } else {
      anim.setValue(0);
    }
  }, [visible, anim]);

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View
        style={[
          styles.card,
          align === "left" ? styles.cardLeft : styles.cardRight,
          { bottom: offsetBottom },
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) },
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
            ],
          },
        ]}
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              item.onPress();
              onClose();
            }}
          >
            {item.icon ? <Icon name={item.icon} size={19} color="#8e8e8e" /> : null}
            <Text size="sm" color="text" style={styles.label}>
              {item.label}
            </Text>
            <View style={{ opacity: item.checked ? 1 : 0 }}>
              <Icon name="check" size={17} color={colors.link} />
            </View>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject },
  card: {
    position: "absolute",
    minWidth: 232,
    backgroundColor: "#2d2d2d",
    borderWidth: 1,
    borderColor: "#3d3d3d",
    borderRadius: 14,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  cardLeft: { left: spacing.md },
  cardRight: { right: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  rowPressed: { backgroundColor: "#3a3a3a" },
  label: { flex: 1 },
});
