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
    # Server port (supports Render $PORT environment variable)
    port: int = 8000
    # Local LLM / Ollama configuration
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:3b"
    ollama_timeout_seconds: float = 30.0
    # Hosted LLM configuration (optional: OpenRouter, Groq, or OpenAI-compatible)
    llm_provider: str = "ollama"  # "ollama", "openrouter", "groq", or "hosted"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    chat_max_history_turns: int = 12
    chat_max_message_chars: int = 1500
    chat_rate_limit_per_minute: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        configured = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        defaults = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
        for origin in defaults:
            if origin not in configured:
                configured.append(origin)
        return configured


@lru_cache
def get_settings() -> Settings:
    return Settings()
