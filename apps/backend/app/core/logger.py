"""
Structured Logging with Request Correlation
============================================

Provides JSON-structured logging with automatic request ID propagation
via Python contextvars (async-safe).

Usage:
    from app.core.logger import get_logger, bind_request_id, get_request_id

    # In middleware — bind request ID for all log calls in this request
    bind_request_id("abc-123")

    # Any module — request_id is automatically included in structured logs
    logger = get_logger("my_module")
    logger.info("Processing paper", extra={"paper_id": "abc", "source": "openalex"})
    # → {"timestamp":"2026-08-31T12:00:00Z","level":"INFO","logger":"my_module",
    #    "message":"Processing paper","request_id":"abc-123","paper_id":"abc","source":"openalex"}
"""
import contextvars
import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.config import settings

# ---------------------------------------------------------------------------
# Context variables — async-safe request correlation
# ---------------------------------------------------------------------------
_request_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_id", default=None
)
_user_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "user_id", default=None
)


def bind_request_id(request_id: str) -> None:
    """Bind a request ID to the current async context."""
    _request_id_ctx.set(request_id)


def get_request_id() -> Optional[str]:
    """Return the current request ID, or None if outside a request."""
    return _request_id_ctx.get()


def bind_user_id(user_id: str) -> None:
    """Bind a user ID to the current async context."""
    _user_id_ctx.set(user_id)


def get_user_id() -> Optional[str]:
    """Return the current user ID, or None if unauthenticated."""
    return _user_id_ctx.get()


# ---------------------------------------------------------------------------
# JSON Formatter
# ---------------------------------------------------------------------------
class StructuredJsonFormatter(logging.Formatter):
    """Outputs log records as single-line JSON objects.

    Fields:
        timestamp  — ISO-8601 UTC
        level      — e.g. "INFO"
        logger     — logger name
        message    — log message
        request_id — from contextvar (if set)
        user_id    — from contextvar (if set)
        ...        — any extra fields passed via `extra={}`
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Correlation IDs from contextvars
        req_id = _request_id_ctx.get()
        if req_id:
            log_entry["request_id"] = req_id
        usr_id = _user_id_ctx.get()
        if usr_id:
            log_entry["user_id"] = usr_id

        # Include source location for DEBUG and WARNING+
        if record.levelno <= logging.DEBUG or record.levelno >= logging.WARNING:
            log_entry["path"] = record.pathname
            log_entry["line"] = record.lineno

        # Merge any extra fields passed via extra={...}
        for key in ("operation", "duration_ms", "status_code", "method", "path_url",
                     "client_ip", "paper_id", "user_id_explicit"):
            val = getattr(record, key, None)
            if val is not None:
                log_entry[key] = val

        # Include exc_info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Plain text formatter (for local dev readability)
# ---------------------------------------------------------------------------
class HumanReadableFormatter(logging.Formatter):
    """Compact, color-friendly format for local development."""

    COLORS = {
        "DEBUG": "\033[36m",     # cyan
        "INFO": "\033[32m",      # green
        "WARNING": "\033[33m",   # yellow
        "ERROR": "\033[31m",     # red
        "CRITICAL": "\033[1;31m",# bold red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET

        req_id = _request_id_ctx.get()
        req_tag = f" [{req_id[:8]}]" if req_id else ""

        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        return (
            f"{ts} {color}{record.levelname:8}{reset}"
            f" {record.name}{req_tag}"
            f" — {record.getMessage()}"
        )


# ---------------------------------------------------------------------------
# Logger setup
# ---------------------------------------------------------------------------
_LOGGING_CONFIGURED = False


def setup_logging() -> None:
    """Configure application logging with JSON in production, human-readable locally."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)

    if settings.ENVIRONMENT == "production":
        handler.setFormatter(StructuredJsonFormatter())
    else:
        handler.setFormatter(HumanReadableFormatter())

    logging.basicConfig(
        level=log_level,
        handlers=[handler],
        force=True,
    )
    _LOGGING_CONFIGURED = True

    # Quiet noisy third-party loggers
    for noisy in ("httpx", "httpcore", "urllib3", "sqlalchemy.engine",
                   "sqlalchemy.pool", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger instance."""
    return logging.getLogger(name)


# Default logger for convenient imports
logger = get_logger("app")


# ---------------------------------------------------------------------------
# Performance logging helper
# ---------------------------------------------------------------------------
_SLOW_THRESHOLD_MS: float = 1000.0  # 1 second


def log_slow(operation: str, duration_s: float, threshold_ms: float = _SLOW_THRESHOLD_MS, **extra: Any) -> None:
    """Log a warning if an operation exceeded the slow threshold.

    Args:
        operation:  Human-readable name, e.g. "openalex_search"
        duration_s: Wall-clock seconds the operation took
        threshold_ms: Threshold in ms; defaults to 1000 (1s)
        **extra:    Additional context fields to include in the log entry
    """
    duration_ms = round(duration_s * 1000, 2)
    perf_logger = get_logger("performance")

    extra["operation"] = operation
    extra["duration_ms"] = duration_ms

    if duration_ms >= threshold_ms:
        perf_logger.warning(
            f"Slow operation: {operation} took {duration_ms:.0f}ms",
            extra=extra,
        )
    else:
        perf_logger.debug(
            f"Operation: {operation} completed in {duration_ms:.0f}ms",
            extra=extra,
        )


class Timer:
    """Context manager that logs the elapsed time on exit.

    Usage:
        async with Timer("openalex_search", query=query):
            results = await openalex.search(query)
    """

    def __init__(self, operation: str, **extra: Any):
        self.operation = operation
        self.extra = extra
        self._start: float = 0.0

    def __enter__(self):
        self._start = time.monotonic()
        return self

    def __exit__(self, *exc_info):
        elapsed = time.monotonic() - self._start
        log_slow(self.operation, elapsed, **self.extra)
        return False  # don't suppress exceptions

    async def __aenter__(self):
        self._start = time.monotonic()
        return self

    async def __aexit__(self, *exc_info):
        elapsed = time.monotonic() - self._start
        log_slow(self.operation, elapsed, **self.extra)
        return False
