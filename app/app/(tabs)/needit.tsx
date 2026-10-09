import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import {
  ChevronRight,
  Flame,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { db } from "@/lib/database";
import { colors, gradients, shadows } from "@/lib/theme";
import {
  useNeedItStore,
  type NeedRequest,
  type NeedUrgency,
} from "@/stores/needItStore";
import type { ListingWithImages } from "@/types";

const INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink";

const URGENCY_OPTIONS: { value: NeedUrgency; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

function categoryLabel(value: string | null): string | null {
  if (!value) return null;
  const match = LISTING_CATEGORIES.find((cat) => cat.value === value);
  return match?.label ?? value;
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

const URGENCY_META: Record<
  NeedUrgency,
  { label: string; container: string; text: string }
> = {
  low: { label: "Low", container: "bg-borderLight", text: "text-muted" },
  normal: {
    label: "Normal",
    container: "bg-violet-bg",
    text: "text-violet-text",
  },
  urgent: {
    label: "Urgent",
    container: "bg-amber-bg",
    text: "text-amber-text",
  },
};

function UrgencyBadge({ urgency }: { urgency: NeedUrgency }) {
  const meta = URGENCY_META[urgency];
  return (
    <View
      className={`flex-row items-center self-start rounded-full px-2.5 py-1 ${meta.container}`}
    >
      {urgency === "urgent" ? (
        <View className="mr-1">
          <Flame size={12} color={colors.amber.text} />
        </View>
      ) : null}
      <Text className={`text-xs font-jakartaSemibold ${meta.text}`}>
        {meta.label}
      </Text>
    </View>
  );
}

type CommunityRequest = {
  id: string;
  initials: string;
  title: string;
  category: string;
  urgency: NeedUrgency;
  timeAgo: string;
};

const COMMUNITY_REQUESTS: CommunityRequest[] = [
  {
    id: "sample-1",
    initials: "AR",
    title: "Graphing calculator for finals week",
    category: "electronics",
    urgency: "urgent",
    timeAgo: "12m ago",
  },
  {
    id: "sample-2",
    initials: "MK",
    title: "Intro to Economics textbook (10th ed.)",
    category: "books",
    urgency: "normal",
    timeAgo: "1h ago",
  },
  {
    id: "sample-3",
    initials: "JT",
    title: "Mini fridge for dorm room",
    category: "furniture",
    urgency: "low",
    timeAgo: "3h ago",
  },
  {
    id: "sample-4",
    initials: "SL",
    title: "Desk lamp with USB port",
    category: "furniture",
    urgency: "normal",
    timeAgo: "5h ago",
  },
];

export default function NeedItScreen() {
  const requests = useNeedItStore((s) => s.requests);
  const addRequest = useNeedItStore((s) => s.add);
  const removeRequest = useNeedItStore((s) => s.remove);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<NeedUrgency>("normal");
  const [showTitleError, setShowTitleError] = useState(false);

  const trimmedTitle = title.trim();

  function onPost() {
    if (trimmedTitle.length === 0) {
      setShowTitleError(true);
      return;
    }
    const trimmedNote = note.trim();
    addRequest({
      title: trimmedTitle,
      category,
      note: trimmedNote.length > 0 ? trimmedNote : undefined,
      urgency,
    });
    setTitle("");
    setNote("");
    setCategory(null);
    setUrgency("normal");
    setShowTitleError(false);
  }

  return (
    <View className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-4 pb-10 pt-14"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text className="text-2xl font-jakartaExtrabold text-ink">
            Need It
          </Text>
          <Text className="mt-1 text-sm font-jakarta text-muted">
            Post what you're looking for — your campus can help.
          </Text>

          {/* Hero Banner */}
          <View
            style={shadows.soft}
            className="mt-5 rounded-2xl border border-borderLight bg-black p-4"
          >
            <Text className=" font-jakartaExtrabold text-white">
              Can't find it on the feed?
            </Text>
            <Text className="mt-1 text-sm font-jakarta text-white/85">
              Tell everyone what you need and get auto-matched when a peer lists
              it.
            </Text>
          </View>

          {/* Compose Card */}
          <View
            style={shadows.soft}
            className="mt-5 rounded-2xl border border-borderLight bg-surface p-4"
          >
            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              What are you looking for?
            </Text>
            <TextInput
              className={INPUT_CLASS}
              placeholder="e.g. A second-hand scientific calculator"
              placeholderTextColor={colors.subtle}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (showTitleError && text.trim().length > 0) {
                  setShowTitleError(false);
                }
              }}
            />
            {showTitleError ? (
              <Text className="mt-1.5 text-xs font-jakartaMedium text-danger-text">
                Add a short title so people know what you need.
              </Text>
            ) : null}

            {/* Note */}
            <Text className="mb-2 mt-4 text-sm font-jakartaSemibold text-ink">
              Add a note (optional)
            </Text>
            <TextInput
              className={`${INPUT_CLASS} min-h-[80px]`}
              placeholder="Budget, condition, exam date deadline…"
              placeholderTextColor={colors.subtle}
              multiline
              textAlignVertical="top"
              value={note}
              onChangeText={setNote}
            />

            {/* Category tag */}
            <Text className="mb-2 mt-4 text-sm font-jakartaSemibold text-ink">
              Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pr-1"
            >
              <CategoryChip
                label="Any"
                active={category === null}
                onPress={() => setCategory(null)}
              />
              {LISTING_CATEGORIES.map((cat) => (
                <CategoryChip
                  key={cat.value}
                  label={cat.label}
                  active={category === cat.value}
                  onPress={() => setCategory(cat.value)}
                />
              ))}
            </ScrollView>

            {/* Urgency */}
            <Text className="mb-2 mt-4 text-sm font-jakartaSemibold text-ink">
              How urgent is it?
            </Text>
            <View className="flex-row gap-2">
              {URGENCY_OPTIONS.map((option) => {
                const selected = urgency === option.value;
                const meta = URGENCY_META[option.value];
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setUrgency(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`flex-row items-center rounded-full px-4 py-2 active:opacity-80 ${
                      selected
                        ? meta.container
                        : "border border-borderLight bg-surface"
                    }`}
                  >
                    {option.value === "urgent" && selected ? (
                      <View className="mr-1">
                        <Flame size={13} color={colors.amber.text} />
                      </View>
                    ) : null}
                    <Text
                      className={`text-sm font-jakartaSemibold ${
                        selected ? meta.text : "text-muted"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-4">
              <Button
                label="Post request"
                variant="primary"
                size="lg"
                fullWidth
                onPress={onPost}
              />
            </View>
          </View>

          {/* User's Posted requests with Auto-Match */}
          <Text className="mb-3 mt-8 text-lg font-jakartaBold text-ink">
            Your requests
          </Text>

          {requests.length === 0 ? (
            <EmptyState
              icon="🙋"
              tone="violet"
              title="No requests yet"
              subtitle="Post something you're looking for and let your campus help."
            />
          ) : (
            <View>
              {requests.map((request) => (
                <NeedRequestCard
                  key={request.id}
                  request={request}
                  onDelete={() => removeRequest(request.id)}
                />
              ))}
            </View>
          )}

          {/* Around campus */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 420 }}
          >
            <View className="mb-1 mt-8 flex-row items-center">
              <Users size={18} color={colors.ink} />
              <Text className="ml-2 text-lg font-jakartaBold text-ink">
                Around campus
              </Text>
            </View>
            <Text className="mb-3 text-xs font-jakarta text-subtle">
              Sample requests from other students at your university
            </Text>

            <View>
              {COMMUNITY_REQUESTS.map((item) => (
                <CommunityRequestCard key={item.id} request={item} />
              ))}
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function CommunityRequestCard({ request }: { request: CommunityRequest }) {
  const label = useMemo(
    () => categoryLabel(request.category),
    [request.category],
  );

  return (
    <View
      style={shadows.soft}
      className="mb-3 flex-row items-start rounded-2xl bg-surface p-4"
    >
      <View
        style={{ backgroundColor: colors.navy }}
        className="mr-3 h-10 w-10 items-center justify-center rounded-full"
      >
        <Text className="text-xs font-jakartaBold text-white">
          {request.initials}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-base font-jakartaSemibold text-ink">
          {request.title}
        </Text>

        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          {label ? <Badge label={label} tone="category" /> : null}
          <UrgencyBadge urgency={request.urgency} />
        </View>

        <Text className="mt-2 text-xs font-jakartaMedium text-subtle">
          {request.timeAgo}
        </Text>
      </View>
    </View>
  );
}

function NeedRequestCard({
  request,
  onDelete,
}: {
  request: NeedRequest;
  onDelete: () => void;
}) {
  const router = useRouter();
  const label = useMemo(
    () => categoryLabel(request.category),
    [request.category],
  );
  const urgency: NeedUrgency = request.urgency ?? "normal";

  // Check for auto-matched listings in the marketplace
  const [match, setMatch] = useState<ListingWithImages | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const all = await db.getListings();
      const found = all.find((l) => {
        if (l.status !== "active") return false;
        // Category match or keyword match in title
        if (
          request.category &&
          l.category.toLowerCase() === request.category.toLowerCase()
        ) {
          return true;
        }
        const keywords = request.title.toLowerCase().split(/\s+/);
        return keywords.some(
          (k) => k.length > 3 && l.title.toLowerCase().includes(k),
        );
      });
      if (active && found) {
        setMatch(found);
      }
    })();
    return () => {
      active = false;
    };
  }, [request.category, request.title]);

  return (
    <View style={shadows.soft} className="mb-3 rounded-2xl bg-surface p-4">
      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text className="text-base font-jakartaSemibold text-ink">
            {request.title}
          </Text>

          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            {label ? <Badge label={label} tone="category" /> : null}
            <UrgencyBadge urgency={urgency} />
          </View>

          {request.note ? (
            <Text className="mt-2 text-sm font-jakarta text-muted">
              {request.note}
            </Text>
          ) : null}

          <Text className="mt-2 text-xs font-jakartaMedium text-subtle">
            {relativeTime(request.createdAt)}
          </Text>
        </View>

        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete request: ${request.title}`}
          className="h-9 w-9 items-center justify-center rounded-full bg-borderLight active:opacity-70"
        >
          <Trash2 size={16} color={colors.danger.text} />
        </Pressable>
      </View>

      {/* Campus Match Notification Chip */}
      {match && (
        <Pressable
          onPress={() => router.push(`/listing/${match.id}`)}
          className="mt-3.5 flex-row items-center rounded-xl border border-green-200 bg-green-50 p-2.5 active:opacity-80"
        >
          <View className="h-6 w-6 items-center justify-center rounded-full bg-green-600">
            <Sparkles size={13} color="#ffffff" />
          </View>
          <View className="ml-2 flex-1">
            <Text
              className="text-xs font-jakartaBold text-green-800"
              numberOfLines={1}
            >
              Campus Match Available!
            </Text>
            <Text
              className="text-[11px] font-jakarta text-green-700"
              numberOfLines={1}
            >
              {match.title} • {match.price ? `₹${match.price}` : "Free"}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-xs font-jakartaBold text-primaryDark mr-0.5">
              View
            </Text>
            <ChevronRight size={14} color={colors.primaryDark} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
