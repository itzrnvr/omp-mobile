/*
 * PURPOSE: Conversation container inspired by AI Elements.
 * Wraps messages in a scrollable container with auto-scroll and a
 * floating scroll-to-bottom button. Provides an empty-state component.
 * Exports: Conversation, ConversationContent, ConversationEmptyState,
 * ConversationScrollButton.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon } from "../ui/Icon";
import { colors, spacing, fontSizes, radii } from "../../theme";
import { Text } from "../ui/Text";

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationProps {
  /** Message content (ChatMessage elements, tool calls, etc.). */
  children: React.ReactNode;
  /** Called when the user taps the scroll-to-bottom button. */
  onScrollToBottom?: () => void;
  /** Optional icon for the empty state. */
  emptyIcon?: React.ReactNode;
  /** If provided, the empty state is shown instead of children. */
  emptyTitle?: string;
  /** Optional description for the empty state. */
  emptyDescription?: string;
}

export function Conversation({
  children,
  onScrollToBottom,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: ConversationProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isNearBottomRef = useRef(true);

  // Auto-scroll to bottom when content grows (only if user is near bottom).
  const handleContentSizeChange = (_w: number, h: number) => {
    if (isNearBottomRef.current && h > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  };

  // Track scroll position to show/hide scroll-to-bottom button.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const nearBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  };

  const handleScrollToBottom = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    onScrollToBottom?.();
  };

  // Empty state.
  if (emptyTitle !== undefined) {
    return (
      <View style={styles.container}>
        <ConversationEmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {children}
      </ScrollView>
      {showScrollButton && (
        <ConversationScrollButton onPress={handleScrollToBottom} />
      )}
    </View>
  );
}

// ─── ConversationContent ──────────────────────────────────────────────────────

export interface ConversationContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ConversationContent({ children, style }: ConversationContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

// ─── ConversationEmptyState ───────────────────────────────────────────────────

export interface ConversationEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export function ConversationEmptyState({
  icon,
  title,
  description,
}: ConversationEmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      {icon !== undefined ? (
        icon
      ) : (
        <Icon name="chat-outline" size={36} color={colors.textMuted} />
      )}
      <Text size="lg" color="textMuted" style={styles.emptyTitle}>
        {title}
      </Text>
      {description !== undefined && (
        <Text size="sm" color="textMuted" style={styles.emptyDescription}>
          {description}
        </Text>
      )}
    </View>
  );
}

// ─── ConversationScrollButton ─────────────────────────────────────────────────

export interface ConversationScrollButtonProps {
  onPress: () => void;
}

export function ConversationScrollButton({
  onPress,
}: ConversationScrollButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.scrollButton}
      accessibilityRole="button"
      accessibilityLabel="Scroll to bottom"
    >
      <Icon name="chevron-down" size={18} color={colors.text} />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  position: "relative",
  backgroundColor: colors.bg,
  paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
  },
  content: {
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontWeight: "600",
  },
  emptyDescription: {
    textAlign: "center",
  },
  scrollButton: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
