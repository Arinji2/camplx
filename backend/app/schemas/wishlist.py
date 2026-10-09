"""Wishlist schemas (openapi: inline body + ListingSummary list). OWNER: shared."""
from typing import Annotated

from pydantic import BaseModel, BeforeValidator

from app.schemas.common import coerce_any_str

CoercedStr = Annotated[str | None, BeforeValidator(coerce_any_str)]  # null -> 404, not a validation error


class WishlistAddRequest(BaseModel):
    """No 400 documented — default so a bad body is never a validation error.

    Service resolves an unknown/malformed listing_id to 404 (documented).
    """

    listing_id: CoercedStr = ""
