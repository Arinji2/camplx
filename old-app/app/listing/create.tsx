import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Camera,
  ChevronLeft,
  ImagePlus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
  CheckCircle2,
  TrendingDown,
  Layers,
} from "lucide-react-native";

import { Button } from "@/components/Button";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Segmented } from "@/components/Segmented";
import { db, type InspectionResult, DEMO_CAMPUS } from "@/lib/database";
import { colors, shadows } from "@/lib/theme";
import {
  inspectAndGenerateProduct,
  type FullAnalysisResult,
} from "@/services/aiService";
import {
  takePhoto,
  pickImages,
  uploadListingImage,
  type PickedImage,
} from "@/services/imageService";
import { addListingImage, createListing } from "@/services/listingService";
import { useAuthStore } from "@/stores/authStore";
import type { ListingType } from "@/types";

const INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink";

const createListingSchema = z
  .object({
    listingType: z.enum(["sell", "donate"]),
    category: z.string().min(1, "Please choose a category"),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional().default(""),
    condition: z.string().trim().min(1, "Condition is required"),
    price: z.string().optional().default(""),
  })
  .superRefine((val, ctx) => {
    if (val.listingType === "sell") {
      const n = Number.parseFloat((val.price ?? "").trim());
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Enter a valid asking price",
        });
      }
    }
  });

type CreateListingForm = z.input<typeof createListingSchema>;

export default function CreateListingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<
    FullAnalysisResult["data"] | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateListingForm>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      listingType: "sell",
      category: "electronics",
      title: "",
      description: "",
      condition: "Good",
      price: "",
    },
  });

  const listingType = watch("listingType") as ListingType;
  const category = watch("category");

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  /**
   * Primary Action: Instant Camera Capture for AI Verification
   */
  async function onCaptureCamera() {
    setImageError(null);
    const photo = await takePhoto();
    if (photo) {
      const updated = [photo, ...images];
      setImages(updated);
      // Auto-trigger multimodal quality appraisal immediately
      await runAIInspection(photo.uri);
    }
  }

  async function onPickGallery() {
    setImageError(null);
    const picked = await pickImages({ multiple: false });
    if (picked.length > 0) {
      const updated = [...picked, ...images];
      setImages(updated);
      await runAIInspection(picked[0].uri);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (images.length <= 1) {
      setAnalysisResult(null);
    }
  }

  async function runAIInspection(targetUri?: string) {
    const activeUri = targetUri || (images.length > 0 ? images[0].uri : null);
    if (!activeUri) {
      setImageError(
        "Take a photo with the camera to run AI condition inspection.",
      );
      return;
    }

    setAnalyzing(true);
    setFormError(null);

    const result = await inspectAndGenerateProduct(
      activeUri,
      watch("title") || "",
      DEMO_CAMPUS.name,
      listingType,
    );

    if (result.ok && result.data) {
      const data = result.data;
      setAnalysisResult(data);

      setValue("title", data.title, { shouldValidate: true });
      setValue("description", data.description);
      setValue("condition", data.condition, { shouldValidate: true });
      if (listingType === "sell" && data.price != null) {
        setValue("price", String(data.price), { shouldValidate: true });
      }

      // If classified as end-of-life, notify student for e-waste diversion
      if (data.circular_lifecycle_category === "End-of-life") {
        Alert.alert(
          "Circular Economy Alert",
          "This device appears heavily damaged or non-functional. Camplx recommends routing it to the Campus E-Waste Recovery Hub instead of a regular sale.",
          [
            { text: "Keep Listing", style: "cancel" },
            {
              text: "Go to E-Waste Hub",
              onPress: () => router.push("/ewaste"),
            },
          ],
        );
      }
    }
    setAnalyzing(false);
  }

  const onPublish = handleSubmit(async (values) => {
    if (submitting) return;
    setFormError(null);

    if (images.length < 1) {
      setImageError("Take at least one photo with the camera to publish.");
      return;
    }

    const profile = useAuthStore.getState().profile;
    if (!profile || !profile.campus_id) {
      setFormError("Verified campus account required.");
      return;
    }

    setSubmitting(true);
    try {
      const price =
        values.listingType === "sell"
          ? Number.parseFloat((values.price ?? "").trim())
          : null;

      const listingId = await createListing({
        sellerId: profile.id,
        campusId: profile.campus_id,
        listingType: values.listingType,
        title: values.title.trim(),
        description: (values.description ?? "").trim() || null,
        category: values.category,
        condition: values.condition.trim(),
        price,
      });

      // Save image
      for (let i = 0; i < images.length; i++) {
        const storagePath = await uploadListingImage(
          profile.id,
          listingId,
          images[i],
        );
        await addListingImage(listingId, storagePath, i);
      }

      // Save Inspection Report
      if (analysisResult) {
        const inspectionRecord: InspectionResult = {
          id: `insp-${Date.now()}`,
          listingId,
          status: "completed",
          originalImageUri: images[0].uri,
          annotatedImageBase64: analysisResult.annotated_image_base64,
          overall_condition: analysisResult.condition,
          circular_lifecycle_category:
            analysisResult.circular_lifecycle_category,
          defects: analysisResult.defects || [],
          pricing: analysisResult.pricing,
          amazon_listing: analysisResult.amazon_listing,
          modelNotes: [
            "Processed with Camplx Gemini 2.5 Flash Computer Vision",
            analysisResult.reasoning || "Verified for student trust.",
          ],
          createdAt: new Date().toISOString(),
        };
        await db.saveInspection(inspectionRecord);
      }

      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      router.replace(`/listing/${listingId}`);
    } catch {
      setFormError("Failed to publish listing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-14">
        <Pressable
          onPress={goBack}
          style={shadows.soft}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-surface active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-jakartaBold text-ink">
            AI Camera Inspection
          </Text>
          <Text className="text-xs font-jakartaMedium text-muted">
            Snap item to detect defects & price
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 pb-12 pt-2"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Sell or Donate toggle */}
          <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
            Listing Intent
          </Text>
          <Controller
            control={control}
            name="listingType"
            render={({ field: { value, onChange } }) => (
              <Segmented<ListingType>
                options={[
                  { label: "Sell to Peers", value: "sell" },
                  { label: "Free Donation", value: "donate" },
                ]}
                value={value as ListingType}
                onChange={onChange}
              />
            )}
          />

          {/* Direct Camera Button & Image Reel */}
          <View className="mt-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-jakartaSemibold text-ink">
                Item Photo (Camera Verification)
              </Text>
              {images.length > 0 && (
                <Pressable
                  onPress={() => runAIInspection()}
                  disabled={analyzing}
                  className="flex-row items-center active:opacity-70"
                >
                  <RefreshCw size={13} color={colors.primaryDark} />
                  <Text className="ml-1 text-xs font-jakartaBold text-primaryDark">
                    Re-Analyze
                  </Text>
                </Pressable>
              )}
            </View>

            {images.length === 0 ? (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={onCaptureCamera}
                  style={shadows.card}
                  className="flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-green-50/70 p-6 active:opacity-80"
                >
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
                    <Camera size={28} color="#ffffff" />
                  </View>
                  <Text className="mt-3 text-base font-jakartaBold text-ink">
                    Open Camera
                  </Text>
                  <Text className="mt-1 text-center text-xs font-jakarta text-muted">
                    Snap photos of front, back & any wear
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onPickGallery}
                  style={shadows.soft}
                  className="w-28 items-center justify-center rounded-3xl border border-border bg-surface p-4 active:opacity-80"
                >
                  <ImagePlus size={22} color={colors.muted} />
                  <Text className="mt-2 text-center text-xs font-jakartaBold text-muted">
                    Choose Gallery
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3 py-1"
              >
                {images.map((img, index) => (
                  <View key={`${img.uri}-${index}`} className="relative">
                    <Image
                      source={{ uri: img.uri }}
                      className="h-28 w-28 rounded-2xl bg-borderLight"
                      resizeMode="cover"
                    />
                    <Pressable
                      className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-ink active:opacity-80"
                      onPress={() => removeImage(index)}
                    >
                      <X size={13} color="#ffffff" />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  className="h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-green-50 active:opacity-70"
                  onPress={onCaptureCamera}
                >
                  <Camera size={24} color={colors.primary} />
                  <Text className="mt-1 text-[11px] font-jakartaBold text-primaryDark">
                    + Take More
                  </Text>
                </Pressable>
              </ScrollView>
            )}

            {imageError && (
              <Text className="mt-2 text-xs font-jakartaMedium text-danger-text">
                {imageError}
              </Text>
            )}
          </View>

          {/* AI Live Inspection Status Card */}
          {analyzing && (
            <View
              style={shadows.soft}
              className="mt-4 flex-row items-center rounded-2xl border border-violet-base/20 bg-violet-bg p-4"
            >
              <RefreshCw
                size={20}
                color={colors.violet.base}
                className="animate-spin"
              />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-jakartaBold text-violet-text">
                  Gemini Vision Analyzing Product...
                </Text>
                <Text className="text-xs font-jakarta text-violet-text/80">
                  Scanning for surface scratches, dents, condition & specs.
                </Text>
              </View>
            </View>
          )}

          {/* AI Inspection Preview & Pricing Intelligence */}
          {analysisResult && !analyzing && (
            <View
              style={shadows.card}
              className="mt-5 rounded-2xl border border-green-200 bg-surface p-4"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Sparkles size={16} color={colors.primaryDark} />
                  <Text className="ml-1.5 text-sm font-jakartaBold text-ink">
                    AI Inspection & Price Intelligence
                  </Text>
                </View>

                {/* Circular Economy Classification Pill */}
                <View
                  className={`rounded-full px-2.5 py-1 ${
                    analysisResult.circular_lifecycle_category === "Reusable"
                      ? "bg-green-100"
                      : analysisResult.circular_lifecycle_category ===
                          "Repairable"
                        ? "bg-blue-100"
                        : "bg-red-100"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-jakartaBold ${
                      analysisResult.circular_lifecycle_category === "Reusable"
                        ? "text-green-800"
                        : analysisResult.circular_lifecycle_category ===
                            "Repairable"
                          ? "text-blue-800"
                          : "text-red-800"
                    }`}
                  >
                    ● {analysisResult.circular_lifecycle_category}
                  </Text>
                </View>
              </View>

              {/* Pricing breakdown metrics */}
              {analysisResult.pricing && listingType === "sell" && (
                <View className="mt-3 flex-row gap-2 bg-borderLight/60 rounded-xl p-3">
                  <View className="flex-1">
                    <Text className="text-[10px] font-jakartaMedium text-subtle">
                      Retail New
                    </Text>
                    <Text className="text-xs font-jakartaBold text-ink">
                      ₹{Math.round(analysisResult.pricing.estimated_retail_new)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-jakartaMedium text-subtle">
                      Defect Penalty
                    </Text>
                    <Text className="text-xs font-jakartaBold text-danger-text">
                      -₹
                      {Math.round(
                        analysisResult.pricing.condition_penalty_amount,
                      )}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-jakartaMedium text-subtle">
                      Fair Asking
                    </Text>
                    <Text className="text-xs font-jakartaBold text-primaryDark">
                      ₹
                      {Math.round(
                        analysisResult.pricing.recommended_listing_price,
                      )}
                    </Text>
                  </View>
                </View>
              )}

              {/* Detected Defects */}
              <View className="mt-3">
                <Text className="text-xs font-jakartaBold text-ink mb-1">
                  Observed Defect Flags ({analysisResult.defects.length})
                </Text>
                {analysisResult.defects.length === 0 ? (
                  <View className="flex-row items-center">
                    <CheckCircle2 size={13} color={colors.green[600]} />
                    <Text className="ml-1 text-xs font-jakarta text-green-700">
                      Zero structural defects identified. Pristine cosmetic
                      surface.
                    </Text>
                  </View>
                ) : (
                  analysisResult.defects.map((d) => (
                    <View
                      key={d.id}
                      className="mt-1 flex-row items-center rounded-lg bg-amber-50 px-2.5 py-1.5"
                    >
                      <ShieldAlert size={13} color={colors.amber.base} />
                      <Text className="ml-1.5 flex-1 text-[11px] font-jakarta text-amber-text">
                        <Text className="font-jakartaBold">
                          {d.defect_type}:
                        </Text>{" "}
                        {d.buyer_note}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              {/* Amazon-style features bullet point preview */}
              {analysisResult.amazon_listing?.key_features_bullets && (
                <View className="mt-3 border-t border-borderLight pt-2">
                  <Text className="text-[11px] font-jakartaBold text-subtle uppercase mb-1">
                    Amazon-Style Feature Highlights
                  </Text>
                  {analysisResult.amazon_listing.key_features_bullets
                    .slice(0, 3)
                    .map((bullet, idx) => (
                      <Text
                        key={idx}
                        className="text-[11px] font-jakarta text-muted mb-0.5"
                      >
                        • {bullet}
                      </Text>
                    ))}
                </View>
              )}
            </View>
          )}

          {/* Product Title */}
          <Text className="mb-2 mt-5 text-sm font-jakartaSemibold text-ink">
            Listing Title
          </Text>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className={INPUT_CLASS}
                placeholder="Product name, brand & model"
                placeholderTextColor={colors.subtle}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          {errors.title && (
            <Text className="mt-1 text-xs font-jakartaMedium text-danger-text">
              {errors.title.message}
            </Text>
          )}

          {/* Category */}
          <Text className="mb-2 mt-5 text-sm font-jakartaSemibold text-ink">
            Campus Category
          </Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange } }) => (
              <CategoryPicker value={category} onChange={onChange} />
            )}
          />

          {/* Condition */}
          <Text className="mb-2 mt-5 text-sm font-jakartaSemibold text-ink">
            Condition Grade
          </Text>
          <Controller
            control={control}
            name="condition"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className={INPUT_CLASS}
                placeholder="New, Like New, Good, Fair"
                placeholderTextColor={colors.subtle}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />

          {/* Price (Sell Mode Only) */}
          {listingType === "sell" && (
            <>
              <Text className="mb-2 mt-5 text-sm font-jakartaSemibold text-ink">
                Asking Price (₹)
              </Text>
              <Controller
                control={control}
                name="price"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className={INPUT_CLASS}
                    placeholder="e.g. 950"
                    placeholderTextColor={colors.subtle}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              {errors.price && (
                <Text className="mt-1 text-xs font-jakartaMedium text-danger-text">
                  {errors.price.message}
                </Text>
              )}
            </>
          )}

          {/* Description */}
          <Text className="mb-2 mt-5 text-sm font-jakartaSemibold text-ink">
            Product Description
          </Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className={`${INPUT_CLASS} min-h-[90px]`}
                placeholder="Details for students..."
                placeholderTextColor={colors.subtle}
                multiline
                textAlignVertical="top"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />

          {formError && (
            <Text className="mt-4 text-sm font-jakartaMedium text-danger-text">
              {formError}
            </Text>
          )}

          {/* Publish Action */}
          <View className="mt-7">
            <Button
              label={submitting ? "Publishing to Campus..." : "Publish Listing"}
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={onPublish}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
