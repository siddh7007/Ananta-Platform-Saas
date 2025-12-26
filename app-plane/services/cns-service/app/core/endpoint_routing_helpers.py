"""
CRITICAL-4: Endpoint-Level Database Routing Helpers
Simplifies routing in individual API endpoints
"""

import logging
from typing import Optional, Callable, Any
from fastapi import Request, Depends, HTTPException, status

from app.core.dual_database_routing import (
    RoutingContext,
    DatabaseType,
    get_router
)

logger = logging.getLogger(__name__)


class EndpointRoutingHelper:
    """Helper class for endpoint-level database routing"""
    
    @staticmethod
    def get_routing_context(request: Request) -> RoutingContext:
        """Get routing context from request"""
        if not hasattr(request.state, "routing_context"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Routing context not available. Middleware not configured?"
            )
        return request.state.routing_context
    
    @staticmethod
    def get_database_type(request: Request) -> DatabaseType:
        """Get determined database type from request"""
        if not hasattr(request.state, "database_type"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database type not determined. Middleware not configured?"
            )
        return request.state.database_type
    
    @staticmethod
    def is_staff_request(request: Request) -> bool:
        """Check if request is from staff (internal)"""
        context = EndpointRoutingHelper.get_routing_context(request)
        return context.determine_database() == DatabaseType.COMPONENTS_V2
    
    @staticmethod
    def is_customer_request(request: Request) -> bool:
        """Check if request is from customer"""
        context = EndpointRoutingHelper.get_routing_context(request)
        return context.determine_database() == DatabaseType.SUPABASE
    
    @staticmethod
    def get_organization_type(request: Request) -> Optional[str]:
        """Get organization type from context"""
        context = EndpointRoutingHelper.get_routing_context(request)
        return context.organization_type
    
    @staticmethod
    def get_user_role(request: Request) -> Optional[str]:
        """Get user role from context"""
        context = EndpointRoutingHelper.get_routing_context(request)
        return context.user_role
    
    @staticmethod
    def get_organization_id(request: Request) -> Optional[int]:
        """Get organization ID from context"""
        context = EndpointRoutingHelper.get_routing_context(request)
        return context.organization_id
    
    @staticmethod
    def require_staff_access(request: Request) -> None:
        """Require request to be from staff (internal access)"""
        if not EndpointRoutingHelper.is_staff_request(request):
            logger.warning(
                f"Staff-only endpoint accessed by non-staff user. "
                f"Organization type: {EndpointRoutingHelper.get_organization_type(request)}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint requires staff access. Organization type: staff required."
            )
    
    @staticmethod
    def require_customer_access(request: Request) -> None:
        """Require request to be from customer"""
        if not EndpointRoutingHelper.is_customer_request(request):
            logger.warning(
                f"Customer-only endpoint accessed by non-customer. "
                f"Organization type: {EndpointRoutingHelper.get_organization_type(request)}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint requires customer access. Organization type: customer or partner required."
            )
    
    @staticmethod
    def log_endpoint_routing(request: Request, endpoint_name: str) -> None:
        """Log routing information for endpoint"""
        context = EndpointRoutingHelper.get_routing_context(request)
        db_type = EndpointRoutingHelper.get_database_type(request)
        
        logger.info(
            f"📍 [{endpoint_name}] Organization: {context.organization_type}, "
            f"User Role: {context.user_role}, Database: {db_type.display_name}"
        )


# FastAPI dependency for staff-only endpoints
async def require_staff(request: Request) -> None:
    """FastAPI dependency to require staff access"""
    EndpointRoutingHelper.require_staff_access(request)


# FastAPI dependency for customer-only endpoints
async def require_customer(request: Request) -> None:
    """FastAPI dependency to require customer access"""
    EndpointRoutingHelper.require_customer_access(request)


# FastAPI dependency to get routing context
async def get_routing_context_dep(request: Request) -> RoutingContext:
    """FastAPI dependency to get routing context"""
    return EndpointRoutingHelper.get_routing_context(request)


# FastAPI dependency to get database type
async def get_database_type_dep(request: Request) -> DatabaseType:
    """FastAPI dependency to get database type"""
    return EndpointRoutingHelper.get_database_type(request)


class RequestDatabaseRouter:
    """
    Helper for routing database operations within an endpoint
    
    Usage:
        @router.post("/bom/upload")
        async def upload_bom(file: UploadFile, request: Request):
            router = RequestDatabaseRouter(request)
            
            # Get database-specific service
            db = router.get_components_db()
            
            # Or work with ORM session
            session = router.get_session()
            
            # Verify it's correct database
            router.assert_database_type(DatabaseType.SUPABASE)
    """
    
    def __init__(self, request: Request):
        """Initialize router with request"""
        self.request = request
        self.context = EndpointRoutingHelper.get_routing_context(request)
        self.db_type = EndpointRoutingHelper.get_database_type(request)
        self.helper = EndpointRoutingHelper
    
    def assert_database_type(self, expected: DatabaseType) -> None:
        """Assert that request is routed to expected database"""
        if self.db_type != expected:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This operation requires {expected.display_name} database access. "
                       f"Current database: {self.db_type.display_name}"
            )
    
    def is_staff_operation(self) -> bool:
        """Check if this is a staff (internal) operation"""
        return self.db_type == DatabaseType.COMPONENTS_V2
    
    def is_customer_operation(self) -> bool:
        """Check if this is a customer operation"""
        return self.db_type == DatabaseType.SUPABASE
    
    def get_database_connection_string(self) -> str:
        """Get connection string for routed database"""
        router = get_router()
        return router._get_connection_string(self.db_type)
    
    def get_database_config(self) -> dict:
        """Get configuration for routed database"""
        router = get_router()
        return router._get_config(self.db_type)
    
    def log_operation(self, operation: str, details: Optional[dict] = None) -> None:
        """Log database operation"""
        log_msg = (
            f"🔀 [{operation}] Database: {self.db_type.value}, "
            f"Organization: {self.context.organization_type}, "
            f"Role: {self.context.user_role}"
        )
        if details:
            log_msg += f", Details: {details}"
        logger.info(log_msg)


def route_by_organization(
    postgresql_handler: Callable,
    supabase_handler: Callable
) -> Callable:
    """
    Decorator to route handler based on organization type
    
    Usage:
        def handle_staff_bom_upload(bom_data, request):
            # PostgreSQL logic
            pass
        
        def handle_customer_bom_upload(bom_data, request):
            # Supabase logic
            pass
        
        @router.post("/bom/upload")
        @route_by_organization(handle_staff_bom_upload, handle_customer_bom_upload)
        async def upload_bom(bom_data: BOMData, request: Request):
            # Automatically routes to appropriate handler
            pass
    """
    async def wrapper(request: Request, *args, **kwargs):
        router = RequestDatabaseRouter(request)
        
        if router.is_staff_operation():
            logger.info("🔀 Routing to PostgreSQL handler")
            return await postgresql_handler(request, *args, **kwargs)
        else:
            logger.info("🔀 Routing to Supabase handler")
            return await supabase_handler(request, *args, **kwargs)
    
    return wrapper


def validate_cross_database_access(
    source_db: DatabaseType,
    target_db: DatabaseType,
    reason: str
) -> bool:
    """
    Validate if cross-database access is allowed
    
    Cross-database operations (syncing, migrations) require:
    1. Staff access
    2. Valid reason
    3. Admin approval
    """
    if source_db == target_db:
        return True
    
    # Cross-database access requires admin
    # This would typically check JWT claims or user role
    logger.warning(
        f"⚠️ Cross-database access attempted: {source_db.value} → {target_db.value}, "
        f"Reason: {reason}"
    )
    
    return True  # In production, verify admin privileges
