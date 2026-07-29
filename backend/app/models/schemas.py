"""
schemas.py
==========
Pydantic v2 request / response schemas for the ChipPulse AI FastAPI backend.

Every schema is fully typed with defaults and validators so the API can be
called with minimal required fields while still enforcing physics constraints.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ===========================================================================
# Request schemas
# ===========================================================================


class ComponentInput(BaseModel):
    """A single chip component in the layout."""

    id: str = Field(..., description="Unique component identifier")
    type: str = Field(
        "cpu_core",
        description="Component type: cpu_core | gpu_cluster | mem_ctrl | cache_sram | io_ctrl | pmu",
    )
    x: int = Field(0, ge=0, description="Left column (0-indexed)")
    y: int = Field(0, ge=0, description="Top row (0-indexed)")
    width: int = Field(1, ge=1, le=16, description="Width in cells")
    height: int = Field(1, ge=1, le=16, description="Height in cells")
    power_mW: float = Field(250.0, gt=0, description="Component power dissipation (mW)")
    voltage_V: float = Field(1.2, gt=0, description="Supply voltage (V)")
    freq_GHz: float = Field(3.2, ge=0, description="Operating frequency (GHz)")
    switching_activity: float = Field(
        0.3, ge=0.0, le=1.0, description="CMOS switching activity factor (0–1)"
    )

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = {"cpu_core", "gpu_cluster", "mem_ctrl", "cache_sram", "io_ctrl", "pmu"}
        if v not in valid_types:
            raise ValueError(f"type must be one of {valid_types}")
        return v


class LayoutInput(BaseModel):
    """Complete 2-D chip layout definition."""

    grid_size: int = Field(16, ge=2, le=64, description="Number of cells per axis (square)")
    cell_size_mm: float = Field(1.0, gt=0, description="Physical size of one cell (mm)")
    components: List[ComponentInput] = Field(
        default_factory=list,
        description="List of placed components",
    )
    material: str = Field(
        "silicon",
        description="Substrate material: silicon | gaas | diamond | sic",
    )
    ambient_temp_C: float = Field(25.0, ge=-40, le=100, description="Ambient temperature (°C)")
    fan_speed_rpm: float = Field(2000.0, ge=0, description="Cooling fan speed (RPM)")
    heatsink_type: str = Field(
        "standard",
        description="Heatsink type: none | standard | premium | liquid",
    )

    @field_validator("material")
    @classmethod
    def validate_material(cls, v: str) -> str:
        valid = {"silicon", "gaas", "diamond", "sic"}
        if v not in valid:
            raise ValueError(f"material must be one of {valid}")
        return v

    @field_validator("heatsink_type")
    @classmethod
    def validate_heatsink(cls, v: str) -> str:
        valid = {"none", "standard", "premium", "liquid"}
        if v not in valid:
            raise ValueError(f"heatsink_type must be one of {valid}")
        return v

    @model_validator(mode="after")
    def validate_component_bounds(self) -> "LayoutInput":
        N = self.grid_size
        for comp in self.components:
            if comp.x + comp.width > N:
                raise ValueError(
                    f"Component '{comp.id}' extends beyond grid width: "
                    f"x={comp.x} + width={comp.width} > grid_size={N}"
                )
            if comp.y + comp.height > N:
                raise ValueError(
                    f"Component '{comp.id}' extends beyond grid height: "
                    f"y={comp.y} + height={comp.height} > grid_size={N}"
                )
        return self


class SolverConfig(BaseModel):
    """Configuration for the FDM / surrogate solver."""

    max_iterations: int = Field(500, ge=1, le=5000, description="Maximum Gauss-Seidel iterations")
    convergence_delta: float = Field(
        0.01, gt=0, description="Convergence criterion: max ΔT per iteration (°C)"
    )
    use_surrogate: bool = Field(
        False,
        description="Use neural network surrogate instead of FDM (falls back if unavailable)",
    )


class SimulationRequest(BaseModel):
    """POST /api/v1/simulate – full request body."""

    session_id: str = Field(..., description="Anonymous session UUID")
    layout: LayoutInput
    solver_config: SolverConfig = Field(default_factory=SolverConfig)


class CreateProjectRequest(BaseModel):
    """POST /api/v1/projects – create a new project."""

    session_id: str = Field(..., description="Anonymous session UUID")
    name: str = Field(..., min_length=1, max_length=120, description="Project name")
    description: str = Field("", max_length=512, description="Optional description")
    layout: Optional[LayoutInput] = Field(None, description="Initial layout (optional)")


# ===========================================================================
# Response schemas
# ===========================================================================


class HotspotInfo(BaseModel):
    x: int
    y: int
    temp_C: float


class SimulationMetrics(BaseModel):
    max_temp_C: float
    avg_temp_C: float
    min_temp_C: float
    total_power_W: float
    physics_score: int = Field(..., ge=0, le=1000)
    convergence_iterations: int
    solver_time_ms: float
    hotspots: List[HotspotInfo]
    laws_applied: List[str]


class ThermalViolation(BaseModel):
    x: int
    y: int
    temp_C: float


class EMViolation(BaseModel):
    x: int
    y: int
    risk: float


class SimulationViolations(BaseModel):
    thermal_throttle: List[ThermalViolation]
    electromigration: List[EMViolation]


class SimulationResponse(BaseModel):
    simulation_id: str
    thermal_map: List[List[float]]
    ir_drop_map: List[List[float]]
    em_risk_map: List[List[float]]
    metrics: SimulationMetrics
    violations: SimulationViolations


class ProjectResponse(BaseModel):
    id: str
    session_id: str
    name: str
    description: str
    created_at: str
    updated_at: str
    layout: Optional[Dict[str, Any]] = None


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int


class HealthResponse(BaseModel):
    status: str
    version: str
    db_connected: bool
    physics_engine: str
    surrogate_available: bool
    grid_size: int
    laws_implemented: List[str]
