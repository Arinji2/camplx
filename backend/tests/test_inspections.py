"""P5 inspections tests — session, upload, analyze, pricing, dispute (6 ops)."""
import io

from PIL import Image

from app.config import get_settings
from app.core.ai_service import StubProvider
from tests.conftest import auth_headers, make_session


def _png_bytes(color="white", size=(16, 16)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def _session(client) -> dict:
    user = make_session(client)
    resp = client.post(
        "/api/v1/inspections",
        json={"item_category": "electronics", "seller_notes": "One semester of use."},
        headers=auth_headers(user["token"]),
    )
    assert resp.status_code == 201, resp.text
    return {"user": user, "inspection": resp.json()}


def _upload(client, ctx, *, order=0, angle="front", content=None, filename="front.png") -> dict:
    resp = client.post(
        f"/api/v1/inspections/{ctx['inspection']['inspection_id']}/images",
        files={"image": (filename, content or _png_bytes(), "image/png")},
        data={"display_order": str(order), "angle_label": angle},
        headers=auth_headers(ctx["user"]["token"]),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestCreateSession:
    def test_201_shape(self, client):
        ctx = _session(client)
        body = ctx["inspection"]
        assert body["status"] == "created"
        assert body["report_version"] == 1
        assert body["item_category"] == "electronics"

    def test_requires_auth(self, client):
        resp = client.post("/api/v1/inspections", json={"item_category": "books"})
        assert resp.status_code == 401

    def test_invalid_category_400(self, client):
        user = make_session(client)
        resp = client.post(
            "/api/v1/inspections", json={"item_category": "spaceships"}, headers=auth_headers(user["token"])
        )
        assert resp.status_code == 400


class TestUpload:
    def test_upload_and_detail_shows_0_based_order(self, client):
        ctx = _session(client)
        img = _upload(ctx=ctx, client=client, order=0)
        assert img["display_order"] == 0
        assert img["image_url"].endswith(".png")
        assert img["annotated_image_url"] is None
        detail = client.get(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}",
            headers=auth_headers(ctx["user"]["token"]),
        ).json()
        assert detail["status"] == "images_uploaded"
        assert len(detail["images"]) == 1

    def test_bad_bytes_400(self, client):
        ctx = _session(client)
        resp = client.post(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}/images",
            files={"image": ("fake.png", b"not-an-image", "image/png")},
            data={"display_order": "0"},
            headers=auth_headers(ctx["user"]["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "INVALID_IMAGE"

    def test_oversize_400(self, client, monkeypatch):
        monkeypatch.setattr(get_settings(), "max_image_bytes", 50)
        ctx = _session(client)
        resp = client.post(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}/images",
            files={"image": ("big.png", _png_bytes(size=(64, 64)), "image/png")},
            data={"display_order": "0"},
            headers=auth_headers(ctx["user"]["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "IMAGE_TOO_LARGE"

    def test_foreign_inspection_400(self, client):
        owner = _session(client)
        other = make_session(client)
        resp = client.post(
            f"/api/v1/inspections/{owner['inspection']['inspection_id']}/images",
            files={"image": ("x.png", _png_bytes(), "image/png")},
            data={"display_order": "0"},
            headers=auth_headers(other["token"]),
        )
        assert resp.status_code == 400


class TestAnalyzeAndPricing:
    def _analyzed(self, client) -> dict:
        ctx = _session(client)
        _upload(client=client, ctx=ctx, order=0, angle="front")
        _upload(client=client, ctx=ctx, order=1, angle="back")
        resp = client.post(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}/analyze",
            headers=auth_headers(ctx["user"]["token"]),
        )
        assert resp.status_code == 200, resp.text
        ctx["analysis"] = resp.json()
        return ctx

    def test_analyze_full_shape(self, client):
        ctx = self._analyzed(client)
        body = ctx["analysis"]
        assert body["identified_product_name"]
        assert body["defects"][0]["id"] == "def-1"
        assert body["defects"][0]["image_id"] in [i["id"] for i in body["images"]]
        assert body["defects"][0]["dispute_status"] == "none"
        assert len(body["images"]) == 2
        assert body["images"][0]["annotated_image_url"]  # stub defect -> overlay rendered
        assert body["amazon_listing"]["title"]
        detail = client.get(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}",
            headers=auth_headers(ctx["user"]["token"]),
        ).json()
        assert detail["status"] == "analyzed"
        assert detail["analysis"]["inspection_id"] == ctx["inspection"]["inspection_id"]

    def test_analyze_without_images_400(self, client):
        ctx = _session(client)
        resp = client.post(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}/analyze",
            headers=auth_headers(ctx["user"]["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "NO_IMAGES"

    def test_analyze_provider_failure_502(self, client, monkeypatch):
        def boom(self, *args, **kwargs):
            raise RuntimeError("provider down")

        monkeypatch.setattr(StubProvider, "analyze", boom)
        ctx = _session(client)
        _upload(client=client, ctx=ctx)
        resp = client.post(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}/analyze",
            headers=auth_headers(ctx["user"]["token"]),
        )
        assert resp.status_code == 502
        assert resp.json()["code"] == "AI_PROVIDER_ERROR"

    def test_pricing_flow(self, client):
        ctx = self._analyzed(client)
        iid = ctx["inspection"]["inspection_id"]
        token = ctx["user"]["token"]
        fresh = _session(client)
        early = client.post(
            f"/api/v1/inspections/{fresh['inspection']['inspection_id']}/pricing",
            headers=auth_headers(fresh["user"]["token"]),
        )
        assert early.status_code == 400
        assert early.json()["code"] == "NOT_ANALYZED"

        resp = client.post(f"/api/v1/inspections/{iid}/pricing", headers=auth_headers(token))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["currency"] == "INR"
        assert body["pricing"]["recommended_listing_price"] > 0
        assert body["pricing"]["data_sufficiency"] in ("sufficient", "limited", "insufficient")
        detail = client.get(f"/api/v1/inspections/{iid}", headers=auth_headers(token)).json()
        assert detail["status"] == "completed"
        assert detail["pricing"]["pricing_rationale"]

    def test_dispute(self, client):
        ctx = self._analyzed(client)
        iid = ctx["inspection"]["inspection_id"]
        token = ctx["user"]["token"]
        resp = client.post(
            f"/api/v1/inspections/{iid}/defects/def-1/dispute",
            json={"seller_note": "Adhesive residue, wipes clean."},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["dispute_status"] == "disputed_by_seller"
        detail = client.get(f"/api/v1/inspections/{iid}", headers=auth_headers(token)).json()
        assert detail["analysis"]["defects"][0]["seller_dispute_note"].startswith("Adhesive")

    def test_dispute_unknown_404(self, client):
        ctx = self._analyzed(client)
        resp = client.post(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}/defects/def-999/dispute",
            json={"seller_note": "Nope."},
            headers=auth_headers(ctx["user"]["token"]),
        )
        assert resp.status_code == 404

    def test_detail_hidden_from_others(self, client):
        ctx = _session(client)
        other = make_session(client)
        resp = client.get(
            f"/api/v1/inspections/{ctx['inspection']['inspection_id']}",
            headers=auth_headers(other["token"]),
        )
        assert resp.status_code == 404
