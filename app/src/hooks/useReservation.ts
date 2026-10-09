import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { reservationsApi } from "@/api";
import type {
  CompleteReservationRequest,
  CompletedTransactionResponse,
  MyReservationItem,
  ReservationRecord,
} from "@/types/api";

/**
 * Reservation hooks (design §1.6 Flow 6; Req 13.1–13.8). A read hook for the
 * active reservation, a read hook for the student's own reservations, plus
 * three mutation hooks (reserve / release / complete) wrapping
 * `reservationsApi`. Each mutation invalidates every query whose cached answer
 * it changes, so the detail screen, feed, and profile reflect the new
 * `listing.status` immediately (Req 13.5).
 *
 * Per `API_DECISIONS.md` §6 an item carries at most one `status: "active"`
 * reservation; the backend rejects duplicates with 409 and that error is
 * surfaced verbatim by the mutation.
 */

/**
 * The active reservation for a listing (design §1.6 Flow 6). Disabled until an
 * `id` is present so the route param can hydrate. Returns null when there is no
 * active reservation — the reserved state is still visible via
 * `listing.status`.
 */
export function useActiveReservation(listingId: string | undefined) {
  return useQuery<ReservationRecord | null, Error>({
    queryKey: ["reservation", listingId],
    queryFn: () =>
      reservationsApi.getActiveListingReservation(listingId as string),
    enabled: Boolean(listingId),
    // Reservation state is the one thing that must not look stale on screen —
    // poll lightly rather than waiting for a manual refetch.
    staleTime: 5_000,
    refetchInterval: 15_000,
  });
}

/**
 * The current buyer's own reservations for the My Reservations screen. Each row
 * embeds its related listing so the screen can render with `ListingCard`.
 */
export function useMyReservations() {
  return useQuery<MyReservationItem[], Error>({
    queryKey: ["my-reservations"],
    queryFn: () => reservationsApi.listMyReservations(),
    staleTime: 10_000,
  });
}

/**
 * Invalidate every query that depends on a listing's reservation state: the
 * detail (`['listing', id]`), its active reservation (`['reservation', id]`),
 * the campus feed (`['feed']`), search results, per-id wishlist lookups, the
 * seller's inventory, and the buyer's own reservations list.
 */
function useInvalidateReservationQueries() {
  const queryClient = useQueryClient();
  return (listingId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
    void queryClient.invalidateQueries({
      queryKey: ["reservation", listingId],
    });
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    void queryClient.invalidateQueries({ queryKey: ["search"] });
    void queryClient.invalidateQueries({ queryKey: ["listings-by-ids"] });
    void queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    void queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
    void queryClient.invalidateQueries({ queryKey: ["seller-listings"] });
  };
}

/**
 * Place a pickup hold on an active listing (Req 13.1–13.3). Guarding against
 * duplicate submits is the caller's job via the mutation's `isPending` flag
 * (Req 10.3); a 409 from a competing hold surfaces through `error`.
 */
export function useReserve() {
  const invalidate = useInvalidateReservationQueries();
  return useMutation<ReservationRecord, Error, string>({
    mutationFn: (listingId) =>
      reservationsApi.createListingReservation(listingId),
    onSuccess: (_reservation, listingId) => invalidate(listingId),
  });
}

/**
 * Release a reservation, returning the listing to `active` (Req 13.7). Requires
 * the affected `listingId` so the right queries are invalidated afterwards.
 */
export function useRelease() {
  const invalidate = useInvalidateReservationQueries();
  return useMutation<
    ReservationRecord,
    Error,
    { reservationId: string; listingId: string }
  >({
    mutationFn: ({ reservationId }) =>
      reservationsApi.releaseReservation(reservationId),
    onSuccess: (_reservation, variables) => invalidate(variables.listingId),
  });
}

/** Mutation payload: the ids needed to invalidate, plus the outcome body. */
export type CompleteReservationInput = {
  reservationId: string;
  listingId: string;
} & CompleteReservationRequest;

/**
 * Seller completion of a reserved listing → sold / donated (Req 13.6, 13.8).
 * The backend archives the reservation and awards points + carbon telemetry in
 * the same transaction.
 */
export function useComplete() {
  const invalidate = useInvalidateReservationQueries();
  return useMutation<
    CompletedTransactionResponse,
    Error,
    CompleteReservationInput
  >({
    mutationFn: ({ reservationId, listingId: _listingId, ...payload }) =>
      reservationsApi.completeReservation(reservationId, payload),
    onSuccess: (_result, variables) => invalidate(variables.listingId),
  });
}
