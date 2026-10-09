"""P4 reservation + wishlist tests — 8 ops."""
from tests.conftest import auth_headers, make_listing, make_session


def _pair(client):
    seller = make_session(client)
    buyer = make_session(client)
    return seller, buyer


class TestCreateReservation:
    def test_hold_flips_listing_reserved(self, client):
        seller, buyer = _pair(client)
        lid = make_listing(client, seller)
        resp = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"]))
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "active"
        assert body["listing_id"] == lid
        assert body["buyer_id"] == buyer["user"]["id"]
        detail = client.get(f"/api/v1/listings/{lid}").json()
        assert detail["status"] == "reserved"

    def test_conflict_second_buyer_409(self, client):
        seller, buyer = _pair(client)
        other = make_session(client)
        lid = make_listing(client, seller)
        first = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"]))
        assert first.status_code == 201
        second = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(other["token"]))
        assert second.status_code == 409
        assert second.json()["code"] == "RESERVATION_CONFLICT"

    def test_self_reserve_409(self, client):
        seller, _ = _pair(client)
        lid = make_listing(client, seller)
        resp = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(seller["token"]))
        assert resp.status_code == 409
        assert resp.json()["code"] == "SELF_RESERVATION"

    def test_inactive_listing_409(self, client):
        seller, buyer = _pair(client)
        lid = make_listing(client, seller)
        client.patch(f"/api/v1/listings/{lid}", json={"status": "inactive"}, headers=auth_headers(seller["token"]))
        resp = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"]))
        assert resp.status_code == 409

    def test_requires_auth(self, client):
        resp = client.post("/api/v1/listings/zzzzzzzzzzzzzzz/reservations")
        assert resp.status_code == 401


class TestGetActiveReservation:
    def test_buyer_and_seller_see_404_for_strangers(self, client):
        seller, buyer = _pair(client)
        stranger = make_session(client)
        lid = make_listing(client, seller)
        created = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"])).json()

        for token in (buyer["token"], seller["token"]):
            resp = client.get(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(token))
            assert resp.status_code == 200
            assert resp.json()["id"] == created["id"]
            assert resp.json()["buyer_name"]

        hidden = client.get(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(stranger["token"]))
        assert hidden.status_code == 404

    def test_unreserved_404(self, client):
        seller, buyer = _pair(client)
        lid = make_listing(client, seller)
        resp = client.get(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"]))
        assert resp.status_code == 404


class TestRelease:
    def test_buyer_releases_listing_reactivates(self, client):
        seller, buyer = _pair(client)
        lid = make_listing(client, seller)
        res = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"])).json()
        resp = client.post(f"/api/v1/reservations/{res['id']}/release", headers=auth_headers(buyer["token"]))
        assert resp.status_code == 200
        assert resp.json()["status"] == "released"
        assert client.get(f"/api/v1/listings/{lid}").json()["status"] == "active"
        again = client.post(f"/api/v1/reservations/{res['id']}/release", headers=auth_headers(buyer["token"]))
        assert again.status_code == 403
        assert again.json()["code"] == "RESERVATION_STATE"

    def test_seller_may_release(self, client):
        seller, buyer = _pair(client)
        lid = make_listing(client, seller)
        res = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"])).json()
        resp = client.post(f"/api/v1/reservations/{res['id']}/release", headers=auth_headers(seller["token"]))
        assert resp.status_code == 200

    def test_stranger_403(self, client):
        seller, buyer = _pair(client)
        stranger = make_session(client)
        lid = make_listing(client, seller)
        res = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"])).json()
        resp = client.post(f"/api/v1/reservations/{res['id']}/release", headers=auth_headers(stranger["token"]))
        assert resp.status_code == 403
        assert resp.json()["code"] == "FORBIDDEN"


class TestComplete:
    def _hold(self, client, listing_type="sell"):
        seller, buyer = _pair(client)
        lid = make_listing(client, seller, listing_type=listing_type)
        res = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"])).json()
        return seller, buyer, lid, res

    def test_seller_completes_sold_awards_points(self, client):
        seller, buyer, lid, res = self._hold(client, listing_type="sell")
        resp = client.post(
            f"/api/v1/reservations/{res['id']}/complete",
            json={"outcome": "sold"},
            headers=auth_headers(seller["token"]),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["final_status"] == "sold"
        assert body["points_awarded"] == 50
        assert body["carbon_savings_g"] > 0
        assert client.get(f"/api/v1/listings/{lid}").json()["status"] == "sold"
        me = client.get("/api/v1/auth/me", headers=auth_headers(seller["token"])).json()
        assert me["points"] == 50
        assert me["cumulative_carbon_g"] == body["carbon_savings_g"]

    def test_buyer_cannot_complete(self, client):
        seller, buyer, lid, res = self._hold(client)
        resp = client.post(
            f"/api/v1/reservations/{res['id']}/complete",
            json={"outcome": "sold"},
            headers=auth_headers(buyer["token"]),
        )
        assert resp.status_code == 403

    def test_outcome_mismatch_400(self, client):
        seller, buyer, lid, res = self._hold(client, listing_type="donate")
        resp = client.post(
            f"/api/v1/reservations/{res['id']}/complete",
            json={"outcome": "sold"},
            headers=auth_headers(seller["token"]),
        )
        assert resp.status_code == 403  # contract: 200 | 403 only
        assert resp.json()["code"] == "RESERVATION_STATE"

    def test_double_complete_403(self, client):
        seller, buyer, lid, res = self._hold(client, listing_type="sell")
        first = client.post(
            f"/api/v1/reservations/{res['id']}/complete",
            json={"outcome": "sold"},
            headers=auth_headers(seller["token"]),
        )
        assert first.status_code == 200
        second = client.post(
            f"/api/v1/reservations/{res['id']}/complete",
            json={"outcome": "sold"},
            headers=auth_headers(seller["token"]),
        )
        assert second.status_code == 403


class TestListMyReservations:
    def test_returns_buyer_holds_with_listing(self, client):
        seller, buyer = _pair(client)
        lid = make_listing(client, seller)
        res = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"])).json()
        resp = client.get("/api/v1/reservations/my", headers=auth_headers(buyer["token"]))
        assert resp.status_code == 200
        mine = [i for i in resp.json() if i["reservation"]["id"] == res["id"]]
        assert mine and mine[0]["listing"]["id"] == lid
        # seller's /reservations/my stays empty of this hold
        theirs = client.get("/api/v1/reservations/my", headers=auth_headers(seller["token"])).json()
        assert res["id"] not in [i["reservation"]["id"] for i in theirs]


class TestWishlist:
    def test_add_list_remove_cycle(self, client):
        user = make_session(client)
        other = make_session(client)
        lid = make_listing(client, other)
        add = client.post("/api/v1/wishlist", json={"listing_id": lid}, headers=auth_headers(user["token"]))
        assert add.status_code == 201
        # idempotent re-add
        assert client.post(
            "/api/v1/wishlist", json={"listing_id": lid}, headers=auth_headers(user["token"])
        ).status_code == 201
        listed = client.get("/api/v1/wishlist", headers=auth_headers(user["token"])).json()
        assert [i["id"] for i in listed] == [lid]
        rm = client.delete(f"/api/v1/wishlist/{lid}", headers=auth_headers(user["token"]))
        assert rm.status_code == 204
        assert client.get("/api/v1/wishlist", headers=auth_headers(user["token"])).json() == []
        # removing again stays idempotent
        assert client.delete(f"/api/v1/wishlist/{lid}", headers=auth_headers(user["token"])).status_code == 204

    def test_add_unknown_404(self, client):
        user = make_session(client)
        resp = client.post("/api/v1/wishlist", json={"listing_id": "zzzzzzzzzzzzzzz"}, headers=auth_headers(user["token"]))
        assert resp.status_code == 404

    def test_requires_auth(self, client):
        assert client.get("/api/v1/wishlist").status_code == 401
