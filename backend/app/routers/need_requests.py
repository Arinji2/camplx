"""Need-it domain. 4 ops."""
from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.auth import get_current_user
from app.schemas.common import ItemCategoryEnum, NeedUrgencyEnum
from app.schemas.need_requests import (
    CreateNeedRequestPayload,
    NeedMatchResult,
    NeedRequestRecord,
)
from app.services import need_request_service

router = APIRouter(prefix="/api/v1", tags=["Need-It Requests"])


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


@router.get("/need-requests", response_model=list[NeedRequestRecord])
async def list_need_it_requests(
    category: str | None = Query(default=None),
    urgency: str | None = Query(default=None),
) -> list[NeedRequestRecord]:
    """operationId listNeedItRequests. 200. Malformed enum filters are ignored (contract: 200 only)."""
    cat_enum = ItemCategoryEnum(category) if category in [e.value for e in ItemCategoryEnum] else None
    urg_enum = NeedUrgencyEnum(urgency) if urgency in [e.value for e in NeedUrgencyEnum] else None
    return await need_request_service.list_need_requests(cat_enum, urg_enum)


@router.post("/need-requests", response_model=NeedRequestRecord, status_code=201)
async def create_need_it_request(
    request: Request,
    user: dict = Depends(get_current_user),
) -> NeedRequestRecord:
    """operationId createNeedItRequest. 201. No 400 documented — an invalid urgency/category falls back to a working default."""
    data = await _json_body(request)
    payload = CreateNeedRequestPayload.model_validate(data if isinstance(data, dict) else {})
    return await need_request_service.create_need_request(user, payload)


@router.delete("/need-requests/{request_id}", status_code=204)
async def delete_need_it_request(
    request_id: str,
    user: dict = Depends(get_current_user),
) -> Response:
    """operationId deleteNeedItRequest. 204 | 403 | 404."""
    await need_request_service.delete_need_request(user, request_id)
    return Response(status_code=204)


@router.get("/need-requests/{request_id}/matches", response_model=list[NeedMatchResult])
async def get_matches_for_need_request(request_id: str) -> list[NeedMatchResult]:
    """operationId getMatchesForNeedRequest. 200 | 404."""
    return await need_request_service.get_matches(request_id)
