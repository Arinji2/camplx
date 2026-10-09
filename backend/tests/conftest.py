import asyncio
import io
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.pb import get_pb
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def pb_ready():
    """Ensure all PocketBase collections + pilot campus exist before any test."""
    from app.seed.pb_schema import bootstrap

    asyncio.run(bootstrap())


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _reset_limiter():
    from app.core.ratelimit import limiter

    limiter.reset()
    yield
    limiter.reset()


def make_session(client: TestClient, email: str | None = None) -> dict:
    email = email or f"user-{uuid.uuid4().hex[:8]}@dpu.edu.in"
    resp = client.post("/api/v1/auth/demo-session", json={"email": email})
    assert resp.status_code == 200
    return resp.json()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def seed_image(creator_id: str) -> tuple[str, str]:
    """Create inspection + one uploaded image. Returns (inspection_id, image_id)."""
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(buf, format="PNG")

    async def go() -> tuple[str, str]:
        pb = get_pb()
        insp = await pb.collection("inspections").create(
            {
                "creator_id": creator_id,
                "item_category": "electronics",
                "status": "created",
                "report_version": 1,
            }
        )
        img = await pb.collection("inspection_images").create_multipart(
            data={"inspection_id": insp["id"], "display_order": 1, "angle_label": "front"},
            files={"image_file": ("front.png", buf.getvalue(), "image/png")},
        )
        return insp["id"], img["id"]

    return asyncio.run(go())


def make_listing(client, user, *, listing_type="donate", price=None, title=None, category="other") -> str:
    """Create an active listing for user; returns listing id."""
    _, img = seed_image(user["user"]["id"])
    payload = {
        "title": title or f"Item {uuid.uuid4().hex[:8]}",
        "category": category,
        "condition": "Good",
        "listing_type": listing_type,
        "image_urls": [img],
    }
    if listing_type == "sell":
        payload["asking_price"] = price or 500
    resp = client.post("/api/v1/listings", json=payload, headers=auth_headers(user["token"]))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
