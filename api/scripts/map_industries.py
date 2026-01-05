#!/usr/bin/env python3
"""
Create industry weight mapping for all tickers.

This is the most labor-intensive data task. Companies are multi-industry,
so we assign percentage weights (summing to 1.0) for each stock.

Approach:
1. Start with GICS sector as primary industry (100%)
2. Manually adjust major companies with significant cross-sector exposure
3. Save as CSV for easy manual editing

Usage:
    python scripts/map_industries.py
    
Prerequisites:
    - Run fetch_tickers.py first
    
Output:
    data/industry_weights.csv
    
After running, you should MANUALLY review and adjust the weights for
major holdings. The auto-generated weights are a starting point.
"""

import pandas as pd
from pathlib import Path
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import settings


# Mapping from GICS sectors to our industry columns
SECTOR_TO_INDUSTRY = {
    "Information Technology": "tech",
    "Health Care": "healthcare",
    "Financials": "financials",
    "Energy": "energy",
    "Consumer Discretionary": "consumer_discretionary",
    "Consumer Staples": "consumer_staples",
    "Industrials": "industrials",
    "Materials": "materials",
    "Utilities": "utilities",
    "Real Estate": "real_estate",
    "Communication Services": "communication",
}

# Our industry columns
INDUSTRIES = [
    "tech",
    "healthcare",
    "financials",
    "energy",
    "consumer_discretionary",
    "consumer_staples",
    "industrials",
    "materials",
    "utilities",
    "real_estate",
    "communication",
]

# Manual overrides for major multi-industry companies
# Format: ticker -> {industry: weight}
# These are opinionated estimates - adjust as needed!
MANUAL_OVERRIDES = {
    # Big tech with diversified business
    "AAPL": {"tech": 0.75, "consumer_discretionary": 0.20, "communication": 0.05},
    "AMZN": {"tech": 0.40, "consumer_discretionary": 0.50, "communication": 0.10},
    "GOOGL": {"tech": 0.30, "communication": 0.70},
    "GOOG": {"tech": 0.30, "communication": 0.70},
    "META": {"tech": 0.30, "communication": 0.70},
    "MSFT": {"tech": 0.85, "communication": 0.10, "consumer_discretionary": 0.05},
    "NVDA": {"tech": 1.0},
    
    # Diversified conglomerates
    "BRK-B": {"financials": 0.50, "industrials": 0.15, "consumer_staples": 0.15, "energy": 0.10, "utilities": 0.10},
    "GE": {"industrials": 0.60, "healthcare": 0.25, "energy": 0.15},
    "MMM": {"industrials": 0.50, "healthcare": 0.30, "consumer_discretionary": 0.20},
    "HON": {"industrials": 0.70, "tech": 0.20, "materials": 0.10},
    
    # Financial services with tech exposure
    "V": {"financials": 0.70, "tech": 0.30},
    "MA": {"financials": 0.70, "tech": 0.30},
    "PYPL": {"financials": 0.60, "tech": 0.40},
    
    # Healthcare with tech/industrial exposure
    "JNJ": {"healthcare": 0.80, "consumer_staples": 0.20},
    "ABT": {"healthcare": 0.90, "tech": 0.10},
    "TMO": {"healthcare": 0.80, "industrials": 0.10, "tech": 0.10},
    
    # Energy majors (some have chemicals/materials)
    "XOM": {"energy": 0.90, "materials": 0.10},
    "CVX": {"energy": 0.95, "materials": 0.05},
    
    # Retail with tech/logistics
    "WMT": {"consumer_staples": 0.60, "consumer_discretionary": 0.30, "tech": 0.10},
    "COST": {"consumer_staples": 0.90, "consumer_discretionary": 0.10},
    "TGT": {"consumer_discretionary": 0.70, "consumer_staples": 0.30},
    "HD": {"consumer_discretionary": 0.90, "industrials": 0.10},
    
    # Tesla - automotive + energy
    "TSLA": {"consumer_discretionary": 0.70, "tech": 0.20, "energy": 0.10},
    
    # Disney - media + parks
    "DIS": {"communication": 0.60, "consumer_discretionary": 0.40},
    
    # Telecom
    "T": {"communication": 0.95, "tech": 0.05},
    "VZ": {"communication": 0.95, "tech": 0.05},
}


def load_tickers(tickers_path: Path) -> pd.DataFrame:
    """Load ticker list with sectors."""
    return pd.read_csv(tickers_path)


def create_industry_weights(tickers_df: pd.DataFrame) -> pd.DataFrame:
    """
    Create industry weight mapping for all tickers.
    
    Strategy:
    1. Default to 100% in GICS sector
    2. Apply manual overrides for known multi-industry companies
    """
    print("Creating industry weight mapping...")
    
    # Initialize all weights to 0
    weights = pd.DataFrame(0.0, index=tickers_df.index, columns=INDUSTRIES)
    weights["ticker"] = tickers_df["ticker"]
    
    # Set default weights from GICS sector
    for idx, row in tickers_df.iterrows():
        ticker = row["ticker"]
        sector = row["sector"]
        
        if ticker in MANUAL_OVERRIDES:
            # Use manual override
            for industry, weight in MANUAL_OVERRIDES[ticker].items():
                weights.loc[idx, industry] = weight
        elif sector in SECTOR_TO_INDUSTRY:
            # Use GICS sector mapping (100% in primary sector)
            industry = SECTOR_TO_INDUSTRY[sector]
            weights.loc[idx, industry] = 1.0
        else:
            print(f"  WARNING: Unknown sector '{sector}' for {ticker}")
            # Default to industrials
            weights.loc[idx, "industrials"] = 1.0
    
    # Reorder columns
    weights = weights[["ticker"] + INDUSTRIES]
    
    # Validate weights sum to 1
    weight_sums = weights[INDUSTRIES].sum(axis=1)
    invalid = weight_sums[abs(weight_sums - 1.0) > 0.01]
    if len(invalid) > 0:
        print(f"  WARNING: {len(invalid)} tickers have weights not summing to 1.0")
        print(f"    {invalid.head()}")
    
    print(f"  Created weights for {len(weights)} tickers")
    print(f"  Manual overrides applied: {len(MANUAL_OVERRIDES)}")
    
    return weights


def save_weights(weights: pd.DataFrame, output_path: Path) -> None:
    """Save weights to CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    weights.to_csv(output_path, index=False, float_format="%.2f")
    print(f"Saved industry weights to {output_path}")


def print_summary(weights: pd.DataFrame) -> None:
    """Print summary statistics."""
    print("\n" + "=" * 50)
    print("INDUSTRY WEIGHT SUMMARY")
    print("=" * 50)
    
    for industry in INDUSTRIES:
        count = (weights[industry] > 0).sum()
        avg_weight = weights[weights[industry] > 0][industry].mean()
        print(f"{industry:25} {count:4} stocks, avg weight: {avg_weight:.1%}")


def main():
    """Main entry point."""
    tickers_path = settings.data_dir / "tickers.csv"
    output_path = settings.data_dir / "industry_weights.csv"
    
    # Check prerequisites
    if not tickers_path.exists():
        print("ERROR: tickers.csv not found. Run fetch_tickers.py first.")
        sys.exit(1)
    
    # Load tickers
    tickers_df = load_tickers(tickers_path)
    
    # Create weights
    weights = create_industry_weights(tickers_df)
    
    # Save
    save_weights(weights, output_path)
    
    # Print summary
    print_summary(weights)
    
    print("\n" + "=" * 50)
    print("NEXT STEPS")
    print("=" * 50)
    print("1. Open data/industry_weights.csv in a spreadsheet")
    print("2. Review and adjust weights for major holdings")
    print("3. Ensure weights sum to 1.0 for each ticker")
    print("4. Add overrides to MANUAL_OVERRIDES dict for reproducibility")


if __name__ == "__main__":
    main()
