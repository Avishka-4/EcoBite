"""
alembic/env.py — Alembic migration environment for EcoBite.

Supports both async (online) and sync (offline) migration modes.

Usage
-----
  # Apply all pending migrations
  cd backend
  alembic upgrade head

  # Generate a new auto-detected migration
  alembic revision --autogenerate -m "describe your change"

  # Show current revision
  alembic current

  # Downgrade one step
  alembic downgrade -1
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# ── Import application models so Alembic's autogenerate can see them ─────────
# Add every models module here; the import itself registers the tables on Base.
from app.core.config import settings
from app.core.database import Base
import app.models.user    # noqa: F401
import app.models.recipe  # noqa: F401

# ── Alembic config object ────────────────────────────────────────────────────
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Tell autogenerate which metadata to compare against
target_metadata = Base.metadata

# Override the sqlalchemy.url from alembic.ini with the live app setting so
# credentials never have to be stored in the ini file.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


# ── Offline mode (generates SQL script without a live connection) ─────────────
def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting to the database."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Detect column-type changes as well as additions/removals
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (connects and applies migrations) ────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations in an async context."""
    connectable = create_async_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,  # Never reuse connections during migrations
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in online mode using the async engine."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
