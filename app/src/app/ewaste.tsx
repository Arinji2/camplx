import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, MapPin, Package, Recycle } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { StatCard } from "@/components/StatCard";
import { ewasteApi } from "@/api";
import { colors, shadows } from "@/lib/theme";
import { formatCarbonKg } from "@/utils/format";
import type {
  EWasteDeviceCategory,
  EWasteLifecycleStatus,
  EWasteOptimizationPlanResponse,
  EWasteRequestRecord,
  LifecycleCategory,
} from "@/types/api";

/**
 * E-Waste screen (design §4.2 E-Waste, Req 10.x). A three-tab segmented view:
 *
 *  1. Lifecycle Tracking — every submitted pickup request with a tappable
 *     4-stage progression pill row (pending → scheduled → collected →
 *     handed_over). Tapping the NEXT stage advances the lifecycle via the
 *     gateway, so a coordinator can drive a request forward from the field.
 *  2. New Request — a form that posts a `CreateEWasteSubmissionRequest` with a
 *     campus pickup point (lat/lon supplied locally since the app must not use
 *     `expo-location`), a device category, quantity, lifecycle assessment and
 *     a preferred slot.
 *  3. Routing Engine — kicks off the K-Means + TSP optimizer and renders the
 *     resulting per-zone drive sequences.
 */

// ── Local presentation constants ────────────────────────────────────────────

const DEVICE_CATEGORIES: { value: EWasteDeviceCategory; label: string }[] = [
  { value: "laptops_and_computers", label: "Laptops & Motherboards" },
  { value: "batteries_and_power_banks", label: "Swollen Batteries & Power Banks" },
  { value: "chargers_and_cables", label: "Chargers, Cables & Adapters" },
  { value: "printers_and_peripherals", label: "Printers & Peripherals" },
  { value: "audio_and_accessories", label: "Audio & Accessories" },
  { value: "other_electronics", label: "Other Electronics" },
];

const CAMPUS_PICKUP_POINTS = [
  { name: "Tech Block B Collection Station", lat: 18.6251, lon: 73.8198 },
  { name: "Hostel Block 4 Reception", lat: 18.6272, lon: 73.8184 },
  { name: "Library Ground Floor Green Bin", lat: 18.6242, lon: 73.8211 },
  { name: "Mechanical Dept Workshop", lat: 18.6265, lon: 73.8225 },
];

const TIME_SLOTS = [
  "Morning (10:00 AM - 1:00 PM)",
  "Afternoon (2:00 PM - 5:00 PM)",
  "Weekend Saturday Drop-off",
];

const LIFECYCLE_OPTIONS: LifecycleCategory[] = [
  "Reusable",
  "Repairable",
  "End-of-life",
];

/** Ordered lifecycle stages for the progression pill row. */
const STAGES: { status: EWasteLifecycleStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "scheduled", label: "Scheduled" },
  { status: "collected", label: "Collected" },
  { status: "handed_over", label: "Handed over" },
];

type TabKey = "tracking" | "submit" | "optimize";

const TABS: { key: TabKey; label: string }[] = [
  { key: "tracking", label: "Lifecycle Tracking" },
  { key: "submit", label: "New Request" },
  { key: "optimize", label: "Routing Engine" },
];

// ── Small local building blocks ─────────────────────────────────────────────

/** A single selectable pill used by the form rows (category / point / slot). */
function OptionPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${
        selected ? "border-ink bg-ink" : "border-gray-300 bg-white"
      }`}
    >
      <Text
        className={`text-xs font-jakartaSemibold ${
          selected ? "text-white" : "text-gray-700"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The 4-stage progression pill row for one request. A stage is "done" when its
 * index is below the record's current status, "current" when equal, and
 * "upcoming" otherwise. Tapping the immediate next stage advances the record
 * one step forward (no skipping backwards or forwards).
 */
function StageProgression({
  record,
  onAdvance,
  advancing,
}: {
  record: EWasteRequestRecord;
  onAdvance: (status: EWasteLifecycleStatus) => void;
  advancing: boolean;
}) {
  const currentIndex = STAGES.findIndex((s) => s.status === record.status);

  return (
    <View className="mb-3 flex-row flex-wrap">
      {STAGES.map((stage, index) => {
        const isCurrent = index === currentIndex;
        const isDone = !isCurrent && index < currentIndex;
        const isNext = index === currentIndex + 1;

        const containerClass = isDone
          ? "bg-green-600"
          : isCurrent
            ? "bg-primary"
            : "bg-borderLight";
        const textClass = isDone || isCurrent ? "text-white" : "text-subtle";

        return (
          <Pressable
            key={stage.status}
            disabled={!isNext || advancing}
            onPress={() => onAdvance(stage.status)}
            className={`mr-1.5 mb-1.5 rounded-full px-2.5 py-1 ${containerClass}`}
          >
            <Text className={`text-[10px] font-jakartaBold uppercase ${textClass}`}>
              {stage.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function EWasteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("tracking");

  // Tab 1 — lifecycle tracking query.
  const ewasteQuery = useQuery({
    queryKey: ["ewaste"],
    queryFn: () => ewasteApi.listEWasteRequests(),
  });
  const records = ewasteQuery.data ?? [];

  // Advance one lifecycle stage (forward only, enforced in StageProgression).
  const advanceMutation = useMutation({
    mutationFn: (input: { id: string; status: EWasteLifecycleStatus }) =>
      ewasteApi.updateEWasteLifecycleStatus(input.id, { status: input.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ewaste"] });
    },
  });

  // Tab 2 — new request form state.
  const [deviceCategory, setDeviceCategory] = useState<EWasteDeviceCategory>(
    DEVICE_CATEGORIES[0].value,
  );
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [slotIndex, setSlotIndex] = useState(0);
  const [lifecycle, setLifecycle] = useState<LifecycleCategory>("End-of-life");

  const submitMutation = useMutation({
    mutationFn: () =>
      ewasteApi.submitEWasteRequest({
        description: description.trim(),
        device_category: deviceCategory,
        lifecycle_assessment: lifecycle,
        quantity: Number(quantity) || 1,
        latitude: CAMPUS_PICKUP_POINTS[selectedPointIndex].lat,
        longitude: CAMPUS_PICKUP_POINTS[selectedPointIndex].lon,
        location_name: CAMPUS_PICKUP_POINTS[selectedPointIndex].name,
        preferred_slot: TIME_SLOTS[slotIndex],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ewaste"] });
      // Reset the form and jump to the tracking tab so the user sees the new
      // request land in the pipeline.
      setDescription("");
      setQuantity("1");
      setSelectedPointIndex(0);
      setSlotIndex(0);
      setDeviceCategory(DEVICE_CATEGORIES[0].value);
      setLifecycle("End-of-life");
      setActiveTab("tracking");
    },
  });

  // Tab 3 — routing engine state.
  const [plan, setPlan] = useState<EWasteOptimizationPlanResponse | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const runOptimization = async () => {
    setOptimizing(true);
    try {
      const result = await ewasteApi.optimizeEWasteCollectionRoutes(2);
      setPlan(result);
    } finally {
      setOptimizing(false);
    }
  };

  // Summary metrics for the tracking tab.
  const totalDevices = records.reduce((sum, r) => sum + r.quantity, 0);
  const totalCarbonKg = records.reduce(
    (sum, r) => sum + (r.estimated_carbon_kg || 0),
    0,
  );

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
              E-Waste Collection
            </Text>
            <Text className="text-xs font-jakarta text-muted">
              Track, submit & optimize pickups
            </Text>
          </View>
        </View>

        {/* Segmented tab control. */}
        <View className="mb-4 flex-row rounded-xl bg-gray-100 p-1">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={active ? shadows.soft : undefined}
                className={`flex-1 items-center rounded-lg py-2 ${
                  active ? "bg-white" : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-xs font-jakartaBold ${
                    active ? "text-ink" : "text-muted"
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Tab 1: Lifecycle Tracking ─────────────────────────────────── */}
        {activeTab === "tracking" ? (
          <View>
            {ewasteQuery.isLoading ? (
              <>
                <Skeleton height={92} radius={16} className="mb-3" />
                <Skeleton height={92} radius={16} className="mb-3" />
                <Skeleton height={92} radius={16} className="mb-3" />
              </>
            ) : ewasteQuery.isError ? (
              <EmptyState
                icon="⚠️"
                title="Couldn't load your requests"
                subtitle="The collection service didn't respond. Try again in a moment."
                action={{ label: "Try again", onPress: () => ewasteQuery.refetch() }}
                tone="green"
              />
            ) : records.length === 0 ? (
              <EmptyState
                icon="♻️"
                title="No e-waste pickups scheduled"
                subtitle="Dead laptops, power banks and chargers get routed to a certified recycler."
                tone="green"
              />
            ) : (
              <>
                {/* Summary stat cards. */}
                <View className="mb-4 flex-row gap-3">
                  <StatCard
                    label="Total devices"
                    value={String(totalDevices)}
                    caption="Awaiting pickup"
                    icon={<Package size={14} color={colors.primaryDark} />}
                  />
                  <StatCard
                    label="CO₂ diverted"
                    value={formatCarbonKg(totalCarbonKg * 1000)}
                    caption="Directional estimate"
                    icon={<Recycle size={14} color={colors.primaryDark} />}
                  />
                </View>

                {/* One card per request. */}
                {records.map((record) => (
                  <View
                    key={record.id}
                    className="mb-3 rounded-2xl bg-surface p-4"
                    style={shadows.soft}
                  >
                    <StageProgression
                      record={record}
                      advancing={advanceMutation.isPending}
                      onAdvance={(status) =>
                        advanceMutation.mutate({ id: record.id, status })
                      }
                    />

                    <Text
                      className="text-sm font-jakartaBold text-ink"
                      numberOfLines={2}
                    >
                      {record.description}
                    </Text>

                    <View className="mt-2 flex-row items-center">
                      <MapPin size={13} color={colors.subtle} />
                      <Text
                        className="ml-1 flex-1 text-xs font-jakarta text-muted"
                        numberOfLines={1}
                      >
                        {record.location_name}
                      </Text>
                    </View>

                    <Text className="mt-1 text-xs font-jakarta text-muted">
                      {record.preferred_slot}
                    </Text>

                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="text-xs font-jakartaSemibold text-ink">
                        Qty {record.quantity}
                      </Text>
                      <Text className="text-xs font-jakartaSemibold text-primaryDark">
                        {formatCarbonKg(record.estimated_carbon_kg * 1000)} CO₂
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        ) : null}

        {/* ── Tab 2: New Request ────────────────────────────────────────── */}
        {activeTab === "submit" ? (
          <View>
            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              What are you disposing?
            </Text>
            <View className="mb-4 flex-row flex-wrap">
              {DEVICE_CATEGORIES.map((cat) => (
                <OptionPill
                  key={cat.value}
                  label={cat.label}
                  selected={cat.value === deviceCategory}
                  onPress={() => setDeviceCategory(cat.value)}
                />
              ))}
            </View>

            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="e.g. Dell Inspiron with dead motherboard & bulging battery"
              placeholderTextColor={colors.subtle}
              className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink"
              style={{ minHeight: 88, textAlignVertical: "top" }}
            />

            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              Quantity
            </Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={colors.subtle}
              className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink"
            />

            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              Lifecycle assessment
            </Text>
            <View className="mb-4 flex-row flex-wrap">
              {LIFECYCLE_OPTIONS.map((option) => (
                <OptionPill
                  key={option}
                  label={option}
                  selected={option === lifecycle}
                  onPress={() => setLifecycle(option)}
                />
              ))}
            </View>

            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              Pickup point
            </Text>
            <View className="mb-4 flex-row flex-wrap">
              {CAMPUS_PICKUP_POINTS.map((point, index) => (
                <OptionPill
                  key={point.name}
                  label={point.name}
                  selected={index === selectedPointIndex}
                  onPress={() => setSelectedPointIndex(index)}
                />
              ))}
            </View>

            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              Preferred slot
            </Text>
            <View className="mb-6 flex-row flex-wrap">
              {TIME_SLOTS.map((slot, index) => (
                <OptionPill
                  key={slot}
                  label={slot}
                  selected={index === slotIndex}
                  onPress={() => setSlotIndex(index)}
                />
              ))}
            </View>

            <Button
              label="Schedule pickup"
              size="lg"
              fullWidth
              loading={submitMutation.isPending}
              disabled={description.trim().length === 0}
              onPress={() => submitMutation.mutate()}
            />
          </View>
        ) : null}

        {/* ── Tab 3: Routing Engine ─────────────────────────────────────── */}
        {activeTab === "optimize" ? (
          <View>
            <Text className="mb-4 text-sm font-jakarta text-muted">
              Cluster every pending pickup into geographic zones and sequence
              the stops with a nearest-neighbor TSP pass so the driver covers
              campus in the fewest kilometres.
            </Text>

            <Button
              label="Optimize pickup routes"
              size="lg"
              fullWidth
              loading={optimizing}
              onPress={runOptimization}
            />

            {optimizing ? (
              <Text className="mt-4 text-center text-xs font-jakarta text-muted">
                Running K-Means clustering + TSP nearest-neighbor sequencing…
              </Text>
            ) : null}

            {plan ? (
              <View className="mt-5">
                {/* Success banner. */}
                <View className="mb-4 rounded-2xl border border-green-100 bg-green-50 p-4">
                  <Text className="text-sm font-jakartaBold text-green-700">
                    {plan.message}
                  </Text>
                  <Text className="mt-1 text-xs font-jakarta text-green-700">
                    {plan.total_stops_optimized} stops optimized across{" "}
                    {Object.keys(plan.routes_generated).length} zone(s).
                  </Text>
                </View>

                {/* One card per generated zone route. */}
                {Object.entries(plan.routes_generated).map(([zone, stops]) => (
                  <View
                    key={zone}
                    className="mb-3 rounded-2xl bg-surface p-4"
                    style={shadows.soft}
                  >
                    <Text className="text-sm font-jakartaBold text-ink">
                      {zone}
                    </Text>
                    <Text className="mt-0.5 text-xs font-jakarta text-muted">
                      Ordered stops — the numbering is the drive sequence.
                    </Text>
                    <View className="mt-2">
                      {stops.map((stopId, index) => (
                        <View key={`${stopId}-${index}`} className="mb-1.5 flex-row">
                          <Text className="mr-2 text-xs font-jakartaBold text-primaryDark">
                            {index + 1}.
                          </Text>
                          <Text className="flex-1 text-xs font-jakarta text-ink">
                            {stopId}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : !optimizing ? (
              <View className="mt-6">
                <EmptyState
                  icon="🗺️"
                  title="No route plan yet"
                  subtitle="Cluster pending pickups into zones and sequence the stops for the driver."
                  tone="green"
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
