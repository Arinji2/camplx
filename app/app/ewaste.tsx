import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronLeft,
  Recycle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Plus,
  Sparkles,
  MapPin,
  Laptop,
} from "lucide-react-native";

import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { colors, gradients, shadows } from "@/lib/theme";
import { db, type EwasteRequest, DEMO_USER } from "@/lib/database";

const DEVICE_CATEGORIES = [
  "Laptops & Computers",
  "Smartphones & Tablets",
  "Chargers, Cables & Adapters",
  "Lithium Batteries & Powerbanks",
  "Keyboards, Mice & Peripherals",
  "Other Electronics",
];

const CAMPUS_PICKUP_POINTS = [
  "Main Campus Collection Hub (Tech Block B)",
  "Hostel Block 4 Reception",
  "Library Ground Floor Green Bin",
  "Mechanical Workshop E-Waste Station",
];

const TIME_SLOTS = [
  "Morning (10:00 AM - 1:00 PM)",
  "Afternoon (2:00 PM - 5:00 PM)",
  "Weekend Saturday Drop-off",
];

export default function EWasteScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"tracking" | "submit" | "hub">(
    "tracking",
  );
  const [requests, setRequests] = useState<EwasteRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [deviceType, setDeviceType] = useState(DEVICE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [location, setLocation] = useState(CAMPUS_PICKUP_POINTS[0]);
  const [preferredSlot, setPreferredSlot] = useState(TIME_SLOTS[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    const data = await db.getEwasteRequests();
    setRequests(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function handleSubmit() {
    if (!description.trim()) {
      Alert.alert(
        "Missing Detail",
        "Please enter a brief description of the electronic item.",
      );
      return;
    }

    setSubmitting(true);
    try {
      await db.createEwasteRequest({
        userId: DEMO_USER.id,
        deviceType,
        description: description.trim(),
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        location,
        preferredSlot,
        notes: notes.trim(),
      });

      setDescription("");
      setNotes("");
      await loadData();
      setActiveTab("tracking");
      Alert.alert(
        "Request Submitted",
        "Your e-waste collection request has been scheduled with the campus sustainability desk.",
      );
    } catch {
      Alert.alert("Error", "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function advanceStatus(req: EwasteRequest) {
    const nextStatus: Record<EwasteRequest["status"], EwasteRequest["status"]> =
      {
        submitted: "scheduled",
        scheduled: "collected",
        collected: "recycled",
        recycled: "submitted",
      };
    await db.updateEwasteStatus(req.id, nextStatus[req.status]);
    await loadData();
  }

  const totalDivertedKg = requests.reduce(
    (acc, r) => acc + (r.estimatedCarbonSavingsKg || 0),
    0,
  );
  const collectedCount = requests.filter(
    (r) => r.status === "collected" || r.status === "recycled",
  ).length;

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-14">
        <Pressable
          onPress={goBack}
          style={shadows.soft}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-surface active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-jakartaBold text-ink">
            E-Waste Recovery
          </Text>
          <Text className="text-xs font-jakartaMedium text-muted">
            Safe Campus Circularity
          </Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-green-50">
          <Recycle size={18} color={colors.primary} />
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 py-2">
        <Pressable
          onPress={() => setActiveTab("tracking")}
          className={`mr-2 rounded-xl px-4 py-2 ${
            activeTab === "tracking"
              ? "bg-navy"
              : "bg-surface border border-border"
          }`}
        >
          <Text
            className={`text-xs font-jakartaBold ${
              activeTab === "tracking" ? "text-white" : "text-muted"
            }`}
          >
            My Requests ({requests.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("submit")}
          className={`mr-2 rounded-xl px-4 py-2 ${
            activeTab === "submit"
              ? "bg-navy"
              : "bg-surface border border-border"
          }`}
        >
          <Text
            className={`text-xs font-jakartaBold ${
              activeTab === "submit" ? "text-white" : "text-muted"
            }`}
          >
            + New Pickup
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("hub")}
          className={`rounded-xl px-4 py-2 ${
            activeTab === "hub" ? "bg-navy" : "bg-surface border border-border"
          }`}
        >
          <Text
            className={`text-xs font-jakartaBold ${
              activeTab === "hub" ? "text-white" : "text-muted"
            }`}
          >
            Collection Hub
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <LinearGradient
          colors={gradients.brandNavy as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[shadows.card, { borderRadius: 20 }]}
          className="p-5 mb-4"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-jakartaMedium uppercase tracking-wide text-white/70">
                Certified E-Waste Diversion
              </Text>
              <Text className="mt-1 text-2xl font-jakartaExtrabold text-white">
                {totalDivertedKg.toFixed(1)} kg CO₂e Saved
              </Text>
              <Text className="mt-1 text-xs font-jakarta text-white/80">
                {collectedCount} devices diverted to licensed recyclers.
              </Text>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Laptop size={24} color="#ffffff" />
            </View>
          </View>
        </LinearGradient>

        {/* TAB 1: Tracking */}
        {activeTab === "tracking" && (
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-jakartaBold text-ink">
                Active Pickups
              </Text>
              <Text className="text-xs font-jakarta text-subtle">
                Tap status to advance demo
              </Text>
            </View>

            {requests.length === 0 ? (
              <View
                style={shadows.soft}
                className="rounded-2xl bg-surface p-6 items-center"
              >
                <Recycle size={32} color={colors.primary} />
                <Text className="mt-2 text-base font-jakartaBold text-ink">
                  No e-waste submitted yet
                </Text>
                <Text className="mt-1 text-center text-xs font-jakarta text-muted">
                  Safely dispose of non-working tech, chargers, and batteries.
                </Text>
                <View className="mt-4">
                  <Button
                    label="Schedule Pickup"
                    size="md"
                    onPress={() => setActiveTab("submit")}
                  />
                </View>
              </View>
            ) : (
              requests.map((req) => (
                <View
                  key={req.id}
                  style={shadows.soft}
                  className="mb-3 rounded-2xl bg-surface p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-jakartaBold text-ink">
                        {req.deviceType}
                      </Text>
                      <Text className="mt-1 text-xs font-jakarta text-muted">
                        {req.description}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => advanceStatus(req)}
                      className="active:opacity-80"
                    >
                      <StatusBadge status={req.status} />
                    </Pressable>
                  </View>

                  <View className="mt-3 pt-3 border-t border-borderLight flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <MapPin size={12} color={colors.subtle} />
                      <Text
                        className="ml-1 text-[11px] font-jakartaMedium text-subtle"
                        numberOfLines={1}
                      >
                        {req.location.split("(")[0]}
                      </Text>
                    </View>
                    <Text className="text-[11px] font-jakartaBold text-primaryDark">
                      +{req.estimatedCarbonSavingsKg} kg CO₂e
                    </Text>
                  </View>

                  {/* Lifecycle Tracker */}
                  <View className="mt-3 flex-row items-center justify-between bg-borderLight/60 rounded-xl p-2">
                    <StepItem label="Submitted" done={true} />
                    <View className="h-0.5 flex-1 bg-border" />
                    <StepItem
                      label="Scheduled"
                      done={req.status !== "submitted"}
                    />
                    <View className="h-0.5 flex-1 bg-border" />
                    <StepItem
                      label="Collected"
                      done={
                        req.status === "collected" || req.status === "recycled"
                      }
                    />
                    <View className="h-0.5 flex-1 bg-border" />
                    <StepItem
                      label="Recycled"
                      done={req.status === "recycled"}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 2: Submit Form */}
        {activeTab === "submit" && (
          <View style={shadows.soft} className="rounded-2xl bg-surface p-5">
            {/* Safety Warning */}
            <View className="flex-row items-start rounded-xl bg-amber-50 p-3 mb-4">
              <AlertTriangle size={16} color={colors.amber.base} />
              <Text className="ml-2 flex-1 text-xs font-jakartaMedium text-amber-text">
                Safety First: Do not attempt to dismantle swollen batteries.
                Keep them dry and handle gently.
              </Text>
            </View>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Device Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {DEVICE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setDeviceType(cat)}
                  className={`mr-2 rounded-xl px-3 py-2 ${
                    deviceType === cat ? "bg-navy" : "bg-borderLight"
                  }`}
                >
                  <Text
                    className={`text-xs font-jakartaMedium ${deviceType === cat ? "text-white" : "text-ink"}`}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Device Details & Model
            </Text>
            <TextInput
              className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-jakarta text-ink mb-3"
              placeholder="e.g. Dell Inspiron with dead display & power brick"
              value={description}
              onChangeText={setDescription}
            />

            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-xs font-jakartaSemibold text-muted mb-1">
                  Approx. Quantity
                </Text>
                <TextInput
                  className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-jakarta text-ink"
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
            </View>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Campus Pickup Point
            </Text>
            <View className="mb-3">
              {CAMPUS_PICKUP_POINTS.map((loc) => (
                <Pressable
                  key={loc}
                  onPress={() => setLocation(loc)}
                  className={`mb-1.5 flex-row items-center rounded-xl p-2.5 ${
                    location === loc
                      ? "border border-primary bg-green-50"
                      : "bg-bg"
                  }`}
                >
                  <MapPin
                    size={14}
                    color={location === loc ? colors.primary : colors.subtle}
                  />
                  <Text className="ml-2 flex-1 text-xs font-jakartaMedium text-ink">
                    {loc}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Preferred Time Window
            </Text>
            <View className="mb-4">
              {TIME_SLOTS.map((slot) => (
                <Pressable
                  key={slot}
                  onPress={() => setPreferredSlot(slot)}
                  className={`mb-1.5 flex-row items-center rounded-xl p-2.5 ${
                    preferredSlot === slot
                      ? "border border-primary bg-green-50"
                      : "bg-bg"
                  }`}
                >
                  <Clock
                    size={14}
                    color={
                      preferredSlot === slot ? colors.primary : colors.subtle
                    }
                  />
                  <Text className="ml-2 flex-1 text-xs font-jakartaMedium text-ink">
                    {slot}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              label={submitting ? "Scheduling..." : "Submit Collection Request"}
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={handleSubmit}
            />
          </View>
        )}

        {/* TAB 3: Hub & Route Sequence Demo */}
        {activeTab === "hub" && (
          <View>
            <View
              style={shadows.soft}
              className="rounded-2xl bg-surface p-4 mb-4"
            >
              <View className="flex-row items-center mb-2">
                <Truck size={18} color={colors.primary} />
                <Text className="ml-2 text-base font-jakartaBold text-ink">
                  Campus Recycling Route
                </Text>
              </View>
              <Text className="text-xs font-jakarta text-muted mb-3">
                Live aggregation plan for student e-waste pickups across campus
                zones.
              </Text>

              <View className="rounded-xl bg-borderLight p-3 mb-2">
                <Text className="text-xs font-jakartaBold text-ink">
                  Stop 1: Tech Block B Hub
                </Text>
                <Text className="text-[11px] font-jakarta text-muted">
                  2 Laptops, 4 Batteries awaiting handover
                </Text>
              </View>
              <View className="rounded-xl bg-borderLight p-3 mb-2">
                <Text className="text-xs font-jakartaBold text-ink">
                  Stop 2: Hostel Block 4
                </Text>
                <Text className="text-[11px] font-jakarta text-muted">
                  Power banks, adapter cables safely boxed
                </Text>
              </View>
              <View className="rounded-xl bg-borderLight p-3">
                <Text className="text-xs font-jakartaBold text-ink">
                  Destination: Certified Recovery Partner
                </Text>
                <Text className="text-[11px] font-jakarta text-muted">
                  CPCB Certified Maharashtra E-Waste Facility
                </Text>
              </View>
            </View>

            <View style={shadows.soft} className="rounded-2xl bg-surface p-4">
              <Text className="text-sm font-jakartaBold text-ink mb-2">
                Materials Recovered
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1 rounded-xl bg-green-50 p-3 items-center">
                  <Text className="text-base font-jakartaBold text-green-700">
                    92%
                  </Text>
                  <Text className="text-[10px] font-jakartaMedium text-green-700">
                    Metals & Circuitry
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-violet-bg p-3 items-center">
                  <Text className="text-base font-jakartaBold text-violet-text">
                    0 kg
                  </Text>
                  <Text className="text-[10px] font-jakartaMedium text-violet-text">
                    Landfill Leached
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatusBadge({ status }: { status: EwasteRequest["status"] }) {
  const map: Record<
    EwasteRequest["status"],
    { label: string; tone: "condition" | "success" | "category" | "neutral" }
  > = {
    submitted: { label: "Submitted", tone: "neutral" },
    scheduled: { label: "Scheduled", tone: "condition" },
    collected: { label: "Collected", tone: "category" },
    recycled: { label: "Recycled", tone: "success" },
  };
  const conf = map[status] || map.submitted;
  return <Badge label={conf.label} tone={conf.tone} />;
}

function StepItem({ label, done }: { label: string; done: boolean }) {
  return (
    <View className="items-center">
      <View
        className={`h-4 w-4 rounded-full items-center justify-center ${done ? "bg-primary" : "bg-subtle/30"}`}
      >
        {done && <CheckCircle2 size={12} color="#fff" />}
      </View>
      <Text className="text-[9px] font-jakartaMedium text-subtle mt-1">
        {label}
      </Text>
    </View>
  );
}
