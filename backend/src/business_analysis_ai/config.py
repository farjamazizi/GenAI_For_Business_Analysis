from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import dotenv_values


ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_org_id: str | None = Field(default=None, alias="OPENAI_ORG_ID")
    backend_host: str = Field(default="127.0.0.1", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")
    frontend_api_base_url: str = Field(
        default="http://127.0.0.1:8000",
        alias="FRONTEND_API_BASE_URL",
    )
    artifacts_dir: Path = ROOT_DIR / "artifacts"
    default_dataset_path: Path = ROOT_DIR / "Customer Complaints.csv"
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    legacy_env_path = ROOT_DIR / "apikey.env.txt"
    if legacy_env_path.exists():
        legacy_values = dotenv_values(legacy_env_path)
        if not settings.openai_api_key:
            settings.openai_api_key = legacy_values.get("APIKEY")
        if not settings.openai_org_id:
            settings.openai_org_id = legacy_values.get("ORGID")
    settings.artifacts_dir.mkdir(parents=True, exist_ok=True)
    return settings
