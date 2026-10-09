"""P2 auth & identity tests — 3 ops, demo gate, token paths."""
import uuid

EMAIL = f"aarav.sharma+{uuid.uuid4().hex[:10]}@dpu.edu.in"


def _session(client, email: str = EMAIL) -> dict:
    resp = client.post(
        "/api/v1/auth/demo-session", json={"email": email, "display_name": "Aarav Sharma"}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestDemoSession:
    def test_creates_identity_and_token(self, client):
        body = _session(client)
        assert body["token"]
        assert body["user"]["email"] == EMAIL
        assert body["user"]["points"] == 0
        assert body["user"]["campus_name"]  # pilot campus seeded

    def test_upsert_idempotent(self, client):
        first = _session(client)
        second = _session(client)
        assert first["user"]["id"] == second["user"]["id"]

    def test_invalid_email_400(self, client):
        resp = client.post("/api/v1/auth/demo-session", json={"email": "not-an-email"})
        assert resp.status_code == 400
        assert resp.json()["code"] == "VALIDATION_ERROR"

    def test_disabled_in_prod_403(self, client, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "demo_mode", False)
        resp = client.post("/api/v1/auth/demo-session", json={"email": EMAIL})
        assert resp.status_code == 403
        assert resp.json()["code"] == "DEMO_DISABLED"


class TestCurrentUser:
    def test_bearer_token(self, client):
        token = _session(client)["token"]
        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == EMAIL

    def test_demo_header(self, client):
        user_id = _session(client)["user"]["id"]
        resp = client.get("/api/v1/auth/me", headers={"X-Camplx-Demo-User-Id": user_id})
        assert resp.status_code == 200
        assert resp.json()["id"] == user_id

    def test_missing_credentials_401(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401
        assert resp.json() == {"code": "UNAUTHORIZED", "message": "Missing or invalid credentials."}

    def test_tampered_token_401(self, client):
        token = _session(client)["token"]
        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}x"})
        assert resp.status_code == 401
        assert resp.json()["code"] == "INVALID_TOKEN"

    def test_unknown_demo_user_401(self, client):
        fake = str(uuid.uuid4())
        resp = client.get("/api/v1/auth/me", headers={"X-Camplx-Demo-User-Id": fake})
        assert resp.status_code == 401
        assert resp.json()["code"] == "UNAUTHORIZED"

    def test_malformed_demo_header_401(self, client):
        resp = client.get("/api/v1/auth/me", headers={"X-Camplx-Demo-User-Id": "nope"})
        assert resp.status_code == 401

    def test_demo_header_disabled_403(self, client, monkeypatch):
        from app.config import get_settings

        user_id = _session(client)["user"]["id"]
        monkeypatch.setattr(get_settings(), "demo_mode", False)
        resp = client.get("/api/v1/auth/me", headers={"X-Camplx-Demo-User-Id": user_id})
        assert resp.status_code == 403
        assert resp.json()["code"] == "DEMO_DISABLED"


class TestUpdateProfile:
    def test_updates_display_name(self, client):
        user_id = _session(client)["user"]["id"]
        headers = {"X-Camplx-Demo-User-Id": user_id}
        resp = client.patch("/api/v1/auth/me", json={"display_name": "Aarav S."}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Aarav S."

    def test_short_name_400(self, client):
        user_id = _session(client)["user"]["id"]
        resp = client.patch(
            "/api/v1/auth/me",
            json={"display_name": "A"},
            headers={"X-Camplx-Demo-User-Id": user_id},
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "VALIDATION_ERROR"

    def test_empty_patch_400(self, client):
        user_id = _session(client)["user"]["id"]
        resp = client.patch(
            "/api/v1/auth/me", json={}, headers={"X-Camplx-Demo-User-Id": user_id}
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "NO_CHANGES"
