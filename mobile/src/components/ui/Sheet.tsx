/*
 * PURPOSE: Bottom sheet base, 1:1 with the reference: backdrop rgba(0,0,0,.55)
 * fade .24s; sheet #242424, r22 top, slide .3s cubic-bezier(.32,.72,.25,1);
 * grabber 36x4 #454545; safe-area bottom padding.
 *
 * panelStyle lets hosts give the panel an explicit height when they contain
 * flex:1 children (e.g. the Settings sheet) — without it the panel sizes to
 * content and flex children clip/overflow.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { spacing } from "../../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra panel styles (e.g. explicit height for flex children). */
  panelStyle?: StyleProp<ViewStyle>;
}

const SLIDE_EASING = Easing.bezier(0.32, 0.72, 0.25, 1);

export function Sheet({ visible, onClose, children, panelStyle }: SheetProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [visible, slide, fade]);

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          panelStyle,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md) + 22,
            transform: [
              { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1100] }) },
            ],
          },
        ]}
      >
        <View style={styles.grabber} />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#242424",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 8,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 },
    elevation: 16,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#454545",
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 14,
  },
});
