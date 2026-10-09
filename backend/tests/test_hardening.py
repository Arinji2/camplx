"""P10 hardening tests — rate limits, headers, prod guards."""
import pytest

from tests.conftest import make_session


class TestRateLimit:
    def test_demo_session_429(self, client):
        email = "ratelimit@dpu.edu.in"
        codes = []
        for _ in range(21):
            codes.append(
                client.post("/api/v1/auth/demo-session", json={"email": email}).status_code
            )
        assert codes[-1] == 429
        body = client.post("/api/v1/auth/demo-session", json={"email": email}).json()
        assert body["code"] == "RATE_LIMITED"


class TestSecurityHeaders:
    def test_headers_present(self, client):
        resp = client.get("/api/v1/system/health")
        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"


class TestProdGuards:
    def test_create_app_rejects_weak_prod_config(self, monkeypatch):
        from app.config import get_settings
        from app.main import create_app

        s = get_settings()
        monkeypatch.setattr(s, "debug", False)
        monkeypatch.setattr(s, "jwt_secret", "short")
        monkeypatch.setattr(s, "demo_mode", True)
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            create_app()

    def test_create_app_rejects_demo_in_prod(self, monkeypatch):
        from app.config import get_settings
        from app.main import create_app

        s = get_settings()
        monkeypatch.setattr(s, "debug", False)
        monkeypatch.setattr(s, "jwt_secret", "x" * 40)
        monkeypatch.setattr(s, "demo_mode", True)
        with pytest.raises(RuntimeError, match="DEMO_MODE"):
            create_app()

    def test_validation_details_hidden_when_debug_false(self, client, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "debug", False)
        resp = client.post("/api/v1/auth/demo-session", json={"email": "bad"})
        assert resp.status_code == 400
        assert "details" not in resp.json()

    def test_debug_true_shows_details(self, client):
        resp = client.post("/api/v1/auth/demo-session", json={"email": "bad"})
        assert resp.status_code == 400
        assert "details" in resp.json()


class TestSessionStillWorks:
    def test_smoke(self, client):
        assert make_session(client)["token"]
