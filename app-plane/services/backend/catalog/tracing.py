"""
OpenTelemetry + Jaeger Distributed Tracing Setup

This module sets up distributed tracing for:
- HTTP requests
- Database queries
- Temporal workflows
- Vendor API calls
- AI (Claude) API calls
- S3 operations
"""

import logging
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from django.conf import settings

logger = logging.getLogger(__name__)


def setup_tracing():
    """
    Initialize OpenTelemetry tracing with Jaeger exporter

    This function is called once during Django startup (in apps.py)
    """

    # Create resource with service name
    resource = Resource.create({
        SERVICE_NAME: settings.OTEL_SERVICE_NAME,
        "deployment.environment": settings.ENVIRONMENT if hasattr(settings, 'ENVIRONMENT') else "development",
    })

    # Create tracer provider
    provider = TracerProvider(resource=resource)

    # Configure Jaeger exporter
    jaeger_exporter = JaegerExporter(
        agent_host_name=settings.JAEGER_AGENT_HOST,
        agent_port=settings.JAEGER_AGENT_PORT,
        # Or use collector endpoint:
        # collector_endpoint=settings.JAEGER_COLLECTOR_ENDPOINT,
    )

    # Add span processor
    provider.add_span_processor(
        BatchSpanProcessor(jaeger_exporter)
    )

    # Set global tracer provider
    trace.set_tracer_provider(provider)

    # Auto-instrument Django
    DjangoInstrumentor().instrument()

    # Auto-instrument HTTP requests (vendor APIs, Claude API, etc.)
    RequestsInstrumentor().instrument()

    # Auto-instrument Redis
    try:
        RedisInstrumentor().instrument()
    except Exception as e:
        logger.warning(f"Could not instrument Redis: {e}")

    logger.info(
        "OpenTelemetry tracing initialized",
        extra={
            "service_name": settings.OTEL_SERVICE_NAME,
            "jaeger_agent": f"{settings.JAEGER_AGENT_HOST}:{settings.JAEGER_AGENT_PORT}"
        }
    )


def get_tracer(name: str):
    """
    Get a tracer instance for manual instrumentation

    Usage:
        from catalog.tracing import get_tracer

        tracer = get_tracer(__name__)

        with tracer.start_as_current_span("my_operation"):
            # Your code here
            pass
    """
    return trace.get_tracer(name)


# Convenience decorators for common patterns

def trace_function(span_name: str = None):
    """
    Decorator to automatically trace a function

    Usage:
        @trace_function("normalize_component")
        def normalize_component(mpn):
            # Function code
            pass
    """
    def decorator(func):
        import functools

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            tracer = get_tracer(func.__module__)
            name = span_name or func.__name__

            with tracer.start_as_current_span(name) as span:
                # Add function arguments as attributes (for debugging)
                span.set_attribute("function.name", func.__name__)
                span.set_attribute("function.module", func.__module__)

                try:
                    result = func(*args, **kwargs)
                    span.set_attribute("result.success", True)
                    return result
                except Exception as e:
                    span.set_attribute("result.success", False)
                    span.set_attribute("error.type", type(e).__name__)
                    span.set_attribute("error.message", str(e))
                    span.record_exception(e)
                    raise

        return wrapper
    return decorator


def add_span_attributes(**attributes):
    """
    Add attributes to the current span

    Usage:
        add_span_attributes(
            tenant_id="abc-123",
            user_id="user-456",
            component_mpn="LM358"
        )
    """
    span = trace.get_current_span()
    if span:
        for key, value in attributes.items():
            span.set_attribute(key, str(value))


def get_trace_id():
    """
    Get current trace ID as hex string

    Useful for correlating logs with traces
    """
    span = trace.get_current_span()
    if span:
        ctx = span.get_span_context()
        return format(ctx.trace_id, '032x')
    return None


def get_span_id():
    """Get current span ID as hex string"""
    span = trace.get_current_span()
    if span:
        ctx = span.get_span_context()
        return format(ctx.span_id, '016x')
    return None
