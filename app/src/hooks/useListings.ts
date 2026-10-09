import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import { listingsApi } from "@/api";
import type {
  ListingDetailResponse,
  ListingSummary,
  PaginatedListingsResponse,
  PublicSellerProfileResponse,
  SellerProfileWithListingsResponse,
} from "@/types/api";

/** Feed page size — kept in one place so pagination math stays consistent. */
export const FEED_PAGE_SIZE = 20;

/** How many rows to pull when a screen needs "everything by this seller". */
const BROAD_PAGE_SIZE = 100;

/**
 * Project a full listing detail down to the summary shape that `ListingCard`
 * and the wishlist consume. Used whenever a detail response arrives from a
 * lookup endpoint that only returns the detail envelope.
 */
export function toListingSummary(
  detail: ListingDetailResponse,
): ListingSummary {
  return {
    id: detail.id,
    seller_id: detail.seller_id,
    title: detail.title,
    brand: detail.brand,
    model: detail.model,
    category: detail.category,
    condition: detail.condition,
    listing_type: detail.listing_type,
    asking_price: detail.asking_price,
    status: detail.status,
    carbon_savings_g: detail.carbon_savings_g,
    primary_image_url: detail.images[0]?.image_url || "",
    created_at: detail.created_at,
  };
}

/**
 * Campus feed hook (design §1.6 Flow 4, Req 4.1, 4.6, 8.2). Wraps
 * `GET /listings` in an infinite query so the feed loads incrementally as the
 * user scrolls (Req 8.2). Campus scoping and active-only filtering are handled
 * by the FastAPI gateway.
 *
 * `getNextPageParam` advances the page only while a full page came back — a
 * short/empty page means the end of the feed, so we return `undefined` to stop.
 */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listingsApi.listMarketplaceListings({
        status: "active",
        page: pageParam,
        per_page: FEED_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.items.length < FEED_PAGE_SIZE
        ? undefined
        : allPages.length + 1,
  });
}

/**
 * Flatten the paged feed data into a single list for a FlatList. Safe to call
 * with `undefined` while the first page is loading.
 */
export function flattenFeed(
  data: InfiniteData<PaginatedListingsResponse, number> | undefined,
): ListingSummary[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

/**
 * Single listing hook for the detail screen (design §4.2 `listing/[id].tsx`,
 * Req 4.6). Disabled until an `id` is present so the route param can hydrate.
 * Resolves to `null` instead of throwing when a listing is missing or the
 * backend is unreachable, so the screen can render a clean not-found state.
 */
export function useListing(id: string | undefined) {
  return useQuery<ListingDetailResponse | null, Error>({
    queryKey: ["listing", id],
    queryFn: async () => {
      try {
        return await listingsApi.getListingDetail(id as string);
      } catch {
        return null;
      }
    },
    enabled: Boolean(id),
  });
}

/**
 * Search + category-filter hook for the Search screen (design §4.2
 * `(tabs)/search.tsx`; Req 4.2, 4.3, 4.5, 4.6). Always enabled — an empty query
 * with no category simply returns the recent active campus feed, so the screen
 * shows content on first open. Query and category are both part of the cache
 * key, and a short `staleTime` avoids refetching while filters are tweaked
 * within a few seconds.
 */
export function useSearchListings(query: string, category: string | null) {
  return useQuery({
    queryKey: ["search", query, category],
    queryFn: () =>
      listingsApi.listMarketplaceListings({
        search: query.trim() || undefined,
        category: category ?? undefined,
        status: "active",
        per_page: BROAD_PAGE_SIZE,
      }),
    staleTime: 30_000,
  });
}

/**
 * Resolve a set of listing ids into summaries. Backed by per-id detail lookups
 * because the API exposes no batch endpoint — each miss is swallowed so a
 * single deleted listing never blanks the whole wishlist.
 */
export function useListingsByIds(ids: string[]) {
  return useQuery<ListingSummary[], Error>({
    queryKey: ["listings-by-ids", ids],
    queryFn: async () => {
      const details = await Promise.all(
        ids.map((id) => listingsApi.getListingDetail(id).catch(() => null)),
      );
      return details
        .filter((detail): detail is ListingDetailResponse => detail !== null)
        .map(toListingSummary);
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

/**
 * The current student's own published listings for the Profile screen
 * (design §4.2 Profile, Req 7.2). The gateway exposes no owner filter, so the
 * broad active list is pulled once and narrowed client-side. Disabled until an
 * `sellerId` is available while the auth profile hydrates.
 */
export function useMyListings(sellerId: string | undefined) {
  return useQuery<ListingSummary[], Error>({
    queryKey: ["my-listings", sellerId],
    queryFn: async () => {
      const page = await listingsApi.listMarketplaceListings({
        per_page: BROAD_PAGE_SIZE,
      });
      return page.items.filter((listing) => listing.seller_id === sellerId);
    },
    enabled: Boolean(sellerId),
  });
}

/**
 * A seller's active listings for the public Seller Profile screen (READ-ONLY).
 * Disabled until a `sellerId` is present so we never query an undefined owner.
 */
export function useSellerListings(sellerId: string | undefined) {
  return useQuery<SellerProfileWithListingsResponse, Error>({
    queryKey: ["seller-listings", sellerId],
    queryFn: () =>
      listingsApi.getSellerPublicProfileAndListings(sellerId as string),
    enabled: Boolean(sellerId),
  });
}

/**
 * Best-effort public profile for the Seller Profile header (READ-ONLY). Falls
 * back to a generic "Campus seller" payload when the gateway cannot resolve
 * the owner. Disabled until an `id` is present.
 */
export function usePublicProfile(id: string | undefined) {
  return useQuery<PublicSellerProfileResponse, Error>({
    queryKey: ["seller-profile", id],
    queryFn: async () => {
      const result =
        await listingsApi.getSellerPublicProfileAndListings(id as string);
      return result.seller;
    },
    enabled: Boolean(id),
  });
}
