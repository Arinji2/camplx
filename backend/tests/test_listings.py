"""P3 listings tests — 6 marketplace ops."""
import asyncio
import io
import uuid

from PIL import Image

from app.core.pb import get_pb


def _session(client, email: str | None = None) -> dict:
    email = email or f"seller-{uuid.uuid4().hex[:8]}@dpu.edu.in"
    resp = client.post("/api/v1/auth/demo-session", json={"email": email})
    assert resp.status_code == 200
    return resp.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _seed_image(creator_id: str) -> tuple[str, str]:
    """Create inspection + one uploaded image record. Returns (inspection_id, image_id)."""
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(buf, format="PNG")

    async def go() -> tuple[str, str]:
        pb = get_pb()
        insp = await pb.collection("inspections").create(
            {"creator_id": creator_id, "item_category": "electronics", "status": "created", "report_version": 1}
        )
        img = await pb.collection("inspection_images").create_multipart(
            data={"inspection_id": insp["id"], "display_order": 1, "angle_label": "front"},
            files={"image_file": ("front.png", buf.getvalue(), "image/png")},
        )
        return insp["id"], img["id"]

    return asyncio.run(go())


class TestListListings:
    def test_default_shows_only_active(self, client):
        user = _session(client)
        active = client.post(
            "/api/v1/listings",
            json={
                "title": "Desk Lamp Active",
                "category": "furniture",
                "condition": "Good",
                "listing_type": "donate",
                "image_urls": [_seed_image(user["user"]["id"])[1]],
            },
            headers=_auth(user["token"]),
        )
        assert active.status_code == 201
        inactive_id = active.json()["id"]
        client.patch(f"/api/v1/listings/{inactive_id}", json={"status": "inactive"}, headers=_auth(user["token"]))

        resp = client.get("/api/v1/listings")
        assert resp.status_code == 200
        body = resp.json()
        assert inactive_id not in [i["id"] for i in body["items"]]

    def test_search_and_category_filters(self, client):
        user = _session(client)
        insp, img = _seed_image(user["user"]["id"])
        token = f"ZX{uuid.uuid4().hex[:10]}"  # unique marker — PB data persists across runs
        created = client.post(
            "/api/v1/listings",
            json={
                "title": f"Casio FX-991EX {token} Scientific Calculator",
                "brand": "Casio",
                "model": "FX-991EX",
                "category": "electronics",
                "condition": "Like New",
                "listing_type": "sell",
                "asking_price": 950,
                "image_urls": [img],
                "inspection_id": insp,
            },
            headers=_auth(user["token"]),
        )
        assert created.status_code == 201, created.text

        hit = client.get("/api/v1/listings", params={"search": token, "category": "electronics"})
        assert [i["id"] for i in hit.json()["items"]] == [created.json()["id"]]
        assert hit.json()["items"][0]["primary_image_url"].endswith(".png")

        miss = client.get("/api/v1/listings", params={"search": token, "category": "books"})
        assert miss.json()["items"] == []

    def test_pagination(self, client):
        user = _session(client)
        img = _seed_image(user["user"]["id"])[1]
        for n in range(3):
            client.post(
                "/api/v1/listings",
                json={
                    "title": f"Paginated Item {n}",
                    "category": "other",
                    "condition": "Fair",
                    "listing_type": "donate",
                    "image_urls": [img],
                },
                headers=_auth(user["token"]),
            )
        resp = client.get("/api/v1/listings", params={"per_page": 2, "page": 2, "search": "Paginated"})
        body = resp.json()
        assert body["per_page"] == 2 and body["page"] == 2
        assert body["total"] >= 3

    def test_invalid_campus_400(self, client):
        resp = client.get("/api/v1/listings", params={"campus_id": 'bad"; drop'})
        assert resp.status_code == 400
        assert resp.json()["code"] == "VALIDATION_ERROR"

    def test_search_injection_400(self, client):
        resp = client.get("/api/v1/listings", params={"search": 'x" || "y'})
        assert resp.status_code == 400


class TestCreateListing:
    def test_sell_requires_price(self, client):
        user = _session(client)
        resp = client.post(
            "/api/v1/listings",
            json={
                "title": "No price sale",
                "category": "books",
                "condition": "Good",
                "listing_type": "sell",
                "image_urls": [_seed_image(user["user"]["id"])[1]],
            },
            headers=_auth(user["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "LISTING_PRICE_REQUIRED"

    def test_donate_rejects_price(self, client):
        user = _session(client)
        resp = client.post(
            "/api/v1/listings",
            json={
                "title": "Paid donation",
                "category": "books",
                "condition": "Good",
                "listing_type": "donate",
                "asking_price": 100,
                "image_urls": [_seed_image(user["user"]["id"])[1]],
            },
            headers=_auth(user["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "LISTING_NO_PRICE"

    def test_requires_auth(self, client):
        resp = client.post(
            "/api/v1/listings",
            json={
                "title": "Anon listing",
                "category": "books",
                "condition": "Good",
                "listing_type": "donate",
                "image_urls": ["abc"],
            },
        )
        assert resp.status_code == 401

    def test_unknown_image_ref_400(self, client):
        user = _session(client)
        resp = client.post(
            "/api/v1/listings",
            json={
                "title": "Ghost images",
                "category": "books",
                "condition": "Good",
                "listing_type": "donate",
                "image_urls": ["https://api.camplx.internal/media/inspections/raw_01.jpg"],
            },
            headers=_auth(user["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "INVALID_IMAGE_REF"

    def test_foreign_inspection_400(self, client):
        owner = _session(client)
        impostor = _session(client)
        _, img = _seed_image(owner["user"]["id"])
        resp = client.post(
            "/api/v1/listings",
            json={
                "title": "Stolen inspection",
                "category": "electronics",
                "condition": "Good",
                "listing_type": "donate",
                "image_urls": [img],
                "inspection_id": "aaaaaaaaaaaaaaa",
            },
            headers=_auth(impostor["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "INSPECTION_NOT_FOUND"


class TestDetailAndUpdate:
    def _create(self, client) -> dict:
        user = _session(client)
        insp, img = _seed_image(user["user"]["id"])
        resp = client.post(
            "/api/v1/listings",
            json={
                "title": "Detail Subject Calculator",
                "category": "electronics",
                "condition": "Like New",
                "listing_type": "sell",
                "asking_price": 750,
                "image_urls": [img],
                "inspection_id": insp,
                "technical_specifications": {"Functions": "552"},
            },
            headers=_auth(user["token"]),
        )
        assert resp.status_code == 201, resp.text
        return {"user": user, "body": resp.json()}

    def test_detail_200(self, client):
        ctx = self._create(client)
        resp = client.get(f"/api/v1/listings/{ctx['body']['id']}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["seller_name"]
        assert body["technical_specifications"] == {"Functions": "552"}
        assert len(body["images"]) == 1
        assert body["inspection"] is None  # P9 wires bundle

    def test_detail_404(self, client):
        resp = client.get("/api/v1/listings/zzzzzzzzzzzzzzz")
        assert resp.status_code == 404
        assert resp.json()["code"] == "LISTING_NOT_FOUND"

    def test_update_status_inactive(self, client):
        ctx = self._create(client)
        resp = client.patch(
            f"/api/v1/listings/{ctx['body']['id']}",
            json={"status": "inactive"},
            headers=_auth(ctx["user"]["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "inactive"

    def test_terminal_status_rejected(self, client):
        ctx = self._create(client)
        resp = client.patch(
            f"/api/v1/listings/{ctx['body']['id']}",
            json={"status": "sold"},
            headers=_auth(ctx["user"]["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "VALIDATION_ERROR"

    def test_cross_user_403(self, client):
        ctx = self._create(client)
        other = _session(client)
        resp = client.patch(
            f"/api/v1/listings/{ctx['body']['id']}",
            json={"status": "inactive"},
            headers=_auth(other["token"]),
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "FORBIDDEN"


class TestDeleteListing:
    def test_owner_deletes(self, client):
        ctx_user = _session(client)
        _, img = _seed_image(ctx_user["user"]["id"])
        created = client.post(
            "/api/v1/listings",
            json={
                "title": "Delete Me Item",
                "category": "other",
                "condition": "Fair",
                "listing_type": "donate",
                "image_urls": [img],
            },
            headers=_auth(ctx_user["token"]),
        ).json()
        resp = client.delete(f"/api/v1/listings/{created['id']}", headers=_auth(ctx_user["token"]))
        assert resp.status_code == 204
        assert client.get(f"/api/v1/listings/{created['id']}").status_code == 404

    def test_cross_user_403(self, client):
        owner = _session(client)
        _, img = _seed_image(owner["user"]["id"])
        created = client.post(
            "/api/v1/listings",
            json={
                "title": "Protected Item",
                "category": "other",
                "condition": "Fair",
                "listing_type": "donate",
                "image_urls": [img],
            },
            headers=_auth(owner["token"]),
        ).json()
        ctx = _session(client)
        resp = client.delete(f"/api/v1/listings/{created['id']}", headers=_auth(ctx["token"]))
        assert resp.status_code == 403


class TestSellerProfile:
    def test_public_profile_no_email_active_only(self, client):
        user = _session(client)
        _, img = _seed_image(user["user"]["id"])
        active = client.post(
            "/api/v1/listings",
            json={
                "title": "Public Active",
                "category": "books",
                "condition": "Good",
                "listing_type": "donate",
                "image_urls": [img],
            },
            headers=_auth(user["token"]),
        ).json()
        hidden = client.post(
            "/api/v1/listings",
            json={
                "title": "Public Hidden",
                "category": "books",
                "condition": "Good",
                "listing_type": "donate",
                "image_urls": [img],
            },
            headers=_auth(user["token"]),
        ).json()
        client.patch(f"/api/v1/listings/{hidden['id']}", json={"status": "inactive"}, headers=_auth(user["token"]))

        resp = client.get(f"/api/v1/sellers/{user['user']['id']}/listings")
        assert resp.status_code == 200
        body = resp.json()
        assert "email" not in body["seller"]
        ids = [i["id"] for i in body["listings"]]
        assert active["id"] in ids and hidden["id"] not in ids

    def test_unknown_seller_404(self, client):
        resp = client.get("/api/v1/sellers/qqqqqqqqqqqqqqq/listings")
        assert resp.status_code == 404
