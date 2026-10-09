"""Pricing appraisal — condition penalties + campus comparables. OWNER: B-side.

Deterministic benchmarks; AI team may later enrich via estimate_retail.
All monetary values INR.
"""
from __future__ import annotations

from app.core.format import rfc3339
from app.schemas.common import (
    ComparableSourceTypeEnum,
    ConditionGradeEnum,
    DataSufficiencyEnum,
    ItemCategoryEnum,
)
from app.schemas.inspections import ComparableListingItem, PricingIntelligence

_RETAIL_BASELINE = {
    "electronics": 3000.0,
    "cycles": 8000.0,
    "furniture": 5000.0,
    "books": 400.0,
    "hostel_essentials": 1000.0,
    "other": 1200.0,
}
_CONDITION_PENALTY = {
    "Like New": 0.10,
    "Good": 0.25,
    "Fair": 0.45,
    "Needs Repair": 0.65,
}


def comparable_from_listing(record: dict) -> ComparableListingItem:
    return ComparableListingItem(
        id=record["id"],
        title=record.get("title") or "Campus listing",
        price=float(record.get("asking_price") or 0),
        currency="INR",
        condition=record["condition"],
        source_type=str(ComparableSourceTypeEnum.INTERNAL_CAMPLX_ACTIVE),
        source_name="Camplx Campus Resale History",
        observed_at=rfc3339(record.get("created")),
    )


def build_appraisal(
    category: ItemCategoryEnum,
    condition: ConditionGradeEnum,
    comparables: list[ComparableListingItem],
) -> PricingIntelligence:
    retail = _RETAIL_BASELINE.get(str(category), 1200.0)
    penalty_rate = _CONDITION_PENALTY.get(str(condition), 0.25)
    benchmark_used = retail * (1 - penalty_rate)

    priced = [c for c in comparables if c.price > 0]
    if priced:
        typical = sum(c.price for c in priced) / len(priced)
        used = 0.5 * benchmark_used + 0.5 * typical
        sufficiency = (
            DataSufficiencyEnum.SUFFICIENT if len(priced) >= 3 else DataSufficiencyEnum.LIMITED
        )
        reason = None if len(priced) >= 3 else "Limited campus comparable volume; blended with category benchmark."
    else:
        typical = None
        used = benchmark_used
        sufficiency = DataSufficiencyEnum.INSUFFICIENT
        reason = "No campus comparables; valuation based on category benchmark only."

    recommended = round(used, -1)  # nearest 10 INR
    return PricingIntelligence(
        data_sufficiency=str(sufficiency),
        insufficient_data_reason=reason,
        estimated_retail_new=retail,
        typical_used_market_price=round(typical, 2) if typical is not None else None,
        condition_penalty_amount=round(retail * penalty_rate, 2),
        recommended_min_price=round(recommended * 0.9, -1),
        recommended_listing_price=recommended,
        recommended_max_price=round(recommended * 1.15, -1),
        pricing_rationale=(
            f"{condition} grade applies {int(penalty_rate * 100)}% penalty on "
            f"{category} benchmark retail of INR {retail:.0f}; "
            f"{len(priced)} campus comparable(s) blended in."
        ),
        comparables=comparables,
        comparables_count=len(comparables),
    )
