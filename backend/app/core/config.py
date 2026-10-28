from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "GOZEL TEKNİK"
    app_version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8600
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'gozel_teknik.db'}"
    frontend_dist_dir: Path = BASE_DIR.parent / "frontend" / "dist"
    log_level: str = "INFO"


settings = Settings()
