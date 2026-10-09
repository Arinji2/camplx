import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { colors, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";

/**
 * Settings (design §4.2 Settings; Req 12.4, 15.x). Read-only account summary
 * from the auth store, local preference toggles, and sign-out. The preference
 * switches are device-local for now — they gate what the OS delivers, not a
 * server-side subscription — so they live in component state rather than the
 * profile record.
 */

/** Label-left / value-right row used inside a settings card. */
function SettingRow({
  label,
  children,
  divider,
}: {
  label: string;
  children: ReactNode;
  divider?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${divider ? "border-b border-borderLight" : ""}`}
    >
      <Text className="text-sm font-jakarta text-muted">{label}</Text>
      <View className="ml-4 flex-shrink items-end">{children}</View>
    </View>
  );
}

/** Label + helper on the left, a native `Switch` on the right. */
function ToggleRow({
  label,
  helper,
  value,
  onValueChange,
}: {
  label: string;
  helper: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View className="flex-row items-center px-1 py-3">
      <View className="mr-4 flex-1">
        <Text className="text-sm font-jakartaSemibold text-ink">{label}</Text>
        <Text className="mt-0.5 text-xs font-jakarta text-muted">{helper}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/email" as any);
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Screen header: back affordance + title. */}
      <View className="flex-row items-center px-5 pb-3 pt-14">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={shadows.soft}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-80"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 text-xl font-jakartaExtrabold text-ink">
          Settings
        </Text>
      </View>

      {profile === null ? (
        <EmptyState
          icon="🔐"
          title="You're signed out"
          subtitle="Sign back in to manage your campus account, alerts, and profile."
          action={{
            label: "Sign in",
            onPress: () => router.replace("/(auth)/email" as any),
          }}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {/* Account card */}
          <View
            style={shadows.soft}
            className="rounded-2xl bg-surface px-4 pb-2 pt-3"
          >
            <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle">
              Account
            </Text>

            <SettingRow label="Display name" divider>
              <Text className="text-sm font-jakartaSemibold text-ink">
                {profile.display_name}
              </Text>
            </SettingRow>

            <SettingRow label="Email" divider>
              <Text className="text-sm font-jakartaSemibold text-ink">
                {profile.email}
              </Text>
            </SettingRow>

            <SettingRow label="Campus" divider>
              <Text className="text-sm font-jakartaSemibold text-ink">
                {profile.campus_name}
              </Text>
            </SettingRow>

            <SettingRow label="Student status">
              {profile.verified_student ? (
                <Badge label="Campus verified" tone="success" />
              ) : (
                <Badge label="Unverified" tone="neutral" />
              )}
            </SettingRow>
          </View>

          {/* Notifications card */}
          <View
            style={shadows.soft}
            className="mt-5 rounded-2xl bg-surface px-4 pb-2 pt-3"
          >
            <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle">
              Notifications
            </Text>

            <ToggleRow
              label="Push notifications"
              helper="Reservation & match alerts"
              value={pushEnabled}
              onValueChange={setPushEnabled}
            />

            <View className="h-px bg-borderLight" />

            <ToggleRow
              label="Email digest"
              helper="Weekly campus circularity summary"
              value={emailDigestEnabled}
              onValueChange={setEmailDigestEnabled}
            />
          </View>

          {/* Sign out */}
          <View className="mt-6">
            <Button
              label="Sign out"
              variant="outline"
              size="lg"
              fullWidth
              onPress={handleSignOut}
            />
          </View>

          <Text className="mt-8 text-center text-xs font-jakarta text-subtle">
            CAMPLX · Campus-Exclusive Student Marketplace
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
