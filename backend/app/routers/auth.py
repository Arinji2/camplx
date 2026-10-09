"""Auth & Identity domain. 3 ops."""
from fastapi import APIRouter, Depends

from app.config import get_settings
from app.core.auth import get_current_user, issue_token
from app.core.errors import ApiError
from app.core.ratelimit import rate_limit
from app.schemas.auth import (
    AuthSessionResponse,
    DemoSessionRequest,
    UserProfileResponse,
    UserProfileUpdateRequest,
)
from app.services import user_service

router = APIRouter(prefix="/api/v1", tags=["Auth & Identity"])


@router.post(
    "/auth/demo-session",
    response_model=AuthSessionResponse,
    status_code=200,
    dependencies=[Depends(rate_limit("auth-demo", 20))],
)
async def create_demo_session(payload: DemoSessionRequest) -> AuthSessionResponse:
    """operationId createDemoSession. 200 | 400 | 403 (DEMO_MODE=false).

    Upserts demo identity by email and issues an HS256 access token.
    """
    if not get_settings().demo_mode:
        raise ApiError(403, "DEMO_DISABLED", "Demo session bootstrap is disabled.")
    user = await user_service.upsert_demo_user(payload.email, payload.display_name)
    return AuthSessionResponse(token=issue_token(user["id"]), user=user_service.shape_profile(user))


@router.get("/auth/me", response_model=UserProfileResponse)
async def get_current_user_profile(user: dict = Depends(get_current_user)) -> UserProfileResponse:
    """operationId getCurrentUserProfile. 200 | 401."""
    return user_service.shape_profile(user)


@router.patch("/auth/me", response_model=UserProfileResponse)
async def update_current_user_profile(
    payload: UserProfileUpdateRequest,
    user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    """operationId updateCurrentUserProfile. 200 | 400 | 401."""
    return await user_service.update_profile(
        user["id"], display_name=payload.display_name, avatar_url=payload.avatar_url
    )
