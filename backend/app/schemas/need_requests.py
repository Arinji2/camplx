"""Need-it schemas (openapi components). OWNER: shared."""
import functools
from typing import Annotated

from pydantic import BaseModel, BeforeValidator

from app.schemas.common import (
    ItemCategoryEnum,
    NeedUrgencyEnum,
    coerce_any_str,
    coerce_to_enum,
)
from app.schemas.listings import ListingSummary

CoercedStr = Annotated[str, BeforeValidator(functools.partial(coerce_any_str, none=""))]
CoercedOptStr = Annotated[str | None, BeforeValidator(coerce_any_str)]
CoercedCategory = Annotated[
    ItemCategoryEnum, BeforeValidator(coerce_to_enum(ItemCategoryEnum, ItemCategoryEnum.OTHER))
]
CoercedUrgency = Annotated[
    NeedUrgencyEnum, BeforeValidator(coerce_to_enum(NeedUrgencyEnum, NeedUrgencyEnum.NORMAL))
]


class CreateNeedRequestPayload(BaseModel):
    """No 400 documented — default so a bad body is never a validation error."""

    title: CoercedStr = ""
    note: CoercedOptStr = None
    category: CoercedCategory = ItemCategoryEnum.OTHER
    urgency: CoercedUrgency = NeedUrgencyEnum.NORMAL

    @property
    def title_safe(self) -> str:
        return self.title or ""

    @property
    def note_safe(self) -> str | None:
        return self.note


class NeedRequestRecord(BaseModel):
    id: str
    requester_id: str
    requester_name: str
    title: str
    note: str | None = None
    category: ItemCategoryEnum
    urgency: NeedUrgencyEnum
    created_at: str


class NeedMatchResult(BaseModel):
    listing: ListingSummary
    match_reason: str
