"""Application settings loaded from environment / backend/.env.

`DEVICE_TOKEN` is a secret — it is never logged. Only presence is ever reported.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Local SQLite file by default; overridable (e.g. temp file in tests).
    database_url: str = "sqlite:///./data/anaj.db"
    # Bearer token the PWA must present on every /sync/* call. No default: unset = fail fast.
    device_token: str = ""


settings = Settings()


def require_device_token() -> str:
    """Return the configured DEVICE_TOKEN or fail fast with a clear (secret-free) message."""
    token = settings.device_token
    if not token:
        raise RuntimeError(
            "DEVICE_TOKEN is not set. Add it to backend/.env "
            "(copy backend/.env.example) before starting the API."
        )
    return token
