"""
db_models.py
============
SQLAlchemy ORM models for ChipPulse AI.

Tables
------
projects    – logical grouping of layouts, owned by a session
layouts     – grid definition + component list for one design iteration
simulations – physics solver result for one layout run
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
)
from sqlalchemy.orm import DeclarativeBase, relationship


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    __allow_unmapped__ = True


def _utcnow() -> datetime:
    """Return current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    """Generate a new UUID4 string."""
    return str(uuid.uuid4())


# ===========================================================================
# ORM Models
# ===========================================================================

class Project(Base):
    """
    Represents a named design project belonging to an anonymous session.

    A project groups one or more layouts and their simulation results.
    """

    __tablename__ = "projects"

    id          = Column(String(36), primary_key=True, default=_new_uuid)
    session_id  = Column(String(128), nullable=False, index=True)
    name        = Column(String(120), nullable=False)
    description = Column(Text, default="")
    created_at  = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at  = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    # Relationships
    layouts: list["Layout"] = relationship(
        "Layout", back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name!r}>"


class Layout(Base):
    """
    Stores one specific chip layout definition.

    Linked to a project (optional – simulations can also be run ad-hoc).
    The component list is stored as a JSON text blob.
    """

    __tablename__ = "layouts"

    id           = Column(String(36), primary_key=True, default=_new_uuid)
    project_id   = Column(String(36), ForeignKey("projects.id"), nullable=True, index=True)
    grid_size    = Column(Integer, default=16, nullable=False)
    cell_size_mm = Column(Float, default=1.0, nullable=False)
    components   = Column(Text, default="[]", nullable=False)   # JSON
    material     = Column(String(32), default="silicon", nullable=False)
    ambient_temp_C  = Column(Float, default=25.0, nullable=False)
    fan_speed_rpm   = Column(Float, default=2000.0, nullable=False)
    heatsink_type   = Column(String(32), default="standard", nullable=False)
    created_at   = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    # Relationships
    project: "Project" = relationship("Project", back_populates="layouts")
    simulations: list["Simulation"] = relationship(
        "Simulation", back_populates="layout", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Layout id={self.id} grid={self.grid_size}x{self.grid_size}>"


class Simulation(Base):
    """
    Stores the complete output of one physics simulation run.

    Database Optimization (Technical Audit)
    ----------------------------------------
    The 16×16 float matrices (thermal_map, ir_drop_map, em_risk_map) are
    stored as compact JSON Text blobs.  Direct column storage of FLOAT[][]
    in a relational DB would explode to 256 float columns per row and make
    migrations, indexing, and bulk reads extremely expensive.

    Instead, all scalar summary metrics (max_temp_C, avg_temp_C, min_temp_C,
    physics_score, total_power_W, converged) are denormalized into indexed
    Float/Integer columns.  Dashboard queries (sort by score, filter by
    temperature, leaderboard ranking) only read these fast scalar columns.
    The full matrix JSON is fetched only when a simulation detail view
    is explicitly requested.

    The layout FK is nullable so that quick ad-hoc simulations (not saved
    to any project) can still be persisted for caching / audit purposes.
    """

    __tablename__ = "simulations"

    id            = Column(String(36), primary_key=True, default=_new_uuid)
    layout_id     = Column(String(36), ForeignKey("layouts.id"), nullable=True, index=True)
    session_id    = Column(String(128), nullable=False, index=True)

    # ── Compressed matrix outputs (JSON blobs — only read on detail view) ──
    thermal_map   = Column(Text, nullable=False)   # [[float, ...], ...]
    ir_drop_map   = Column(Text, nullable=False)
    em_risk_map   = Column(Text, nullable=False)
    metrics       = Column(Text, nullable=False)   # full metrics dict
    violations    = Column(Text, nullable=False)   # violation dict
    solver_config = Column(Text, nullable=False)   # solver params dict

    # ── Scalar summary columns (indexed — used for all list/dashboard queries) ──
    max_temp_C    = Column(Float,   nullable=True, index=True)
    avg_temp_C    = Column(Float,   nullable=True)
    min_temp_C    = Column(Float,   nullable=True)
    total_power_W = Column(Float,   nullable=True)
    physics_score = Column(Integer, nullable=True, index=True)
    converged     = Column(Boolean, default=False, nullable=True)
    solver_time_ms = Column(Float,  nullable=True)

    created_at    = Column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)

    # Relationships
    layout: "Layout" = relationship("Layout", back_populates="simulations")

    def __repr__(self) -> str:
        return f"<Simulation id={self.id} max_temp={self.max_temp_C}°C score={self.physics_score}>"
