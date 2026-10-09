import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bike,
  BookOpen,
  Laptop,
  Package,
  Sofa,
  Lamp,
  type LucideIcon,
} from "lucide-react-native";
import { colors } from "@/lib/theme";

const CATEGORY_MAP: Record<string, { icon: LucideIcon; label: string }> = {
  books: { icon: BookOpen, label: "Textbooks & Notes" },
  electronics: { icon: Laptop, label: "Electronics" },
  furniture: { icon: Sofa, label: "Hostel Furniture" },
  hostel_essentials: { icon: Lamp, label: "Hostel Essentials" },
  cycles: { icon: Bike, label: "Commuter Cycles" },
};

export function ListingImagePlaceholder({
  category,
  label = true,
}: {
  category: string;
  label?: boolean;
}) {
  const item = CATEGORY_MAP[category] || {
    icon: Package,
    label: "Campus Item",
  };
  const Icon = item.icon;

  return (
    <LinearGradient
      colors={[colors.borderLight, "#ffffff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: "#ffffff",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <Icon size={34} color={colors.primary} />
      </View>
      {label ? (
        <Text
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: "600",
            color: colors.muted,
          }}
        >
          {item.label}
        </Text>
      ) : null}
    </LinearGradient>
  );
}
