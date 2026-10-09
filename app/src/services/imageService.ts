import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type PickedImage = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
};

const IMAGE_QUALITY = 0.85;

/**
 * Capture a single product photo directly through the device camera.
 *
 * Editing is disabled on purpose: the inspection pipeline needs the original,
 * uncropped frame so `box_2d` coordinates normalized to the 0-1000 scale stay
 * aligned with the pixels Gemini actually saw.
 *
 * Returns `null` when permission is denied, the user cancels, or the picker
 * errors — callers should treat `null` as "no photo taken", not a failure.
 */
export async function takePhoto(): Promise<PickedImage | null> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Camera permission is required to capture product photos for inspection.",
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: IMAGE_QUALITY,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    console.warn("[imageService] takePhoto error:", error);
    return null;
  }
}

/**
 * Pick one or more images from the device media library. Used as the
 * secondary path when a listing needs extra angles (back, left, right,
 * defect close-up, label/serial) beyond the primary camera capture.
 *
 * Returns an empty array when permission is denied or the user cancels.
 */
export async function pickImages(
  options: { multiple?: boolean } = {},
): Promise<PickedImage[]> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return [];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: options.multiple ?? true,
      quality: IMAGE_QUALITY,
    });

    if (result.canceled || !result.assets) return [];

    return result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
    }));
  } catch (error) {
    console.warn("[imageService] pickImages error:", error);
    return [];
  }
}

/**
 * Derive a filename from a local picker URI. React Native provides no file
 * path metadata, so this falls back to a stable extension-aware name.
 */
export function imageFileName(image: PickedImage, index: number): string {
  const extension =
    image.mimeType && image.mimeType.includes("/")
      ? image.mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"
      : "jpg";
  return `inspection-${index}.${extension}`;
}
