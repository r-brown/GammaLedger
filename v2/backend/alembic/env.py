"""Alembic env — uses the app's async engine and SQLModel metadata.

Phase 0 has no models registered, so `SQLModel.metadata` is empty and the
initial migration is a no-op. Phase 1 starts wiring real domain models.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel

from alembic import context
from gammaledger import config as app_config
from gammaledger import database

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Make sure all model modules are imported so their tables register on
# SQLModel.metadata before autogenerate runs. Phase 1 will populate this.
# import gammaledger.domains.trades.models  # noqa: F401

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=app_config.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine: AsyncEngine = database.get_engine()
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
