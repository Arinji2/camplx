// services/listingService.ts
import { db, DEMO_CAMPUS, DEMO_USER } from "@/lib/database";
import type { ListingType, ListingWithImages } from "@/types";

export type FetchFeedPageParams = {
  limit?: number;
  offset?: number;
};

export type SearchListingsParams = {
  query?: string;
  category?: string | null;
  limit?: number;
  offset?: number;
};

export type PublicProfile = {
  id: string;
  display_name: string | null;
  points: number;
  cumulative_carbon_g: number;
};

export type CreateListingInput = {
  sellerId: string;
  campusId: string;
  listingType: ListingType;
  title: string;
  description: string | null;
  category: string;
  condition: string | null;
  price: number | null;
};

export async function fetchFeedPage({
  limit = 20,
  offset = 0,
}: FetchFeedPageParams = {}): Promise<ListingWithImages[]> {
  const all = await db.getListings();
  const active = all.filter(
    (l) => l.status === "active" || l.status === "reserved",
  );
  return active.slice(offset, offset + limit);
}

export async function searchListings({
  query = "",
  category = null,
  limit = 20,
  offset = 0,
}: SearchListingsParams = {}): Promise<ListingWithImages[]> {
  const all = await db.getListings();
  let results = all.filter(
    (l) => l.status === "active" || l.status === "reserved",
  );

  if (category) {
    results = results.filter(
      (l) => l.category.toLowerCase() === category.toLowerCase(),
    );
  }

  const q = query.trim().toLowerCase();
  if (q.length > 0) {
    results = results.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        l.category.toLowerCase().includes(q),
    );
  }

  return results.slice(offset, offset + limit);
}

export async function fetchMyListings(
  sellerId: string,
): Promise<ListingWithImages[]> {
  const all = await db.getListings();
  return all.filter((l) => l.seller_id === sellerId);
}

export async function fetchSellerListings(
  sellerId: string,
): Promise<ListingWithImages[]> {
  const all = await db.getListings();
  return all.filter((l) => l.seller_id === sellerId && l.status === "active");
}

export async function fetchPublicProfile(
  id: string,
): Promise<PublicProfile | null> {
  if (id === DEMO_USER.id) {
    return {
      id: DEMO_USER.id,
      display_name: DEMO_USER.display_name,
      points: DEMO_USER.points,
      cumulative_carbon_g: DEMO_USER.cumulative_carbon_g,
    };
  }
  return {
    id,
    display_name: "Campus Seller",
    points: 190,
    cumulative_carbon_g: 12000,
  };
}

export async function fetchListingsByIds(
  ids: string[],
): Promise<ListingWithImages[]> {
  if (ids.length === 0) return [];
  const all = await db.getListings();
  return all.filter((l) => ids.includes(l.id));
}

export async function fetchListingById(
  id: string,
): Promise<ListingWithImages | null> {
  return db.getListingById(id);
}

export async function createListing(
  input: CreateListingInput,
): Promise<string> {
  const id = await db.createListing({
    seller_id: input.sellerId,
    campus_id: input.campusId,
    listing_type: input.listingType,
    title: input.title,
    description: input.description,
    category: input.category,
    condition: input.condition,
    price: input.listingType === "sell" ? input.price : null,
    status: "active",
    carbon_savings_g:
      input.category === "cycles"
        ? 90000
        : input.category === "furniture"
          ? 30000
          : 5000,
    listing_images: [],
  });
  return id;
}

export async function addListingImage(
  listingId: string,
  storagePath: string,
  displayOrder: number,
): Promise<void> {
  const listing = await db.getListingById(listingId);
  if (!listing) return;
  const newImg = {
    id: `img-${Date.now()}-${displayOrder}`,
    listing_id: listingId,
    storage_path: storagePath,
    display_order: displayOrder,
  };
  const updatedImages = [...listing.listing_images, newImg];
  await db.updateListing(listingId, { listing_images: updatedImages });
}
