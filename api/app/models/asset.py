"""Asset and Price models."""

from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class Asset(Base):
    """
    Represents a tradeable stock in our universe.
    
    We store basic metadata here. Industry weights and ethical flags
    are in separate tables to allow for easy updates.
    """
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    sector = Column(String(100))  # Primary GICS sector (for reference)
    market_cap = Column(Float)  # In billions USD
    
    # Relationships
    prices = relationship("Price", back_populates="asset", cascade="all, delete-orphan")
    industry_weights = relationship("IndustryWeight", back_populates="asset", cascade="all, delete-orphan")
    ethical_flags = relationship("EthicalFlag", back_populates="asset", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Asset {self.ticker}: {self.name}>"


class Price(Base):
    """
    Daily price data for backtesting and return calculations.
    
    We only store adjusted close - that's all we need for returns.
    """
    __tablename__ = "prices"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    date = Column(Date, nullable=False)
    close = Column(Float, nullable=False)  # Adjusted close
    volume = Column(Float)  # For liquidity filtering
    
    # Relationships
    asset = relationship("Asset", back_populates="prices")
    
    # Composite index for efficient queries
    __table_args__ = (
        Index("ix_prices_asset_date", "asset_id", "date"),
    )
    
    def __repr__(self):
        return f"<Price {self.asset_id} @ {self.date}: {self.close}>"
