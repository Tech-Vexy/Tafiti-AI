"""
Alembic migration runner.

Provides an async-friendly wrapper to run ``alembic upgrade head`` at
application startup so the database schema is always in sync with models.

Concurrency: on PostgreSQL the migration is wrapped in a session-level advisory
lock (constant key ``TAFI``) so multiple web/worker processes starting at once
cannot run ``alembic upgrade head`` concurrently.
"""
import asyncio
import subprocess
import sys

from app.core.logger import get_logger

logger = get_logger("migrate")

# Advisory lock key (little-endian ASCII of "TAFI").
_MIGRATION_LOCK_KEY = int.from_bytes(b"TAFI", byteorder="big")


def _run_alembic_upgrade() -> tuple:
    """Run ``alembic upgrade head`` synchronously (called from a thread)."""
    proc = subprocess.run(
        [sys.executable, "-m", "alembic", "-x", "testing=true", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr


async def run_migrations() -> None:
    """Run Alembic ``upgrade head`` in a thread, guarded by a Postgres advisory lock.

    Raises:
        RuntimeError: if the migration command fails, so startup can fail fast
            in production instead of silently running an out-of-date schema.
        FileNotFoundError: re-raised so callers can detect Alembic is missing
            (e.g. greenfield dev) and fall back to ``create_all``.
    """
    from app.db.session import engine
    from sqlalchemy import text

    is_sqlite = str(engine.url).startswith("sqlite")

    if not is_sqlite:
        async with engine.begin() as conn:
            await conn.execute(
                text("SELECT pg_advisory_lock(:k)"), {"k": _MIGRATION_LOCK_KEY}
            )

    try:
        exit_code, stdout, stderr = await asyncio.to_thread(_run_alembic_upgrade)
        if exit_code == 0:
            logger.info("Database migrations applied successfully")
            if stdout.strip():
                for line in stdout.strip().splitlines():
                    logger.debug(f"  {line}")
        else:
            logger.error(f"Alembic migration failed (exit code {exit_code})")
            if stderr.strip():
                for line in stderr.strip().splitlines():
                    logger.error(f"  {line}")
            raise RuntimeError(f"Alembic migration failed (exit code {exit_code})")
    except FileNotFoundError:
        logger.warning("Alembic not found — falling back to create_all")
        raise
    except Exception as e:
        logger.error(f"Migration runner error: {e}")
        raise
    finally:
        if not is_sqlite:
            async with engine.begin() as conn:
                await conn.execute(
                    text("SELECT pg_advisory_unlock(:k)"), {"k": _MIGRATION_LOCK_KEY}
                )