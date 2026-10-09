import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { colors } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";

export default function EmailAuthScreen() {
  const router = useRouter();
  const loginWithDemo = useAuthStore((s) => s.loginWithDemo);

  const [email, setEmail] = useState("aarav.sharma@dpu.edu.in");
  const [name, setName] = useState("Aarav Sharma");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await loginWithDemo(email.trim(), name.trim());
    setLoading(false);
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-bg justify-center px-6"
    >
      <View className="items-center mb-8">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary mb-3">
          <Text className="text-3xl">🌱</Text>
        </View>
        <Text className="text-2xl font-jakartaExtrabold text-ink text-center">
          CAMPLX
        </Text>
        <Text className="text-sm font-jakarta text-muted text-center mt-1">
          Campus-Exclusive Circular Student Marketplace
        </Text>
      </View>

      <View className="rounded-3xl bg-surface p-6 shadow-sm border border-borderLight">
        <Text className="text-base font-jakartaBold text-ink mb-1">
          Student Sign In
        </Text>
        <Text className="text-xs font-jakarta text-subtle mb-4">
          Enter your institutional campus email to begin.
        </Text>

        <Text className="text-xs font-jakartaSemibold text-muted mb-1">
          Your Full Name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Student Name"
          placeholderTextColor={colors.subtle}
          className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink mb-3"
        />

        <Text className="text-xs font-jakartaSemibold text-muted mb-1">
          University Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="student@university.edu"
          placeholderTextColor={colors.subtle}
          autoCapitalize="none"
          keyboardType="email-address"
          className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink mb-5"
        />

        <Button
          label="Enter Campus Marketplace"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!email.trim() || !name.trim()}
          onPress={handleSignIn}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
