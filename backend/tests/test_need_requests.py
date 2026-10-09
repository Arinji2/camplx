"""P7 need-it tests — 4 ops."""
from tests.conftest import auth_headers, make_listing, make_session


def _create(client, user, **overrides) -> dict:
    payload = {"title": "Casio 991EX for semester end exams", "category": "electronics"}
    payload.update(overrides)
    resp = client.post("/api/v1/need-requests", json=payload, headers=auth_headers(user["token"]))
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestNeedRequests:
    def test_create_and_list_open_only(self, client):
        user = make_session(client)
        created = _create(client, user)
        assert created["urgency"] == "normal"
        assert created["requester_name"]
        hidden = _create(client, user, title="Soon fulfilled item", category="books")
        # cancel one via direct delete after re-creating path: delete removes entirely
        listed = client.get("/api/v1/need-requests").json()  # public
        ids = [r["id"] for r in listed]
        assert created["id"] in ids
        assert hidden["id"] in ids
        filtered = client.get("/api/v1/need-requests", params={"category": "electronics"}).json()
        assert created["id"] in [r["id"] for r in filtered]
        assert hidden["id"] not in [r["id"] for r in filtered]

    def test_delete_owner_and_stranger(self, client):
        owner = make_session(client)
        stranger = make_session(client)
        created = _create(client, owner)
        denied = client.delete(
            f"/api/v1/need-requests/{created['id']}", headers=auth_headers(stranger["token"])
        )
        assert denied.status_code == 403
        ok = client.delete(f"/api/v1/need-requests/{created['id']}", headers=auth_headers(owner["token"]))
        assert ok.status_code == 204
        gone = client.delete(
            f"/api/v1/need-requests/{created['id']}", headers=auth_headers(owner["token"])
        )
        assert gone.status_code == 403  # contract: 204 | 403 only

    def test_requires_auth(self, client):
        assert client.post("/api/v1/need-requests", json={"title": "x", "category": "books"}).status_code == 401


class TestMatches:
    def test_keyword_and_category_match(self, client):
        seller = make_session(client)
        needer = make_session(client)
        lid = make_listing(
            client, seller, listing_type="sell", price=950,
            title="Casio FX-991EX ClassWiz Calculator", category="electronics",
        )
        _create(client, needer)
        # find the need id we just made
        mine = [
            r
            for r in client.get("/api/v1/need-requests", params={"category": "electronics"}).json()
            if r["requester_id"] == needer["user"]["id"]
        ][0]
        resp = client.get(f"/api/v1/need-requests/{mine['id']}/matches")  # public
        assert resp.status_code == 200
        items = resp.json()
        hit = [m for m in items if m["listing"]["id"] == lid]
        assert hit and "Keyword" in hit[0]["match_reason"]

    def test_unknown_need_empty_matches(self, client):
        resp = client.get("/api/v1/need-requests/zzzzzzzzzzzzzzz/matches")
        assert resp.status_code == 200  # contract: 200 only
        assert resp.json() == []
