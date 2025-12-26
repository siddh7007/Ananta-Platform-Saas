"""
Middleware for CNS Service

Request Correlation IDs, Logging, Metrics, etc.
"""

import logging
import time
import uuid
from contextvars import ContextVar
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Context variable for correlation ID (accessible throughout request lifecycle)
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> str:
    """
    Get the current request's correlation ID

    Returns:
        Correlation ID string or "no-correlation-id" if not set
    """
    return correlation_id_var.get() or "no-correlation-id"


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Adds correlation ID to all requests for tracing

    Features:
    - Auto-generates correlation ID if not provided by client
    - Adds correlation ID to response headers
    - Stores correlation ID in context variable for logging
    - Logs request start/end with correlation ID

    Usage:
        from app.core.middleware import CorrelationIDMiddleware
        from fastapi import FastAPI

        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)

        # In any endpoint or service:
        from app.core.middleware import get_correlation_id
        logger.info(f"Processing request {get_correlation_id()}")
    """

    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get or generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID")
        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        # Set in context variable (accessible throughout request lifecycle)
        correlation_id_var.set(correlation_id)

        # Add to request state for easy access
        request.state.correlation_id = correlation_id

        # Log request start
        start_time = time.time()
        logger.info(
            f"[{correlation_id}] {request.method} {request.url.path} - START",
            extra={"correlation_id": correlation_id}
        )

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)

        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id

        # Log request end
        logger.info(
            f"[{correlation_id}] {request.method} {request.url.path} - "
            f"COMPLETE ({response.status_code}) in {duration_ms}ms",
            extra={
                "correlation_id": correlation_id,
                "duration_ms": duration_ms,
                "status_code": response.status_code
            }
        )

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Enhanced logging middleware with timing and error tracking

    Features:
    - Logs all requests with method, path, status code
    - Tracks request duration
    - Logs errors with correlation ID
    - Adds performance metrics
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        correlation_id = get_correlation_id()

        # Log request details
        logger.debug(
            f"[{correlation_id}] Request: {request.method} {request.url.path}",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "client_host": request.client.host if request.client else None
            }
        )

        try:
            response = await call_next(request)

            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)

            # Log successful response
            log_level = logging.INFO if response.status_code < 400 else logging.WARNING
            logger.log(
                log_level,
                f"[{correlation_id}] Response: {response.status_code} in {duration_ms}ms",
                extra={
                    "correlation_id": correlation_id,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms
                }
            )

            # Add performance header
            response.headers["X-Response-Time"] = f"{duration_ms}ms"

            return response

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)

            # Log error
            logger.error(
                f"[{correlation_id}] ERROR: {type(e).__name__}: {str(e)} after {duration_ms}ms",
                exc_info=True,
                extra={
                    "correlation_id": correlation_id,
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "duration_ms": duration_ms
                }
            )

            raise  # Re-raise for FastAPI exception handlers


# Custom logging formatter that includes correlation ID
class CorrelationIDFormatter(logging.Formatter):
    """
    Custom logging formatter that includes correlation ID in log messages

    Usage:
        handler = logging.StreamHandler()
        handler.setFormatter(CorrelationIDFormatter(
            "%(asctime)s - [%(correlation_id)s] - %(name)s - %(levelname)s - %(message)s"
        ))
    """

    def format(self, record):
        # Add correlation ID to record if not present
        if not hasattr(record, 'correlation_id'):
            record.correlation_id = get_correlation_id()

        return super().format(record)


# Helper function to add correlation ID to logs
def log_with_correlation(logger_instance: logging.Logger, level: int, message: str, **kwargs):
    """
    Log message with correlation ID included

    Args:
        logger_instance: Logger instance
        level: Logging level (e.g., logging.INFO)
        message: Log message
        **kwargs: Additional keyword arguments for logger

    Usage:
        from app.core.middleware import log_with_correlation
        import logging

        log_with_correlation(logger, logging.INFO, "Processing component", component_id=123)
    """
    correlation_id = get_correlation_id()
    extra = kwargs.get('extra', {})
    extra['correlation_id'] = correlation_id

    logger_instance.log(level, f"[{correlation_id}] {message}", extra=extra, **kwargs)
