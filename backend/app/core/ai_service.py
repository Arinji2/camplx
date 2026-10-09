"""AI provider interface. OWNER: B-side (interface) / AI team (gemini impl).

Frozen contract:
  - AI returns structured findings ONLY; defect IDs + image_id binding + annotation
    rendering stay backend-side (inspection_service / annotate).
  - box_2d = [ymin, xmin, ymax, xmax], normalized 0-1000.
  - Env switch: AI_PROVIDER=stub|gemini. Timeout + validation wrap every call;
    any failure surfaces as 502, never raw provider errors.
"""
import asyncio
from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings
from app.core.errors import ApiError
from app.schemas.common import (
    AttributeProvenanceEnum,
    ConditionGradeEnum,
    ItemCategoryEnum,
    LifecycleCategoryEnum,
)


class AIDefect(BaseModel):
    defect_type: str = Field(max_length=80)
    severity: str = Field(max_length=80)
    box_2d: list[int] = Field(min_length=4, max_length=4)
    buyer_note: str = Field(max_length=600)


class AIAmazonListing(BaseModel):
    title: str = Field(max_length=200)
    key_features_bullets: list[str] = Field(max_length=8)
    technical_specifications: dict[str, str] = Field(default_factory=dict)
    seller_condition_summary: str = Field(max_length=600)


class AnalysisResult(BaseModel):
    identified_product_name: str = Field(max_length=200)
    brand: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)
    category: ItemCategoryEnum
    overall_condition: ConditionGradeEnum
    circular_lifecycle_category: LifecycleCategoryEnum
    defects: list[AIDefect] = Field(max_length=30)
    amazon_listing: AIAmazonListing
    specification_provenance: dict[str, AttributeProvenanceEnum] = Field(default_factory=dict)


@runtime_checkable
class AIProvider(Protocol):
    def analyze(
        self,
        images: list[bytes],
        item_category: ItemCategoryEnum,
        seller_notes: str | None,
    ) -> AnalysisResult: ...

    def estimate_retail(self, identity: str, category: ItemCategoryEnum) -> float | None: ...


class StubProvider:
    """Deterministic fixture — boot/test with zero AI deps. AI team replaces with gemini."""

    def analyze(
        self,
        images: list[bytes],
        item_category: ItemCategoryEnum,
        seller_notes: str | None,
    ) -> AnalysisResult:
        return AnalysisResult(
            identified_product_name="Stub Verified Item",
            brand="Stub",
            model="S-1",
            category=item_category,
            overall_condition=ConditionGradeEnum.GOOD,
            circular_lifecycle_category=LifecycleCategoryEnum.REUSABLE,
            defects=[
                AIDefect(
                    defect_type="Bezel Scuff",
                    severity="Cosmetic Minor",
                    box_2d=[120, 160, 260, 420],
                    buyer_note="Light surface scuff on outer border. Glass display untouched.",
                )
            ],
            amazon_listing=AIAmazonListing(
                title="Stub Verified Item (Good)",
                key_features_bullets=["Stub inspection bullet"],
                technical_specifications={"Condition": "Good"},
                seller_condition_summary="Stub condition summary.",
            ),
            specification_provenance={"Brand": AttributeProvenanceEnum.AI_ESTIMATED},
        )

    def estimate_retail(self, identity: str, category: ItemCategoryEnum) -> float | None:
        return None


def get_provider() -> AIProvider:
    if get_settings().ai_provider == "gemini":
        raise ApiError(503, "AI_NOT_CONFIGURED", "Gemini provider is not registered yet.")
    return StubProvider()


async def run_analysis(
    images: list[bytes],
    item_category: ItemCategoryEnum,
    seller_notes: str | None,
) -> AnalysisResult:
    """Analyze with timeout + schema validation; map all failures to 502."""
    settings = get_settings()
    provider = get_provider()
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(provider.analyze, images, item_category, seller_notes),
            timeout=settings.ai_timeout_seconds,
        )
    except TimeoutError as exc:
        raise ApiError(502, "AI_TIMEOUT", "AI analysis timed out.") from exc
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(502, "AI_PROVIDER_ERROR", "AI analysis provider failed.") from exc

    if not isinstance(result, AnalysisResult):
        try:
            result = AnalysisResult.model_validate(result)
        except (ValidationError, TypeError) as exc:
            raise ApiError(502, "AI_INVALID_RESPONSE", "AI provider returned invalid output.") from exc
    return result
