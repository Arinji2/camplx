import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Trophy } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { sustainabilityApi } from "@/api";
import { colors, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import { formatCarbonKg } from "@/utils/format";
import type { LeaderboardStandingItem } from "@/types/api";

/**
 * Campus leaderboard (design §4.2 Leaderboard, Req 6.5). A single
 * `GET /leaderboard` query renders a 2nd / 1st / 3rd podium for the top three
 * students followed by the remaining ranked rows. The signed-in student's own
 * row (matched on `user_id` against the auth store profile) is highlighted so
 * the current user can spot themselves without scanning.
 *
 * Presentational only — points are awarded server-side when a handoff
 * completes, so nothing on this screen mutates state.
 */

/** Derive "AB" style initials from a display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type PodiumPlace = 1 | 2 | 3;

const PLACE_CONFIG: Record<
  PodiumPlace,
  { medal: string; barHeight: number; barClass: string }
> = {
  1: { medal: "🥇", barHeight: 64, barClass: "bg-primary" },
  2: { medal: "🥈", barHeight: 48, barClass: "bg-green-300" },
  3: { medal: "🥉", barHeight: 36, barClass: "bg-amber-base" },
};

/** One podium column: medal, initials circle, name, points, colored bar. */
function PodiumColumn({
  item,
  place,
}: {
  item: LeaderboardStandingItem | undefined;
  place: PodiumPlace;
}) {
  if (!item) return <View className="flex-1" />;

  const config = PLACE_CONFIG[place];
  const isFirst = place === 1;
  const circleSize = isFirst ? 56 : 44;

  return (
    <View className="flex-1 items-center">
      <Text className="mb-1 text-base">{config.medal}</Text>

      <View
        style={[
          isFirst ? undefined : shadows.soft,
          { width: circleSize, height: circleSize, borderRadius: 999 },
        ]}
        className={`items-center justify-center ${
          isFirst ? "bg-primary" : "bg-surface"
        }`}
      >
        <Text
          className={`font-jakartaExtrabold ${
            isFirst ? "text-white" : "text-ink"
          }`}
        >
          {initials(item.display_name)}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        className="mt-2 w-full text-center text-xs font-jakartaBold text-ink"
      >
        {item.display_name}
      </Text>
      <Text className="mt-0.5 text-[11px] font-jakartaSemibold text-primaryDark">
        {item.points} pts
      </Text>

      {/* Colored podium bar — taller for a higher rank; items-end aligns the
          columns' bottoms so the bars read like a real podium. */}
      <View
        style={{ height: config.barHeight }}
        className={`mt-2 w-full rounded-t-xl ${config.barClass}`}
      />
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.profile)?.id;

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => sustainabilityApi.getCampusLeaderboard(),
  });

  const standings = leaderboardQuery.data ?? [];

  // Podium order is 2nd / 1st / 3rd so the winner sits in the middle.
  const byRank = (rank: number) =>
    standings.find((item) => item.rank === rank);
  const first = byRank(1) ?? standings[0];
  const second = byRank(2) ?? standings[1];
  const third = byRank(3) ?? standings[2];
  const podiumIds = new Set(
    [first, second, third].filter(Boolean).map((i) => i!.user_id),
  );
  const rest = standings.filter((item) => !podiumIds.has(item.user_id));

  return (
    <View className="flex-1 bg-bg">
      {/* Screen header with back chevron + trophy. */}
      <View className="px-5 pt-14">
        <View className="mb-4 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface"
            style={shadows.soft}
          >
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-row items-center">
            <Trophy size={20} color={colors.amber.base} />
            <Text className="ml-2 text-xl font-jakartaExtrabold text-ink">
              Campus Leaderboard
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {leaderboardQuery.isLoading ? (
          <>
            <Skeleton height={64} radius={16} className="mb-2.5" />
            <Skeleton height={64} radius={16} className="mb-2.5" />
            <Skeleton height={64} radius={16} className="mb-2.5" />
            <Skeleton height={64} radius={16} className="mb-2.5" />
            <Skeleton height={64} radius={16} className="mb-2.5" />
            <Skeleton height={64} radius={16} className="mb-2.5" />
          </>
        ) : leaderboardQuery.isError ? (
          <EmptyState
            icon="🏆"
            title="Couldn't load the leaderboard"
            subtitle="The standings service didn't respond. Try again in a moment."
            action={{ label: "Try again", onPress: () => leaderboardQuery.refetch() }}
          />
        ) : standings.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="No standings yet"
            subtitle="The podium fills up once students start completing handoffs."
            action={{ label: "Try again", onPress: () => leaderboardQuery.refetch() }}
          />
        ) : (
          <>
            {/* Top-three podium. */}
            <View className="mb-6 flex-row items-end justify-between gap-3">
              <PodiumColumn item={second} place={2} />
              <PodiumColumn item={first} place={1} />
              <PodiumColumn item={third} place={3} />
            </View>

            {/* Remaining ranked rows. */}
            {rest.map((item) => {
              const isMe = item.user_id === currentUserId;
              return (
                <View
                  key={item.user_id}
                  style={shadows.soft}
                  className={`mb-2.5 flex-row items-center rounded-2xl p-4 ${
                    isMe ? "border border-primary bg-green-50" : "bg-surface"
                  }`}
                >
                  <Text className="w-6 text-sm font-jakartaExtrabold text-subtle">
                    {item.rank}
                  </Text>

                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-violet-bg">
                    <Text className="font-jakartaBold text-violet-text">
                      {initials(item.display_name)}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-jakartaBold text-ink"
                    >
                      {item.display_name}
                    </Text>
                    <Text className="mt-0.5 text-xs font-jakarta text-muted">
                      {formatCarbonKg(item.carbon_saved_kg)} saved
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-base font-jakartaExtrabold text-ink">
                      {item.points}
                    </Text>
                    <Text className="text-[10px] font-jakarta uppercase text-subtle">
                      pts
                    </Text>
                  </View>
                </View>
              );
            })}

            <Text className="mt-4 text-center text-xs font-jakarta text-subtle">
              Points are awarded when a handoff completes.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
