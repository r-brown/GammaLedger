"""Async SQLAlchemy engine + session factory.

Engine is created lazily so import-time has no side effects (Alembic, tests, and
CLI tooling all import this module before the engine is used).
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from . import config
from .domains.monetization import models as _monetization_models  # noqa: F401
from .domains.settings import models as _settings_models  # noqa: F401
from .domains.tenants import models as _tenant_models  # noqa: F401
from .domains.trades import models as _trades_models  # noqa: F401
from .domains.users import models as _users_models  # noqa: F401

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        _engine = create_async_engine(
            config.DATABASE_URL,
            echo=config.DEBUG,
            future=True,
        )
        _sessionmaker = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    if _sessionmaker is None:
        get_engine()
    assert _sessionmaker is not None
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency."""
    async with get_sessionmaker()() as session:
        yield session


async def init_db() -> None:
    """Create tables if missing. Used in local mode for first run; Alembic
    handles hosted-mode schema changes."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def dispose_db() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _sessionmaker = None
