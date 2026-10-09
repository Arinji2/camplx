"""Media storage/serving. OWNER: B-side.

URL shape (frozen): GET /api/v1/media/{record_id}/{filename}
All inspection/listing image assets live on the `inspection_images` collection.
Safety: server-minted IDs only (allowlist regex), PIL re-encode strips
EXIF/polyglot payloads, size cap enforced before decode.
"""
import io
import re

from fastapi import APIRouter, Response
from PIL import Image, UnidentifiedImageError

from app.config import get_settings
from app.core.errors import ApiError
from app.core.pb import get_pb

media_router = APIRouter(prefix="/api/v1/media", tags=["System"])

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_SAFE_FILENAME = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png"}


def require_safe(value: str, pattern: re.Pattern[str]) -> str:
    if not pattern.match(value):
        raise ApiError(404, "NOT_FOUND", "Resource not found.")
    return value


def sanitize_image_bytes(data: bytes) -> tuple[bytes, str, str]:
    """Re-encode to clean JPEG/PNG. Returns (bytes, media_type, extension).

    Raises 400 on oversize, non-image, or unsupported format.
    """
    settings = get_settings()
    if len(data) > settings.max_image_bytes:
        raise ApiError(400, "IMAGE_TOO_LARGE", "Image exceeds the 15MB limit.")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ApiError(400, "INVALID_IMAGE", "File is not a valid image.") from exc

    fmt = (img.format or "").upper()
    if fmt not in _ALLOWED_FORMATS:
        raise ApiError(400, "INVALID_IMAGE_TYPE", "Only JPEG or PNG images are accepted.")

    out = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(out, format="JPEG", quality=88)
        return out.getvalue(), "image/jpeg", "jpg"
    img.save(out, format="PNG")
    return out.getvalue(), "image/png", "png"


async def create_record_with_file(
    collection: str,
    fields: dict,
    file_field: str,
    filename: str,
    data: bytes,
) -> dict:
    """Create PB record carrying one file part (multipart)."""
    return await get_pb().collection(collection).create_multipart(
        data=fields, files={file_field: (filename, data, _ALLOWED_FORMATS.get("JPEG", ""))}
    )


async def update_record_file(
    collection: str,
    record_id: str,
    fields: dict,
    file_field: str,
    filename: str,
    data: bytes,
    content_type: str,
) -> dict:
    return await get_pb().collection(collection).update_multipart(
        record_id=record_id,
        data=fields,
        files={file_field: (filename, data, content_type)},
    )


@media_router.get("/{record_id}/{filename}")
async def serve_media(record_id: str, filename: str) -> Response:
    """Stream stored image bytes. 404 on bad ID shape or missing asset."""
    require_safe(record_id, _SAFE_ID)
    require_safe(filename, _SAFE_FILENAME)
    record = await get_pb().collection("inspection_images").get_one_or_404(
        record_id, message="Asset not found."
    )
    stored = [record.get("image_file"), record.get("annotated_image")]
    if filename not in [f for f in stored if isinstance(f, str)]:
        raise ApiError(404, "NOT_FOUND", "Asset not found.")
    content, content_type = await get_pb().collection("inspection_images").file_bytes(
        record_id, filename
    )
    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )
