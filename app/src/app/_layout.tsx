import "../global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/stores/authStore";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    "Jakarta-Medium": PlusJakartaSans_500Medium,
    "Jakarta-Semibold": PlusJakartaSans_600SemiBold,
    "Jakarta-Bold": PlusJakartaSans_700Bold,
    "Jakarta-Extrabold": PlusJakartaSans_800ExtraBold,
  });

  const loadSession = useAuthStore((s) => s.loadSession);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#ffffff" }} />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
