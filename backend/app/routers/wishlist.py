"""Wishlist domain. 3 ops."""
from fastapi import APIRouter, Depends, Request, Response

from app.core.auth import get_current_user
from app.schemas.listings import ListingSummary
from app.schemas.wishlist import WishlistAddRequest
from app.services import wishlist_service

router = APIRouter(prefix="/api/v1", tags=["Wishlist"])


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


@router.get("/wishlist", response_model=list[ListingSummary])
async def get_my_wishlist(user: dict = Depends(get_current_user)) -> list[ListingSummary]:
    """operationId getMyWishlist. 200."""
    return await wishlist_service.get_my_wishlist(user)


@router.post("/wishlist", status_code=201)
async def add_to_wishlist(
    request: Request,
    user: dict = Depends(get_current_user),
) -> Response:
    """operationId addToWishlist. 201 | 404. No 400 documented — a missing/unknown listing_id resolves to 404."""
    payload = WishlistAddRequest.model_validate(await _json_body(request))
    await wishlist_service.add_to_wishlist(user, payload.listing_id or None)
    return Response(status_code=201)


@router.delete("/wishlist/{listing_id}", status_code=204)
async def remove_from_wishlist(
    listing_id: str,
    user: dict = Depends(get_current_user),
) -> Response:
    """operationId removeFromWishlist. 204."""
    await wishlist_service.remove_from_wishlist(user, listing_id)
    return Response(status_code=204)
