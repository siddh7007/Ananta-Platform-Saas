"""
CNS Service Observability Module

Provides OpenTelemetry tracing and Prometheus metrics for the CNS service.

Usage:
    from app.observability import init_observability, get_tracer, get_metrics

    # Initialize at startup (in main.py lifespan)
    init_observability(service_name="cns-service", jaeger_endpoint="http://localhost:4317")

    # Get tracer for creating spans
    tracer = get_tracer()
    with tracer.start_as_current_span("my_operation") as span:
        span.set_attribute("key", "value")
        # do work

    # Record metrics
    metrics = get_metrics()
    metrics.record_enrichment_request(duration_seconds=1.5, success=True)
"""

from .tracing import (
    init_tracing,
    get_tracer,
    shutdown_tracing,
    trace_function,
    add_span_attributes,
    instrument_app,
    instrument_sqlalchemy,
    instrument_httpx,
    create_span,
    add_span_event,
    set_span_error,
    get_current_trace_id,
    get_current_span_id,
)

from .metrics import (
    init_metrics,
    get_metrics,
    CNSMetrics,
    get_metrics_router,
    time_function,
    EnrichmentSource,
    BOMUploadType,
)


def init_observability(
    service_name: str = "cns-service",
    service_version: str = "1.0.0",
    environment: str = "development",
    jaeger_endpoint: str | None = None,
    otlp_endpoint: str | None = None,
    enable_tracing: bool = True,
    enable_metrics: bool = True,
):
    """
    Initialize all observability components (tracing + metrics).

    Args:
        service_name: Name of the service for telemetry
        service_version: Version of the service
        environment: Deployment environment (development, staging, production)
        jaeger_endpoint: Jaeger collector endpoint (e.g., "http://localhost:4317")
        otlp_endpoint: Generic OTLP endpoint (alternative to Jaeger)
        enable_tracing: Whether to enable OpenTelemetry tracing
        enable_metrics: Whether to enable Prometheus metrics
    """
    if enable_tracing:
        init_tracing(
            service_name=service_name,
            service_version=service_version,
            environment=environment,
            jaeger_endpoint=jaeger_endpoint,
            otlp_endpoint=otlp_endpoint,
        )

    if enable_metrics:
        init_metrics(
            service_name=service_name,
            service_version=service_version,
            environment=environment,
        )


def shutdown_observability():
    """Shutdown all observability components gracefully."""
    shutdown_tracing()


__all__ = [
    # Initialization
    "init_observability",
    "shutdown_observability",
    # Tracing
    "init_tracing",
    "get_tracer",
    "shutdown_tracing",
    "trace_function",
    "add_span_attributes",
    "instrument_app",
    "instrument_sqlalchemy",
    "instrument_httpx",
    "create_span",
    "add_span_event",
    "set_span_error",
    "get_current_trace_id",
    "get_current_span_id",
    # Metrics
    "init_metrics",
    "get_metrics",
    "CNSMetrics",
    "get_metrics_router",
    "time_function",
    "EnrichmentSource",
    "BOMUploadType",
]
