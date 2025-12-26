"""
Temporal Worker for BOM Enrichment

Runs as a background process to execute Temporal workflows and activities.

Usage:
    python -m app.workers.bom_worker
"""

import asyncio
import logging
from temporalio.client import Client
from temporalio.worker import Worker

from app.workflows.bom_enrichment import (
    BOMEnrichmentWorkflow,
    BOMIngestAndEnrichWorkflow,
    BOMUnifiedWorkflow,
    bulk_prefilter_components,
    fetch_bom_line_items,
    fetch_bom_line_items_from_redis,
    enrich_component,
    update_bom_progress,
    load_enrichment_config,
    publish_enrichment_event,
    record_enrichment_audit_event,
    log_enrichment_audit_batch,
    save_bom_original_audit,
    finalize_audit_trail,
    download_parsed_snapshot,
    ingest_bom_to_supabase,
    publish_audit_ready_event,
    sync_directus_from_redis,
    get_bom_info_for_enrichment,
)
from app.workflows.risk_cache_workflow import (
    RiskCacheSyncWorkflow,
    RiskCacheMaintenanceWorkflow,
    RiskScoreEventWorkflow,
    cache_risk_score_activity,
    cache_risk_scores_batch_activity,
    sync_risk_cache_from_db_activity,
    invalidate_org_risk_cache_activity,
    get_risk_cache_stats_activity,
)
from app.workflows.bom_risk_workflow import (
    BOMRiskAnalysisWorkflow,
    get_boms_for_risk_calculation,
    calculate_bom_risk_scores,
    update_project_risk_summaries,
    publish_risk_analysis_started_event,
    publish_risk_analysis_completed_event,
    publish_risk_analysis_failed_event,
)
from app.workflows.bom_processing_workflow import (
    BOMProcessingWorkflow,
    verify_upload,
    verify_parsing,
    get_line_item_count,
    run_risk_analysis,
    save_workflow_state,
    publish_workflow_event,
)
from app.workflows.scheduled_maintenance import (
    SCHEDULED_WORKFLOWS,
    SCHEDULED_ACTIVITIES,
)
from app.config import settings

# Configure logging from environment variable (LOG_LEVEL)
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    """
    Start Temporal worker for BOM enrichment workflows.

    The worker:
    - Connects to Temporal server
    - Registers workflows and activities
    - Polls for tasks on the 'bom-enrichment' queue
    - Executes workflows in background
    """
    logger.info("🚀 Starting Temporal worker for BOM enrichment...")
    logger.info(f"Temporal Host: {settings.temporal_host}")
    logger.info(f"Task Queue: {settings.temporal_task_queue}")
    logger.info(f"Namespace: {settings.temporal_namespace}")

    # Initialize Redis connection (needed for staff bulk uploads)
    if settings.redis_enabled:
        from app.cache.redis_cache import init_cache
        try:
            cache = init_cache(settings.redis_url, default_ttl=settings.redis_cache_ttl)
            if cache.is_connected:
                logger.info(f"✅ Redis initialized: {settings.redis_url}")
            else:
                logger.warning(f"⚠️  Redis not connected: {settings.redis_url}")
        except Exception as e:
            logger.error(f"❌ Redis initialization failed: {e}")

    # Initialize database connection (needed for enrichment activities)
    from app.models.dual_database import init_dual_database
    try:
        init_dual_database()
        logger.info(f"✅ Dual database initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

    try:
        # Connect to Temporal server
        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )
        logger.info("✅ Connected to Temporal server")

        # Create worker with workflows and activities
        from temporalio.worker.workflow_sandbox import SandboxedWorkflowRunner, SandboxRestrictions

        # Configure sandbox passthrough modules to fix import restrictions
        # These modules are safe to import from workflows
        sandbox_restrictions = SandboxRestrictions.default.with_passthrough_modules(
            "http",
            "http.client",
            "urllib3",
            "urllib3.exceptions",
            "requests",
            "shared.event_bus",
            # Database modules for activities
            "sqlalchemy",
            "sqlalchemy.orm",
            "sqlalchemy.ext",
            "sqlalchemy.util",
            "redis",
            "json",
            "os",
            # App modules
            "app.models",
            "app.services",
            "app.core",
            "app.config",
        )

        worker = Worker(
            client,
            task_queue=settings.temporal_task_queue,
            workflows=[
                BOMEnrichmentWorkflow,
                BOMIngestAndEnrichWorkflow,
                BOMUnifiedWorkflow,  # Unified entry point for all BOM sources
                BOMProcessingWorkflow,  # End-to-end BOM processing workflow
                RiskCacheSyncWorkflow,
                RiskCacheMaintenanceWorkflow,
                RiskScoreEventWorkflow,
                BOMRiskAnalysisWorkflow,  # BOM risk scoring workflow
                # Scheduled maintenance workflows (trial expiration, account deletion)
                *SCHEDULED_WORKFLOWS,
            ],
            activities=[
                bulk_prefilter_components,
                fetch_bom_line_items,
                fetch_bom_line_items_from_redis,
                enrich_component,
                update_bom_progress,
                load_enrichment_config,
                publish_enrichment_event,
                record_enrichment_audit_event,
                log_enrichment_audit_batch,
                save_bom_original_audit,
                finalize_audit_trail,
                download_parsed_snapshot,
                ingest_bom_to_supabase,
                publish_audit_ready_event,
                sync_directus_from_redis,
                get_bom_info_for_enrichment,  # BOMUnifiedWorkflow activity
                # Risk cache activities
                cache_risk_score_activity,
                cache_risk_scores_batch_activity,
                sync_risk_cache_from_db_activity,
                invalidate_org_risk_cache_activity,
                get_risk_cache_stats_activity,
                # BOM risk analysis activities
                get_boms_for_risk_calculation,
                calculate_bom_risk_scores,
                update_project_risk_summaries,
                publish_risk_analysis_started_event,
                publish_risk_analysis_completed_event,
                publish_risk_analysis_failed_event,
                # BOM processing workflow activities
                verify_upload,
                verify_parsing,
                get_line_item_count,
                run_risk_analysis,
                save_workflow_state,
                publish_workflow_event,
                # Scheduled maintenance activities (trial expiration, account deletion)
                *SCHEDULED_ACTIVITIES,
            ],
            max_concurrent_workflow_tasks=10,  # Process up to 10 workflows at once
            max_concurrent_activities=20,       # Process up to 20 activities at once
            workflow_runner=SandboxedWorkflowRunner(
                restrictions=sandbox_restrictions
            )
        )

        logger.info("✅ Worker configured")
        logger.info("📋 Registered workflows:")
        logger.info("   - BOMEnrichmentWorkflow")
        logger.info("   - BOMIngestAndEnrichWorkflow")
        logger.info("   - BOMUnifiedWorkflow (Event-Driven)")
        logger.info("   - BOMProcessingWorkflow (E2E)")
        logger.info("   - RiskCacheSyncWorkflow")
        logger.info("   - RiskCacheMaintenanceWorkflow")
        logger.info("   - RiskScoreEventWorkflow")
        logger.info("   - BOMRiskAnalysisWorkflow")
        logger.info("📋 Registered activities:")
        logger.info("   - bulk_prefilter_components")
        logger.info("   - fetch_bom_line_items")
        logger.info("   - fetch_bom_line_items_from_redis")
        logger.info("   - enrich_component")
        logger.info("   - update_bom_progress")
        logger.info("   - load_enrichment_config")
        logger.info("   - publish_enrichment_event")
        logger.info("   - record_enrichment_audit_event")
        logger.info("   - log_enrichment_audit_batch")
        logger.info("   - save_bom_original_audit")
        logger.info("   - finalize_audit_trail")
        logger.info("   - download_parsed_snapshot")
        logger.info("   - ingest_bom_to_supabase")
        logger.info("   - publish_audit_ready_event")
        logger.info("   - sync_directus_from_redis")
        logger.info("   - get_bom_info_for_enrichment")
        logger.info("   - cache_risk_score_activity")
        logger.info("   - cache_risk_scores_batch_activity")
        logger.info("   - sync_risk_cache_from_db_activity")
        logger.info("   - invalidate_org_risk_cache_activity")
        logger.info("   - get_risk_cache_stats_activity")
        logger.info("   - get_boms_for_risk_calculation")
        logger.info("   - calculate_bom_risk_scores")
        logger.info("   - update_project_risk_summaries")
        logger.info("")
        logger.info("🔄 Worker started. Polling for tasks...")

        # Run worker (blocks until shutdown)
        await worker.run()

    except KeyboardInterrupt:
        logger.info("⚠️  Worker shutdown requested")
    except Exception as e:
        logger.error(f"❌ Worker error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
