"""CAMPLX FastAPI application factory. Routers mounted per phase."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.errors import install_error_handlers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


def create_app() -> FastAPI:
    settings = get_settings()
    if not settings.debug:
        if len(settings.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be >= 32 chars when DEBUG=false.")
        if settings.demo_mode:
            raise RuntimeError("DEMO_MODE must be false when DEBUG=false.")
    app = FastAPI(
        title="CAMPLX Campus Circular Marketplace API",
        description="Canonical backend for openapi.yml (campus reuse, inspection, reservations).",
        version="1.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def _security_headers(request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        return response

    # --- router mounts (one line per domain, added as phases land) ---
    from app.core.media import media_router
    from app.routers import auth as auth_router
    from app.routers import ewaste as ewaste_router
    from app.routers import inspections as inspections_router
    from app.routers import listings as listings_router
    from app.routers import need_requests as need_requests_router
    from app.routers import notifications as notifications_router
    from app.routers import reservations as reservations_router
    from app.routers import sustainability as sustainability_router
    from app.routers import system as system_router
    from app.routers import wishlist as wishlist_router

    app.include_router(media_router)
    app.include_router(system_router.router)
    app.include_router(auth_router.router)
    app.include_router(listings_router.router)
    app.include_router(inspections_router.router)
    app.include_router(reservations_router.router)
    app.include_router(ewaste_router.router)
    app.include_router(need_requests_router.router)
    app.include_router(notifications_router.router)
    app.include_router(sustainability_router.router)
    app.include_router(wishlist_router.router)

    return app


app = create_app()
