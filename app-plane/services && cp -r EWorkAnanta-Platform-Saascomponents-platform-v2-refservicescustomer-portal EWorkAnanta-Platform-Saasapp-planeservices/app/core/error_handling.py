"""
CRITICAL-7: Comprehensive API Error Handling & Standardization
Standardized error responses, error codes, logging, and monitoring
"""

import json
import logging
import traceback
from typing import Optional, Dict, Any, List
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import uuid

logger = logging.getLogger(__name__)


# ============================================================================
# ERROR CODES & ENUMS
# ============================================================================

class ErrorSeverity(str, Enum):
    """Error severity levels"""
    CRITICAL = "CRITICAL"
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class ErrorCategory(str, Enum):
    """Error categories for classification"""
    VALIDATION = "VALIDATION_ERROR"
    AUTHENTICATION = "AUTHENTICATION_ERROR"
    AUTHORIZATION = "AUTHORIZATION_ERROR"
    NOT_FOUND = "NOT_FOUND_ERROR"
    CONFLICT = "CONFLICT_ERROR"
    RATE_LIMIT = "RATE_LIMIT_ERROR"
    DATABASE = "DATABASE_ERROR"
    EXTERNAL_SERVICE = "EXTERNAL_SERVICE_ERROR"
    TEMPORAL = "TEMPORAL_ERROR"
    REDIS = "REDIS_ERROR"
    S3 = "S3_ERROR"
    DIRECTUS = "DIRECTUS_ERROR"
    INTERNAL = "INTERNAL_ERROR"
    UPSTREAM = "UPSTREAM_ERROR"


class ErrorCode(int, Enum):
    """Standardized error codes"""
    # Validation errors (4000-4099)
    INVALID_INPUT = 4001
    INVALID_MPN = 4002
    INVALID_CATEGORY = 4003
    INVALID_SUPPLIER = 4004
    MISSING_REQUIRED_FIELD = 4005
    INVALID_DATA_TYPE = 4006
    
    # Authentication errors (4010-4019)
    INVALID_TOKEN = 4010
    TOKEN_EXPIRED = 4011
    INVALID_CREDENTIALS = 4012
    
    # Authorization errors (4020-4029)
    INSUFFICIENT_PERMISSIONS = 4020
    ACCESS_DENIED = 4021
    ORGANIZATION_MISMATCH = 4022
    
    # Resource errors (4030-4049)
    NOT_FOUND = 4030
    COMPONENT_NOT_FOUND = 4031
    CATEGORY_NOT_FOUND = 4032
    SUPPLIER_NOT_FOUND = 4033
    BOM_NOT_FOUND = 4034
    
    # Conflict errors (4050-4069)
    DUPLICATE_ENTRY = 4050
    VERSION_MISMATCH = 4051
    STATE_CONFLICT = 4052
    
    # Rate limiting (4070-4079)
    RATE_LIMIT_EXCEEDED = 4070
    QUOTA_EXCEEDED = 4071
    
    # Database errors (5000-5099)
    DATABASE_ERROR = 5000
    CONNECTION_FAILED = 5001
    QUERY_FAILED = 5002
    TRANSACTION_FAILED = 5003
    
    # External service errors (5100-5199)
    EXTERNAL_SERVICE_ERROR = 5100
    TEMPORAL_ERROR = 5101
    REDIS_ERROR = 5102
    S3_ERROR = 5103
    DIRECTUS_ERROR = 5104
    
    # Internal errors (5200-5299)
    INTERNAL_SERVER_ERROR = 5200
    TIMEOUT = 5201
    SERVICE_UNAVAILABLE = 5202


# ============================================================================
# ERROR MODELS
# ============================================================================

class ErrorField(BaseModel):
    """Details about a specific field error"""
    field: str = Field(..., description="Field name")
    message: str = Field(..., description="Error message")
    received: Optional[Any] = Field(None, description="Value received")
    expected: Optional[str] = Field(None, description="Expected format/type")


class ErrorResponse(BaseModel):
    """Standard error response format"""
    error_id: str = Field(..., description="Unique error identifier (UUID)")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    
    # Error classification
    status_code: int = Field(..., description="HTTP status code")
    error_code: int = Field(..., description="Application error code")
    category: str = Field(..., description="Error category")
    severity: str = Field(..., description="Error severity")
    
    # Error details
    message: str = Field(..., description="User-friendly error message")
    detail: Optional[str] = Field(None, description="Technical details")
    
    # Field-specific errors
    errors: Optional[List[ErrorField]] = Field(None, description="Field validation errors")
    
    # Request context
    request_id: Optional[str] = Field(None, description="Request ID for correlation")
    path: Optional[str] = Field(None, description="API endpoint path")
    method: Optional[str] = Field(None, description="HTTP method")
    
    # Retry information
    retryable: bool = Field(False, description="Whether request can be retried")
    retry_after: Optional[int] = Field(None, description="Seconds to wait before retry")


class ErrorLog(BaseModel):
    """Log entry for error tracking and analysis"""
    error_id: str
    timestamp: str
    status_code: int
    error_code: int
    category: str
    severity: str
    message: str
    path: str
    method: str
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    traceback: Optional[str] = None
    response_time_ms: float = 0


# ============================================================================
# ERROR HANDLER
# ============================================================================

class ErrorHandler:
    """Central error handler for standardized error responses"""
    
    @staticmethod
    def get_error_response(
        exception: Exception,
        status_code: int,
        error_code: int,
        category: ErrorCategory,
        message: str,
        detail: Optional[str] = None,
        field_errors: Optional[List[ErrorField]] = None,
        request: Optional[Request] = None,
        retryable: bool = False,
        retry_after: Optional[int] = None,
    ) -> ErrorResponse:
        """
        Create a standardized error response
        
        Args:
            exception: The original exception
            status_code: HTTP status code
            error_code: Application error code
            category: Error category
            message: User-friendly message
            detail: Technical details
            field_errors: List of field validation errors
            request: HTTP request object
            retryable: Whether request can be retried
            retry_after: Seconds to wait before retry
        
        Returns:
            ErrorResponse with standardized format
        """
        error_id = str(uuid.uuid4())
        
        # Determine severity based on status code
        if 400 <= status_code < 500:
            severity = ErrorSeverity.WARNING
        else:
            severity = ErrorSeverity.ERROR
        
        # Extract request details
        path = request.url.path if request else None
        method = request.method if request else None
        request_id = getattr(request.state, "request_id", None) if request else None
        
        return ErrorResponse(
            error_id=error_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            status_code=status_code,
            error_code=error_code,
            category=category.value,
            severity=severity.value,
            message=message,
            detail=detail,
            errors=field_errors,
            request_id=request_id,
            path=path,
            method=method,
            retryable=retryable,
            retry_after=retry_after,
        )
    
    @staticmethod
    def create_validation_error(
        request: Request,
        field_errors: List[ErrorField],
    ) -> ErrorResponse:
        """Create validation error response"""
        return ErrorHandler.get_error_response(
            exception=ValueError("Validation failed"),
            status_code=400,
            error_code=ErrorCode.INVALID_INPUT.value,
            category=ErrorCategory.VALIDATION,
            message="Validation failed",
            detail="One or more fields have validation errors",
            field_errors=field_errors,
            request=request,
            retryable=False,
        )
    
    @staticmethod
    def create_not_found_error(
        request: Request,
        resource_type: str,
        resource_id: str,
    ) -> ErrorResponse:
        """Create not found error response"""
        error_code_map = {
            "component": ErrorCode.COMPONENT_NOT_FOUND,
            "category": ErrorCode.CATEGORY_NOT_FOUND,
            "supplier": ErrorCode.SUPPLIER_NOT_FOUND,
            "bom": ErrorCode.BOM_NOT_FOUND,
        }
        error_code = error_code_map.get(resource_type, ErrorCode.NOT_FOUND)
        
        return ErrorHandler.get_error_response(
            exception=None,
            status_code=404,
            error_code=error_code.value,
            category=ErrorCategory.NOT_FOUND,
            message=f"{resource_type.capitalize()} not found",
            detail=f"{resource_type.capitalize()} with ID '{resource_id}' does not exist",
            request=request,
            retryable=False,
        )
    
    @staticmethod
    def create_database_error(
        request: Request,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create database error response"""
        return ErrorHandler.get_error_response(
            exception=Exception("Database error"),
            status_code=500,
            error_code=ErrorCode.DATABASE_ERROR.value,
            category=ErrorCategory.DATABASE,
            message="Database error occurred",
            detail=detail or "An error occurred while accessing the database",
            request=request,
            retryable=True,
            retry_after=5,
        )
    
    @staticmethod
    def create_temporal_error(
        request: Request,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create Temporal workflow error response"""
        return ErrorHandler.get_error_response(
            exception=Exception("Temporal error"),
            status_code=503,
            error_code=ErrorCode.TEMPORAL_ERROR.value,
            category=ErrorCategory.TEMPORAL,
            message="Workflow execution failed",
            detail=detail or "An error occurred during workflow execution",
            request=request,
            retryable=True,
            retry_after=10,
        )
    
    @staticmethod
    def create_redis_error(
        request: Request,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create Redis error response"""
        return ErrorHandler.get_error_response(
            exception=Exception("Redis error"),
            status_code=503,
            error_code=ErrorCode.REDIS_ERROR.value,
            category=ErrorCategory.REDIS,
            message="Cache service unavailable",
            detail=detail or "An error occurred with the cache service",
            request=request,
            retryable=True,
            retry_after=5,
        )
    
    @staticmethod
    def create_external_service_error(
        request: Request,
        service_name: str,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create external service error response"""
        service_error_map = {
            "directus": ErrorCode.DIRECTUS_ERROR,
            "s3": ErrorCode.S3_ERROR,
        }
        error_code = service_error_map.get(service_name.lower(), ErrorCode.EXTERNAL_SERVICE_ERROR)
        
        return ErrorHandler.get_error_response(
            exception=Exception(f"{service_name} error"),
            status_code=502,
            error_code=error_code.value,
            category=ErrorCategory.EXTERNAL_SERVICE,
            message=f"{service_name} service error",
            detail=detail or f"An error occurred communicating with {service_name}",
            request=request,
            retryable=True,
            retry_after=10,
        )
    
    @staticmethod
    def create_authentication_error(
        request: Request,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create authentication error response"""
        return ErrorHandler.get_error_response(
            exception=None,
            status_code=401,
            error_code=ErrorCode.INVALID_TOKEN.value,
            category=ErrorCategory.AUTHENTICATION,
            message="Authentication failed",
            detail=detail or "Invalid or missing authentication credentials",
            request=request,
            retryable=False,
        )
    
    @staticmethod
    def create_authorization_error(
        request: Request,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create authorization error response"""
        return ErrorHandler.get_error_response(
            exception=None,
            status_code=403,
            error_code=ErrorCode.INSUFFICIENT_PERMISSIONS.value,
            category=ErrorCategory.AUTHORIZATION,
            message="Insufficient permissions",
            detail=detail or "You do not have permission to access this resource",
            request=request,
            retryable=False,
        )
    
    @staticmethod
    def create_rate_limit_error(
        request: Request,
        retry_after: int,
    ) -> ErrorResponse:
        """Create rate limit error response"""
        return ErrorHandler.get_error_response(
            exception=None,
            status_code=429,
            error_code=ErrorCode.RATE_LIMIT_EXCEEDED.value,
            category=ErrorCategory.RATE_LIMIT,
            message="Rate limit exceeded",
            detail="Too many requests. Please try again later.",
            request=request,
            retryable=True,
            retry_after=retry_after,
        )
    
    @staticmethod
    def create_conflict_error(
        request: Request,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create conflict error response"""
        return ErrorHandler.get_error_response(
            exception=None,
            status_code=409,
            error_code=ErrorCode.DUPLICATE_ENTRY.value,
            category=ErrorCategory.CONFLICT,
            message="Conflict detected",
            detail=detail or "The requested operation conflicts with existing data",
            request=request,
            retryable=False,
        )
    
    @staticmethod
    def create_internal_error(
        request: Request,
        exception: Exception,
        detail: Optional[str] = None,
    ) -> ErrorResponse:
        """Create internal server error response"""
        return ErrorHandler.get_error_response(
            exception=exception,
            status_code=500,
            error_code=ErrorCode.INTERNAL_SERVER_ERROR.value,
            category=ErrorCategory.INTERNAL,
            message="Internal server error",
            detail=detail or "An unexpected error occurred",
            request=request,
            retryable=True,
            retry_after=5,
        )


# ============================================================================
# ERROR LOGGING
# ============================================================================

class ErrorLogger:
    """Centralized error logging with structured format"""
    
    @staticmethod
    def log_error(
        error_response: ErrorResponse,
        request: Request,
        response_time_ms: float = 0,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        traceback_str: Optional[str] = None,
    ) -> None:
        """
        Log error with structured format
        
        Args:
            error_response: ErrorResponse object
            request: HTTP request object
            response_time_ms: Response time in milliseconds
            user_id: User ID if available
            organization_id: Organization ID if available
            traceback_str: Traceback string if available
        """
        
        # Format log message
        log_line = (
            f"ERROR_ID={error_response.error_id} | "
            f"CODE={error_response.error_code} | "
            f"CATEGORY={error_response.category} | "
            f"STATUS={error_response.status_code} | "
            f"PATH={request.url.path} | "
            f"METHOD={request.method} | "
            f"MSG={error_response.message} | "
            f"RESPONSE_TIME_MS={response_time_ms}"
        )
        
        if user_id:
            log_line += f" | USER_ID={user_id}"
        if organization_id:
            log_line += f" | ORG_ID={organization_id}"
        
        # Log at appropriate level based on severity
        if error_response.severity == ErrorSeverity.CRITICAL.value:
            logger.critical(log_line)
            if traceback_str:
                logger.critical(f"TRACEBACK:\n{traceback_str}")
        elif error_response.severity == ErrorSeverity.ERROR.value:
            logger.error(log_line)
            if traceback_str:
                logger.error(f"TRACEBACK:\n{traceback_str}")
        else:
            logger.warning(log_line)
    
    @staticmethod
    def log_validation_error(
        path: str,
        method: str,
        field_errors: List[ErrorField],
        request_id: Optional[str] = None,
    ) -> None:
        """Log validation error"""
        log_line = (
            f"VALIDATION_ERROR | "
            f"PATH={path} | "
            f"METHOD={method} | "
            f"FIELD_ERRORS={len(field_errors)}"
        )
        
        if request_id:
            log_line += f" | REQUEST_ID={request_id}"
        
        # Include field error details
        for field_error in field_errors:
            log_line += f" | {field_error.field}={field_error.message}"
        
        logger.warning(log_line)


# ============================================================================
# ERROR MIDDLEWARE
# ============================================================================

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Global error handling middleware
    Catches all exceptions and converts to standardized error responses
    """
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID if not already present
        if not hasattr(request.state, "request_id"):
            request.state.request_id = str(uuid.uuid4())
        
        # Record start time
        import time
        start_time = time.time()
        
        try:
            response = await call_next(request)
            response_time_ms = (time.time() - start_time) * 1000
            
            # Add standard headers
            response.headers["X-Request-ID"] = request.state.request_id
            response.headers["X-Response-Time-Ms"] = str(response_time_ms)
            
            return response
        
        except HTTPException as exc:
            # Handle FastAPI HTTPException
            response_time_ms = (time.time() - start_time) * 1000
            
            error_response = ErrorHandler.create_internal_error(
                request=request,
                exception=exc,
                detail=exc.detail if hasattr(exc, "detail") else None,
            )
            error_response.status_code = exc.status_code
            
            ErrorLogger.log_error(
                error_response=error_response,
                request=request,
                response_time_ms=response_time_ms,
            )
            
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.dict(),
                headers={"X-Request-ID": request.state.request_id},
            )
        
        except Exception as exc:
            # Handle all other exceptions
            response_time_ms = (time.time() - start_time) * 1000
            
            error_response = ErrorHandler.create_internal_error(
                request=request,
                exception=exc,
                detail=str(exc),
            )
            
            tb_str = traceback.format_exc()
            ErrorLogger.log_error(
                error_response=error_response,
                request=request,
                response_time_ms=response_time_ms,
                traceback_str=tb_str,
            )
            
            return JSONResponse(
                status_code=500,
                content=error_response.dict(),
                headers={"X-Request-ID": request.state.request_id},
            )


# ============================================================================
# EXCEPTION HANDLERS (for FastAPI)
# ============================================================================

async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    response_time_ms = 0
    
    error_response = ErrorHandler.create_internal_error(
        request=request,
        exception=exc,
        detail=exc.detail if hasattr(exc, "detail") else None,
    )
    error_response.status_code = exc.status_code
    
    ErrorLogger.log_error(
        error_response=error_response,
        request=request,
        response_time_ms=response_time_ms,
    )
    
    return JSONResponse(
        status_code=error_response.status_code,
        content=error_response.dict(),
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    response_time_ms = 0
    
    error_response = ErrorHandler.create_internal_error(
        request=request,
        exception=exc,
        detail=str(exc),
    )
    
    tb_str = traceback.format_exc()
    ErrorLogger.log_error(
        error_response=error_response,
        request=request,
        response_time_ms=response_time_ms,
        traceback_str=tb_str,
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response.dict(),
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
    )


# ============================================================================
# GLOBAL INITIALIZATION
# ============================================================================

def setup_error_handling(app):
    """
    Setup error handling for FastAPI application
    
    Usage:
        from fastapi import FastAPI
        from app.core.error_handling import setup_error_handling
        
        app = FastAPI()
        setup_error_handling(app)
    """
    # Add middleware
    app.add_middleware(ErrorHandlingMiddleware)
    
    # Add exception handlers
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def extract_field_errors(validation_errors: List[Dict]) -> List[ErrorField]:
    """
    Convert Pydantic validation errors to ErrorField objects
    
    Args:
        validation_errors: List of Pydantic validation error dicts
    
    Returns:
        List of ErrorField objects
    """
    field_errors = []
    
    for error in validation_errors:
        field_name = ".".join(str(x) for x in error.get("loc", [])[1:])
        
        field_errors.append(ErrorField(
            field=field_name,
            message=error.get("msg", "Invalid value"),
            received=error.get("ctx", {}).get("value"),
            expected=error.get("type"),
        ))
    
    return field_errors
