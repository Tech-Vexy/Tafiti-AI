import logging
import sys
from typing import Any

def setup_logging():
    # Base configuration
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    # You can customize levels for specific loggers here
    # logging.getLogger("httpx").setLevel(logging.WARNING)

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

# Default logger instance for convenient imports
logger = get_logger("app")
