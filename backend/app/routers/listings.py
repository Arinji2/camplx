"""Marketplace domain. 6 ops (reservation sub-routes mount in P4)."""
from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import get_current_user
from app.schemas.common import (
    ItemCategoryEnum,
    ListingStatusEnum,
    ListingTypeEnum,
)
from app.schemas.listings import (
    CreateListingRequest,
    ListingDetailResponse,
    PaginatedListingsResponse,
    SellerProfileWithListingsResponse,
    UpdateListingRequest,
)
from app.services import listing_service

router = APIRouter(prefix="/api/v1", tags=["Marketplace"])


@router.get("/listings", response_model=PaginatedListingsResponse)
async def list_marketplace_listings(
    campus_id: str | None = Query(default=None),
    category: ItemCategoryEnum | None = Query(default=None),
    status: ListingStatusEnum | None = Query(default=None),
    listing_type: ListingTypeEnum | None = Query(default=None),
    search: str | None = Query(default=None, max_length=60),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> PaginatedListingsResponse:
    """operationId listMarketplaceListings. 200 | 400."""
    return await listing_service.list_listings(
        campus_id=campus_id,
        category=category,
        status=status,
        listing_type=listing_type,
        search=search,
        page=page,
        per_page=per_page,
    )


@router.post("/listings", response_model=ListingDetailResponse, status_code=201)
async def create_marketplace_listing(
    payload: CreateListingRequest,
    user: dict = Depends(get_current_user),
) -> ListingDetailResponse:
    """operationId createMarketplaceListing. 201 | 400 | 401."""
    return await listing_service.create_listing(user, payload)


@router.get("/listings/{listing_id}", response_model=ListingDetailResponse)
async def get_listing_detail(listing_id: str) -> ListingDetailResponse:
    """operationId getListingDetail. 200 | 404."""
    return await listing_service.get_listing_detail(listing_id)


@router.patch("/listings/{listing_id}", response_model=ListingDetailResponse)
async def update_marketplace_listing(
    listing_id: str,
    payload: UpdateListingRequest,
    user: dict = Depends(get_current_user),
) -> ListingDetailResponse:
    """operationId updateMarketplaceListing. 200 | 400 | 403 | 404."""
    return await listing_service.update_listing(user, listing_id, payload)


@router.delete("/listings/{listing_id}", status_code=204)
async def delete_marketplace_listing(
    listing_id: str,
    user: dict = Depends(get_current_user),
) -> Response:
    """operationId deleteMarketplaceListing. 204 | 403 | 404."""
    await listing_service.delete_listing(user, listing_id)
    return Response(status_code=204)


@router.get("/sellers/{seller_id}/listings", response_model=SellerProfileWithListingsResponse)
async def get_seller_public_profile_and_listings(seller_id: str) -> SellerProfileWithListingsResponse:
    """operationId getSellerPublicProfileAndListings. 200 | 404."""
    return await listing_service.get_seller_listings(seller_id)
