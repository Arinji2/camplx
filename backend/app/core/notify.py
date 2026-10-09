"""create_notification — sole writer to `notifications` collection. OWNER: shared (B-built).

Callers: reservation events (A-side reservation_service), need-it/system events (B-side).
"""
from app.core.pb import get_pb

NOTIFICATION_TYPES = {"like", "reservation", "request", "message", "system"}
TARGET_TYPES = {"listing", "reservation", "need_request", "chat"}


async def create_notification(
    user_id: str,
    type: str,
    actor_name: str,
    message: str,
    target_entity_type: str | None = None,
    target_entity_id: str | None = None,
) -> dict:
    if type not in NOTIFICATION_TYPES:
        raise ValueError(f"invalid notification type: {type}")
    if target_entity_type is not None and target_entity_type not in TARGET_TYPES:
        raise ValueError(f"invalid target_entity_type: {target_entity_type}")
    return await get_pb().collection("notifications").create(
        {
            "user_id": user_id,
            "type": type,
            "actor_name": actor_name[:120],
            "message": message[:500],
            "read": False,
            "target_entity_type": target_entity_type,
            "target_entity_id": target_entity_id,
        }
    )
