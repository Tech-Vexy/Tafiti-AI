"""Deprecated shim — use app.core.logger instead."""
from app.core.logger import (  # noqa: F401
    setup_logging,
    get_logger,
    logger,
    bind_request_id,
    get_request_id,
    bind_user_id,
    get_user_id,
    log_slow,
    Timer,
)
