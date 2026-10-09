"""Inspections domain. 6 ops."""
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.config import get_settings
from app.core.auth import get_current_user
from app.core.errors import ApiError
from app.core.ratelimit import rate_limit
from app.schemas.common import AngleLabelEnum
from app.schemas.inspections import (
    CreateInspectionSessionRequest,
    DefectDisputeRequest,
    DefectItem,
    InspectionAnalysisResultResponse,
    InspectionImageRecord,
    InspectionRecordResponse,
    InspectionSessionResponse,
    PricingAppraisalResponse,
)
from app.services import inspection_service

router = APIRouter(prefix="/api/v1", tags=["Inspections"])


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


@router.post("/inspections", response_model=InspectionSessionResponse, status_code=201)
async def create_inspection_session(
    payload: CreateInspectionSessionRequest,
    user: dict = Depends(get_current_user),
) -> InspectionSessionResponse:
    """operationId createInspectionSession. 201 | 400 | 401."""
    return await inspection_service.create_session(user, payload)


@router.get("/inspections/{inspection_id}", response_model=InspectionRecordResponse)
async def get_inspection_detail(
    inspection_id: str,
    user: dict = Depends(get_current_user),
) -> InspectionRecordResponse:
    """operationId getInspectionDetail. 200 | 401 | 404."""
    return await inspection_service.get_detail(user, inspection_id)


@router.post(
    "/inspections/{inspection_id}/images",
    response_model=InspectionImageRecord,
    status_code=201,
)
async def upload_inspection_image(
    inspection_id: str,
    image: UploadFile = File(...),
    display_order: int = Form(..., ge=0),
    angle_label: AngleLabelEnum | None = Form(default=None),
    user: dict = Depends(get_current_user),
) -> InspectionImageRecord:
    """operationId uploadInspectionImage. 201 | 400 | 401."""
    settings = get_settings()
    content = await image.read(settings.max_image_bytes + 1)
    if len(content) > settings.max_image_bytes:
        raise ApiError(400, "IMAGE_TOO_LARGE", "Image exceeds the 15MB limit.")
    return await inspection_service.upload_image(
        user,
        inspection_id,
        content,
        image.filename or "capture.jpg",
        display_order,
        str(angle_label) if angle_label else None,
    )


@router.post(
    "/inspections/{inspection_id}/analyze",
    response_model=InspectionAnalysisResultResponse,
    dependencies=[Depends(rate_limit("insp-analyze", 10))],
)
async def run_inspection_analysis(
    inspection_id: str,
    user: dict = Depends(get_current_user),
) -> InspectionAnalysisResultResponse:
    """operationId runInspectionAnalysis. 200 | 400 | 401 | 502."""
    return await inspection_service.run_inspection_analysis(user, inspection_id)


@router.post(
    "/inspections/{inspection_id}/pricing",
    response_model=PricingAppraisalResponse,
)
async def calculate_pricing_appraisal(
    inspection_id: str,
    user: dict = Depends(get_current_user),
) -> PricingAppraisalResponse:
    """operationId calculatePricingAppraisal. 200 | 400 | 401."""
    return await inspection_service.calculate_pricing_appraisal(user, inspection_id)


@router.post(
    "/inspections/{inspection_id}/defects/{defect_id}/dispute",
    response_model=DefectItem,
)
async def dispute_defect_finding(
    inspection_id: str,
    defect_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
) -> DefectItem:
    """operationId disputeDefectFinding. 200 | 404.

    No 400 documented — a missing/invalid body resolves to the documented 404.
    """
    data = await _json_body(request)
    payload = DefectDisputeRequest.model_validate(data if isinstance(data, dict) else {})
    return await inspection_service.dispute_defect(user, inspection_id, defect_id, payload)
