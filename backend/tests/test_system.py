"""P2 system health test."""
from datetime import datetime


class TestHealth:
    def test_ok_shape(self, client):
        resp = client.get("/api/v1/system/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["database_connected"] is True
        assert isinstance(body["ai_service_available"], bool)
        datetime.fromisoformat(body["timestamp"])  # valid date-time

    def test_503_when_persistence_down(self, client, monkeypatch):
        from app.routers import system

        async def down() -> bool:
            return False

        monkeypatch.setattr(system, "_pb_healthy", down)
        resp = client.get("/api/v1/system/health")
        assert resp.status_code == 503
        body = resp.json()
        assert body["code"] == "PERSISTENCE_UNAVAILABLE"
        assert "details" not in body
