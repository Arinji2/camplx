"""E-waste domain. 4 ops."""
from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import get_current_user
from app.core.ratelimit import rate_limit
from app.schemas.common import EWasteDeviceCategoryEnum, EWasteLifecycleStatusEnum
from app.schemas.ewaste import (
    EWasteOptimizationPlanResponse,
    EWasteRequestRecord,
    EWasteSubmissionRequest,
    UpdateEWasteStatusRequest,
)
from app.services import ewaste_service

router = APIRouter(prefix="/api/v1", tags=["E-Waste"])


async def _json_body(request: Request) -> dict:
    raw = await request.body()
    if not raw:
        return {}
    import json

    try:
        parsed = json.loads(raw)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


@router.get("/e-waste/requests", response_model=list[EWasteRequestRecord])
async def list_ewaste_requests(
    status: str | None = Query(default=None),
    device_category: str | None = Query(default=None),
) -> list[EWasteRequestRecord]:
    """operationId listEWasteRequests. 200. Malformed enum filters are ignored (contract: 200 only)."""
    status_enum = EWasteLifecycleStatusEnum(status) if status in [e.value for e in EWasteLifecycleStatusEnum] else None
    category_enum = (
        EWasteDeviceCategoryEnum(device_category)
        if device_category in [e.value for e in EWasteDeviceCategoryEnum]
        else None
    )
    return await ewaste_service.list_requests(status_enum, category_enum)


@router.post("/e-waste/requests", response_model=EWasteRequestRecord, status_code=201)
async def submit_ewaste_request(
    request: Request,
    user: dict = Depends(get_current_user),
) -> EWasteRequestRecord:
    """operationId submitEWasteRequest. 201. No 400 documented — a bad body falls back to a working default."""
    data = await _json_body(request)
    if isinstance(data.get("quantity"), int) and data["quantity"] < 1:
        data["quantity"] = 1  # contract documents 201 only; clamp, don't reject
    payload = EWasteSubmissionRequest.model_validate(data if isinstance(data, dict) else {})
    return await ewaste_service.submit_request(user, payload)


@router.post(
    "/e-waste/cluster-and-optimize",
    response_model=EWasteOptimizationPlanResponse,
    dependencies=[Depends(rate_limit("ewaste-opt", 5))],
)
async def optimize_ewaste_collection_routes(
    zones_needed: int = Query(default=2, ge=1, le=10),
    user: dict = Depends(get_current_user),
) -> EWasteOptimizationPlanResponse:
    """operationId optimizeEWasteCollectionRoutes. 200 | 400 | 401."""
    return await ewaste_service.optimize_routes(zones_needed)


@router.patch("/e-waste/{request_id}/lifecycle", response_model=EWasteRequestRecord)
async def update_ewaste_lifecycle_status(
    request_id: str,
    payload: UpdateEWasteStatusRequest,
    user: dict = Depends(get_current_user),
) -> EWasteRequestRecord:
    """operationId updateEWasteLifecycleStatus. 200 | 400 | 401 | 404."""
    return await ewaste_service.update_lifecycle(user, request_id, payload)
