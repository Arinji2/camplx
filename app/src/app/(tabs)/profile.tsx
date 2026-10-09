import type { ComponentType } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  Heart,
  PackageCheck,
  Recycle,
  Settings as SettingsIcon,
  Sparkles,
  Trophy,
} from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { ListingCard } from "@/components/ListingCard";
import { StatCard } from "@/components/StatCard";
import { useMyListings } from "@/hooks/useListings";
import { colors, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import { formatCarbonKg } from "@/utils/format";

function MenuRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={shadows.soft}
      className="mb-2.5 flex-row items-center rounded-2xl bg-surface p-4 active:opacity-80"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-borderLight mr-3">
        <Icon size={20} color={colors.ink} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-jakartaBold text-ink">{title}</Text>
        {subtitle ? (
          <Text className="text-xs font-jakarta text-muted">{subtitle}</Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.subtle} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const myListingsQuery = useMyListings(profile?.id);
  const myListings = myListingsQuery.data ?? [];

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-5 pt-14 pb-3 flex-row items-center justify-between">
        <Text className="text-xl font-jakartaExtrabold text-ink">
          My Campus Account
        </Text>
        <Pressable
          onPress={() => router.push("/settings" as any)}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          style={shadows.soft}
        >
          <SettingsIcon size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navy Hero Card */}
        <View style={shadows.card} className="mb-4 rounded-card bg-navy p-5">
          <View className="flex-row items-center">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Text className="text-xl font-jakartaExtrabold text-white">
                {profile?.display_name
                  ?.split(" ")
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase() || "ST"}
              </Text>
            </View>
            <View className="ml-3.5 flex-1">
              <Text
                className="text-base font-jakartaBold text-white"
                numberOfLines={1}
              >
                {profile?.display_name || "Campus Student"}
              </Text>
              <Text
                className="text-xs font-jakarta text-white/70"
                numberOfLines={1}
              >
                {profile?.email}
              </Text>
              <View className="mt-2 flex-row items-center">
                <Badge label="Verified Student" tone="success" />
              </View>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View className="mb-5 flex-row gap-3">
          <StatCard
            label="Points"
            value={String(profile?.points || 0)}
            caption="Earned from handoffs"
          />
          <StatCard
            label="CO₂ Saved"
            value={formatCarbonKg(profile?.cumulative_carbon_g || 0)}
            caption="Directional estimate"
          />
        </View>

        {/* Quick Navigation Menu */}
        <Text className="mb-2 text-xs font-jakartaBold uppercase tracking-wide text-subtle">
          Circularity & Orders
        </Text>
        <MenuRow
          icon={PackageCheck}
          title="My Reserved Pickups"
          subtitle="Items you have held for offline pickup"
          onPress={() => router.push("/reservations" as any)}
        />
        <MenuRow
          icon={Heart}
          title="Saved Wishlist"
          subtitle="Bookmarked campus listings"
          onPress={() => router.push("/wishlist" as any)}
        />
        <MenuRow
          icon={Recycle}
          title="E-Waste Collection"
          subtitle="Recycle dead batteries, laptops & cables"
          onPress={() => router.push("/ewaste" as any)}
        />
        <MenuRow
          icon={Sparkles}
          title="Sustainability Impact"
          subtitle="Personal & campus carbon footprint"
          onPress={() => router.push("/sustainability" as any)}
        />
        <MenuRow
          icon={Trophy}
          title="Campus Leaderboard"
          subtitle="Top sustainability champions"
          onPress={() => router.push("/leaderboard" as any)}
        />

        {/* My Listings */}
        <Text className="mb-3 mt-6 text-base font-jakartaBold text-ink">
          My Active Listings ({myListings.length})
        </Text>
        {myListings.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-border p-6 items-center">
            <Text className="text-xs font-jakarta text-muted">
              You have no active listings.
            </Text>
          </View>
        ) : (
          myListings.map((item) => <ListingCard key={item.id} listing={item} />)
        )}
      </ScrollView>
    </View>
  );
}
