"""Sustainability metrics — aggregate diversion + leaderboard. OWNER: B-side.

Personal figures are directional (embodied-carbon displacement estimates);
verified facts are limited to counts and weights recorded by platform events.
"""
from __future__ import annotations

from app.core.pb import get_pb
from app.schemas.sustainability import LeaderboardStandingItem, SustainabilitySummaryResponse

_METHODOLOGY = (
    "Directional CO2e savings based on standard embodied carbon displacement values. "
    "Counts and diverted weights are platform-verified; carbon figures are estimates."
)
_LEADERBOARD_LIMIT = 20


async def sustainability_summary(user_id: str | None) -> SustainabilitySummaryResponse:
    users = await get_pb().collection("users").get_full_list()
    campus_kg = sum(float(u.get("cumulative_carbon_g") or 0) for u in users) / 1000.0
    personal_kg = 0.0
    if user_id:
        personal_kg = sum(
            float(u.get("cumulative_carbon_g") or 0) for u in users if u["id"] == user_id
        ) / 1000.0

    completed = await get_pb().collection("reservations").get_full_list(filter='status = "completed"')
    handed = await get_pb().collection("ewaste_requests").get_full_list(filter='status = "handed_over"')
    diverted_kg = sum(float(r.get("estimated_carbon_kg") or 0) for r in handed)

    return SustainabilitySummaryResponse(
        personal_carbon_kg=round(personal_kg, 2),
        campus_carbon_kg=round(campus_kg, 2),
        items_reused_count=len(completed),
        ewaste_diverted_kg=round(diverted_kg, 2),
        methodology_note=_METHODOLOGY,
    )


async def campus_leaderboard(campus_id: str | None) -> list[LeaderboardStandingItem]:
    clauses = []
    if campus_id:
        from app.services.listing_service import _require_safe

        clauses.append(f'campus_id = "{_require_safe(campus_id, "campus_id")}"')
    users = await get_pb().collection("users").get_full_list(
        filter=" && ".join(clauses) or None, sort="-points"
    )
    ranked = sorted(users, key=lambda u: int(u.get("points") or 0), reverse=True)[:_LEADERBOARD_LIMIT]
    return [
        LeaderboardStandingItem(
            rank=i,
            user_id=u["id"],
            display_name=u.get("display_name") or "Campus Student",
            points=int(u.get("points") or 0),
            carbon_saved_kg=round(float(u.get("cumulative_carbon_g") or 0) / 1000.0, 2),
        )
        for i, u in enumerate(ranked, start=1)
    ]
