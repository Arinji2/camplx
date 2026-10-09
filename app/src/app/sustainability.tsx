import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Leaf, Recycle, Users } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { StatCard } from "@/components/StatCard";
import { sustainabilityApi } from "@/api";
import { colors, gradients, shadows } from "@/lib/theme";

/**
 * Sustainability dashboard (design §4.2 Sustainability, Req 6.4, 6.6). A
 * read-only view of the student's directional CO₂e impact plus a campus-wide
 * rollup, a local per-category breakdown of where the savings come from, and
 * the methodology note the gateway returns so the figures are never presented
 * as exact science.
 *
 * All numbers are directional estimates — the hero and stat cards label them
 * as such (Req 6.6). No location or database access happens here; the whole
 * screen is a single `GET /sustainability/summary` query.
 */

/** Local illustrative breakdown of the personal savings by item category. */
const SAVINGS_BREAKDOWN: { label: string; kg: number }[] = [
  { label: "Cycles", kg: 90 },
  { label: "Electronics", kg: 24.5 },
  { label: "Furniture", kg: 12 },
  { label: "Books & notes", kg: 6 },
];

export default function SustainabilityScreen() {
  const router = useRouter();

  const summaryQuery = useQuery({
    queryKey: ["sustainability"],
    queryFn: () => sustainabilityApi.getSustainabilitySummary(),
  });

  const summary = summaryQuery.data;

  // Widest bar sets the scale so the tallest fill always renders at 100%.
  const maxKg = Math.max(...SAVINGS_BREAKDOWN.map((row) => row.kg), 1);

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
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
          <View>
            <Text className="text-xl font-jakartaExtrabold text-ink">
              Sustainability & Carbon
            </Text>
            <Text className="text-xs font-jakarta text-muted">
              Your directional CO₂e impact
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {summaryQuery.isLoading ? (
          <>
            <Skeleton height={200} radius={28} className="mb-4" />
            <Skeleton height={84} radius={16} className="mb-3" />
            <Skeleton height={84} radius={16} className="mb-3" />
            <Skeleton height={84} radius={16} className="mb-3" />
          </>
        ) : summaryQuery.isError || !summary ? (
          <EmptyState
            icon="⚠️"
            title="Couldn't load your impact"
            subtitle="The sustainability service didn't respond. Try again in a moment."
            action={{ label: "Try again", onPress: () => summaryQuery.refetch() }}
            tone="green"
          />
        ) : (
          <>
            {/* Hero — gradient banner with the headline personal figure. */}
            <LinearGradient
              colors={gradients.greenBanner as unknown as [string, string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={shadows.card}
              className="mb-4 rounded-card p-5"
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Leaf size={24} color="#FFFFFF" />
              </View>

              <Text className="mt-4 text-3xl font-jakartaExtrabold text-white">
                {summary.personal_carbon_kg.toFixed(1)} kg
              </Text>
              <Text className="mt-1 text-sm font-jakartaMedium text-white/70">
                CO₂e avoided by you
              </Text>
              <Text className="mt-2 text-xs font-jakarta text-white/60">
                Directional estimate
              </Text>
            </LinearGradient>

            {/* Row of three stat cards. */}
            <View className="mb-5 flex-row gap-3">
              <StatCard
                label="Items reused"
                value={String(summary.items_reused_count)}
                icon={<Users size={14} color={colors.primaryDark} />}
              />
              <StatCard
                label="E-waste"
                value={`${summary.ewaste_diverted_kg.toFixed(1)} kg`}
                caption="Diverted"
                icon={<Recycle size={14} color={colors.primaryDark} />}
              />
            </View>
            <View className="mb-5 flex-row">
              <StatCard
                label="Campus total"
                value={`${summary.campus_carbon_kg.toLocaleString("en-IN")} kg`}
                caption="CO₂e avoided across campus"
              />
            </View>

            {/* Listing breakdown bars. */}
            <View className="mb-4 rounded-2xl bg-surface p-4" style={shadows.soft}>
              <Text className="mb-4 text-base font-jakartaBold text-ink">
                Where your savings come from
              </Text>

              {SAVINGS_BREAKDOWN.map((row) => (
                <View key={row.label} className="mb-3">
                  <View className="mb-1.5 flex-row items-center justify-between">
                    <Text className="text-sm font-jakartaSemibold text-ink">
                      {row.label}
                    </Text>
                    <Text className="text-xs font-jakartaBold text-primaryDark">
                      {row.kg.toFixed(1)} kg
                    </Text>
                  </View>
                  <View className="h-2.5 overflow-hidden rounded-full bg-borderLight">
                    <View
                      style={{
                        width: `${Math.min(100, (row.kg / maxKg) * 100)}%`,
                      }}
                      className="h-2.5 rounded-full bg-primary"
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Methodology note. */}
            <View className="rounded-2xl bg-blue-bg p-4">
              <Text className="font-jakarta text-xs leading-5 text-blue-text">
                {summary.methodology_note}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
