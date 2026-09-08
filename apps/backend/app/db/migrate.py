"""
Alembic migration runner.

Provides an async-friendly wrapper to run ``alembic upgrade head`` at
application startup so the database schema is always in sync with models.
"""
import asyncio
import subprocess
import sys

from app.core.logger import get_logger

logger = get_logger("migrate")


def _run_alembic_upgrade() -> int:
    """Run ``alembic upgrade head`` synchronously (called from a thread)."""
    proc = subprocess.run(
        [sys.executable, "-m", "alembic", "-x", "testing=true", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr


async def run_migrations() -> None:
    """Run Alembic ``upgrade head`` in a thread to avoid blocking the event loop.

    If the migration command fails, the error is logged but the application
    is allowed to start (defensive — ``create_all`` in ``init_db`` serves as
    a fallback for greenfield deployments).
    """
    try:
        loop = asyncio.get_running_loop()
        exit_code, stdout, stderr = await loop.run_in_executor(
            None, _run_alembic_upgrade
        )
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
    except FileNotFoundError:
        logger.warning("Alembic not found — falling back to create_all")
    except Exception as e:
        logger.error(f"Migration runner error: {e}")
