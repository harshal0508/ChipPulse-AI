"""
main.py
=======
FastAPI application entry point for ChipPulse AI backend.

Responsibilities
----------------
• Create the FastAPI app instance with metadata
• Configure CORS middleware
• Mount all API routers under /api/v1
• Register startup / shutdown lifecycle events
• Initialise the database (create tables if missing)
• Optionally pre-load the surrogate model into memory

Run with:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import create_tables

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ---------------------------------------------------------------------------
# Lifespan (startup + shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager.

    Startup:
      1. Create SQLite / PostgreSQL tables if they don't exist
      2. Attempt to pre-load surrogate model (non-blocking on failure)

    Shutdown:
      • Nothing required for SQLite; connection pool is disposed automatically.
    """
    logger.info("=== ChipPulse AI backend starting up ===")

    # 1. Database initialisation
    try:
        await create_tables()
        logger.info("Database ready.")
    except Exception as exc:
        logger.error("Database initialisation failed: %s", exc)
        # Continue startup – simulate endpoint handles DB failures gracefully

    # 2. Pre-load surrogate model
    try:
        from app.physics.surrogate_model import load_model
        model = load_model()
        if model is not None:
            logger.info("Surrogate U-Net model loaded and cached.")
        else:
            logger.info("No surrogate weights found – FDM solver will be used.")
    except Exception as exc:
        logger.warning("Surrogate model pre-load failed: %s", exc)

    logger.info("=== ChipPulse AI backend ready ===")

    yield   # application runs here

    logger.info("=== ChipPulse AI backend shutting down ===")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title          = settings.APP_NAME,
    description    = (
        "Physics-Informed Thermal Layout Optimizer for semiconductor chip design. "
        "Applies 7 fundamental semiconductor physics laws simultaneously using a "
        "Gauss-Seidel FDM solver with optional U-Net PINN surrogate acceleration."
    ),
    version        = settings.APP_VERSION,
    docs_url       = "/docs",
    redoc_url      = "/redoc",
    openapi_url    = "/openapi.json",
    lifespan       = lifespan,
)

# ---------------------------------------------------------------------------
# CORS middleware – allow the Vite dev server and local origins
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.CORS_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ---------------------------------------------------------------------------
# Request timing middleware (adds X-Process-Time header)
# ---------------------------------------------------------------------------

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    t0       = time.perf_counter()
    response = await call_next(request)
    elapsed  = (time.perf_counter() - t0) * 1000
    response.headers["X-Process-Time-Ms"] = f"{elapsed:.2f}"
    return response

# ---------------------------------------------------------------------------
# Global exception handler – returns clean JSON on unexpected errors
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error. Please try again or check server logs.",
            "type":   type(exc).__name__,
        },
    )

# ---------------------------------------------------------------------------
# Mount API routers
# ---------------------------------------------------------------------------

from app.api import simulate, projects, health, advisor   # noqa: E402 (after app is defined)

API_PREFIX = "/api/v1"

app.include_router(health.router, prefix="/api/v1/health", tags=["Health"])
app.include_router(advisor.router, prefix="/api/v1/advisor", tags=["AI Advisor"])
app.include_router(simulate.router, prefix=API_PREFIX, tags=["Simulation"])
app.include_router(projects.router, prefix=API_PREFIX, tags=["Projects"])

# ---------------------------------------------------------------------------
# Root redirect / info
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs":    "/docs",
        "health":  f"{API_PREFIX}/health",
    }
