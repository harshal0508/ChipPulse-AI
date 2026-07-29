"""
database.py
===========
Async SQLAlchemy engine + session factory for ChipPulse AI.

Supports:
  • SQLite (default, via aiosqlite) – zero-config for development
  • PostgreSQL (via asyncpg)        – production, set DATABASE_URL in .env

Usage
-----
  from app.database import get_db, create_tables

  # In FastAPI startup:
  await create_tables()

  # In an endpoint:
  async def endpoint(db: AsyncSession = Depends(get_db)):
      ...
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.models.db_models import Base

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine configuration
# ---------------------------------------------------------------------------

# SQLite needs check_same_thread disabled + NullPool to work with asyncio
_CONNECT_ARGS: dict = {}
_ENGINE_KWARGS: dict = {}

if "sqlite" in settings.DATABASE_URL:
    _CONNECT_ARGS = {"check_same_thread": False}
    # For SQLite we skip the NullPool so connections are reused in-process
    # (NullPool is for PostgreSQL multi-process deployments)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=_CONNECT_ARGS,
    **_ENGINE_KWARGS,
)

# Session factory – expire_on_commit=False keeps objects usable after commit
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# Table creation
# ---------------------------------------------------------------------------

async def create_tables() -> None:
    """
    Create all database tables if they do not already exist.

    Called once at application startup.  Safe to call multiple times
    (uses CREATE TABLE IF NOT EXISTS via SQLAlchemy checkfirst logic).
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created / verified.")
    except Exception as exc:
        logger.error("Failed to create database tables: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Dependency injection helper
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an async database session.

    The session is automatically committed on success and rolled back on any
    unhandled exception, then always closed.

    Example
    -------
    ::

        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Project))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Health-check helper
# ---------------------------------------------------------------------------

async def check_db_connection() -> bool:
    """
    Attempt a lightweight DB round-trip and return True on success.

    Used by the /health endpoint.
    """
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("DB health check failed: %s", exc)
        return False
