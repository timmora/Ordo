#!/usr/bin/env python3
"""
Seed the database with all prepared data.

Loads data from CSV/Parquet files into PostgreSQL tables.
Run this after all other data scripts.

Usage:
    python scripts/seed_database.py
    
Prerequisites:
    - PostgreSQL running (docker-compose up -d)
    - Run all fetch/compute scripts first:
        - fetch_tickers.py
        - fetch_prices.py
        - compute_metrics.py
        - map_industries.py
        - create_ethical_flags.py
"""

import pandas as pd
from pathlib import Path
import sys
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import Asset, Price, IndustryWeight, EthicalFlag, INDUSTRY_COLUMNS, ETHICAL_COLUMNS


def check_prerequisites(data_dir: Path) -> bool:
    """Check that all required data files exist."""
    required_files = [
        "tickers.csv",
        "prices.parquet",
        "industry_weights.csv",
        "ethical_flags.csv",
    ]
    
    missing = []
    for f in required_files:
        if not (data_dir / f).exists():
            missing.append(f)
    
    if missing:
        print("ERROR: Missing required data files:")
        for f in missing:
            print(f"  - {f}")
        print("\nRun the data preparation scripts first.")
        return False
    
    return True


def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("  Tables created")


def clear_tables(session):
    """Clear all existing data."""
    print("Clearing existing data...")
    session.query(Price).delete()
    session.query(IndustryWeight).delete()
    session.query(EthicalFlag).delete()
    session.query(Asset).delete()
    session.commit()
    print("  Data cleared")


def load_assets(session, data_dir: Path) -> dict[str, int]:
    """Load assets from tickers.csv. Returns ticker -> id mapping."""
    print("Loading assets...")
    
    df = pd.read_csv(data_dir / "tickers.csv")
    
    ticker_to_id = {}
    
    for _, row in df.iterrows():
        asset = Asset(
            ticker=row["ticker"],
            name=row["name"],
            sector=row.get("sector"),
            market_cap=row.get("market_cap"),
        )
        session.add(asset)
        session.flush()  # Get the ID
        ticker_to_id[row["ticker"]] = asset.id
    
    session.commit()
    print(f"  Loaded {len(ticker_to_id)} assets")
    
    return ticker_to_id


def load_prices(session, data_dir: Path, ticker_to_id: dict[str, int]):
    """Load prices from parquet file."""
    print("Loading prices...")
    
    df = pd.read_parquet(data_dir / "prices.parquet")
    
    # Filter to only tickers we have
    df = df[df["ticker"].isin(ticker_to_id.keys())]
    
    # Batch insert for performance
    batch_size = 10000
    records = []
    
    for _, row in df.iterrows():
        records.append({
            "asset_id": ticker_to_id[row["ticker"]],
            "date": row["date"].date() if hasattr(row["date"], "date") else row["date"],
            "close": row["close"],
            "volume": row.get("volume"),
        })
        
        if len(records) >= batch_size:
            session.bulk_insert_mappings(Price, records)
            session.commit()
            print(f"    Inserted {len(records)} price records...")
            records = []
    
    # Insert remaining
    if records:
        session.bulk_insert_mappings(Price, records)
        session.commit()
    
    print(f"  Loaded {len(df)} price records")


def load_industry_weights(session, data_dir: Path, ticker_to_id: dict[str, int]):
    """Load industry weights from CSV."""
    print("Loading industry weights...")
    
    df = pd.read_csv(data_dir / "industry_weights.csv")
    
    loaded = 0
    for _, row in df.iterrows():
        ticker = row["ticker"]
        if ticker not in ticker_to_id:
            continue
        
        weight = IndustryWeight(asset_id=ticker_to_id[ticker])
        
        for col in INDUSTRY_COLUMNS:
            if col in row:
                setattr(weight, col, float(row[col]) if pd.notna(row[col]) else 0.0)
        
        session.add(weight)
        loaded += 1
    
    session.commit()
    print(f"  Loaded {loaded} industry weight records")


def load_ethical_flags(session, data_dir: Path, ticker_to_id: dict[str, int]):
    """Load ethical flags from CSV."""
    print("Loading ethical flags...")
    
    df = pd.read_csv(data_dir / "ethical_flags.csv")
    
    loaded = 0
    for _, row in df.iterrows():
        ticker = row["ticker"]
        if ticker not in ticker_to_id:
            continue
        
        flag = EthicalFlag(asset_id=ticker_to_id[ticker])
        
        for col in ETHICAL_COLUMNS:
            if col in row:
                setattr(flag, col, float(row[col]) if pd.notna(row[col]) else 0.0)
        
        session.add(flag)
        loaded += 1
    
    session.commit()
    print(f"  Loaded {loaded} ethical flag records")


def verify_data(session):
    """Verify data was loaded correctly."""
    print("\nVerifying data...")
    
    asset_count = session.query(Asset).count()
    price_count = session.query(Price).count()
    industry_count = session.query(IndustryWeight).count()
    ethical_count = session.query(EthicalFlag).count()
    
    print(f"  Assets: {asset_count}")
    print(f"  Prices: {price_count:,}")
    print(f"  Industry weights: {industry_count}")
    print(f"  Ethical flags: {ethical_count}")
    
    # Sample query
    sample = session.query(Asset).first()
    if sample:
        print(f"\nSample asset: {sample.ticker} - {sample.name}")
        
        price = session.query(Price).filter(Price.asset_id == sample.id).first()
        if price:
            print(f"  Latest price: ${price.close:.2f} on {price.date}")
        
        weights = session.query(IndustryWeight).filter(IndustryWeight.asset_id == sample.id).first()
        if weights:
            weight_dict = weights.to_dict()
            top_industry = max(weight_dict, key=weight_dict.get)
            print(f"  Primary industry: {top_industry} ({weight_dict[top_industry]:.0%})")


def main():
    """Main entry point."""
    data_dir = settings.data_dir
    
    # Check prerequisites
    if not check_prerequisites(data_dir):
        sys.exit(1)
    
    # Create tables
    create_tables()
    
    # Get session
    session = SessionLocal()
    
    try:
        # Clear existing data
        clear_tables(session)
        
        # Load data
        ticker_to_id = load_assets(session, data_dir)
        load_prices(session, data_dir, ticker_to_id)
        load_industry_weights(session, data_dir, ticker_to_id)
        load_ethical_flags(session, data_dir, ticker_to_id)
        
        # Verify
        verify_data(session)
        
        print("\n" + "=" * 50)
        print("DATABASE SEEDING COMPLETE")
        print("=" * 50)
        
    except Exception as e:
        print(f"\nERROR: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
