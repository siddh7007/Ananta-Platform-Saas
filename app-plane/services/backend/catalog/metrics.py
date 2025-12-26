"""
Prometheus Metrics for Components Platform V2

This module defines all custom metrics for monitoring:
- Component operations
- BOM operations
- Vendor API calls
- Temporal workflows
- Subscription events
- Storage usage
"""

from prometheus_client import Counter, Histogram, Gauge, Info
import time

# =============================================================================
# COMPONENT METRICS
# =============================================================================

component_created_counter = Counter(
    'component_created_total',
    'Total components created',
    ['tenant_id', 'category', 'vendor']
)

component_updated_counter = Counter(
    'component_updated_total',
    'Total components updated',
    ['tenant_id', 'category']
)

component_search_duration = Histogram(
    'component_search_duration_seconds',
    'Component search duration',
    ['tenant_id', 'search_type'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
)

components_per_tenant_gauge = Gauge(
    'components_per_tenant',
    'Component count per tenant',
    ['organization_id']
)

# =============================================================================
# BOM METRICS
# =============================================================================

bom_created_counter = Counter(
    'bom_created_total',
    'Total BOMs created',
    ['organization_id']
)

bom_upload_duration = Histogram(
    'bom_upload_duration_seconds',
    'BOM upload processing time',
    ['tenant_id', 'file_type'],
    buckets=[1, 5, 10, 30, 60, 120, 300]
)

bom_line_items_processed = Counter(
    'bom_line_items_processed_total',
    'Total BOM line items processed',
    ['tenant_id', 'match_method']
)

# =============================================================================
# VENDOR API METRICS
# =============================================================================

vendor_api_calls_counter = Counter(
    'vendor_api_calls_total',
    'Total vendor API calls',
    ['vendor', 'endpoint', 'status']
)

vendor_api_duration = Histogram(
    'vendor_api_duration_seconds',
    'Vendor API call duration',
    ['vendor', 'endpoint'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

vendor_api_errors = Counter(
    'vendor_api_errors_total',
    'Total vendor API errors',
    ['vendor', 'error_type']
)

# =============================================================================
# TEMPORAL WORKFLOW METRICS
# =============================================================================

workflow_started_counter = Counter(
    'workflow_started_total',
    'Total workflows started',
    ['workflow_type', 'tenant_id']
)

workflow_completed_counter = Counter(
    'workflow_completed_total',
    'Total workflows completed',
    ['workflow_type', 'tenant_id', 'status']
)

workflow_duration = Histogram(
    'workflow_duration_seconds',
    'Workflow execution duration',
    ['workflow_type'],
    buckets=[1, 10, 60, 300, 600, 1800, 3600]
)

workflow_activity_retries = Counter(
    'workflow_activity_retries_total',
    'Total workflow activity retries',
    ['workflow_type', 'activity_name']
)

# =============================================================================
# AI/NORMALIZATION METRICS
# =============================================================================

ai_category_mapping_calls = Counter(
    'ai_category_mapping_calls_total',
    'Total AI category mapping calls',
    ['vendor', 'status']
)

ai_category_mapping_duration = Histogram(
    'ai_category_mapping_duration_seconds',
    'AI category mapping duration',
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0]
)

ai_category_mapping_confidence = Histogram(
    'ai_category_mapping_confidence',
    'AI category mapping confidence scores',
    ['vendor'],
    buckets=[0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0]
)

parameter_normalization_calls = Counter(
    'parameter_normalization_calls_total',
    'Total parameter normalization calls',
    ['status']
)

# =============================================================================
# SUBSCRIPTION METRICS
# =============================================================================

active_subscriptions_gauge = Gauge(
    'active_subscriptions',
    'Number of active subscriptions'
)

trial_subscriptions_gauge = Gauge(
    'trial_subscriptions',
    'Number of trial subscriptions'
)

past_due_subscriptions_gauge = Gauge(
    'past_due_subscriptions',
    'Number of past due subscriptions'
)

subscription_events_counter = Counter(
    'subscription_events_total',
    'Total subscription events',
    ['event_type']
)

# =============================================================================
# STORAGE METRICS
# =============================================================================

storage_usage_gauge = Gauge(
    'storage_usage_bytes',
    'Storage usage in bytes',
    ['tenant_id', 'storage_type']
)

datasheet_upload_duration = Histogram(
    'datasheet_upload_duration_seconds',
    'Datasheet upload duration',
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0]
)

model_3d_upload_duration = Histogram(
    'model_3d_upload_duration_seconds',
    '3D model upload duration',
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0]
)

# =============================================================================
# ALERT METRICS
# =============================================================================

alerts_created_counter = Counter(
    'alerts_created_total',
    'Total alerts created',
    ['tenant_id', 'alert_type', 'severity']
)

alerts_sent_counter = Counter(
    'alerts_sent_total',
    'Total alerts sent',
    ['channel', 'status']
)

# =============================================================================
# USER METRICS
# =============================================================================

users_per_tenant_gauge = Gauge(
    'users_per_tenant',
    'User count per tenant',
    ['organization_id']
)

login_attempts_counter = Counter(
    'login_attempts_total',
    'Total login attempts',
    ['status', 'method']
)

mfa_verifications_counter = Counter(
    'mfa_verifications_total',
    'Total MFA verifications',
    ['status']
)

# =============================================================================
# HTTP REQUEST METRICS (Django auto-instruments these, but custom ones)
# =============================================================================

api_request_duration = Histogram(
    'api_request_duration_seconds',
    'API request duration',
    ['method', 'endpoint', 'status'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
)

api_requests_counter = Counter(
    'api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def track_component_created(organization_id: str, category: str, vendor: str):
    """Track component creation"""
    component_created_counter.labels(
        tenant_id=tenant_id,
        category=category,
        vendor=vendor
    ).inc()


def track_vendor_api_call(vendor: str, endpoint: str, duration: float, status: int):
    """Track vendor API call"""
    vendor_api_calls_counter.labels(
        vendor=vendor,
        endpoint=endpoint,
        status=str(status)
    ).inc()

    vendor_api_duration.labels(
        vendor=vendor,
        endpoint=endpoint
    ).observe(duration)


def track_workflow_execution(workflow_type: str, organization_id: str, duration: float, status: str):
    """Track workflow execution"""
    workflow_completed_counter.labels(
        workflow_type=workflow_type, organization_id=tenant_id,
        status=status
    ).inc()

    workflow_duration.labels(
        workflow_type=workflow_type
    ).observe(duration)


def track_ai_category_mapping(vendor: str, duration: float, confidence: float, status: str):
    """Track AI category mapping"""
    ai_category_mapping_calls.labels(
        vendor=vendor,
        status=status
    ).inc()

    ai_category_mapping_duration.observe(duration)

    ai_category_mapping_confidence.labels(
        vendor=vendor
    ).observe(confidence)


def update_subscription_metrics():
    """
    Update subscription gauges

    This should be called periodically (every 5 minutes)
    via Temporal scheduled workflow
    """
    from catalog.models import Tenant

    active_count = Tenant.objects.filter(subscription_status='active').count()
    trial_count = Tenant.objects.filter(subscription_status='trial').count()
    past_due_count = Tenant.objects.filter(subscription_status='past_due').count()

    active_subscriptions_gauge.set(active_count)
    trial_subscriptions_gauge.set(trial_count)
    past_due_subscriptions_gauge.set(past_due_count)


def update_storage_metrics():
    """
    Update storage usage gauges

    This should be called periodically (every hour)
    via Temporal scheduled workflow
    """
    from catalog.models import Tenant
    import boto3
    from django.conf import settings

    s3_client = boto3.client(
        's3',
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
    )

    for tenant in Tenant.objects.all():
        # Calculate storage usage for tenant
        prefix = f"tenants/{tenant.id}/"
        total_size = 0

        try:
            paginator = s3_client.get_paginator('list_objects_v2')
            for page in paginator.paginate(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Prefix=prefix
            ):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        total_size += obj['Size']

            storage_usage_gauge.labels(
                tenant_id=str(tenant.id),
                storage_type='s3'
            ).set(total_size)

            # Update tenant record
            tenant.current_storage_gb = total_size / (1024 ** 3)  # Convert to GB
            tenant.save(update_fields=['current_storage_gb'])

        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(
                f"Failed to calculate storage for tenant {tenant.id}: {e}",
                extra={'tenant_id': str(tenant.id)}
            )


# Context manager for timing operations
class timer:
    """
    Context manager for timing operations

    Usage:
        with timer() as t:
            # Do something
            pass

        duration = t.duration
    """

    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.duration = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, *args):
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time
