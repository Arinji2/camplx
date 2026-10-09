import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react-native";

import { Button } from "@/components/Button";
import {
  CategoryPicker,
  type ListingCategory,
} from "@/components/CategoryPicker";
import { Segmented } from "@/components/Segmented";
import { listingsApi } from "@/api";
import { pickImages, takePhoto } from "@/services/imageService";
import { colors, shadows } from "@/lib/theme";
import type { ConditionGrade, ListingType } from "@/types/api";

type AngleSlot = {
  key: "front" | "back" | "side" | "serial_label" | "defect_detail";
  label: string;
  description: string;
  required: boolean;
};

const ANGLE_SLOTS: AngleSlot[] = [
  {
    key: "front",
    label: "Front (Primary)",
    description: "Full face of the product",
    required: true,
  },
  {
    key: "back",
    label: "Back / Underside",
    description: "Rear casing, cover or hinges",
    required: false,
  },
  {
    key: "side",
    label: "Side / Ports / Gears",
    description: "Switches, connectors, or chain",
    required: false,
  },
  {
    key: "serial_label",
    label: "Model / Serial Label",
    description: "Printed label, barcode or stamp",
    required: false,
  },
  {
    key: "defect_detail",
    label: "Defect Close-up",
    description: "Close-up of any scratch or dent",
    required: false,
  },
];

const CONDITIONS: { label: ConditionGrade; desc: string }[] = [
  { label: "Like New", desc: "Flawless, barely used" },
  { label: "Good", desc: "Minor signs of wear" },
  { label: "Fair", desc: "Visible wear, fully working" },
  { label: "Needs Repair", desc: "Requires fixing/parts" },
];

const PURCHASE_YEARS = ["2025", "2024", "2023", "2022", "2021 or older"];

const INCLUSIONS = [
  "Original Invoice / Bill",
  "Original Box / Packaging",
  "Charger / Cable included",
  "Under Active Warranty",
];

export default function CreateListingScreen() {
  const router = useRouter();

  // Multi-angle photo store: angleKey -> local image URI
  const [anglePhotos, setAnglePhotos] = useState<Record<string, string>>({});

  // Basic Info
  const [listingType, setListingType] = useState<ListingType>("sell");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState<ListingCategory>("electronics");
  const [condition, setCondition] = useState<ConditionGrade>("Good");
  const [description, setDescription] = useState("");

  // Appraisal & Valuation inputs
  const [purchaseYear, setPurchaseYear] = useState<string>("2023");
  const [originalPrice, setOriginalPrice] = useState("");
  const [selectedInclusions, setSelectedInclusions] = useState<string[]>([]);
  const [functionalFlaws, setFunctionalFlaws] = useState("");
  const [extraSpec, setExtraSpec] = useState("");

  // Asking Price
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Capture or pick a photo specifically for a chosen angle
  const handleSlotAction = (slotKey: string) => {
    Alert.alert(
      "Capture Angle",
      "Choose photo source for this inspection angle:",
      [
        {
          text: "Open Camera",
          onPress: async () => {
            const photo = await takePhoto();
            if (photo?.uri) {
              setAnglePhotos((prev) => ({ ...prev, [slotKey]: photo.uri }));
            }
          },
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            const picked = await pickImages({ multiple: false });
            if (picked.length > 0) {
              setAnglePhotos((prev) => ({ ...prev, [slotKey]: picked[0].uri }));
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
    );
  };

  const removePhoto = (slotKey: string) => {
    setAnglePhotos((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const capturedCount = Object.keys(anglePhotos).length;

  const toggleInclusion = (item: string) => {
    setSelectedInclusions((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  };

  // Dynamic Campus Price Recommendation
  const estimatedValuation = useMemo(() => {
    const orig = parseFloat(originalPrice);
    if (isNaN(orig) || orig <= 0) return null;

    const currentYear = new Date().getFullYear();
    const parsedYear = parseInt(purchaseYear, 10) || currentYear - 3;
    const ageYears = Math.max(0, currentYear - parsedYear);
    const ageMultiplier = Math.max(0.35, 1 - ageYears * 0.18);

    const conditionMultiplier =
      condition === "Like New"
        ? 0.85
        : condition === "Good"
          ? 0.72
          : condition === "Fair"
            ? 0.55
            : 0.35;

    const inclusionBonus =
      (selectedInclusions.includes("Under Active Warranty") ? 0.08 : 0) +
      (selectedInclusions.includes("Original Invoice / Bill") ? 0.05 : 0);

    const baseEstimate = Math.round(
      orig * ageMultiplier * (conditionMultiplier + inclusionBonus),
    );

    return {
      min: Math.round(baseEstimate * 0.9),
      rec: baseEstimate,
      max: Math.round(baseEstimate * 1.15),
    };
  }, [originalPrice, purchaseYear, condition, selectedInclusions]);

  const handlePublish = async () => {
    if (!title.trim()) return;
    if (!anglePhotos.front) {
      Alert.alert(
        "Missing Front Photo",
        "Please snap at least the Front (Primary) photo.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const techSpecs: Record<string, string> = {};
      if (brand.trim()) techSpecs["Brand"] = brand.trim();
      if (model.trim()) techSpecs["Model"] = model.trim();
      if (purchaseYear) techSpecs["Purchase Year"] = purchaseYear;
      if (originalPrice.trim())
        techSpecs["Original Retail Price"] = `₹${originalPrice.trim()}`;
      if (selectedInclusions.length > 0) {
        techSpecs["Inclusions"] = selectedInclusions.join(", ");
      }
      if (functionalFlaws.trim())
        techSpecs["Condition Notes"] = functionalFlaws.trim();
      if (extraSpec.trim()) {
        const specLabel =
          category === "electronics"
            ? "Battery / Storage Spec"
            : category === "books"
              ? "Edition / Author"
              : "Variant Details";
        techSpecs[specLabel] = extraSpec.trim();
      }

      // Convert angles dictionary to ordered array: front always first
      const orderedUrls: string[] = [];
      if (anglePhotos.front) orderedUrls.push(anglePhotos.front);
      ANGLE_SLOTS.forEach((slot) => {
        if (slot.key !== "front" && anglePhotos[slot.key]) {
          orderedUrls.push(anglePhotos[slot.key]);
        }
      });

      await listingsApi.createMarketplaceListing({
        title: title.trim(),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        description: description.trim() || undefined,
        category,
        condition,
        listing_type: listingType,
        asking_price: listingType === "donate" ? null : Number(price) || 0,
        technical_specifications: techSpecs,
        image_urls: orderedUrls,
      });

      router.replace("/(tabs)");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Top Header */}
      <View className="px-5 pt-14 pb-3 flex-row items-center border-b border-borderLight bg-surface">
        <Pressable
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-borderLight"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <View>
          <Text className="text-xl font-jakartaExtrabold text-ink">
            New Listing
          </Text>
          <Text className="text-xs font-jakarta text-muted">
            Multi-angle camera & price valuation
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Sell vs Donate Toggle */}
        <View className="mb-5">
          <Segmented
            options={[
              { label: "Sell on Campus", value: "sell" },
              { label: "Free Donation", value: "donate" },
            ]}
            value={listingType}
            onChange={setListingType}
          />
        </View>

        {/* SECTION: MULTI-ANGLE CAMERA STUDIO */}
        <View
          className="mb-5 rounded-2xl bg-surface p-4 border border-borderLight"
          style={shadows.soft}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle">
              Inspection Photo Studio
            </Text>
            <View className="flex-row items-center">
              {anglePhotos.front ? (
                <CheckCircle2
                  size={13}
                  color={colors.primaryDark}
                  className="mr-1"
                />
              ) : null}
              <Text className="text-xs font-jakartaBold text-primaryDark">
                {capturedCount} of {ANGLE_SLOTS.length} angles captured
              </Text>
            </View>
          </View>
          <Text className="text-xs font-jakarta text-muted mb-3">
            Capture multiple perspectives for automated defect detection &
            verification.
          </Text>

          {/* Horizontal Angle Slots Scroller */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
          >
            {ANGLE_SLOTS.map((slot) => {
              const photoUri = anglePhotos[slot.key];
              const isCaptured = Boolean(photoUri);

              return (
                <View
                  key={slot.key}
                  style={shadows.soft}
                  className={`w-36 rounded-2xl border bg-bg p-2.5 ${
                    isCaptured
                      ? "border-green-600 bg-green-50/20"
                      : slot.required
                        ? "border-primary/50"
                        : "border-border"
                  }`}
                >
                  {/* Photo Thumbnail or Empty Camera Slot */}
                  {isCaptured ? (
                    <View className="relative h-28 w-full rounded-xl overflow-hidden mb-2">
                      <Image
                        source={{ uri: photoUri }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                      <View className="absolute top-1.5 right-1.5 flex-row gap-1">
                        <Pressable
                          onPress={() => handleSlotAction(slot.key)}
                          className="h-7 w-7 rounded-full bg-black/60 items-center justify-center"
                        >
                          <RotateCcw size={12} color="#ffffff" />
                        </Pressable>
                        <Pressable
                          onPress={() => removePhoto(slot.key)}
                          className="h-7 w-7 rounded-full bg-red-600/90 items-center justify-center"
                        >
                          <Trash2 size={12} color="#ffffff" />
                        </Pressable>
                      </View>
                      <View className="absolute bottom-1.5 left-1.5 rounded-full bg-green-600 px-2 py-0.5 flex-row items-center">
                        <Check size={10} color="#ffffff" />
                        <Text className="ml-1 text-[9px] font-jakartaBold text-white uppercase">
                          Saved
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleSlotAction(slot.key)}
                      className="h-28 w-full rounded-xl border border-dashed border-borderLight bg-surface items-center justify-center mb-2 active:opacity-80"
                    >
                      <View className="h-10 w-10 rounded-full bg-borderLight items-center justify-center mb-1">
                        <Camera
                          size={18}
                          color={
                            slot.required ? colors.primaryDark : colors.muted
                          }
                        />
                      </View>
                      <Text className="text-[11px] font-jakartaBold text-ink text-center">
                        + Add Shot
                      </Text>
                    </Pressable>
                  )}

                  {/* Slot Caption */}
                  <Text
                    className="text-xs font-jakartaBold text-ink"
                    numberOfLines={1}
                  >
                    {slot.label}
                  </Text>
                  <Text
                    className="text-[10px] font-jakarta text-subtle leading-3 mt-0.5"
                    numberOfLines={2}
                  >
                    {slot.description}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* SECTION: BASIC IDENTIFICATION */}
        <View
          className="mb-5 rounded-2xl bg-surface p-4 border border-borderLight"
          style={shadows.soft}
        >
          <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle mb-3">
            Item Identification
          </Text>

          <Text className="text-xs font-jakartaSemibold text-muted mb-1">
            Listing Title *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Casio FX-991EX ClassWiz Calculator"
            placeholderTextColor={colors.subtle}
            className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink mb-3"
          />

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-xs font-jakartaSemibold text-muted mb-1">
                Brand
              </Text>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g. Casio / Dell"
                placeholderTextColor={colors.subtle}
                className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink"
              />
            </View>

            <View className="flex-1">
              <Text className="text-xs font-jakartaSemibold text-muted mb-1">
                Model / Edition
              </Text>
              <TextInput
                value={model}
                onChangeText={setModel}
                placeholder="e.g. FX-991EX"
                placeholderTextColor={colors.subtle}
                className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink"
              />
            </View>
          </View>

          <Text className="text-xs font-jakartaSemibold text-muted mb-1.5">
            Category *
          </Text>
          <CategoryPicker value={category} onChange={setCategory} />
        </View>

        {/* SECTION: CONDITION & PROVENANCE */}
        <View
          className="mb-5 rounded-2xl bg-surface p-4 border border-borderLight"
          style={shadows.soft}
        >
          <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle mb-3">
            Condition & Provenance
          </Text>

          <Text className="text-xs font-jakartaSemibold text-muted mb-1.5">
            Overall Grade *
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CONDITIONS.map((c) => (
              <Pressable
                key={c.label}
                onPress={() => setCondition(c.label)}
                className={`rounded-xl border px-3.5 py-2.5 flex-1 min-w-[45%] ${
                  condition === c.label
                    ? "border-primary bg-primary/10"
                    : "border-border bg-bg"
                }`}
              >
                <Text
                  className={`text-xs font-jakartaBold ${
                    condition === c.label ? "text-primaryDark" : "text-ink"
                  }`}
                >
                  {c.label}
                </Text>
                <Text className="text-[10px] font-jakarta text-muted mt-0.5">
                  {c.desc}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-xs font-jakartaSemibold text-muted mb-1">
            Year of Purchase
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            <View className="flex-row gap-2">
              {PURCHASE_YEARS.map((yr) => (
                <Pressable
                  key={yr}
                  onPress={() => setPurchaseYear(yr)}
                  className={`rounded-full border px-4 py-1.5 ${
                    purchaseYear === yr
                      ? "border-ink bg-ink"
                      : "border-border bg-bg"
                  }`}
                >
                  <Text
                    className={`text-xs font-jakartaSemibold ${
                      purchaseYear === yr ? "text-white" : "text-muted"
                    }`}
                  >
                    {yr}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text className="text-xs font-jakartaSemibold text-muted mb-1.5">
            Inclusions & Warranty
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {INCLUSIONS.map((item) => {
              const selected = selectedInclusions.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleInclusion(item)}
                  className={`flex-row items-center rounded-full border px-3 py-1.5 ${
                    selected
                      ? "border-green-600 bg-green-50"
                      : "border-border bg-bg"
                  }`}
                >
                  {selected ? (
                    <Check
                      size={12}
                      color={colors.primaryDark}
                      className="mr-1"
                    />
                  ) : null}
                  <Text
                    className={`text-xs font-jakartaMedium ${
                      selected ? "text-green-800" : "text-muted"
                    }`}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-xs font-jakartaSemibold text-muted mb-1">
            Known Flaws or Defects (Disclose transparently)
          </Text>
          <TextInput
            value={functionalFlaws}
            onChangeText={setFunctionalFlaws}
            placeholder="e.g. Scratched bezel; power button needs a firm press"
            placeholderTextColor={colors.subtle}
            className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink mb-3"
          />

          <Text className="text-xs font-jakartaSemibold text-muted mb-1">
            {category === "electronics"
              ? "Battery Health or Specs (RAM / SSD)"
              : category === "cycles"
                ? "Gears, Tyre or Frame Details"
                : category === "books"
                  ? "Author / Edition / Notes included"
                  : "Extra Specifications"}
          </Text>
          <TextInput
            value={extraSpec}
            onChangeText={setExtraSpec}
            placeholder="e.g. 88% Battery health, 21-speed Shimano gears, etc."
            placeholderTextColor={colors.subtle}
            className="rounded-xl border border-border bg-bg px-4 py-3 font-jakarta text-sm text-ink"
          />
        </View>

        {/* SECTION: PRICING & APPRAISAL */}
        {listingType === "sell" ? (
          <View
            className="mb-5 rounded-2xl bg-surface p-4 border border-borderLight"
            style={shadows.soft}
          >
            <Text className="text-xs font-jakartaBold uppercase tracking-wide text-subtle mb-3">
              Pricing Intelligence
            </Text>

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Original Retail Price (When bought new)
            </Text>
            <View className="flex-row items-center rounded-xl border border-border bg-bg px-3 mb-4">
              <Text className="font-jakartaBold text-muted mr-1">₹</Text>
              <TextInput
                value={originalPrice}
                onChangeText={setOriginalPrice}
                placeholder="e.g. 1500"
                placeholderTextColor={colors.subtle}
                keyboardType="numeric"
                className="flex-1 py-3 font-jakarta text-sm text-ink"
              />
            </View>

            {/* Smart Campus Valuation Preview */}
            {estimatedValuation ? (
              <View className="rounded-xl bg-violet-bg p-3.5 border border-violet-base/20 mb-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Sparkles size={16} color={colors.secondary} />
                    <Text className="ml-1.5 text-xs font-jakartaBold text-violet-text">
                      Campus Valuation Range
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setPrice(String(estimatedValuation.rec))}
                    className="rounded-full bg-secondary px-2.5 py-1"
                  >
                    <Text className="text-[11px] font-jakartaBold text-white">
                      Apply ₹{estimatedValuation.rec}
                    </Text>
                  </Pressable>
                </View>

                <Text className="mt-2 text-xs font-jakarta text-muted">
                  Suggested:{" "}
                  <Text className="font-jakartaBold text-ink">
                    ₹{estimatedValuation.min} – ₹{estimatedValuation.max}
                  </Text>{" "}
                  based on brand, age ({purchaseYear}), and condition.
                </Text>
              </View>
            ) : null}

            <Text className="text-xs font-jakartaSemibold text-muted mb-1">
              Your Asking Price * (₹)
            </Text>
            <View className="flex-row items-center rounded-xl border border-border bg-bg px-3">
              <Text className="font-jakartaBold text-muted mr-1">₹</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="e.g. 950"
                placeholderTextColor={colors.subtle}
                keyboardType="numeric"
                className="flex-1 py-3 font-jakarta text-base text-ink"
              />
            </View>
          </View>
        ) : null}

        {/* Description */}
        <Text className="text-xs font-jakartaBold text-muted uppercase mb-1">
          Detailed Description (Optional)
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Mention meetup preference on campus (Hostel, Library, Tech Park)..."
          placeholderTextColor={colors.subtle}
          multiline
          className="rounded-xl border border-border bg-surface px-4 py-3 font-jakarta text-sm text-ink mb-6 h-24"
          style={{ textAlignVertical: "top" }}
        />

        {/* Submit Button */}
        <Button
          label="Publish to Campus"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={
            !title.trim() ||
            !anglePhotos.front ||
            (listingType === "sell" && !price.trim())
          }
          onPress={handlePublish}
        />
      </ScrollView>
    </View>
  );
}
