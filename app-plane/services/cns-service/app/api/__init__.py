"""
API Routes for Component Normalization Service (CNS)

This package contains all FastAPI route handlers organized by resource.
"""

from fastapi import APIRouter
from app.api import health, bom, bom_workflow, bom_enrichment, catalog, queue, history, suppliers, analytics, enrichment_config, rate_limiting_config_redis, websocket, events, admin_bom, bulk_upload, bulk_enrichment, bom_line_items, customer_upload, audit, bom_snapshots, bom_ingest_status, boms_unified, files, quality_queue
from app.api import admin_lookup
from app.api import admin_data
from app.api import admin_token
from app.api import admin_directus
from app.api import supplier_responses
from app.api import audit_objects as audit_objects_module
from app.api import enrichment_stream
from app.api import activity_log
from app.api import billing
from app.api import risk
from app.api import alerts
from app.api import account
from app.api import organization_settings
from app.api import onboarding
from app.api import auth_provisioning
from app.api import organizations
from app.api import workspaces
from app.api import projects
from app.api import column_mapping_templates
from app.api import workflow_state
from app.api import component_enrichment

# CRITICAL Fixes Examples
try:
    from app.api import critical_fixes_examples
    CRITICAL_EXAMPLES_AVAILABLE = True
except ImportError:
    CRITICAL_EXAMPLES_AVAILABLE = False

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(bom.router, prefix="/bom", tags=["BOM Upload"])
api_router.include_router(bom_workflow.router, prefix="/bom/workflow", tags=["BOM Workflow"])
api_router.include_router(bom_enrichment.router, tags=["BOM Enrichment"])  # Manual enrichment control (customer BOMs)
api_router.include_router(bulk_enrichment.router, tags=["Bulk Upload Enrichment"])  # Manual enrichment control (staff bulk uploads)
api_router.include_router(bom_line_items.router, tags=["BOM Line Items"])  # BOM line item CRUD operations
api_router.include_router(admin_bom.router, tags=["Admin BOM"])  # Admin BOM management
api_router.include_router(bulk_upload.router, tags=["CNS Bulk Upload - Redis Storage"])  # CNS bulk upload with Redis
api_router.include_router(customer_upload.router, tags=["Customer Portal Upload"])  # Customer Portal file storage
api_router.include_router(bom_snapshots.router, tags=["BOM Snapshots"])  # Parsed BOM snapshots + bom.parsed events
api_router.include_router(bom_ingest_status.router, tags=["BOM Ingest Status"])  # Ingest workflow status
api_router.include_router(boms_unified.router, tags=["BOM Upload - Unified"])  # New unified BOM upload API (Option C+)
api_router.include_router(catalog.router, prefix="/catalog", tags=["Catalog"])
api_router.include_router(queue.router, prefix="/queue", tags=["Review Queue"])
api_router.include_router(history.router, prefix="/history", tags=["History"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Supplier APIs"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(enrichment_config.router, prefix="/enrichment-config", tags=["Enrichment Configuration"])
api_router.include_router(rate_limiting_config_redis.router, tags=["Rate Limiting Configuration"])
api_router.include_router(audit.router, tags=["Audit Trail"])
api_router.include_router(audit_objects_module.router, prefix="/bulk", tags=["Audit Objects"])  # Real-time audit viewing
api_router.include_router(files.router, tags=["File Downloads"])  # Generic file downloads from MinIO
api_router.include_router(admin_lookup.router, tags=["Admin Lookup"])  # /api/admin/* lookups
api_router.include_router(websocket.router, tags=["WebSocket"])
api_router.include_router(events.router, tags=["Events"])
api_router.include_router(admin_data.router, tags=["Admin Data"])  # /api/admin/* aggregated data
api_router.include_router(admin_token.router, tags=["Admin Token"])
api_router.include_router(admin_directus.router, tags=["Admin Directus"])  # Directus integration (Redis sync, promotion, audit)
api_router.include_router(supplier_responses.router)
api_router.include_router(enrichment_stream.router, tags=["Enrichment Stream"])  # SSE real-time enrichment progress
api_router.include_router(activity_log.router, tags=["Activity Log"])
api_router.include_router(billing.router, tags=["Billing"])  # Subscription & billing management
api_router.include_router(quality_queue.router)  # Quality Queue (Redis-based component review)
api_router.include_router(risk.router, tags=["Risk Analysis"])  # Component risk scoring & portfolio risk
api_router.include_router(alerts.router, tags=["Alerts"])  # Alert system, preferences, component watches
api_router.include_router(account.router, tags=["Account Management"])  # Account deletion, data export, settings
api_router.include_router(organization_settings.router, tags=["Organization Settings"])  # Organization profile & settings
api_router.include_router(onboarding.router, tags=["Onboarding"])  # User welcome & onboarding notifications
api_router.include_router(auth_provisioning.router, tags=["Auth Provisioning"])  # Auth0 user/org provisioning
api_router.include_router(organizations.router, tags=["Organizations"])  # Multi-org management (create, join, leave)
api_router.include_router(workspaces.router, tags=["Workspaces"])  # Workspace management within orgs
api_router.include_router(workspaces.invitations_router, tags=["Workspaces"])  # Workspace invitation management
api_router.include_router(projects.router, tags=["Projects"])  # Project management within workspaces
api_router.include_router(column_mapping_templates.router, tags=["Column Mapping Templates"])  # Column mapping template management
api_router.include_router(workflow_state.router, tags=["Workflow State"])  # S3-persisted workflow state for BOM upload
api_router.include_router(component_enrichment.router, tags=["Single Component Enrichment"])  # On-demand single component enrichment via Temporal

# CRITICAL Fixes Example Endpoints
if CRITICAL_EXAMPLES_AVAILABLE:
    api_router.include_router(critical_fixes_examples.router, tags=["CRITICAL Fixes Examples"])

__all__ = ["api_router"]
