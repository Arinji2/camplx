"""Notifications domain. 3 ops."""
from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.schemas.notifications import NotificationItem
from app.services import notification_service

router = APIRouter(prefix="/api/v1", tags=["Notifications"])


@router.get("/notifications", response_model=list[NotificationItem])
async def get_my_notifications(user: dict = Depends(get_current_user)) -> list[NotificationItem]:
    """operationId getMyNotifications. 200 | 401."""
    return await notification_service.list_notifications(user)


@router.post("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """operationId markNotificationAsRead. 200 | 401 | 404."""
    await notification_service.mark_read(user, notification_id)
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
async def mark_all_notifications_as_read(user: dict = Depends(get_current_user)) -> dict:
    """operationId markAllNotificationsAsRead. 200 | 401."""
    await notification_service.mark_all_read(user)
    return {"message": "All notifications marked as read"}
