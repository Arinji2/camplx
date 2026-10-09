"""Inspections schemas (openapi components). OWNER: shared (A-side)."""
import functools
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, model_validator

from app.schemas.common import (
    AttributeProvenanceEnum,
    ConditionGradeEnum,
    ItemCategoryEnum,
    LifecycleCategoryEnum,
    coerce_any_str,
)


class CreateInspectionSessionRequest(BaseModel):
    item_category: ItemCategoryEnum
    seller_notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="before")
    @classmethod
    def _reject_null_seller_notes(cls, data):
        if isinstance(data, dict) and "seller_notes" in data and data["seller_notes"] is None:
            raise ValueError("seller_notes must be a string; omit the field instead.")
        return data


class InspectionSessionResponse(BaseModel):
    inspection_id: str
    status: str
    report_version: int
    item_category: ItemCategoryEnum
    created_at: str


class InspectionImageRecord(BaseModel):
    id: str
    image_url: str
    annotated_image_url: str | None = None
    display_order: int
    angle_label: str


class DefectItem(BaseModel):
    id: str
    image_id: str
    defect_type: str
    severity: str
    box_2d: list[int] = Field(min_length=4, max_length=4)
    buyer_note: str
    dispute_status: str = "none"
    seller_dispute_note: str | None = None


class AmazonStyleListing(BaseModel):
    title: str
    key_features_bullets: list[str]
    technical_specifications: dict[str, str]
    seller_condition_summary: str


class InspectionAnalysisResultResponse(BaseModel):
    inspection_id: str
    report_version: int
    identified_product_name: str
    brand: str | None = None
    model: str | None = None
    category: str
    overall_condition: ConditionGradeEnum
    circular_lifecycle_category: LifecycleCategoryEnum
    defects: list[DefectItem]
    amazon_listing: AmazonStyleListing
    images: list[InspectionImageRecord]
    specification_provenance: dict[str, AttributeProvenanceEnum]


class ComparableListingItem(BaseModel):
    id: str
    title: str
    price: float
    currency: str = "INR"
    condition: ConditionGradeEnum
    source_type: str
    source_name: str
    source_url: str | None = None
    observed_at: str


class PricingIntelligence(BaseModel):
    data_sufficiency: str
    insufficient_data_reason: str | None = None
    estimated_retail_new: float | None = None
    typical_used_market_price: float | None = None
    condition_penalty_amount: float | None = None
    recommended_min_price: float | None = None
    recommended_listing_price: float | None = None
    recommended_max_price: float | None = None
    pricing_rationale: str
    comparables: list[ComparableListingItem]
    comparables_count: int


class InspectionRecordResponse(BaseModel):
    inspection_id: str
    status: str
    report_version: int
    item_category: ItemCategoryEnum
    seller_notes: str | None = None
    images: list[InspectionImageRecord]
    analysis: InspectionAnalysisResultResponse | None = None
    pricing: PricingIntelligence | None = None
    created_at: str
    updated_at: str | None = None


class PricingAppraisalResponse(BaseModel):
    inspection_id: str
    pricing: PricingIntelligence
    currency: str = "INR"


class DefectDisputeRequest(BaseModel):
    """contract: plain string, unconstrained. coerce so wrong-type bodies never 400."""

    seller_note: Annotated[str, BeforeValidator(functools.partial(coerce_any_str, none=""))] = ""
