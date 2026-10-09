import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  BarChart3,
  ChevronRight,
  ClipboardList,
  Heart,
  Leaf,
  MessageCircle,
  Recycle,
  Settings,
  Sparkles,
} from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/Skeleton";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { useMyListings } from "@/hooks/useListings";
import { DEMO_CAMPUS } from "@/lib/database";
import { colors, gradients, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import type { Profile } from "@/types";
import { formatCarbonKg } from "@/utils/format";

export default function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile) {
    return (
      <View className="flex-1 bg-bg justify-center">
        <EmptyState
          icon="👤"
          title="Campus Member Profile"
          subtitle="Sign in to view your impact and listings."
        />
      </View>
    );
  }

  return <ProfileContent profile={profile} />;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ProfileContent({ profile }: { profile: Profile }) {
  const router = useRouter();
  const {
    data: listings,
    isLoading,
    isError,
    refetch,
  } = useMyListings(profile.id);

  const displayName = profile.display_name || "Aarav Sharma";
  const carbonSaved = formatCarbonKg(profile.cumulative_carbon_g || 24500);
  const itemsReused = (listings ?? []).filter(
    (l) => l.status === "sold" || l.status === "donated",
  ).length;

  return (
    <FlatList
      className="flex-1 bg-bg"
      data={listings ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      contentContainerClassName="px-4 pb-12 pt-12"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View className="mb-4">
          {/* Fixed Unclipped Navy Hero Card */}
          <LinearGradient
            colors={gradients.brandNavy as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[shadows.card, { borderRadius: 24 }]}
            className="overflow-hidden p-5"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-3">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-white/20 border-2 border-white/30 mr-3.5">
                  <Text className="text-xl font-jakartaExtrabold text-white">
                    {initialsOf(displayName)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-xl font-jakartaExtrabold text-white"
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <Text
                    className="text-xs font-jakarta text-white/80"
                    numberOfLines={1}
                  >
                    {profile.email}
                  </Text>
                  <View className="mt-1 flex-row items-center">
                    <View className="h-2 w-2 rounded-full bg-primary mr-1.5" />
                    <Text className="text-[11px] font-jakartaBold text-white/90">
                      DPU Pune Campus Verified
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => router.push("/settings")}
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-2xl bg-white/20 active:opacity-70"
              >
                <Settings size={18} color="#ffffff" />
              </Pressable>
            </View>
          </LinearGradient>

          {/* Campus Circular Impact Card */}
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 380 }}
            style={shadows.card}
            className="my-4 rounded-2xl bg-surface p-4"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-violet-bg">
                  <Sparkles size={14} color={colors.violet.base} />
                </View>
                <Text className="text-sm font-jakartaBold text-ink">
                  Circularity Score
                </Text>
              </View>

              <View className="flex-row items-center rounded-full bg-green-50 px-2.5 py-1">
                <BadgeCheck size={13} color={colors.primary} />
                <Text className="ml-1 text-xs font-jakartaBold text-green-700">
                  Trusted Member
                </Text>
              </View>
            </View>

            {/* Three Equal Metric Columns */}
            <View className="mt-4 flex-row items-stretch border-t border-borderLight pt-3">
              <ImpactMetric
                icon={<Leaf size={16} color={colors.primary} />}
                chipClassName="bg-green-50"
                value={carbonSaved}
                label="CO₂ Diverted"
              />
              <View className="w-px bg-borderLight" />
              <ImpactMetric
                icon={<Recycle size={16} color={colors.violet.base} />}
                chipClassName="bg-violet-bg"
                value={String(itemsReused > 0 ? itemsReused : 3)}
                label="Items Reused"
              />
              <View className="w-px bg-borderLight" />
              <ImpactMetric
                icon={<Sparkles size={16} color={colors.amber.base} />}
                chipClassName="bg-amber-bg"
                value={`${profile.points || 420}`}
                label="Reward Points"
              />
            </View>
          </MotiView>

          {/* Quick Actions Stack */}
          <View className="gap-2.5 pb-2">
            <QuickAction
              icon={<ClipboardList size={18} color={colors.primaryDark} />}
              label="My Reserved Pickups"
              onPress={() => router.push("/reservations")}
            />
            <QuickAction
              icon={<Recycle size={18} color={colors.primaryDark} />}
              label="Campus E-Waste Recovery Hub"
              onPress={() => router.push("/ewaste")}
            />
            <QuickAction
              icon={<Heart size={18} color={colors.primaryDark} />}
              label="Saved Wishlist"
              onPress={() => router.push("/wishlist")}
            />
            <QuickAction
              icon={<BarChart3 size={18} color={colors.primaryDark} />}
              label="Sustainability & Carbon Metrics"
              onPress={() => router.push("/sustainability")}
            />
          </View>

          <Text className="pt-4 text-base font-jakartaBold text-ink">
            My Published Listings
          </Text>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {[0, 1].map((i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="📦"
            title="No Listings Published Yet"
            subtitle="Snap item with camera to list in seconds."
            action={{
              label: "+ Open Camera & List",
              onPress: () => router.push("/listing/create"),
            }}
          />
        )
      }
    />
  );
}

function ImpactMetric({
  icon,
  chipClassName,
  value,
  label,
}: {
  icon: ReactNode;
  chipClassName: string;
  value: string;
  label: string;
}) {
  return (
    <View className="flex-1 items-center px-1">
      <View
        className={`mb-1.5 h-8 w-8 items-center justify-center rounded-full ${chipClassName}`}
      >
        {icon}
      </View>
      <Text
        className="text-base font-jakartaExtrabold text-ink"
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        className="text-[11px] font-jakartaMedium text-muted"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={shadows.soft}
      className="flex-row items-center rounded-2xl bg-surface px-4 py-3 active:opacity-80"
    >
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-green-50">
        {icon}
      </View>
      <Text className="text-sm font-jakartaSemibold text-ink flex-1">
        {label}
      </Text>
      <ChevronRight size={18} color={colors.subtle} />
    </Pressable>
  );
}
