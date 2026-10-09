from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # AI
    ai_provider: str = "stub"
    gemini_api_key: str = ""

    # PocketBase
    pocketbase_url: str = "http://127.0.0.1:8090"
    pocketbase_admin_email: str = ""
    pocketbase_admin_password: str = ""

    # Runtime
    demo_mode: bool = True
    debug: bool = False
    media_base_url: str = "http://localhost:8000"
    jwt_secret: str = ""
    jwt_ttl_seconds: int = 86400
    cors_origins: str = "http://localhost:19006,http://localhost:8081"

    # Limits
    max_image_bytes: int = 15 * 1024 * 1024
    ai_timeout_seconds: float = 30.0
    rate_limit_window_seconds: float = 60.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
