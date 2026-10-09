import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { GraduationCap, Sparkles } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/Button";
import { colors, gradients, shadows } from "@/lib/theme";
import { DEMO_CAMPUS, DEMO_USER } from "@/lib/database";
import { useAuthStore } from "@/stores/authStore";

const INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink";

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your institutional email")
    .email("Enter a valid email address"),
});

type EmailForm = z.infer<typeof emailSchema>;

export default function EmailScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: DEMO_USER.email },
  });

  function enterDemoMode(email?: string) {
    const actingEmail = email || DEMO_USER.email;
    useAuthStore.getState().setProfile({
      id: DEMO_USER.id,
      email: actingEmail,
      verified_student: true,
      campus_id: DEMO_CAMPUS.id,
      display_name: actingEmail.split("@")[0] || DEMO_USER.display_name,
      points: DEMO_USER.points,
      cumulative_carbon_g: DEMO_USER.cumulative_carbon_g,
    });
    useAuthStore.getState().setStatus("authenticated");
    router.replace("/(tabs)");
  }

  async function onSubmit({ email }: EmailForm) {
    setSubmitting(true);
    try {
      router.push({
        pathname: "/(auth)/otp",
        params: { email: email.trim().toLowerCase() },
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-8 items-center">
            <LinearGradient
              colors={gradients.authHeader as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={shadows.card}
              className="h-20 w-20 items-center justify-center rounded-3xl"
            >
              <GraduationCap size={38} color={colors.surface} />
            </LinearGradient>
            <Text className="mt-5 text-3xl font-jakartaExtrabold text-ink">
              CAMPLX
            </Text>
            <Text className="mt-2 text-center text-base font-jakarta text-muted">
              Campus-Exclusive Student Marketplace
            </Text>
          </View>

          {/* Email field */}
          <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
            Institutional Email
          </Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={INPUT_CLASS}
                placeholder="you@university.edu"
                placeholderTextColor={colors.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                editable={!submitting}
              />
            )}
          />
          {errors.email ? (
            <Text className="mt-1.5 text-sm font-jakartaMedium text-danger-text">
              {errors.email.message}
            </Text>
          ) : null}

          {/* Primary Action: Send Code */}
          <View className="mt-7">
            <Button
              label="Continue with Email"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={handleSubmit(onSubmit)}
            />
          </View>

          {/* One-Tap Demo Mode Button */}
          <View className="mt-3">
            <Button
              label="Instant Demo Access (Aarav Sharma)"
              variant="outline"
              size="lg"
              fullWidth
              icon={<Sparkles size={16} color={colors.primaryDark} />}
              onPress={() => enterDemoMode()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
