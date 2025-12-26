"""
BOM Risk Analysis Temporal Workflow

Calculates risk scores for BOM line items after enrichment.
Can be triggered:
- Manually from Risk Dashboard ("Run Risk Analysis" button)
- Via API endpoint
- For specific BOM or all BOMs in organization

Workflow Features:
- Calculates base risk scores for each enriched component
- Calculates contextual risk based on quantity and criticality
- Generates BOM health grade (A-F)
- Updates risk summaries for portfolio view
"""

import logging
import json
from datetime import timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from temporalio import workflow, activity
from temporalio.common import RetryPolicy

logger = logging.getLogger(__name__)


@dataclass
class BOMRiskRequest:
    """Request to calculate risk for a BOM or organization."""
    organization_id: str
    bom_id: Optional[str] = None  # If None, process all BOMs in org
    force_recalculate: bool = False
    user_id: Optional[str] = None


@dataclass
class BOMRiskResult:
    """Result of BOM risk calculation."""
    success: bool
    bom_id: str
    bom_name: str
    total_line_items: int
    scored_items: int
    health_grade: str
    average_risk_score: float
    error: Optional[str] = None


@dataclass
class OrganizationRiskResult:
    """Result of organization-wide risk calculation."""
    success: bool
    organization_id: str
    total_boms: int
    processed_boms: int
    failed_boms: int
    results: List[Dict[str, Any]]
    error: Optional[str] = None


# =============================================================================
# ACTIVITIES
# =============================================================================

@activity.defn
async def get_boms_for_risk_calculation(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Get BOMs that need risk calculation.

    Args:
        params: {organization_id, bom_id (optional), force_recalculate}

    Returns:
        List of BOMs with their metadata
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    org_id = params['organization_id']
    bom_id = params.get('bom_id')
    force = params.get('force_recalculate', False)

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        if bom_id:
            # Specific BOM
            sql = """
                SELECT b.id as bom_id, b.name, b.organization_id,
                       COUNT(bli.id) as total_items,
                       COUNT(CASE WHEN bli.enrichment_status = 'enriched' THEN 1 END) as enriched_items
                FROM boms b
                LEFT JOIN bom_line_items bli ON b.id = bli.bom_id
                WHERE b.id = :bom_id AND b.organization_id = :org_id
                GROUP BY b.id, b.name, b.organization_id
            """
            rows = db.execute(text(sql), {"bom_id": bom_id, "org_id": org_id}).fetchall()
        else:
            # All BOMs in organization with enriched items
            if force:
                # Include all BOMs with enriched items
                sql = """
                    SELECT b.id as bom_id, b.name, b.organization_id,
                           COUNT(bli.id) as total_items,
                           COUNT(CASE WHEN bli.enrichment_status = 'enriched' THEN 1 END) as enriched_items
                    FROM boms b
                    LEFT JOIN bom_line_items bli ON b.id = bli.bom_id
                    WHERE b.organization_id = :org_id
                    GROUP BY b.id, b.name, b.organization_id
                    HAVING COUNT(CASE WHEN bli.enrichment_status = 'enriched' THEN 1 END) > 0
                """
            else:
                # Only BOMs without existing risk summaries
                sql = """
                    SELECT b.id as bom_id, b.name, b.organization_id,
                           COUNT(bli.id) as total_items,
                           COUNT(CASE WHEN bli.enrichment_status = 'enriched' THEN 1 END) as enriched_items
                    FROM boms b
                    LEFT JOIN bom_line_items bli ON b.id = bli.bom_id
                    WHERE b.organization_id = :org_id
                    AND NOT EXISTS (
                        SELECT 1 FROM bom_risk_summaries brs WHERE brs.bom_id = b.id
                    )
                    GROUP BY b.id, b.name, b.organization_id
                    HAVING COUNT(CASE WHEN bli.enrichment_status = 'enriched' THEN 1 END) > 0
                """
            rows = db.execute(text(sql), {"org_id": org_id}).fetchall()

        boms = []
        for row in rows:
            m = row._mapping
            boms.append({
                "bom_id": str(m["bom_id"]),
                "name": m["name"],
                "organization_id": str(m["organization_id"]),
                "total_items": m["total_items"],
                "enriched_items": m["enriched_items"],
            })

        logger.info(f"[BOMRisk] Found {len(boms)} BOMs to process for org {org_id}")
        return boms

    except Exception as e:
        logger.error(f"[BOMRisk] Error getting BOMs: {e}")
        raise


@activity.defn
async def calculate_bom_risk_scores(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate risk scores for a single BOM.

    Args:
        params: {bom_id, organization_id}

    Returns:
        Result with health grade and statistics
    """
    from app.models.dual_database import get_dual_database
    from app.services.risk_calculation_service import get_risk_calculation_service
    from sqlalchemy import text

    bom_id = params['bom_id']
    org_id = params['organization_id']
    bom_name = params.get('name', f'BOM {bom_id[:8]}')

    logger.info(f"[BOMRisk] Processing BOM: {bom_name} ({bom_id})")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))
    service = get_risk_calculation_service()

    try:
        # Get enriched line items
        sql = """
            SELECT
                bli.id as line_item_id,
                bli.manufacturer_part_number as mpn,
                bli.manufacturer,
                COALESCE(bli.quantity, 1) as quantity,
                bli.lifecycle_status,
                bli.enrichment_status,
                bli.specifications,
                bli.compliance_status,
                bli.pricing,
                bli.datasheet_url
            FROM bom_line_items bli
            WHERE bli.bom_id = :bom_id
            AND bli.enrichment_status = 'enriched'
        """
        rows = db.execute(text(sql), {"bom_id": bom_id}).fetchall()

        if not rows:
            logger.warning(f"[BOMRisk] No enriched line items for BOM: {bom_id}")
            return {
                "success": False,
                "bom_id": bom_id,
                "bom_name": bom_name,
                "total_line_items": 0,
                "scored_items": 0,
                "health_grade": "F",
                "average_risk_score": 0.0,
                "error": "No enriched line items found"
            }

        # Get or create risk profile
        profile = await service.get_or_create_profile(org_id, db)

        scored = 0
        for row in rows:
            m = row._mapping
            try:
                mpn = m["mpn"] or "UNKNOWN"
                manufacturer = m["manufacturer"] or "UNKNOWN"

                # Build component data from enrichment
                specs = m.get("specifications") or {}
                if isinstance(specs, str):
                    specs = json.loads(specs)

                compliance = m.get("compliance_status") or {}
                if isinstance(compliance, str):
                    compliance = json.loads(compliance)

                component_data = {
                    "lifecycle_status": m.get("lifecycle_status"),
                    "stock_quantity": specs.get("stock_quantity"),
                    "lead_time_days": specs.get("lead_time_days"),
                    "supplier_count": specs.get("supplier_count", 1),
                    "rohs_compliant": compliance.get("rohs"),
                    "reach_compliant": compliance.get("reach"),
                    "halogen_free": compliance.get("halogen_free"),
                    "distributor_count": specs.get("distributor_count", 1),
                }

                # Calculate base risk
                base_risk = await service.calculate_component_base_risk(
                    mpn=mpn,
                    manufacturer=manufacturer,
                    component_data=component_data,
                    data_sources=["enrichment"]
                )

                # Store base risk
                base_risk_id = await service.store_component_base_risk(base_risk, db)

                # Calculate contextual risk
                line_item_risk = await service.calculate_line_item_contextual_risk(
                    bom_line_item_id=str(m["line_item_id"]),
                    organization_id=org_id,
                    base_risk=base_risk,
                    quantity=m["quantity"],
                    user_criticality=5,  # Default medium
                    db=db
                )

                # Store line item risk
                await service.store_line_item_risk(
                    line_item_risk,
                    base_risk_id=base_risk_id,
                    profile_id=profile.id,
                    db=db
                )

                scored += 1

            except Exception as e:
                logger.error(f"[BOMRisk] Error scoring line item {m['line_item_id']}: {e}")
                continue

        # Calculate and store BOM summary
        if scored > 0:
            summary = await service.calculate_bom_risk_summary(bom_id, org_id, db)
            await service.store_bom_risk_summary(summary, profile_id=profile.id, db=db)

            # Update the boms table with risk score and grade
            # Use a fresh session to avoid failed transaction issues from store_bom_risk_summary
            try:
                from app.models.dual_database import get_dual_database
                dual_db = get_dual_database()
                fresh_db_gen = dual_db.get_session("supabase")
                fresh_db = next(fresh_db_gen)
                try:
                    update_bom_query = text("""
                        UPDATE boms
                        SET risk_score = :risk_score,
                            risk_grade = :risk_grade,
                            updated_at = NOW()
                        WHERE id = :bom_id
                    """)
                    fresh_db.execute(update_bom_query, {
                        "risk_score": float(summary.average_risk_score),
                        "risk_grade": summary.health_grade,
                        "bom_id": bom_id
                    })
                    fresh_db.commit()
                    logger.info(f"[BOMRisk] Updated boms table: risk_score={summary.average_risk_score}, grade={summary.health_grade}")
                finally:
                    try:
                        next(fresh_db_gen)
                    except StopIteration:
                        pass
            except Exception as update_err:
                logger.warning(f"[BOMRisk] Failed to update boms table: {update_err}")

            logger.info(f"[BOMRisk] ✅ BOM {bom_name}: grade={summary.health_grade} avg={summary.average_risk_score}")

            return {
                "success": True,
                "bom_id": bom_id,
                "bom_name": bom_name,
                "total_line_items": len(rows),
                "scored_items": scored,
                "health_grade": summary.health_grade,
                "average_risk_score": float(summary.average_risk_score),
                "error": None
            }
        else:
            return {
                "success": False,
                "bom_id": bom_id,
                "bom_name": bom_name,
                "total_line_items": len(rows),
                "scored_items": 0,
                "health_grade": "F",
                "average_risk_score": 0.0,
                "error": "Failed to score any line items"
            }

    except Exception as e:
        logger.error(f"[BOMRisk] Error calculating risk for BOM {bom_id}: {e}")
        return {
            "success": False,
            "bom_id": bom_id,
            "bom_name": bom_name,
            "total_line_items": 0,
            "scored_items": 0,
            "health_grade": "F",
            "average_risk_score": 0.0,
            "error": str(e)
        }


@activity.defn
async def publish_risk_analysis_started_event(params: Dict[str, Any]) -> bool:
    """Publish risk_analysis_started event to RabbitMQ and database."""
    import uuid
    from datetime import datetime
    from sqlalchemy import text
    from app.models.dual_database import get_dual_database

    bom_id = params['bom_id']
    organization_id = params['organization_id']

    try:
        # 1. Publish to RabbitMQ
        from shared.event_bus import EventPublisher
        EventPublisher.customer_bom_risk_analysis_started(
            bom_id=bom_id,
            organization_id=organization_id,
            workflow_id=params['workflow_id'],
            user_id=params.get('user_id'),
            total_items=params.get('total_items', 0)
        )

        # 2. Insert into enrichment_events table for UI polling
        try:
            dual_db = get_dual_database()
            supabase_db_gen = dual_db.get_session("supabase")
            supabase_db = next(supabase_db_gen)
            try:
                insert_query = text("""
                    INSERT INTO enrichment_events (
                        event_id, event_type, routing_key, bom_id, tenant_id,
                        source, state, payload, created_at
                    ) VALUES (
                        :event_id, :event_type, :routing_key, :bom_id, :tenant_id,
                        :source, :state, :payload, :created_at
                    )
                """)
                supabase_db.execute(insert_query, {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "risk_analysis_started",
                    "routing_key": "customer.bom.risk_analysis_started",
                    "bom_id": bom_id,
                    "tenant_id": organization_id,  # Map org_id to tenant_id column
                    "source": "customer",
                    "state": json.dumps({"status": "analyzing"}),
                    "payload": json.dumps({
                        "total_items": params.get('total_items', 0),
                        "workflow_id": params['workflow_id']
                    }),
                    "created_at": datetime.utcnow().isoformat()
                })
                supabase_db.commit()
            finally:
                try:
                    next(supabase_db_gen)
                except StopIteration:
                    pass
        except Exception as db_err:
            logger.warning(f"[BOMRisk] Failed to insert risk_analysis_started to DB: {db_err}")

        logger.info(f"[BOMRisk] ✅ Published risk_analysis_started event for BOM {bom_id}")
        return True
    except Exception as e:
        logger.warning(f"[BOMRisk] Failed to publish risk_analysis_started event: {e}")
        return False


@activity.defn
async def publish_risk_analysis_completed_event(params: Dict[str, Any]) -> bool:
    """Publish risk_analysis_completed event to RabbitMQ and database."""
    import uuid
    from datetime import datetime
    from sqlalchemy import text
    from app.models.dual_database import get_dual_database

    bom_id = params['bom_id']
    organization_id = params['organization_id']
    health_grade = params['health_grade']
    average_risk_score = params['average_risk_score']
    scored_items = params['scored_items']

    try:
        # 1. Publish to RabbitMQ
        from shared.event_bus import EventPublisher
        EventPublisher.customer_bom_risk_analysis_completed(
            bom_id=bom_id,
            organization_id=organization_id,
            workflow_id=params['workflow_id'],
            health_grade=health_grade,
            average_risk_score=average_risk_score,
            total_items=params['total_items'],
            scored_items=scored_items,
            risk_distribution=params.get('risk_distribution'),
            user_id=params.get('user_id')
        )

        # 2. Insert into enrichment_events table for UI polling
        try:
            dual_db = get_dual_database()
            supabase_db_gen = dual_db.get_session("supabase")
            supabase_db = next(supabase_db_gen)
            try:
                insert_query = text("""
                    INSERT INTO enrichment_events (
                        event_id, event_type, routing_key, bom_id, tenant_id,
                        source, state, payload, created_at
                    ) VALUES (
                        :event_id, :event_type, :routing_key, :bom_id, :tenant_id,
                        :source, :state, :payload, :created_at
                    )
                """)
                supabase_db.execute(insert_query, {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "risk_analysis_completed",
                    "routing_key": "customer.bom.risk_analysis_completed",
                    "bom_id": bom_id,
                    "tenant_id": organization_id,  # Map org_id to tenant_id column
                    "source": "customer",
                    "state": json.dumps({"status": "completed"}),
                    "payload": json.dumps({
                        "risk_score": average_risk_score,
                        "health_grade": health_grade,
                        "items_analyzed": scored_items,
                        "total_items": params['total_items'],
                        "risk_distribution": params.get('risk_distribution'),
                        "workflow_id": params['workflow_id']
                    }),
                    "created_at": datetime.utcnow().isoformat()
                })
                supabase_db.commit()
            finally:
                try:
                    next(supabase_db_gen)
                except StopIteration:
                    pass
        except Exception as db_err:
            logger.warning(f"[BOMRisk] Failed to insert risk_analysis_completed to DB: {db_err}")

        # 3. Publish queue stage completion event for logging/audit
        try:
            EventPublisher.workflow_risk_analysis_stage_completed(
                bom_id=bom_id,
                organization_id=organization_id,
                user_id=params.get('user_id'),
                health_grade=health_grade,
                average_risk_score=average_risk_score,
                total_items=params['total_items'],
                scored_items=scored_items,
                risk_distribution=params.get('risk_distribution'),
                duration_ms=None  # Could calculate from start time
            )
            logger.info(f"[BOMRisk] ✅ workflow.stage.risk_analysis.completed event published")
        except Exception as stage_err:
            logger.warning(f"[BOMRisk] Failed to publish stage completion event: {stage_err}")

        logger.info(
            f"[BOMRisk] ✅ Published risk_analysis_completed event: "
            f"BOM={bom_id}, grade={health_grade}"
        )
        return True
    except Exception as e:
        logger.warning(f"[BOMRisk] Failed to publish risk_analysis_completed event: {e}")
        return False


@activity.defn
async def publish_risk_analysis_failed_event(params: Dict[str, Any]) -> bool:
    """Publish risk_analysis_failed event to RabbitMQ and database."""
    import uuid
    from datetime import datetime
    from sqlalchemy import text
    from app.models.dual_database import get_dual_database

    bom_id = params['bom_id']
    organization_id = params['organization_id']

    try:
        # 1. Publish to RabbitMQ
        from shared.event_bus import EventPublisher
        EventPublisher.customer_bom_risk_analysis_failed(
            bom_id=bom_id,
            organization_id=organization_id,
            workflow_id=params['workflow_id'],
            error_message=params['error_message'],
            error_code=params.get('error_code'),
            user_id=params.get('user_id')
        )

        # 2. Insert into enrichment_events table for UI polling
        try:
            dual_db = get_dual_database()
            supabase_db_gen = dual_db.get_session("supabase")
            supabase_db = next(supabase_db_gen)
            try:
                insert_query = text("""
                    INSERT INTO enrichment_events (
                        event_id, event_type, routing_key, bom_id, tenant_id,
                        source, state, payload, created_at
                    ) VALUES (
                        :event_id, :event_type, :routing_key, :bom_id, :tenant_id,
                        :source, :state, :payload, :created_at
                    )
                """)
                supabase_db.execute(insert_query, {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "risk_analysis_failed",
                    "routing_key": "customer.bom.risk_analysis_failed",
                    "bom_id": bom_id,
                    "tenant_id": organization_id,  # Map org_id to tenant_id column
                    "source": "customer",
                    "state": json.dumps({"status": "failed"}),
                    "payload": json.dumps({
                        "error": params['error_message'],
                        "error_code": params.get('error_code'),
                        "workflow_id": params['workflow_id']
                    }),
                    "created_at": datetime.utcnow().isoformat()
                })
                supabase_db.commit()
            finally:
                try:
                    next(supabase_db_gen)
                except StopIteration:
                    pass
        except Exception as db_err:
            logger.warning(f"[BOMRisk] Failed to insert risk_analysis_failed to DB: {db_err}")

        logger.info(f"[BOMRisk] ✅ Published risk_analysis_failed event for BOM {bom_id}")
        return True
    except Exception as e:
        logger.warning(f"[BOMRisk] Failed to publish risk_analysis_failed event: {e}")
        return False


@activity.defn
async def publish_workflow_complete_event(params: Dict[str, Any]) -> bool:
    """
    Publish workflow.stage.complete.completed event to RabbitMQ.

    This event marks the end of the entire BOM processing workflow
    (upload → parsing → enrichment → risk_analysis → complete).
    """
    bom_id = params['bom_id']
    organization_id = params['organization_id']

    try:
        from shared.event_bus import EventPublisher

        EventPublisher.workflow_processing_complete(
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=params.get('user_id'),
            total_items=params.get('total_items', 0),
            enriched_items=params.get('enriched_items', 0),
            failed_items=params.get('failed_items', 0),
            health_grade=params.get('health_grade'),
            total_duration_ms=None,  # Could calculate from workflow start
            stages_completed=['raw_upload', 'parsing', 'enrichment', 'risk_analysis', 'complete']
        )

        logger.info(f"[BOMRisk] ✅ workflow.stage.complete event published for BOM {bom_id}")
        return True

    except Exception as e:
        logger.warning(f"[BOMRisk] Failed to publish workflow complete event: {e}")
        return False


@activity.defn
async def update_project_risk_summaries(organization_id: str) -> bool:
    """
    Update project-level risk summaries after BOM risk calculation.

    Aggregates BOM risk data at project level for portfolio view.
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        # Aggregate BOM summaries by project
        sql = """
            INSERT INTO project_risk_summaries (
                project_id, organization_id, total_boms, total_line_items,
                average_bom_health_score, worst_health_grade,
                risk_distribution, calculated_at
            )
            SELECT
                b.project_id,
                b.organization_id,
                COUNT(DISTINCT brs.bom_id) as total_boms,
                SUM(brs.total_line_items) as total_line_items,
                AVG(brs.average_risk_score) as average_bom_health_score,
                MAX(brs.health_grade) as worst_health_grade,
                jsonb_build_object(
                    'low', SUM((brs.risk_distribution->>'low')::int),
                    'medium', SUM((brs.risk_distribution->>'medium')::int),
                    'high', SUM((brs.risk_distribution->>'high')::int),
                    'critical', SUM((brs.risk_distribution->>'critical')::int)
                ) as risk_distribution,
                NOW() as calculated_at
            FROM bom_risk_summaries brs
            JOIN boms b ON b.id = brs.bom_id
            WHERE b.organization_id = :org_id
            AND b.project_id IS NOT NULL
            GROUP BY b.project_id, b.organization_id
            ON CONFLICT (project_id) DO UPDATE SET
                total_boms = EXCLUDED.total_boms,
                total_line_items = EXCLUDED.total_line_items,
                average_bom_health_score = EXCLUDED.average_bom_health_score,
                worst_health_grade = EXCLUDED.worst_health_grade,
                risk_distribution = EXCLUDED.risk_distribution,
                calculated_at = EXCLUDED.calculated_at
        """

        db.execute(text(sql), {"org_id": organization_id})
        db.commit()

        logger.info(f"[BOMRisk] ✅ Project risk summaries updated for org {organization_id}")
        return True

    except Exception as e:
        logger.error(f"[BOMRisk] Error updating project summaries: {e}")
        db.rollback()
        return False


# =============================================================================
# WORKFLOW
# =============================================================================

@workflow.defn
class BOMRiskAnalysisWorkflow:
    """
    Temporal workflow to calculate risk scores for BOMs.

    Can process:
    - A single BOM (when bom_id is specified)
    - All BOMs in an organization (when bom_id is None)

    Returns detailed results for each BOM processed.
    """

    def __init__(self):
        self.results: List[Dict[str, Any]] = []
        self.processed = 0
        self.failed = 0

    @workflow.run
    async def run(self, request: BOMRiskRequest) -> Dict[str, Any]:
        """
        Execute the BOM risk analysis workflow.
        """
        workflow.logger.info(
            f"[BOMRisk] Starting risk analysis: org={request.organization_id}, "
            f"bom={request.bom_id or 'ALL'}, force={request.force_recalculate}"
        )

        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=2),
            maximum_interval=timedelta(seconds=30),
            backoff_coefficient=2.0,
            maximum_attempts=3,
        )

        # Get BOMs to process
        boms = await workflow.execute_activity(
            get_boms_for_risk_calculation,
            {
                "organization_id": request.organization_id,
                "bom_id": request.bom_id,
                "force_recalculate": request.force_recalculate,
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry_policy,
        )

        if not boms:
            workflow.logger.info("[BOMRisk] No BOMs found to process")
            return {
                "success": True,
                "organization_id": request.organization_id,
                "total_boms": 0,
                "processed_boms": 0,
                "failed_boms": 0,
                "results": [],
                "message": "No BOMs require risk analysis"
            }

        workflow.logger.info(f"[BOMRisk] Processing {len(boms)} BOMs")

        # Publish started event for each BOM
        for bom in boms:
            try:
                await workflow.execute_activity(
                    publish_risk_analysis_started_event,
                    {
                        "bom_id": bom["bom_id"],
                        "organization_id": request.organization_id,
                        "workflow_id": workflow.info().workflow_id,
                        "user_id": request.user_id,
                        "total_items": bom.get("line_count", 0),
                    },
                    start_to_close_timeout=timedelta(seconds=10),
                )
            except Exception as e:
                workflow.logger.warning(f"[BOMRisk] Failed to publish started event: {e}")

        # Process each BOM
        for bom in boms:
            try:
                result = await workflow.execute_activity(
                    calculate_bom_risk_scores,
                    {
                        "bom_id": bom["bom_id"],
                        "organization_id": request.organization_id,
                        "name": bom["name"],
                    },
                    start_to_close_timeout=timedelta(minutes=5),
                    retry_policy=retry_policy,
                )

                self.results.append(result)

                if result.get("success"):
                    self.processed += 1
                else:
                    self.failed += 1

            except Exception as e:
                workflow.logger.error(f"[BOMRisk] Failed to process BOM {bom['bom_id']}: {e}")
                self.results.append({
                    "success": False,
                    "bom_id": bom["bom_id"],
                    "bom_name": bom["name"],
                    "error": str(e)
                })
                self.failed += 1

        # Update project-level summaries
        try:
            await workflow.execute_activity(
                update_project_risk_summaries,
                request.organization_id,
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=retry_policy,
            )
        except Exception as e:
            workflow.logger.warning(f"[BOMRisk] Failed to update project summaries: {e}")

        workflow.logger.info(
            f"[BOMRisk] ✅ Complete: {self.processed} succeeded, {self.failed} failed"
        )

        # Publish completion/failure events for each processed BOM
        for result in self.results:
            try:
                if result.get("success"):
                    await workflow.execute_activity(
                        publish_risk_analysis_completed_event,
                        {
                            "bom_id": result["bom_id"],
                            "organization_id": request.organization_id,
                            "workflow_id": workflow.info().workflow_id,
                            "health_grade": result.get("health_grade", "F"),
                            "average_risk_score": result.get("average_risk_score", 0.0),
                            "total_items": result.get("total_line_items", 0),
                            "scored_items": result.get("scored_items", 0),
                            "user_id": request.user_id,
                        },
                        start_to_close_timeout=timedelta(seconds=10),
                    )
                else:
                    await workflow.execute_activity(
                        publish_risk_analysis_failed_event,
                        {
                            "bom_id": result["bom_id"],
                            "organization_id": request.organization_id,
                            "workflow_id": workflow.info().workflow_id,
                            "error_message": result.get("error", "Unknown error"),
                            "user_id": request.user_id,
                        },
                        start_to_close_timeout=timedelta(seconds=10),
                    )
            except Exception as e:
                workflow.logger.warning(f"[BOMRisk] Failed to publish event for BOM {result.get('bom_id')}: {e}")

        # Publish workflow complete event for each processed BOM
        for result in self.results:
            if result.get("success"):
                try:
                    await workflow.execute_activity(
                        publish_workflow_complete_event,
                        {
                            "bom_id": result["bom_id"],
                            "organization_id": request.organization_id,
                            "user_id": request.user_id,
                            "total_items": result.get("total_line_items", 0),
                            "enriched_items": result.get("scored_items", 0),
                            "failed_items": 0,
                            "health_grade": result.get("health_grade", "F"),
                        },
                        start_to_close_timeout=timedelta(seconds=10),
                    )
                except Exception as e:
                    workflow.logger.warning(f"[BOMRisk] Failed to publish workflow complete event: {e}")

        return {
            "success": self.failed == 0,
            "organization_id": request.organization_id,
            "total_boms": len(boms),
            "processed_boms": self.processed,
            "failed_boms": self.failed,
            "results": self.results,
        }
