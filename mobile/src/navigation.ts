/*
 * PURPOSE: Navigation types for React Navigation.
 * Defines the route params for each screen.
 */

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
