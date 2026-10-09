import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Send } from "lucide-react-native";

import { colors, shadows } from "@/lib/theme";

/**
 * Pickup coordination threads — Messages (API_DECISIONS §8 defers realtime
 * chat, so this screen is deliberately LOCAL-ONLY: the threads and messages
 * below are in-file seed data, no gateway, no websocket, no persistence).
 * List mode shows one row per counterpart; tapping a row opens the
 * conversation with directional bubbles and a composer that appends to local
 * state.
 */

type Message = { id: string; fromMe: boolean; text: string; at: string };
type Thread = {
  id: string;
  name: string;
  listingTitle: string;
  preview: string;
  unread: number;
  at: string;
  messages: Message[];
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function iso(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

/** Seeded pickup-coordination threads (one with zero unread, per the spec). */
const SEED_THREADS: Thread[] = [
  {
    id: "thread-aarav",
    name: "Aarav Sharma",
    listingTitle: "Dell XPS 13 · i7, 16 GB RAM",
    preview: "5 at the library entrance works — I'll bring the charger too.",
    unread: 2,
    at: iso(14 * MINUTE),
    messages: [
      {
        id: "m-aarav-1",
        fromMe: true,
        text: "Hi Aarav! Is the XPS 13 still available?",
        at: iso(3 * HOUR),
      },
      {
        id: "m-aarav-2",
        fromMe: false,
        text: "Hey! Yes it is. Battery still holds around 8 hours.",
        at: iso(2 * HOUR + 40 * MINUTE),
      },
      {
        id: "m-aarav-3",
        fromMe: true,
        text: "Great. Could we meet at the Central Library entrance at 5?",
        at: iso(48 * MINUTE),
      },
      {
        id: "m-aarav-4",
        fromMe: false,
        text: "5 at the library entrance works — I'll bring the charger too.",
        at: iso(14 * MINUTE),
      },
    ],
  },
  {
    id: "thread-priya",
    name: "Priya Nair",
    listingTitle: "Casio fx-991EX Scientific Calculator",
    preview: "Perfect, see you at the Hostel 3 block tomorrow at 10.",
    unread: 0,
    at: iso(5 * HOUR),
    messages: [
      {
        id: "m-priya-1",
        fromMe: false,
        text: "Hello! The calculator is still with me if you still want it.",
        at: iso(7 * HOUR),
      },
      {
        id: "m-priya-2",
        fromMe: true,
        text: "Yes please — I need it for tomorrow's engineering maths exam.",
        at: iso(6 * HOUR),
      },
      {
        id: "m-priya-3",
        fromMe: false,
        text: "Perfect, see you at the Hostel 3 block tomorrow at 10.",
        at: iso(5 * HOUR),
      },
    ],
  },
  {
    id: "thread-rohan",
    name: "Rohan Deshmukh",
    listingTitle: "Firefox 26T Mountain Cycle",
    preview: "Sure, I'll bring the lock and the spare tube along as well.",
    unread: 1,
    at: iso(2 * DAY + 3 * HOUR),
    messages: [
      {
        id: "m-rohan-1",
        fromMe: true,
        text: "Hi Rohan, is the Firefox cycle still up for sale?",
        at: iso(3 * DAY),
      },
      {
        id: "m-rohan-2",
        fromMe: false,
        text: "Yep, ₹4,800 as listed. Tyres are new, gears tuned last month.",
        at: iso(2 * DAY + 22 * HOUR),
      },
      {
        id: "m-rohan-3",
        fromMe: true,
        text: "Can you do ₹4,200? I can pick it up from the sports block.",
        at: iso(2 * DAY + 8 * HOUR),
      },
      {
        id: "m-rohan-4",
        fromMe: false,
        text: "Meet me at the sports block gate at 6 and we have a deal.",
        at: iso(2 * DAY + 5 * HOUR),
      },
      {
        id: "m-rohan-5",
        fromMe: false,
        text: "Sure, I'll bring the lock and the spare tube along as well.",
        at: iso(2 * DAY + 3 * HOUR),
      },
    ],
  },
];

/** Tiny in-file relative-time helper (screen contract keeps helpers local). */
function timeAgo(isoStamp: string): string {
  const then = new Date(isoStamp).getTime();
  if (Number.isNaN(then)) return "";

  const diff = Date.now() - then;
  if (diff < MINUTE) return "just now";

  const minutes = Math.floor(diff / MINUTE);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / DAY);
  if (days < 7) return `${days}d ago`;

  return new Date(then).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** Clock time for the caption under a chat bubble, e.g. "5:42 PM". */
function clockTime(isoStamp: string): string {
  const date = new Date(isoStamp);
  if (Number.isNaN(date.getTime())) return "";

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Up-to-two-letter initials for the avatar circle. */
function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ChatScreen() {
  const router = useRouter();

  const [threads, setThreads] = useState<Thread[]>(SEED_THREADS);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? null;

  const openThread = (id: string) => {
    // Opening a thread clears its unread badge (local-only for now).
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id ? { ...thread, unread: 0 } : thread,
      ),
    );
    setActiveThreadId(id);
    setDraft("");
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !activeThreadId) return;

    const sentAt = new Date().toISOString();
    const message: Message = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fromMe: true,
      text,
      at: sentAt,
    };

    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === activeThreadId
          ? {
              ...thread,
              messages: [...thread.messages, message],
              preview: text,
              at: sentAt,
            }
          : thread,
      ),
    );
    setDraft("");
  };

  const renderThreadRow = ({ item }: ListRenderItemInfo<Thread>) => (
    <Pressable
      onPress={() => openThread(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${item.name} about ${item.listingTitle}`}
      style={shadows.soft}
      className="mb-3 flex-row items-center rounded-2xl bg-surface p-4 active:opacity-90"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-green-50">
        <Text className="text-sm font-jakartaBold text-green-700">
          {initialsOf(item.name)}
        </Text>
      </View>

      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className="flex-1 text-base font-jakartaBold text-ink"
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text className="ml-2 text-xs font-jakarta text-subtle">
            {timeAgo(item.at)}
          </Text>
        </View>
        <Text
          className="mt-0.5 text-xs font-jakartaMedium text-muted"
          numberOfLines={1}
        >
          {item.listingTitle}
        </Text>
        <Text className="mt-1 text-sm font-jakarta text-muted" numberOfLines={2}>
          {item.preview}
        </Text>
      </View>

      {item.unread > 0 ? (
        <View className="ml-2 rounded-full bg-primary px-2 py-0.5">
          <Text className="text-xs font-jakartaBold text-white">
            {item.unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );

  const renderBubble = ({ item }: ListRenderItemInfo<Message>) => (
    <View
      className={`mb-3 px-4 ${item.fromMe ? "items-end" : "items-start"}`}
    >
      <View
        style={item.fromMe ? undefined : shadows.soft}
        className={
          item.fromMe
            ? "max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5"
            : "max-w-[75%] rounded-2xl rounded-bl-sm bg-surface px-4 py-2.5"
        }
      >
        <Text
          className={
            item.fromMe
              ? "text-base font-jakarta text-white"
              : "text-base font-jakarta text-ink"
          }
        >
          {item.text}
        </Text>
      </View>
      <Text className="mt-1 text-xs font-jakarta text-subtle">
        {clockTime(item.at)}
      </Text>
    </View>
  );

  if (activeThread) {
    return (
      <View className="flex-1 bg-bg">
        {/* Conversation header — the arrow returns to list mode, not back. */}
        <View className="flex-row items-center border-b border-border px-5 pb-3 pt-14">
          <Pressable
            onPress={() => setActiveThreadId(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to messages"
            style={shadows.soft}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-80"
          >
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>

          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-green-50">
            <Text className="text-xs font-jakartaBold text-green-700">
              {initialsOf(activeThread.name)}
            </Text>
          </View>

          <View className="flex-1">
            <Text
              className="text-base font-jakartaBold text-ink"
              numberOfLines={1}
            >
              {activeThread.name}
            </Text>
            <Text
              className="text-xs font-jakarta text-muted"
              numberOfLines={1}
            >
              {activeThread.listingTitle}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          {/* Inverted + newest-first data keeps the thread pinned to the bottom. */}
          <FlatList
            data={[...activeThread.messages].reverse()}
            keyExtractor={(message) => message.id}
            inverted
            renderItem={renderBubble}
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12 }}
          />

          {/* Composer */}
          <View className="flex-row items-end border-t border-border bg-bg px-4 py-3">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.subtle}
              multiline
              className="max-h-28 flex-1 rounded-full border border-border bg-surface px-4 py-3 text-base font-jakarta text-ink"
            />
            <Pressable
              onPress={handleSend}
              disabled={draft.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              className={`ml-3 h-11 w-11 items-center justify-center rounded-full bg-primary ${
                draft.trim().length === 0 ? "opacity-50" : "active:opacity-80"
              }`}
            >
              <Send size={18} color="#ffffff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {/* Screen header: back affordance + title + subtitle. */}
      <View className="px-5 pb-3 pt-14">
        <View className="flex-row items-center">
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
            Messages
          </Text>
        </View>
        <Text className="mt-1 pl-[52px] text-sm font-jakarta text-muted">
          Coordinate the offline handoff
        </Text>
      </View>

      <FlatList
        data={threads}
        keyExtractor={(thread) => thread.id}
        renderItem={renderThreadRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          paddingTop: 8,
        }}
      />
    </View>
  );
}
