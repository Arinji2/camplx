// services/reservationService.ts
import { db } from "@/lib/database";
import type {
  ActiveReservation,
  MyReservation,
  ReservationOutcome,
} from "@/types";

export type ReserveListingInput = {
  listingId: string;
  buyerId: string;
  campusId: string;
};

export type CompleteReservationInput = {
  reservationId: string;
  listingId: string;
  outcome: ReservationOutcome;
};

export async function reserveListing({
  listingId,
  buyerId,
}: ReserveListingInput): Promise<string> {
  const active = await db.getActiveReservation(listingId);
  if (active) {
    throw new Error("This item is already reserved.");
  }
  return db.createReservation(listingId, buyerId, "Aarav Sharma");
}

export async function releaseReservation(
  reservationId: string,
  listingId?: string,
): Promise<void> {
  const reservations = await db.getReservations();
  const found = reservations.find((r) => r.id === reservationId);
  const targetListingId = listingId || found?.listing_id;
  if (!targetListingId) return;
  await db.releaseReservation(reservationId, targetListingId);
}

export async function completeReservation({
  reservationId,
  listingId,
  outcome,
}: CompleteReservationInput): Promise<void> {
  await db.completeReservation(reservationId, listingId, outcome);
}

export async function fetchActiveReservation(
  listingId: string,
): Promise<ActiveReservation | null> {
  return db.getActiveReservation(listingId);
}

export async function fetchMyReservations(
  buyerId: string,
): Promise<MyReservation[]> {
  return db.getMyReservations(buyerId);
}
