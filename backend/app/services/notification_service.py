"""Notifications domain — list + read state. OWNER: shared (B-built).

Sole writer is core.notify.create_notification; this service owns reads.
"""
from __future__ import annotations

from app.core.errors import ApiError
from app.core.format import rfc3339
from app.core.pb import get_pb
from app.schemas.notifications import NotificationItem


def _item(r: dict) -> NotificationItem:
    return NotificationItem(
        id=r["id"],
        type=r["type"],
        actor_name=r["actor_name"],
        message=r["message"],
        read=bool(r.get("read", False)),
        target_entity_type=r.get("target_entity_type") or None,
        target_entity_id=r.get("target_entity_id") or None,
        created_at=rfc3339(r.get("created")),
    )


async def list_notifications(user: dict) -> list[NotificationItem]:
    data = await get_pb().collection("notifications").get_full_list(
        filter=f'user_id = "{user["id"]}"', sort="-created"
    )
    return [_item(r) for r in data]


async def mark_read(user: dict, notification_id: str) -> None:
    """Contract declares 200 only — unknown/foreign ids are silent no-ops."""
    try:
        record = await get_pb().collection("notifications").get_one(notification_id)
    except ApiError:
        return
    if record.get("user_id") != user["id"]:
        return
    if not record.get("read"):
        await get_pb().collection("notifications").update(notification_id, {"read": True})


async def mark_all_read(user: dict) -> None:
    data = await get_pb().collection("notifications").get_full_list(
        filter=f'user_id = "{user["id"]}" && read = false'
    )
    for r in data:
        await get_pb().collection("notifications").update(r["id"], {"read": True})
