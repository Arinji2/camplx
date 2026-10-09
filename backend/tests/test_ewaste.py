"""P6 e-waste tests — 4 ops (submit/list/optimize/lifecycle)."""
from tests.conftest import auth_headers, make_session


def _submit(client, user, **overrides) -> dict:
    payload = {
        "description": "Dell Inspiron with dead motherboard & swollen battery",
        "device_category": "laptops_and_computers",
        "quantity": 1,
        "latitude": 18.6251,
        "longitude": 73.8198,
        "location_name": "Tech Block B, DPU Campus",
        "preferred_slot": "Morning (10:00 AM - 1:00 PM)",
    }
    payload.update(overrides)
    resp = client.post("/api/v1/e-waste/requests", json=payload, headers=auth_headers(user["token"]))
    return resp


class TestSubmitAndList:
    def test_submit_201_carbon_estimate(self, client):
        user = make_session(client)
        resp = _submit(client, user)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "pending"
        assert body["estimated_carbon_kg"] == 21.0  # laptop rate × 1
        assert body["student_id"] == user["user"]["id"]

    def test_quantity_scales_carbon(self, client):
        user = make_session(client)
        body = _submit(client, user, quantity=3).json()
        assert body["estimated_carbon_kg"] == 63.0

    def test_invalid_quantity_defaults(self, client):
        # contract documents 201 only; quantity=0 is clamped to 1, not rejected
        user = make_session(client)
        resp = _submit(client, user, quantity=0)
        assert resp.status_code == 201
        assert resp.json()["quantity"] == 1

    def test_list_public_filters(self, client):
        user = make_session(client)
        created = _submit(client, user, device_category="phones_and_tablets").json()
        assert client.get("/api/v1/e-waste/requests").status_code == 200  # no auth
        filtered = client.get(
            "/api/v1/e-waste/requests",
            params={"status": "pending", "device_category": "phones_and_tablets"},
        ).json()
        assert created["id"] in [r["id"] for r in filtered]


class TestOptimize:
    def test_zones_and_sequence(self, client):
        user = make_session(client)
        ids = []
        for lat, lon in ((18.6251, 73.8198), (18.6260, 73.8210), (18.5200, 73.8560)):
            ids.append(_submit(client, user, latitude=lat, longitude=lon).json()["id"])
        resp = client.post(
            "/api/v1/e-waste/cluster-and-optimize?zones_needed=2",
            headers=auth_headers(user["token"]),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total_stops_optimized"] >= 3
        sequenced = [rid for seq in body["routes_generated"].values() for rid in seq]
        assert set(ids) <= set(sequenced)  # pending from other tests may exist too
        scheduled = client.get("/api/v1/e-waste/requests", params={"status": "scheduled"}).json()
        assert {r["id"] for r in scheduled} >= set(ids)
        for r in scheduled:
            if r["id"] in ids:
                assert r["zone_cluster_id"] is not None
                assert r["pickup_sequence_order"] >= 1

    def test_requires_auth(self, client):
        assert client.post("/api/v1/e-waste/cluster-and-optimize").status_code == 401


class TestLifecycle:
    def _pending(self, client) -> tuple[dict, dict]:
        user = make_session(client)
        req = _submit(client, user).json()
        return user, req

    def test_valid_chain_to_handover(self, client):
        user, req = self._pending(client)
        rid = req["id"]
        h = auth_headers(user["token"])
        for status in ("scheduled", "collected"):
            resp = client.patch(
                f"/api/v1/e-waste/{rid}/lifecycle", json={"status": status}, headers=h
            )
            assert resp.status_code == 200, resp.text
            assert resp.json()["status"] == status
        missing = client.patch(
            f"/api/v1/e-waste/{rid}/lifecycle", json={"status": "handed_over"}, headers=h
        )
        assert missing.status_code == 400
        assert missing.json()["code"] == "PARTNER_REQUIRED"
        done = client.patch(
            f"/api/v1/e-waste/{rid}/lifecycle",
            json={"status": "handed_over", "certified_partner_id": "rc-001", "handler_notes": "EPR partner pickup"},
            headers=h,
        )
        assert done.status_code == 200
        assert done.json()["status"] == "handed_over"

    def test_skip_transition_400(self, client):
        user, req = self._pending(client)
        resp = client.patch(
            f"/api/v1/e-waste/{req['id']}/lifecycle",
            json={"status": "handed_over"},
            headers=auth_headers(user["token"]),
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "INVALID_TRANSITION"

    def test_same_status_400(self, client):
        user, req = self._pending(client)
        resp = client.patch(
            f"/api/v1/e-waste/{req['id']}/lifecycle",
            json={"status": "pending"},
            headers=auth_headers(user["token"]),
        )
        assert resp.status_code == 400

    def test_unknown_404(self, client):
        user = make_session(client)
        resp = client.patch(
            "/api/v1/e-waste/zzzzzzzzzzzzzzz/lifecycle",
            json={"status": "scheduled"},
            headers=auth_headers(user["token"]),
        )
        assert resp.status_code == 400  # contract: 200 | 400 only
