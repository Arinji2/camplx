"""Reservations domain. 5 ops."""
import json

from fastapi import APIRouter, Depends, Request

from app.core.auth import get_current_user
from app.schemas.reservations import (
    CompletedTransactionResponse,
    CompleteReservationRequest,
    MyReservationItem,
    ReservationRecord,
)
from app.services import reservation_service

router = APIRouter(prefix="/api/v1", tags=["Reservations"])


@router.get("/listings/{listing_id}/reservations", response_model=ReservationRecord)
async def get_active_listing_reservation(
    listing_id: str,
    user: dict = Depends(get_current_user),
) -> ReservationRecord:
    """operationId getActiveListingReservation. 200 | 404.

    Listing seller or holding buyer only; others see 404.
    """
    return await reservation_service.get_active_listing_reservation(user, listing_id)


@router.post("/listings/{listing_id}/reservations", response_model=ReservationRecord, status_code=201)
async def create_listing_reservation(
    listing_id: str,
    user: dict = Depends(get_current_user),
) -> ReservationRecord:
    """operationId createListingReservation. 201 | 404 | 409."""
    return await reservation_service.create_reservation(user, listing_id)


@router.get("/reservations/my", response_model=list[MyReservationItem])
async def list_my_reservations(user: dict = Depends(get_current_user)) -> list[MyReservationItem]:
    """operationId listMyReservations. 200."""
    return await reservation_service.list_my_reservations(user)


@router.post("/reservations/{reservation_id}/release", response_model=ReservationRecord)
async def release_reservation(
    reservation_id: str,
    user: dict = Depends(get_current_user),
) -> ReservationRecord:
    """operationId releaseReservation. 200 | 403 | 404."""
    return await reservation_service.release_reservation(user, reservation_id)


@router.post("/reservations/{reservation_id}/complete", response_model=CompletedTransactionResponse)
async def complete_reservation(
    reservation_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
) -> CompletedTransactionResponse:
    """operationId completeReservation. 200 | 403. A missing/invalid outcome is an undocumented 403 (RESERVATION_NOT_FOUND), never a 400."""
    raw = await request.body()
    try:
        data = json.loads(raw) if raw else {}
    except ValueError:
        data = {}
    outcome = data.get("outcome") if isinstance(data, dict) else None
    payload = CompleteReservationRequest.model_validate({"outcome": outcome or ""})
    return await reservation_service.complete_reservation(user, reservation_id, payload.outcome)
