/*
 * PURPOSE: App entry point — sets up navigation, SafeArea, and hydration.
 * Bottom tabs: Home, Sessions, Settings. Stack: Chat (modal-style).
 */

import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";

import { colors, spacing } from "./src/theme";
import { Icon } from "./src/components/ui/Icon";
import { rootNavigation } from "./src/navigation";
import { useStore } from "./src/store";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SessionsScreen } from "./src/screens/SessionsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ChatScreen } from "./src/screens/ChatScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ color }: { color: string }) => (
            <Icon name="home" size={20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SessionsTab"
        component={SessionsScreen}
        options={{
          title: "Sessions",
          tabBarIcon: ({ color }: { color: string }) => (
            <Icon name="chat" size={20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: "Settings",
          tabBarIcon: ({ color }: { color: string }) => (
            <Icon name="settings" size={20} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  // Ionicons do NOT auto-load their font in this project (blank glyphs in dev
  // AND release until loaded explicitly). Load once at root.
  useFonts(Ionicons.font);
  const { hydrate } = useStore();

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer ref={rootNavigation}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
