"""
Temporal Workflows for BOM Enrichment

Workflows orchestrate the execution of BOM enrichment activities:
1. Quality check
2. Component matching
3. Data enrichment
4. Results writing
5. Customer notification
"""

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from typing import Dict, Any, List, Optional

from temporalio import workflow
from temporalio.common import RetryPolicy

# Import activities (will be registered in worker)
with workflow.unsafe.imports_passed_through():
    from temporal_worker.bom_activities import (
        check_bom_quality,
        match_components,
        enrich_component_data,
        write_enriched_data,
        notify_customer,
        QualityCheckResult,
        ComponentMatch,
        EnrichedData,
        WriteResult,
    )


# ============================================================================
# Workflow Input/Output Data Classes
# ============================================================================

@dataclass
class BOMEnrichmentInput:
    """Input for BOM Enrichment workflow"""
    bom_id: str
    organization_id: str
    priority: int = 5  # 1=highest, 10=lowest
    require_quality_approval: bool = True  # Require approval for quality < 70%


@dataclass
class BOMEnrichmentOutput:
    """Output from BOM Enrichment workflow"""
    success: bool
    bom_id: str
    total_items: int
    matched_items: int
    match_rate: float
    avg_confidence: float
    quality_score: int
    enrichment_time_seconds: float
    summary: str


# ============================================================================
# BOM Enrichment Workflow
# ============================================================================

@workflow.defn
class BOMEnrichmentWorkflow:
    """
    Automated BOM Enrichment Workflow

    Steps:
    1. Check BOM data quality
    2. If quality < 70%, wait for admin approval
    3. Match components against central catalog (batch processing)
    4. Enrich with specifications, pricing, lifecycle, compliance
    5. Write enriched data back to Supabase
    6. Notify customer

    Features:
    - Automatic retry with exponential backoff
    - Batch processing (100 items at a time)
    - Human-in-the-loop for low quality
    - Real-time progress tracking
    - Priority-based execution
    """

    def __init__(self) -> None:
        self._bom_id = ""
        self._quality_score = 0
        self._total_items = 0
        self._processed_items = 0
        self._admin_approval = None  # None = waiting, True = approved, False = rejected

    @workflow.run
    async def run(self, input: BOMEnrichmentInput) -> BOMEnrichmentOutput:
        """Main workflow execution"""

        self._bom_id = input.bom_id
        start_time = workflow.now()

        workflow.logger.info(
            f"Starting BOM enrichment for {input.bom_id} "
            f"(org: {input.organization_id}, priority: {input.priority})"
        )

        try:
            # ═══════════════════════════════════════════════════════════
            # STEP 1: Quality Check
            # ═══════════════════════════════════════════════════════════
            workflow.logger.info("Step 1: Checking BOM quality...")

            quality_result: QualityCheckResult = await workflow.execute_activity(
                check_bom_quality,
                input.bom_id,
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(minutes=1),
                    maximum_attempts=3,
                    backoff_coefficient=2.0
                )
            )

            self._quality_score = quality_result.score
            self._total_items = quality_result.total_items

            workflow.logger.info(
                f"Quality check complete: score={quality_result.score}, "
                f"items={quality_result.total_items}"
            )

            # If quality is low and approval required, wait for admin
            if quality_result.score < 70 and input.require_quality_approval:
                workflow.logger.warning(
                    f"Low quality score ({quality_result.score}). "
                    f"Waiting for admin approval..."
                )

                # Wait for admin signal (timeout after 24 hours)
                await workflow.wait_condition(
                    lambda: self._admin_approval is not None,
                    timeout=timedelta(hours=24)
                )

                if self._admin_approval == False:
                    workflow.logger.info("BOM enrichment rejected by admin")
                    return BOMEnrichmentOutput(
                        success=False,
                        bom_id=input.bom_id,
                        total_items=self._total_items,
                        matched_items=0,
                        match_rate=0.0,
                        avg_confidence=0.0,
                        quality_score=quality_result.score,
                        enrichment_time_seconds=0.0,
                        summary=f"Rejected due to low quality (score: {quality_result.score})"
                    )

                workflow.logger.info("BOM enrichment approved by admin")

            # ═══════════════════════════════════════════════════════════
            # STEP 2: Match Components (Batch Processing)
            # ═══════════════════════════════════════════════════════════
            workflow.logger.info(
                f"Step 2: Matching {self._total_items} components in batches..."
            )

            batch_size = 100
            all_matches: List[ComponentMatch] = []

            for batch_start in range(0, self._total_items, batch_size):
                batch_end = min(batch_start + batch_size, self._total_items)

                workflow.logger.info(
                    f"Processing batch {batch_start}-{batch_end}..."
                )

                batch_matches: List[ComponentMatch] = await workflow.execute_activity(
                    match_components,
                    args=[input.bom_id, batch_start, batch_end],
                    start_to_close_timeout=timedelta(minutes=5),
                    retry_policy=RetryPolicy(
                        initial_interval=timedelta(seconds=10),
                        maximum_interval=timedelta(minutes=2),
                        maximum_attempts=5,
                        backoff_coefficient=2.0
                    )
                )

                all_matches.extend(batch_matches)
                self._processed_items = len(all_matches)

                workflow.logger.info(
                    f"Progress: {self._processed_items}/{self._total_items} "
                    f"({self._processed_items/self._total_items*100:.1f}%)"
                )

            matched_count = len(all_matches)
            match_rate = matched_count / self._total_items if self._total_items > 0 else 0

            workflow.logger.info(
                f"Component matching complete: {matched_count}/{self._total_items} matched "
                f"({match_rate*100:.1f}%)"
            )

            # ═══════════════════════════════════════════════════════════
            # STEP 3: Enrich Component Data
            # ═══════════════════════════════════════════════════════════
            workflow.logger.info("Step 3: Enriching component data...")

            enriched_data: EnrichedData = await workflow.execute_activity(
                enrich_component_data,
                args=[input.bom_id, all_matches],
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=10),
                    maximum_interval=timedelta(minutes=2),
                    maximum_attempts=5,
                    backoff_coefficient=2.0
                )
            )

            workflow.logger.info(
                f"Enrichment complete: {len(enriched_data.items)} items enriched"
            )

            # ═══════════════════════════════════════════════════════════
            # STEP 4: Write Results to Supabase
            # ═══════════════════════════════════════════════════════════
            workflow.logger.info("Step 4: Writing enriched data to Supabase...")

            write_result: WriteResult = await workflow.execute_activity(
                write_enriched_data,
                args=[input.bom_id, enriched_data],
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(minutes=1),
                    maximum_attempts=10,  # Very important - don't lose data!
                    backoff_coefficient=2.0
                )
            )

            workflow.logger.info(
                f"Write complete: {write_result.items_updated} items updated"
            )

            # ═══════════════════════════════════════════════════════════
            # STEP 5: Notify Customer
            # ═══════════════════════════════════════════════════════════
            workflow.logger.info("Step 5: Notifying customer...")

            await workflow.execute_activity(
                notify_customer,
                args=[input.bom_id, input.organization_id, enriched_data.stats],
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(seconds=30),
                    maximum_attempts=3,
                    backoff_coefficient=2.0
                )
            )

            # ═══════════════════════════════════════════════════════════
            # SUCCESS!
            # ═══════════════════════════════════════════════════════════
            end_time = workflow.now()
            duration = (end_time - start_time).total_seconds()

            workflow.logger.info(
                f"BOM enrichment complete: {input.bom_id} "
                f"({matched_count}/{self._total_items} matched, "
                f"{duration:.1f}s)"
            )

            return BOMEnrichmentOutput(
                success=True,
                bom_id=input.bom_id,
                total_items=self._total_items,
                matched_items=matched_count,
                match_rate=match_rate,
                avg_confidence=enriched_data.stats['avg_confidence'],
                quality_score=self._quality_score,
                enrichment_time_seconds=duration,
                summary=f"Successfully enriched {matched_count}/{self._total_items} items "
                        f"({match_rate*100:.1f}% match rate)"
            )

        except Exception as e:
            workflow.logger.error(f"BOM enrichment failed: {str(e)}")

            return BOMEnrichmentOutput(
                success=False,
                bom_id=input.bom_id,
                total_items=self._total_items,
                matched_items=0,
                match_rate=0.0,
                avg_confidence=0.0,
                quality_score=self._quality_score,
                enrichment_time_seconds=0.0,
                summary=f"Enrichment failed: {str(e)}"
            )

    # ═══════════════════════════════════════════════════════════════════
    # SIGNALS - Admin Interaction
    # ═══════════════════════════════════════════════════════════════════

    @workflow.signal
    async def approve_enrichment(self):
        """Admin approves low-quality BOM for enrichment"""
        self._admin_approval = True
        workflow.logger.info(f"BOM {self._bom_id} approved by admin")

    @workflow.signal
    async def reject_enrichment(self):
        """Admin rejects low-quality BOM"""
        self._admin_approval = False
        workflow.logger.info(f"BOM {self._bom_id} rejected by admin")

    # ═══════════════════════════════════════════════════════════════════
    # QUERIES - Real-time Progress
    # ═══════════════════════════════════════════════════════════════════

    @workflow.query
    def get_progress(self) -> Dict[str, Any]:
        """Get current workflow progress"""
        return {
            "bom_id": self._bom_id,
            "total_items": self._total_items,
            "processed_items": self._processed_items,
            "progress_percent": (
                self._processed_items / self._total_items * 100
                if self._total_items > 0 else 0
            ),
            "quality_score": self._quality_score,
            "waiting_for_approval": self._admin_approval is None and self._quality_score < 70
        }

    @workflow.query
    def get_status(self) -> Dict[str, Any]:
        """Get current workflow status"""
        return {
            "bom_id": self._bom_id,
            "quality_score": self._quality_score,
            "total_items": self._total_items,
            "processed_items": self._processed_items,
            "admin_approval": self._admin_approval
        }
