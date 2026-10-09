import { useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";

import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { useSearchListings } from "@/hooks/useListings";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useSearchListings(
    query,
    category,
  );
  const items = data?.items ?? [];

  return (
    <View className="flex-1 bg-bg">
      {/* Header with live SearchBar */}
      <View className="bg-surface px-5 pb-3 pt-14 border-b border-borderLight">
        <Text className="mb-3 text-xl font-jakartaExtrabold text-ink">
          Explore Campus
        </Text>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search by model, brand, or item..."
        />
      </View>

      {/* Category Pills */}
      <View className="py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          <CategoryChip
            label="All"
            active={category === null}
            onPress={() => setCategory(null)}
          />
          {LISTING_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.value}
              label={cat.label}
              active={category === cat.value}
              onPress={() =>
                setCategory(category === cat.value ? null : cat.value)
              }
            />
          ))}
        </ScrollView>
      </View>

      {/* Results View */}
      {isLoading ? (
        <View className="px-5 pt-2">
          <ListingCardSkeleton />
          <ListingCardSkeleton />
          <ListingCardSkeleton />
        </View>
      ) : isError ? (
        <EmptyState
          icon="⚠️"
          title="Search error"
          subtitle="Failed to reach the search index."
          action={{ label: "Retry", onPress: () => refetch() }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No items found"
          subtitle="Try different keywords or browse another category."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
