#!/usr/bin/env python3
"""
Create ethical/ESG flags for all tickers.

This assigns ethical exposure scores (0.0 to 1.0) for each stock across
categories like fossil fuels, defense, gambling, etc.

Approach:
1. Use industry sector as a heuristic starting point
2. Apply known classifications for specific companies
3. Save as CSV for manual review and adjustment

For production use, you would integrate Sustainalytics or MSCI ESG data.
This script provides a reasonable starting point for the MVP.

Usage:
    python scripts/create_ethical_flags.py
    
Prerequisites:
    - Run fetch_tickers.py first
    
Output:
    data/ethical_flags.csv
"""

import pandas as pd
from pathlib import Path
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import settings


# Ethical flag columns
ETHICAL_FLAGS = [
    "fossil_fuel",
    "defense",
    "gambling",
    "tobacco",
    "alcohol",
    "private_prisons",
    "adult_entertainment",
    "controversial_weapons",
]

# Known companies with ethical exposures
# Format: ticker -> {flag: score}
# Score is 0.0 to 1.0 representing percentage of revenue
KNOWN_EXPOSURES = {
    # === FOSSIL FUELS ===
    # Integrated oil majors
    "XOM": {"fossil_fuel": 0.95},
    "CVX": {"fossil_fuel": 0.95},
    "COP": {"fossil_fuel": 0.95},
    "EOG": {"fossil_fuel": 0.95},
    "SLB": {"fossil_fuel": 0.90},  # Oilfield services
    "HAL": {"fossil_fuel": 0.90},
    "BKR": {"fossil_fuel": 0.85},
    "OXY": {"fossil_fuel": 0.95},
    "PSX": {"fossil_fuel": 0.90},  # Refining
    "MPC": {"fossil_fuel": 0.90},
    "VLO": {"fossil_fuel": 0.90},
    "DVN": {"fossil_fuel": 0.95},
    "FANG": {"fossil_fuel": 0.95},
    "HES": {"fossil_fuel": 0.95},
    "KMI": {"fossil_fuel": 0.80},  # Pipelines
    "WMB": {"fossil_fuel": 0.80},
    "OKE": {"fossil_fuel": 0.75},
    
    # === DEFENSE ===
    # Major defense contractors
    "LMT": {"defense": 0.90},  # Lockheed Martin
    "RTX": {"defense": 0.70},  # Raytheon
    "NOC": {"defense": 0.85},  # Northrop Grumman
    "GD": {"defense": 0.75},   # General Dynamics
    "BA": {"defense": 0.35},   # Boeing (also commercial)
    "LHX": {"defense": 0.80},  # L3Harris
    "HII": {"defense": 0.95},  # Huntington Ingalls
    "TDG": {"defense": 0.40},  # TransDigm
    
    # === GAMBLING ===
    "MGM": {"gambling": 0.90},
    "WYNN": {"gambling": 0.95},
    "LVS": {"gambling": 0.90},
    "CZR": {"gambling": 0.95},
    "PENN": {"gambling": 0.85},
    "DKNG": {"gambling": 0.95},  # DraftKings
    "FLUTTER": {"gambling": 0.95},  # FanDuel parent
    
    # === TOBACCO ===
    "PM": {"tobacco": 0.95},   # Philip Morris
    "MO": {"tobacco": 0.85},   # Altria (also alcohol)
    "BTI": {"tobacco": 0.90},  # British American (if in universe)
    
    # === ALCOHOL ===
    "BUD": {"alcohol": 0.95},  # AB InBev
    "STZ": {"alcohol": 0.95},  # Constellation Brands
    "TAP": {"alcohol": 0.95},  # Molson Coors
    "DEO": {"alcohol": 0.90},  # Diageo
    "BF-B": {"alcohol": 0.95}, # Brown-Forman
    "MO": {"tobacco": 0.70, "alcohol": 0.15},  # Altria has wine too
    
    # === PRIVATE PRISONS ===
    "CXW": {"private_prisons": 0.95},  # CoreCivic
    "GEO": {"private_prisons": 0.95},  # GEO Group
    
    # === CONTROVERSIAL WEAPONS ===
    # These are typically binary flags for any involvement
    # Most major defense contractors avoid these categories
    
    # === COMPANIES OFTEN FLAGGED BUT BORDERLINE ===
    # Utilities with fossil fuel generation
    "DUK": {"fossil_fuel": 0.40},  # Duke Energy
    "SO": {"fossil_fuel": 0.35},   # Southern Company
    "AEP": {"fossil_fuel": 0.35},
    "XEL": {"fossil_fuel": 0.20},  # Xcel (more renewables)
    "NEE": {"fossil_fuel": 0.15},  # NextEra (mostly renewables)
    
    # Tech companies with defense contracts (minor exposure)
    "MSFT": {"defense": 0.05},
    "AMZN": {"defense": 0.05},
    "GOOG": {"defense": 0.02},
    "GOOGL": {"defense": 0.02},
}


def load_tickers(tickers_path: Path) -> pd.DataFrame:
    """Load ticker list with sectors."""
    return pd.read_csv(tickers_path)


def create_ethical_flags(tickers_df: pd.DataFrame) -> pd.DataFrame:
    """
    Create ethical flags for all tickers.
    
    Strategy:
    1. Default all flags to 0.0 (no exposure)
    2. Apply known exposures for specific companies
    3. Apply sector-based heuristics for energy sector
    """
    print("Creating ethical flags...")
    
    # Initialize all flags to 0
    flags = pd.DataFrame(0.0, index=tickers_df.index, columns=ETHICAL_FLAGS)
    flags["ticker"] = tickers_df["ticker"]
    
    # Apply known exposures
    applied_count = 0
    for idx, row in tickers_df.iterrows():
        ticker = row["ticker"]
        
        if ticker in KNOWN_EXPOSURES:
            for flag, score in KNOWN_EXPOSURES[ticker].items():
                flags.loc[idx, flag] = score
            applied_count += 1
    
    # Apply sector heuristics for any energy companies not explicitly listed
    for idx, row in tickers_df.iterrows():
        ticker = row["ticker"]
        sector = row.get("sector", "")
        
        if sector == "Energy" and ticker not in KNOWN_EXPOSURES:
            # Assume moderate fossil fuel exposure for unlisted energy companies
            flags.loc[idx, "fossil_fuel"] = 0.70
    
    # Reorder columns
    flags = flags[["ticker"] + ETHICAL_FLAGS]
    
    print(f"  Created flags for {len(flags)} tickers")
    print(f"  Known exposures applied: {applied_count}")
    
    return flags


def save_flags(flags: pd.DataFrame, output_path: Path) -> None:
    """Save flags to CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    flags.to_csv(output_path, index=False, float_format="%.2f")
    print(f"Saved ethical flags to {output_path}")


def print_summary(flags: pd.DataFrame) -> None:
    """Print summary statistics."""
    print("\n" + "=" * 50)
    print("ETHICAL FLAGS SUMMARY")
    print("=" * 50)
    
    for flag in ETHICAL_FLAGS:
        flagged = (flags[flag] > 0).sum()
        if flagged > 0:
            avg_score = flags[flags[flag] > 0][flag].mean()
            print(f"{flag:25} {flagged:4} stocks flagged, avg score: {avg_score:.1%}")
        else:
            print(f"{flag:25}    0 stocks flagged")
    
    # Show top flagged companies
    print("\n" + "=" * 50)
    print("TOP FLAGGED COMPANIES")
    print("=" * 50)
    
    for flag in ["fossil_fuel", "defense", "gambling", "tobacco"]:
        top = flags.nlargest(5, flag)[["ticker", flag]]
        top = top[top[flag] > 0]
        if len(top) > 0:
            print(f"\n{flag}:")
            for _, row in top.iterrows():
                print(f"  {row['ticker']:6} {row[flag]:.0%}")


def main():
    """Main entry point."""
    tickers_path = settings.data_dir / "tickers.csv"
    output_path = settings.data_dir / "ethical_flags.csv"
    
    # Check prerequisites
    if not tickers_path.exists():
        print("ERROR: tickers.csv not found. Run fetch_tickers.py first.")
        sys.exit(1)
    
    # Load tickers
    tickers_df = load_tickers(tickers_path)
    
    # Create flags
    flags = create_ethical_flags(tickers_df)
    
    # Save
    save_flags(flags, output_path)
    
    # Print summary
    print_summary(flags)
    
    print("\n" + "=" * 50)
    print("NEXT STEPS")
    print("=" * 50)
    print("1. Open data/ethical_flags.csv in a spreadsheet")
    print("2. Review and adjust flags based on your research")
    print("3. Consider integrating Sustainalytics data for more accuracy")
    print("4. Document your classification methodology")


if __name__ == "__main__":
    main()
