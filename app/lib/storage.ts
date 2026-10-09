// lib/storage.ts
/**
 * Resolves a listing image path or local URI into a renderable source.
 */
export const LISTING_IMAGES_BUCKET = "listing-images";

export function getListingImageUrl(storagePath: string): string {
  if (!storagePath) return "";
  // If it's already an HTTP URL or local file URI, return directly
  if (
    storagePath.startsWith("http://") ||
    storagePath.startsWith("https://") ||
    storagePath.startsWith("file://") ||
    storagePath.startsWith("data:")
  ) {
    return storagePath;
  }
  return storagePath;
}
