"""Reservations domain — atomic holds on listings. OWNER: shared (A-side).

Invariant: at most ONE active hold per listing (enforced by PB partial unique
index idx_reservations_single_active; service also pre-checks for clean 409s).
"""
from __future__ import annotations

from app.core.errors import ApiError
from app.core.format import rfc3339
from app.core.pb import get_pb
from app.schemas.reservations import (
    CompletedTransactionResponse,
    MyReservationItem,
    ReservationRecord,
)
from app.services.listing_service import _require_safe, _summary  # shared shaping
from app.services.user_service import award_points_and_carbon

_COMPLETE_POINTS = 50  # flat seller reward per completed transaction


async def _buyer_name(buyer_id: str) -> str:
    try:
        buyer = await get_pb().collection("users").get_one(buyer_id)
        return buyer.get("display_name") or "Campus Student"
    except ApiError:
        return "Campus Student"


def _record(reservation: dict, buyer_name: str) -> ReservationRecord:
    return ReservationRecord(
        id=reservation["id"],
        listing_id=reservation["listing_id"],
        buyer_id=reservation["buyer_id"],
        buyer_name=buyer_name,
        status=reservation["status"],
        created_at=rfc3339(reservation.get("created")),
    )


async def _active_for_listing(listing_id: str) -> dict | None:
    data = await get_pb().collection("reservations").get_list(
        per_page=1, filter=f'listing_id = "{listing_id}" && status = "active"'
    )
    items = data.get("items", [])
    return items[0] if items else None


async def _load_reservation(reservation_id: str) -> dict:
    try:
        return await get_pb().collection("reservations").get_one(reservation_id)
    except ApiError as exc:
        # release/complete contracts declare 403 (not 404) — no existence leak
        raise ApiError(403, "RESERVATION_NOT_FOUND", "Reservation not found.") from exc


async def _load_reservation_or_fail(reservation_id: str) -> dict:
    """Complete: contract documents 200/403 only — a malformed id is 403, not 400."""
    try:
        _require_safe(reservation_id, "reservation_id")
    except ApiError as exc:
        raise ApiError(403, "RESERVATION_NOT_FOUND", "Reservation not found.") from exc
    return await _load_reservation(reservation_id)


async def create_reservation(user: dict, listing_id: str) -> ReservationRecord:
    _require_safe(listing_id, "listing_id")
    try:
        listing = await get_pb().collection("listings").get_one(listing_id)
    except ApiError as exc:
        # contract declares 409 (not 404) for unusable listings
        raise ApiError(409, "RESERVATION_CONFLICT", "Listing is not available.") from exc
    if listing.get("seller_id") == user["id"]:
        raise ApiError(409, "SELF_RESERVATION", "Cannot reserve your own listing.")
    if listing.get("status") != "active":
        raise ApiError(409, "RESERVATION_CONFLICT", "Listing is not available.")
    if await _active_for_listing(listing_id) is not None:
        raise ApiError(409, "RESERVATION_CONFLICT", "Another student holds this listing.")

    try:
        reservation = await get_pb().collection("reservations").create(
            {
                "listing_id": listing_id,
                "buyer_id": user["id"],
                "campus_id": listing.get("campus_id") or user.get("campus_id"),
                "status": "active",
            }
        )
    except ApiError as exc:
        # lost the race against the partial unique index — same 409 contract
        if exc.status_code == 400 and await _active_for_listing(listing_id):
            raise ApiError(409, "RESERVATION_CONFLICT", "Another student holds this listing.") from exc
        raise

    await get_pb().collection("listings").update(listing_id, {"status": "reserved"})

    from app.core.notify import create_notification

    await create_notification(
        listing["seller_id"],
        "reservation",
        user.get("display_name") or "Campus Student",
        f"{user.get('display_name') or 'A student'} placed a pickup hold on your {listing.get('title') or 'listing'}.",
        target_entity_type="listing",
        target_entity_id=listing_id,
    )
    return _record(reservation, user.get("display_name") or "Campus Student")


async def get_active_listing_reservation(user: dict, listing_id: str) -> ReservationRecord:
    _require_safe(listing_id, "listing_id")
    listing = await get_pb().collection("listings").get_one_or_404(
        listing_id, code="LISTING_NOT_FOUND", message="Listing not found."
    )
    reservation = await _active_for_listing(listing_id)
    if reservation is None:
        raise ApiError(404, "RESERVATION_NOT_FOUND", "Listing is not reserved.")
    # seller or the holding buyer only; others get 404 (no existence leak)
    if user["id"] not in (listing.get("seller_id"), reservation.get("buyer_id")):
        raise ApiError(404, "RESERVATION_NOT_FOUND", "Listing is not reserved.")
    return _record(reservation, await _buyer_name(reservation["buyer_id"]))


async def release_reservation(user: dict, reservation_id: str) -> ReservationRecord:
    reservation = await _load_reservation(reservation_id)
    if user["id"] not in (reservation.get("buyer_id"),):
        listing = await get_pb().collection("listings").get_one(reservation["listing_id"])
        if user["id"] != listing.get("seller_id"):
            raise ApiError(403, "FORBIDDEN", "Only the buyer or seller may release this hold.")
    if reservation.get("status") != "active":
        raise ApiError(403, "RESERVATION_STATE", "Hold is no longer active.")

    await get_pb().collection("reservations").update(reservation_id, {"status": "released"})
    listing = await get_pb().collection("listings").get_one(reservation["listing_id"])
    if listing.get("status") == "reserved":
        await get_pb().collection("listings").update(listing["id"], {"status": "active"})
    return _record({**reservation, "status": "released"}, await _buyer_name(reservation["buyer_id"]))


async def complete_reservation(user: dict, reservation_id: str, outcome: str) -> CompletedTransactionResponse:
    reservation = await _load_reservation_or_fail(reservation_id)
    try:
        listing = await get_pb().collection("listings").get_one_or_404(
            reservation["listing_id"], code="LISTING_NOT_FOUND", message="Listing not found."
        )
    except ApiError as exc:
        # complete documents 200/403 only
        raise ApiError(403, "LISTING_NOT_FOUND", "Listing not found.") from exc
    if user["id"] != listing.get("seller_id"):
        raise ApiError(403, "FORBIDDEN", "Only the listing seller may complete this transaction.")
    if reservation.get("status") != "active":
        raise ApiError(403, "RESERVATION_STATE", "Hold is no longer active.")
    if outcome not in ("sold", "donated"):
        # contract declares 200/403 only — invalid outcome is a forbidden transition
        raise ApiError(403, "RESERVATION_STATE", "outcome must be sold or donated.")
    # donate listing completes as donated; sell listing as sold — reject mismatched intent
    if listing.get("listing_type") == "sell" and outcome != "sold":
        raise ApiError(403, "RESERVATION_STATE", "Sell listings complete as sold.")
    if listing.get("listing_type") == "donate" and outcome != "donated":
        raise ApiError(403, "RESERVATION_STATE", "Donate listings complete as donated.")

    carbon_g = int(listing.get("carbon_savings_g") or 0)
    await get_pb().collection("reservations").update(reservation_id, {"status": "completed"})
    await get_pb().collection("listings").update(listing["id"], {"status": outcome})
    await award_points_and_carbon(listing["seller_id"], _COMPLETE_POINTS, carbon_g)

    from app.core.notify import create_notification

    await create_notification(
        reservation["buyer_id"],
        "reservation",
        "Camplx System",
        f"Transaction complete: your {outcome} of '{listing.get('title') or 'listing'}' is confirmed.",
        target_entity_type="reservation",
        target_entity_id=reservation_id,
    )
    return CompletedTransactionResponse(
        reservation_id=reservation_id,
        listing_id=listing["id"],
        final_status=outcome,
        carbon_savings_g=carbon_g,
        points_awarded=_COMPLETE_POINTS,
    )


async def list_my_reservations(user: dict) -> list[MyReservationItem]:
    data = await get_pb().collection("reservations").get_list(
        per_page=100,
        filter=f'buyer_id = "{user["id"]}"',
        sort="-created",
        expand="listing_id,listing_id.images",
    )
    items: list[MyReservationItem] = []
    for r in data.get("items", []):
        expanded = (r.get("expand") or {}).get("listing_id")
        if not isinstance(expanded, dict):
            continue  # listing deleted — skip orphan hold
        items.append(
            MyReservationItem(
                reservation=_record(r, user.get("display_name") or "Campus Student"),
                listing=_summary(expanded),
            )
        )
    return items
