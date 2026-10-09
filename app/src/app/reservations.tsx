import type { ReactNode } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { useMyReservations } from "@/hooks/useReservation";
import { colors, shadows } from "@/lib/theme";
import type { MyReservationItem, ReservationStatus } from "@/types/api";

/**
 * My Reserved Pickups (design §1.6 Flow 6; Req 13.4). Every reservation the
 * current student holds, newest first, each rendered as the familiar
 * `ListingCard` plus a status pill and the time the hold was placed. Tapping a
 * row opens the listing detail where the handoff can be coordinated.
 */

/**
 * Tiny in-file relative-time helper (the screen contract keeps helpers local
 * rather than adding a shared util file). "just now" → minutes → hours → days,
 * then falls back to an absolute date for older holds.
 */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(then).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** Pill presentation per reservation status (active / released / completed). */
const STATUS_META: Record<ReservationStatus, { label: string; pill: string }> =
  {
    active: { label: "Hold active", pill: "bg-amber-bg text-amber-text" },
    released: { label: "Released", pill: "bg-borderLight text-muted" },
    completed: { label: "Completed", pill: "bg-green-100 text-green-700" },
  };

export default function ReservationsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyReservations();

  const openListing = (item: MyReservationItem) => {
    router.push("/listing/" + item.listing.id as any);
  };

  const renderRow = ({ item }: ListRenderItemInfo<MyReservationItem>) => {
    const status = STATUS_META[item.reservation.status] ?? STATUS_META.active;

    return (
      <View>
        <ListingCard
          listing={item.listing}
          onPress={() => openListing(item)}
        />

        {/* Status pill + relative hold timestamp under the card. */}
        <View className="-mt-2 mb-2 flex-row items-center justify-between px-1">
          <View className={`rounded-full px-2.5 py-1 ${status.pill}`}>
            <Text className="text-xs font-jakartaSemibold">
              {status.label}
            </Text>
          </View>
          <Text className="text-xs font-jakarta text-subtle">
            Reserved {timeAgo(item.reservation.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  let body: ReactNode;

  if (isLoading) {
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
        title="Couldn't load your holds"
        subtitle="We couldn't reach the campus gateway. Check your connection and try again."
        action={{ label: "Try again", onPress: () => refetch() }}
      />
    );
  } else if ((data ?? []).length === 0) {
    body = (
      <EmptyState
        icon="🛒"
        title="No pickups reserved yet"
        subtitle="Reserve an item from the feed to coordinate an offline handoff."
        action={{
          label: "Browse the feed",
          onPress: () => router.replace("/(tabs)" as any),
        }}
      />
    );
  } else {
    body = (
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.reservation.id}
        renderItem={renderRow}
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
          My Reserved Pickups
        </Text>
      </View>

      {body}
    </View>
  );
}
