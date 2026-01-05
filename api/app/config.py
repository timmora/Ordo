"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings."""
    
    # Database - SQLite (no setup required)
    database_url: str = "sqlite:///./data/portfolio.db"
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Data
    data_dir: Path = Path("./data")
    price_history_years: int = 5
    
    # Portfolio constraints
    max_position_size: float = 0.05  # 5% max per stock
    min_stocks: int = 30
    max_stocks: int = 50
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()