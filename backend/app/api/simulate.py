"""
api/simulate.py
===============
POST /api/v1/simulate

Orchestrates the full physics simulation pipeline:
  1. Parse and validate request
  2. Optionally try the surrogate model (Law 2 PINN)
  3. Fall back to full FDM solver (all 7 laws)
  4. Post-process results (violations, hotspots)
  5. Persist to DB (best-effort, does not fail the request)
  6. Return structured JSON response
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Dict, List, Tuple

import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.db_models import Layout as DBLayout, Simulation as DBSimulation
from app.models.schemas import (
    EMViolation,
    HotspotInfo,
    SimulationMetrics,
    SimulationRequest,
    SimulationResponse,
    SimulationViolations,
    ThermalViolation,
)
from app.physics import fdm_solver, surrogate_model

logger = logging.getLogger(__name__)

router = APIRouter()

# Laws applied description (always the same for full FDM)
LAWS_APPLIED = [
    "joule_heating",
    "fourier_nonlinear",
    "robin_bc",
    "z_axis_conduction",
    "dynamic_static_power",
    "ir_drop",
    "black_equation",
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _np_to_list(arr: np.ndarray) -> List[List[float]]:
    """Convert a 2-D numpy array to a JSON-serialisable list of lists."""
    return [[round(float(v), 4) for v in row] for row in arr]


def _find_hotspots(
    thermal_map: np.ndarray,
    n_top:       int   = 5,
    threshold_C: float = 60.0,
) -> List[HotspotInfo]:
    """Return the top-N hottest cells above threshold_C."""
    N = thermal_map.shape[0]
    candidates = []
    for i in range(N):
        for j in range(N):
            t = float(thermal_map[i, j])
            if t >= threshold_C:
                candidates.append(HotspotInfo(x=j, y=i, temp_C=round(t, 2)))
    # Sort by temperature descending
    candidates.sort(key=lambda h: h.temp_C, reverse=True)
    return candidates[:n_top]


def _compute_violations(
    thermal_map: np.ndarray,
    em_risk_map: np.ndarray,
) -> SimulationViolations:
    """Extract thermal throttle and electromigration violations."""
    N = thermal_map.shape[0]
    throttle: List[ThermalViolation] = []
    em_risks: List[EMViolation]      = []

    for i in range(N):
        for j in range(N):
            t = float(thermal_map[i, j])
            r = float(em_risk_map[i, j])
            if t >= settings.THERMAL_THROTTLE_TEMP_C:
                throttle.append(ThermalViolation(x=j, y=i, temp_C=round(t, 2)))
            if r >= settings.EM_RISK_THRESHOLD:
                em_risks.append(EMViolation(x=j, y=i, risk=round(r, 4)))

    # Sort by severity descending
    throttle.sort(key=lambda v: v.temp_C, reverse=True)
    em_risks.sort(key=lambda v: v.risk, reverse=True)

    return SimulationViolations(thermal_throttle=throttle, electromigration=em_risks)


async def _persist_simulation(
    db:             AsyncSession,
    session_id:     str,
    layout_input:   Any,
    solver_cfg:     Any,
    sim_response:   SimulationResponse,
    fdm_result:     Any,
) -> None:
    """
    Persist the layout + simulation to the database.
    Failures are logged but do NOT propagate – the HTTP response is already sent.
    """
    try:
        # Persist layout
        db_layout = DBLayout(
            id            = str(uuid.uuid4()),
            grid_size     = layout_input.grid_size,
            cell_size_mm  = layout_input.cell_size_mm,
            components    = json.dumps(
                [c.model_dump() for c in layout_input.components]
            ),
            material      = layout_input.material,
            ambient_temp_C  = layout_input.ambient_temp_C,
            fan_speed_rpm   = layout_input.fan_speed_rpm,
            heatsink_type   = layout_input.heatsink_type,
        )
        db.add(db_layout)
        await db.flush()   # get the assigned id

        # Persist simulation — scalars written to indexed columns, matrices to JSON blobs
        db_sim = DBSimulation(
            id              = sim_response.simulation_id,
            layout_id       = db_layout.id,
            session_id      = session_id,
            # Matrix JSON blobs (only read on detail view)
            thermal_map     = json.dumps(sim_response.thermal_map),
            ir_drop_map     = json.dumps(sim_response.ir_drop_map),
            em_risk_map     = json.dumps(sim_response.em_risk_map),
            metrics         = sim_response.metrics.model_dump_json(),
            violations      = sim_response.violations.model_dump_json(),
            solver_config   = solver_cfg.model_dump_json(),
            # Indexed scalar columns (used for all dashboard/list queries)
            max_temp_C      = sim_response.metrics.max_temp_C,
            avg_temp_C      = sim_response.metrics.avg_temp_C,
            min_temp_C      = sim_response.metrics.min_temp_C,
            total_power_W   = sim_response.metrics.total_power_W,
            physics_score   = sim_response.metrics.physics_score,
            solver_time_ms  = sim_response.metrics.solver_time_ms,
            converged       = fdm_result.converged,
        )
        db.add(db_sim)
        await db.commit()
        logger.debug("Simulation %s persisted to DB.", sim_response.simulation_id)
    except Exception as exc:
        logger.warning("DB persist failed (non-fatal): %s", exc)
        await db.rollback()


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/simulate",
    response_model=SimulationResponse,
    summary="Run thermal simulation",
    description=(
        "Accepts a chip layout and runs a full physics-informed FDM simulation "
        "applying all 7 semiconductor physics laws.  Returns thermal heatmap, "
        "IR drop map, electromigration risk map, and detailed metrics."
    ),
)
async def run_simulation(
    request: SimulationRequest,
    db:      AsyncSession = Depends(get_db),
) -> SimulationResponse:
    """
    Full physics simulation pipeline.

    The surrogate model is tried first if `use_surrogate=true`, falling back
    to the complete FDM solver automatically.  The FDM solver is always the
    authoritative result; surrogate is only used for speed-critical cases.
    """
    layout_input = request.layout
    solver_cfg   = request.solver_config
    session_id   = request.session_id

    # ------------------------------------------------------------------
    # 1. Attempt surrogate model (optional fast path)
    # ------------------------------------------------------------------
    surrogate_used = False
    fdm_result     = None

    if solver_cfg.use_surrogate:
        model = surrogate_model.load_model()
        if model is not None:
            logger.info("Attempting surrogate model inference …")
            # Build Q_map for the surrogate input via a lightweight source pass
            try:
                N   = layout_input.grid_size
                dx  = layout_input.cell_size_mm * 1e-3
                Q_map, I_map, _ = fdm_solver._build_source_maps(
                    layout_input.components, N, dx
                )
                T_pred = surrogate_model.predict_temperature(
                    model, layout_input, Q_map, I_map, layout_input.ambient_temp_C
                )
                if T_pred is not None:
                    surrogate_used = True
                    # We still need ir_drop and em_risk from the physics helper
                    from app.physics.physics_laws import (
                        compute_ir_drop_map,
                        compute_em_risk_map,
                    )
                    ir_drop = compute_ir_drop_map(I_map, N)
                    em_risk = compute_em_risk_map(I_map, T_pred)
                    # Wrap in a lightweight result container
                    class _SurrogateResult:
                        thermal_map    = T_pred
                        ir_drop_map    = ir_drop
                        em_risk_map    = em_risk
                        iterations     = 0
                        converged      = True
                        total_power_W  = float(np.sum(Q_map) * dx * dx)
                          
                        max_t = float(np.max(T_pred))
                          
                        # 1. Performance Yield
                        die_area_mm2 = (N * dx * 1000.0) ** 2
                        power_density = total_power_W / die_area_mm2 if die_area_mm2 > 0 else 0
                        target_power_density = 0.015
                        score_perf = min(400.0, (power_density / target_power_density) * 400.0)

                        # 2. Peak Thermal Health
                        if max_t <= 60.0:
                            score_therm = 400.0
                        else:
                            score_therm = max(0.0, 400.0 - ((max_t - 60.0) / 45.0) * 400.0)

                        # 3. Spatial Gradient
                        diff_x = np.abs(np.diff(T_pred, axis=0))
                        diff_y = np.abs(np.diff(T_pred, axis=1))
                        max_spatial_grad = max(float(np.max(diff_x)) if diff_x.size > 0 else 0, float(np.max(diff_y)) if diff_y.size > 0 else 0)
                        score_grad = max(0.0, 100.0 - (max_spatial_grad / 15.0) * 100.0)

                        # 4. IR Drop
                        max_ir_drop = float(np.max(ir_drop))
                        score_ir = max(0.0, 100.0 - (max_ir_drop / 0.1) * 100.0)

                        raw_score = score_perf + score_therm + score_grad + score_ir

                        if max_t > 105.0:
                            raw_score = 0.0
                        if np.any(em_risk >= 0.8):
                            raw_score = 0.0

                        physics_score = int(max(0, min(1000, raw_score)))
                        
                        solver_time_ms = 0.0
                    fdm_result = _SurrogateResult()
                    logger.info("Surrogate inference successful.")
            except Exception as exc:
                logger.warning("Surrogate failed, falling back to FDM: %s", exc)

    # ------------------------------------------------------------------
    # 2. Full FDM solver (always used if surrogate not available)
    # ------------------------------------------------------------------
    if fdm_result is None:
        logger.info(
            "Running FDM solver (max_iter=%d, conv=%g) …",
            solver_cfg.max_iterations,
            solver_cfg.convergence_delta,
        )
        fdm_result = fdm_solver.solve(layout_input, solver_cfg)
        logger.info(
            "FDM converged=%s in %d iterations (%.1f ms)",
            fdm_result.converged,
            fdm_result.iterations,
            fdm_result.solver_time_ms,
        )

    # ------------------------------------------------------------------
    # 3. Post-process results
    # ------------------------------------------------------------------
    thermal_map = fdm_result.thermal_map
    ir_drop_map = fdm_result.ir_drop_map
    em_risk_map = fdm_result.em_risk_map

    max_temp = float(np.max(thermal_map))
    avg_temp = float(np.mean(thermal_map))
    min_temp = float(np.min(thermal_map))

    hotspots  = _find_hotspots(thermal_map, n_top=5, threshold_C=layout_input.ambient_temp_C + 10.0)
    violations = _compute_violations(thermal_map, em_risk_map)

    metrics = SimulationMetrics(
        max_temp_C              = round(max_temp, 2),
        avg_temp_C              = round(avg_temp, 2),
        min_temp_C              = round(min_temp, 2),
        total_power_W           = round(fdm_result.total_power_W, 4),
        physics_score           = fdm_result.physics_score,
        convergence_iterations  = fdm_result.iterations,
        solver_time_ms          = round(fdm_result.solver_time_ms, 2),
        hotspots                = hotspots,
        laws_applied            = LAWS_APPLIED,
    )

    sim_id   = str(uuid.uuid4())
    response = SimulationResponse(
        simulation_id = sim_id,
        thermal_map   = _np_to_list(thermal_map),
        ir_drop_map   = _np_to_list(ir_drop_map),
        em_risk_map   = _np_to_list(em_risk_map),
        metrics       = metrics,
        violations    = violations,
    )

    # ------------------------------------------------------------------
    # 4. Persist to DB (best-effort – never fails the HTTP response)
    # ------------------------------------------------------------------
    await _persist_simulation(db, session_id, layout_input, solver_cfg, response, fdm_result)

    return response
