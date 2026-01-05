"""
Portfolio Optimizer API

Main FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db

# Create app
app = FastAPI(
    title="Portfolio Optimizer API",
    description="Constrained portfolio optimization with explainable tradeoffs",
    version="0.1.0",
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Initialize on startup."""
    # Create tables if they don't exist
    init_db()


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "portfolio-optimizer",
        "version": "0.1.0",
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",  # TODO: Actually check connection
    }


# Import and include routers
# from app.routers import assets, optimize, backtest
# app.include_router(assets.router, prefix="/api", tags=["assets"])
# app.include_router(optimize.router, prefix="/api", tags=["optimize"])
# app.include_router(backtest.router, prefix="/api", tags=["backtest"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
