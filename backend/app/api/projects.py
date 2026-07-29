"""
api/projects.py
===============
CRUD endpoints for chip design projects.

Endpoints
---------
GET  /api/v1/projects?session_id={sid}      – list all projects for a session
POST /api/v1/projects                        – create a new project
GET  /api/v1/projects/{project_id}           – retrieve a single project
DELETE /api/v1/projects/{project_id}         – delete a project
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import Layout as DBLayout, Project as DBProject
from app.models.schemas import (
    CreateProjectRequest,
    ProjectListResponse,
    ProjectResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _project_to_response(proj: DBProject, layout: Optional[DBLayout] = None) -> ProjectResponse:
    """Convert an ORM Project (+ optional latest Layout) to a response schema."""
    layout_data: Optional[dict] = None
    if layout is not None:
        try:
            components = json.loads(layout.components or "[]")
        except json.JSONDecodeError:
            components = []
        layout_data = {
            "id":             layout.id,
            "grid_size":      layout.grid_size,
            "cell_size_mm":   layout.cell_size_mm,
            "components":     components,
            "material":       layout.material,
            "ambient_temp_C": layout.ambient_temp_C,
            "fan_speed_rpm":  layout.fan_speed_rpm,
            "heatsink_type":  layout.heatsink_type,
            "created_at":     layout.created_at.isoformat() if layout.created_at else None,
        }

    return ProjectResponse(
        id          = proj.id,
        session_id  = proj.session_id,
        name        = proj.name,
        description = proj.description or "",
        created_at  = proj.created_at.isoformat() if proj.created_at else "",
        updated_at  = proj.updated_at.isoformat() if proj.updated_at else "",
        layout      = layout_data,
    )


# ---------------------------------------------------------------------------
# GET /projects
# ---------------------------------------------------------------------------

@router.get(
    "/projects",
    response_model=ProjectListResponse,
    summary="List projects for a session",
    description="Returns all projects belonging to the given session_id, newest first.",
)
async def list_projects(
    session_id: str          = Query(..., description="Anonymous session UUID"),
    limit:      int          = Query(50, ge=1, le=200, description="Max results"),
    offset:     int          = Query(0, ge=0, description="Pagination offset"),
    db:         AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    stmt = (
        select(DBProject)
        .where(DBProject.session_id == session_id)
        .order_by(DBProject.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    projects: List[DBProject] = list(result.scalars().all())

    # Fetch the latest layout per project in a single query
    layout_map: dict[str, DBLayout] = {}
    if projects:
        proj_ids = [p.id for p in projects]
        # For each project, get the most recently created layout
        layout_stmt = (
            select(DBLayout)
            .where(DBLayout.project_id.in_(proj_ids))
            .order_by(DBLayout.created_at.desc())
        )
        layout_result = await db.execute(layout_stmt)
        for lay in layout_result.scalars().all():
            # Only keep first (newest) layout per project
            if lay.project_id not in layout_map:
                layout_map[lay.project_id] = lay

    responses = [
        _project_to_response(p, layout_map.get(p.id))
        for p in projects
    ]
    return ProjectListResponse(projects=responses, total=len(responses))


# ---------------------------------------------------------------------------
# POST /projects
# ---------------------------------------------------------------------------

@router.post(
    "/projects",
    response_model=ProjectResponse,
    status_code=201,
    summary="Create a new project",
    description="Creates a new design project, optionally with an initial layout.",
)
async def create_project(
    body: CreateProjectRequest,
    db:   AsyncSession = Depends(get_db),
) -> ProjectResponse:
    # Create the project record
    project = DBProject(
        id          = str(uuid.uuid4()),
        session_id  = body.session_id,
        name        = body.name,
        description = body.description,
    )
    db.add(project)
    await db.flush()   # assign id before creating layout FK

    # Optionally persist an initial layout
    db_layout: Optional[DBLayout] = None
    if body.layout is not None:
        lay = body.layout
        db_layout = DBLayout(
            id            = str(uuid.uuid4()),
            project_id    = project.id,
            grid_size     = lay.grid_size,
            cell_size_mm  = lay.cell_size_mm,
            components    = json.dumps([c.model_dump() for c in lay.components]),
            material      = lay.material,
            ambient_temp_C  = lay.ambient_temp_C,
            fan_speed_rpm   = lay.fan_speed_rpm,
            heatsink_type   = lay.heatsink_type,
        )
        db.add(db_layout)

    await db.commit()
    await db.refresh(project)

    logger.info("Created project %s for session %s", project.id, body.session_id)
    return _project_to_response(project, db_layout)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}
# ---------------------------------------------------------------------------

@router.get(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Get a single project",
    description="Returns project details and its latest layout (if any).",
)
async def get_project(
    project_id: str,
    db:         AsyncSession = Depends(get_db),
) -> ProjectResponse:
    # Load project
    result  = await db.execute(select(DBProject).where(DBProject.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")

    # Latest layout
    lay_stmt = (
        select(DBLayout)
        .where(DBLayout.project_id == project_id)
        .order_by(DBLayout.created_at.desc())
        .limit(1)
    )
    lay_result = await db.execute(lay_stmt)
    db_layout  = lay_result.scalar_one_or_none()

    return _project_to_response(project, db_layout)


# ---------------------------------------------------------------------------
# DELETE /projects/{project_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/projects/{project_id}",
    status_code=204,
    summary="Delete a project",
    description="Permanently deletes a project and all its associated layouts and simulations.",
)
async def delete_project(
    project_id: str,
    session_id: str          = Query(..., description="Must match the project's owner session"),
    db:         AsyncSession = Depends(get_db),
) -> None:
    # Verify project exists and belongs to the caller's session
    result  = await db.execute(select(DBProject).where(DBProject.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")
    if project.session_id != session_id:
        raise HTTPException(
            status_code=403,
            detail="You do not own this project.",
        )

    await db.delete(project)
    await db.commit()
    logger.info("Deleted project %s", project_id)
    # 204 No Content – FastAPI handles empty response body
