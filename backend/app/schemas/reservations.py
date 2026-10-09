"""Reservations schemas (openapi components). OWNER: shared."""
import functools
from typing import Annotated

from pydantic import BaseModel, BeforeValidator

from app.schemas.common import ReservationStatusEnum, coerce_any_str
from app.schemas.listings import ListingSummary

CoercedStr = Annotated[str, BeforeValidator(functools.partial(coerce_any_str, none=""))]


class ReservationRecord(BaseModel):
    id: str
    listing_id: str
    buyer_id: str
    buyer_name: str
    status: ReservationStatusEnum
    created_at: str


class MyReservationItem(BaseModel):
    reservation: ReservationRecord
    listing: ListingSummary


class CompleteReservationRequest(BaseModel):
    """coerce so wrong-type bodies never 400; unknown outcome -> 403."""

    outcome: CoercedStr


class CompletedTransactionResponse(BaseModel):
    reservation_id: str
    listing_id: str
    final_status: str
    carbon_savings_g: int
    points_awarded: int
