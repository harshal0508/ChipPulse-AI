"""
physics_laws.py
================
All 7 physics laws used by the ChipPulse AI thermal simulation engine.

Law 1  – Joule Heating (temperature-dependent resistivity)
Law 2  – Non-Linear Fourier Heat Conduction (interior PDE)
Law 3  – Robin Boundary Conditions (air/fan convection)
Law 4  – 3D Z-Axis Conduction (junction-to-case heat sink)
Law 5  – Dynamic + Static Power (CMOS switching + leakage)
Law 6  – IR Drop  (voltage drop across wire resistance)
Law 7  – Electromigration (Black's Equation)
"""

import numpy as np
from typing import Dict

# ---------------------------------------------------------------------------
# Material constants  (k0 in W/m·K, beta in K⁻¹, rho0 in μΩ·cm, alpha_r K⁻¹)
# ---------------------------------------------------------------------------
MATERIALS: Dict[str, Dict[str, float]] = {
    "silicon": {"k0": 149.0,  "beta": 0.003,  "rho0": 640.0, "alpha_r": 0.001},
    "gaas":    {"k0": 46.0,   "beta": 0.002,  "rho0": 1e8,   "alpha_r": 0.0005},
    "diamond": {"k0": 2200.0, "beta": 0.001,  "rho0": 1e13,  "alpha_r": 0.0001},
    "sic":     {"k0": 490.0,  "beta": 0.0025, "rho0": 0.1,   "alpha_r": 0.0008},
}

# ---------------------------------------------------------------------------
# Component default electrical parameters
# ---------------------------------------------------------------------------
COMPONENT_DEFAULTS: Dict[str, Dict[str, float]] = {
    "cpu_core":    {"power_mW": 250, "voltage_V": 1.2, "freq_GHz": 3.2, "switching_activity": 0.3},
    "gpu_cluster": {"power_mW": 180, "voltage_V": 1.1, "freq_GHz": 2.4, "switching_activity": 0.5},
    "mem_ctrl":    {"power_mW": 80,  "voltage_V": 1.0, "freq_GHz": 1.6, "switching_activity": 0.2},
    "cache_sram":  {"power_mW": 50,  "voltage_V": 0.9, "freq_GHz": 3.2, "switching_activity": 0.1},
    "io_ctrl":     {"power_mW": 30,  "voltage_V": 1.8, "freq_GHz": 0.8, "switching_activity": 0.4},
    "pmu":         {"power_mW": 20,  "voltage_V": 3.3, "freq_GHz": 0.1, "switching_activity": 0.1},
    "npu_accelerator":        {"power_mW": 220, "voltage_V": 1.1, "freq_GHz": 2.0, "switching_activity": 0.4},
    "image_signal_processor": {"power_mW": 130, "voltage_V": 1.1, "freq_GHz": 1.5, "switching_activity": 0.3},
    "media_engine":           {"power_mW": 70,  "voltage_V": 1.0, "freq_GHz": 1.2, "switching_activity": 0.2},
    "wireless_modem":         {"power_mW": 140, "voltage_V": 1.2, "freq_GHz": 0.8, "switching_activity": 0.3},
    "secure_enclave":         {"power_mW": 15,  "voltage_V": 1.0, "freq_GHz": 1.0, "switching_activity": 0.1},
    "clock_pll":              {"power_mW": 12,  "voltage_V": 1.8, "freq_GHz": 4.0, "switching_activity": 0.5},
    "bus_fabric":             {"power_mW": 45,  "voltage_V": 1.0, "freq_GHz": 1.8, "switching_activity": 0.4},
}

# ---------------------------------------------------------------------------
# Physical / electrical constants
# ---------------------------------------------------------------------------
K_BOLTZMANN_EV: float = 8.617333e-5   # eV / K
A_BLACK: float       = 1e18            # A/m² – Black's Equation pre-exponential
EA_BLACK: float      = 0.7             # eV  – activation energy (Al interconnects)
R_WIRE_CELL: float   = 0.05            # Ω   – wire resistance per cell segment
R_TH_JC: float       = 0.5            # K/W – thermal resistance junction-to-case


# ===========================================================================
# LAW 1 – Joule Heating
# ===========================================================================

def resistivity(T_C: float, rho0: float, alpha_r: float, T_ref: float = 25.0) -> float:
    """
    Temperature-dependent resistivity:
        rho(T) = rho0 * [1 + alpha_r * (T - T_ref)]

    Parameters
    ----------
    T_C     : local temperature in °C
    rho0    : baseline resistivity at T_ref (material constant)
    alpha_r : temperature coefficient of resistance (K⁻¹)
    T_ref   : reference temperature (°C)

    Returns
    -------
    rho : resistivity at temperature T_C (same units as rho0)
    """
    return rho0 * (1.0 + alpha_r * (T_C - T_ref))


def joule_heat_density(J: float, T_C: float, rho0: float, alpha_r: float,
                       T_ref: float = 25.0) -> float:
    """
    Volumetric Joule heat generation:
        Q = J² * rho(T)   [W/m³]

    Parameters
    ----------
    J       : current density  (A/m²)
    T_C     : local temperature (°C)
    rho0, alpha_r : material resistivity constants
    T_ref   : reference temperature (°C)

    Returns
    -------
    Q : heat generation rate (W/m³)
    """
    rho = resistivity(T_C, rho0, alpha_r, T_ref)
    return J * J * rho


# ===========================================================================
# LAW 2 – Non-Linear Fourier Thermal Conductivity
# ===========================================================================

def thermal_conductivity(T_C: float, k0: float, beta: float,
                         T_amb: float = 25.0) -> float:
    """
    Temperature-dependent thermal conductivity of semiconductor:
        k(T) = k0 / (1 + beta * (T - T_amb))

    Parameters
    ----------
    T_C   : local temperature (°C)
    k0    : thermal conductivity at T_amb (W/m·K)
    beta  : temperature coefficient (K⁻¹)
    T_amb : ambient reference temperature (°C)

    Returns
    -------
    k : thermal conductivity (W/m·K)
    """
    dT = max(0.0, T_C - T_amb)
    return k0 / (1.0 + beta * dT)


def fourier_residual(T_grid: np.ndarray, Q_grid: np.ndarray, k_grid: np.ndarray,
                     dx: float) -> np.ndarray:
    """
    Compute the PDE residual for the steady-state Fourier equation on interior nodes:
        div(k∇T) + Q = 0

    Uses a central-difference discrete Laplacian.
    Interior cells only; boundary handling is done in the FDM solver.

    Returns
    -------
    residual : (N,N) array of PDE residuals (should approach 0 at convergence)
    """
    N = T_grid.shape[0]
    residual = np.zeros_like(T_grid)
    for i in range(1, N - 1):
        for j in range(1, N - 1):
            k_c = k_grid[i, j]
            lap_T = (T_grid[i+1, j] + T_grid[i-1, j] +
                     T_grid[i, j+1] + T_grid[i, j-1] - 4.0 * T_grid[i, j]) / (dx * dx)
            residual[i, j] = k_c * lap_T + Q_grid[i, j]
    return residual


# ===========================================================================
# LAW 3 – Robin Boundary Conditions (Convection)
# ===========================================================================

def fan_rpm_to_h(rpm: float) -> float:
    """
    Map cooling fan speed to effective convection coefficient h_eff (W/m²·K).

    Edges are cooled by forced convection (top fan), natural convection (sides),
    or PCB thermal path (bottom). This simplified mapping captures the dominant
    fan contribution.

    Parameters
    ----------
    rpm : fan rotational speed (RPM)

    Returns
    -------
    h_eff : effective heat transfer coefficient (W/m²·K)
    """
    if rpm == 0:
        return 5.0    # purely natural convection
    if rpm < 1000:
        return 15.0   # light fan cooling
    if rpm < 2000:
        return 25.0   # moderate cooling
    if rpm < 3000:
        return 45.0   # active cooling
    return 65.0       # high-performance heatsink + fan


def heatsink_multiplier(heatsink_type: str) -> float:
    """Return h_eff scale factor for heatsink type."""
    multipliers = {
        "none":     0.5,
        "standard": 1.0,
        "premium":  1.8,
        "liquid":   4.0,
    }
    return multipliers.get(heatsink_type, 1.0)


def robin_bc_ghost(T_center: float, h_eff: float, k_T: float,
                   dx: float, T_amb: float) -> float:
    """
    Compute the ghost-node temperature implied by the Robin (convective) BC:
        -k * dT/dn = h_eff * (T_edge - T_amb)

    Using a 1st-order ghost node:
        T_ghost = T_center - (h_eff * dx / k_T) * (T_center - T_amb)

    Parameters
    ----------
    T_center : temperature at the boundary cell (°C)
    h_eff    : convective heat transfer coefficient (W/m²·K)
    k_T      : local thermal conductivity at T_center (W/m·K)
    dx       : cell spacing (m)
    T_amb    : ambient temperature (°C)

    Returns
    -------
    T_ghost : ghost temperature (°C) for use in Gauss-Seidel stencil
    """
    Bi = (h_eff * dx) / k_T          # local Biot number
    return T_center - Bi * (T_center - T_amb)


# ===========================================================================
# LAW 4 – Z-Axis Conduction (Junction-to-Case Thermal Sink)
# ===========================================================================

def z_axis_sink(T_cell: float, T_case: float, R_th_jc: float,
                dx: float, N: int = 16) -> float:
    """
    Model 3-D z-axis heat flow as a volumetric sink in the 2-D PDE:
        Q_z = (T_junction - T_case) / R_th_jc_cell   [W per cell]

    Converted to a volumetric density by dividing by the cell face area (dx²):
        q_z = Q_z / dx²   [W/m²]

    Parameters
    ----------
    T_cell  : local cell temperature (°C)
    T_case  : package case temperature (°C)
    R_th_jc : junction-to-case thermal resistance (K/W) for the whole package
    dx      : cell size in meters (m)
    N       : grid size (default 16)

    Returns
    -------
    q_z : z-axis sink term (W/m²) – positive means heat leaves the cell
    """
    R_th_jc_cell = R_th_jc * (N * N)
    Q_z = (T_cell - T_case) / R_th_jc_cell   # W
    q_z = Q_z / (dx * dx)               # W/m²
    return q_z


# ===========================================================================
# LAW 5 – Dynamic + Static Power
# ===========================================================================

def dynamic_power(switching_activity: float, C_eff: float,
                  voltage_V: float, freq_GHz: float) -> float:
    """
    CMOS dynamic switching power:
        P_dyn = alpha_sw * C_eff * V_dd² * f

    Parameters
    ----------
    switching_activity : alpha (dimensionless 0–1)
    C_eff              : effective switching capacitance (F)
    voltage_V          : supply voltage (V)
    freq_GHz           : clock frequency (GHz)

    Returns
    -------
    P_dyn : dynamic power (W)
    """
    freq_Hz = freq_GHz * 1e9
    return switching_activity * C_eff * (voltage_V ** 2) * freq_Hz


def static_power(voltage_V: float, I_leak_A: float = 1e-9) -> float:
    """
    Leakage / static power:
        P_static = I_leak * V_dd

    Parameters
    ----------
    voltage_V  : supply voltage (V)
    I_leak_A   : leakage current (A), default 1 nA

    Returns
    -------
    P_static : static power (W)
    """
    return I_leak_A * voltage_V


def total_component_power(power_mW: float, switching_activity: float,
                          voltage_V: float, freq_GHz: float,
                          C_eff: float = 1e-14) -> float:
    """
    Combined power: specified + dynamic correction + static leakage.

    The base power_mW is taken as the primary source.  Dynamic and static
    terms are added as incremental physics corrections.

    Parameters
    ----------
    power_mW           : rated component power (mW)
    switching_activity : alpha (0–1)
    voltage_V          : supply voltage (V)
    freq_GHz           : clock frequency (GHz)
    C_eff              : switching capacitance (F)

    Returns
    -------
    P_total : total power (W)
    """
    P_base    = power_mW * 1e-3
    P_dyn     = dynamic_power(switching_activity, C_eff, voltage_V, freq_GHz)
    P_static  = static_power(voltage_V)
    return P_base + P_dyn + P_static


# ===========================================================================
# LAW 6 – IR Drop
# ===========================================================================

def compute_ir_drop_map(I_map: np.ndarray, N: int,
                        R_wire: float = R_WIRE_CELL) -> np.ndarray:
    """
    Estimate IR drop at each cell based on Manhattan distance to chip center:
        deltaV(i,j) = I(i,j) * R_wire * dist_to_center

    Voltage droops most in cells far from the power delivery network (PDN)
    center, which is typically at the chip center.

    Parameters
    ----------
    I_map  : (N, N) current density map (A/m²)
    N      : grid size
    R_wire : wire resistance per cell segment (Ω)

    Returns
    -------
    ir_drop_map : (N, N) IR drop (V)
    """
    ir_drop = np.zeros((N, N))
    center = N // 2
    for i in range(N):
        for j in range(N):
            dist = abs(i - center) + abs(j - center)  # Manhattan distance
            # Reduce by 1e-3 to keep the drop physically small (mV range)
            ir_drop[i, j] = I_map[i, j] * R_wire * dist * 1e-3
    return ir_drop


def effective_voltage(V_dd: float, ir_drop: float) -> float:
    """
    Effective supply voltage after IR drop:
        V_eff = V_dd - deltaV

    Clamped to a minimum of 0 V.
    """
    return max(0.0, V_dd - ir_drop)


# ===========================================================================
# LAW 7 – Electromigration (Black's Equation)
# ===========================================================================

def em_risk_cell(J_actual: float, T_C: float,
                 A: float = A_BLACK, Ea: float = EA_BLACK) -> float:
    """
    Electromigration risk score for a single cell based on Black's Equation:
        J_max = A * exp(-Ea / (kB * T_K))

    Risk score = J_actual / J_max   (clamped to [0, 1]).

    A score of 1.0 means the cell operates exactly at its EM limit.
    A score > 0.8 is considered "at risk".

    Parameters
    ----------
    J_actual : operating current density (A/m²)
    T_C      : local junction temperature (°C)
    A        : Black's Equation pre-exponential (A/m²)
    Ea       : activation energy (eV)

    Returns
    -------
    risk : float in [0, 1]
    """
    T_K = T_C + 273.15
    T_K = max(T_K, 1.0)  # guard against 0 K
    J_max = A * np.exp(-Ea / (K_BOLTZMANN_EV * T_K))
    if J_max <= 0.0:
        return 0.0
    return float(min(1.0, J_actual / J_max))


def compute_em_risk_map(I_map: np.ndarray, T_grid: np.ndarray) -> np.ndarray:
    """
    Compute the full electromigration risk map for all cells.

    Parameters
    ----------
    I_map  : (N, N) current density map (A/m²)
    T_grid : (N, N) temperature map (°C)

    Returns
    -------
    em_risk : (N, N) float array in [0, 1]
    """
    N = T_grid.shape[0]
    em_risk = np.zeros((N, N))
    for i in range(N):
        for j in range(N):
            em_risk[i, j] = em_risk_cell(I_map[i, j], T_grid[i, j])
    return em_risk
