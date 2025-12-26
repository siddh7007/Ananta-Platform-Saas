"""
CNS Service - Structured Logging and Error Handling Configuration

This module provides production-ready structured logging with:
- JSON formatted logs for easy parsing/querying
- OpenTelemetry trace correlation (trace_id, span_id)
- Tenant/user/job context tracking
- Exception handling with full tracebacks
- FastAPI request logging middleware
- Error handling decorators and utilities

Usage:
    from app.logging_config import get_logger, log_api_error, with_logging

    logger = get_logger(__name__)

    # Standard logging with context
    logger.info("BOM uploaded", extra={
        'organization_id': organization_id,
        'bom_id': bom_id,
        'filename': filename,
        'total_items': total_items
    })

    # Error logging with traceback
    try:
        result = await enrich_component(mpn)
    except Exception as e:
        logger.error("Enrichment failed", exc_info=True, extra={
            'mpn': mpn,
            'error_type': type(e).__name__
        })
        raise

    # API error logging (before HTTPException)
    @router.get("/bom/{bom_id}")
    async def get_bom(bom_id: str):
        bom = await fetch_bom(bom_id)
        if not bom:
            log_api_error(logger, 404, "BOM not found", bom_id=bom_id)
            raise HTTPException(status_code=404, detail="BOM not found")
"""

import logging
import json
import sys
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, Callable
from functools import wraps
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time

# Optional dependencies (fail gracefully if not installed)
try:
    from pythonjsonlogger import jsonlogger
    HAS_JSON_LOGGER = True
except ImportError:
    # Fallback to standard logging if pythonjsonlogger not available
    HAS_JSON_LOGGER = False
    jsonlogger = None

try:
    from opentelemetry import trace
    HAS_OPENTELEMETRY = True
except ImportError:
    # OpenTelemetry is optional (for trace correlation)
    HAS_OPENTELEMETRY = False
    trace = None


# ============================================================================
# JSON Formatter for Structured Logging
# ============================================================================

# Base class depends on whether jsonlogger is available
if HAS_JSON_LOGGER:
    _FormatterBase = jsonlogger.JsonFormatter
else:
    _FormatterBase = logging.Formatter

class CNSJsonFormatter(_FormatterBase):
    """
    Custom JSON formatter for structured logging in CNS service.

    Output format:
    {
      "timestamp": "2025-11-09T10:30:45.123Z",
      "level": "ERROR",
      "logger": "app.api.bom",
      "message": "BOM enrichment failed",
      "organization_id": "org-123",
      "bom_id": "bom-456",
      "job_id": "job-789",
      "user_id": "user-abc",
      "mpn": "LM358",
      "error_type": "ConnectionError",
      "trace_id": "abc123...",
      "span_id": "def456...",
      "request_id": "req-xyz",
      "duration_ms": 245,
      "exception": "Full traceback..."
    }
    """

    def add_fields(self, log_record, record, message_dict):
        """Add custom fields to log record"""

        if HAS_JSON_LOGGER:
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

        # Add trace context from OpenTelemetry (if available)
        if HAS_OPENTELEMETRY:
            try:
                span = trace.get_current_span()
                if span:
                    ctx = span.get_span_context()
                    if ctx and ctx.trace_id:
                        log_record['trace_id'] = format(ctx.trace_id, '032x')
                        log_record['span_id'] = format(ctx.span_id, '016x')
            except Exception:
                # Don't fail logging if OpenTelemetry errors occur
                pass

        # Add exception info if present
        if record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)
            log_record['exception_type'] = record.exc_info[0].__name__ if record.exc_info[0] else None

        # Add extra fields (organization_id, user_id, bom_id, job_id, etc.)
        # These come from extra={} in logger calls
        for key, value in record.__dict__.items():
            if key not in [
                'name', 'msg', 'args', 'created', 'filename', 'funcName',
                'levelname', 'levelno', 'lineno', 'module', 'msecs',
                'message', 'pathname', 'process', 'processName',
                'relativeCreated', 'thread', 'threadName', 'exc_info',
                'exc_text', 'stack_info', 'timestamp', 'level', 'logger',
                'exception', 'exception_type'
            ] and not key.startswith('_'):
                log_record[key] = value

        # Clean up None values
        log_record = {k: v for k, v in log_record.items() if v is not None}

    def format(self, record):
        """Format log record (handles both JSON and standard logging)"""
        if HAS_JSON_LOGGER:
            # Use JSON formatting
            return super().format(record)
        else:
            # Fallback to standard formatted logging with extra fields
            msg = super().format(record)
            # Add extra fields if present
            extras = []
            for key, value in record.__dict__.items():
                if key not in ['name', 'msg', 'args', 'created', 'filename', 'funcName',
                              'levelname', 'levelno', 'lineno', 'module', 'msecs',
                              'message', 'pathname', 'process', 'processName',
                              'relativeCreated', 'thread', 'threadName', 'exc_info',
                              'exc_text', 'stack_info'] and not key.startswith('_'):
                    extras.append(f"{key}={value}")
            if extras:
                msg += " [" + ", ".join(extras) + "]"
            return msg


# ============================================================================
# Logger Configuration
# ============================================================================

def configure_logging(log_level: str = "INFO", json_format: bool = True):
    """
    Configure root logger for CNS service.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: Use JSON formatting (True for production, False for dev)

    This should be called once at application startup (in app/main.py).
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # Remove existing handlers
    root_logger.handlers = []

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)

    if json_format:
        # JSON format for production (structured logging)
        if not HAS_JSON_LOGGER:
            print("⚠️  WARNING: python-json-logger not installed, falling back to standard logging", file=sys.stderr)
            print("   Install with: pip install python-json-logger", file=sys.stderr)
        formatter = CNSJsonFormatter(
            '%(timestamp)s %(level)s %(logger)s %(message)s'
        )
    else:
        # Human-readable format for development
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance configured for structured logging.

    Usage:
        from app.logging_config import get_logger

        logger = get_logger(__name__)
        logger.info("BOM uploaded", extra={
            'organization_id': organization_id,
            'bom_id': bom_id,
            'total_items': total_items
        })

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


# ============================================================================
# Error Handling Utilities
# ============================================================================

def log_exception(
    logger: logging.Logger,
    message: str,
    exc: Exception,
    level: int = logging.ERROR,
    **context
) -> None:
    """
    Log an exception with full context and traceback.

    Usage:
        try:
            result = await enrich_component(mpn)
        except Exception as e:
            log_exception(
                logger,
                "Component enrichment failed",
                e,
                mpn=mpn,
                manufacturer=manufacturer,
                line_item_id=line_item_id
            )
            raise

    Args:
        logger: Logger instance
        message: Human-readable error message
        exc: Exception instance
        level: Log level (default: ERROR)
        **context: Additional context (organization_id, user_id, etc.)
    """
    context['error_type'] = type(exc).__name__
    context['error_message'] = str(exc)

    logger.log(
        level,
        message,
        exc_info=True,
        extra=context
    )


def log_api_error(
    logger: logging.Logger,
    status_code: int,
    detail: str,
    **context
) -> None:
    """
    Log an API error before raising HTTPException.

    Usage:
        @router.get("/bom/{bom_id}")
        async def get_bom(bom_id: str):
            bom = await fetch_bom(bom_id)
            if not bom:
                log_api_error(logger, 404, "BOM not found", bom_id=bom_id)
                raise HTTPException(status_code=404, detail="BOM not found")

    Args:
        logger: Logger instance
        status_code: HTTP status code
        detail: Error detail message
        **context: Additional context (bom_id, user_id, etc.)
    """
    level = logging.WARNING if status_code < 500 else logging.ERROR

    context['status_code'] = status_code
    context['error_detail'] = detail

    logger.log(
        level,
        f"API error: {detail}",
        extra=context
    )


def with_logging(operation: str, **default_context):
    """
    Decorator to add automatic logging and error handling to functions.

    Usage:
        @with_logging("enrich_component", service="supplier_api")
        async def enrich_component(mpn: str, manufacturer: str):
            # Your code here
            pass

    Args:
        operation: Operation name (e.g., "enrich_component")
        **default_context: Default context to include in all logs

    Returns:
        Decorated function with logging
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            logger = get_logger(func.__module__)
            start_time = time.time()

            context = {**default_context, 'operation': operation}

            # Extract context from kwargs if available
            for key in ['organization_id', 'user_id', 'bom_id', 'job_id', 'mpn']:
                if key in kwargs:
                    context[key] = kwargs[key]

            logger.debug(f"Starting {operation}", extra=context)

            try:
                result = await func(*args, **kwargs)

                duration_ms = (time.time() - start_time) * 1000
                logger.info(
                    f"{operation} completed",
                    extra={**context, 'duration_ms': round(duration_ms, 2)}
                )

                return result

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                log_exception(
                    logger,
                    f"{operation} failed",
                    e,
                    duration_ms=round(duration_ms, 2),
                    **context
                )
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            logger = get_logger(func.__module__)
            start_time = time.time()

            context = {**default_context, 'operation': operation}

            # Extract context from kwargs if available
            for key in ['organization_id', 'user_id', 'bom_id', 'job_id', 'mpn']:
                if key in kwargs:
                    context[key] = kwargs[key]

            logger.debug(f"Starting {operation}", extra=context)

            try:
                result = func(*args, **kwargs)

                duration_ms = (time.time() - start_time) * 1000
                logger.info(
                    f"{operation} completed",
                    extra={**context, 'duration_ms': round(duration_ms, 2)}
                )

                return result

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                log_exception(
                    logger,
                    f"{operation} failed",
                    e,
                    duration_ms=round(duration_ms, 2),
                    **context
                )
                raise

        # Return appropriate wrapper based on function type
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# ============================================================================
# FastAPI Request Logging Middleware
# ============================================================================

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all API requests and responses.

    Logs:
    - Request method, path, query params
    - Response status code
    - Request duration
    - Client IP
    - User agent
    - Tenant/user context (if available)

    Add to FastAPI app in main.py:
        from app.logging_config import RequestLoggingMiddleware

        app.add_middleware(RequestLoggingMiddleware)
    """

    def __init__(self, app):
        super().__init__(app)
        self.logger = get_logger("app.api.requests")

    async def dispatch(self, request: Request, call_next):
        # Generate request ID
        request_id = f"req-{int(time.time() * 1000)}"

        # Capture request start time
        start_time = time.time()

        # Extract client info
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Extract tenant/user context from headers if available
        organization_id = request.headers.get("x-tenant-id")
        user_id = request.headers.get("x-user-id")

        # Log request
        self.logger.info(
            f"{request.method} {request.url.path}",
            extra={
                'event': 'request_started',
                'request_id': request_id,
                'method': request.method,
                'path': request.url.path,
                'query_params': str(request.query_params),
                'client_ip': client_ip,
                'user_agent': user_agent,
                'organization_id': organization_id,
                'user_id': user_id
            }
        )

        # Process request
        try:
            response = await call_next(request)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Determine log level based on status code
            if response.status_code >= 500:
                level = logging.ERROR
            elif response.status_code >= 400:
                level = logging.WARNING
            else:
                level = logging.INFO

            # Log response
            self.logger.log(
                level,
                f"{request.method} {request.url.path} -> {response.status_code}",
                extra={
                    'event': 'request_completed',
                    'request_id': request_id,
                    'method': request.method,
                    'path': request.url.path,
                    'status_code': response.status_code,
                    'duration_ms': round(duration_ms, 2),
                    'client_ip': client_ip,
                    'organization_id': organization_id,
                    'user_id': user_id
                }
            )

            # Add request ID to response headers
            response.headers['X-Request-ID'] = request_id

            return response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            log_exception(
                self.logger,
                f"{request.method} {request.url.path} failed",
                e,
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration_ms, 2),
                client_ip=client_ip,
                organization_id=organization_id,
                user_id=user_id
            )

            raise


# ============================================================================
# Pre-configured Loggers for Common Areas
# ============================================================================

# API endpoints
api_logger = get_logger('app.api')
bom_logger = get_logger('app.api.bom')
supplier_logger = get_logger('app.api.suppliers')
catalog_logger = get_logger('app.api.catalog')
health_logger = get_logger('app.api.health')

# Background workers
worker_logger = get_logger('app.workers')
enrichment_logger = get_logger('app.workflows.enrichment')

# Services
catalog_service_logger = get_logger('app.services.catalog')
supplier_service_logger = get_logger('app.services.suppliers')

# Plugins
digikey_logger = get_logger('app.plugins.digikey')
mouser_logger = get_logger('app.plugins.mouser')
element14_logger = get_logger('app.plugins.element14')


# ============================================================================
# Error Handling Best Practices
# ============================================================================

"""
ERROR HANDLING CONVENTIONS:

1. ALWAYS use specific exception types:
   ✅ except ValueError as e:
   ✅ except requests.exceptions.Timeout as e:
   ❌ except Exception as e:  # Too broad
   ❌ except:  # NEVER USE

2. ALWAYS log exceptions with exc_info=True:
   ✅ logger.error("Failed", exc_info=True, extra={...})
   ❌ logger.error(f"Failed: {e}")  # No traceback

3. ALWAYS include structured context:
   ✅ extra={'organization_id': organization_id, 'bom_id': bom_id}
   ❌ logger.error(f"BOM {bom_id} failed")  # Not queryable

4. ALWAYS log HTTPException before raising:
   ✅ log_api_error(logger, 404, "Not found", bom_id=bom_id)
       raise HTTPException(status_code=404, ...)
   ❌ raise HTTPException(status_code=404, ...)  # Silent

5. DON'T swallow exceptions silently:
   ✅ except Exception as e:
       logger.error("Failed", exc_info=True)
       raise  # Re-raise or return error
   ❌ except Exception as e:
       pass  # NEVER SWALLOW

EXAMPLE PATTERNS:

# API Endpoint
@router.post("/bom/upload")
async def upload_bom(file: UploadFile):
    logger = get_logger(__name__)

    logger.info("BOM upload started", extra={
        'filename': file.filename,
        'size_bytes': file.size
    })

    try:
        result = await process_bom(file)
        logger.info("BOM upload completed", extra={
            'bom_id': result['bom_id'],
            'total_items': result['total_items']
        })
        return result

    except ValueError as e:
        log_api_error(logger, 400, "Invalid BOM format", filename=file.filename)
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        log_exception(logger, "BOM upload failed", e, filename=file.filename)
        raise HTTPException(status_code=500, detail="Upload failed")

# Background Worker
async def enrich_component(mpn: str, manufacturer: str):
    logger = get_logger(__name__)

    try:
        # Call supplier API
        data = await call_supplier_api(mpn)

        logger.info("Component enriched", extra={
            'mpn': mpn,
            'manufacturer': manufacturer,
            'source': 'mouser'
        })

        return data

    except requests.exceptions.Timeout as e:
        logger.warning("Supplier API timeout", exc_info=True, extra={
            'mpn': mpn,
            'supplier': 'mouser'
        })
        raise

    except requests.exceptions.RequestException as e:
        log_exception(logger, "Supplier API failed", e, mpn=mpn, supplier='mouser')
        raise

    except Exception as e:
        log_exception(logger, "Unexpected enrichment error", e, mpn=mpn)
        raise
"""
