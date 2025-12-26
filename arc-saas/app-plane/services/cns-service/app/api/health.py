"""
Health Check API Endpoints

Provides detailed health checks for the CNS service and its dependencies.
"""

import logging
import time
from typing import Dict, Any
from fastapi import APIRouter, status
from pydantic import BaseModel

from app.config import settings
from app import __version__

logger = logging.getLogger(__name__)

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    version: str
    environment: str
    checks: Dict[str, Dict[str, Any]]


class SimpleHealthResponse(BaseModel):
    """Simple health check response"""
    status: str
    version: str


@router.get("/", response_model=SimpleHealthResponse, status_code=status.HTTP_200_OK)
async def health_check():
    """
    Simple health check endpoint

    Returns basic service status without checking dependencies.
    Useful for load balancers and quick health checks.

    Returns:
        - status: "healthy"
        - version: Service version
    """
    return SimpleHealthResponse(
        status="healthy",
        version=__version__
    )


@router.get("/detailed", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def detailed_health_check():
    """
    Detailed health check endpoint

    Checks connectivity to all critical dependencies:
    - PostgreSQL database
    - Redis cache
    - Temporal workflow server
    - Enabled supplier APIs
    - Enabled AI providers

    Returns:
        - status: "healthy" | "degraded" | "unhealthy"
        - version: Service version
        - environment: Current environment
        - checks: Detailed status of each dependency
    """
    checks = {}
    overall_status = "healthy"
    critical_failures = []
    degraded_services = []

    # Check database connectivity
    db_health = await database_health()
    checks["database"] = db_health

    if db_health["status"] == "unhealthy":
        critical_failures.append("database")
    elif db_health["status"] == "degraded":
        degraded_services.append("database")

    # Check Redis connectivity
    redis_health_result = await redis_health()
    checks["redis"] = redis_health_result

    if redis_health_result["status"] == "unhealthy":
        degraded_services.append("redis")  # Redis is not critical, only degrades performance
    elif redis_health_result["status"] == "disabled":
        pass  # Redis disabled is OK

    # Check Temporal connectivity
    # TODO: Implement actual Temporal check (low priority - optional feature)
    if settings.temporal_enabled:
        checks["temporal"] = {
            "status": "unknown",
            "message": "Temporal check not yet implemented",
            "url": settings.temporal_url
        }
    else:
        checks["temporal"] = {
            "status": "disabled",
            "message": "Temporal is disabled in configuration",
            "url": settings.temporal_url
        }

    # Check enabled AI providers
    # TODO: Implement actual AI provider health checks
    ai_providers = settings.get_enabled_ai_providers()
    if ai_providers:
        checks["ai_providers"] = {
            "status": "unknown",
            "message": "AI provider checks not yet implemented",
            "enabled": ai_providers
        }

    # Check enabled Tier 1 suppliers
    # TODO: Implement actual supplier API health checks
    tier1_suppliers = settings.get_enabled_tier1_suppliers()
    if tier1_suppliers:
        checks["tier1_suppliers"] = {
            "status": "unknown",
            "message": "Supplier API checks not yet implemented",
            "enabled": tier1_suppliers
        }

    # Determine overall status based on checks
    if critical_failures:
        overall_status = "unhealthy"
        checks["critical_failures"] = critical_failures
    elif degraded_services:
        overall_status = "degraded"
        checks["degraded_services"] = degraded_services

    return HealthResponse(
        status=overall_status,
        version=__version__,
        environment=settings.environment,
        checks=checks
    )


@router.get("/db", status_code=status.HTTP_200_OK)
async def database_health():
    """
    Database-specific health check

    Checks:
    - Connection to PostgreSQL
    - Ability to execute simple query
    - Connection pool status

    Returns:
        - status: "healthy" | "unhealthy"
        - latency_ms: Query execution time
        - pool_size: Current pool size
        - pool_overflow: Current overflow connections
    """
    try:
        from app.models.base import get_database
        from sqlalchemy import text

        db = get_database()
        if not db:
            return {
                "status": "unhealthy",
                "message": "Database not initialized",
                "latency_ms": None,
                "pool_size": settings.database_pool_size,
                "pool_overflow": settings.database_max_overflow
            }

        # Measure query latency
        start_time = time.time()

        with db.engine.connect() as conn:
            # Execute simple query
            result = conn.execute(text("SELECT 1"))
            result.fetchone()

        latency_ms = round((time.time() - start_time) * 1000, 2)

        # Get pool stats
        pool = db.engine.pool
        pool_size = pool.size()
        checked_in = pool.checkedin()
        checked_out = pool.checkedout()

        return {
            "status": "healthy",
            "message": "Database connection successful",
            "latency_ms": latency_ms,
            "pool_size": settings.database_pool_size,
            "pool_overflow": settings.database_max_overflow,
            "connections_checked_in": checked_in,
            "connections_checked_out": checked_out,
            "total_connections": checked_in + checked_out
        }

    except Exception as e:
        logger.error(f"Database health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "message": f"Database health check failed: {str(e)}",
            "latency_ms": None,
            "pool_size": settings.database_pool_size,
            "pool_overflow": settings.database_max_overflow
        }


@router.get("/redis", status_code=status.HTTP_200_OK)
async def redis_health():
    """
    Redis-specific health check

    Checks:
    - Connection to Redis
    - Ability to SET and GET a test key
    - Memory usage

    Returns:
        - status: "healthy" | "unhealthy"
        - latency_ms: Command execution time
        - memory_used_mb: Memory usage
    """
    if not settings.redis_enabled:
        return {
            "status": "disabled",
            "message": "Redis is disabled in configuration",
            "latency_ms": None,
            "memory_used_mb": None,
            "cache_ttl": settings.redis_cache_ttl
        }

    try:
        from app.cache.redis_cache import get_cache

        cache = get_cache()
        if not cache:
            return {
                "status": "unhealthy",
                "message": "Redis cache not initialized",
                "latency_ms": None,
                "memory_used_mb": None,
                "cache_ttl": settings.redis_cache_ttl
            }

        if not cache.is_connected:
            return {
                "status": "unhealthy",
                "message": "Redis not connected",
                "latency_ms": None,
                "memory_used_mb": None,
                "cache_ttl": settings.redis_cache_ttl
            }

        # Measure latency with SET/GET test
        start_time = time.time()

        test_key = "_health_check_test"
        test_value = "health_check_value"

        # Test SET and GET
        cache.set(test_key, test_value, ttl=10)
        retrieved_value = cache.get(test_key)
        cache.delete(test_key)

        latency_ms = round((time.time() - start_time) * 1000, 2)

        # Verify SET/GET worked
        if retrieved_value != test_value:
            return {
                "status": "degraded",
                "message": "Redis SET/GET test failed",
                "latency_ms": latency_ms,
                "memory_used_mb": None,
                "cache_ttl": settings.redis_cache_ttl
            }

        # Get cache stats
        stats = cache.get_stats()
        memory_used_mb = None
        total_keys = None

        if stats and stats.get("connected"):
            memory_human = stats.get("used_memory_human", "")
            total_keys = stats.get("total_keys", 0)

            # Parse memory (e.g., "1.5M" -> 1.5)
            if memory_human:
                try:
                    if memory_human.endswith("M"):
                        memory_used_mb = float(memory_human[:-1])
                    elif memory_human.endswith("K"):
                        memory_used_mb = float(memory_human[:-1]) / 1024
                    elif memory_human.endswith("G"):
                        memory_used_mb = float(memory_human[:-1]) * 1024
                except ValueError:
                    pass

        return {
            "status": "healthy",
            "message": "Redis connection successful",
            "latency_ms": latency_ms,
            "memory_used_mb": memory_used_mb,
            "cache_ttl": settings.redis_cache_ttl,
            "total_keys": total_keys,
            "cache_url": settings.redis_url
        }

    except Exception as e:
        logger.error(f"Redis health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "message": f"Redis health check failed: {str(e)}",
            "latency_ms": None,
            "memory_used_mb": None,
            "cache_ttl": settings.redis_cache_ttl
        }


@router.get("/temporal", status_code=status.HTTP_200_OK)
async def temporal_health():
    """
    Temporal-specific health check

    Checks:
    - Connection to Temporal server
    - Worker status
    - Pending workflows

    Returns:
        - status: "healthy" | "unhealthy"
        - worker_status: "running" | "stopped"
        - pending_workflows: Number of pending workflows
    """
    # TODO: Implement actual Temporal health check
    return {
        "status": "unknown",
        "message": "Temporal health check not yet implemented",
        "worker_status": "unknown",
        "pending_workflows": None,
        "url": settings.temporal_url,
        "namespace": settings.temporal_namespace,
        "task_queue": settings.temporal_task_queue
    }


@router.get("/suppliers", status_code=status.HTTP_200_OK)
async def suppliers_health():
    """
    Supplier APIs health check

    Checks connectivity to all enabled supplier APIs:
    - Mouser
    - DigiKey
    - Element14

    Returns status for each enabled supplier
    """
    suppliers_status = {}

    enabled_suppliers = settings.get_enabled_tier1_suppliers()

    for supplier in enabled_suppliers:
        # TODO: Implement actual API health checks
        suppliers_status[supplier] = {
            "status": "unknown",
            "message": f"{supplier.title()} health check not yet implemented",
            "rate_limit_remaining": None
        }

    return {
        "status": "unknown" if enabled_suppliers else "not_applicable",
        "enabled_suppliers": enabled_suppliers,
        "suppliers": suppliers_status
    }


@router.get("/ai", status_code=status.HTTP_200_OK)
async def ai_providers_health():
    """
    AI providers health check

    Checks connectivity to all enabled AI providers:
    - Ollama
    - OpenAI
    - Claude
    - Perplexity

    Returns status for each enabled provider
    """
    ai_status = {}

    enabled_providers = settings.get_enabled_ai_providers()

    for provider in enabled_providers:
        # TODO: Implement actual AI provider health checks
        ai_status[provider] = {
            "status": "unknown",
            "message": f"{provider.title()} health check not yet implemented",
            "model": getattr(settings, f"{provider}_model", None)
        }

    return {
        "status": "unknown" if enabled_providers else "not_applicable",
        "enabled_providers": enabled_providers,
        "providers": ai_status
    }
