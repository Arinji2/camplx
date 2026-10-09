"""User/profile persistence + gamification telemetry. OWNER: shared (A-side)."""
from app.core.auth import load_user_record
from app.core.errors import ApiError
from app.core.pb import get_pb
from app.schemas.auth import UserProfileResponse
from app.seed.pb_schema import seed_campus


def shape_profile(record: dict) -> UserProfileResponse:
    return UserProfileResponse(
        id=record["id"],
        email=record["email"],
        display_name=record["display_name"],
        verified_student=bool(record.get("verified_student", False)),
        campus_id=record.get("campus_id") or "",
        campus_name=record.get("campus_name"),
        points=int(record.get("points") or 0),
        cumulative_carbon_g=int(record.get("cumulative_carbon_g") or 0),
        avatar_url=record.get("avatar_url"),
    )


async def get_profile(user_id: str) -> UserProfileResponse:
    return shape_profile(await load_user_record(user_id))


async def upsert_demo_user(email: str, display_name: str | None) -> dict:
    """Find by unique email or create with demo defaults. Demo mode only (route-gated)."""
    pb = get_pb()
    found = await pb.collection("users").get_list(filter=f'email = "{email}"')
    if found.get("items"):
        return await load_user_record(found["items"][0]["id"])
    campus_id = await seed_campus()
    fallback_name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
    record = await pb.collection("users").create(
        {
            "email": email,
            "display_name": (display_name or fallback_name)[:80],
            "campus_id": campus_id,
            "verified_student": True,
            "points": 0,
            "cumulative_carbon_g": 0,
        }
    )
    return await load_user_record(record["id"])


async def update_profile(
    user_id: str,
    display_name: str | None = None,
    avatar_url: str | None = None,
) -> UserProfileResponse:
    patch: dict = {}
    if display_name is not None:
        patch["display_name"] = display_name
    if avatar_url is not None:
        patch["avatar_url"] = avatar_url
    if not patch:
        raise ApiError(400, "NO_CHANGES", "No updatable fields supplied.")
    await get_pb().collection("users").update(user_id, patch)
    return await get_profile(user_id)


async def award_points_and_carbon(user_id: str, points: int, carbon_g: int) -> None:
    """Increment users.points + users.cumulative_carbon_g.

    FROZEN contract — reservation_service.complete calls this; B-side metrics read only.
    Read-modify-write: acceptable at campus scale; swap for PB atomic update if contended.
    """
    if points < 0 or carbon_g < 0:
        raise ApiError(400, "INVALID_AWARD", "points and carbon_g must be non-negative")
    pb = get_pb()
    record = await pb.collection("users").get_one(user_id)
    await pb.collection("users").update(
        user_id,
        {
            "points": int(record.get("points") or 0) + points,
            "cumulative_carbon_g": int(record.get("cumulative_carbon_g") or 0) + carbon_g,
        },
    )
