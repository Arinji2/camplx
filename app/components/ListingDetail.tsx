// components/ListingDetail.tsx
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Gift,
  Info,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { ListingImagePlaceholder } from "@/components/ListingImagePlaceholder";
import {
  db,
  type InspectionFinding,
  type InspectionResult,
} from "@/lib/database";
import { getListingImageUrl } from "@/lib/storage";
import { colors, shadows } from "@/lib/theme";
import type { ListingStatus, ListingWithImages } from "@/types";

function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}

type BadgeTone = "condition" | "category" | "neutral" | "success";

function statusPill(status: ListingStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case "active":
      return { label: "Available", tone: "success" };
    case "reserved":
      return { label: "Reserved", tone: "condition" };
    case "sold":
      return { label: "Sold", tone: "neutral" };
    case "donated":
      return { label: "Donated", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

type ListingDetailProps = {
  listing: ListingWithImages;
};

function MetaRow({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3.5 ${
        divider ? "border-b border-borderLight" : ""
      }`}
    >
      <Text className="text-sm font-jakartaMedium text-muted">{label}</Text>
      <Text className="text-sm font-jakartaSemibold text-ink">{value}</Text>
    </View>
  );
}

export function ListingDetail({ listing }: ListingDetailProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDonate = listing.listing_type === "donate";
  const pill = statusPill(listing.status);
  const hasCondition = Boolean(listing.condition);
  const images = [...listing.listing_images].sort(
    (a, b) => a.display_order - b.display_order,
  );

  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [showDefectOverlay, setShowDefectOverlay] = useState(true);
  const [selectedFinding, setSelectedFinding] =
    useState<InspectionFinding | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await db.getInspectionByListingId(listing.id);
      if (active && res) {
        setInspection(res);
        if (res.findings.length > 0) {
          setSelectedFinding(res.findings[0]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [listing.id]);

  const imageHeight = width * 0.78;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="pb-10"
    >
      {/* Primary Image View with Defect Overlay */}
      <View
        className="relative overflow-hidden rounded-b-3xl bg-surface"
        style={{ width, height: imageHeight }}
      >
        {images.length > 0 ? (
          <View style={{ width, height: imageHeight, position: "relative" }}>
            <Image
              source={{ uri: getListingImageUrl(images[0].storage_path) }}
              style={{ width, height: imageHeight }}
              resizeMode="cover"
            />

            {/* Coordinate-Based Defect Markers */}
            {inspection && showDefectOverlay && (
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
                {inspection.findings.map((f, index) => {
                  if (!f.location) return null;
                  const isSelected = selectedFinding?.id === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setSelectedFinding(f)}
                      style={{
                        position: "absolute",
                        left: `${f.location.x}%`,
                        top: `${f.location.y}%`,
                        width: `${f.location.width}%`,
                        height: `${f.location.height}%`,
                        borderWidth: 2,
                        borderColor: isSelected ? "#EF4444" : "#F59E0B",
                        backgroundColor: isSelected
                          ? "rgba(239, 68, 68, 0.25)"
                          : "rgba(245, 158, 11, 0.15)",
                        borderRadius: 8,
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          top: -12,
                          left: -8,
                          backgroundColor: isSelected ? "#EF4444" : "#F59E0B",
                          borderRadius: 999,
                          width: 20,
                          height: 20,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        >
                          {index + 1}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={{ width, height: imageHeight }}>
            <ListingImagePlaceholder category={listing.category} />
          </View>
        )}

        {/* Toggle Overlay Button */}
        {inspection && (
          <Pressable
            onPress={() => setShowDefectOverlay((prev) => !prev)}
            style={shadows.soft}
            className="absolute bottom-3 right-3 flex-row items-center rounded-full bg-surface/90 px-3 py-1.5 backdrop-blur-md active:opacity-80"
          >
            {showDefectOverlay ? (
              <>
                <EyeOff size={14} color={colors.ink} />
                <Text className="ml-1.5 text-xs font-jakartaBold text-ink">
                  Hide AI Tags
                </Text>
              </>
            ) : (
              <>
                <Eye size={14} color={colors.primary} />
                <Text className="ml-1.5 text-xs font-jakartaBold text-primaryDark">
                  Show AI Tags ({inspection.findings.length})
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <View className="px-5 pt-5">
        <View className="flex-row items-center justify-between">
          <Badge label={pill.label} tone={pill.tone} />
          {inspection && (
            <View className="flex-row items-center rounded-full bg-green-50 px-2.5 py-1">
              <ShieldCheck size={14} color={colors.primary} />
              <Text className="ml-1 text-xs font-jakartaBold text-green-700">
                Gemini Vision Verified
              </Text>
            </View>
          )}
        </View>

        <Text className="mt-3 text-2xl font-jakartaExtrabold text-ink">
          {listing.title}
        </Text>

        {/* Price Section */}
        <View className="mt-2 flex-row items-baseline justify-between">
          {isDonate ? (
            <View className="flex-row items-center self-start rounded-full bg-green-50 px-3 py-1.5">
              <Gift size={16} color={colors.green[600]} />
              <Text className="ml-1.5 text-sm font-jakartaSemibold text-green-700">
                Free to a good home
              </Text>
            </View>
          ) : (
            <Text className="text-2xl font-jakartaExtrabold text-ink">
              {formatPrice(listing.price)}
            </Text>
          )}

          {listing.carbon_savings_g ? (
            <Text className="text-xs font-jakartaBold text-primaryDark">
              🌱 {(listing.carbon_savings_g / 1000).toFixed(1)} kg CO₂ Saved
            </Text>
          ) : null}
        </View>

        {/* Meta Info */}
        <View
          style={shadows.soft}
          className="mt-5 overflow-hidden rounded-2xl bg-surface"
        >
          <MetaRow
            label="Category"
            value={listing.category}
            divider={hasCondition}
          />
          {hasCondition ? (
            <MetaRow label="Condition" value={listing.condition as string} />
          ) : null}
        </View>

        {/* AI Surface Inspection Section */}
        {inspection && (
          <View
            style={shadows.card}
            className="mt-6 rounded-2xl border border-borderLight bg-surface p-4"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Sparkles size={16} color={colors.violet.base} />
                <Text className="ml-2 text-base font-jakartaBold text-ink">
                  AI Product Inspection
                </Text>
              </View>
              <Badge
                label={`${inspection.findings.length} Noted`}
                tone="condition"
              />
            </View>

            <Text className="mt-1 text-xs font-jakarta text-muted">
              Computer-vision inspection highlighting cosmetic wear points.
            </Text>

            {/* Findings List */}
            <View className="mt-3 gap-2">
              {inspection.findings.map((f, idx) => {
                const isSelected = selectedFinding?.id === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setSelectedFinding(f)}
                    className={`rounded-xl p-3 border ${
                      isSelected
                        ? "border-amber-base bg-amber-50/50"
                        : "border-borderLight bg-bg"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="mr-2 h-5 w-5 items-center justify-center rounded-full bg-navy">
                          <Text className="text-[10px] font-jakartaBold text-white">
                            {idx + 1}
                          </Text>
                        </View>
                        <Text className="text-sm font-jakartaBold text-ink">
                          {f.label}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <CheckCircle2 size={12} color={colors.green[600]} />
                        <Text className="ml-1 text-[11px] font-jakartaMedium text-green-700 capitalize">
                          {f.reviewStatus}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-1.5 text-xs font-jakarta text-muted">
                      {f.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* AI Disclaimer */}
            <View className="mt-3 flex-row items-start rounded-xl bg-borderLight/60 p-2.5">
              <Info size={14} color={colors.subtle} />
              <Text className="ml-2 flex-1 text-[11px] font-jakarta text-subtle">
                Visual inspection aid only. Internal battery health and
                electronics must be checked in person during handoff.
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        {listing.description ? (
          <View className="mt-5">
            <Text className="mb-1.5 text-sm font-jakartaSemibold text-ink">
              Description
            </Text>
            <Text className="text-base leading-6 font-jakarta text-muted">
              {listing.description}
            </Text>
          </View>
        ) : null}

        {/* Seller Info */}
        <Pressable
          onPress={() => router.push(`/seller/${listing.seller_id}`)}
          style={shadows.soft}
          className="mt-5 flex-row items-center rounded-2xl bg-surface px-4 py-3.5 active:opacity-80"
        >
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-green-50">
            <User size={18} color={colors.green[600]} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-jakartaSemibold text-ink">
              Verified Student Seller
            </Text>
            <Text className="text-xs font-jakarta text-subtle">
              Safe handoff on campus
            </Text>
          </View>
          <ChevronRight size={20} color={colors.subtle} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default ListingDetail;
