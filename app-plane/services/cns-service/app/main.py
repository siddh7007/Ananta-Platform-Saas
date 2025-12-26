"""
Component Normalization Service (CNS) - Main FastAPI Application

Entry point for the CNS service with comprehensive logging and error handling.
Includes all CRITICAL fixes: dual database routing, race condition prevention,
input validation, and standardized error handling.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app import __version__
from app.core.validation import ConfigValidator, ConfigValidationError
from app.core.middleware import CorrelationIDMiddleware

# Import API routers
from app.api import api_router

# Import comprehensive logging and error handling
from app.logging_config import (
    configure_logging,
    get_logger,
    RequestLoggingMiddleware,
    log_exception
)
from app.error_handlers import (
    CNSBaseException,
    cns_exception_handler,
    http_exception_handler,
    generic_exception_handler as error_handler_generic,
    validation_exception_handler
)

# Import observability (OpenTelemetry tracing + Prometheus metrics)
try:
    from app.observability import (
        init_observability,
        shutdown_observability,
        get_metrics_router,
        instrument_app,
        instrument_httpx,
    )
    OBSERVABILITY_AVAILABLE = True
except ImportError as e:
    OBSERVABILITY_AVAILABLE = False
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning(f"Observability modules not available: {e}")

# ============================================================================
# CRITICAL FIXES INTEGRATION
# ============================================================================

# CRITICAL-4: Dual Database Routing
try:
    from app.core.dual_database_routing import init_router as init_dual_db_router
    from app.middleware.dual_database_routing import create_dual_database_middleware_stack
    CRITICAL_4_AVAILABLE = True  # Re-enabled with router initialization fix
except ImportError:
    CRITICAL_4_AVAILABLE = False
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("⚠️  CRITICAL-4 (Dual Database Routing) modules not found")

# CRITICAL-5: Temporal Race Condition Prevention
try:
    from app.core.workflow_locking import init_workflow_lock_manager
    from app.core.temporal_race_conditions import init_temporal_race_condition_handlers
    CRITICAL_5_AVAILABLE = True  # Re-enabled with parameter fixes
except ImportError:
    CRITICAL_5_AVAILABLE = False
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("⚠️  CRITICAL-5 (Race Condition Prevention) modules not found")

# CRITICAL-6: Input Validation & Sanitization
try:
    from app.core.input_validation import InputValidationMiddleware
    CRITICAL_6_AVAILABLE = True
except ImportError:
    CRITICAL_6_AVAILABLE = False
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("⚠️  CRITICAL-6 (Input Validation) modules not found")

# CRITICAL-7: API Error Handling
try:
    from app.core.error_handling import (
        setup_error_handling,
        ErrorHandlingMiddleware,
        ErrorHandler
    )
    CRITICAL_7_AVAILABLE = True
except ImportError:
    CRITICAL_7_AVAILABLE = False
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("⚠️  CRITICAL-7 (API Error Handling) modules not found")

# Configure structured logging (JSON format for production, human-readable for dev)
configure_logging(
    log_level=settings.log_level.upper(),
    json_format=not settings.is_development()  # JSON in prod, readable in dev
)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.

    Startup:
    - Initialize database connections
    - Connect to Redis
    - Initialize Temporal worker
    - Load AI models
    - Start supplier health monitor
    - Start workflow control consumer (RabbitMQ)

    Shutdown:
    - Stop workflow control consumer
    - Stop supplier health monitor
    - Close database connections
    - Close Redis connection
    - Shutdown Temporal worker
    """
    # Startup
    logger.info(f"Starting Component Normalization Service (CNS) v{__version__}")
    logger.info(f"Environment: {settings.environment}")

    # Validate configuration FIRST (fail fast)
    try:
        ConfigValidator.validate_at_startup(settings)
    except ConfigValidationError as e:
        logger.error("Configuration validation failed:")
        for error in e.errors:
            logger.error(f"  - {error}")
        raise SystemExit(1) from e

    logger.info(f"Port: {settings.cns_port}")
    logger.info(f"Database: {settings.database_url.split('@')[-1]}")  # Hide credentials
    logger.info(f"Redis: {settings.redis_url if settings.redis_enabled else 'disabled'}")
    logger.info(f"Temporal: {settings.temporal_host if settings.temporal_enabled else 'disabled'}")

    # Initialize observability (OpenTelemetry tracing + Prometheus metrics)
    if OBSERVABILITY_AVAILABLE:
        try:
            # Get Jaeger/OTLP endpoint from settings if available
            jaeger_endpoint = getattr(settings, 'jaeger_endpoint', None) or getattr(settings, 'otlp_endpoint', None)
            if not jaeger_endpoint:
                # Default to shared Jaeger instance
                jaeger_endpoint = "http://localhost:4317"

            init_observability(
                service_name="cns-service",
                service_version=__version__,
                environment=settings.environment,
                jaeger_endpoint=jaeger_endpoint,
                enable_tracing=True,
                enable_metrics=True,
            )

            # Auto-instrument HTTPX for outgoing API calls (supplier APIs)
            instrument_httpx()

            logger.info(f"[OK] Observability initialized (tracing + metrics)")
            logger.info(f"     - Jaeger/OTLP endpoint: {jaeger_endpoint}")
            logger.info(f"     - Prometheus metrics: /metrics")
        except Exception as e:
            logger.warning(f"[WARN] Observability initialization failed: {e}")
            logger.warning("       Continuing without distributed tracing/metrics")

    # Log enabled features
    logger.info(f"Enabled AI providers: {', '.join(settings.get_enabled_ai_providers())}")
    logger.info(f"Enabled Tier 1 suppliers: {', '.join(settings.get_enabled_tier1_suppliers())}")
    logger.info(f"AI suggestions: {'enabled' if settings.enable_ai_suggestions else 'disabled'}")
    logger.info(f"Multi-AI fallback: {'enabled' if settings.enable_multi_ai_fallback else 'disabled'}")

    # Initialize dual database connection pools (Supabase + Components V2)
    from app.models.dual_database import init_dual_database
    try:
        dual_db = init_dual_database()
        logger.info(f"✅ Dual database initialized:")
        logger.info(f"   - Supabase: for customer uploads (customer-facing)")
        logger.info(f"   - Components V2: for staff bulk imports (internal catalog)")
    except Exception as e:
        logger.error(f"❌ Dual database initialization failed: {e}")
        raise

    # Also initialize legacy single database for backward compatibility
    from app.models.base import init_database
    try:
        db = init_database(settings.database_url)
        logger.info(f"✅ Legacy database initialized (backward compat): {db.engine.pool.size()} connections")
    except Exception as e:
        logger.warning(f"⚠️  Legacy database initialization failed: {e}")

    # Initialize Redis connection
    if settings.redis_enabled:
        from app.cache.redis_cache import init_cache
        try:
            cache = init_cache(settings.redis_url, default_ttl=settings.redis_cache_ttl)
            if cache.is_connected:
                logger.info(f"✅ Redis initialized: {settings.redis_url}")
            else:
                logger.warning(f"⚠️  Redis connection failed, caching disabled")
        except Exception as e:
            logger.warning(f"⚠️  Redis initialization failed: {e}, caching disabled")
    else:
        logger.info("Redis disabled in configuration")

    # Initialize Temporal client connection
    if settings.temporal_enabled:
        from app.core.temporal_client import ensure_temporal_connected
        try:
            connected = await ensure_temporal_connected()
            if connected:
                logger.info(f"✅ Temporal client connected: {settings.temporal_host}")
            else:
                logger.warning(f"⚠️  Temporal client connection failed, workflows disabled")
        except Exception as e:
            logger.warning(f"⚠️  Temporal initialization failed: {e}, workflows disabled")
    else:
        logger.info("Temporal disabled in configuration")

    # ============================================================================
    # INITIALIZE CRITICAL FIXES
    # ============================================================================

    # CRITICAL-4: Already initialized at module level (before middleware registration)
    if CRITICAL_4_AVAILABLE:
        logger.info("✅ CRITICAL-4: Dual Database Routing already initialized")

    # CRITICAL-5: Initialize Workflow Locking & Race Condition Prevention
    if CRITICAL_5_AVAILABLE:
        try:
            # Get Redis and Temporal clients
            from app.cache.redis_cache import get_cache
            from app.core.temporal_client import get_temporal_client_manager

            cache = get_cache()
            temporal_manager = get_temporal_client_manager()

            if cache and cache.is_connected and temporal_manager:
                # Initialize workflow locking with Redis client
                init_workflow_lock_manager(cache._client)

                # Initialize race condition handlers with both clients
                temporal_client = temporal_manager.get_client()
                if temporal_client:
                    init_temporal_race_condition_handlers(cache._client, temporal_client)
                else:
                    logger.warning("⚠️  CRITICAL-5 skipped: Temporal client not available")

                logger.info("✅ CRITICAL-5: Race Condition Prevention initialized (locks, stuck workflow detection)")
            else:
                logger.warning("⚠️  CRITICAL-5 skipped: Redis or Temporal not available")
        except Exception as e:
            logger.error(f"❌ CRITICAL-5 initialization failed: {e}")

    # CRITICAL-6 & CRITICAL-7: Middleware stack initialized in app creation (see below)
    if CRITICAL_6_AVAILABLE:
        logger.info("✅ CRITICAL-6: Input Validation & Sanitization ready")
    if CRITICAL_7_AVAILABLE:
        logger.info("✅ CRITICAL-7: API Error Handling & Standardization ready")

    from app.services.supplier_health_monitor import (
        start_supplier_health_monitor,
        stop_supplier_health_monitor,
    )
    monitor_task = None
    if settings.supplier_health_monitor_enabled:
        try:
            monitor_task = start_supplier_health_monitor()
            if monitor_task:
                logger.info("✅ Supplier health monitor started successfully")
            else:
                logger.warning("⚠️  Supplier health monitor not started (already running or disabled)")
        except Exception as e:
            logger.error(f"❌ Failed to start supplier health monitor: {e}", exc_info=True)
            logger.warning("⚠️  Continuing without supplier health monitoring")
            monitor_task = None

    # Start workflow control consumer (listens for pause/resume/cancel events)
    from app.workers.workflow_control_runner import (
        start_workflow_control_consumer,
        stop_workflow_control_consumer,
    )
    workflow_control_task = None
    try:
        workflow_control_task = start_workflow_control_consumer()
        if workflow_control_task:
            logger.info("[OK] Workflow control consumer started successfully")
        else:
            logger.warning("[WARN] Workflow control consumer not started (already running or failed)")
    except Exception as e:
        logger.error(f"[FAIL] Failed to start workflow control consumer: {e}", exc_info=True)
        logger.warning("[WARN] Continuing without workflow control consumer")
        workflow_control_task = None

    # Start unified BOM stream consumer (listens for BOM upload events from RabbitMQ Stream)
    from app.workers.unified_bom_stream_runner import (
        start_unified_bom_stream_consumer,
        stop_unified_bom_stream_consumer,
    )
    unified_bom_stream_task = None
    try:
        unified_bom_stream_task = start_unified_bom_stream_consumer()
        if unified_bom_stream_task:
            logger.info("[OK] Unified BOM stream consumer started successfully")
            logger.info("     - Consuming from: stream.platform.bom")
            logger.info("     - Events: customer.bom.uploaded, cns.bom.bulk_uploaded, bom.parsed")
            logger.info("     - Workflow: BOMUnifiedWorkflow (Temporal)")
        else:
            logger.warning("[WARN] Unified BOM stream consumer not started (already running or failed)")
    except Exception as e:
        logger.error(f"[FAIL] Failed to start unified BOM stream consumer: {e}", exc_info=True)
        logger.warning("[WARN] Continuing without unified BOM stream consumer")
        unified_bom_stream_task = None

    logger.info("CNS service started successfully")

    yield

    # Shutdown background tasks
    if monitor_task:
        await stop_supplier_health_monitor()

    if workflow_control_task:
        await stop_workflow_control_consumer()

    if unified_bom_stream_task:
        await stop_unified_bom_stream_consumer()

    # Shutdown
    logger.info("Shutting down CNS service...")

    # Shutdown observability (flush traces)
    if OBSERVABILITY_AVAILABLE:
        try:
            shutdown_observability()
            logger.info("[OK] Observability shutdown complete")
        except Exception as e:
            logger.error(f"[FAIL] Error shutting down observability: {e}")

    # Close database connections
    from app.models.base import get_database
    try:
        db = get_database()
        if db:
            db.engine.dispose()
            logger.info("✅ Database connections closed")
    except Exception as e:
        logger.error(f"❌ Error closing database: {e}")

    # Close Redis connection
    if settings.redis_enabled:
        from app.cache.redis_cache import get_cache
        try:
            cache = get_cache()
            if cache:
                cache.disconnect()
                logger.info("✅ Redis connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing Redis: {e}")

    # Disconnect Temporal client
    if settings.temporal_enabled:
        from app.core.temporal_client import get_temporal_client_manager
        try:
            manager = get_temporal_client_manager()
            if manager:
                await manager.disconnect()
                logger.info("✅ Temporal client disconnected")
        except Exception as e:
            logger.error(f"❌ Error disconnecting Temporal: {e}")

    logger.info("CNS service shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Component Normalization Service (CNS)",
    description=(
        "Dual-purpose component data normalization service for customer BOM uploads "
        "and staff catalog expansion with AI-powered quality enhancement."
    ),
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# ============================================================================
# INITIALIZE ROUTERS BEFORE MIDDLEWARE (Must happen before middleware registration)
# ============================================================================

# CRITICAL-4: Initialize Dual Database Router BEFORE middleware
if CRITICAL_4_AVAILABLE:
    try:
        init_dual_db_router()
        logger.info("✅ CRITICAL-4: Dual Database Router initialized at module level")
    except Exception as e:
        logger.error(f"❌ CRITICAL-4 router initialization failed: {e}")
        CRITICAL_4_AVAILABLE = False  # Disable middleware if router init fails

# ============================================================================
# APPLY CRITICAL FIXES MIDDLEWARE & ERROR HANDLERS
# ============================================================================

# CRITICAL-7: Setup comprehensive error handling (MUST BE FIRST)
if CRITICAL_7_AVAILABLE:
    try:
        setup_error_handling(app)
        logger.info("✅ CRITICAL-7 error handling middleware registered")
    except Exception as e:
        logger.warning(f"⚠️  CRITICAL-7 error handling failed to register: {e}")

# CRITICAL-4: Setup dual database routing middleware
if CRITICAL_4_AVAILABLE:
    try:
        create_dual_database_middleware_stack(app)
        logger.info("✅ CRITICAL-4 dual database routing middleware registered")
    except Exception as e:
        logger.warning(f"⚠️  CRITICAL-4 routing middleware failed to register: {e}")

# CRITICAL-6: Setup input validation middleware
if CRITICAL_6_AVAILABLE:
    try:
        app.add_middleware(InputValidationMiddleware)
        logger.info("✅ CRITICAL-6 input validation middleware registered")
    except Exception as e:
        logger.warning(f"⚠️  CRITICAL-6 validation middleware failed to register: {e}")

# RATE-LIMITING: Setup rate limiting middleware (BEFORE auth to limit before expensive ops)
try:
    from app.middleware.rate_limit import setup_rate_limit_middleware
    setup_rate_limit_middleware(app)
    logger.info("✅ Rate limiting middleware registered (admin tokens: 10/min, auth: 100/min)")
except ImportError as e:
    logger.warning(f"⚠️  Rate limiting middleware not available: {e}")
except Exception as e:
    logger.error(f"❌ Rate limiting middleware failed to register: {e}")

# APP-LAYER-RLS: Setup authentication middleware (auth-provider agnostic)
#
# SECURITY STRATEGY (Fail-Closed):
# - require_auth=True: All requests to non-public paths MUST have valid JWT
# - Sensitive endpoints additionally use Depends(get_auth_context) for authorization
# - Admin endpoints use @require_role(Role.ADMIN) decorator for role-based access
# - Public paths (health checks, docs) are explicitly whitelisted below
#
# This fail-closed approach ensures that:
# 1. Any endpoint missing proper auth decorators will still require authentication
# 2. New endpoints are secure by default
# 3. Authorization failures are explicit, not silent
#
try:
    from app.middleware import setup_auth_middleware
    setup_auth_middleware(
        app,
        require_auth=True,  # MANDATORY auth - fail-closed security model
        public_paths={
            "/api/health",
            "/api/docs",
            "/api/bulk/health",
            "/api/customer-upload/health",
            "/api/events/health",
            "/api/enrichment/health",  # SSE health check
            "/api/billing/plans",  # Public pricing page
            "/api/activity-log",  # Dashboard activity log (read-only)
        },
        public_prefixes=[
            "/api/docs/",
            "/openapi.json",  # OpenAPI spec
            "/api/billing/webhooks/",  # Payment webhooks (verified by signature)
            # "/api/boms/",  # DISABLED - BOMs require authentication
            # NOTE: /api/risk/ and /api/alerts require auth - removed from public
        ],
        # NOTE: /api/admin/ is NOT public - admin endpoints MUST enforce auth via @require_role
    )
    logger.info("✅ APP-LAYER-RLS: Auth middleware registered (mandatory auth mode)")
except ImportError as e:
    logger.warning(f"⚠️  APP-LAYER-RLS auth middleware not available: {e}")
except Exception as e:
    logger.error(f"❌ APP-LAYER-RLS auth middleware failed to register: {e}")

# Configure middlewares (order matters - first added = outermost layer)
# 1. CORS (outermost) - Configured for SSE/EventSource support
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Required for SSE/EventSource to read headers
)

# 2. Request Logging (logs all requests/responses with duration)
app.add_middleware(RequestLoggingMiddleware)

# 3. Correlation ID (for request tracing)
app.add_middleware(CorrelationIDMiddleware)


# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint - Service information
    """
    return {
        "service": "Component Normalization Service (CNS)",
        "version": __version__,
        "status": "running",
        "environment": settings.environment,
        "features": {
            "ai_providers": settings.get_enabled_ai_providers(),
            "tier1_suppliers": settings.get_enabled_tier1_suppliers(),
            "ai_suggestions": settings.enable_ai_suggestions,
            "multi_ai_fallback": settings.enable_multi_ai_fallback,
            "web_scraping": settings.enable_web_scraping,
            "tier2_suppliers": settings.enable_tier2_suppliers,
            "tier3_oem": settings.enable_tier3_oem,
        },
        "documentation": {
            "swagger": f"http://{settings.cns_host}:{settings.cns_port}/docs",
            "redoc": f"http://{settings.cns_host}:{settings.cns_port}/redoc",
            "openapi": f"http://{settings.cns_host}:{settings.cns_port}/openapi.json",
        }
    }


# Health check endpoint (basic)
@app.get("/health")
async def health_check():
    """
    Basic health check endpoint

    Returns service status and basic connectivity checks.
    More detailed health checks will be in app/api/health.py
    """
    return {
        "status": "healthy",
        "service": "cns",
        "version": __version__,
        "environment": settings.environment,
    }


# CRITICAL fixes status endpoint (for verification)
@app.get("/health/critical-fixes")
async def critical_fixes_status():
    """
    Check status of all CRITICAL fixes
    
    Returns:
    - CRITICAL-4: Dual database routing status
    - CRITICAL-5: Race condition prevention status
    - CRITICAL-6: Input validation status
    - CRITICAL-7: Error handling status
    """
    return {
        "status": "operational",
        "critical_fixes": {
            "CRITICAL_4_dual_database_routing": CRITICAL_4_AVAILABLE,
            "CRITICAL_5_race_condition_prevention": CRITICAL_5_AVAILABLE,
            "CRITICAL_6_input_validation": CRITICAL_6_AVAILABLE,
            "CRITICAL_7_error_handling": CRITICAL_7_AVAILABLE,
        },
        "all_active": all([
            CRITICAL_4_AVAILABLE,
            CRITICAL_5_AVAILABLE,
            CRITICAL_6_AVAILABLE,
            CRITICAL_7_AVAILABLE,
        ])
    }


# Exception handlers (comprehensive logging + standard responses)

# 1. CNS custom exceptions (ComponentNotFoundError, SupplierAPIError, etc.)
app.add_exception_handler(CNSBaseException, cns_exception_handler)

# 2. Pydantic validation errors (422 responses) - with detailed logging
from fastapi.exceptions import RequestValidationError
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# 3. FastAPI HTTPException (enhanced with logging)
app.add_exception_handler(HTTPException, http_exception_handler)

# 3. ValueError (common validation error)
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """Handle ValueError exceptions with logging"""
    log_exception(
        logger,
        "Validation error",
        exc,
        level=logging.WARNING,
        path=request.url.path,
        method=request.method
    )
    return JSONResponse(
        status_code=400,
        content={"error": "ValueError", "detail": str(exc)}
    )

# 4. Catch-all for unexpected exceptions (logs with full traceback)
app.add_exception_handler(Exception, error_handler_generic)


# Include API routers
app.include_router(api_router, prefix="/api")

# Include Prometheus metrics router (observability)
if OBSERVABILITY_AVAILABLE:
    try:
        metrics_router = get_metrics_router()
        app.include_router(metrics_router)
        logger.info("[OK] Prometheus metrics endpoint registered at /metrics")

        # Auto-instrument FastAPI for distributed tracing
        instrument_app(app)
        logger.info("[OK] FastAPI auto-instrumentation enabled (OpenTelemetry)")
    except Exception as e:
        logger.warning(f"[WARN] Failed to register metrics/instrumentation: {e}")

# Note: Additional routers for suppliers and AI will be added in future phases:
# - /api/suppliers - Supplier API integration (Tier 1-4)
# - /api/ai - AI suggestion endpoints


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.cns_host,
        port=settings.cns_port,
        reload=settings.is_development(),
        log_level=settings.log_level.lower()
    )
