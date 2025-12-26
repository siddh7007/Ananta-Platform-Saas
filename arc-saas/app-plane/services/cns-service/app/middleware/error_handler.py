"""
CRITICAL-7: Global Error Handler Middleware

Standardizes error responses, logs errors, and provides error metrics
"""

import logging
import traceback
import json
from typing import Callable, Any
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR, HTTP_400_BAD_REQUEST, HTTP_422_UNPROCESSABLE_ENTITY
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class ErrorMetrics:
    """Track error metrics"""
    
    def __init__(self):
        self.total_errors = 0
        self.errors_by_type = {}
        self.errors_by_status = {}
        self.errors_by_endpoint = {}
    
    def record(self, error_type: str, status_code: int, endpoint: str):
        """Record an error"""
        self.total_errors += 1
        
        # Track by type
        self.errors_by_type[error_type] = self.errors_by_type.get(error_type, 0) + 1
        
        # Track by status
        self.errors_by_status[status_code] = self.errors_by_status.get(status_code, 0) + 1
        
        # Track by endpoint
        if endpoint not in self.errors_by_endpoint:
            self.errors_by_endpoint[endpoint] = {"count": 0, "errors": {}}
        self.errors_by_endpoint[endpoint]["count"] += 1
        self.errors_by_endpoint[endpoint]["errors"][error_type] = self.errors_by_endpoint[endpoint]["errors"].get(error_type, 0) + 1
    
    def get_stats(self) -> dict:
        """Get error statistics"""
        return {
            "total_errors": self.total_errors,
            "errors_by_type": self.errors_by_type,
            "errors_by_status": self.errors_by_status,
            "errors_by_endpoint": self.errors_by_endpoint
        }


metrics = ErrorMetrics()


class StandardErrorResponse:
    """Standard error response format"""
    
    @staticmethod
    def format(
        error_id: str,
        message: str,
        status_code: int,
        error_type: str = "InternalServerError",
        details: dict = None,
        timestamp: str = None
    ) -> dict:
        """Format standardized error response"""
        return {
            "error": {
                "id": error_id,
                "type": error_type,
                "message": message,
                "status_code": status_code,
                "timestamp": timestamp or datetime.utcnow().isoformat(),
                "details": details or {}
            }
        }


class GlobalErrorHandler(BaseHTTPMiddleware):
    """Global error handler for all endpoints"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Any:
        """Process request and handle errors"""
        try:
            response = await call_next(request)
            return response
        
        except ValidationError as e:
            """Handle Pydantic validation errors"""
            logger.warning(f"Validation error on {request.method} {request.url.path}: {e}")
            
            errors = []
            for error in e.errors():
                errors.append({
                    "field": ".".join(str(loc) for loc in error["loc"]),
                    "message": error["msg"],
                    "type": error["type"]
                })
            
            metrics.record("ValidationError", HTTP_422_UNPROCESSABLE_ENTITY, request.url.path)
            
            response_data = StandardErrorResponse.format(
                error_id=f"VALIDATION_{len(errors)}",
                message="Request validation failed",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                error_type="ValidationError",
                details={"errors": errors}
            )
            
            return JSONResponse(response_data, status_code=HTTP_422_UNPROCESSABLE_ENTITY)
        
        except ValueError as e:
            """Handle value errors (e.g., invalid input)"""
            logger.warning(f"Value error on {request.method} {request.url.path}: {e}")
            
            metrics.record("ValueError", HTTP_400_BAD_REQUEST, request.url.path)
            
            response_data = StandardErrorResponse.format(
                error_id="INVALID_VALUE",
                message=str(e),
                status_code=HTTP_400_BAD_REQUEST,
                error_type="ValueError"
            )
            
            return JSONResponse(response_data, status_code=HTTP_400_BAD_REQUEST)
        
        except TimeoutError as e:
            """Handle timeout errors"""
            logger.error(f"Timeout on {request.method} {request.url.path}: {e}")
            
            metrics.record("TimeoutError", 504, request.url.path)
            
            response_data = StandardErrorResponse.format(
                error_id="REQUEST_TIMEOUT",
                message="Request timed out. Please try again.",
                status_code=504,
                error_type="TimeoutError"
            )
            
            return JSONResponse(response_data, status_code=504)
        
        except ConnectionError as e:
            """Handle connection errors"""
            logger.error(f"Connection error on {request.method} {request.url.path}: {e}")
            
            metrics.record("ConnectionError", 503, request.url.path)
            
            response_data = StandardErrorResponse.format(
                error_id="CONNECTION_FAILED",
                message="Service temporarily unavailable",
                status_code=503,
                error_type="ConnectionError"
            )
            
            return JSONResponse(response_data, status_code=503)
        
        except Exception as e:
            """Handle all other exceptions"""
            error_type = type(e).__name__
            
            # Log full traceback for debugging
            logger.error(
                f"Unhandled exception on {request.method} {request.url.path}",
                exc_info=True,
                extra={
                    "error_type": error_type,
                    "error_message": str(e),
                    "request_path": request.url.path,
                    "request_method": request.method,
                    "client": request.client.host if request.client else "unknown"
                }
            )
            
            metrics.record(error_type, HTTP_500_INTERNAL_SERVER_ERROR, request.url.path)
            
            # Build error details
            details = {
                "error_type": error_type
            }
            
            # Add traceback info in debug mode
            import os
            if os.getenv("DEBUG") == "true":
                details["traceback"] = traceback.format_exc()
            
            response_data = StandardErrorResponse.format(
                error_id="INTERNAL_SERVER_ERROR",
                message="An unexpected error occurred",
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                error_type=error_type,
                details=details
            )
            
            return JSONResponse(response_data, status_code=HTTP_500_INTERNAL_SERVER_ERROR)


class RateLimitExceededError(Exception):
    """Rate limit exceeded error"""
    def __init__(self, message: str = "Rate limit exceeded"):
        self.message = message


class CircuitBreakerOpenError(Exception):
    """Circuit breaker is open (vendor is down)"""
    def __init__(self, vendor: str, message: str = None):
        self.vendor = vendor
        self.message = message or f"Service {vendor} is temporarily unavailable"


class VendorAPIError(Exception):
    """Vendor API error"""
    def __init__(self, vendor: str, status_code: int, message: str):
        self.vendor = vendor
        self.status_code = status_code
        self.message = message


def get_error_metrics() -> dict:
    """Get error metrics"""
    return metrics.get_stats()


def reset_error_metrics():
    """Reset error metrics"""
    global metrics
    metrics = ErrorMetrics()
