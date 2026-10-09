"""System schemas (openapi components). OWNER: shared."""
from datetime import datetime

from pydantic import BaseModel


class HealthStatusResponse(BaseModel):
    status: str = "ok"
    timestamp: datetime
    database_connected: bool
    ai_service_available: bool
