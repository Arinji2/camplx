"""Identity: JWT issuance + get_current_user. OWNER: shared foundation.

Security rules:
  - client-supplied user ids NEVER trusted directly (demo header gated by DEMO_MODE
    and resolved against the users collection).
  - get_current_user is the single identity entrypoint for all 37 operations.
"""
import re
import time
import uuid

import jwt
from fastapi import Header

from app.config import get_settings
from app.core.errors import ApiError
from app.core.pb import get_pb

_ALGORITHM = "HS256"
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")  # PB ids are 15-char alnum

_demo_header = Header(default=None, alias="X-Camplx-Demo-User-Id")


def issue_token(user_id: str) -> str:
    settings = get_settings()
    if not settings.jwt_secret:
        raise ApiError(500, "CONFIG_ERROR", "JWT_SECRET is not configured.")
    now = int(time.time())
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + settings.jwt_ttl_seconds, "jti": uuid.uuid4().hex},
        settings.jwt_secret,
        algorithm=_ALGORITHM,
    )


def decode_token(token: str) -> str:
    settings = get_settings()
    if not settings.jwt_secret:
        raise ApiError(500, "CONFIG_ERROR", "JWT_SECRET is not configured.")
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "TOKEN_EXPIRED", "Credentials expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(401, "INVALID_TOKEN", "Credentials are invalid.") from exc
    sub = claims.get("sub")
    if not sub:
        raise ApiError(401, "INVALID_TOKEN", "Credentials are invalid.")
    return sub


async def load_user_record(user_id: str) -> dict:
    record = await get_pb().collection("users").get_one(user_id)
    campus_name = None
    campus_id = record.get("campus_id")
    if campus_id:
        try:
            campus_name = (await get_pb().collection("campuses").get_one(campus_id)).get("name")
        except ApiError:
            campus_name = None  # campus relation may be unseeded; profile endpoints 404 explicitly
    record["campus_name"] = campus_name
    return record


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_camplx_demo_user_id: str | None = _demo_header,
) -> dict:
    """Resolve current user from Bearer JWT or demo bypass header. 401/403 otherwise."""
    settings = get_settings()

    if x_camplx_demo_user_id is not None:
        if not settings.demo_mode:
            raise ApiError(403, "DEMO_DISABLED", "Demo identity bypass is disabled.")
        if not _SAFE_ID.match(x_camplx_demo_user_id):
            raise ApiError(401, "UNAUTHORIZED", "Missing or invalid credentials.")
        try:
            return await load_user_record(x_camplx_demo_user_id)
        except ApiError as exc:
            if exc.status_code == 404:
                raise ApiError(401, "UNAUTHORIZED", "Missing or invalid credentials.") from exc
            raise

    if authorization and authorization.lower().startswith("bearer "):
        user_id = decode_token(authorization[7:].strip())
        try:
            return await load_user_record(user_id)
        except ApiError as exc:
            if exc.status_code == 404:
                raise ApiError(401, "UNAUTHORIZED", "Account no longer exists.") from exc
            raise

    raise ApiError(401, "UNAUTHORIZED", "Missing or invalid credentials.")
