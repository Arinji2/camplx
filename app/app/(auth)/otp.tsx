import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck, Sparkles } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/Button";
import { colors, gradients, shadows } from "@/lib/theme";
import { DEMO_CAMPUS, DEMO_USER } from "@/lib/database";
import { useAuthStore } from "@/stores/authStore";

const CODE_INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-center text-2xl font-jakartaBold tracking-widest text-ink";

const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter any 6-digit code (e.g. 123456)"),
});

type OtpForm = z.infer<typeof otpSchema>;

export default function OtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "123456" },
  });

  function enterApp(userEmail?: string) {
    const actingEmail = userEmail || email || DEMO_USER.email;
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

  async function onSubmit({ code: _code }: OtpForm) {
    if (submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      // In demo mode: accept any 6 digits and enter immediately
      enterApp(email);
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
          {/* Branded header */}
          <View className="mb-8 items-center">
            <LinearGradient
              colors={gradients.authHeader as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={shadows.card}
              className="h-20 w-20 items-center justify-center rounded-3xl"
            >
              <ShieldCheck size={38} color={colors.surface} />
            </LinearGradient>
            <Text className="mt-5 text-3xl font-jakartaExtrabold text-ink">
              Enter your code
            </Text>
            <Text className="mt-2 text-center text-base font-jakarta text-muted">
              Demo code is auto-filled below for{"\n"}
              <Text className="font-jakartaBold text-ink">
                {email || DEMO_USER.email}
              </Text>
            </Text>
          </View>

          {/* Code field */}
          <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
            Verification Code
          </Text>
          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={CODE_INPUT_CLASS}
                placeholder="123456"
                placeholderTextColor={colors.subtle}
                keyboardType="number-pad"
                maxLength={6}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                editable={!submitting}
              />
            )}
          />
          {errors.code ? (
            <Text className="mt-1.5 text-sm font-jakartaMedium text-danger-text">
              {errors.code.message}
            </Text>
          ) : null}
          {notice ? (
            <Text className="mt-2 text-sm font-jakartaMedium text-green-700">
              {notice}
            </Text>
          ) : null}

          {/* Verify code */}
          <View className="mt-7">
            <Button
              label="Verify & Enter Marketplace"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={handleSubmit(onSubmit)}
            />
          </View>

          {/* Instant bypass demo button */}
          <View className="mt-3">
            <Button
              label="Instant Demo Access (Skip Code)"
              variant="outline"
              size="lg"
              fullWidth
              icon={<Sparkles size={16} color={colors.primaryDark} />}
              onPress={() => enterApp()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
