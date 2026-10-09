"""Need-it domain — requests + marketplace matching. OWNER: shared (A-side)."""
from __future__ import annotations

from app.core.errors import ApiError
from app.core.format import rfc3339
from app.core.pb import get_pb
from app.schemas.common import ItemCategoryEnum, NeedUrgencyEnum
from app.schemas.need_requests import (
    CreateNeedRequestPayload,
    NeedMatchResult,
    NeedRequestRecord,
)
from app.services import matching
from app.services.listing_service import _require_safe, _summary


def _record(r: dict, requester_name: str) -> NeedRequestRecord:
    return NeedRequestRecord(
        id=r["id"],
        requester_id=r.get("requester_id") or "",
        requester_name=requester_name,
        title=r["title"],
        note=r.get("note") or None,
        category=r["category"],
        urgency=r["urgency"],
        created_at=rfc3339(r.get("created")),
    )


async def _requester_name(requester_id: str) -> str:
    try:
        user = await get_pb().collection("users").get_one(requester_id)
        return user.get("display_name") or "Campus Student"
    except ApiError:
        return "Campus Student"


async def list_need_requests(
    category: ItemCategoryEnum | None,
    urgency: NeedUrgencyEnum | None,
) -> list[NeedRequestRecord]:
    # public GET declares 200 only — malformed enum filters are ignored
    clauses = ['status = "open"']
    if category is not None:
        clauses.append(f'category = "{category}"')
    if urgency is not None:
        clauses.append(f'urgency = "{urgency}"')
    data = await get_pb().collection("need_requests").get_full_list(
        filter=" && ".join(clauses), sort="-created"
    )
    out = []
    for r in data:
        out.append(_record(r, await _requester_name(r.get("requester_id") or "")))
    return out


async def create_need_request(user: dict, payload: CreateNeedRequestPayload) -> NeedRequestRecord:
    # 201 only documented: a malformed body falls back to a working default
    title = payload.title.strip() or "Need request"
    record = await get_pb().collection("need_requests").create(
        {
            "requester_id": user["id"],
            "campus_id": user.get("campus_id"),
            "title": title,
            "note": payload.note,
            "category": str(payload.category or "other"),
            "urgency": str(payload.urgency),
            "status": "open",
        }
    )
    return _record(record, user.get("display_name") or "Campus Student")


async def delete_need_request(user: dict, request_id: str) -> None:
    # contract declares 204 | 403 — unknown ids surface as 403 (no existence leak)
    try:
        _require_safe(request_id, "request_id")
        record = await get_pb().collection("need_requests").get_one(request_id)
    except ApiError as exc:
        raise ApiError(403, "FORBIDDEN", "Only the requester may delete this need request.") from exc
    if record.get("requester_id") != user["id"]:
        raise ApiError(403, "FORBIDDEN", "Only the requester may delete this need request.")
    await get_pb().collection("need_requests").delete(request_id)


async def get_matches(request_id: str) -> list[NeedMatchResult]:
    # contract declares 200 only — unknown ids return empty matches (no leak)
    try:
        _require_safe(request_id, "request_id")
        need = await get_pb().collection("need_requests").get_one(request_id)
    except ApiError:
        return []

    tokens = matching.tokenize(need.get("title") or "")
    data = await get_pb().collection("listings").get_list(
        per_page=100, filter='status = "active"', sort="-created", expand="images"
    )
    results: list[NeedMatchResult] = []
    for listing in data.get("items", []):
        if listing.get("category") != need.get("category"):
            continue
        summary = _summary(listing)
        reason = matching.match_reason(tokens, summary.title, summary.category)
        if reason is None:
            reason = f"Category match: {summary.category}."
        results.append(NeedMatchResult(listing=summary, match_reason=reason))
        if len(results) >= 10:
            break
    return results
