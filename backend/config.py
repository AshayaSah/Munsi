from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Facebook
    FB_APP_ID: str = ""
    FB_APP_SECRET: str = ""
    FB_REDIRECT_URI: str = "http://localhost:8000/auth/facebook/callback"
    WEBHOOK_VERIFY_TOKEN: str = "SIUUU"

    # Gemini
    GEMINI_API_KEY: str = ""

    # Groq
    GROQ_API_KEY: str = ""

    # Database
    DATABASE_URL: str = ""  # e.g. postgresql+asyncpg://user:pass@host/db

    # Admin
    SECRET_KEY: str = "changeme-secret-key"

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache
def get_settings() -> Settings:
    return Settings()
