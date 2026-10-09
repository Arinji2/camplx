"""Sustainability domain. 2 public ops."""
from fastapi import APIRouter, Depends, Header, Query

from app.core.auth import get_current_user
from app.core.errors import ApiError
from app.schemas.sustainability import LeaderboardStandingItem, SustainabilitySummaryResponse
from app.services import metrics

router = APIRouter(prefix="/api/v1", tags=["Sustainability"])


async def _optional_user(
    authorization: str | None = Header(default=None),
    x_camplx_demo_user_id: str | None = Header(default=None),
) -> dict | None:
    """Best-effort identity for public summary; anonymous allowed."""
    try:
        return await get_current_user(authorization, x_camplx_demo_user_id)
    except ApiError as exc:
        if exc.status_code in (401, 403):
            return None
        raise


@router.get("/sustainability/summary", response_model=SustainabilitySummaryResponse)
async def get_sustainability_summary(user: dict | None = Depends(_optional_user)) -> SustainabilitySummaryResponse:
    """operationId getSustainabilitySummary. 200. Public — personal figures zero when anonymous."""
    return await metrics.sustainability_summary(user["id"] if user else None)


@router.get("/leaderboard", response_model=list[LeaderboardStandingItem])
async def get_campus_leaderboard(
    campus_id: str | None = Query(default=None),
) -> list[LeaderboardStandingItem]:
    """operationId getCampusLeaderboard. 200. Public."""
    return await metrics.campus_leaderboard(campus_id)
