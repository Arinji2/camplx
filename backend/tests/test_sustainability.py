"""P9 sustainability + embeds tests — 2 public ops + listing detail wiring."""
from tests.conftest import auth_headers, make_listing, make_session


class TestSustainability:
    def test_summary_public(self, client):
        resp = client.get("/api/v1/sustainability/summary")  # no auth
        assert resp.status_code == 200
        body = resp.json()
        assert body["personal_carbon_kg"] == 0  # anonymous
        assert body["campus_carbon_kg"] >= 0
        assert body["items_reused_count"] >= 0
        assert "Directional" in body["methodology_note"]

    def test_summary_with_identity(self, client):
        user = make_session(client)
        resp = client.get(
            "/api/v1/sustainability/summary", headers=auth_headers(user["token"])
        )
        assert resp.status_code == 200
        assert resp.json()["personal_carbon_kg"] == 0  # fresh user

    def test_leaderboard_public_ranked(self, client):
        resp = client.get("/api/v1/leaderboard")
        assert resp.status_code == 200
        items = resp.json()
        assert all(items[i]["rank"] <= items[i + 1]["rank"] for i in range(len(items) - 1))
        assert all("email" not in i for i in items)


class TestEmbeds:
    def test_detail_embeds_inspection_pricing_and_reservation(self, client):
        seller = make_session(client)
        buyer = make_session(client)
        # inspection with analysis + pricing
        insp = client.post(
            "/api/v1/inspections",
            json={"item_category": "electronics"},
            headers=auth_headers(seller["token"]),
        ).json()
        iid = insp["inspection_id"]
        import io

        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (8, 8), "white").save(buf, format="PNG")
        up = client.post(
            f"/api/v1/inspections/{iid}/images",
            files={"image": ("f.png", buf.getvalue(), "image/png")},
            data={"display_order": "0"},
            headers=auth_headers(seller["token"]),
        )
        assert up.status_code == 201, up.text
        assert client.post(
            f"/api/v1/inspections/{iid}/analyze", headers=auth_headers(seller["token"])
        ).status_code == 200
        assert client.post(
            f"/api/v1/inspections/{iid}/pricing", headers=auth_headers(seller["token"])
        ).status_code == 200

        lid = make_listing(client, seller, listing_type="sell", price=950, category="electronics")
        # attach inspection to listing via direct patch (owner path)
        import asyncio

        from app.core.pb import get_pb

        asyncio.run(get_pb().collection("listings").update(lid, {"inspection_id": iid}))

        res = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"]))
        assert res.status_code == 201, res.text

        detail = client.get(f"/api/v1/listings/{lid}").json()
        assert detail["inspection"]["identified_product_name"]
        assert detail["inspection"]["defects"][0]["id"] == "def-1"
        assert detail["pricing_intelligence"]["recommended_listing_price"] > 0
        assert detail["active_reservation"]["buyer_id"] == buyer["user"]["id"]

    def test_detail_null_embeds_without_inspection(self, client):
        seller = make_session(client)
        lid = make_listing(client, seller)
        detail = client.get(f"/api/v1/listings/{lid}").json()
        assert detail["inspection"] is None
        assert detail["pricing_intelligence"] is None
        assert detail["active_reservation"] is None
