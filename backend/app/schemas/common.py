"""Shared enums + ErrorResponse — verbatim from openapi.yml. OWNER: shared (do not diverge)."""
import enum

from pydantic import BaseModel, Field


def coerce_any_str(value, none=None):
    """Accept any JSON type, render as str. `none` is the value returned for JSON null.

    Used on request-id/note fields whose openapi contract declares no 400.
    Wrong-typed bodies must not 422; they resolve to the natural 404/201.
    """
    if isinstance(value, str):
        return value
    if value is None:
        return none
    return str(value)


def coerce_to_enum(enum_cls, default):
    """Coerce any JSON value to an enum member, falling back to `default`.

    Used on request-body enum fields whose openapi contract declares no 400.
    Wrong-typed/out-of-range bodies must not 422; they fall back to a working default.
    """

    def _coerce(value):
        if isinstance(value, enum_cls):
            return value
        try:
            return enum_cls(value)
        except (ValueError, TypeError):
            return default

    return _coerce


class ErrorResponse(BaseModel):
    code: str = Field(json_schema_extra={"example": "INVALID_STATE_TRANSITION"})
    message: str = Field(
        json_schema_extra={"example": "This listing is already reserved by another student."}
    )
    details: dict | None = None


class ItemCategoryEnum(enum.StrEnum):
    ELECTRONICS = "electronics"
    BOOKS = "books"
    CYCLES = "cycles"
    FURNITURE = "furniture"
    HOSTEL_ESSENTIALS = "hostel_essentials"
    OTHER = "other"


class ListingTypeEnum(enum.StrEnum):
    SELL = "sell"
    DONATE = "donate"


class ListingStatusEnum(enum.StrEnum):
    ACTIVE = "active"
    RESERVED = "reserved"
    SOLD = "sold"
    DONATED = "donated"
    INACTIVE = "inactive"


class SellerListingStatusUpdateEnum(enum.StrEnum):
    """Only active/inactive via listing edits; reserved/terminal are workflow-gated."""

    ACTIVE = "active"
    INACTIVE = "inactive"


class ConditionGradeEnum(enum.StrEnum):
    LIKE_NEW = "Like New"
    GOOD = "Good"
    FAIR = "Fair"
    NEEDS_REPAIR = "Needs Repair"


class LifecycleCategoryEnum(enum.StrEnum):
    REUSABLE = "Reusable"
    REPAIRABLE = "Repairable"
    END_OF_LIFE = "End-of-life"


class AngleLabelEnum(enum.StrEnum):
    FRONT = "front"
    BACK = "back"
    LEFT = "left"
    RIGHT = "right"
    TOP = "top"
    BOTTOM = "bottom"
    DEFECT_CLOSE_UP = "defect_close_up"
    LABEL_OR_SERIAL = "label_or_serial"
    OTHER = "other"


class NotificationTypeEnum(enum.StrEnum):
    LIKE = "like"
    RESERVATION = "reservation"
    REQUEST = "request"
    MESSAGE = "message"
    SYSTEM = "system"


class NotificationTargetEnum(enum.StrEnum):
    LISTING = "listing"
    RESERVATION = "reservation"
    NEED_REQUEST = "need_request"
    CHAT = "chat"


class EWasteDeviceCategoryEnum(enum.StrEnum):
    LAPTOPS_AND_COMPUTERS = "laptops_and_computers"
    PHONES_AND_TABLETS = "phones_and_tablets"
    BATTERIES_AND_POWER_BANKS = "batteries_and_power_banks"
    CHARGERS_AND_CABLES = "chargers_and_cables"
    PRINTERS_AND_PERIPHERALS = "printers_and_peripherals"
    AUDIO_AND_ACCESSORIES = "audio_and_accessories"
    OTHER_ELECTRONICS = "other_electronics"


class ReservationStatusEnum(enum.StrEnum):
    ACTIVE = "active"
    RELEASED = "released"
    COMPLETED = "completed"


class NeedUrgencyEnum(enum.StrEnum):
    LOW = "low"
    NORMAL = "normal"
    URGENT = "urgent"


class EWasteLifecycleStatusEnum(enum.StrEnum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    COLLECTED = "collected"
    HANDED_OVER = "handed_over"


class DataSufficiencyEnum(enum.StrEnum):
    SUFFICIENT = "sufficient"
    LIMITED = "limited"
    INSUFFICIENT = "insufficient"


class ComparableSourceTypeEnum(enum.StrEnum):
    INTERNAL_CAMPLX_ACTIVE = "internal_camplx_active"
    INTERNAL_CAMPLX_SOLD = "internal_camplx_sold"
    EXTERNAL_MARKETPLACE = "external_marketplace"
    CATALOG_BENCHMARK = "catalog_benchmark"


class AttributeProvenanceEnum(enum.StrEnum):
    VISUALLY_VERIFIED = "visually_verified"
    SELLER_SUPPLIED = "seller_supplied"
    CATALOG_INFERRED = "catalog_inferred"
    AI_ESTIMATED = "ai_estimated"
