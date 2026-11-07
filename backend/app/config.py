from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mytnb_username: str | None = None
    mytnb_password: str | None = None
    database_url: str = "sqlite+aiosqlite:///./mytnb.db"
    poll_interval_hours: int = Field(default=6, ge=1, le=24)
    cors_origins: str = "http://localhost:3000"
    api_secret_key: str = "dev-secret-change-me"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
