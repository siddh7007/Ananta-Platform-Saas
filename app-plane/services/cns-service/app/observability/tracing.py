"""
OpenTelemetry Tracing Module for CNS Service

Provides distributed tracing capabilities with support for:
- Jaeger exporter (via OTLP)
- Auto-instrumentation for FastAPI, SQLAlchemy, HTTPX
- W3C Trace Context propagation
- Custom span creation utilities

Environment Variables:
    OTEL_SERVICE_NAME: Service name for traces (default: cns-service)
    OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint
    JAEGER_ENDPOINT: Jaeger collector endpoint (alternative to OTLP)
    OTEL_TRACES_SAMPLER: Sampling strategy (always_on, always_off, traceidratio)
    OTEL_TRACES_SAMPLER_ARG: Sampling argument (e.g., 0.1 for 10% sampling)
"""

import logging
import functools
from typing import Callable, Any, Optional
from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider, SpanProcessor
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.trace import Tracer, Span, SpanKind, Status, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.propagate import set_global_textmap

# Optional: OTLP exporter (Jaeger compatible)
try:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    OTLP_AVAILABLE = True
except ImportError:
    OTLP_AVAILABLE = False

# Optional: Auto-instrumentation
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    FASTAPI_INSTRUMENTATION = True
except ImportError:
    FASTAPI_INSTRUMENTATION = False

try:
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    SQLALCHEMY_INSTRUMENTATION = True
except ImportError:
    SQLALCHEMY_INSTRUMENTATION = False

try:
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    HTTPX_INSTRUMENTATION = True
except ImportError:
    HTTPX_INSTRUMENTATION = False

logger = logging.getLogger(__name__)

# Global tracer instance
_tracer: Optional[Tracer] = None
_provider: Optional[TracerProvider] = None
_initialized: bool = False


def init_tracing(
    service_name: str = "cns-service",
    service_version: str = "1.0.0",
    environment: str = "development",
    jaeger_endpoint: str | None = None,
    otlp_endpoint: str | None = None,
    console_export: bool = False,
    sampling_ratio: float = 1.0,
) -> Tracer:
    """
    Initialize OpenTelemetry tracing with Jaeger/OTLP exporter.

    Args:
        service_name: Name of the service for traces
        service_version: Version string
        environment: Deployment environment
        jaeger_endpoint: Jaeger OTLP endpoint (e.g., "http://localhost:4317")
        otlp_endpoint: Generic OTLP endpoint (fallback)
        console_export: Whether to also export to console (for debugging)
        sampling_ratio: Trace sampling ratio (0.0 to 1.0)

    Returns:
        Configured Tracer instance
    """
    global _tracer, _provider, _initialized

    if _initialized:
        logger.warning("OpenTelemetry tracing already initialized")
        return _tracer

    # Create resource with service metadata
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        "deployment.environment": environment,
        "service.namespace": "app-plane",
        "telemetry.sdk.language": "python",
    })

    # Create tracer provider with sampling
    from opentelemetry.sdk.trace.sampling import TraceIdRatioBased, ParentBased

    sampler = ParentBased(root=TraceIdRatioBased(sampling_ratio))
    _provider = TracerProvider(resource=resource, sampler=sampler)

    # Add span processors (exporters)
    processors_added = []

    # OTLP exporter (sends to OTel Collector which fans out to Jaeger and X-Ray)
    endpoint = otlp_endpoint or jaeger_endpoint
    if endpoint and OTLP_AVAILABLE:
        try:
            # Use OTel Collector endpoint which handles routing to multiple backends
            # In production: sends to both Jaeger (local) and AWS X-Ray (cloud)
            # In development: sends to Jaeger only via OTel Collector
            otlp_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
            _provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
            processors_added.append(f"OTLP({endpoint})")
        except Exception as e:
            logger.warning(f"Failed to initialize OTLP exporter: {e}")

    # Console exporter (for debugging)
    if console_export or (not processors_added and environment == "development"):
        console_exporter = ConsoleSpanExporter()
        _provider.add_span_processor(BatchSpanProcessor(console_exporter))
        processors_added.append("Console")

    if not processors_added:
        logger.warning("No span exporters configured - traces will not be exported")

    # Set as global tracer provider
    trace.set_tracer_provider(_provider)

    # Set W3C Trace Context propagator for distributed tracing
    set_global_textmap(TraceContextTextMapPropagator())

    # Get tracer instance
    _tracer = trace.get_tracer(service_name, service_version)
    _initialized = True

    logger.info(f"OpenTelemetry tracing initialized: {', '.join(processors_added) or 'no exporters'}")
    logger.info(f"  Service: {service_name} v{service_version} ({environment})")
    logger.info(f"  Sampling: {sampling_ratio * 100:.0f}%")

    return _tracer


def get_tracer() -> Tracer:
    """
    Get the global tracer instance.

    Returns:
        Tracer instance (or no-op tracer if not initialized)
    """
    global _tracer
    if _tracer is None:
        # Return a no-op tracer if not initialized
        return trace.get_tracer("cns-service")
    return _tracer


def shutdown_tracing():
    """Shutdown the tracer provider gracefully."""
    global _provider, _initialized
    if _provider:
        try:
            _provider.shutdown()
            logger.info("OpenTelemetry tracing shutdown complete")
        except Exception as e:
            logger.error(f"Error shutting down tracing: {e}")
    _initialized = False


def instrument_app(app):
    """
    Auto-instrument a FastAPI application.

    Args:
        app: FastAPI application instance
    """
    if FASTAPI_INSTRUMENTATION:
        try:
            FastAPIInstrumentor.instrument_app(app)
            logger.info("FastAPI auto-instrumentation enabled")
        except Exception as e:
            logger.warning(f"Failed to instrument FastAPI: {e}")


def instrument_sqlalchemy(engine):
    """
    Auto-instrument SQLAlchemy engine.

    Args:
        engine: SQLAlchemy engine instance
    """
    if SQLALCHEMY_INSTRUMENTATION:
        try:
            SQLAlchemyInstrumentor().instrument(engine=engine)
            logger.info("SQLAlchemy auto-instrumentation enabled")
        except Exception as e:
            logger.warning(f"Failed to instrument SQLAlchemy: {e}")


def instrument_httpx():
    """Auto-instrument HTTPX client for outgoing HTTP requests."""
    if HTTPX_INSTRUMENTATION:
        try:
            HTTPXClientInstrumentor().instrument()
            logger.info("HTTPX auto-instrumentation enabled")
        except Exception as e:
            logger.warning(f"Failed to instrument HTTPX: {e}")


def trace_function(
    name: str | None = None,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes: dict | None = None,
):
    """
    Decorator to trace a function with OpenTelemetry.

    Args:
        name: Span name (defaults to function name)
        kind: Span kind (INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER)
        attributes: Static attributes to add to the span

    Example:
        @trace_function(name="process_bom", attributes={"bom.type": "customer"})
        async def process_bom(bom_id: str):
            # ...
    """
    def decorator(func: Callable) -> Callable:
        span_name = name or func.__name__

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_as_current_span(span_name, kind=kind) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_as_current_span(span_name, kind=kind) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                try:
                    result = func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


@contextmanager
def create_span(
    name: str,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes: dict | None = None,
):
    """
    Context manager for creating a traced span.

    Args:
        name: Span name
        kind: Span kind
        attributes: Attributes to add to the span

    Example:
        with create_span("enrich_component", attributes={"component.mpn": mpn}):
            # do enrichment work
    """
    tracer = get_tracer()
    with tracer.start_as_current_span(name, kind=kind) as span:
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, value)
        try:
            yield span
            span.set_status(Status(StatusCode.OK))
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            span.record_exception(e)
            raise


def add_span_attributes(attributes: dict):
    """
    Add attributes to the current span.

    Args:
        attributes: Dictionary of attributes to add

    Example:
        add_span_attributes({
            "bom.id": bom_id,
            "bom.line_count": len(lines),
            "enrichment.source": "tier1_supplier"
        })
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        for key, value in attributes.items():
            if value is not None:
                span.set_attribute(key, value)


def add_span_event(name: str, attributes: dict | None = None):
    """
    Add an event to the current span.

    Args:
        name: Event name
        attributes: Event attributes

    Example:
        add_span_event("supplier_api_call", {"supplier": "digikey", "duration_ms": 150})
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        span.add_event(name, attributes or {})


def set_span_error(error: Exception, message: str | None = None):
    """
    Mark the current span as errored.

    Args:
        error: The exception that occurred
        message: Optional error message
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        span.set_status(Status(StatusCode.ERROR, message or str(error)))
        span.record_exception(error)


def get_current_trace_id() -> str | None:
    """
    Get the current trace ID for correlation.

    Returns:
        Trace ID as hex string, or None if no active span
    """
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        return format(span.get_span_context().trace_id, '032x')
    return None


def get_current_span_id() -> str | None:
    """
    Get the current span ID for correlation.

    Returns:
        Span ID as hex string, or None if no active span
    """
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        return format(span.get_span_context().span_id, '016x')
    return None
