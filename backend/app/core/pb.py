"""PocketBase superuser client. OWNER: shared foundation.

FastAPI is the only process holding PB admin creds; collections are deny-all to
the public API. All persistence flows through here.

PB v0.40 note: superuser auth lives at POST /api/collections/_superusers/auth-with-password
(the legacy /api/admins route was removed).
"""
from __future__ import annotations

import asyncio

import httpx

from app.config import get_settings
from app.core.errors import ApiError

_STATUS_TO_ERROR = {
    400: ("PB_VALIDATION_ERROR", 400),
    403: ("PB_FORBIDDEN", 403),
    404: ("PB_NOT_FOUND", 404),
    409: ("PB_CONFLICT", 409),
}


class PBCollection:
    def __init__(self, client: PB, name: str) -> None:
        self._pb = client
        self.name = name

    async def get_list(
        self,
        page: int = 1,
        per_page: int = 30,
        filter: str | None = None,
        sort: str | None = None,
        expand: str | None = None,
    ) -> dict:
        params: dict = {"page": page, "perPage": per_page}
        if filter:
            params["filter"] = filter
        if sort:
            params["sort"] = sort
        if expand:
            params["expand"] = expand
        return await self._pb._request("GET", f"/api/collections/{self.name}/records", params=params)

    async def get_full_list(self, filter: str | None = None, sort: str | None = None) -> list[dict]:
        items: list[dict] = []
        page = 1
        while True:
            batch = await self.get_list(page=page, per_page=200, filter=filter, sort=sort)
            items.extend(batch.get("items", []))
            if page >= batch.get("totalPages", 1):
                return items
            page += 1

    async def get_one(self, record_id: str, expand: str | None = None) -> dict:
        params = {"expand": expand} if expand else None
        return await self._pb._request(
            "GET", f"/api/collections/{self.name}/records/{record_id}", params=params
        )

    async def get_one_or_404(self, record_id: str, code: str = "NOT_FOUND", message: str = "Resource not found.") -> dict:
        try:
            return await self.get_one(record_id)
        except ApiError as exc:
            if exc.status_code == 404:
                raise ApiError(404, code, message) from exc
            raise

    async def create(self, data: dict) -> dict:
        return await self._pb._request("POST", f"/api/collections/{self.name}/records", json=data)

    async def update(self, record_id: str, data: dict) -> dict:
        return await self._pb._request(
            "PATCH", f"/api/collections/{self.name}/records/{record_id}", json=data
        )

    async def delete(self, record_id: str) -> None:
        await self._pb._request("DELETE", f"/api/collections/{self.name}/records/{record_id}")

    async def create_multipart(self, data: dict, files: dict) -> dict:
        """Create record with file parts (multipart form). Scalars stringified (PB form parsing)."""
        return await self._pb._request(
            "POST",
            f"/api/collections/{self.name}/records",
            data={k: str(v) if v is not None else "" for k, v in data.items()},
            files=files,
        )

    async def update_multipart(self, record_id: str, data: dict, files: dict) -> dict:
        return await self._pb._request(
            "PATCH",
            f"/api/collections/{self.name}/records/{record_id}",
            data={k: str(v) if v is not None else "" for k, v in data.items()},
            files=files,
        )

    async def file_bytes(self, record_id: str, filename: str) -> tuple[bytes, str]:
        """Fetch stored file bytes; returns (bytes, content_type)."""
        content, content_type = await self._pb._request_raw(
            "GET", f"/api/files/{self.name}/{record_id}/{filename}", expect_json=False
        )
        return content, content_type or "application/octet-stream"

    async def file_url(self, record_id: str, filename: str) -> str:
        base = get_settings().media_base_url.rstrip("/")
        return f"{base}/api/v1/media/{record_id}/{filename}"


class PB:
    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.pocketbase_url.rstrip("/")
        self._admin_email = settings.pocketbase_admin_email
        self._admin_password = settings.pocketbase_admin_password
        self._token: str | None = None
        self._client: httpx.AsyncClient | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def _http(self) -> httpx.AsyncClient:
        # one client per event loop (bootstrap loop vs TestClient loop etc.)
        loop = asyncio.get_running_loop()
        if (
            self._client is None
            or self._client.is_closed
            or self._loop is not loop
        ):
            if self._loop is not None and self._loop is not loop:
                self._client = None  # old-loop client dropped; GC closes transport
            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=15.0)
            self._loop = loop
        return self._client

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()

    async def auth(self) -> str:
        if self._token:
            return self._token
        resp = await self._http().post(
            "/api/collections/_superusers/auth-with-password",
            json={"identity": self._admin_email, "password": self._admin_password},
        )
        if resp.status_code >= 400:
            raise ApiError(
                503,
                "PERSISTENCE_UNAVAILABLE",
                "Cannot authenticate against persistence layer.",
            )
        self._token = resp.json()["token"]
        return self._token

    def collection(self, name: str) -> PBCollection:
        return PBCollection(self, name)

    async def _headers(self) -> dict:
        return {"Authorization": await self.auth()}

    async def _request(self, method: str, path: str, **kwargs) -> dict | list:
        content, _ = await self._request_raw(method, path, expect_json=True, **kwargs)
        return content

    async def _request_raw(
        self, method: str, path: str, expect_json: bool = True, retry: bool = True, **kwargs
    ) -> tuple[bytes | dict | list, str | None]:
        resp = await self._http().request(method, path, headers=await self._headers(), **kwargs)

        if resp.status_code == 401 and retry:
            # stale superuser token -> re-auth once
            self._token = None
            return await self._request_raw(method, path, expect_json=expect_json, retry=False, **kwargs)

        if resp.status_code >= 400:
            raise self._map_error(resp)

        if not expect_json:
            return resp.content, resp.headers.get("content-type")

        if resp.status_code == 204 or not resp.content:
            return {}, None
        return resp.json(), None

    @staticmethod
    def _map_error(resp: httpx.Response) -> ApiError:
        code, status = _STATUS_TO_ERROR.get(resp.status_code, ("PERSISTENCE_ERROR", 503))
        if status >= 500:
            return ApiError(503, "PERSISTENCE_UNAVAILABLE", "Persistence layer error.")
        try:
            body = resp.json()
            message = body.get("message") or code
            details = body.get("data") if isinstance(body.get("data"), dict) else None
        except ValueError:
            message, details = code, None
        return ApiError(status, code, message, details)


_client: PB | None = None


def get_pb() -> PB:
    global _client
    if _client is None:
        _client = PB()
    return _client
