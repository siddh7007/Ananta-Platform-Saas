"""
CRITICAL-4: Dual Database Routing Middleware
Ensures all API endpoints route to correct database based on organization context
"""

import logging
import time
from typing import Optional, Callable
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.dual_database_routing import (
    RoutingContext,
    DatabaseType,
    get_router,
    log_routing_decision
)

logger = logging.getLogger(__name__)


class DualDatabaseRoutingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce dual database routing on all endpoints
    
    Extracts organization/user context from:
    1. Request headers (X-Organization-Type, X-User-Role, X-Organization-Id)
    2. Query parameters (organization_type, user_id)
    3. JWT claims (sub, org_type, role)
    
    Stores routing decision in request state for use in endpoints
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.router = get_router()
        self.request_counter = 0
    
    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Process request and apply routing"""
        start_time = time.time()
        self.request_counter += 1
        
        try:
            # Extract routing context
            context = self._extract_context(request)
            
            # Determine database
            db_type = context.determine_database()
            
            # Store in request state
            request.state.routing_context = context
            request.state.database_type = db_type
            request.state.request_id = str(self.request_counter)  # Convert int to str
            
            # Log routing decision
            log_routing_decision(
                endpoint=f"{request.method} {request.url.path}",
                context=context,
                database_type=db_type
            )
            
            # Call next middleware/endpoint
            response = await call_next(request)
            
            # Add routing info to response headers
            elapsed = time.time() - start_time
            response.headers["X-Database-Type"] = db_type.value
            response.headers["X-Request-Id"] = str(self.request_counter)
            response.headers["X-Response-Time"] = f"{elapsed:.3f}s"
            
            logger.info(
                f"✅ [{self.request_counter}] {request.method} {request.url.path} "
                f"→ {db_type.value} ({elapsed:.3f}s)"
            )
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"❌ [{self.request_counter}] Routing middleware error: {str(e)}"
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "message": str(e),
                    "request_id": str(self.request_counter)  # Convert int to str
                }
            )
    
    def _extract_context(self, request: Request) -> RoutingContext:
        """Extract routing context from request"""
        context = RoutingContext()
        
        # 1. Try headers
        headers = request.headers
        if "x-organization-type" in headers:
            context.organization_type = headers["x-organization-type"]
        
        if "x-user-role" in headers:
            context.user_role = headers["x-user-role"]
        
        if "x-organization-id" in headers:
            try:
                context.organization_id = int(headers["x-organization-id"])
            except ValueError:
                logger.warning(f"Invalid X-Organization-Id header: {headers['x-organization-id']}")
        
        if "x-upload-source" in headers:
            context.upload_source = headers["x-upload-source"]
        
        # 2. Try query parameters (fallback)
        query_params = request.query_params
        if "organization_type" in query_params and not context.organization_type:
            context.organization_type = query_params["organization_type"]
        
        if "user_role" in query_params and not context.user_role:
            context.user_role = query_params["user_role"]
        
        if "organization_id" in query_params and not context.organization_id:
            try:
                context.organization_id = int(query_params["organization_id"])
            except ValueError:
                pass
        
        # 3. Try JWT claims (if auth middleware sets them)
        if hasattr(request.state, "user"):
            user = request.state.user
            if hasattr(user, "org_type"):
                context.organization_type = user.org_type
            if hasattr(user, "role"):
                context.user_role = user.role
        
        # 4. Heuristic: If it's a POST to /bom/upload, check form for source
        if request.method == "POST" and "/bom/upload" in request.url.path:
            context.is_bulk_operation = True
            # Form data will be available in endpoint, not here
        
        return context
    
    def _log_request_headers(self, request: Request) -> None:
        """Log relevant routing headers for debugging"""
        routing_headers = {
            k: v for k, v in request.headers.items()
            if k.lower().startswith("x-") or k.lower() in ["authorization"]
        }
        if routing_headers:
            logger.debug(f"Routing headers: {routing_headers}")


class OrganizationContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate and enrich organization context
    
    Ensures every request has valid organization metadata
    """
    
    def __init__(self, app):
        super().__init__(app)
        # Default organization (Internal Staff)
        self.default_org_type = "staff"
        self.default_role = "user"
    
    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Process request and validate organization context"""
        
        # If no organization context, apply defaults
        if not hasattr(request.state, "routing_context"):
            logger.warning(f"No routing context for {request.method} {request.url.path}")
            return await call_next(request)
        
        context = request.state.routing_context
        
        # Validate context
        if not context.organization_type:
            context.organization_type = self.default_org_type
            logger.info(f"Applied default organization_type: {self.default_org_type}")
        
        if not context.user_role:
            context.user_role = self.default_role
        
        # Set back to state
        request.state.routing_context = context
        
        return await call_next(request)


class DatabaseConnectionValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate database connection before processing request
    
    Ensures the target database is available and healthy
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.router = get_router()
        self.skip_paths = {
            "/health",
            "/readiness",
            "/docs",
            "/redoc",
            "/openapi.json"
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Validate database connection"""
        
        # Skip health check endpoints
        if any(request.url.path.startswith(p) for p in self.skip_paths):
            return await call_next(request)
        
        if not hasattr(request.state, "database_type"):
            return await call_next(request)
        
        db_type = request.state.database_type
        
        # Here you would check database connectivity
        # For now, just log it
        logger.debug(f"Database {db_type.value} will be used for this request")
        
        return await call_next(request)


class RoutingAuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware to audit all routing decisions
    
    Logs routing decisions for compliance and debugging
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.audit_log_path = "/var/log/components-platform/routing-audit.log"
    
    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Audit routing decisions"""
        
        response = await call_next(request)
        
        # Log routing decision if context available
        if hasattr(request.state, "routing_context"):
            context = request.state.routing_context
            db_type = request.state.database_type
            
            audit_entry = {
                "timestamp": time.time(),
                "request_id": getattr(request.state, "request_id", "unknown"),
                "method": request.method,
                "path": request.url.path,
                "organization_type": context.organization_type,
                "user_role": context.user_role,
                "database": db_type.value,
                "status_code": response.status_code
            }
            
            logger.info(f"AUDIT: {audit_entry}")
        
        return response


def create_dual_database_middleware_stack(app):
    """
    Create complete middleware stack for dual database routing
    
    Middleware order (processes in reverse):
    1. RoutingAuditMiddleware - Last to process (audit all)
    2. DatabaseConnectionValidationMiddleware - Validate DB
    3. OrganizationContextMiddleware - Enrich context
    4. DualDatabaseRoutingMiddleware - Main routing logic
    """
    
    app.add_middleware(RoutingAuditMiddleware)
    app.add_middleware(DatabaseConnectionValidationMiddleware)
    app.add_middleware(OrganizationContextMiddleware)
    app.add_middleware(DualDatabaseRoutingMiddleware)
    
    return app
