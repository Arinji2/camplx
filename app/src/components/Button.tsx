import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { colors, shadows } from "@/lib/theme";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "md" | "lg";

type ButtonProps = {
  label?: string;
  children?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

export function Button({
  label,
  children,
  onPress,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const bgStyle =
    variant === "primary"
      ? { backgroundColor: colors.primary }
      : variant === "outline"
        ? {
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: colors.border,
          }
        : { backgroundColor: "transparent" };

  const paddingStyle =
    size === "lg"
      ? { paddingVertical: 14, paddingHorizontal: 20 }
      : { paddingVertical: 10, paddingHorizontal: 16 };

  const textColor = variant === "primary" ? "#ffffff" : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        bgStyle,
        paddingStyle,
        {
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          width: fullWidth ? "100%" : undefined,
          opacity: isDisabled ? 0.6 : 1,
        },
        variant !== "ghost" && shadows.soft,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          {children || (
            <Text
              style={{
                color: textColor,
                fontWeight: "700",
                fontSize: size === "lg" ? 16 : 14,
              }}
            >
              {label}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
