import type { ReactNode } from "react";
import { useEffect } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { useListingsByIds } from "@/hooks/useListings";
import { colors, shadows } from "@/lib/theme";
import { useWishlistStore } from "@/stores/wishlistStore";
import type { ListingSummary } from "@/types/api";

/**
 * Saved Wishlist. The id list lives in the Zustand wishlist store (optimistic,
 * persisted); on mount it is reconciled with the server so a reinstall or a
 * second device picks up the bookmarks it already owns. Each id is resolved
 * into a summary via `useListingsByIds` and rendered with the standard
 * `ListingCard`, so hearts flip inline and removals disappear on the next
 * resolution pass.
 */
export default function WishlistScreen() {
  const router = useRouter();

  const ids = useWishlistStore((s) => s.ids);
  const loadFromServer = useWishlistStore((s) => s.loadFromServer);

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  const { data, isLoading, isError, refetch } = useListingsByIds(ids);

  const renderCard = ({ item }: ListRenderItemInfo<ListingSummary>) => (
    <ListingCard
      listing={item}
      onPress={() => router.push("/listing/" + item.id as any)}
    />
  );

  let body: ReactNode;

  if (ids.length === 0) {
    body = (
      <EmptyState
        icon="💚"
        title="Nothing saved yet"
        subtitle="Tap the heart on any listing to keep it here for later."
        tone="green"
        action={{
          label: "Find something useful",
          onPress: () => router.replace("/(tabs)" as any),
        }}
      />
    );
  } else if (isLoading) {
    body = (
      <View className="px-5 pt-2">
        <ListingCardSkeleton />
        <ListingCardSkeleton />
        <ListingCardSkeleton />
      </View>
    );
  } else if (isError) {
    body = (
      <EmptyState
        icon="⚠️"
        title="Couldn't load your saves"
        subtitle="We couldn't resolve your saved listings right now. Try again in a moment."
        action={{ label: "Try again", onPress: () => refetch() }}
      />
    );
  } else {
    body = (
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          paddingTop: 8,
        }}
      />
    );
  }

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
          Saved Wishlist
        </Text>
      </View>

      {body}
    </View>
  );
}
