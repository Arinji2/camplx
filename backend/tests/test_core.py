"""P1 core unit tests: errors, tokens, rate limiter, media sanitize."""
import time

import pytest

from app.core.auth import decode_token, issue_token
from app.core.errors import ApiError
from app.core.media import _SAFE_ID, require_safe, sanitize_image_bytes
from app.core.ratelimit import SlidingWindowLimiter

USER_ID = "a0000000-0000-0000-0000-000000000001"


class TestTokens:
    def test_roundtrip(self):
        token = issue_token(USER_ID)
        assert decode_token(token) == USER_ID

    def test_tampered_rejected(self):
        token = issue_token(USER_ID)
        with pytest.raises(ApiError) as exc:
            decode_token(token + "x")
        assert exc.value.status_code == 401

    def test_garbage_rejected(self):
        with pytest.raises(ApiError) as exc:
            decode_token("not.a.jwt")
        assert exc.value.status_code == 401


class TestRateLimiter:
    def test_allows_up_to_limit_then_blocks(self):
        limiter = SlidingWindowLimiter()
        settings_free_key = "test:key"
        # limit enforced against a small window: patch via repeated calls
        limiter.check(settings_free_key, 3)
        limiter.check(settings_free_key, 3)
        limiter.check(settings_free_key, 3)
        with pytest.raises(ApiError) as exc:
            limiter.check(settings_free_key, 3)
        assert exc.value.status_code == 429

    def test_window_expires(self, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "rate_limit_window_seconds", 0.01)
        limiter = SlidingWindowLimiter()
        limiter.check("k", 1)
        with pytest.raises(ApiError):
            limiter.check("k", 1)
        time.sleep(0.02)
        limiter.check("k", 1)  # window rolled


class TestMediaSafety:
    def test_bad_id_shape_404(self):
        with pytest.raises(ApiError) as exc:
            require_safe("../etc/passwd", _SAFE_ID)
        assert exc.value.status_code == 404
        with pytest.raises(ApiError):
            require_safe("a/b", _SAFE_ID)

    def test_rejects_non_image(self):
        with pytest.raises(ApiError) as exc:
            sanitize_image_bytes(b"definitely not an image")
        assert exc.value.status_code == 400

    def test_rejects_oversize(self, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "max_image_bytes", 10)
        with pytest.raises(ApiError) as exc:
            sanitize_image_bytes(b"x" * 11)
        assert exc.value.status_code == 400

    def test_jpeg_reencode(self):
        import io

        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (4, 4), "red").save(buf, format="JPEG")
        data, media_type, ext = sanitize_image_bytes(buf.getvalue())
        assert media_type == "image/jpeg"
        assert ext == "jpg"
        assert len(data) > 0


class TestApiErrorResponseShape:
    def test_validation_returns_contract_shape(self, client):
        resp = client.get("/api/v1/media/bad!id/x.jpg")  # path hits 404 guard
        assert resp.status_code == 404
        body = resp.json()
        assert set(body) <= {"code", "message", "details"}
        assert body["code"]
