"""System domain. 1 op."""
from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.errors import ApiError
from app.core.pb import get_pb
from app.schemas.system import HealthStatusResponse

router = APIRouter(prefix="/api/v1", tags=["System"])


async def _pb_healthy() -> bool:
    try:
        resp = await get_pb()._http().get("/api/health")
        return resp.status_code == 200
    except Exception:  # noqa: BLE001 — health probe must never raise
        return False


def _ai_available() -> bool:
    from app.config import get_settings
    from app.core.ai_service import get_provider

    try:
        get_provider()
        return True
    except ApiError:
        return get_settings().ai_provider != "gemini"  # stub always available; gemini needs team impl


@router.get("/system/health", response_model=HealthStatusResponse, status_code=200)
async def get_system_health() -> HealthStatusResponse:
    """operationId getSystemHealth. 200 HealthStatusResponse | 503 ErrorResponse."""
    db_ok = await _pb_healthy()
    ai_ok = _ai_available()
    if not db_ok:
        raise ApiError(503, "PERSISTENCE_UNAVAILABLE", "Persistence layer is unreachable.")
    return HealthStatusResponse(
        status="ok",
        timestamp=datetime.now(UTC),
        database_connected=db_ok,
        ai_service_available=ai_ok,
    )
