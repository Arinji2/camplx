import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MapPin } from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/Skeleton";
import { StatCard } from "@/components/StatCard";
import { shadows } from "@/lib/theme";
import { usePublicProfile, useSellerListings } from "@/hooks/useListings";
import { formatCarbonKg } from "@/utils/format";

/**
 * Public seller profile (design §4.2 Seller Profile, Req 7.4). Reached from a
 * listing card via `/seller/[id]`. Shows a navy hero with the seller's
 * initials, campus and verification badge, a two-stat row (points + carbon
 * saved), then every active listing this seller has on the market.
 *
 * READ-ONLY by design (Req 7.4): two independent queries (`usePublicProfile`
 * for the header stats, `useSellerListings` for the listing grid) hydrate the
 * screen; neither can mutate anything. Dynamic navigation uses an `as any`
 * cast because typed-route generation is pending.
 */

/** Derive "AB" style initials from a display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function SellerProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const profileQuery = usePublicProfile(id);
  const listingsQuery = useSellerListings(id);

  const isLoading = profileQuery.isLoading || listingsQuery.isLoading;
  const isError = profileQuery.isError || listingsQuery.isError;
  const failingQuery = profileQuery.isError ? profileQuery : listingsQuery;

  const profile = profileQuery.data;
  const listings = listingsQuery.data?.listings ?? [];

  return (
    <View className="flex-1 bg-bg">
      {/* Screen header with back chevron. */}
      <View className="px-5 pt-14">
        <View className="mb-4 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface"
            style={shadows.soft}
          >
            <ChevronLeft size={22} color="#0F172A" />
          </Pressable>
          <Text className="text-xl font-jakartaExtrabold text-ink">
            Seller Profile
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {isLoading ? (
          <>
            <Skeleton height={140} radius={28} className="mb-4" />
            <Skeleton height={230} radius={24} className="mb-4" />
            <Skeleton height={230} radius={24} className="mb-4" />
          </>
        ) : isError || !profile ? (
          <EmptyState
            icon="⚠️"
            title="Couldn't load this seller"
            subtitle="The marketplace didn't respond. Try again in a moment."
            action={{ label: "Try again", onPress: () => failingQuery.refetch() }}
          />
        ) : (
          <>
            {/* Navy profile hero. */}
            <View
              style={shadows.card}
              className="mb-4 rounded-card bg-navy p-5"
            >
              <View className="flex-row items-center">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
                  <Text className="text-xl font-jakartaExtrabold text-white">
                    {initials(profile.display_name)}
                  </Text>
                </View>

                <View className="ml-4 flex-1">
                  <Text
                    numberOfLines={1}
                    className="text-lg font-jakartaExtrabold text-white"
                  >
                    {profile.display_name}
                  </Text>

                  <View className="mt-1 flex-row items-center">
                    <MapPin size={13} color="#FFFFFF" />
                    <Text
                      numberOfLines={1}
                      className="ml-1 flex-1 text-xs font-jakartaMedium text-white/70"
                    >
                      📍 {profile.campus_name}
                    </Text>
                  </View>

                  {profile.verified_student ? (
                    <View className="mt-2">
                      <Badge label="Verified student" tone="success" />
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Points + carbon stat row. */}
            <View className="mb-2 flex-row gap-3">
              <StatCard
                label="Points"
                value={profile.points.toString()}
                caption="Earned from handoffs"
              />
              <StatCard
                label="Carbon saved"
                value={formatCarbonKg(profile.cumulative_carbon_g)}
                caption="Directional estimate"
              />
            </View>

            {/* Active listings section. */}
            <Text className="mb-3 mt-6 text-base font-jakartaBold text-ink">
              Active listings
            </Text>

            {listings.length === 0 ? (
              <EmptyState
                icon="🏷️"
                title="No active listings"
                subtitle="This seller has nothing on the market right now."
              />
            ) : (
              <View>
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onPress={() =>
                      router.push("/listing/" + listing.id as any)
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
