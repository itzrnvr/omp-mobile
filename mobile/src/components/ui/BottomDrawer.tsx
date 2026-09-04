/*
 * PURPOSE: Bottom drawer (slide-up sheet) used for the model / reasoning /
 * folder picker — matches the reference design's sheet pattern.
 *
 * KEY DECISIONS:
 * - Plain RN Modal + Animated translate (SDK 53; @expo/ui BottomSheet needs
 *   SDK 56+). Scrim tap dismisses; drag handle is decorative affordance.
 * - Sheet surface uses colors.card with 28px top radius (reference tokens).
 */

import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors, spacing } from "../../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface BottomDrawerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomDrawer({ visible, onClose, children }: BottomDrawerProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    } else {
      slide.setValue(300);
    }
  }, [visible, slide]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slide }],
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            },
          ]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
});
