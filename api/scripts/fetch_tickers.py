#!/usr/bin/env python3
"""
Fetch S&P 500 ticker list from Wikipedia.

This script scrapes the S&P 500 component list and saves it as a CSV.
Run this first before fetching price data.

Usage:
    python scripts/fetch_tickers.py
    
Output:
    data/tickers.csv
"""

import pandas as pd
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import settings


def fetch_sp500_tickers() -> pd.DataFrame:
    """
    Fetch S&P 500 components from Wikipedia.
    
    Returns DataFrame with columns: ticker, name, sector, market_cap
    """
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    
    print(f"Fetching S&P 500 list from {url}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.content, "lxml")
    table = soup.find("table", {"id": "constituents"})
    
    if not table:
        raise ValueError("Could not find S&P 500 table on Wikipedia page")
    
    # Parse the table
    rows = []
    for tr in table.find_all("tr")[1:]:  # Skip header
        cells = tr.find_all("td")
        if len(cells) >= 4:
            ticker = cells[0].text.strip()
            name = cells[1].text.strip()
            sector = cells[2].text.strip()
            
            # Clean up ticker (some have dots that need to be dashes for Yahoo)
            ticker = ticker.replace(".", "-")
            
            rows.append({
                "ticker": ticker,
                "name": name,
                "sector": sector,
                "market_cap": None,  # Will be filled by price fetch
            })
    
    df = pd.DataFrame(rows)
    print(f"Found {len(df)} tickers")
    
    return df


def save_tickers(df: pd.DataFrame, output_path: Path) -> None:
    """Save tickers to CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Saved tickers to {output_path}")


def main():
    """Main entry point."""
    output_path = settings.data_dir / "tickers.csv"
    
    df = fetch_sp500_tickers()
    save_tickers(df, output_path)
    
    # Print sample
    print("\nSample tickers:")
    print(df.head(10).to_string(index=False))
    
    print(f"\nTotal: {len(df)} tickers")
    print(f"Sectors: {df['sector'].nunique()} unique")
    print("\nSector breakdown:")
    print(df['sector'].value_counts())


if __name__ == "__main__":
    main()
