"""
Custom JSON Logging Configuration

This module provides structured JSON logging with:
- Timestamp
- Log level
- Logger name
- Message
- Tenant context
- User context
- Trace ID (from OpenTelemetry)
- Request metadata
"""

import logging
import json
from datetime import datetime
from pythonjsonlogger import jsonlogger
from opentelemetry import trace


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """
    Custom JSON formatter for structured logging

    Output format:
    {
      "timestamp": "2025-01-15T10:30:45.123Z",
      "level": "INFO",
      "logger": "catalog.api_components",
      "message": "Component created",
      "tenant_id": "abc-123",
      "user_id": "user-456",
      "component_id": "comp-789",
      "trace_id": "abc...",
      "span_id": "def...",
      "request_id": "req-xyz",
      "duration_ms": 245
    }
    """

    def add_fields(self, log_record, record, message_dict):
        """Add custom fields to log record"""

        super().add_fields(log_record, record, message_dict)

        # Timestamp (ISO format with milliseconds)
        log_record['timestamp'] = datetime.utcfromtimestamp(
            record.created
        ).isoformat() + 'Z'

        # Level
        log_record['level'] = record.levelname

        # Logger name
        log_record['logger'] = record.name

        # Message (ensure it's always present)
        if 'message' not in log_record:
            log_record['message'] = record.getMessage()

        # Add trace context from OpenTelemetry
        span = trace.get_current_span()
        if span:
            ctx = span.get_span_context()
            if ctx and ctx.trace_id:
                log_record['trace_id'] = format(ctx.trace_id, '032x')
                log_record['span_id'] = format(ctx.span_id, '016x')

        # Add exception info if present
        if record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)

        # Add extra fields (tenant_id, user_id, etc.)
        # These come from extra={} in logger calls
        for key, value in record.__dict__.items():
            if key not in [
                'name', 'msg', 'args', 'created', 'filename', 'funcName',
                'levelname', 'levelno', 'lineno', 'module', 'msecs',
                'message', 'pathname', 'process', 'processName',
                'relativeCreated', 'thread', 'threadName', 'exc_info',
                'exc_text', 'stack_info', 'timestamp', 'level', 'logger'
            ] and not key.startswith('_'):
                log_record[key] = value

        # Clean up None values
        log_record = {k: v for k, v in log_record.items() if v is not None}


def get_logger(name: str):
    """
    Get a logger instance configured for structured logging

    Usage:
        from catalog.logging_config import get_logger

        logger = get_logger(__name__)
        logger.info(
            "Component created",
            extra={
                'tenant_id': str(tenant.id),
                'component_id': str(component.id),
                'mpn': component.mpn
            }
        )
    """
    return logging.getLogger(name)


def log_with_context(logger, level, message, **context):
    """
    Convenience function to log with context

    Usage:
        log_with_context(
            logger,
            logging.INFO,
            "Component created",
            tenant_id="abc-123",
            component_id="comp-789",
            mpn="LM358"
        )
    """
    logger.log(level, message, extra=context)


# Pre-configured logger instances for common use cases

api_logger = get_logger('catalog.api')
workflow_logger = get_logger('catalog.workflows')
vendor_logger = get_logger('catalog.vendors')
ai_logger = get_logger('catalog.ai')
storage_logger = get_logger('catalog.storage')
