# Application settings loaded from environment variables.
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    jwt_secret: str = "dev-only-change-me"
    jwt_expire_minutes: int = 720
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "haven_checkin"
    use_memory_db: bool = True
    hf_api_token: str = ""
    hf_sentiment_model: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_demo_data: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
