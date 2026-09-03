/*
 * PURPOSE: Navigation types for React Navigation.
 * Defines the route params for each screen.
 */
import { createNavigationContainerRef } from "@react-navigation/native";

export type RootStackParamList = {
  Tabs: undefined;
  Chat: { sessionId?: string };
};

export type RootTabParamList = {
  HomeTab: undefined;
  SessionsTab: undefined;
  SettingsTab: undefined;
};

export interface NavigationProp {
  navigate: <T extends string>(screen: T, params?: Record<string, unknown>) => void;
  getParent: () => NavigationProp | undefined;
  goBack: () => void;
}

/** Ref to the root NavigationContainer so any component (incl. tab screens) can navigate the root stack. */
export const rootNavigation = createNavigationContainerRef<RootStackParamList>();

/** Open the Chat screen from anywhere. Tab screens cannot reach "Chat" via getParent(). */
export function openChat(sessionId?: string): void {
  if (rootNavigation.isReady()) {
    rootNavigation.navigate("Chat", { sessionId });
  }
}
