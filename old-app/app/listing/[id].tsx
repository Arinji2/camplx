import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Gift,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
} from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ListingImagePlaceholder } from "@/components/ListingImagePlaceholder";
import { ReservationActions } from "@/components/ReservationActions";
import { Skeleton } from "@/components/Skeleton";
import { useListing } from "@/hooks/useListings";
import { db, type DefectItem, type InspectionResult } from "@/lib/database";
import { getListingImageUrl } from "@/lib/storage";
import { colors, shadows } from "@/lib/theme";
import type { ListingStatus } from "@/types";

function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data: listing, isLoading, isError } = useListing(id);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedDefect, setSelectedDefect] = useState<DefectItem | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (id) {
        const res = await db.getInspectionByListingId(id);
        if (active && res) {
          setInspection(res);
          if (res.defects && res.defects.length > 0) {
            setSelectedDefect(res.defects[0]);
          }
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg px-4 pt-14">
        <Skeleton width="100%" height={260} radius={24} />
        <Skeleton width="80%" height={26} radius={8} className="mt-5" />
        <Skeleton width="40%" height={20} radius={8} className="mt-3" />
      </View>
    );
  }

  if (isError || !listing) {
    return (
      <View className="flex-1 bg-bg pt-14">
        <EmptyState
          icon="🔍"
          title="Listing Not Found"
          subtitle="This item may have already found a student home."
          action={{ label: "Go to Feed", onPress: goBack }}
        />
      </View>
    );
  }

  const imageHeight = width * 0.78;
  const isDonate = listing.listing_type === "donate";
  const images = [...listing.listing_images].sort(
    (a, b) => a.display_order - b.display_order,
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Back Button */}
      <View className="absolute left-4 top-12 z-20">
        <Pressable
          onPress={goBack}
          style={shadows.soft}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-surface/90 backdrop-blur-md active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-12"
      >
        {/* Main Product Image with Computer Vision Annotation Overlay */}
        <View
          className="relative overflow-hidden rounded-b-3xl bg-surface"
          style={{ width, height: imageHeight }}
        >
          {inspection?.annotatedImageBase64 && showAnnotations ? (
            <Image
              source={{
                uri: `data:image/jpeg;base64,${inspection.annotatedImageBase64}`,
              }}
              style={{ width, height: imageHeight }}
              resizeMode="cover"
            />
          ) : images.length > 0 ? (
            <View style={{ width, height: imageHeight, position: "relative" }}>
              <Image
                source={{ uri: getListingImageUrl(images[0].storage_path) }}
                style={{ width, height: imageHeight }}
                resizeMode="cover"
              />

              {/* Render dynamic coordinate boxes if original image is shown */}
              {inspection && showAnnotations && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  pointerEvents="box-none"
                >
                  {inspection.defects.map((def, idx) => {
                    const [ymin, xmin, ymax, xmax] = def.box_2d;
                    const top = `${(ymin / 1000) * 100}%`;
                    const left = `${(xmin / 1000) * 100}%`;
                    const boxHeight = `${((ymax - ymin) / 1000) * 100}%`;
                    const boxWidth = `${((xmax - xmin) / 1000) * 100}%`;

                    const isSelected = selectedDefect?.id === def.id;

                    return (
                      <Pressable
                        key={def.id}
                        onPress={() => setSelectedDefect(def)}
                        style={{
                          position: "absolute",
                          top: top as any,
                          left: left as any,
                          width: boxWidth as any,
                          height: boxHeight as any,
                          borderWidth: 2,
                          borderColor: isSelected ? "#EF4444" : "#F59E0B",
                          backgroundColor: isSelected
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(245, 158, 11, 0.15)",
                          borderRadius: 6,
                        }}
                      >
                        <View
                          style={{
                            position: "absolute",
                            top: -10,
                            left: -6,
                            backgroundColor: isSelected ? "#EF4444" : "#F59E0B",
                            borderRadius: 10,
                            width: 18,
                            height: 18,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 9,
                              fontWeight: "bold",
                            }}
                          >
                            {idx + 1}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            <ListingImagePlaceholder category={listing.category} />
          )}

          {/* Toggle Annotation View Button */}
          {inspection && (
            <Pressable
              onPress={() => setShowAnnotations((prev) => !prev)}
              style={shadows.soft}
              className="absolute bottom-3 right-3 flex-row items-center rounded-full bg-surface/90 px-3 py-1.5 backdrop-blur-md active:opacity-80"
            >
              {showAnnotations ? (
                <>
                  <EyeOff size={13} color={colors.ink} />
                  <Text className="ml-1 text-[11px] font-jakartaBold text-ink">
                    Hide Defect Tags
                  </Text>
                </>
              ) : (
                <>
                  <Eye size={13} color={colors.primaryDark} />
                  <Text className="ml-1 text-[11px] font-jakartaBold text-primaryDark">
                    Show AI Tags ({inspection.defects.length})
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <View className="px-5 pt-4">
          {/* Header Indicators */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row gap-2">
              <Badge
                label={
                  listing.status === "active" ? "Available" : listing.status
                }
                tone={listing.status === "active" ? "success" : "condition"}
              />
              {inspection && (
                <View
                  className={`rounded-full px-2.5 py-1 ${
                    inspection.circular_lifecycle_category === "Reusable"
                      ? "bg-green-100"
                      : "bg-blue-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-jakartaBold ${
                      inspection.circular_lifecycle_category === "Reusable"
                        ? "text-green-800"
                        : "text-blue-800"
                    }`}
                  >
                    ● {inspection.circular_lifecycle_category}
                  </Text>
                </View>
              )}
            </View>

            {listing.carbon_savings_g ? (
              <Text className="text-xs font-jakartaBold text-primaryDark">
                🌱 {(listing.carbon_savings_g / 1000).toFixed(1)} kg CO₂ Saved
              </Text>
            ) : null}
          </View>

          {/* Title */}
          <Text className="mt-3 text-2xl font-jakartaExtrabold text-ink">
            {listing.title}
          </Text>

          {/* Pricing Row */}
          <View className="mt-2 flex-row items-baseline justify-between">
            {isDonate ? (
              <View className="flex-row items-center rounded-full bg-green-50 px-3 py-1.5">
                <Gift size={16} color={colors.green[600]} />
                <Text className="ml-1.5 text-sm font-jakartaSemibold text-green-700">
                  Campus Donation (Free)
                </Text>
              </View>
            ) : (
              <View className="flex-row items-baseline gap-2">
                <Text className="text-2xl font-jakartaExtrabold text-ink">
                  {formatPrice(listing.price)}
                </Text>
                {inspection?.pricing?.estimated_retail_new && (
                  <Text className="text-sm font-jakarta text-subtle line-through">
                    ₹{Math.round(inspection.pricing.estimated_retail_new)} new
                  </Text>
                )}
              </View>
            )}
            <Text className="text-xs font-jakartaMedium text-muted">
              Grade:{" "}
              <Text className="font-jakartaBold text-ink">
                {listing.condition}
              </Text>
            </Text>
          </View>

          {/* AI Inspection Panel with Defect Highlights */}
          {inspection && (
            <View
              style={shadows.card}
              className="mt-5 rounded-2xl border border-borderLight bg-surface p-4"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ShieldCheck size={18} color={colors.primaryDark} />
                  <Text className="ml-2 text-base font-jakartaBold text-ink">
                    AI Visual Condition Report
                  </Text>
                </View>
                <Badge
                  label={`${inspection.defects.length} Observations`}
                  tone={inspection.defects.length > 0 ? "condition" : "success"}
                />
              </View>

              {/* Price Intelligence Box */}
              {inspection.pricing && !isDonate && (
                <View className="mt-3 rounded-xl bg-borderLight/70 p-3">
                  <Text className="text-xs font-jakartaBold text-ink">
                    Fair Price Valuation: ₹
                    {Math.round(inspection.pricing.recommended_listing_price)}
                  </Text>
                  <Text className="mt-1 text-[11px] font-jakarta text-muted">
                    {inspection.pricing.pricing_rationale}
                  </Text>
                  {inspection.pricing.condition_penalty_amount > 0 && (
                    <Text className="mt-1 text-[11px] font-jakartaBold text-danger-text">
                      -₹{inspection.pricing.condition_penalty_amount} deducted
                      for visible surface wear.
                    </Text>
                  )}
                </View>
              )}

              {/* Defect Items */}
              <View className="mt-3 gap-2">
                {inspection.defects.length === 0 ? (
                  <View className="flex-row items-center py-1">
                    <CheckCircle2 size={14} color={colors.green[600]} />
                    <Text className="ml-1.5 text-xs font-jakarta text-green-700">
                      Zero cosmetic flaws or structural wear identified.
                    </Text>
                  </View>
                ) : (
                  inspection.defects.map((d, index) => {
                    const isSelected = selectedDefect?.id === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => setSelectedDefect(d)}
                        className={`rounded-xl p-3 border ${
                          isSelected
                            ? "border-amber-base bg-amber-50/70"
                            : "border-borderLight bg-bg"
                        }`}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center flex-1">
                            <View className="h-5 w-5 items-center justify-center rounded-full bg-navy mr-2">
                              <Text className="text-[10px] font-jakartaBold text-white">
                                {index + 1}
                              </Text>
                            </View>
                            <Text className="text-xs font-jakartaBold text-ink">
                              {d.defect_type}
                            </Text>
                          </View>
                          <Text className="text-[10px] font-jakartaBold text-amber-text uppercase">
                            {d.severity}
                          </Text>
                        </View>
                        <Text className="mt-1 text-xs font-jakarta text-muted">
                          {d.buyer_note}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <View className="mt-3 flex-row items-start rounded-xl bg-borderLight/40 p-2.5">
                <Info size={13} color={colors.subtle} />
                <Text className="ml-2 flex-1 text-[10px] font-jakarta text-subtle">
                  Important: Camera analysis covers external visible wear only.
                  Internal battery health and hardware should be verified in
                  person.
                </Text>
              </View>
            </View>
          )}

          {/* Amazon-Style Bullet Points */}
          {inspection?.amazon_listing?.key_features_bullets && (
            <View
              style={shadows.soft}
              className="mt-4 rounded-2xl bg-surface p-4"
            >
              <Text className="text-sm font-jakartaBold text-ink mb-2">
                About this item
              </Text>
              {inspection.amazon_listing.key_features_bullets.map(
                (bullet, index) => (
                  <View key={index} className="flex-row items-start mb-1.5">
                    <Text className="text-primaryDark mr-2">•</Text>
                    <Text className="flex-1 text-xs font-jakarta leading-5 text-ink">
                      {bullet}
                    </Text>
                  </View>
                ),
              )}
            </View>
          )}

          {/* Technical Specifications Table */}
          {inspection?.amazon_listing?.technical_specifications &&
            Object.keys(inspection.amazon_listing.technical_specifications)
              .length > 0 && (
              <View
                style={shadows.soft}
                className="mt-4 rounded-2xl bg-surface overflow-hidden"
              >
                <View className="bg-borderLight/70 px-4 py-2.5">
                  <Text className="text-xs font-jakartaBold text-ink">
                    Technical Specifications
                  </Text>
                </View>
                {Object.entries(
                  inspection.amazon_listing.technical_specifications,
                ).map(([key, val], idx, arr) => (
                  <View
                    key={key}
                    className={`flex-row justify-between px-4 py-2.5 ${
                      idx !== arr.length - 1
                        ? "border-b border-borderLight"
                        : ""
                    }`}
                  >
                    <Text className="text-xs font-jakartaMedium text-muted">
                      {key}
                    </Text>
                    <Text className="text-xs font-jakartaBold text-ink">
                      {val}
                    </Text>
                  </View>
                ))}
              </View>
            )}

          {/* Seller Description */}
          {listing.description ? (
            <View className="mt-4">
              <Text className="text-sm font-jakartaSemibold text-ink mb-1">
                Seller's Note
              </Text>
              <Text className="text-xs font-jakarta leading-5 text-muted">
                {listing.description}
              </Text>
            </View>
          ) : null}

          {/* Verified Seller Campus Profile */}
          <Pressable
            onPress={() => router.push(`/seller/${listing.seller_id}`)}
            style={shadows.soft}
            className="mt-5 flex-row items-center rounded-2xl bg-surface p-3.5 active:opacity-80"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-green-50 mr-3">
              <User size={18} color={colors.green[600]} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-jakartaBold text-ink">
                Verified Student on DPU Campus
              </Text>
              <Text className="text-[11px] font-jakarta text-subtle">
                Handoff directly on campus grounds • No transaction fees
              </Text>
            </View>
            <ChevronRight size={18} color={colors.subtle} />
          </Pressable>

          {/* Reservation and Pickup Intent Actions */}
          <View className="mt-4">
            <ReservationActions listing={listing} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
