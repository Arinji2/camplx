import { Text, View } from "react-native";

type BadgeTone = "condition" | "category" | "neutral" | "success";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

const TONE_CONTAINER: Record<BadgeTone, string> = {
  condition: "bg-amber-100",
  category: "bg-blue-100",
  neutral: "bg-slate-100",
  success: "bg-green-100",
};

const TONE_TEXT: Record<BadgeTone, string> = {
  condition: "text-amber-800",
  category: "text-blue-800",
  neutral: "text-slate-600",
  success: "text-green-800",
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return (
    <View
      className={`self-start rounded-full px-2.5 py-1 ${TONE_CONTAINER[tone]}`}
    >
      <Text className={`text-xs font-semibold ${TONE_TEXT[tone]}`}>
        {label}
      </Text>
    </View>
  );
}
