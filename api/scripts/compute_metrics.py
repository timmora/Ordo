#!/usr/bin/env python3
"""
Compute financial metrics from price data.

Calculates:
- Daily returns
- Annualized expected returns (mean)
- Annualized volatility (std dev)
- Covariance matrix

Usage:
    python scripts/compute_metrics.py
    
Prerequisites:
    - Run fetch_prices.py first
    
Output:
    data/returns.parquet      - Daily returns
    data/expected_returns.csv - Annualized expected returns per ticker
    data/covariance.pkl       - Covariance matrix (pickle)
"""

import pandas as pd
import numpy as np
from pathlib import Path
import pickle
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.config import settings


TRADING_DAYS_PER_YEAR = 252


def load_prices(prices_path: Path) -> pd.DataFrame:
    """Load price data from Parquet."""
    return pd.read_parquet(prices_path)


def compute_returns(prices_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute daily returns from price data.
    
    Returns:
        DataFrame with columns: ticker, date, return
    """
    print("Computing daily returns...")
    
    # Pivot to wide format: rows=dates, columns=tickers
    pivot = prices_df.pivot(index="date", columns="ticker", values="close")
    
    # Compute daily returns
    returns = pivot.pct_change().dropna()
    
    # Convert back to long format
    returns_long = returns.reset_index().melt(
        id_vars=["date"],
        var_name="ticker",
        value_name="return",
    )
    
    # Remove any NaN or infinite values
    returns_long = returns_long.replace([np.inf, -np.inf], np.nan).dropna()
    
    print(f"  Computed returns for {returns_long['ticker'].nunique()} tickers")
    print(f"  Date range: {returns_long['date'].min()} to {returns_long['date'].max()}")
    
    return returns_long, returns


def compute_expected_returns(returns_wide: pd.DataFrame) -> pd.Series:
    """
    Compute annualized expected returns.
    
    Uses simple mean of daily returns, annualized.
    """
    print("Computing expected returns...")
    
    # Mean daily return * trading days
    expected = returns_wide.mean() * TRADING_DAYS_PER_YEAR
    
    print(f"  Expected return range: {expected.min():.2%} to {expected.max():.2%}")
    print(f"  Median expected return: {expected.median():.2%}")
    
    return expected


def compute_volatility(returns_wide: pd.DataFrame) -> pd.Series:
    """
    Compute annualized volatility.
    
    Uses standard deviation of daily returns, annualized.
    """
    print("Computing volatility...")
    
    # Std of daily returns * sqrt(trading days)
    volatility = returns_wide.std() * np.sqrt(TRADING_DAYS_PER_YEAR)
    
    print(f"  Volatility range: {volatility.min():.2%} to {volatility.max():.2%}")
    print(f"  Median volatility: {volatility.median():.2%}")
    
    return volatility


def compute_covariance(returns_wide: pd.DataFrame) -> pd.DataFrame:
    """
    Compute covariance matrix.
    
    Annualized covariance for use in portfolio optimization.
    """
    print("Computing covariance matrix...")
    
    # Annualized covariance
    cov = returns_wide.cov() * TRADING_DAYS_PER_YEAR
    
    print(f"  Matrix shape: {cov.shape}")
    
    # Check for any issues
    eigenvalues = np.linalg.eigvals(cov)
    if np.any(eigenvalues < -1e-10):
        print("  WARNING: Covariance matrix has negative eigenvalues!")
        print("  This may cause optimization issues.")
    
    return cov


def filter_tickers(
    returns_wide: pd.DataFrame,
    min_observations: int = 500,
) -> pd.DataFrame:
    """
    Filter tickers with insufficient data.
    
    Removes tickers that don't have enough price history.
    """
    print(f"Filtering tickers with < {min_observations} observations...")
    
    valid_tickers = returns_wide.count() >= min_observations
    filtered = returns_wide.loc[:, valid_tickers]
    
    removed = returns_wide.shape[1] - filtered.shape[1]
    print(f"  Removed {removed} tickers, {filtered.shape[1]} remaining")
    
    return filtered


def save_metrics(
    returns_long: pd.DataFrame,
    expected_returns: pd.Series,
    volatility: pd.Series,
    covariance: pd.DataFrame,
    data_dir: Path,
) -> None:
    """Save all computed metrics."""
    data_dir.mkdir(parents=True, exist_ok=True)
    
    # Daily returns
    returns_path = data_dir / "returns.parquet"
    returns_long.to_parquet(returns_path, index=False)
    print(f"Saved returns to {returns_path}")
    
    # Expected returns and volatility
    metrics_df = pd.DataFrame({
        "ticker": expected_returns.index,
        "expected_return": expected_returns.values,
        "volatility": volatility.values,
    })
    metrics_path = data_dir / "expected_returns.csv"
    metrics_df.to_csv(metrics_path, index=False)
    print(f"Saved expected returns to {metrics_path}")
    
    # Covariance matrix
    cov_path = data_dir / "covariance.pkl"
    with open(cov_path, "wb") as f:
        pickle.dump(covariance, f)
    print(f"Saved covariance matrix to {cov_path}")


def main():
    """Main entry point."""
    prices_path = settings.data_dir / "prices.parquet"
    
    # Check prerequisites
    if not prices_path.exists():
        print("ERROR: prices.parquet not found. Run fetch_prices.py first.")
        sys.exit(1)
    
    # Load prices
    prices_df = load_prices(prices_path)
    
    # Compute returns
    returns_long, returns_wide = compute_returns(prices_df)
    
    # Filter tickers with insufficient data
    returns_wide = filter_tickers(returns_wide)
    
    # Compute metrics
    expected_returns = compute_expected_returns(returns_wide)
    volatility = compute_volatility(returns_wide)
    covariance = compute_covariance(returns_wide)
    
    # Filter returns_long to match
    valid_tickers = returns_wide.columns.tolist()
    returns_long = returns_long[returns_long["ticker"].isin(valid_tickers)]
    
    # Save all metrics
    save_metrics(
        returns_long,
        expected_returns,
        volatility,
        covariance,
        settings.data_dir,
    )
    
    # Print summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"Tickers: {len(expected_returns)}")
    print(f"Expected return: {expected_returns.mean():.2%} avg")
    print(f"Volatility: {volatility.mean():.2%} avg")
    print(f"Covariance matrix: {covariance.shape}")
    
    # Show top/bottom performers
    print("\nTop 5 expected returns:")
    for ticker, ret in expected_returns.nlargest(5).items():
        print(f"  {ticker}: {ret:.2%}")
    
    print("\nLowest 5 volatility:")
    for ticker, vol in volatility.nsmallest(5).items():
        print(f"  {ticker}: {vol:.2%}")


if __name__ == "__main__":
    main()
