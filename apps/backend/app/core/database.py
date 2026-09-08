"""
Database Transaction Management
================================
Provides transaction management utilities for consistent database operations.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import get_logger

logger = get_logger("database")


@asynccontextmanager
async def transaction(db: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for database transactions with automatic rollback on error.
    
    Usage:
        async with transaction(db) as session:
            # Perform database operations
            session.add(obj)
            # If an exception occurs, rollback is automatic
            # Otherwise, commit is automatic
    """
    try:
        yield db
        await db.commit()
        logger.debug("Transaction committed successfully")
    except Exception as e:
        await db.rollback()
        logger.error(f"Transaction rolled back due to error: {e}")
        raise


async def safe_commit(db: AsyncSession) -> bool:
    """
    Safely commit a database transaction with error handling.
    
    Returns:
        bool: True if commit succeeded, False otherwise
    """
    try:
        await db.commit()
        return True
    except Exception as e:
        logger.error(f"Commit failed: {e}")
        await db.rollback()
        return False


async def safe_rollback(db: AsyncSession) -> None:
    """
    Safely rollback a database transaction with error handling.
    """
    try:
        await db.rollback()
        logger.debug("Transaction rolled back")
    except Exception as e:
        logger.error(f"Rollback failed: {e}")
