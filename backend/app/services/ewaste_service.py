"""E-waste domain — submissions, zoning, lifecycle. OWNER: shared (A-side).

Algorithms live in route_optimizer (K-Means + Haversine TSP).
Carbon estimate: directional kg CO2e avoided per device class × quantity.
"""
from __future__ import annotations

from app.core.errors import ApiError
from app.core.format import rfc3339
from app.core.pb import get_pb
from app.schemas.common import (
    EWasteDeviceCategoryEnum,
    EWasteLifecycleStatusEnum,
)
from app.schemas.ewaste import (
    EWasteOptimizationPlanResponse,
    EWasteRequestRecord,
    EWasteSubmissionRequest,
    UpdateEWasteStatusRequest,
)
from app.services import route_optimizer
from app.services.listing_service import _require_safe

# kg CO2e avoided per unit diverted to certified recycler (directional estimate)
_CARBON_KG_PER_UNIT = {
    "laptops_and_computers": 21.0,
    "phones_and_tablets": 8.5,
    "batteries_and_power_banks": 5.0,
    "chargers_and_cables": 1.5,
    "printers_and_peripherals": 12.0,
    "audio_and_accessories": 3.0,
    "other_electronics": 6.0,
}

_NEXT_STATUS = {
    "pending": {"scheduled", "collected"},
    "scheduled": {"collected"},
    "collected": {"handed_over"},
}


def _record(r: dict) -> EWasteRequestRecord:
    return EWasteRequestRecord(
        id=r["id"],
        student_id=r.get("student_id") or "",
        description=r["description"],
        device_category=r["device_category"],
        lifecycle_assessment=r["lifecycle_assessment"],
        quantity=int(r.get("quantity") or 1),
        latitude=r.get("latitude"),
        longitude=r.get("longitude"),
        location_name=r["location_name"],
        preferred_slot=r.get("preferred_slot") or None,
        status=r["status"],
        zone_cluster_id=int(r["zone_cluster_id"]) if r.get("zone_cluster_id") is not None else None,
        pickup_sequence_order=(
            int(r["pickup_sequence_order"]) if r.get("pickup_sequence_order") is not None else None
        ),
        estimated_carbon_kg=float(r.get("estimated_carbon_kg") or 0),
        created_at=rfc3339(r.get("created")),
    )


async def list_requests(
    status: EWasteLifecycleStatusEnum | None,
    device_category: EWasteDeviceCategoryEnum | None,
) -> list[EWasteRequestRecord]:
    # public GET declares 200 only — malformed enum filters are ignored, not rejected
    clauses = []
    if status is not None:
        clauses.append(f'status = "{status}"')
    if device_category is not None:
        clauses.append(f'device_category = "{device_category}"')
    data = await get_pb().collection("ewaste_requests").get_full_list(
        filter=" && ".join(clauses) or None, sort="-created"
    )
    return [_record(r) for r in data]


async def submit_request(user: dict, payload: EWasteSubmissionRequest) -> EWasteRequestRecord:
    # 201 only documented: a malformed body falls back to a working default
    device_category = str(payload.device_category or "other_electronics")
    description = payload.description.strip() or "E-waste item"
    carbon = round(_CARBON_KG_PER_UNIT.get(device_category, 6.0) * payload.quantity, 1)
    record = await get_pb().collection("ewaste_requests").create(
        {
            "student_id": user["id"],
            "description": description,
            "device_category": device_category,
            "lifecycle_assessment": str(payload.lifecycle_assessment),
            "quantity": payload.quantity,
            "latitude": payload.latitude if payload.latitude else 18.5204,
            "longitude": payload.longitude if payload.longitude else 73.8567,
            "location_name": payload.location_name.strip() or "Not specified",
            "preferred_slot": payload.preferred_slot or "Unspecified",
            "status": "pending",
            "estimated_carbon_kg": carbon,
        }
    )
    return _record(record)


async def optimize_routes(zones_needed: int) -> EWasteOptimizationPlanResponse:
    pending = await get_pb().collection("ewaste_requests").get_full_list(filter='status = "pending"')
    if not pending:
        raise ApiError(400, "NO_PENDING_REQUESTS", "No pending e-waste requests to cluster.")

    zone_of = route_optimizer.cluster_zones(pending, zones_needed)
    by_zone: dict[int, list[dict]] = {}
    for r in pending:
        by_zone.setdefault(zone_of[r["id"]], []).append(r)

    routes: dict[str, list[str]] = {}
    for zone, zone_reqs in sorted(by_zone.items()):
        locs = [{"id": r["id"], "lat": r["latitude"], "lon": r["longitude"]} for r in zone_reqs]
        sequence = route_optimizer.optimize_tsp_route(locs)
        routes[f"Zone {zone}"] = sequence
        for order_index, req_id in enumerate(sequence, start=1):
            await get_pb().collection("ewaste_requests").update(
                req_id,
                {
                    "zone_cluster_id": zone,
                    "pickup_sequence_order": order_index,
                    "status": "scheduled",
                },
            )

    return EWasteOptimizationPlanResponse(
        message="Clustering complete and routes sequenced.",
        total_stops_optimized=len(pending),
        routes_generated=routes,
    )


async def update_lifecycle(user: dict, request_id: str, payload: UpdateEWasteStatusRequest) -> EWasteRequestRecord:
    # contract declares 200 | 400 — unknown ids surface as 400, not 404
    _require_safe(request_id, "request_id")
    try:
        record = await get_pb().collection("ewaste_requests").get_one(request_id)
    except ApiError as exc:
        raise ApiError(400, "EWASTE_REQUEST_NOT_FOUND", "E-waste request not found.") from exc

    current = record.get("status")
    target = str(payload.status)
    if target == current:
        raise ApiError(400, "INVALID_TRANSITION", f"Already in status '{current}'.")
    if target not in _NEXT_STATUS.get(current, set()):
        raise ApiError(400, "INVALID_TRANSITION", f"Cannot move from '{current}' to '{target}'.")
    if target == "handed_over" and not payload.certified_partner_id:
        raise ApiError(400, "PARTNER_REQUIRED", "certified_partner_id is required at handover.")

    patch: dict = {"status": target}
    if payload.handler_notes is not None:
        patch["handler_notes"] = payload.handler_notes
    if payload.certified_partner_id is not None:
        patch["certified_partner_id"] = payload.certified_partner_id
    updated = await get_pb().collection("ewaste_requests").update(request_id, patch)
    return _record(updated)
