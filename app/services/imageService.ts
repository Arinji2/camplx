// services/imageService.ts
import * as ImagePicker from "expo-image-picker";

export type PickedImage = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
};

/**
 * Capture an item photo directly using the device camera.
 */
export async function takePhoto(): Promise<PickedImage | null> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert(
        "Camera permission is required to capture product photos for inspection.",
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const a = result.assets[0];
    return {
      uri: a.uri,
      mimeType: a.mimeType || "image/jpeg",
      fileSize: a.fileSize,
      width: a.width,
      height: a.height,
    };
  } catch (err) {
    console.warn("[imageService] takePhoto error:", err);
    return null;
  }
}

/**
 * Pick images from the media library as secondary option.
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
      quality: 0.85,
    });
    if (result.canceled) return [];

    return result.assets.map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType || "image/jpeg",
      fileSize: a.fileSize,
      width: a.width,
      height: a.height,
    }));
  } catch (err) {
    console.warn("[imageService] pickImages error:", err);
    return [];
  }
}

export async function assetToBase64(asset: PickedImage): Promise<string> {
  try {
    const res = await fetch(asset.uri);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(",");
    return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  } catch (e) {
    return "";
  }
}

export async function uploadListingImage(
  _userId: string,
  _listingId: string,
  asset: PickedImage,
): Promise<string> {
  return asset.uri;
}
