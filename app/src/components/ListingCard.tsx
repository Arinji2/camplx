import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Gift, Heart } from "lucide-react-native";
import { ListingImagePlaceholder } from "./ListingImagePlaceholder";
import { colors, shadows } from "@/lib/theme";
import { useWishlistStore } from "@/stores/wishlistStore";
import type { ListingSummary } from "@/types/api";

type ListingCardProps = {
  listing: ListingSummary;
  onPress?: () => void;
};

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const router = useRouter();
  const isDonate = listing.listing_type === "donate";

  const handlePress = onPress || (() => router.push(`/listing/${listing.id}`));

  // Wishlist is stored locally-first so the heart flips instantly; the store
  // reconciles with `wishlistApi` and rolls back if that call rejects.
  const saved = useWishlistStore((s) => s.ids.includes(listing.id));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  return (
    <Pressable
      onPress={handlePress}
      style={[
        shadows.card,
        {
          backgroundColor: "#ffffff",
          borderRadius: 24,
          overflow: "hidden",
          marginBottom: 14,
        },
      ]}
    >
      <View
        style={{
          width: "100%",
          height: 180,
          backgroundColor: colors.borderLight,
          position: "relative",
        }}
      >
        {listing.primary_image_url ? (
          <Image
            source={{ uri: listing.primary_image_url }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <ListingImagePlaceholder category={listing.category} />
        )}

        {/* Wishlist heart overlay (top-right). Its own Pressable stops the press
            from bubbling to the card, so tapping the heart toggles the wishlist
            WITHOUT navigating to the detail screen. */}
        <Pressable
          onPress={() => toggleWishlist(listing.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            saved
              ? `Remove ${listing.title} from wishlist`
              : `Save ${listing.title} to wishlist`
          }
          accessibilityState={{ selected: saved }}
          style={shadows.soft}
          className="absolute right-2.5 top-2.5 h-9 w-9 items-center justify-center rounded-full bg-surface active:opacity-80"
        >
          <Heart
            size={18}
            color={saved ? colors.primary : colors.muted}
            fill={saved ? colors.primary : "transparent"}
          />
        </Pressable>
      </View>

      <View style={{ padding: 16 }}>
        <Text
          style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}
          numberOfLines={1}
        >
          {listing.title}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: colors.subtle,
            textTransform: "uppercase",
            marginTop: 3,
          }}
        >
          {listing.category} • {listing.condition}
        </Text>

        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {isDonate ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.green[50],
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Gift size={13} color={colors.primary} />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.green[700],
                }}
              >
                Free Donation
              </Text>
            </View>
          ) : (
            <Text
              style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}
            >
              ₹{Math.round(listing.asking_price || 0).toLocaleString("en-IN")}
            </Text>
          )}

          {listing.carbon_savings_g ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: colors.primaryDark,
              }}
            >
              🌱 {(listing.carbon_savings_g / 1000).toFixed(1)} kg CO₂ Saved
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
