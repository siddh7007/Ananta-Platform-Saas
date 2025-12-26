"""
Temporal Worker for AI Development Cycle

This worker connects to Temporal server and executes workflows and activities
with comprehensive structured logging and error handling.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Add parent directory to path to import catalog modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from temporalio.client import Client
from temporalio.worker import Worker

from temporal_worker.workflows import AIDevCycleWorkflow
from temporal_worker.bom_workflows import BOMEnrichmentWorkflow
from temporal_worker.test_automation_workflows import (
    TestAutomationWorkflow,
    ScheduledTestWorkflow,
    RegressionTestWorkflow
)
from temporal_worker.activities import (
    run_tests,
    analyze_failures_with_ai,
    apply_code_fixes,
    rebuild_service_container,
    send_notification,
    get_code_context,
)
from temporal_worker import bom_activities
from temporal_worker import test_automation_activities

# Import structured logging
from catalog.logging_config import get_logger

logger = get_logger(__name__)


async def main():
    """Main worker function"""

    # Get Temporal server address from environment
    temporal_host = os.getenv("TEMPORAL_HOST", "temporal")
    temporal_port = os.getenv("TEMPORAL_PORT", "7233")
    temporal_address = f"{temporal_host}:{temporal_port}"

    logger.info("Connecting to Temporal", extra={
        'temporal_host': temporal_host,
        'temporal_port': temporal_port,
        'temporal_address': temporal_address,
        'namespace': 'default'
    })

    try:
        # Connect to Temporal server
        client = await Client.connect(
            temporal_address,
            namespace="default"
        )

        logger.info("Successfully connected to Temporal", extra={
            'temporal_address': temporal_address,
            'namespace': 'default'
        })

        # Create AI Dev Cycle worker
        ai_worker = Worker(
            client,
            task_queue="ai-dev-cycle",
            workflows=[AIDevCycleWorkflow],
            activities=[
                run_tests,
                analyze_failures_with_ai,
                apply_code_fixes,
                rebuild_service_container,
                send_notification,
                get_code_context,
            ],
        )

        logger.info("AI Dev Cycle worker configured", extra={
            'task_queue': 'ai-dev-cycle',
            'workflow_count': 1,
            'activity_count': 6
        })

        # Optionally create legacy BOM Enrichment worker (deprecated)
        #
        # NOTE:
        # - The active BOM enrichment implementation now lives in the CNS
        #   service (services/cns-service) and uses the "cns-enrichment"
        #   task queue.
        # - This legacy worker used the "bom-enrichment" queue and a
        #   separate set of activities in this backend service.
        # - To avoid accidental divergence from CNS, it is disabled by
        #   default and must be explicitly enabled via environment.

        legacy_bom_enabled = os.getenv(
            "ENABLE_LEGACY_BOM_ENRICHMENT", "false"
        ).lower() == "true"

        workers = [ai_worker]

        if legacy_bom_enabled:
            bom_worker = Worker(
                client,
                task_queue="bom-enrichment",
                workflows=[BOMEnrichmentWorkflow],
                activities=[
                    bom_activities.check_bom_quality,
                    bom_activities.match_components,
                    bom_activities.enrich_component_data,
                    bom_activities.write_enriched_data,
                    bom_activities.notify_customer,
                ],
            )

            logger.info("Legacy BOM Enrichment worker configured", extra={
                'task_queue': 'bom-enrichment',
                'workflow_count': 1,
                'activity_count': 5,
                'enabled': True,
                'note': 'Deprecated; CNS service handles enrichment via cns-enrichment queue'
            })

            workers.append(bom_worker)
        else:
            logger.info(
                "Legacy BOM Enrichment worker disabled (using CNS enrichment instead)",
                extra={
                    'task_queue': 'bom-enrichment',
                    'enabled': False,
                    'note': 'Set ENABLE_LEGACY_BOM_ENRICHMENT=true to re-enable, but CNS is preferred',
                },
            )

        # Create Test Automation worker
        test_worker = Worker(
            client,
            task_queue="test-automation",
            workflows=[
                TestAutomationWorkflow,
                ScheduledTestWorkflow,
                RegressionTestWorkflow
            ],
            activities=[
                test_automation_activities.run_selenium_tests,
                test_automation_activities.analyze_test_results,
                test_automation_activities.capture_test_artifacts,
                test_automation_activities.send_test_notification,
                test_automation_activities.trigger_code_fixes,
            ],
        )

        logger.info("Test Automation worker configured", extra={
            'task_queue': 'test-automation',
            'workflow_count': 3,
            'activity_count': 5
        })

        workers.append(test_worker)

        logger.info("Starting Temporal workers", extra={
            'worker_count': len(workers),
            'task_queues': [w.task_queue for w in workers]
        })

        # Run all enabled workers concurrently
        await asyncio.gather(*(w.run() for w in workers))

    except Exception as e:
        logger.error(f"Worker failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    logger.info("Starting Temporal Workers", extra={
        'workers': ['AI Dev Cycle', 'Legacy BOM Enrichment (optional)', 'Test Automation'],
        'python_version': sys.version.split()[0],
        'working_directory': os.getcwd()
    })

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Workers stopped by user", extra={
            'shutdown_reason': 'keyboard_interrupt'
        })
    except Exception as e:
        logger.error("Workers crashed", exc_info=True, extra={
            'error_type': type(e).__name__,
            'shutdown_reason': 'unhandled_exception'
        })
        sys.exit(1)
