"""Listings domain — marketplace browse/detail CRUD. OWNER: shared (A-side).

Embeds `inspection`, `pricing_intelligence`, `active_reservation` stay null until
P4/P5/P9 wire them (contract allows null).
"""
from __future__ import annotations

import re

from app.config import get_settings
from app.core.errors import ApiError
from app.core.format import rfc3339
from app.core.pb import get_pb
from app.schemas.common import (
    ItemCategoryEnum,
    ListingStatusEnum,
    ListingTypeEnum,
)
from app.schemas.listings import (
    CreateListingRequest,
    ListingDetailResponse,
    ListingSummary,
    PaginatedListingsResponse,
    PublicSellerProfileResponse,
    SellerProfileWithListingsResponse,
    UpdateListingRequest,
)

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_SAFE_SEARCH = re.compile(r"^[\w\s.,'&()/+:-]{1,60}$")  # no quotes/backslashes -> no PB filter injection
_MEDIA_URL = re.compile(r"/api/v1/media/([A-Za-z0-9_-]{1,64})/[^/]+$")

# directional one-pass estimate (grams CO2e) — replaced by pricing_service in P9
_BASELINE_CARBON_G = {
    "electronics": 3500,
    "cycles": 8000,
    "furniture": 6000,
    "books": 400,
    "hostel_essentials": 1200,
    "other": 1000,
}


def _require_safe(value: str, name: str, *, code: str = "VALIDATION_ERROR", status: int = 400) -> str:
    if not _SAFE_ID.match(value):
        raise ApiError(status, code, f"Invalid {name}.", {"field": name})
    return value


def _require_uuid(value: str, name: str) -> str:
    import uuid as _uuid

    try:
        _uuid.UUID(value)
    except ValueError as exc:
        raise ApiError(400, "VALIDATION_ERROR", f"Invalid {name}.", {"field": name}) from exc
    return value


def _image_out(img: dict) -> dict:
    base = get_settings().media_base_url.rstrip("/")
    out = {
        "id": img["id"],
        "inspection_id": img.get("inspection_id") or "",
        "display_order": int(img.get("display_order") or 0),
        "angle_label": img.get("angle_label") or "",
        "image_url": "",
        "annotated_image_url": None,
    }
    if img.get("image_file"):
        out["image_url"] = f"{base}/api/v1/media/{img['id']}/{img['image_file']}"
    if img.get("annotated_image"):
        out["annotated_image_url"] = f"{base}/api/v1/media/{img['id']}/{img['annotated_image']}"
    return out


def _primary_url(images: list[dict]) -> str:
    ordered = sorted(images, key=lambda i: int(i.get("display_order") or 0))
    if not ordered:
        return ""
    return _image_out(ordered[0])["image_url"]


def _expanded_images(record: dict) -> list[dict]:
    """PB expand puts related records under `expand`, leaving the field as id list."""
    expanded = record.get("expand")
    if isinstance(expanded, dict) and isinstance(expanded.get("images"), list):
        return [i for i in expanded["images"] if isinstance(i, dict)]
    return []


def _opt_str(value) -> str | None:
    return value or None


def _opt_num(value) -> float | None:
    return value or None


def _summary(record: dict) -> ListingSummary:
    return ListingSummary(
        id=record["id"],
        seller_id=record.get("seller_id") or "",
        title=record["title"],
        category=record["category"],
        condition=record["condition"],
        listing_type=record["listing_type"],
        status=record["status"],
        primary_image_url=_primary_url(_expanded_images(record)),
        created_at=rfc3339(record.get("created")),
        brand=_opt_str(record.get("brand")),
        model=_opt_str(record.get("model")),
        asking_price=_opt_num(record.get("asking_price")),
        carbon_savings_g=record.get("carbon_savings_g"),
    )


async def _seller_name(seller_id: str) -> str:
    try:
        seller = await get_pb().collection("users").get_one(seller_id)
        return seller.get("display_name") or "Campus Seller"
    except ApiError:
        return "Campus Seller"


def _detail(
    record: dict,
    seller_name: str,
    *,
    inspection=None,  # InspectionAnalysisResultResponse | None (P9 embed)
    pricing=None,  # PricingIntelligence | None
    active_reservation=None,  # ReservationRecord | None
) -> ListingDetailResponse:
    images = _expanded_images(record)
    return ListingDetailResponse(
        id=record["id"],
        seller_id=record.get("seller_id") or "",
        seller_name=seller_name,
        campus_id=record.get("campus_id") or "",
        title=record["title"],
        category=record["category"],
        condition=record["condition"],
        listing_type=record["listing_type"],
        status=record["status"],
        images=[_image_out(i) for i in images if isinstance(i, dict)],
        created_at=rfc3339(record.get("created")),
        brand=_opt_str(record.get("brand")),
        model=_opt_str(record.get("model")),
        description=_opt_str(record.get("description")),
        asking_price=_opt_num(record.get("asking_price")),
        carbon_savings_g=record.get("carbon_savings_g"),
        technical_specifications=record.get("technical_specifications") or None,
        specification_provenance=record.get("specification_provenance"),
        inspection=inspection.model_dump() if inspection else None,
        pricing_intelligence=pricing.model_dump() if pricing else None,
        active_reservation=active_reservation.model_dump() if active_reservation else None,
    )


def _build_filter(
    campus_id: str | None,
    category: ItemCategoryEnum | None,
    status: ListingStatusEnum | None,
    listing_type: ListingTypeEnum | None,
    search: str | None,
) -> str:
    clauses: list[str] = []
    if campus_id:
        clauses.append(f'campus_id = "{_require_uuid(campus_id, "campus_id")}"')
    if category:
        clauses.append(f'category = "{category}"')
    if status:
        clauses.append(f'status = "{status}"')
    if listing_type:
        clauses.append(f'listing_type = "{listing_type}"')
    if search is not None and search != "":
        if not _SAFE_SEARCH.match(search):
            raise ApiError(400, "VALIDATION_ERROR", "Invalid search query.", {"field": "search"})
        cleaned = search.replace("\\", "")
        clauses.append(f'title ~ "{cleaned}"')
    return " && ".join(clauses) or None


async def list_listings(
    campus_id: str | None,
    category: ItemCategoryEnum | None,
    status: ListingStatusEnum | None,
    listing_type: ListingTypeEnum | None,
    search: str | None,
    page: int,
    per_page: int,
) -> PaginatedListingsResponse:
    # contract: status defaults to active when unspecified
    effective_status = status or ListingStatusEnum.ACTIVE
    filt = _build_filter(campus_id, category, effective_status, listing_type, search)
    data = await get_pb().collection("listings").get_list(
        page=page, per_page=per_page, filter=filt, sort="-created", expand="images"
    )
    items = [_summary(r) for r in data.get("items", [])]
    return PaginatedListingsResponse(
        items=items, total=int(data.get("totalItems", 0)), page=page, per_page=per_page
    )


async def _extract_image_ids(image_urls: list[str], inspection_id: str | None) -> list[str]:
    ids: list[str] = []
    for url in image_urls:
        if match := _MEDIA_URL.search(url):
            img_id = match.group(1)
        elif _SAFE_ID.match(url) and "/" not in url:
            img_id = url
        else:
            raise ApiError(400, "INVALID_IMAGE_REF", "image_urls must reference stored media.", {"field": "image_urls"})
        if img_id not in ids:
            ids.append(img_id)

    # verify existence (+ inspection binding when supplied)
    filt = " || ".join(f'id = "{i}"' for i in ids)
    try:
        records = await get_pb().collection("inspection_images").get_full_list(filter=filt)
    except ApiError as exc:
        raise ApiError(400, "INVALID_IMAGE_REF", "image_urls reference unknown media.") from exc
    by_id = {r["id"]: r for r in records}
    if len(by_id) != len(ids):
        raise ApiError(400, "INVALID_IMAGE_REF", "image_urls reference unknown media.")
    if inspection_id:
        for r in by_id.values():
            if r.get("inspection_id") != inspection_id:
                raise ApiError(
                    400, "IMAGE_INSPECTION_MISMATCH", "Image does not belong to inspection_id."
                )
    return ids


async def create_listing(user: dict, payload: CreateListingRequest) -> ListingDetailResponse:
    if payload.listing_type == ListingTypeEnum.SELL and payload.asking_price is None:
        raise ApiError(400, "LISTING_PRICE_REQUIRED", "asking_price is required for sell listings.")
    if payload.listing_type == ListingTypeEnum.DONATE and payload.asking_price is not None:
        raise ApiError(400, "LISTING_NO_PRICE", "asking_price must be null for donate listings.")

    if payload.inspection_id is not None:
        _require_safe(payload.inspection_id, "inspection_id")
        try:
            inspection = await get_pb().collection("inspections").get_one(payload.inspection_id)
        except ApiError as exc:
            raise ApiError(400, "INSPECTION_NOT_FOUND", "inspection_id is not usable.") from exc
        if inspection.get("creator_id") != user["id"]:
            # do not leak existence of other users' inspections
            raise ApiError(400, "INSPECTION_NOT_FOUND", "inspection_id is not usable.")

    image_ids = await _extract_image_ids(payload.image_urls, payload.inspection_id)

    data = {
        "seller_id": user["id"],
        "campus_id": user.get("campus_id"),
        "listing_type": str(payload.listing_type),
        "title": payload.title,
        "brand": payload.brand,
        "model": payload.model,
        "description": payload.description,
        "category": str(payload.category),
        "condition": str(payload.condition),
        "asking_price": payload.asking_price,
        "status": "active",
        "carbon_savings_g": _BASELINE_CARBON_G.get(str(payload.category), 1000),
        "technical_specifications": payload.technical_specifications,
        "specification_provenance": (
            {k: str(v) for k, v in payload.specification_provenance.items()}
            if payload.specification_provenance
            else None
        ),
        "images": image_ids,
    }
    if payload.inspection_id:
        data["inspection_id"] = payload.inspection_id

    record = await get_pb().collection("listings").create(data)
    _, detail = await _load_detail(record["id"])
    return detail


async def _embeds(listing: dict):
    """P9: inspection bundle + pricing + active reservation (null-safe)."""
    inspection = pricing = active_reservation = None
    inspection_id = listing.get("inspection_id")
    if inspection_id:
        from app.services.inspection_service import _analysis_out, _images_for, _pricing_out

        try:
            record = await get_pb().collection("inspections").get_one(inspection_id)
            inspection = _analysis_out(record, await _images_for(inspection_id))
            pricing = _pricing_out(record)
        except ApiError:
            inspection = pricing = None
    data = await get_pb().collection("reservations").get_list(
        per_page=1, filter=f'listing_id = "{listing["id"]}" && status = "active"'
    )
    if data.get("items"):
        from app.schemas.reservations import ReservationRecord
        from app.services.reservation_service import _buyer_name

        r = data["items"][0]
        active_reservation = ReservationRecord(
            id=r["id"],
            listing_id=r["listing_id"],
            buyer_id=r["buyer_id"],
            buyer_name=await _buyer_name(r["buyer_id"]),
            status=r["status"],
            created_at=rfc3339(r.get("created")),
        )
    return inspection, pricing, active_reservation


async def _load_detail(listing_id: str) -> tuple[dict, ListingDetailResponse]:
    try:
        full = await get_pb().collection("listings").get_one(listing_id, expand="images")
    except ApiError as exc:
        if exc.status_code == 404:
            raise ApiError(404, "LISTING_NOT_FOUND", "Listing not found.") from exc
        raise
    inspection, pricing, reservation = await _embeds(full)
    return full, _detail(
        full,
        await _seller_name(full.get("seller_id") or ""),
        inspection=inspection,
        pricing=pricing,
        active_reservation=reservation,
    )


async def get_listing_detail(listing_id: str) -> ListingDetailResponse:
    _require_safe(listing_id, "listing_id")
    _, detail = await _load_detail(listing_id)
    return detail


async def update_listing(user: dict, listing_id: str, payload: UpdateListingRequest) -> ListingDetailResponse:
    _require_safe(listing_id, "listing_id")
    record, _ = await _load_detail(listing_id)
    if record.get("seller_id") != user["id"]:
        raise ApiError(403, "FORBIDDEN", "Only the owner may modify this listing.")

    patch: dict = {}
    if payload.title is not None:
        patch["title"] = payload.title
    if payload.description is not None:
        patch["description"] = payload.description
    if payload.status is not None:
        patch["status"] = str(payload.status)
    if payload.asking_price is not None:
        if record.get("listing_type") == "donate":
            raise ApiError(400, "LISTING_NO_PRICE", "Donate listings cannot carry a price.")
        patch["asking_price"] = payload.asking_price
    if not patch:
        raise ApiError(400, "NO_CHANGES", "No updatable fields supplied.")

    await get_pb().collection("listings").update(listing_id, patch)
    _, detail = await _load_detail(listing_id)
    return detail


async def delete_listing(user: dict, listing_id: str) -> None:
    _require_safe(listing_id, "listing_id")
    record, _ = await _load_detail(listing_id)
    if record.get("seller_id") != user["id"]:
        raise ApiError(403, "FORBIDDEN", "Only the owner may delete this listing.")
    await get_pb().collection("listings").delete(listing_id)


async def get_seller_listings(seller_id: str) -> SellerProfileWithListingsResponse:
    _require_safe(seller_id, "seller_id")
    try:
        seller = await get_pb().collection("users").get_one(seller_id)
    except ApiError as exc:
        raise ApiError(404, "SELLER_NOT_FOUND", "Seller not found.") from exc

    campus_name = None
    if seller.get("campus_id"):
        try:
            campus = await get_pb().collection("campuses").get_one(seller["campus_id"])
            campus_name = campus.get("name")
        except ApiError:
            campus_name = None

    data = await get_pb().collection("listings").get_list(
        per_page=100,
        filter=f'seller_id = "{seller_id}" && status = "active"',
        sort="-created",
        expand="images",
    )
    return SellerProfileWithListingsResponse(
        seller=PublicSellerProfileResponse(
            id=seller["id"],
            display_name=seller.get("display_name") or "Campus Seller",
            verified_student=bool(seller.get("verified_student", False)),
            campus_id=seller.get("campus_id") or "",
            campus_name=campus_name,
            points=int(seller.get("points") or 0),
            cumulative_carbon_g=int(seller.get("cumulative_carbon_g") or 0),
            avatar_url=seller.get("avatar_url"),
        ),
        listings=[_summary(r) for r in data.get("items", [])],
    )
