"""
Prometheus Metrics Module for CNS Service

Provides business and operational metrics for monitoring:
- BOM processing metrics (uploads, enrichment, processing time)
- Supplier API metrics (calls, latency, errors)
- Component matching metrics (hit rate, quality scores)
- System health metrics (active connections, queue depth)

Exposes a /metrics endpoint compatible with Prometheus scraping.

Environment Variables:
    METRICS_ENABLED: Whether metrics collection is enabled (default: true)
    METRICS_PREFIX: Prefix for all metric names (default: cns)
"""

import logging
import time
from typing import Optional, Dict, Any, Callable
from functools import wraps
from enum import Enum

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    Summary,
    CollectorRegistry,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

logger = logging.getLogger(__name__)

# Custom registry to avoid conflicts with other instrumentation
REGISTRY = CollectorRegistry()

# Metric prefix
_PREFIX = "cns"
_initialized = False
_metrics: Optional["CNSMetrics"] = None


class EnrichmentSource(str, Enum):
    """Source of component enrichment data."""
    TIER1_SUPPLIER = "tier1_supplier"
    TIER2_AGGREGATOR = "tier2_aggregator"
    TIER3_OEM = "tier3_oem"
    AI_SUGGESTION = "ai_suggestion"
    MANUAL = "manual"
    CACHE = "cache"
    CATALOG = "catalog"


class BOMUploadType(str, Enum):
    """Type of BOM upload."""
    CUSTOMER = "customer"
    STAFF_BULK = "staff_bulk"
    API = "api"


class CNSMetrics:
    """
    CNS Service Prometheus Metrics Collection.

    Provides methods to record various operational and business metrics.
    """

    def __init__(
        self,
        service_name: str = "cns-service",
        service_version: str = "1.0.0",
        environment: str = "development",
    ):
        """
        Initialize CNS metrics.

        Args:
            service_name: Name of the service
            service_version: Version of the service
            environment: Deployment environment
        """
        self.service_name = service_name
        self.service_version = service_version
        self.environment = environment

        # Service info
        self.service_info = Info(
            f"{_PREFIX}_service",
            "CNS Service information",
            registry=REGISTRY,
        )
        self.service_info.info({
            "name": service_name,
            "version": service_version,
            "environment": environment,
        })

        # ========================================
        # BOM PROCESSING METRICS
        # ========================================

        # BOM upload counter
        self.bom_uploads_total = Counter(
            f"{_PREFIX}_bom_uploads_total",
            "Total number of BOM uploads",
            labelnames=["upload_type", "status", "organization_id"],
            registry=REGISTRY,
        )

        # BOM processing duration
        self.bom_processing_duration_seconds = Histogram(
            f"{_PREFIX}_bom_processing_duration_seconds",
            "Time spent processing BOMs",
            labelnames=["upload_type", "stage"],
            buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
            registry=REGISTRY,
        )

        # BOM line items processed
        self.bom_line_items_processed_total = Counter(
            f"{_PREFIX}_bom_line_items_processed_total",
            "Total number of BOM line items processed",
            labelnames=["status"],
            registry=REGISTRY,
        )

        # Active BOM processing jobs
        self.active_bom_jobs = Gauge(
            f"{_PREFIX}_active_bom_jobs",
            "Number of currently active BOM processing jobs",
            labelnames=["stage"],
            registry=REGISTRY,
        )

        # ========================================
        # ENRICHMENT METRICS
        # ========================================

        # Enrichment requests
        self.enrichment_requests_total = Counter(
            f"{_PREFIX}_enrichment_requests_total",
            "Total number of enrichment requests",
            labelnames=["source", "status"],
            registry=REGISTRY,
        )

        # Enrichment duration
        self.enrichment_duration_seconds = Histogram(
            f"{_PREFIX}_enrichment_duration_seconds",
            "Time spent on enrichment operations",
            labelnames=["source"],
            buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
            registry=REGISTRY,
        )

        # Component match rate
        self.component_match_rate = Gauge(
            f"{_PREFIX}_component_match_rate",
            "Percentage of components successfully matched",
            labelnames=["source"],
            registry=REGISTRY,
        )

        # Quality scores
        self.quality_score_distribution = Histogram(
            f"{_PREFIX}_quality_score_distribution",
            "Distribution of component quality scores",
            labelnames=["source"],
            buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0),
            registry=REGISTRY,
        )

        # ========================================
        # SUPPLIER API METRICS
        # ========================================

        # Supplier API calls
        self.supplier_api_calls_total = Counter(
            f"{_PREFIX}_supplier_api_calls_total",
            "Total number of supplier API calls",
            labelnames=["supplier", "endpoint", "status"],
            registry=REGISTRY,
        )

        # Supplier API latency
        self.supplier_api_latency_seconds = Histogram(
            f"{_PREFIX}_supplier_api_latency_seconds",
            "Supplier API call latency",
            labelnames=["supplier", "endpoint"],
            buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
            registry=REGISTRY,
        )

        # Supplier health status
        self.supplier_health_status = Gauge(
            f"{_PREFIX}_supplier_health_status",
            "Supplier API health status (1=healthy, 0=unhealthy)",
            labelnames=["supplier"],
            registry=REGISTRY,
        )

        # Supplier rate limit remaining
        self.supplier_rate_limit_remaining = Gauge(
            f"{_PREFIX}_supplier_rate_limit_remaining",
            "Remaining API calls before rate limit",
            labelnames=["supplier"],
            registry=REGISTRY,
        )

        # ========================================
        # CACHE METRICS
        # ========================================

        # Cache operations
        self.cache_operations_total = Counter(
            f"{_PREFIX}_cache_operations_total",
            "Total cache operations",
            labelnames=["operation", "status"],
            registry=REGISTRY,
        )

        # Cache hit rate
        self.cache_hit_rate = Gauge(
            f"{_PREFIX}_cache_hit_rate",
            "Cache hit rate percentage",
            registry=REGISTRY,
        )

        # ========================================
        # WORKFLOW METRICS
        # ========================================

        # Temporal workflow executions
        self.workflow_executions_total = Counter(
            f"{_PREFIX}_workflow_executions_total",
            "Total Temporal workflow executions",
            labelnames=["workflow_type", "status"],
            registry=REGISTRY,
        )

        # Workflow duration
        self.workflow_duration_seconds = Histogram(
            f"{_PREFIX}_workflow_duration_seconds",
            "Temporal workflow execution duration",
            labelnames=["workflow_type"],
            buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0),
            registry=REGISTRY,
        )

        # ========================================
        # DATABASE METRICS
        # ========================================

        # Database connections
        self.db_connections_active = Gauge(
            f"{_PREFIX}_db_connections_active",
            "Number of active database connections",
            labelnames=["database"],
            registry=REGISTRY,
        )

        # Database query duration
        self.db_query_duration_seconds = Histogram(
            f"{_PREFIX}_db_query_duration_seconds",
            "Database query duration",
            labelnames=["database", "operation"],
            buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
            registry=REGISTRY,
        )

        # ========================================
        # HTTP METRICS
        # ========================================

        # HTTP request duration (supplement to FastAPI auto-instrumentation)
        self.http_request_duration_seconds = Histogram(
            f"{_PREFIX}_http_request_duration_seconds",
            "HTTP request duration",
            labelnames=["method", "endpoint", "status_code"],
            buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
            registry=REGISTRY,
        )

        # Concurrent requests
        self.http_concurrent_requests = Gauge(
            f"{_PREFIX}_http_concurrent_requests",
            "Number of concurrent HTTP requests",
            registry=REGISTRY,
        )

        logger.info(f"CNS metrics initialized: {_PREFIX}_* metrics available")

    # ========================================
    # RECORDING METHODS
    # ========================================

    def record_bom_upload(
        self,
        upload_type: str | BOMUploadType,
        status: str,
        organization_id: str = "unknown",
    ):
        """Record a BOM upload event."""
        if isinstance(upload_type, BOMUploadType):
            upload_type = upload_type.value
        self.bom_uploads_total.labels(
            upload_type=upload_type,
            status=status,
            organization_id=organization_id,
        ).inc()

    def record_bom_processing_time(
        self,
        duration_seconds: float,
        upload_type: str | BOMUploadType,
        stage: str = "complete",
    ):
        """Record BOM processing duration."""
        if isinstance(upload_type, BOMUploadType):
            upload_type = upload_type.value
        self.bom_processing_duration_seconds.labels(
            upload_type=upload_type,
            stage=stage,
        ).observe(duration_seconds)

    def record_line_items_processed(self, count: int, status: str = "success"):
        """Record number of line items processed."""
        self.bom_line_items_processed_total.labels(status=status).inc(count)

    def set_active_bom_jobs(self, count: int, stage: str = "processing"):
        """Set the number of active BOM processing jobs."""
        self.active_bom_jobs.labels(stage=stage).set(count)

    def record_enrichment_request(
        self,
        source: str | EnrichmentSource,
        status: str,
        duration_seconds: float | None = None,
    ):
        """Record an enrichment request."""
        if isinstance(source, EnrichmentSource):
            source = source.value
        self.enrichment_requests_total.labels(source=source, status=status).inc()
        if duration_seconds is not None:
            self.enrichment_duration_seconds.labels(source=source).observe(duration_seconds)

    def record_quality_score(self, score: float, source: str | EnrichmentSource):
        """Record a component quality score."""
        if isinstance(source, EnrichmentSource):
            source = source.value
        self.quality_score_distribution.labels(source=source).observe(score)

    def set_component_match_rate(self, rate: float, source: str | EnrichmentSource):
        """Set the component match rate (0.0 to 1.0)."""
        if isinstance(source, EnrichmentSource):
            source = source.value
        self.component_match_rate.labels(source=source).set(rate)

    def record_supplier_api_call(
        self,
        supplier: str,
        endpoint: str,
        status: str,
        duration_seconds: float | None = None,
    ):
        """Record a supplier API call."""
        self.supplier_api_calls_total.labels(
            supplier=supplier,
            endpoint=endpoint,
            status=status,
        ).inc()
        if duration_seconds is not None:
            self.supplier_api_latency_seconds.labels(
                supplier=supplier,
                endpoint=endpoint,
            ).observe(duration_seconds)

    def set_supplier_health(self, supplier: str, is_healthy: bool):
        """Set supplier health status."""
        self.supplier_health_status.labels(supplier=supplier).set(1 if is_healthy else 0)

    def set_supplier_rate_limit(self, supplier: str, remaining: int):
        """Set supplier rate limit remaining calls."""
        self.supplier_rate_limit_remaining.labels(supplier=supplier).set(remaining)

    def record_cache_operation(self, operation: str, hit: bool):
        """Record a cache operation (get/set/delete)."""
        status = "hit" if hit else "miss"
        self.cache_operations_total.labels(operation=operation, status=status).inc()

    def set_cache_hit_rate(self, rate: float):
        """Set the cache hit rate (0.0 to 1.0)."""
        self.cache_hit_rate.set(rate)

    def record_workflow_execution(
        self,
        workflow_type: str,
        status: str,
        duration_seconds: float | None = None,
    ):
        """Record a Temporal workflow execution."""
        self.workflow_executions_total.labels(
            workflow_type=workflow_type,
            status=status,
        ).inc()
        if duration_seconds is not None:
            self.workflow_duration_seconds.labels(
                workflow_type=workflow_type,
            ).observe(duration_seconds)

    def set_db_connections(self, count: int, database: str = "primary"):
        """Set the number of active database connections."""
        self.db_connections_active.labels(database=database).set(count)

    def record_db_query(
        self,
        duration_seconds: float,
        database: str = "primary",
        operation: str = "query",
    ):
        """Record a database query duration."""
        self.db_query_duration_seconds.labels(
            database=database,
            operation=operation,
        ).observe(duration_seconds)


def init_metrics(
    service_name: str = "cns-service",
    service_version: str = "1.0.0",
    environment: str = "development",
) -> CNSMetrics:
    """
    Initialize the metrics collection.

    Args:
        service_name: Name of the service
        service_version: Version of the service
        environment: Deployment environment

    Returns:
        CNSMetrics instance
    """
    global _metrics, _initialized

    if _initialized:
        logger.warning("CNS metrics already initialized")
        return _metrics

    _metrics = CNSMetrics(
        service_name=service_name,
        service_version=service_version,
        environment=environment,
    )
    _initialized = True

    return _metrics


def get_metrics() -> CNSMetrics:
    """
    Get the global metrics instance.

    Returns:
        CNSMetrics instance (creates a default one if not initialized)
    """
    global _metrics
    if _metrics is None:
        _metrics = CNSMetrics()
    return _metrics


def generate_metrics() -> bytes:
    """
    Generate Prometheus metrics output.

    Returns:
        Metrics in Prometheus text format
    """
    return generate_latest(REGISTRY)


def get_metrics_content_type() -> str:
    """Get the content type for Prometheus metrics."""
    return CONTENT_TYPE_LATEST


def get_metrics_router():
    """
    Create a FastAPI router with /metrics endpoint.

    Returns:
        FastAPI APIRouter with metrics endpoint
    """
    from fastapi import APIRouter
    from fastapi.responses import Response

    router = APIRouter()

    @router.get("/metrics", include_in_schema=False)
    async def metrics_endpoint():
        """Prometheus metrics endpoint."""
        return Response(
            content=generate_metrics(),
            media_type=get_metrics_content_type(),
        )

    return router


def time_function(
    metric_name: str = "operation",
    labels: Dict[str, str] | None = None,
):
    """
    Decorator to time a function and record to histogram.

    Args:
        metric_name: Name for the operation being timed
        labels: Additional labels for the metric

    Example:
        @time_function("enrich_component", {"source": "tier1"})
        async def enrich_component(mpn: str):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                metrics = get_metrics()
                # Record as enrichment request if applicable
                if "enrich" in metric_name.lower():
                    source = (labels or {}).get("source", "unknown")
                    metrics.record_enrichment_request(source, "success", duration)
                return result
            except Exception:
                duration = time.time() - start_time
                metrics = get_metrics()
                if "enrich" in metric_name.lower():
                    source = (labels or {}).get("source", "unknown")
                    metrics.record_enrichment_request(source, "error", duration)
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                metrics = get_metrics()
                if "enrich" in metric_name.lower():
                    source = (labels or {}).get("source", "unknown")
                    metrics.record_enrichment_request(source, "success", duration)
                return result
            except Exception:
                duration = time.time() - start_time
                metrics = get_metrics()
                if "enrich" in metric_name.lower():
                    source = (labels or {}).get("source", "unknown")
                    metrics.record_enrichment_request(source, "error", duration)
                raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
