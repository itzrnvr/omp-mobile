/*
 * PURPOSE: App entry — SafeArea + StatusBar + root NavigationContainer with a
 * single Chat screen. Navigation IA matches the reference: drawer for recents,
 * topbar for menu/title/new-chat; sheets for model/settings/session actions.
 *
 * HISTORY: bottom tabs (Home/Sessions/Settings) removed in the UI-parity pass;
 * their functionality lives in the Drawer + Settings sheet.
 */

import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import { colors } from "./src/theme";
import { rootNavigation } from "./src/navigation";
import { useStore } from "./src/store";
import { ChatScreen } from "./src/screens/ChatScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  // Ionicons only render once the font is loaded explicitly (see Icon.tsx).
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
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
