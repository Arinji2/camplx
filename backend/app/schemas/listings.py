"""Listings schemas (openapi components). OWNER: shared."""
from pydantic import BaseModel, Field

from app.schemas.common import (
    AttributeProvenanceEnum,
    ConditionGradeEnum,
    ItemCategoryEnum,
    ListingStatusEnum,
    ListingTypeEnum,
    SellerListingStatusUpdateEnum,
)


class CreateListingRequest(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    category: ItemCategoryEnum
    condition: ConditionGradeEnum
    listing_type: ListingTypeEnum
    image_urls: list[str] = Field(min_length=1, max_length=10)
    brand: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=4000)
    asking_price: float | None = Field(default=None, gt=0)  # required for sell, null for donate
    inspection_id: str | None = None
    technical_specifications: dict[str, str] | None = None
    specification_provenance: dict[str, AttributeProvenanceEnum] | None = None


class UpdateListingRequest(BaseModel):
    """status restricted to active|inactive — terminal states are workflow-gated."""

    title: str | None = Field(default=None, min_length=3, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    asking_price: float | None = Field(default=None, gt=0)
    status: SellerListingStatusUpdateEnum | None = None


class ListingSummary(BaseModel):
    id: str
    seller_id: str
    title: str
    category: ItemCategoryEnum
    condition: ConditionGradeEnum
    listing_type: ListingTypeEnum
    status: ListingStatusEnum
    primary_image_url: str
    created_at: str
    brand: str | None = None
    model: str | None = None
    asking_price: float | None = None
    carbon_savings_g: int | None = None


class ListingDetailResponse(BaseModel):
    id: str
    seller_id: str
    seller_name: str
    campus_id: str
    title: str
    category: ItemCategoryEnum
    condition: ConditionGradeEnum
    listing_type: ListingTypeEnum
    status: ListingStatusEnum
    images: list[dict]  # InspectionImageRecord — typed when P5 inspection lands
    created_at: str
    brand: str | None = None
    model: str | None = None
    description: str | None = None
    asking_price: float | None = None
    carbon_savings_g: int | None = None
    technical_specifications: dict[str, str] | None = None
    specification_provenance: dict[str, AttributeProvenanceEnum] | None = None
    inspection: dict | None = None  # get_inspection_bundle embed (P9)
    pricing_intelligence: dict | None = None
    active_reservation: dict | None = None


class PaginatedListingsResponse(BaseModel):
    items: list[ListingSummary]
    total: int
    page: int
    per_page: int


class PublicSellerProfileResponse(BaseModel):
    id: str
    display_name: str
    verified_student: bool
    campus_id: str
    campus_name: str | None = None
    points: int
    cumulative_carbon_g: int
    avatar_url: str | None = None


class SellerProfileWithListingsResponse(BaseModel):
    seller: PublicSellerProfileResponse
    listings: list[ListingSummary]
