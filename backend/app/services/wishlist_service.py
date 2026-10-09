"""Wishlist domain — 3 ops."""
from __future__ import annotations

from app.core.errors import ApiError
from app.core.pb import get_pb
from app.schemas.listings import ListingSummary
from app.services.listing_service import _require_safe, _summary


async def get_my_wishlist(user: dict) -> list[ListingSummary]:
    data = await get_pb().collection("wishlists").get_list(
        per_page=100,
        filter=f'user_id = "{user["id"]}"',
        expand="listing_id,listing_id.images",
    )
    out: list[ListingSummary] = []
    for row in data.get("items", []):
        expanded = (row.get("expand") or {}).get("listing_id")
        if isinstance(expanded, dict) and expanded.get("status") == "active":
            out.append(_summary(expanded))
    return out


async def add_to_wishlist(user: dict, listing_id: str | None) -> None:
    # invalid/unknown ids both surface as 404 (contract: 201 | 404)
    if listing_id is None:
        raise ApiError(404, "LISTING_NOT_FOUND", "Listing not found.")
    try:
        _require_safe(listing_id, "listing_id")
    except ApiError as exc:
        raise ApiError(404, "LISTING_NOT_FOUND", "Listing not found.") from exc
    listing = await get_pb().collection("listings").get_one_or_404(
        listing_id, code="LISTING_NOT_FOUND", message="Listing not found."
    )
    if listing.get("status") not in ("active", "reserved"):
        raise ApiError(404, "LISTING_NOT_FOUND", "Listing not found.")
    existing = await get_pb().collection("wishlists").get_list(
        per_page=1, filter=f'user_id = "{user["id"]}" && listing_id = "{listing_id}"'
    )
    if not existing.get("items"):
        try:
            await get_pb().collection("wishlists").create(
                {"user_id": user["id"], "listing_id": listing_id}
            )
        except ApiError as exc:
            if exc.status_code != 400:  # duplicate race -> treat as success
                raise


async def remove_from_wishlist(user: dict, listing_id: str) -> None:
    # contract declares 204 only — unknown/malformed ids are silent no-ops
    try:
        _require_safe(listing_id, "listing_id")
    except ApiError:
        return
    data = await get_pb().collection("wishlists").get_list(
        per_page=1, filter=f'user_id = "{user["id"]}" && listing_id = "{listing_id}"'
    )
    for row in data.get("items", []):
        await get_pb().collection("wishlists").delete(row["id"])
