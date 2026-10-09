import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Bell, Heart, MessageCircle, Plus } from "lucide-react-native";

import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { flattenFeed, useFeed } from "@/hooks/useListings";
import { colors, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";

const CATEGORIES = [
  { id: "all", label: "All Items", icon: "✨" },
  { id: "electronics", label: "Electronics", icon: "💻" },
  { id: "cycles", label: "Cycles", icon: "🚲" },
  { id: "books", label: "Books", icon: "📚" },
  { id: "hostel_essentials", label: "Hostel", icon: "🛋️" },
  { id: "furniture", label: "Furniture", icon: "🪑" },
];

export default function FeedScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
  } = useFeed();

  const allItems = flattenFeed(data);
  const filteredItems =
    selectedCategory === "all"
      ? allItems
      : allItems.filter((i) => i.category === selectedCategory);

  return (
    <View className="flex-1 bg-bg">
      {/* Top Header */}
      <View className="bg-surface px-5 pb-3 pt-14 border-b border-borderLight">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1 mr-3">
            <Text className="text-xl font-jakartaExtrabold text-ink">
              Hi, {profile?.display_name?.split(" ")[0] || "Student"} 👋
            </Text>
            <Text
              className="text-xs font-jakartaMedium text-primaryDark"
              numberOfLines={1}
            >
              📍 {profile?.campus_name || "Campus Marketplace"}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push("/wishlist" as any)}
              className="h-10 w-10 items-center justify-center rounded-full bg-borderLight"
              accessibilityLabel="Wishlist"
            >
              <Heart size={18} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/chat" as any)}
              className="h-10 w-10 items-center justify-center rounded-full bg-borderLight"
              accessibilityLabel="Messages"
            >
              <MessageCircle size={18} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/notifications" as any)}
              className="h-10 w-10 items-center justify-center rounded-full bg-borderLight"
              accessibilityLabel="Notifications"
            >
              <Bell size={18} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        {/* Read-only search bar that routes to search tab */}
        <SearchBar
          readOnly
          placeholder="Search campus electronics, cycles, books..."
          onPress={() => router.push("/(tabs)/search" as any)}
        />
      </View>

      {/* Horizontal Category Chips */}
      <View className="py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={cat.label}
              icon={cat.icon}
              active={selectedCategory === cat.id}
              onPress={() => setSelectedCategory(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Feed List */}
      {isLoading ? (
        <View className="px-5 pt-2">
          <ListingCardSkeleton />
          <ListingCardSkeleton />
          <ListingCardSkeleton />
        </View>
      ) : isError ? (
        <EmptyState
          icon="⚠️"
          title="Couldn't load feed"
          subtitle="Check your campus connection and try again."
          action={{ label: "Retry", onPress: () => refetch() }}
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No listings in this category"
          subtitle="Be the first student to post an item!"
          action={{
            label: "Create a Listing",
            onPress: () => router.push("/create" as any),
          }}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (hasNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Floating Action Button: Post Listing */}
      <Pressable
        onPress={() => router.push("/create" as any)}
        style={[
          shadows.floating,
          { position: "absolute", bottom: 20, right: 20 },
        ]}
        className="flex-row items-center rounded-full bg-primary px-5 py-3.5 active:opacity-90"
        accessibilityLabel="Post new item"
      >
        <Plus size={20} color="#ffffff" />
        <Text className="ml-2 font-jakartaBold text-sm text-white">
          Sell or Donate
        </Text>
      </Pressable>
    </View>
  );
}
