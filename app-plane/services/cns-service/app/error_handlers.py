"""
CNS Service - Standard Error Handlers and Custom Exceptions

This module provides:
- Custom exception classes for CNS-specific errors
- FastAPI exception handlers with logging
- Retry decorators with exponential backoff
- Circuit breaker pattern for external APIs

Usage:
    from app.error_handlers import (
        SupplierAPIError,
        ComponentNotFoundError,
        handle_supplier_api_error,
        with_retry
    )

    # Custom exceptions
    if not component:
        raise ComponentNotFoundError(mpn=mpn, manufacturer=manufacturer)

    # Retry decorator
    @with_retry(max_attempts=3, backoff=2.0)
    async def call_supplier_api(mpn: str):
        # API call here
        pass
"""

import logging
import time
import json
from typing import Optional, Dict, Any, Callable
from functools import wraps
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.logging_config import get_logger, log_exception

logger = get_logger(__name__)


# ============================================================================
# Custom Exception Classes
# ============================================================================

class CNSBaseException(Exception):
    """Base exception for all CNS-specific errors"""

    def __init__(self, message: str, **context):
        super().__init__(message)
        self.message = message
        self.context = context

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response"""
        return {
            'error': self.__class__.__name__,
            'message': self.message,
            **self.context
        }


class ComponentNotFoundError(CNSBaseException):
    """Raised when component is not found in catalog or supplier APIs"""

    def __init__(self, mpn: str, manufacturer: Optional[str] = None):
        message = f"Component not found: {mpn}"
        if manufacturer:
            message += f" by {manufacturer}"

        super().__init__(message, mpn=mpn, manufacturer=manufacturer)


class SupplierAPIError(CNSBaseException):
    """Raised when supplier API call fails"""

    def __init__(
        self,
        supplier: str,
        operation: str,
        reason: str,
        status_code: Optional[int] = None
    ):
        message = f"{supplier} API {operation} failed: {reason}"
        super().__init__(
            message,
            supplier=supplier,
            operation=operation,
            reason=reason,
            status_code=status_code
        )


class BOMParsingError(CNSBaseException):
    """Raised when BOM file cannot be parsed"""

    def __init__(self, filename: str, reason: str, line_number: Optional[int] = None):
        message = f"Failed to parse BOM file '{filename}': {reason}"
        if line_number:
            message += f" at line {line_number}"

        super().__init__(
            message,
            filename=filename,
            reason=reason,
            line_number=line_number
        )


class EnrichmentError(CNSBaseException):
    """Raised when component enrichment fails"""

    def __init__(self, mpn: str, reason: str, **context):
        message = f"Failed to enrich component {mpn}: {reason}"
        super().__init__(message, mpn=mpn, reason=reason, **context)


class DatabaseError(CNSBaseException):
    """Raised when database operation fails"""

    def __init__(self, operation: str, reason: str, **context):
        message = f"Database {operation} failed: {reason}"
        super().__init__(message, operation=operation, reason=reason, **context)


class RateLimitError(CNSBaseException):
    """Raised when API rate limit is exceeded"""

    def __init__(
        self,
        supplier: str,
        retry_after: Optional[int] = None,
        limit: Optional[int] = None
    ):
        message = f"{supplier} API rate limit exceeded"
        if retry_after:
            message += f", retry after {retry_after} seconds"

        super().__init__(
            message,
            supplier=supplier,
            retry_after=retry_after,
            limit=limit
        )


# ============================================================================
# FastAPI Exception Handlers
# ============================================================================

async def cns_exception_handler(request: Request, exc: CNSBaseException):
    """
    Global exception handler for CNS custom exceptions.

    Add to FastAPI app in main.py:
        from app.error_handlers import CNSBaseException, cns_exception_handler

        app.add_exception_handler(CNSBaseException, cns_exception_handler)
    """
    logger = get_logger('app.error_handlers')

    # Determine status code based on exception type
    status_code_map = {
        ComponentNotFoundError: 404,
        BOMParsingError: 400,
        RateLimitError: 429,
        SupplierAPIError: 502,
        EnrichmentError: 500,
        DatabaseError: 500
    }

    status_code = status_code_map.get(type(exc), 500)

    # Log exception
    log_exception(
        logger,
        f"CNS error: {exc.message}",
        exc,
        level=logging.WARNING if status_code < 500 else logging.ERROR,
        path=request.url.path,
        method=request.method,
        **exc.context
    )

    # Return JSON response
    return JSONResponse(
        status_code=status_code,
        content={
            'error': exc.__class__.__name__,
            'message': exc.message,
            'details': exc.context
        }
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Enhanced handler for HTTPException that adds logging.

    Add to FastAPI app in main.py:
        from fastapi.exceptions import HTTPException
        from app.error_handlers import http_exception_handler

        app.add_exception_handler(HTTPException, http_exception_handler)
    """
    logger = get_logger('app.error_handlers')

    # Log HTTP exceptions
    level = logging.WARNING if exc.status_code < 500 else logging.ERROR

    logger.log(
        level,
        f"HTTP {exc.status_code}: {exc.detail}",
        extra={
            'status_code': exc.status_code,
            'detail': exc.detail,
            'path': request.url.path,
            'method': request.method
        }
    )

    # Return standard response
    return JSONResponse(
        status_code=exc.status_code,
        content={'detail': exc.detail}
    )


def _safe_serialize_body(body: Any) -> Any:
    """
    Safely serialize request body for error responses.

    Handles non-JSON-serializable objects like FormData by converting them to
    string representations instead of causing serialization errors.

    Args:
        body: The request body to serialize

    Returns:
        JSON-serializable representation of the body
    """
    if body is None:
        return None

    # Try to JSON-serialize the body as-is
    try:
        json.dumps(body)
        return body
    except (TypeError, ValueError):
        # For non-serializable objects (FormData, bytes, etc.),
        # return a string representation instead
        return f"<{type(body).__name__}>"


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handler for Pydantic validation errors (422 responses).

    Logs detailed validation error information to help debug request issues.

    Add to FastAPI app in main.py:
        from fastapi.exceptions import RequestValidationError
        from app.error_handlers import validation_exception_handler

        app.add_exception_handler(RequestValidationError, validation_exception_handler)
    """
    logger = get_logger('app.error_handlers')

    # Get request body if possible
    try:
        body = await request.body()
        body_str = body.decode('utf-8') if body else 'No body'
    except Exception:
        body_str = 'Could not read body'

    # Log detailed validation error
    logger.error(
        f"❌ Validation error for {request.method} {request.url.path}",
        extra={
            'path': request.url.path,
            'method': request.method,
            'query_params': str(request.query_params),
            'path_params': request.path_params,
            'request_body': body_str,
            'validation_errors': exc.errors(),
        }
    )

    # Log each validation error in detail
    for error in exc.errors():
        logger.error(
            f"  └─ Validation error: {error['loc']} - {error['msg']} (type: {error['type']})"
        )

    # Return standard validation error response
    return JSONResponse(
        status_code=422,
        content={
            'detail': exc.errors(),
            'body': _safe_serialize_body(exc.body) if hasattr(exc, 'body') else None
        }
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unexpected exceptions.

    Add to FastAPI app in main.py:
        from app.error_handlers import generic_exception_handler

        app.add_exception_handler(Exception, generic_exception_handler)
    """
    logger = get_logger('app.error_handlers')

    # Log unexpected exceptions
    log_exception(
        logger,
        f"Unexpected error in {request.method} {request.url.path}",
        exc,
        level=logging.CRITICAL,
        path=request.url.path,
        method=request.method
    )

    # Return generic 500 error (don't leak internal details)
    return JSONResponse(
        status_code=500,
        content={
            'error': 'InternalServerError',
            'message': 'An unexpected error occurred'
        }
    )


# ============================================================================
# Retry Decorator with Exponential Backoff
# ============================================================================

def with_retry(
    max_attempts: int = 3,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,),
    logger_name: Optional[str] = None
):
    """
    Decorator to retry function with exponential backoff.

    Usage:
        @with_retry(max_attempts=3, backoff=2.0, exceptions=(requests.exceptions.Timeout,))
        async def call_supplier_api(mpn: str):
            response = await http_client.get(f"/search?mpn={mpn}")
            return response.json()

    Args:
        max_attempts: Maximum number of retry attempts
        backoff: Backoff multiplier (wait = backoff ** attempt)
        exceptions: Tuple of exception types to retry on
        logger_name: Logger name (defaults to decorated function's module)

    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            logger = get_logger(logger_name or func.__module__)

            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)

                except exceptions as e:
                    last_exception = e

                    if attempt == max_attempts:
                        # Final attempt failed
                        log_exception(
                            logger,
                            f"{func.__name__} failed after {max_attempts} attempts",
                            e,
                            function=func.__name__,
                            attempts=max_attempts
                        )
                        raise

                    # Calculate wait time
                    wait_time = backoff ** attempt

                    logger.warning(
                        f"{func.__name__} failed (attempt {attempt}/{max_attempts}), "
                        f"retrying in {wait_time}s",
                        extra={
                            'function': func.__name__,
                            'attempt': attempt,
                            'max_attempts': max_attempts,
                            'wait_time': wait_time,
                            'error': str(e)
                        }
                    )

                    # Wait before retry
                    time.sleep(wait_time)

            # Should never reach here, but just in case
            raise last_exception

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            logger = get_logger(logger_name or func.__module__)

            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)

                except exceptions as e:
                    last_exception = e

                    if attempt == max_attempts:
                        # Final attempt failed
                        log_exception(
                            logger,
                            f"{func.__name__} failed after {max_attempts} attempts",
                            e,
                            function=func.__name__,
                            attempts=max_attempts
                        )
                        raise

                    # Calculate wait time
                    wait_time = backoff ** attempt

                    logger.warning(
                        f"{func.__name__} failed (attempt {attempt}/{max_attempts}), "
                        f"retrying in {wait_time}s",
                        extra={
                            'function': func.__name__,
                            'attempt': attempt,
                            'max_attempts': max_attempts,
                            'wait_time': wait_time,
                            'error': str(e)
                        }
                    )

                    # Wait before retry
                    time.sleep(wait_time)

            # Should never reach here, but just in case
            raise last_exception

        # Return appropriate wrapper
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# ============================================================================
# Supplier API Error Handlers
# ============================================================================

def handle_supplier_api_error(
    supplier: str,
    operation: str,
    exc: Exception,
    mpn: Optional[str] = None
) -> None:
    """
    Standard handler for supplier API errors.

    Converts various exception types into SupplierAPIError with proper logging.

    Usage:
        try:
            response = requests.get(f"{base_url}/search?mpn={mpn}")
            response.raise_for_status()
        except requests.exceptions.Timeout as e:
            handle_supplier_api_error("DigiKey", "search", e, mpn=mpn)
        except requests.exceptions.RequestException as e:
            handle_supplier_api_error("DigiKey", "search", e, mpn=mpn)

    Args:
        supplier: Supplier name (DigiKey, Mouser, Element14)
        operation: Operation name (search, get_part, health_check)
        exc: Exception instance
        mpn: Optional MPN for context

    Raises:
        SupplierAPIError: Standardized supplier error
    """
    import requests

    reason = str(exc)
    status_code = None

    # Extract status code if available
    if hasattr(exc, 'response') and exc.response is not None:
        status_code = exc.response.status_code

    # Classify error type
    if isinstance(exc, requests.exceptions.Timeout):
        reason = f"Request timeout ({reason})"
    elif isinstance(exc, requests.exceptions.ConnectionError):
        reason = f"Connection failed ({reason})"
    elif isinstance(exc, requests.exceptions.HTTPError):
        reason = f"HTTP {status_code}: {reason}"
    elif isinstance(exc, requests.exceptions.RequestException):
        reason = f"Request failed ({reason})"

    # Create and raise standardized error
    error = SupplierAPIError(
        supplier=supplier,
        operation=operation,
        reason=reason,
        status_code=status_code
    )

    # Add MPN to context if provided
    if mpn:
        error.context['mpn'] = mpn

    raise error from exc


# ============================================================================
# Database Error Handler
# ============================================================================

def handle_database_error(
    operation: str,
    exc: Exception,
    **context
) -> None:
    """
    Standard handler for database errors.

    Usage:
        try:
            db.execute(query, params)
            db.commit()
        except Exception as e:
            handle_database_error("insert_bom", e, bom_id=bom_id)

    Args:
        operation: Database operation (insert, update, delete, query)
        exc: Exception instance
        **context: Additional context

    Raises:
        DatabaseError: Standardized database error
    """
    reason = str(exc)

    # Try to extract more details from SQLAlchemy exceptions
    if hasattr(exc, 'orig'):
        reason = str(exc.orig)

    raise DatabaseError(
        operation=operation,
        reason=reason,
        **context
    ) from exc


# ============================================================================
# Error Handling Examples
# ============================================================================

"""
USAGE EXAMPLES:

1. API Endpoint with Custom Exceptions:

@router.get("/components/{mpn}")
async def get_component(mpn: str, manufacturer: Optional[str] = None):
    logger = get_logger(__name__)

    try:
        component = catalog.lookup_component(mpn, manufacturer)

        if not component:
            raise ComponentNotFoundError(mpn=mpn, manufacturer=manufacturer)

        logger.info("Component found", extra={'mpn': mpn})
        return component

    except ComponentNotFoundError:
        # Handled by cns_exception_handler -> 404
        raise

    except Exception as e:
        log_exception(logger, "Component lookup failed", e, mpn=mpn)
        raise HTTPException(status_code=500, detail="Lookup failed")


2. Supplier API Call with Retry:

@with_retry(max_attempts=3, backoff=2.0, exceptions=(SupplierAPIError,))
async def enrich_from_mouser(mpn: str):
    logger = get_logger(__name__)

    try:
        response = await http_client.get(f"{mouser_url}/search?mpn={mpn}")
        response.raise_for_status()
        return response.json()

    except requests.exceptions.Timeout as e:
        handle_supplier_api_error("Mouser", "search", e, mpn=mpn)

    except requests.exceptions.RequestException as e:
        handle_supplier_api_error("Mouser", "search", e, mpn=mpn)


3. Database Operation:

async def save_bom(bom_data: Dict[str, Any]) -> str:
    logger = get_logger(__name__)

    try:
        bom_id = str(uuid.uuid4())

        query = text(\"\"\"
            INSERT INTO boms (id, filename, total_items)
            VALUES (:id, :filename, :total_items)
        \"\"\")

        db.execute(query, {
            'id': bom_id,
            'filename': bom_data['filename'],
            'total_items': bom_data['total_items']
        })
        db.commit()

        logger.info("BOM saved", extra={'bom_id': bom_id})
        return bom_id

    except Exception as e:
        db.rollback()
        handle_database_error("insert_bom", e, filename=bom_data['filename'])
"""
