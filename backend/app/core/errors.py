"""Unified error path: ApiError -> ErrorResponse JSON. OWNER: shared."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.schemas.common import ErrorResponse

logger = logging.getLogger("camplx")


class ApiError(Exception):
    """Raise anywhere; handlers convert to openapi ErrorResponse JSON."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def _json(status_code: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    if not get_settings().debug:
        details = None
    body = ErrorResponse(code=code, message=message, details=details)
    return JSONResponse(status_code=status_code, content=body.model_dump(exclude_none=True))


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return _json(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = {
            "errors": [
                {"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()
            ]
        }
        return _json(400, "VALIDATION_ERROR", "Request payload failed validation.", details)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return _json(500, "INTERNAL_ERROR", "An unexpected error occurred.")
