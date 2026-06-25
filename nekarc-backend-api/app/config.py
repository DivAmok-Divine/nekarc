from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "nekarc"
    ENV: str = "development"

    # ── Auth ──────────────────────────────────────────
    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Database & storage ────────────────────────────
    DATABASE_URL: str = "sqlite:///./data/app.db"
    UPLOAD_DIR: str = "./data/uploads"

    # ── CORS / URLs ───────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:2222"
    FRONTEND_URL: str = "http://localhost:2222"

    # ── SMTP (optional; reset links log to console if unset) ──
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "no-reply@nekarc.local"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
