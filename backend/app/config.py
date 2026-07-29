"""
config.py
=========
Application configuration loaded from environment variables / .env file.
"""

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    DATABASE_URL: str = "sqlite+aiosqlite:///./chippulse.db"

    # ------------------------------------------------------------------
    # AI Integration
    # ------------------------------------------------------------------
    GEMINI_API_KEY: str = Field(default="", description="API Key for Google Gemini")

    # ------------------------------------------------------------------
    # CORS – origins allowed to access the API
    # ------------------------------------------------------------------
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # ------------------------------------------------------------------
    # Physics defaults (can be overridden per-request)
    # ------------------------------------------------------------------
    GRID_SIZE: int = 16
    CELL_SIZE_MM: float = 1.0
    AMBIENT_TEMP_C: float = 25.0

    # ------------------------------------------------------------------
    # Thermal limits for violation detection
    # ------------------------------------------------------------------
    THERMAL_THROTTLE_TEMP_C: float = 90.0    # °C – above this = throttle risk
    EM_RISK_THRESHOLD: float = 0.7            # 0-1 – above this = EM risk

    # ------------------------------------------------------------------
    # Simulation defaults
    # ------------------------------------------------------------------
    MAX_ITERATIONS: int = 500
    CONVERGENCE_DELTA: float = 0.01

    # ------------------------------------------------------------------
    # App metadata
    # ------------------------------------------------------------------
    APP_NAME: str = "ChipPulse AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Module-level singleton
settings = Settings()
