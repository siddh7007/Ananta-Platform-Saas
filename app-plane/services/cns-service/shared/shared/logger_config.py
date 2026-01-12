"""
Shared Logging Configuration
=============================

Centralized logging configuration for all platform services and scripts.

Features:
    - Console logging with colors
    - File logging with rotation
    - Structured JSON logging option
    - Different log levels per handler
    - Timestamps and context

Usage:
    from shared.logger_config import setup_logger

    logger = setup_logger('my_script')
    logger.info("Script started")
    logger.debug("Debug information")
    logger.error("Error occurred")
"""

import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

# Log directory
LOG_DIR = Path(__file__).parent.parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

# ANSI color codes for console
COLORS = {
    'DEBUG': '\033[36m',      # Cyan
    'INFO': '\033[32m',       # Green
    'WARNING': '\033[33m',    # Yellow
    'ERROR': '\033[31m',      # Red
    'CRITICAL': '\033[35m',   # Magenta
    'RESET': '\033[0m'        # Reset
}

# Emoji icons
ICONS = {
    'DEBUG': '🔍',
    'INFO': 'ℹ️',
    'WARNING': '⚠️',
    'ERROR': '❌',
    'CRITICAL': '🚨'
}


class ColoredFormatter(logging.Formatter):
    """
    Custom formatter with colors and emojis
    """

    def __init__(self, fmt=None, datefmt=None, use_colors=True, use_icons=True):
        super().__init__(fmt, datefmt)
        self.use_colors = use_colors and sys.stdout.isatty()
        self.use_icons = use_icons

    def format(self, record):
        # Add icon
        if self.use_icons:
            record.icon = ICONS.get(record.levelname, '')
        else:
            record.icon = ''

        # Format message
        formatted = super().format(record)

        # Add color
        if self.use_colors:
            color = COLORS.get(record.levelname, COLORS['RESET'])
            formatted = f"{color}{formatted}{COLORS['RESET']}"

        return formatted


def setup_logger(
    name: str,
    level: str = 'INFO',
    log_to_file: bool = True,
    log_to_console: bool = True,
    use_colors: bool = True,
    use_icons: bool = True,
    json_format: bool = False
) -> logging.Logger:
    """
    Set up a logger with console and file handlers

    Note: Emojis are automatically disabled on Windows to avoid encoding errors

    Args:
        name: Logger name (usually __name__ or script name)
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_to_file: Enable file logging
        log_to_console: Enable console logging
        use_colors: Use ANSI colors in console output
        use_icons: Use emoji icons in console output
        json_format: Use JSON format for structured logging

    Returns:
        Configured logger instance

    Example:
        logger = setup_logger('my_script', level='DEBUG')
        logger.info("Script started")
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    logger.handlers.clear()

    # Auto-disable emojis on Windows to avoid encoding errors (cp1252 doesn't support Unicode emojis)
    if os.name == 'nt':  # Windows
        use_icons = False

    # Console handler
    if log_to_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)

        if json_format:
            # JSON format for structured logging
            console_format = '{"timestamp":"%(asctime)s","name":"%(name)s","level":"%(levelname)s","message":"%(message)s"}'
            console_formatter = logging.Formatter(console_format)
        else:
            # Human-readable format
            console_format = '%(icon)s %(levelname)-8s | %(name)s | %(message)s'
            console_formatter = ColoredFormatter(
                console_format,
                use_colors=use_colors,
                use_icons=use_icons
            )

        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)

    # File handler (rotating)
    if log_to_file:
        log_file = LOG_DIR / f"{name}.log"
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)

        if json_format:
            file_format = '{"timestamp":"%(asctime)s","name":"%(name)s","level":"%(levelname)s","message":"%(message)s","pathname":"%(pathname)s","lineno":%(lineno)d}'
        else:
            file_format = '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s'

        file_formatter = logging.Formatter(file_format, datefmt='%Y-%m-%d %H:%M:%S')
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

        logger.debug(f"Logging to file: {log_file}")

    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get an existing logger or create a new one with default settings

    Args:
        name: Logger name

    Returns:
        Logger instance
    """
    logger = logging.getLogger(name)

    # If no handlers, set up with defaults
    if not logger.handlers:
        return setup_logger(name)

    return logger


# Context manager for log level override
class log_level_override:
    """
    Temporarily override log level

    Example:
        with log_level_override(logger, 'DEBUG'):
            logger.debug("This will be logged")
    """

    def __init__(self, logger: logging.Logger, level: str):
        self.logger = logger
        self.new_level = getattr(logging, level.upper())
        self.old_level = logger.level

    def __enter__(self):
        self.logger.setLevel(self.new_level)
        return self.logger

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.logger.setLevel(self.old_level)


# Default logger for quick use
default_logger = setup_logger('platform', level='INFO')


if __name__ == '__main__':
    """
    Test logging configuration
    """
    logger = setup_logger('test_logger', level='DEBUG')

    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message")

    print("\n" + "=" * 70)
    print("✅ Logging test complete")
    print(f"📁 Log file: {LOG_DIR / 'test_logger.log'}")
