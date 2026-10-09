import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Plus, Trash2, Megaphone } from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  CategoryPicker,
  type ListingCategory,
} from "@/components/CategoryPicker";
import { colors, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import { useNeedItStore } from "@/stores/needItStore";
import type { NeedUrgency } from "@/types/api";

const URGENCIES: { label: string; value: NeedUrgency }[] = [
  { label: "Normal", value: "normal" },
  { label: "Urgent (Exam/Project)", value: "urgent" },
  { label: "Low", value: "low" },
];

export default function NeedItScreen() {
  const profile = useAuthStore((s) => s.profile);
  const requests = useNeedItStore((s) => s.requests);
  const loadRequests = useNeedItStore((s) => s.loadRequests);
  const addRequest = useNeedItStore((s) => s.addRequest);
  const removeRequest = useNeedItStore((s) => s.removeRequest);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<ListingCategory>("electronics");
  const [urgency, setUrgency] = useState<NeedUrgency>("normal");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await addRequest({
      title: title.trim(),
      category,
      note: note.trim() || undefined,
      urgency,
    });
    setSubmitting(false);
    setTitle("");
    setNote("");
    setModalOpen(false);
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="bg-surface px-5 pb-3 pt-14 border-b border-borderLight flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-xl font-jakartaExtrabold text-ink">
            Need It Board
          </Text>
          <Text className="text-xs font-jakarta text-muted">
            Request items before buying new
          </Text>
        </View>

        <Pressable
          onPress={() => setModalOpen(true)}
          className="flex-row items-center rounded-full bg-primary px-3.5 py-2"
          style={shadows.soft}
        >
          <Plus size={16} color="#ffffff" />
          <Text className="ml-1 text-xs font-jakartaBold text-white">
            Post Need
          </Text>
        </Pressable>
      </View>

      {/* Requests List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {requests.length === 0 ? (
          <EmptyState
            icon="📢"
            title="No open requests"
            subtitle="Need a lab coat, Drafter, or scientific calculator? Post a request to let campus peers know."
            action={{
              label: "Post a request",
              onPress: () => setModalOpen(true),
            }}
          />
        ) : (
          requests.map((req) => {
            const isOwner = req.requester_id === profile?.id;
            return (
              <View
                key={req.id}
                style={shadows.soft}
                className="mb-3 rounded-2xl bg-surface p-4 border border-borderLight"
              >
                <View className="flex-row items-center justify-between">
                  <Badge
                    label={req.urgency.toUpperCase()}
                    tone={req.urgency === "urgent" ? "condition" : "neutral"}
                  />
                  <Badge label={req.category} tone="category" />
                </View>

                <Text className="mt-2 text-base font-jakartaBold text-ink">
                  {req.title}
                </Text>

                {req.note ? (
                  <Text className="mt-1 text-sm font-jakarta text-muted">
                    "{req.note}"
                  </Text>
                ) : null}

                <View className="mt-3 flex-row items-center justify-between pt-2 border-t border-borderLight">
                  <Text className="text-xs font-jakartaMedium text-subtle">
                    Posted by {req.requester_name}
                  </Text>
                  {isOwner ? (
                    <Pressable
                      onPress={() => removeRequest(req.id)}
                      hitSlop={8}
                      className="p-1"
                    >
                      <Trash2 size={16} color={colors.danger.text} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Post Need Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-surface rounded-t-3xl p-5 max-h-[85%]">
            <Text className="text-lg font-jakartaExtrabold text-ink mb-3">
              Post to Want-Board
            </Text>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              What do you need?
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Graphing Calculator for Math 201"
              placeholderTextColor={colors.subtle}
              className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink mb-3"
            />

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Category
            </Text>
            <View className="mb-3">
              <CategoryPicker value={category} onChange={setCategory} />
            </View>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Urgency
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {URGENCIES.map((u) => (
                <Pressable
                  key={u.value}
                  onPress={() => setUrgency(u.value)}
                  className={`rounded-full border px-3.5 py-1.5 ${
                    urgency === u.value
                      ? "border-primary bg-primary"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text
                    className={`text-xs font-jakartaSemibold ${
                      urgency === u.value ? "text-white" : "text-muted"
                    }`}
                  >
                    {u.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Note (optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Need before Friday finals, can return next week"
              placeholderTextColor={colors.subtle}
              multiline
              className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink mb-5 h-20"
              style={{ textAlignVertical: "top" }}
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setModalOpen(false)}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Post Need"
                  loading={submitting}
                  disabled={!title.trim()}
                  onPress={handleSubmit}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
