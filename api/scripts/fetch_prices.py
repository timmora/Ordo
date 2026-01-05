#!/usr/bin/env python3
"""
Fetch historical price data from Yahoo Finance.

Downloads 5 years of adjusted close prices for all tickers in tickers.csv.
Saves as Parquet for efficient storage and fast loading.

Usage:
    python scripts/fetch_prices.py
    
Prerequisites:
    - Run fetch_tickers.py first
    
Output:
    data/prices.parquet
"""

import pandas as pd
import yfinance as yf
from pathlib import Path
from datetime import datetime, timedelta
import sys
import time

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import settings


def load_tickers(tickers_path: Path) -> list[str]:
    """Load ticker list from CSV."""
    df = pd.read_csv(tickers_path)
    return df["ticker"].tolist()


def fetch_prices(
    tickers: list[str],
    years: int = 5,
    batch_size: int = 50,
) -> pd.DataFrame:
    """
    Fetch historical prices from Yahoo Finance.
    
    Args:
        tickers: List of ticker symbols
        years: Years of history to fetch
        batch_size: Number of tickers per API call (Yahoo limits this)
        
    Returns:
        DataFrame with columns: ticker, date, close, volume
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=years * 365)
    
    print(f"Fetching {years} years of data for {len(tickers)} tickers...")
    print(f"Date range: {start_date.date()} to {end_date.date()}")
    
    all_data = []
    failed_tickers = []
    
    # Process in batches to avoid API limits
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i + batch_size]
        batch_str = " ".join(batch)
        
        print(f"  Fetching batch {i // batch_size + 1}/{(len(tickers) - 1) // batch_size + 1}...")
        
        try:
            # Download batch
            data = yf.download(
                batch_str,
                start=start_date,
                end=end_date,
                group_by="ticker",
                auto_adjust=True,  # Use adjusted prices
                progress=False,
            )
            
            # Handle single ticker vs multiple tickers
            if len(batch) == 1:
                ticker = batch[0]
                if not data.empty:
                    df = data[["Close", "Volume"]].copy()
                    df.columns = ["close", "volume"]
                    df["ticker"] = ticker
                    df["date"] = df.index
                    all_data.append(df)
            else:
                # Multiple tickers: data is multi-index
                for ticker in batch:
                    try:
                        if ticker in data.columns.get_level_values(0):
                            df = data[ticker][["Close", "Volume"]].copy()
                            df.columns = ["close", "volume"]
                            df["ticker"] = ticker
                            df["date"] = df.index
                            df = df.dropna()
                            if len(df) > 0:
                                all_data.append(df)
                            else:
                                failed_tickers.append(ticker)
                        else:
                            failed_tickers.append(ticker)
                    except Exception as e:
                        failed_tickers.append(ticker)
                        
        except Exception as e:
            print(f"    Error fetching batch: {e}")
            failed_tickers.extend(batch)
        
        # Rate limiting
        time.sleep(0.5)
    
    if failed_tickers:
        print(f"\nFailed to fetch {len(failed_tickers)} tickers:")
        print(f"  {failed_tickers[:20]}{'...' if len(failed_tickers) > 20 else ''}")
    
    # Combine all data
    if not all_data:
        raise ValueError("No price data fetched!")
    
    combined = pd.concat(all_data, ignore_index=True)
    combined = combined[["ticker", "date", "close", "volume"]]
    combined = combined.sort_values(["ticker", "date"])
    
    print(f"\nFetched {len(combined)} price records for {combined['ticker'].nunique()} tickers")
    
    return combined


def update_market_caps(tickers_path: Path, prices_df: pd.DataFrame) -> None:
    """
    Update tickers.csv with market cap data.
    
    Uses the latest price * shares outstanding from Yahoo Finance.
    """
    print("\nFetching market cap data...")
    
    tickers_df = pd.read_csv(tickers_path)
    tickers = tickers_df["ticker"].tolist()
    
    market_caps = {}
    
    for i, ticker in enumerate(tickers):
        if i % 50 == 0:
            print(f"  Processing {i}/{len(tickers)}...")
        
        try:
            info = yf.Ticker(ticker).info
            market_cap = info.get("marketCap", None)
            if market_cap:
                market_caps[ticker] = market_cap / 1e9  # Convert to billions
        except:
            pass
        
        time.sleep(0.1)  # Rate limiting
    
    # Update dataframe
    tickers_df["market_cap"] = tickers_df["ticker"].map(market_caps)
    tickers_df.to_csv(tickers_path, index=False)
    
    print(f"Updated market caps for {len(market_caps)} tickers")


def save_prices(df: pd.DataFrame, output_path: Path) -> None:
    """Save prices to Parquet file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)
    print(f"Saved prices to {output_path}")
    print(f"  File size: {output_path.stat().st_size / 1e6:.1f} MB")


def main():
    """Main entry point."""
    tickers_path = settings.data_dir / "tickers.csv"
    output_path = settings.data_dir / "prices.parquet"
    
    # Check prerequisites
    if not tickers_path.exists():
        print("ERROR: tickers.csv not found. Run fetch_tickers.py first.")
        sys.exit(1)
    
    # Load tickers
    tickers = load_tickers(tickers_path)
    
    # Fetch prices
    prices_df = fetch_prices(tickers, years=settings.price_history_years)
    
    # Save prices
    save_prices(prices_df, output_path)
    
    # Update market caps (optional - can be slow)
    print("\nSkipping market cap fetch (can be slow).")
    print("To fetch market caps, uncomment the line below in the script.")
    # update_market_caps(tickers_path, prices_df)
    
    # Print summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"Tickers: {prices_df['ticker'].nunique()}")
    print(f"Date range: {prices_df['date'].min()} to {prices_df['date'].max()}")
    print(f"Total records: {len(prices_df):,}")
    print(f"Avg records per ticker: {len(prices_df) / prices_df['ticker'].nunique():.0f}")


if __name__ == "__main__":
    main()
