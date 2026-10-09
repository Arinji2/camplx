"""E-waste schemas (openapi components). OWNER: shared."""
import functools
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

from app.schemas.common import (
    EWasteDeviceCategoryEnum,
    EWasteLifecycleStatusEnum,
    LifecycleCategoryEnum,
    coerce_any_str,
    coerce_to_enum,
)

CoercedCategory = Annotated[
    EWasteDeviceCategoryEnum,
    BeforeValidator(coerce_to_enum(EWasteDeviceCategoryEnum, EWasteDeviceCategoryEnum.OTHER_ELECTRONICS)),
]
CoercedLifecycle = Annotated[
    LifecycleCategoryEnum,
    BeforeValidator(coerce_to_enum(LifecycleCategoryEnum, LifecycleCategoryEnum.END_OF_LIFE)),
]
CoercedStr = Annotated[str, BeforeValidator(functools.partial(coerce_any_str, none=""))]


def _safe(value):
    if value is None:
        return None
    return value if isinstance(value, str) else str(value)


def _safe_float(value):
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    if isinstance(value, bool):
        return 1
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return max(1, int(value))
    try:
        return max(1, int(float(value)))
    except (TypeError, ValueError):
        return 1


class EWasteSubmissionRequest(BaseModel):
    """Only 201 documented — default so a bad body is never a validation error."""

    description: CoercedStr = Field(default="", max_length=1000)
    device_category: CoercedCategory = EWasteDeviceCategoryEnum.OTHER_ELECTRONICS
    lifecycle_assessment: CoercedLifecycle = LifecycleCategoryEnum.END_OF_LIFE
    quantity: Annotated[int, BeforeValidator(_safe_int)] = Field(default=1, ge=1, le=100)
    latitude: Annotated[float | None, BeforeValidator(_safe_float)] = None
    longitude: Annotated[float | None, BeforeValidator(_safe_float)] = None
    location_name: CoercedStr = Field(default="", max_length=160)
    preferred_slot: Annotated[str | None, BeforeValidator(_safe)] = Field(default=None, max_length=80)


class EWasteRequestRecord(BaseModel):
    id: str
    student_id: str
    description: str
    device_category: EWasteDeviceCategoryEnum
    lifecycle_assessment: LifecycleCategoryEnum
    quantity: int
    latitude: float | None = None
    longitude: float | None = None
    location_name: str
    preferred_slot: str | None = None
    status: EWasteLifecycleStatusEnum
    zone_cluster_id: int | None = None
    pickup_sequence_order: int | None = None
    estimated_carbon_kg: float
    created_at: str


class UpdateEWasteStatusRequest(BaseModel):
    status: EWasteLifecycleStatusEnum
    handler_notes: str | None = Field(default=None, max_length=1000)
    certified_partner_id: str | None = Field(default=None, max_length=100)


class EWasteOptimizationPlanResponse(BaseModel):
    message: str
    total_stops_optimized: int
    routes_generated: dict[str, list[str]]
