"""Notifications schemas (openapi components). OWNER: shared."""
from pydantic import BaseModel

from app.schemas.common import NotificationTargetEnum, NotificationTypeEnum


class NotificationItem(BaseModel):
    id: str
    type: NotificationTypeEnum
    actor_name: str
    message: str
    read: bool
    target_entity_type: NotificationTargetEnum | None = None
    target_entity_id: str | None = None
    created_at: str
