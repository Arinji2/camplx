import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  ChevronRight,
  Leaf,
  LogOut,
  Plus,
  Recycle,
  Sparkles,
} from "lucide-react-native";

import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { flattenFeed, useFeed } from "@/hooks/useListings";
import { supabase } from "@/lib/supabase";
import { colors, gradients, shadows } from "@/lib/theme";
import { signOut } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { formatCarbonKg } from "@/utils/format";

/** Emoji glyphs for the browse chips. */
const CATEGORY_ICONS: Record<string, string> = {
  books: "📚",
  electronics: "💻",
  furniture: "🛋️",
  hostel_essentials: "🧺",
  cycles: "🚲",
};

export default function FeedScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const reset = useAuthStore((s) => s.reset);

  const [campusName, setCampusName] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();

  const listings = flattenFeed(data);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!profile?.campus_id) {
        if (active) setCampusName(null);
        return;
      }
      const { data: campus } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", profile.campus_id)
        .maybeSingle();
      if (!active) return;
      setCampusName((campus?.name as string | undefined) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [profile?.campus_id]);

  async function onSignOut() {
    await signOut();
    reset();
  }

  const carbonSaved = formatCarbonKg(profile?.cumulative_carbon_g);
  const rewardPoints = String(profile?.points ?? 0);

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="flex-row items-start justify-between px-5 pb-4 pt-14">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-jakartaMedium text-muted">
            Good day 👋
          </Text>
          <Text
            className="mt-1 text-2xl font-jakartaExtrabold text-ink"
            numberOfLines={2}
          >
            Find something useful today.
          </Text>
          {campusName && (
            <Text className="mt-0.5 text-xs font-jakartaBold text-primaryDark">
              📍 {campusName}
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {/* Notification bell */}
          <View>
            <Pressable
              style={shadows.soft}
              className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:opacity-70"
              onPress={() => router.push("/notifications")}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Bell size={20} color={colors.ink} />
            </Pressable>
            <View className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-violet-base" />
          </View>

          {/* Sign out */}
          <Pressable
            style={shadows.soft}
            className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:opacity-70"
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <LogOut size={18} color={colors.muted} />
          </Pressable>

          {/* Create listing */}
          <Pressable
            style={shadows.soft}
            className="h-11 w-11 items-center justify-center rounded-full bg-ink active:opacity-80"
            onPress={() => router.push("/listing/create")}
            accessibilityRole="button"
            accessibilityLabel="Create a listing"
          >
            <Plus size={22} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      <FeedBody
        isLoading={isLoading}
        isError={isError}
        listings={listings}
        onRetry={() => refetch()}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        isFetchingNextPage={isFetchingNextPage}
        onOpenSearch={() => router.push("/(tabs)/search")}
        onCreate={() => router.push("/listing/create")}
        onOpenSustainability={() => router.push("/sustainability")}
        onOpenEwaste={() => router.push("/ewaste")}
        carbonSaved={carbonSaved}
        rewardPoints={rewardPoints}
      />
    </View>
  );
}

type FeedBodyProps = {
  isLoading: boolean;
  isError: boolean;
  listings: ReturnType<typeof flattenFeed>;
  onRetry: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  onOpenSearch: () => void;
  onCreate: () => void;
  onOpenSustainability: () => void;
  onOpenEwaste: () => void;
  carbonSaved: string;
  rewardPoints: string;
};

function FeedBody({
  isLoading,
  isError,
  listings,
  onRetry,
  onEndReached,
  isFetchingNextPage,
  onOpenSearch,
  onCreate,
  onOpenSustainability,
  onOpenEwaste,
  carbonSaved,
  rewardPoints,
}: FeedBodyProps) {
  const header = (
    <View>
      {/* Search field */}
      <SearchBar
        readOnly
        placeholder="Search books, cycles, calculators…"
        onPress={onOpenSearch}
      />

      {/* Sustainability & Rewards stat cards */}
      <View className="mt-5 flex-row items-stretch gap-3">
        <Pressable
          onPress={onOpenSustainability}
          style={shadows.card}
          className="flex-1 overflow-hidden rounded-card active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel="View your sustainability impact"
        >
          <View
            style={shadows.soft}
            className="flex-1 rounded-card bg-black p-4"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <Leaf size={18} color={colors.primary} />
            </View>
            <Text
              className="mt-2.5 text-xl font-jakartaExtrabold text-white"
              numberOfLines={1}
            >
              {carbonSaved}
            </Text>
            <Text
              className="mt-0.5 text-xs font-jakartaMedium text-white/70"
              numberOfLines={1}
            >
              CO₂ saved
            </Text>
          </View>
        </Pressable>

        <View
          style={shadows.soft}
          className="flex-1 rounded-card bg-surface p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-violet-bg">
            <Sparkles size={18} color={colors.violet.base} />
          </View>
          <Text
            className="mt-2.5 text-xl font-jakartaExtrabold text-ink"
            numberOfLines={1}
          >
            {rewardPoints}
          </Text>
          <Text
            className="mt-0.5 text-xs font-jakartaMedium text-muted"
            numberOfLines={1}
          >
            Reward points
          </Text>
        </View>
      </View>

      {/* Prominent E-Waste Collection Action Banner */}
      <Pressable
        onPress={onOpenEwaste}
        style={shadows.soft}
        className="mt-3 flex-row items-center justify-between rounded-card border border-green-200 bg-green-50/80 p-3.5 active:opacity-85"
      >
        <View className="flex-row items-center flex-1 pr-2">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <Recycle size={20} color={colors.primary} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xs font-jakartaBold text-green-700">
              Campus E-Waste Circularity Hub
            </Text>
            <Text className="text-[11px] font-jakarta text-ink">
              Drop dead laptops, powerbanks & chargers safely
            </Text>
          </View>
        </View>
        <View className="flex-row items-center">
          <Text className="text-xs font-jakartaBold text-primaryDark">
            Drop Off
          </Text>
          <ChevronRight size={16} color={colors.primaryDark} />
        </View>
      </Pressable>

      {/* Category Pills */}
      <View className="mt-5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="pr-1 gap-2"
        >
          <CategoryChip icon="🛍️" label="All" onPress={onOpenSearch} />
          {LISTING_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.value}
              icon={CATEGORY_ICONS[cat.value]}
              label={cat.label}
              onPress={onOpenSearch}
            />
          ))}
        </ScrollView>
      </View>

      <Text className="mb-2 mt-6 text-lg font-jakartaBold text-ink">
        Fresh on campus
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 px-5 pt-2">
        {header}
        <View className="mt-1">
          {[0, 1, 2].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 px-5 pt-2">
        {header}
        <EmptyState
          icon="⚠️"
          title="We couldn't load the feed."
          subtitle="Something went wrong while fetching listings for your campus."
          action={{ label: "Try again", onPress: onRetry }}
        />
      </View>
    );
  }

  if (listings.length === 0) {
    return (
      <View className="flex-1 px-5 pt-2">
        {header}
        <EmptyState
          icon="🌱"
          title="No listings in your campus yet"
          subtitle="Be the first to list something for your campus community."
          action={{ label: "Create a listing", onPress: onCreate }}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      ListHeaderComponent={header}
      contentContainerClassName="px-5 pt-2 pb-8"
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator className="my-4" color={colors.primary} />
        ) : null
      }
    />
  );
}
