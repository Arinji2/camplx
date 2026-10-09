// app/_layout.tsx
import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { AnimatedSplash } from "@/components/AnimatedSplash";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/database";

function RootNavigator() {
  const [fontsLoaded] = useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    "Jakarta-Medium": PlusJakartaSans_500Medium,
    "Jakarta-Semibold": PlusJakartaSans_600SemiBold,
    "Jakarta-Bold": PlusJakartaSans_700Bold,
    "Jakarta-Extrabold": PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // Initialize local database on startup
    db.init();
  }, []);

  if (!fontsLoaded) {
    return <View className="flex-1 bg-white" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 200,
      }}
    />
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <RootNavigator />
        {showSplash ? (
          <AnimatedSplash onFinish={() => setShowSplash(false)} />
        ) : null}
      </View>
    </QueryClientProvider>
  );
}
