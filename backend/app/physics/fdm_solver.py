"""
fdm_solver.py
=============
Gauss-Seidel finite-difference method (FDM) solver for the non-linear
steady-state heat equation in a 2-D chip layout.

Strict Ordered Feed-Forward Pipeline (Technical Audit Fix)
----------------------------------------------------------
The 7 physics laws are applied in a mandatory, ordered sequence on every
solve() call.  Executing them out of order causes the Joule heating source
Q(x,y) to be based on the un-adjusted voltage, making the IR drop
correction physically meaningless and causing PDE convergence to stall.

  Stage 0 — Grid & Material Setup
      Initialise grid dimensions, material constants, h_eff (fan → h).

  Stage 1 — ELECTRICAL STATE  (Law 5: Dynamic + Static Power)
      For every component: compute baseline dynamic power (α·C·V²·f)
      plus static leakage (I_leak·V_dd).  This yields a raw power map
      Q_raw and current density map I_map.

  Stage 2 — NETWORK LOSSES  (Law 6: IR Drop)
      Compute ΔV(x,y) = I(x,y)·R_wire across the grid.
      Derive V_eff(x,y) = V_dd - ΔV for each cell.

  Stage 3 — THERMAL SOURCES  (Law 1: Joule Heating)
      Re-scale Q using the adjusted V_eff from Stage 2.
      Power scales as V²: scale_factor = (V_eff/V_dd)²  ≈ 1 - 2·ΔV/V_dd.
      Final Q_net(x,y) = Q_raw(x,y) · scale_factor(x,y).

  Stage 4 — PDE SOLVER  (Laws 2, 3, 4)
      Feed the finalised Q_net map into the Gauss-Seidel loop.
      Each iteration applies:
        Law 2 – Non-Linear Fourier: k(T) = k0/(1+β·(T-T_amb)) per cell
        Law 3 – Robin BC ghost nodes at all 4 boundary edges
        Law 4 – Z-axis conduction sink term (heat → PCB / heatsink)

  Stage 5 — POST-PROCESSING  (Law 7: Black's Equation — EM Risk)
      After convergence: flag cells where current density exceeds the
      temperature-dependent electromigration limit.
"""

import time
import numpy as np
from typing import Tuple, Dict, Any, List, Optional

from app.physics.physics_laws import (
    MATERIALS,
    COMPONENT_DEFAULTS,
    R_TH_JC,
    thermal_conductivity,
    total_component_power,
    compute_ir_drop_map,
    compute_em_risk_map,
    fan_rpm_to_h,
    heatsink_multiplier,
    robin_bc_ghost,
    z_axis_sink,
)


# ---------------------------------------------------------------------------
# Solver return type
# ---------------------------------------------------------------------------

class FDMResult:
    """Holds the complete output of one FDM solve."""

    def __init__(
        self,
        thermal_map:    np.ndarray,
        ir_drop_map:    np.ndarray,
        em_risk_map:    np.ndarray,
        source_map:     np.ndarray,   # Q_net after all stages — used by surrogate training
        iterations:     int,
        converged:      bool,
        physics_score:  int,
        solver_time_ms: float,
        total_power_W:  float,
    ) -> None:
        self.thermal_map    = thermal_map     # (N,N) °C
        self.ir_drop_map    = ir_drop_map     # (N,N) V
        self.em_risk_map    = em_risk_map     # (N,N) [0-1]
        self.source_map     = source_map      # (N,N) W/m² — finalised Q after IR correction
        self.iterations     = iterations
        self.converged      = converged
        self.physics_score  = physics_score
        self.solver_time_ms = solver_time_ms
        self.total_power_W  = total_power_W


# ---------------------------------------------------------------------------
# Stage 1 helper – build raw Q_base and I_map (Law 5)
# ---------------------------------------------------------------------------

def _build_source_maps(
    components: List[Any],
    N:          int,
    dx:         float,
) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Stage 1 — ELECTRICAL STATE

    Construct the raw volumetric heat source map Q_raw (W/m²) and the
    current-density map I_map (A/m²) using Law 5 (Dynamic + Static Power).

    This must run BEFORE IR drop (Stage 2) because IR drop depends on I_map.

    Returns
    -------
    Q_raw         : (N,N) array of raw power density per cell (W/m²)
    I_map         : (N,N) array of current density per cell (A/m²)
    total_power_W : scalar total input power (Watts)
    """
    Q_raw         = np.zeros((N, N), dtype=float)
    I_map         = np.zeros((N, N), dtype=float)
    total_power_W = 0.0

    for comp in components:
        comp_type          = getattr(comp, "type",              "cpu_core")
        defaults           = COMPONENT_DEFAULTS.get(comp_type, COMPONENT_DEFAULTS["cpu_core"])
        power_mW           = float(getattr(comp, "power_mW",           defaults["power_mW"]))
        voltage_V          = float(getattr(comp, "voltage_V",          defaults["voltage_V"]))
        freq_GHz           = float(getattr(comp, "freq_GHz",           defaults["freq_GHz"]))
        switching_activity = float(getattr(comp, "switching_activity", defaults["switching_activity"]))
        comp_x             = int(getattr(comp, "x",      0))
        comp_y             = int(getattr(comp, "y",      0))
        comp_w             = int(getattr(comp, "width",  1))
        comp_h             = int(getattr(comp, "height", 1))

        width_m  = comp_w * dx
        height_m = comp_h * dx
        area_m2  = width_m * height_m
        if area_m2 <= 0:
            continue

        # Law 5: total power (base declared + dynamic correction + leakage)
        P_total_W = total_component_power(power_mW, switching_activity, voltage_V, freq_GHz)
        total_power_W += P_total_W

        Q_per_cell = P_total_W / area_m2   # W/m² — uniform over footprint

        # Current density (A/m²) — needed by Law 6 (IR drop) and Law 7 (EM)
        I_density = (power_mW * 1e-3) / max(voltage_V, 1e-6) / area_m2

        for ci in range(comp_y, comp_y + comp_h):
            for cj in range(comp_x, comp_x + comp_w):
                if 0 <= ci < N and 0 <= cj < N:
                    Q_raw[ci, cj] += Q_per_cell
                    I_map[ci, cj]  = max(I_map[ci, cj], I_density)

    return Q_raw, I_map, total_power_W


# ---------------------------------------------------------------------------
# Main solver — strict ordered pipeline
# ---------------------------------------------------------------------------

def solve(layout: Any, solver_config: Any) -> FDMResult:
    """
    Full physics FDM solve using the strict ordered feed-forward pipeline.

    Parameters
    ----------
    layout        : Pydantic LayoutInput (or any object with matching attrs)
    solver_config : Pydantic SolverConfig (max_iterations, convergence_delta)

    Returns
    -------
    FDMResult with thermal_map, ir_drop_map, em_risk_map, source_map, metrics.
    """
    t0 = time.perf_counter()

    # ──────────────────────────────────────────────────────────────────────
    # Stage 0 — Grid & Material Setup
    # ──────────────────────────────────────────────────────────────────────
    N            = int(getattr(layout, "grid_size",      16))
    dx           = float(getattr(layout, "cell_size_mm",  1.0)) * 1e-3   # m
    T_amb        = float(getattr(layout, "ambient_temp_C", 25.0))
    fan_rpm      = float(getattr(layout, "fan_speed_rpm",  2000))
    heatsink     = getattr(layout, "heatsink_type", "standard")
    material_key = getattr(layout, "material",      "silicon")
    components   = getattr(layout, "components",    [])

    max_iter   = int(getattr(solver_config,   "max_iterations",    500))
    conv_delta = float(getattr(solver_config, "convergence_delta", 0.01))

    mat  = MATERIALS.get(material_key, MATERIALS["silicon"])
    k0   = mat["k0"]
    beta = mat["beta"]

    # Effective convection coefficient for Robin BCs (Law 3)
    h_fan  = fan_rpm_to_h(fan_rpm)
    h_mult = heatsink_multiplier(heatsink)
    h_eff  = h_fan * h_mult

    # Case temperature for Z-axis sink (Law 4)
    T_case = T_amb + 5.0

    # ──────────────────────────────────────────────────────────────────────
    # Stage 1 — ELECTRICAL STATE  (Law 5: Dynamic + Static Power)
    # Must run first: I_map feeds directly into Stage 2 (IR Drop).
    # ──────────────────────────────────────────────────────────────────────
    Q_raw, I_map, total_power_W = _build_source_maps(components, N, dx)

    # ──────────────────────────────────────────────────────────────────────
    # Stage 2 — NETWORK LOSSES  (Law 6: IR Drop)
    # Must run after Stage 1 (needs I_map) and before Stage 3 (supplies V_eff).
    # ──────────────────────────────────────────────────────────────────────
    ir_drop_map = compute_ir_drop_map(I_map, N)

    # ──────────────────────────────────────────────────────────────────────
    # Stage 3 — THERMAL SOURCES  (Law 1: Joule Heating with V_eff correction)
    # Must run after Stage 2: uses V_eff = V_dd - ΔV to re-scale Q.
    # Power scales as V²: Q_net = Q_raw · (V_eff/V_dd)²
    # ──────────────────────────────────────────────────────────────────────
    Q_source = Q_raw.copy()
    if total_power_W > 0:
        comp_voltages = []
        for comp in components:
            defaults = COMPONENT_DEFAULTS.get(getattr(comp, "type", "cpu_core"), COMPONENT_DEFAULTS["cpu_core"])
            comp_voltages.append(float(getattr(comp, "voltage_V", defaults["voltage_V"])))
        V_dd = float(np.mean(comp_voltages)) if comp_voltages else 1.2

        for i in range(N):
            for j in range(N):
                if Q_source[i, j] > 0:
                    dV    = ir_drop_map[i, j]
                    V_eff = max(0.0, V_dd - dV)
                    scale = (V_eff / V_dd) ** 2 if V_dd > 0 else 1.0
                    scale = max(0.85, scale)   # floor at 85% (IR drop < 15% in practice)
                    Q_source[i, j] *= scale

    # ──────────────────────────────────────────────────────────────────────
    # Stage 4 — PDE SOLVER  (Laws 2, 3, 4: Fourier + Robin BC + Z-axis)
    # Receives the finalised Q_net from Stage 3.
    # Warm-start component cells for faster convergence.
    # ──────────────────────────────────────────────────────────────────────
    T = np.full((N, N), T_amb, dtype=float)

    for comp in components:
        defaults = COMPONENT_DEFAULTS.get(getattr(comp, "type", "cpu_core"), COMPONENT_DEFAULTS["cpu_core"])
        power_mW = float(getattr(comp, "power_mW", defaults["power_mW"]))
        cx, cy   = int(getattr(comp, "x", 0)), int(getattr(comp, "y", 0))
        cw, ch   = int(getattr(comp, "width", 1)), int(getattr(comp, "height", 1))
        T_init   = T_amb + 50.0 * (power_mW / 250.0)
        for ci in range(cy, cy + ch):
            for cj in range(cx, cx + cw):
                if 0 <= ci < N and 0 <= cj < N:
                    T[ci, cj] = T_init

    initial_residual: Optional[float] = None
    residual  = 0.0
    converged = False
    iteration = 0

    for iteration in range(max_iter):
        T_old = T.copy()

        for i in range(N):
            for j in range(N):

                # Law 2: non-linear thermal conductivity at current T
                k_T = thermal_conductivity(T[i, j], k0, beta, T_amb)
                k_T = max(k_T, 1e-3)   # safety floor

                # Law 1 + 5: volumetric heat source
                Q = Q_source[i, j]

                # Law 4: Z-axis conduction sink term
                q_z = z_axis_sink(T[i, j], T_case, R_TH_JC, dx, N)
                Q_net = Q - q_z   # net source (can be negative → cooling)

                # Collect neighbour temperatures; apply Robin BC at edges (Law 3)
                nbrs: List[float] = []

                # North (i-1)
                if i > 0:
                    nbrs.append(T[i-1, j])
                else:
                    nbrs.append(robin_bc_ghost(T[i, j], h_eff, k_T, dx, T_amb))

                # South (i+1)
                if i < N - 1:
                    nbrs.append(T[i+1, j])
                else:
                    nbrs.append(robin_bc_ghost(T[i, j], h_eff, k_T, dx, T_amb))

                # West (j-1)
                if j > 0:
                    nbrs.append(T[i, j-1])
                else:
                    nbrs.append(robin_bc_ghost(T[i, j], h_eff, k_T, dx, T_amb))

                # East (j+1)
                if j < N - 1:
                    nbrs.append(T[i, j+1])
                else:
                    nbrs.append(robin_bc_ghost(T[i, j], h_eff, k_T, dx, T_amb))

                # Discrete Poisson update:  ∇²T ≈ (Σneighbours - 4*T) / dx²
                # Rearranged: T = (Σneighbours + Q_net*dx²/(k*d)) / 4
                chip_thickness_m = 0.0001  # 100 µm active silicon thickness
                T_new = (sum(nbrs) + Q_net * dx * dx / (k_T * chip_thickness_m)) / 4.0

                # Temperature floor = ambient (physically no sub-ambient in SS)
                T[i, j] = max(T_amb, T_new)

        # Convergence check
        residual = float(np.max(np.abs(T - T_old)))
        if initial_residual is None:
            initial_residual = residual + 1e-10

        if residual < conv_delta:
            converged = True
            break

    # Ensure initial_residual is set even for 0-component layouts
    if initial_residual is None:
        initial_residual = 1e-10

    # ------------------------------------------------------------------
    # Post-process: Law 7 – Electromigration (Black's Equation)
    # ------------------------------------------------------------------
    em_risk_map = compute_em_risk_map(I_map, T)

    # ------------------------------------------------------------------
    # Physics score: Multi-Variable Fitness Function (0-1000)
    # ------------------------------------------------------------------
    max_t = float(np.max(T))
    
    # 1. Performance Yield (40% Weight, max 400 pts) tied to Power Density
    die_area_mm2 = (N * dx * 1000.0) ** 2
    power_density = total_power_W / die_area_mm2 if die_area_mm2 > 0 else 0
    target_power_density = 0.015 # ~15W over 1024mm2
    score_perf = min(400.0, (power_density / target_power_density) * 400.0)

    # 2. Peak Thermal Health (40% Weight, max 400 pts)
    if max_t <= 60.0:
        score_therm = 400.0
    else:
        score_therm = max(0.0, 400.0 - ((max_t - 60.0) / 45.0) * 400.0)

    # 3. Silicon Stress (Max Spatial Gradient) (10%, max 100 pts)
    diff_x = np.abs(np.diff(T, axis=0))
    diff_y = np.abs(np.diff(T, axis=1))
    max_spatial_grad = max(float(np.max(diff_x)), float(np.max(diff_y)))
    score_grad = max(0.0, 100.0 - (max_spatial_grad / 15.0) * 100.0)

    # 4. IR Drop (Power Delivery Efficiency) (10%, max 100 pts)
    max_ir_drop = float(np.max(ir_drop_map))
    score_ir = max(0.0, 100.0 - (max_ir_drop / 0.1) * 100.0)

    raw_score = score_perf + score_therm + score_grad + score_ir

    # Fatal Silicon Failure Cliffs
    if max_t > 105.0:
        raw_score = 0.0
    if np.any(em_risk_map >= 0.8):
        raw_score = 0.0

    physics_score = int(max(0, min(1000, raw_score)))

    solver_time_ms = (time.perf_counter() - t0) * 1000.0

    return FDMResult(
        thermal_map    = T,
        ir_drop_map    = ir_drop_map,
        em_risk_map    = em_risk_map,
        source_map     = Q,
        iterations     = iteration + 1,
        converged      = converged,
        physics_score  = physics_score,
        solver_time_ms = solver_time_ms,
        total_power_W  = total_power_W,
    )
