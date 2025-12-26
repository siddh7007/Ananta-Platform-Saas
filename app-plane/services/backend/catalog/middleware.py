"""
Custom middleware for Components Platform V2

Middleware:
- TenantMiddleware: Automatic tenant context injection
- LoggingMiddleware: Structured logging with trace correlation
"""

import time
import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from catalog.models import Tenant
from opentelemetry import trace

# Import structured logging
from catalog.logging_config import get_logger

logger = get_logger(__name__)


class TenantMiddleware(MiddlewareMixin):
    """
    Automatically injects tenant context into every request

    Reads tenant from:
      1. JWT token claims (tenant_id)
      2. X-Tenant-ID header (for MCP servers)
      3. Subdomain (optional: acme.components-platform.com)

    Sets:
      - request.tenant (Tenant object)
      - request._tenant_id (UUID string)
    """

    def process_request(self, request):
        # Skip for public endpoints
        public_paths = [
            '/api/v2/public/',
            '/api/v2/webhooks/',
            '/api/docker/',  # Docker management API (handles own auth)
            '/api/ai-dev/',  # AI Development Cycle API (handles own auth)
            '/api/catalog/',  # Central Catalog API (public for BOM enrichment)
            '/api/supabase/',  # Supabase health check endpoint
            '/health',  # Health check endpoint (with or without trailing slash)
            '/ready',  # Readiness probe endpoint
            '/backend/ready',  # Explicit backend readiness path when behind Traefik
            '/metrics',  # Prometheus metrics endpoint
            '/admin/',
        ]

        if any(request.path.startswith(path) for path in public_paths):
            return None

        # 1. Try JWT token
        if hasattr(request, 'user') and request.user.is_authenticated:
            if hasattr(request.user, 'tenant'):
                request.tenant = request.user.tenant
                request._tenant_id = str(request.user.tenant.id)

                logger.debug(
                    "Tenant context from JWT",
                    extra={
                        'tenant_id': request._tenant_id,
                        'user_id': str(request.user.id)
                    }
                )
                return None

        # 2. Try header (for MCP servers and internal services)
        tenant_id = request.headers.get('X-Tenant-ID')
        if tenant_id:
            try:
                request.tenant = Tenant.objects.get(id=tenant_id)
                request._tenant_id = tenant_id

                logger.debug(
                    "Tenant context from header",
                    extra={'tenant_id': tenant_id}
                )
                return None
            except Tenant.DoesNotExist:
                logger.warning(
                    "Invalid tenant ID in header",
                    extra={'tenant_id': tenant_id}
                )
                return JsonResponse(
                    {'error': 'Invalid tenant'},
                    status=403
                )

        # 3. Try subdomain (optional)
        host = request.get_host().split(':')[0]
        if '.' in host and not host.startswith('localhost'):
            subdomain = host.split('.')[0]
            try:
                request.tenant = Tenant.objects.get(slug=subdomain)
                request._tenant_id = str(request.tenant.id)

                logger.debug(
                    "Tenant context from subdomain",
                    extra={
                        'tenant_id': request._tenant_id,
                        'subdomain': subdomain
                    }
                )
                return None
            except Tenant.DoesNotExist:
                logger.warning(
                    "Invalid subdomain",
                    extra={'subdomain': subdomain}
                )

        # No tenant found
        logger.warning(
            "No tenant context found",
            extra={
                'path': request.path,
                'method': request.method
            }
        )
        return JsonResponse(
            {'error': 'Tenant context required'},
            status=403
        )


class LoggingMiddleware(MiddlewareMixin):
    """
    Structured logging for all requests

    Logs:
    - Request start/end
    - Duration
    - Status code
    - Tenant context
    - User context
    - Trace ID (from OpenTelemetry)
    """

    def process_request(self, request):
        # Record start time
        request._start_time = time.time()

        # Get trace context
        span = trace.get_current_span()
        if span:
            ctx = span.get_span_context()
            request._trace_id = format(ctx.trace_id, '032x')
            request._span_id = format(ctx.span_id, '016x')
        else:
            request._trace_id = None
            request._span_id = None

        # Log request start
        logger.info(
            "Request started",
            extra=self._get_log_context(request)
        )

    def process_response(self, request, response):
        # Calculate duration
        duration_ms = None
        if hasattr(request, '_start_time'):
            duration_ms = (time.time() - request._start_time) * 1000

        # Log request end
        log_level = logging.INFO
        if response.status_code >= 500:
            log_level = logging.ERROR
        elif response.status_code >= 400:
            log_level = logging.WARNING

        logger.log(
            log_level,
            "Request completed",
            extra={
                **self._get_log_context(request),
                'status_code': response.status_code,
                'duration_ms': duration_ms
            }
        )

        # Add trace ID to response headers (for debugging)
        if hasattr(request, '_trace_id') and request._trace_id:
            response['X-Trace-ID'] = request._trace_id

        return response

    def process_exception(self, request, exception):
        # Log exceptions
        logger.error(
            f"Request exception: {exception}",
            extra={
                **self._get_log_context(request),
                'exception': str(exception),
                'exception_type': type(exception).__name__
            },
            exc_info=True
        )

    def _get_log_context(self, request):
        """Build log context dictionary"""
        context = {
            'method': request.method,
            'path': request.path,
            'remote_addr': self._get_client_ip(request),
        }

        # Add tenant context
        if hasattr(request, '_tenant_id'):
            context['tenant_id'] = request._tenant_id

        # Add user context
        if hasattr(request, 'user') and request.user.is_authenticated:
            context['user_id'] = str(request.user.id)
            context['user_email'] = request.user.email

        # Add trace context
        if hasattr(request, '_trace_id'):
            context['trace_id'] = request._trace_id
        if hasattr(request, '_span_id'):
            context['span_id'] = request._span_id

        return context

    def _get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
