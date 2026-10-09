import { Pressable, Text, View } from "react-native";
import type { DefectItem } from "@/types/api";

type DefectAnnotationOverlayProps = {
  defects: DefectItem[];
  selectedDefectId?: string | null;
  onSelectDefect?: (defect: DefectItem) => void;
};

export function DefectAnnotationOverlay({
  defects,
  selectedDefectId,
  onSelectDefect,
}: DefectAnnotationOverlayProps) {
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="box-none"
    >
      {defects.map((def, idx) => {
        const [ymin, xmin, ymax, xmax] = def.box_2d;
        const top = `${(ymin / 1000) * 100}%` as any;
        const left = `${(xmin / 1000) * 100}%` as any;
        const width = `${((xmax - xmin) / 1000) * 100}%` as any;
        const height = `${((ymax - ymin) / 1000) * 100}%` as any;

        const isSelected = selectedDefectId === def.id;

        return (
          <Pressable
            key={def.id}
            onPress={() => onSelectDefect?.(def)}
            style={{
              position: "absolute",
              top,
              left,
              width,
              height,
              borderWidth: 2,
              borderColor: isSelected ? "#EF4444" : "#F59E0B",
              backgroundColor: isSelected
                ? "rgba(239, 68, 68, 0.22)"
                : "rgba(245, 158, 11, 0.15)",
              borderRadius: 6,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -11,
                left: -7,
                backgroundColor: isSelected ? "#EF4444" : "#F59E0B",
                borderRadius: 999,
                width: 20,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: "#ffffff", fontSize: 10, fontWeight: "bold" }}
              >
                {idx + 1}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
