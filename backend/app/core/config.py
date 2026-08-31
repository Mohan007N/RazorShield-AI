"""
RazorShield AI — Application Configuration.

Loads all settings from environment variables / .env file.
Never hard-codes credentials or secrets.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppMode(str, Enum):
    DEV = "dev"
    DEMO = "demo"
    SCALABLE = "scalable"


class Settings(BaseSettings):
    """Central configuration — populated from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    app_name: str = "RazorShield AI"
    app_mode: AppMode = AppMode.DEV
    debug: bool = True
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    secret_key: str = "change-me-to-a-random-secret-key"

    # ── Database ─────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://razorshield:razorshield@localhost:5432/razorshield"
    database_sync_url: str = "postgresql://razorshield:razorshield@localhost:5432/razorshield"

    # ── Redis ────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Kafka ────────────────────────────────────────────────────
    no_kafka: bool = True
    kafka_bootstrap_servers: str = "localhost:9092"

    # ── Razorpay (Test Mode) ─────────────────────────────────────
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    razorpay_webhook_secret: Optional[str] = None

    # ── LLM ──────────────────────────────────────────────────────
    llm_provider: str = "openai"
    openai_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    llm_model: str = "gpt-4o"
    llm_temperature: float = 0.1

    # ── Risk Thresholds ──────────────────────────────────────────
    risk_threshold_low: float = 0.3
    risk_threshold_medium: float = 0.6
    risk_threshold_high: float = 0.8
    risk_threshold_critical: float = 0.95

    # ── Cost ─────────────────────────────────────────────────────
    false_positive_review_cost: float = 100.0

    # ── Security ─────────────────────────────────────────────────
    api_key: str = "razorshield-dev-key"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # ── Monitoring ───────────────────────────────────────────────
    enable_metrics: bool = True

    # ── Model ────────────────────────────────────────────────────
    model_path: str = "ml/models/xgboost_fraud.joblib"
    model_version: str = "v1.0.0"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def razorpay_configured(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def kafka_enabled(self) -> bool:
        return not self.no_kafka and self.app_mode == AppMode.SCALABLE


# Singleton settings instance
settings = Settings()
