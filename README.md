# Portfolio Optimizer

A constrained portfolio optimization engine that generates personalized equity portfolios based on user-defined industry exposure and ethical constraints, with explainable tradeoff analysis.

## Project Structure

```
portfolio-optimizer/
├── api/                          # Python backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── config.py            # Environment variables, settings
│   │   ├── database.py          # Database connection
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── asset.py         # Asset, Price models
│   │   │   ├── industry.py      # IndustryWeight model
│   │   │   └── ethical.py       # EthicalFlag model
│   │   ├── routers/             # API endpoints
│   │   │   ├── __init__.py
│   │   │   ├── assets.py        # GET /assets
│   │   │   ├── optimize.py      # POST /optimize
│   │   │   └── backtest.py      # GET /backtest
│   │   └── services/            # Business logic
│   │       ├── __init__.py
│   │       ├── optimizer.py     # cvxpy optimization logic
│   │       ├── explainer.py     # Tradeoff explanations
│   │       └── backtest.py      # Historical simulation
│   ├── scripts/                 # Data pipeline scripts
│   │   ├── fetch_tickers.py     # Get S&P 500 list
│   │   ├── fetch_prices.py      # Download historical prices
│   │   ├── compute_metrics.py   # Calculate returns, covariance
│   │   ├── map_industries.py    # Industry classification
│   │   └── seed_database.py     # Load data into PostgreSQL
│   ├── tests/                   # pytest test suite
│   │   ├── __init__.py
│   │   ├── test_optimizer.py
│   │   └── test_api.py
│   ├── requirements.txt
│   └── pyproject.toml
│
├── web/                          # React frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # Base components (buttons, sliders, etc.)
│   │   │   ├── PreferenceWizard/
│   │   │   ├── PortfolioResults/
│   │   │   └── ExplanationPanel/
│   │   ├── pages/               # Route pages
│   │   │   ├── Home.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   └── Results.tsx
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useOptimize.ts
│   │   │   └── useAssets.ts
│   │   ├── lib/                 # Utilities
│   │   │   ├── api.ts           # API client
│   │   │   └── utils.ts
│   │   ├── types/               # TypeScript types
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── data/                         # Local data files (gitignored in production)
│   ├── tickers.csv              # S&P 500 ticker list
│   ├── prices.parquet           # Historical price data
│   ├── industry_weights.csv     # Manual industry classification
│   └── ethical_flags.csv        # ESG/ethical flags
│
├── .env.example                  # Environment template
├── .gitignore
├── docker-compose.yml            # Local PostgreSQL
└── README.md
```

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, cvxpy
- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Database**: PostgreSQL 15
- **Data**: Yahoo Finance API, Sustainalytics (or manual classification)

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (or use Docker)

### 1. Clone and Setup

```bash
git clone Aporia
cd Aporia
```

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Backend Setup

```bash
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run data pipeline
python scripts/fetch_tickers.py
python scripts/fetch_prices.py
python scripts/compute_metrics.py
python scripts/seed_database.py

# Start API
uvicorn app.main:app --reload
```

### 4. Frontend Setup

```bash
cd web
npm install
npm run dev
```

## Phase 1 Checklist

- [ ] Fetch S&P 500 ticker list
- [ ] Download 5 years of historical prices
- [ ] Compute returns and covariance matrix
- [ ] Create industry weight mapping
- [ ] Add ethical/ESG flags
- [ ] Design and seed database
- [ ] Write data validation tests

## API Endpoints (Phase 4)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List all assets with metadata |
| GET | `/industries` | List industry categories |
| POST | `/optimize` | Generate optimized portfolio |
| POST | `/backtest` | Run historical simulation |

## License

MIT
