"""P8 notifications tests — 3 ops + reservation event wiring."""
from tests.conftest import auth_headers, make_listing, make_session


class TestNotifications:
    def test_list_and_mark_read_flow(self, client):
        seller = make_session(client)
        buyer = make_session(client)
        lid = make_listing(client, seller, listing_type="sell", price=100)
        client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"]))

        listed = client.get("/api/v1/notifications", headers=auth_headers(seller["token"])).json()
        assert listed, "reservation hold should notify seller"
        note = listed[0]
        assert note["type"] == "reservation"
        assert note["read"] is False
        assert note["target_entity_type"] == "listing"
        assert note["target_entity_id"] == lid

        read = client.post(
            f"/api/v1/notifications/{note['id']}/read", headers=auth_headers(seller["token"])
        )
        assert read.status_code == 200
        after = client.get("/api/v1/notifications", headers=auth_headers(seller["token"])).json()
        assert after[0]["read"] is True

    def test_mark_read_foreign_silent_200(self, client):
        seller = make_session(client)
        buyer = make_session(client)
        stranger = make_session(client)
        lid = make_listing(client, seller)
        res = client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"])).json()
        note = client.get("/api/v1/notifications", headers=auth_headers(seller["token"])).json()[0]
        # contract declares 200 only — foreign id is a silent no-op
        denied = client.post(
            f"/api/v1/notifications/{note['id']}/read", headers=auth_headers(stranger["token"])
        )
        assert denied.status_code == 200
        still = client.get("/api/v1/notifications", headers=auth_headers(seller["token"])).json()[0]
        assert still["read"] is False
        assert res["id"]

    def test_read_all(self, client):
        seller = make_session(client)
        buyer = make_session(client)
        lid = make_listing(client, seller)
        client.post(f"/api/v1/listings/{lid}/reservations", headers=auth_headers(buyer["token"]))
        assert client.post(
            "/api/v1/notifications/read-all", headers=auth_headers(seller["token"])
        ).status_code == 200
        after = client.get("/api/v1/notifications", headers=auth_headers(seller["token"])).json()
        assert all(n["read"] for n in after)

    def test_requires_auth(self, client):
        assert client.get("/api/v1/notifications").status_code == 401
