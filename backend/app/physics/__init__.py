# ChipPulse AI – Physics engine package
"""
Exposes the FDM solver and surrogate model at the package level
for clean imports in API handlers.
"""
from app.physics import fdm_solver, surrogate_model  # noqa: F401
