import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Heart,
  MessageCircle,
  ShieldCheck,
} from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { DefectAnnotationOverlay } from "@/components/DefectAnnotationOverlay";
import { EmptyState } from "@/components/EmptyState";
import { ListingImagePlaceholder } from "@/components/ListingImagePlaceholder";
import { ReservationActions } from "@/components/ReservationActions";
import { Skeleton } from "@/components/Skeleton";
import { useListing } from "@/hooks/useListings";
import { colors, shadows } from "@/lib/theme";
import { useWishlistStore } from "@/stores/wishlistStore";
import { formatCarbonKg, formatPrice } from "@/utils/format";
import type { DefectItem } from "@/types/api";

export default function ListingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: listing, isLoading, isError, refetch } = useListing(id);

  const [selectedDefect, setSelectedDefect] = useState<DefectItem | null>(null);

  const saved = useWishlistStore((s) => (id ? s.ids.includes(id) : false));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg px-5 pt-14">
        <Skeleton height={280} radius={24} className="mb-4" />
        <Skeleton height={24} width="70%" className="mb-2" />
        <Skeleton height={18} width="40%" className="mb-4" />
        <Skeleton height={100} radius={16} />
      </View>
    );
  }

  if (isError || !listing) {
    return (
      <View className="flex-1 bg-bg pt-14">
        <EmptyState
          icon="📦"
          title="Listing not found"
          subtitle="This item might have been sold, donated, or removed."
          action={{ label: "Go back", onPress: () => router.back() }}
        />
      </View>
    );
  }

  const primaryImage = listing.images[0]?.image_url;
  const defects = listing.inspection?.defects || [];

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Image Hero with Overlays */}
        <View className="relative h-80 w-full bg-borderLight">
          {primaryImage ? (
            <Image
              source={{ uri: primaryImage }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <ListingImagePlaceholder category={listing.category} />
          )}

          {/* AI Defect Annotation Overlay */}
          {defects.length > 0 ? (
            <DefectAnnotationOverlay
              defects={defects}
              selectedDefectId={selectedDefect?.id}
              onSelectDefect={setSelectedDefect}
            />
          ) : null}

          {/* Nav Header Controls */}
          <View className="absolute left-5 right-5 top-12 flex-row justify-between">
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
              style={shadows.soft}
            >
              <ChevronLeft size={22} color={colors.ink} />
            </Pressable>

            <Pressable
              onPress={() => toggleWishlist(listing.id)}
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
              style={shadows.soft}
            >
              <Heart
                size={20}
                color={saved ? colors.primary : colors.ink}
                fill={saved ? colors.primary : "transparent"}
              />
            </Pressable>
          </View>
        </View>

        {/* Selected Defect Info Drawer */}
        {selectedDefect ? (
          <View className="mx-5 -mt-4 rounded-xl bg-amber-50 p-3.5 border border-amber-200">
            <Text className="text-xs font-jakartaBold text-amber-800">
              Defect Found: {selectedDefect.defect_type} (
              {selectedDefect.severity})
            </Text>
            <Text className="mt-1 text-xs font-jakarta text-amber-900">
              {selectedDefect.buyer_note}
            </Text>
          </View>
        ) : null}

        {/* Content Body */}
        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Badge label={listing.category.toUpperCase()} tone="category" />
            <Badge label={listing.condition} tone="condition" />
            {listing.inspection ? (
              <View className="flex-row items-center rounded-full bg-green-50 px-2 py-0.5 border border-green-200">
                <ShieldCheck size={12} color={colors.primaryDark} />
                <Text className="ml-1 text-[11px] font-jakartaBold text-green-700">
                  AI Inspected
                </Text>
              </View>
            ) : null}
          </View>

          <Text className="text-xl font-jakartaExtrabold text-ink">
            {listing.title}
          </Text>

          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-2xl font-jakartaExtrabold text-ink">
              {formatPrice(listing.asking_price)}
            </Text>
            {listing.carbon_savings_g ? (
              <Text className="text-xs font-jakartaBold text-primaryDark">
                🌱 {formatCarbonKg(listing.carbon_savings_g)} CO₂e Avoided
              </Text>
            ) : null}
          </View>

          {/* Description */}
          {listing.description ? (
            <View className="mt-4 pt-4 border-t border-borderLight">
              <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle mb-1">
                Description
              </Text>
              <Text className="text-sm font-jakarta text-ink leading-5">
                {listing.description}
              </Text>
            </View>
          ) : null}

          {/* Technical Specs */}
          {listing.technical_specifications &&
          Object.keys(listing.technical_specifications).length > 0 ? (
            <View className="mt-4 pt-4 border-t border-borderLight">
              <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle mb-2">
                Specifications
              </Text>
              {Object.entries(listing.technical_specifications).map(
                ([key, val]) => (
                  <View
                    key={key}
                    className="flex-row justify-between py-1.5 border-b border-borderLight"
                  >
                    <Text className="text-xs font-jakarta text-muted">
                      {key}
                    </Text>
                    <Text className="text-xs font-jakartaBold text-ink">
                      {val}
                    </Text>
                  </View>
                ),
              )}
            </View>
          ) : null}

          {/* Seller Card */}
          <Pressable
            onPress={() => router.push(`/seller/${listing.seller_id}` as any)}
            className="mt-5 flex-row items-center rounded-2xl bg-surface p-4 border border-borderLight"
            style={shadows.soft}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Text className="text-sm font-jakartaBold text-white">
                {listing.seller_name?.[0]?.toUpperCase() || "S"}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-jakartaBold text-ink">
                {listing.seller_name}
              </Text>
              <Text className="text-xs font-jakarta text-muted">
                Campus Seller · Tap for profile
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/chat" as any)}
              className="h-9 w-9 items-center justify-center rounded-full bg-borderLight"
            >
              <MessageCircle size={18} color={colors.ink} />
            </Pressable>
          </Pressable>
        </View>

        {/* Pickup Hold & Reservation Actions */}
        <ReservationActions listing={listing} />
      </ScrollView>
    </View>
  );
}
