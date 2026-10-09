import type { ReactNode } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Bell,
  ChevronLeft,
  Heart,
  Megaphone,
  MessageCircle,
  PackageCheck,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { notificationsApi } from "@/api";
import { EmptyState } from "@/components/EmptyState";
import { NotificationCardSkeleton } from "@/components/Skeletons";
import { colors, shadows } from "@/lib/theme";
import type { NotificationItem } from "@/types/api";

/**
 * Notifications feed (design §4.2 Notifications; Req 12.1–12.5). A single
 * server-driven list of likes, reservations, need-it matches, messages, and
 * system broadcasts. Tapping an unread row marks it read; the header offers a
 * one-tap "Mark all read". Both writes invalidate `["notifications"]` so the
 * row states refetch straight from the gateway.
 */

/** Tiny in-file relative-time helper (screen contract keeps helpers local). */
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

/** Leading-circle tint + icon per notification type. */
const TYPE_META: Record<
  NotificationItem["type"],
  { Icon: LucideIcon; container: string; color: string }
> = {
  reservation: {
    Icon: PackageCheck,
    container: "bg-amber-bg",
    color: colors.amber.text,
  },
  message: {
    Icon: MessageCircle,
    container: "bg-violet-bg",
    color: colors.violet.text,
  },
  like: { Icon: Heart, container: "bg-violet-bg", color: colors.violet.text },
  request: { Icon: Megaphone, container: "bg-blue-bg", color: colors.blue.text },
  system: { Icon: Bell, container: "bg-borderLight", color: colors.muted },
};

/**
 * Message body with the actor's name emphasised when it appears verbatim in
 * the copy ("Priya Nair reserved your …"). Falls back to plain text when the
 * actor name is missing or not embedded in the message.
 */
function NotificationMessage({ item }: { item: NotificationItem }) {
  const { actor_name: name, message, read } = item;

  if (!name || !message.includes(name)) {
    return (
      <Text
        className={`text-sm ${read ? "font-jakarta text-muted" : "font-jakartaMedium text-ink"}`}
      >
        {message}
      </Text>
    );
  }

  const [before = "", ...rest] = message.split(name);
  const after = rest.join(name);

  return (
    <Text
      className={`text-sm ${read ? "font-jakarta text-muted" : "font-jakartaMedium text-ink"}`}
    >
      {before}
      <Text className="font-jakartaBold text-ink">{name}</Text>
      {after}
    </Text>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getMyNotifications(),
  });

  const notifications = data ?? [];
  const allRead = notifications.length > 0 && notifications.every((n) => n.read);

  const markAll = useMutation<void, Error, void>({
    mutationFn: () => notificationsApi.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markOne = useMutation<void, Error, string>({
    mutationFn: (id) => notificationsApi.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handlePress = (item: NotificationItem) => {
    if (item.read) return;
    markOne.mutate(item.id);
  };

  const renderRow = ({ item }: ListRenderItemInfo<NotificationItem>) => {
    const meta = TYPE_META[item.type] ?? TYPE_META.system;
    const { Icon } = meta;

    return (
      <Pressable
        onPress={() => handlePress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.message}
        style={shadows.soft}
        className="mb-3 flex-row items-center rounded-2xl bg-surface p-4 active:opacity-90"
      >
        <View
          className={`h-11 w-11 items-center justify-center rounded-full ${meta.container}`}
        >
          <Icon size={20} color={meta.color} />
        </View>

        <View className="ml-3 flex-1">
          <NotificationMessage item={item} />
          <Text className="mt-1 text-xs font-jakarta text-subtle">
            {timeAgo(item.created_at)}
          </Text>
        </View>

        {item.read ? null : (
          <View className="ml-2 h-2.5 w-2.5 rounded-full bg-violet-base" />
        )}
      </Pressable>
    );
  };

  let body: ReactNode;

  if (isLoading) {
    body = (
      <View className="px-5 pt-2">
        <NotificationCardSkeleton />
        <NotificationCardSkeleton />
        <NotificationCardSkeleton />
        <NotificationCardSkeleton />
      </View>
    );
  } else if (isError) {
    body = (
      <EmptyState
        icon="⚠️"
        title="Couldn't load notifications"
        subtitle="We couldn't reach the campus gateway. Check your connection and try again."
        action={{ label: "Try again", onPress: () => refetch() }}
      />
    );
  } else if (notifications.length === 0) {
    body = (
      <EmptyState
        icon="🔔"
        title="You're all caught up"
        subtitle="Reservations, messages, and match alerts will show up here."
      />
    );
  } else {
    body = (
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
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
      {/* Header: back affordance + title + one-tap "Mark all read". */}
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
          Notifications
        </Text>

        <Pressable
          onPress={() => markAll.mutate()}
          disabled={markAll.isPending || allRead}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          className={
            markAll.isPending || allRead ? "opacity-50" : "active:opacity-70"
          }
        >
          <Text className="text-sm font-jakartaSemibold text-violet-text">
            Mark all read
          </Text>
        </Pressable>
      </View>

      {body}
    </View>
  );
}
