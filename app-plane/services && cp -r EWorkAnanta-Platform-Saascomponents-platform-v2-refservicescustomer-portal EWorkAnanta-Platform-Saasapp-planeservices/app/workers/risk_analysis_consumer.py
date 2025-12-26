"""
Risk Analysis Auto-Trigger Consumer

Listens for ``customer.bom.enrichment_completed`` events and auto-starts
risk analysis workflow for newly enriched BOMs.

Event Flow:
  BOM Enrichment → customer.bom.enrichment_completed (RabbitMQ)
  → This Consumer → BOMRiskAnalysisWorkflow

This ensures Risk Dashboard has data automatically after enrichment,
without requiring manual intervention.

Usage:
    python -m app.workers.risk_analysis_consumer
"""

import asyncio
import logging
from typing import Dict, Any, Tuple
from datetime import timedelta
from temporalio.common import WorkflowIDReusePolicy

from app.workers.base_consumer import BaseRStreamConsumer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RiskAnalysisConsumer(BaseRStreamConsumer):
    """
    RabbitMQ Streams consumer for auto-starting risk analysis workflows
    after BOM enrichment completes.

    Listens to: customer.bom.enrichment_completed
    Triggers: BOMRiskAnalysisWorkflow
    """

    def __init__(self):
        # Initialize base class with stream config
        super().__init__(
            stream='stream.platform.bom',
            consumer_name='risk-analysis-consumer',
            routing_keys='customer.bom.enrichment_completed'
        )

    async def check_auto_risk_analysis_enabled(self, organization_id: str) -> bool:
        """
        Check if organization has auto-risk-analysis enabled.

        For now, always returns True (all orgs get auto risk analysis).
        Can be extended to check organization settings if needed.

        Args:
            organization_id: Organization ID

        Returns:
            True if auto-risk-analysis should run
        """
        # Future: Check organization_settings table for auto_risk_analysis flag
        # For now, always enable auto risk analysis for all organizations
        return True

    async def check_existing_risk_scores(self, bom_id: str) -> bool:
        """
        Check if BOM already has risk scores calculated.

        Args:
            bom_id: BOM ID

        Returns:
            True if risk scores already exist
        """
        from sqlalchemy import text

        try:
            with self.get_database_session("supabase") as db:
                query = text("""
                    SELECT COUNT(*)
                    FROM bom_risk_summaries
                    WHERE bom_id = :bom_id
                """)
                result = db.execute(query, {"bom_id": bom_id})
                count = result.fetchone()[0]

                return count > 0

        except Exception as e:
            logger.warning(f"Error checking existing risk scores: {e}")
            return False  # Assume no scores, try to calculate

    async def handle_message(self, event_data: Dict[str, Any], routing_key: str, priority: int) -> Tuple[bool, str]:
        """
        Handle ``customer.bom.enrichment_completed`` event.

        Starts risk analysis workflow for the enriched BOM.

        Args:
            event_data: Event payload from RabbitMQ message
            routing_key: Message routing key
            priority: Priority level (1-9)

        Returns:
            Tuple of (success: bool, error_type: str)
            error_type: 'transient' (should requeue) or 'permanent' (should drop)
        """
        bom_id = None
        organization_id = None

        try:
            logger.info(
                f"📥 [RiskConsumer] Received enrichment_completed event "
                f"(priority={priority})"
            )

            # Extract event data
            # Note: enrichment_completed event may have job_id which is the bom_id
            bom_id = event_data.get('bom_id') or event_data.get('job_id')
            organization_id = event_data.get('organization_id')
            user_id = event_data.get('user_id')
            succeeded = event_data.get('succeeded', 0)
            failed = event_data.get('failed', 0)

            logger.info(
                f"📊 [RiskConsumer] Enrichment complete: BOM={bom_id}, "
                f"succeeded={succeeded}, failed={failed}"
            )

            if not bom_id:
                logger.error("[RiskConsumer] Invalid event data: missing bom_id/job_id")
                return (False, 'permanent')  # Malformed message, don't requeue

            # Get organization_id from database if not in event
            if not organization_id:
                from sqlalchemy import text
                with self.get_database_session("supabase") as db:
                    query = text("SELECT organization_id FROM boms WHERE id = :bom_id")
                    result = db.execute(query, {"bom_id": bom_id})
                    row = result.fetchone()
                    if row:
                        organization_id = str(row[0])

            if not organization_id:
                logger.error(f"[RiskConsumer] Cannot find organization for BOM: {bom_id}")
                return (False, 'permanent')

            # Check if auto-risk-analysis is enabled
            auto_enabled = await self.check_auto_risk_analysis_enabled(organization_id)
            if not auto_enabled:
                logger.info(
                    f"⏸️ [RiskConsumer] Auto risk analysis DISABLED for org {organization_id}"
                )
                return (True, '')  # Ack message but don't process

            # Check if risk scores already exist (avoid re-calculation)
            has_scores = await self.check_existing_risk_scores(bom_id)
            if has_scores:
                logger.info(
                    f"⏩ [RiskConsumer] Risk scores already exist for BOM {bom_id}, skipping"
                )
                return (True, '')  # Already done, acknowledge message

            # Start Risk Analysis Workflow
            logger.info(f"🚀 [RiskConsumer] Starting risk analysis for BOM {bom_id}")

            from app.workflows.bom_risk_workflow import (
                BOMRiskAnalysisWorkflow,
                BOMRiskRequest
            )
            from app.config import settings

            risk_request = BOMRiskRequest(
                organization_id=organization_id,
                bom_id=bom_id,
                force_recalculate=False,
                user_id=user_id
            )

            workflow_id = f"risk-analysis-{bom_id[:8]}"

            handle = await self.temporal_client.start_workflow(
                BOMRiskAnalysisWorkflow.run,
                risk_request,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                memo={
                    'organization_id': organization_id,
                    'bom_id': bom_id,
                    'triggered_by': 'enrichment_completed_event',
                    'auto_triggered': 'true'
                },
                id_reuse_policy=WorkflowIDReusePolicy.ALLOW_DUPLICATE,
                execution_timeout=timedelta(hours=1),
                run_timeout=timedelta(minutes=30)
            )

            logger.info(f"✅ [RiskConsumer] Risk analysis workflow started: {workflow_id}")
            logger.info(f"   Run ID: {handle.first_execution_run_id}")

            return (True, '')  # Success

        except Exception as e:
            logger.error(
                f"❌ [RiskConsumer] Error handling enrichment_completed event: {e}",
                extra={
                    'bom_id': bom_id,
                    'organization_id': organization_id,
                    'error_type': type(e).__name__,
                    'event_data': str(event_data)[:500]
                },
                exc_info=True
            )
            return (False, 'transient')  # Unknown error - retry


async def main():
    """Main entry point"""
    logger.info("🚀 [RiskConsumer] Starting Risk Analysis Consumer...")

    consumer = RiskAnalysisConsumer()

    try:
        await consumer.start()

    except KeyboardInterrupt:
        logger.info("⚠️ [RiskConsumer] Consumer shutdown requested")

    except Exception as e:
        logger.error(f"❌ [RiskConsumer] Consumer error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
