"""
CRITICAL-4: Dual Database Routing Implementation
Ensures seamless routing between PostgreSQL (staff) and Supabase (customers)
"""

import os
import logging
from typing import Optional, Dict, Any
from enum import Enum
from dataclasses import dataclass
from functools import wraps

logger = logging.getLogger(__name__)


class DatabaseType(str, Enum):
    """Database type enumeration"""
    COMPONENTS_V2 = "components_v2"  # PostgreSQL - Staff/Internal
    SUPABASE = "supabase"             # Supabase - Customers
    
    @property
    def display_name(self) -> str:
        """Get friendly name for database"""
        if self == DatabaseType.COMPONENTS_V2:
            return "PostgreSQL (Internal)"
        return "Supabase (Customers)"


class OrganizationType(str, Enum):
    """Organization type"""
    STAFF = "staff"
    PARTNER = "partner"
    CUSTOMER = "customer"


@dataclass
class RoutingContext:
    """Context for database routing decision"""
    organization_id: Optional[int] = None
    organization_type: Optional[str] = None
    user_role: Optional[str] = None
    upload_source: Optional[str] = None
    is_bulk_operation: bool = False
    
    def determine_database(self) -> DatabaseType:
        """
        Determine which database to use based on routing context
        
        Rules:
        1. If organization_type is 'staff' → PostgreSQL (Components V2)
        2. If organization_type is 'customer' or 'partner' → Supabase
        3. If upload_source is 'staff' → PostgreSQL
        4. If upload_source is 'customer' → Supabase
        5. If user_role is admin/staff → PostgreSQL (for internal operations)
        6. Default to Supabase (safest for customer data)
        """
        # Unified BOM upload flow always writes to Supabase
        if self.is_bulk_operation:
            return DatabaseType.SUPABASE

        # Rule 1: Check organization type
        if self.organization_type:
            if self.organization_type == "staff":
                return DatabaseType.COMPONENTS_V2
            elif self.organization_type in ["customer", "partner"]:
                return DatabaseType.SUPABASE
        
        # Rule 2: Check upload source
        if self.upload_source:
            if self.upload_source == "staff":
                return DatabaseType.COMPONENTS_V2
            elif self.upload_source == "customer":
                return DatabaseType.SUPABASE
        
        # Rule 3: Check user role
        if self.user_role and self.user_role in ["admin", "staff"]:
            return DatabaseType.COMPONENTS_V2
        
        # Rule 4: Default to Supabase (customer-safe)
        logger.warning(
            f"Ambiguous routing context, defaulting to Supabase. "
            f"Context: org_type={self.organization_type}, user_role={self.user_role}"
        )
        return DatabaseType.SUPABASE
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging"""
        return {
            "organization_id": self.organization_id,
            "organization_type": self.organization_type,
            "user_role": self.user_role,
            "upload_source": self.upload_source,
            "is_bulk_operation": self.is_bulk_operation,
            "routed_to": self.determine_database().value
        }


class DualDatabaseRouter:
    """
    Central router for dual database routing decisions
    Ensures consistent routing across all API endpoints
    """
    
    def __init__(self):
        """Initialize router with configuration"""
        self.components_db_config = {
            "host": os.getenv("COMPONENTS_DB_HOST", "components-v2-postgres"),
            "port": int(os.getenv("COMPONENTS_DB_PORT", "27010")),
            "database": os.getenv("COMPONENTS_DB_NAME", "components_v2"),
            "user": os.getenv("COMPONENTS_DB_USER", "postgres"),
            "password": os.getenv("COMPONENTS_DB_PASSWORD", "postgres"),
        }
        
        self.supabase_db_config = {
            "host": os.getenv("SUPABASE_DB_HOST", "components-v2-supabase-db"),
            "port": int(os.getenv("SUPABASE_DB_PORT", "5432")),
            "database": os.getenv("SUPABASE_DB_NAME", "supabase"),
            "user": os.getenv("SUPABASE_DB_USER", "postgres"),
            "password": os.getenv("SUPABASE_DB_PASSWORD", "supabase-postgres-secure-2024"),
        }
        
        logger.info("✅ DualDatabaseRouter initialized")
        logger.info(f"   Components DB: {self.components_db_config['host']}:{self.components_db_config['port']}")
        logger.info(f"   Supabase DB: {self.supabase_db_config['host']}:{self.supabase_db_config['port']}")
    
    def route(self, context: RoutingContext) -> Dict[str, Any]:
        """
        Route request to appropriate database
        
        Args:
            context: RoutingContext with request metadata
            
        Returns:
            Dict with database_type and connection_config
        """
        db_type = context.determine_database()
        
        config = {
            "database_type": db_type,
            "connection_string": self._get_connection_string(db_type),
            "config": self._get_config(db_type),
            "context": context.to_dict()
        }
        
        logger.info(
            f"🔀 Routing decision: {db_type.display_name}",
            extra={"routing_context": context.to_dict()}
        )
        
        return config
    
    def _get_connection_string(self, db_type: DatabaseType) -> str:
        """Get connection string for database type"""
        if db_type == DatabaseType.COMPONENTS_V2:
            config = self.components_db_config
        else:
            config = self.supabase_db_config
        
        return (
            f"postgresql://{config['user']}:{config['password']}"
            f"@{config['host']}:{config['port']}/{config['database']}"
        )
    
    def _get_config(self, db_type: DatabaseType) -> Dict[str, Any]:
        """Get database config for type"""
        if db_type == DatabaseType.COMPONENTS_V2:
            return self.components_db_config
        else:
            return self.supabase_db_config


# Global router instance
_router: Optional[DualDatabaseRouter] = None


def init_router() -> DualDatabaseRouter:
    """Initialize global router"""
    global _router
    _router = DualDatabaseRouter()
    return _router


def get_router() -> DualDatabaseRouter:
    """Get global router"""
    if _router is None:
        raise RuntimeError("Router not initialized. Call init_router() first.")
    return _router


def route_request(context: RoutingContext) -> Dict[str, Any]:
    """
    Route a request to appropriate database
    
    Usage:
        context = RoutingContext(
            organization_id=123,
            organization_type="customer",
            user_role="user"
        )
        config = route_request(context)
        db_connection = create_connection(config['connection_string'])
    """
    router = get_router()
    return router.route(context)


def requires_dual_database_routing(organization_query_func=None, user_role_query_func=None):
    """
    Decorator for FastAPI endpoints requiring dual database routing
    
    Usage:
        @router.post("/bom/upload")
        @requires_dual_database_routing()
        async def upload_bom(file: UploadFile):
            # Request context automatically available
            pass
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract context from request
            context = _extract_routing_context(*args, **kwargs)
            logger.info(f"Routing context for {func.__name__}: {context.to_dict()}")
            
            # Add to kwargs for function
            kwargs["_routing_context"] = context
            
            return await func(*args, **kwargs)
        
        return wrapper
    
    return decorator


def _extract_routing_context(*args, **kwargs) -> RoutingContext:
    """Extract routing context from FastAPI request parameters"""
    context = RoutingContext()
    
    # Extract from kwargs
    if "organization_id" in kwargs:
        context.organization_id = kwargs["organization_id"]
    
    if "organization_type" in kwargs:
        context.organization_type = kwargs["organization_type"]
    
    if "user_role" in kwargs:
        context.user_role = kwargs["user_role"]
    
    if "upload_source" in kwargs:
        context.upload_source = kwargs["upload_source"]

    # Extract from request object if present
    for arg in args:
        if hasattr(arg, "headers"):
            # This is likely a Request object
            if "X-Organization-Type" in arg.headers:
                context.organization_type = arg.headers["X-Organization-Type"]
            if "X-User-Role" in arg.headers:
                context.user_role = arg.headers["X-User-Role"]
            if "X-Organization-Id" in arg.headers:
                context.organization_id = int(arg.headers["X-Organization-Id"])
    
    return context


# Logging helpers
def log_routing_decision(
    endpoint: str,
    context: RoutingContext,
    database_type: DatabaseType
) -> None:
    """Log routing decision for audit trail"""
    logger.info(
        f"🔀 [ROUTING] Endpoint={endpoint}, Database={database_type.value}, "
        f"OrgType={context.organization_type}, UserRole={context.user_role}"
    )


def log_cross_database_operation(
    operation: str,
    source_db: DatabaseType,
    target_db: DatabaseType,
    reason: str
) -> None:
    """Log cross-database operations (sync, migration, etc.)"""
    logger.info(
        f"⚡ [CROSS-DB] Operation={operation}, "
        f"From={source_db.value}, To={target_db.value}, Reason={reason}"
    )
