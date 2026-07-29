"""
api/health.py
=============
GET /api/v1/health – liveness and readiness check.

Returns the application version, database connectivity status, and a list
of all physics laws implemented in this backend.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import check_db_connection, get_db
from app.models.schemas import HealthResponse
from app.physics.surrogate_model import load_model

router = APIRouter()

LAWS_IMPLEMENTED = [
    "joule_heating",
    "fourier_nonlinear",
    "robin_bc",
    "z_axis_conduction",
    "dynamic_static_power",
    "ir_drop",
    "black_equation",
]


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description=(
        "Returns the service status, database connectivity, surrogate model "
        "availability, and list of physics laws implemented."
    ),
)
async def health_check(
    db: AsyncSession = Depends(get_db),
) -> HealthResponse:
    db_ok          = await check_db_connection()
    surrogate_ok   = load_model() is not None

    return HealthResponse(
        status               = "ok" if db_ok else "degraded",
        version              = settings.APP_VERSION,
        db_connected         = db_ok,
        physics_engine       = "fdm_gauss_seidel",
        surrogate_available  = surrogate_ok,
        grid_size            = settings.GRID_SIZE,
        laws_implemented     = LAWS_IMPLEMENTED,
    )
