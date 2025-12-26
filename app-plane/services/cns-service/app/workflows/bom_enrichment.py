"""
BOM Enrichment Temporal Workflow

Handles background enrichment of BOM line items with:
- Central component catalog lookup (reuse existing enrichment)
- Supplier API calls (only for new components)
- Progress tracking
- Error handling and retries
- Rate limiting (configurable delays between API calls)

Workflow Features:
- Job ID generation for tracking
- Bulk processing (multiple files)
- Progress updates to Supabase
- Automatic catalog lookup
- Fallback to enrichment if not found
- Configurable delays to prevent API rate limiting
"""

import logging
import asyncio
import os
import subprocess
import sys
from datetime import timedelta, datetime, timezone, date
from pathlib import Path
from typing import List, Dict, Any, Optional
from temporalio import workflow, activity
from temporalio.common import RetryPolicy
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID
from shared.event_bus import EventPublisher, get_event_bus
from app.utils.activity_log import record_audit_log_entry

logger = logging.getLogger(__name__)

_CATEGORY_SNAPSHOT_FLAGS = {"1", "true", "yes", "on"}
_CATEGORY_SNAPSHOT_STATE: Dict[str, Optional[datetime]] = {
    "last_check": None,
    "last_trigger": None,
    "last_completed": None,
}


def _json_safe(value: Any) -> Any:
    """Recursively convert objects to JSON-serializable representations."""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    return value


def _serialize_component_for_json(component: Dict[str, Any]) -> Dict[str, Any]:
    """
    Serialize component data to JSON-safe format.
    """
    if component is None:
        return None
    return _json_safe(component)


def _resolve_snapshot_script_path() -> Path:
    """Resolve the category snapshot script path within the repo."""
    override = os.getenv("CATEGORY_SNAPSHOT_SCRIPT_PATH")
    if override:
        return Path(override).expanduser().resolve()

    path = Path(__file__).resolve()
    for _ in range(5):  # climb up to repo root (components-platform-v2)
        path = path.parent
    return path / "scripts" / "category_snapshot.py"


def _fetch_latest_snapshot_completed() -> Optional[datetime]:
    """Pull the latest run_completed timestamp from the audit table."""
    try:
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text

        dual_db = get_dual_database()
        session_gen = dual_db.get_session("components")
        db = next(session_gen)

        try:
            row = db.execute(
                text("""
                    SELECT run_completed
                    FROM category_snapshot_audit
                    ORDER BY run_completed DESC
                    LIMIT 1
                """),
            ).first()
        finally:
            try:
                next(session_gen)
            except StopIteration:
                pass

        if not row:
            return None

        completed_at = row[0]
        if isinstance(completed_at, datetime):
            if completed_at.tzinfo:
                return completed_at.astimezone(timezone.utc).replace(tzinfo=None)
            return completed_at
        return None
    except Exception as exc:  # pragma: no cover - best effort safety net
        logger.warning("Category snapshot audit lookup failed: %s", exc)
        return None


def _trigger_snapshot_run(reason: str) -> bool:
    """Invoke the category snapshot loader in-process via subprocess."""
    script_path = _resolve_snapshot_script_path()
    if not script_path.is_file():
        logger.warning("Category snapshot script missing: %s", script_path)
        return False

    python_exe = os.getenv("CATEGORY_SNAPSHOT_PYTHON", sys.executable)
    note = os.getenv("CATEGORY_SNAPSHOT_NOTE", "temporal auto-refresh")
    full_note = f"{note} ({reason})"
    json_path = os.getenv("CATEGORY_SNAPSHOT_JSON_PATH")

    cmd = [python_exe, str(script_path), "--note", full_note]
    if json_path:
        cmd.extend(["--json-path", json_path])

    env = os.environ.copy()
    # Ensure the loader has database credentials even if only COMPONENTS_* vars exist
    env.setdefault("DB_HOST", env.get("COMPONENTS_DB_HOST", env.get("DB_HOST", "localhost")))
    env.setdefault("DB_PORT", env.get("COMPONENTS_DB_PORT", env.get("DB_PORT", "5432")))
    env.setdefault("DB_NAME", env.get("COMPONENTS_DB_NAME", env.get("DB_NAME", "components_v2")))
    env.setdefault("DB_USER", env.get("COMPONENTS_DB_USER", env.get("DB_USER", "postgres")))
    env.setdefault("DB_PASSWORD", env.get("COMPONENTS_DB_PASSWORD", env.get("DB_PASSWORD", "postgres")))

    try:
        completed = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            cwd=str(script_path.parent),
            env=env,
        )
        stdout_tail = "\n".join(completed.stdout.splitlines()[-3:]) if completed.stdout else ""
        if stdout_tail:
            logger.info("Category snapshot refreshed (%s): %s", reason, stdout_tail)
        else:
            logger.info("Category snapshot refreshed (%s)", reason)
        return True
    except subprocess.CalledProcessError as exc:
        logger.warning(
            "Category snapshot refresh failed (exit %s): %s",
            exc.returncode,
            exc.stderr or exc.stdout,
        )
        return False
    except Exception as exc:  # pragma: no cover - subprocess errors
        logger.warning("Category snapshot refresh errored: %s", exc, exc_info=True)
        return False


def _maybe_refresh_category_snapshot(reason: str = "enrichment-workflow") -> Dict[str, Any]:
    """Ensure the category snapshot is fresh before enrichment steps."""
    enabled = os.getenv("CATEGORY_SNAPSHOT_AUTO_REFRESH", "1").strip().lower() in _CATEGORY_SNAPSHOT_FLAGS
    if not enabled:
        return {"status": "disabled"}

    now = datetime.utcnow()
    check_interval = int(os.getenv("CATEGORY_SNAPSHOT_CHECK_INTERVAL_MINUTES", "30"))
    last_check = _CATEGORY_SNAPSHOT_STATE.get("last_check")
    if last_check and (now - last_check) < timedelta(minutes=check_interval):
        return {
            "status": "recent-check",
            "last_check": last_check.isoformat(),
        }

    _CATEGORY_SNAPSHOT_STATE["last_check"] = now

    max_staleness = int(os.getenv("CATEGORY_SNAPSHOT_MAX_STALENESS_MINUTES", "1440"))
    last_completed = _fetch_latest_snapshot_completed()
    if last_completed:
        _CATEGORY_SNAPSHOT_STATE["last_completed"] = last_completed

    if last_completed and (now - last_completed) < timedelta(minutes=max_staleness):
        return {
            "status": "fresh",
            "last_completed": last_completed.isoformat(),
        }

    if not _trigger_snapshot_run(reason):
        return {"status": "failed"}

    _CATEGORY_SNAPSHOT_STATE["last_trigger"] = now
    refreshed = _fetch_latest_snapshot_completed()
    if refreshed:
        _CATEGORY_SNAPSHOT_STATE["last_completed"] = refreshed
    # Optionally run in-container gap report generator after a successful snapshot
    generate_gap = os.getenv("CATEGORY_SNAPSHOT_GENERATE_GAP_REPORT", "1").strip().lower() in _CATEGORY_SNAPSHOT_FLAGS
    if generate_gap:
        try:
            report_output = os.getenv("CATEGORY_GAP_REPORT_OUTPUT", "docs/data-processing/normalizer_mapping_gap_report.csv")
            ok = _trigger_gap_report_run(report_output)
            if ok:
                logger.info("Gap report generated and written to %s", report_output)
            else:
                logger.warning("Gap report generation failed or skipped")
        except Exception as exc:
            logger.warning("Gap report generation errored: %s", exc, exc_info=True)
        # If report generated, publish an event if gaps exist and notification enabled
        notify = os.getenv("CATEGORY_GAP_REPORT_NOTIFY", "1").strip().lower() in _CATEGORY_SNAPSHOT_FLAGS
        if ok and notify:
            try:
                _publish_gap_report_event(report_output)
            except Exception as exc:
                logger.warning("Gap report notification errored: %s", exc, exc_info=True)

    return {
        "status": "refreshed",
        "last_completed": refreshed.isoformat() if refreshed else None,
    }


def _resolve_gap_report_script_path() -> Path:
    """Resolve the generate_mapping_gap_report script path within the repo."""
    override = os.getenv("CATEGORY_GAP_REPORT_SCRIPT_PATH")
    if override:
        return Path(override).expanduser().resolve()

    path = Path(__file__).resolve()
    for _ in range(5):
        path = path.parent
    return path / "scripts" / "generate_mapping_gap_report.py"


def _trigger_gap_report_run(output_path: Optional[str] = None) -> bool:
    """Invoke the gap report generator in-process via subprocess."""
    script_path = _resolve_gap_report_script_path()
    if not script_path.is_file():
        logger.warning("Gap report script missing: %s", script_path)
        return False

    python_exe = os.getenv("CATEGORY_SNAPSHOT_PYTHON", sys.executable)
    output_arg = output_path or os.getenv("CATEGORY_GAP_REPORT_OUTPUT", "docs/data-processing/normalizer_mapping_gap_report.csv")

    cmd = [python_exe, str(script_path), "--output", output_arg]

    env = os.environ.copy()
    env.setdefault("DB_HOST", env.get("COMPONENTS_DB_HOST", env.get("DB_HOST", "localhost")))
    env.setdefault("DB_PORT", env.get("COMPONENTS_DB_PORT", env.get("DB_PORT", "5432")))
    env.setdefault("DB_NAME", env.get("COMPONENTS_DB_NAME", env.get("DB_NAME", "components_v2")))
    env.setdefault("DB_USER", env.get("COMPONENTS_DB_USER", env.get("DB_USER", "postgres")))
    env.setdefault("DB_PASSWORD", env.get("COMPONENTS_DB_PASSWORD", env.get("DB_PASSWORD", "postgres")))

    try:
        completed = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            cwd=str(script_path.parent),
            env=env,
        )
        stdout_tail = "\n".join(completed.stdout.splitlines()[-3:]) if completed.stdout else ""
        if stdout_tail:
            logger.info("Gap report generated: %s", stdout_tail)
        else:
            logger.info("Gap report generated")
        return True
    except subprocess.CalledProcessError as exc:
        logger.warning(
            "Gap report generation failed (exit %s): %s",
            exc.returncode,
            exc.stderr or exc.stdout,
        )
        return False


def _publish_gap_report_event(report_path: str) -> bool:
    """Read CSV, publish an event if gaps are found. Returns True if event was published or no gap rows were found.

    Event: 'admin.category.mapping_gap' with payload {rows_count, report_path, sample_rows}
    """
    try:
        EventPublisher  # ensure imported
    except Exception:
        logger.warning("EventPublisher unavailable; skipping gap report event publish")
        return False

    try:
        import csv
        from pathlib import Path
        p = Path(report_path)
        if not p.exists():
            logger.warning("Gap report not found at %s; skipping event publish", report_path)
            return False

        rows = []
        with p.open('r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, start=1):
                if i <= int(os.getenv('CATEGORY_GAP_REPORT_SAMPLE_ROWS', '5')):
                    rows.append({
                        'source_id': row.get('source_id'),
                        'source_path': row.get('source_path'),
                        'gap_reason': row.get('gap_reason'),
                    })
        rows_count = len(list(csv.DictReader(p.open('r', encoding='utf-8'))))
        if rows_count == 0:
            logger.info("No mapping gaps found; skipping event publish")
            return True

        EventPublisher.admin_workflow_paused(  # reuse high-priority workflow event as a placeholder
            workflow_id='mapping-gap-check',
            job_id=None,
            admin_user_id='system',
            reason=f"Detected {rows_count} mapping gaps; report_path={report_path}",
        )
        # publish a dedicated event for gap report as well
        try:
            event_bus = get_event_bus()
            event_bus.publish(
                'admin.category.mapping_gap',
                {
                    'rows_count': rows_count,
                    'report_path': report_path,
                    'sample_rows': rows,
                },
                event_type='admin.category.mapping_gap',
                priority=8,
            )
        except Exception:
            logger.warning('Failed to publish admin.category.mapping_gap event (continuing)')
        # Persist to audit_logs so UI can display as part of admin event logs
        try:
            from app.models.dual_database import get_dual_database
            dual_db = get_dual_database()
            session_gen = dual_db.get_session('supabase')
            db = next(session_gen)
            try:
                record_audit_log_entry(
                    db,
                    event_type='admin.category.mapping_gap',
                    routing_key='admin.category.mapping_gap',
                    organization_id='system',
                    user_id='system',
                    username='system',
                    source='cns-service',
                    event_data={
                        'rows_count': rows_count,
                        'report_path': report_path,
                        'sample_rows': rows,
                    }
                )
                db.commit()
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
            finally:
                try:
                    next(session_gen)
                except StopIteration:
                    pass
        except Exception:
            logger.warning('Failed to write mapping gap audit log (continuing)')
        # Insert an alert row per organization so staff see mapping gaps in Alerts
        try:
            import json
            from sqlalchemy import text
            from app.models.dual_database import get_dual_database

            dual_db = get_dual_database()
            session_gen = dual_db.get_session('supabase')
            db = next(session_gen)
            try:
                # Fetch all organization ids
                orgs = db.execute(text("SELECT id FROM organizations")).fetchall()
                title = f"Mapping Gap Report: {rows_count} gaps detected"
                message = f"Mapping gaps detected ({rows_count} rows). Review the mapping gap CSV or open the Workflows monitor."
                context_json = {
                    'rows_count': rows_count,
                    'report_path': report_path,
                    'sample_rows': rows,
                }
                action_url = '/admin/workflows'
                for org_row in orgs:
                    org_id = org_row[0]
                    try:
                        db.execute(
                            text(
                                """
                                INSERT INTO alerts (
                                    organization_id,
                                    severity,
                                    alert_type,
                                    title,
                                    message,
                                    context,
                                    action_url
                                ) VALUES (
                                    :org_id,
                                    :severity,
                                    :alert_type,
                                    :title,
                                    :message,
                                    CAST(:context_json AS jsonb),
                                    :action_url
                                )
                                """
                            ),
                            {
                                'org_id': org_id,
                                'severity': 'HIGH',
                                'alert_type': 'COMPLIANCE',
                                'title': title,
                                'message': message,
                                'context_json': json.dumps(context_json),
                                'action_url': action_url,
                            },
                        )
                    except Exception:
                        logger.warning('Failed to insert alert for org %s (continuing)', org_id)
                db.commit()
            finally:
                try:
                    next(session_gen)
                except StopIteration:
                    pass
        except Exception:
            logger.warning('Failed to create mapping gap alerts (continuing)')
        logger.info('Published mapping gap report event (%s rows)', rows_count)
        return True
    except Exception as exc:
        logger.warning('Failed to parse or publish gap report: %s', exc, exc_info=True)
        return False


def _make_json_serializable(obj: Any) -> Any:
    """
    Recursively convert non-JSON-serializable objects to serializable types.

    Handles:
    - Decimal → float
    - UUID → str
    - datetime → ISO string
    - dict → recursively process values
    - list → recursively process items

    Args:
        obj: Object to convert

    Returns:
        JSON-serializable version of the object
    """
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: _make_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_make_json_serializable(item) for item in obj]
    else:
        return obj


@dataclass
class BOMEnrichmentRequest:
    """Request to enrich a BOM"""
    job_id: str
    bom_id: str
    organization_id: str  # Multi-tenant identifier (not tenant_id)
    project_id: Optional[str]
    total_items: int
    bom_name: Optional[str] = None
    source: str = 'customer'  # 'customer' or 'staff'
    priority: str = 'normal'  # 'normal' or 'high'
    user_id: Optional[str] = None
    workflow_id: Optional[str] = None


@dataclass
class ComponentEnrichmentTask:
    """Single component enrichment task"""
    line_item_id: str
    mpn: str
    manufacturer: str
    quantity: int
    bom_id: str
    organization_id: str  # Multi-tenant identifier
    source: str  # 'customer' or 'staff'
    reference_designator: Optional[str] = None
    line_number: Optional[int] = None


@dataclass
class EnrichmentProgress:
    """Progress tracking"""
    total_items: int
    enriched_items: int
    failed_items: int
    pending_items: int
    percent_complete: float


@workflow.defn
class BOMEnrichmentWorkflow:
    """
    Temporal workflow for BOM enrichment.

    Features:
    - Background processing (non-blocking)
    - Progress tracking (real-time updates)
    - Error handling (retries with exponential backoff)
    - Catalog lookup (reuse existing components)
    - Bulk processing (process all line items)

    Can be used in two ways:
    1. Standalone workflow - Direct enrichment of a BOM
    2. Child workflow - Called by BOMProcessingWorkflow during its enrichment stage

    Usage as standalone:
        # Start workflow
        from app.config import settings
        client = await get_temporal_client()
        handle = await client.start_workflow(
            BOMEnrichmentWorkflow.run,
            request,
            id=f"bom-enrichment-{job_id}",
            task_queue=settings.temporal_task_queue
        )

        # Query progress
        progress = await handle.query(BOMEnrichmentWorkflow.get_progress)

    Usage as child workflow:
        # From within BOMProcessingWorkflow
        enrichment_result = await workflow.execute_child_workflow(
            BOMEnrichmentWorkflow.run,
            enrichment_request,
            id=f"bom-enrichment-{bom_id}"
        )
    """

    def __init__(self):
        self.progress = EnrichmentProgress(
            total_items=0,
            enriched_items=0,
            failed_items=0,
            pending_items=0,
            percent_complete=0.0
        )
        self.errors: List[Dict[str, Any]] = []
        self.paused = False  # Control enrichment pause state
        self.stopped = False  # Control enrichment stop state

    @workflow.signal
    async def pause(self):
        """Pause enrichment workflow"""
        self.paused = True
        workflow.logger.info("⏸️ Enrichment paused by signal")

    @workflow.signal
    async def resume(self):
        """Resume enrichment workflow"""
        self.paused = False
        workflow.logger.info("▶️ Enrichment resumed by signal")

    @workflow.signal
    async def stop(self):
        """Stop enrichment workflow"""
        self.stopped = True
        workflow.logger.info("⏹️ Enrichment stopped by signal")

    @workflow.run
    async def run(self, request: BOMEnrichmentRequest) -> Dict[str, Any]:
        """Wrapper around the core workflow for audit logging."""
        audit_event_params: Optional[Dict[str, Any]] = None
        workflow_id = request.workflow_id or f"bom-enrichment-{request.bom_id}"
        source_prefix = "cns.bulk" if request.source == "staff" else "customer.bom"

        try:
            summary = await self._run_core(request, workflow_id, source_prefix)
            audit_event_params = {
                "event_type": f"{source_prefix}.enrichment_completed",
                "routing_key": f"{source_prefix}.enrichment_completed",
                "organization_id": request.organization_id,
                "user_id": request.user_id,
                "username": request.user_id,
                "source": request.source,
                "event_data": {
                    "bom_id": request.bom_id,
                    "bom_name": request.bom_name,
                    "upload_id": request.bom_id,
                    "project_id": request.project_id,
                    "workflow_id": workflow_id,
                    "workflow_run_id": workflow.info().run_id,
                    "summary": summary,
                },
            }
            return summary
        except Exception as exc:
            audit_event_params = {
                "event_type": f"{source_prefix}.enrichment_failed",
                "routing_key": f"{source_prefix}.enrichment_failed",
                "organization_id": request.organization_id,
                "user_id": request.user_id,
                "username": request.user_id,
                "source": request.source,
                "event_data": {
                    "bom_id": request.bom_id,
                    "bom_name": request.bom_name,
                    "upload_id": request.bom_id,
                    "project_id": request.project_id,
                    "workflow_id": workflow_id,
                    "workflow_run_id": workflow.info().run_id,
                    "error": str(exc),
                    "progress": {
                        "total_items": self.progress.total_items,
                        "enriched_items": self.progress.enriched_items,
                        "failed_items": self.progress.failed_items,
                        "pending_items": self.progress.pending_items,
                    },
                },
            }
            raise
        finally:
            if audit_event_params:
                try:
                    await workflow.execute_activity(
                        record_enrichment_audit_event,
                        audit_event_params,
                        start_to_close_timeout=timedelta(seconds=10),
                    )
                except Exception as log_error:
                    workflow.logger.warning(
                        f"Failed to record enrichment audit log entry: {log_error}"
                    )

    async def _run_core(self, request: BOMEnrichmentRequest, workflow_id: str, source_prefix: str) -> Dict[str, Any]:
        """
        Main workflow execution.

        Args:
            request: BOM enrichment request
            workflow_id: Workflow ID for tracking
            source_prefix: Event source prefix (e.g., "cns.bulk" or "customer.bom")

        Returns:
            Enrichment summary (total, enriched, failed, errors)
        """
        workflow.logger.info(f"🚀 Starting BOM enrichment workflow: job_id={request.job_id}")


        # Initialize progress
        self.progress.total_items = request.total_items
        self.progress.pending_items = request.total_items

        # Publish enrichment.started event (real-time UI update)
        await workflow.execute_activity(
            publish_enrichment_event,
            {
                'event_id': str(workflow.uuid4()),
                'event_type': 'enrichment.started',
                'routing_key': f'{request.source}.enrichment.started',
                'timestamp': workflow.now().isoformat(),
                'bom_id': request.bom_id,
                'organization_id': request.organization_id,
                'project_id': request.project_id,
                'user_id': request.user_id,
                'source': request.source,
                'workflow_id': workflow_id,
                'workflow_run_id': workflow.info().run_id,
                'state': {
                    'status': 'enriching',
                    'total_items': self.progress.total_items,
                    'enriched_items': 0,
                    'failed_items': 0,
                    'not_found_items': 0,
                    'pending_items': self.progress.total_items,
                    'percent_complete': 0.0,
                    'started_at': workflow.now().isoformat()
                },
                'payload': {
                    'config': {
                        'batch_size': 10,
                        'suppliers': ['mouser', 'digikey', 'element14']
                    }
                }
            },
            start_to_close_timeout=timedelta(seconds=10)
        )

        workflow.logger.info(f"✅ Published enrichment.started event")

        # Update BOM enrichment_status to 'processing' at workflow start
        await workflow.execute_activity(
            update_bom_progress,
            {
                'bom_id': request.bom_id,
                'organization_id': request.organization_id,
                'source': request.source,
                'status': 'processing',
                'temporal_workflow_id': workflow_id,
                'temporal_run_id': workflow.info().run_id,
                'progress': {
                    'total_items': self.progress.total_items,
                    'enriched_items': 0,
                    'failed_items': 0,
                    'pending_items': self.progress.total_items,
                    'percent_complete': 0.0
                }
            },
            start_to_close_timeout=timedelta(seconds=10)
        )
        workflow.logger.info(f"✅ BOM enrichment_status set to 'processing', workflow_id={workflow_id}")

        # Record enrichment started audit event
        try:
            await workflow.execute_activity(
                record_enrichment_audit_event,
                {
                    "event_type": f"{source_prefix}.enrichment_started",
                    "routing_key": f"{source_prefix}.enrichment_started",
                    "organization_id": request.organization_id,
                    "user_id": request.user_id,
                    "username": request.user_id,
                    "source": request.source,
                    "event_data": {
                        "bom_id": request.bom_id,
                        "bom_name": request.bom_name,
                        "upload_id": request.bom_id,
                        "project_id": request.project_id,
                        "workflow_id": workflow_id,
                        "workflow_run_id": workflow.info().run_id,
                        "total_items": request.total_items,
                        "started_at": workflow.now().isoformat(),
                    },
                },
                start_to_close_timeout=timedelta(seconds=10),
            )
        except Exception as log_error:
            workflow.logger.warning(
                f"Failed to record enrichment started audit log entry: {log_error}"
            )

        # Step 1: Fetch all pending line items (Supabase for customer, Redis for staff)
        if request.source == 'staff':
            workflow.logger.info(
                f"📋 Fetching {request.total_items} line items for STAFF bulk upload {request.bom_id} from Redis"
            )

            line_items = await workflow.execute_activity(
                fetch_bom_line_items_from_redis,
                request.bom_id,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=1),
                    maximum_interval=timedelta(seconds=10),
                    backoff_coefficient=2.0
                )
            )

            workflow.logger.info(f"✅ Fetched {len(line_items)} line items from Redis")
        else:
            workflow.logger.info(
                f"📋 Fetching {request.total_items} line items for CUSTOMER BOM {request.bom_id} from Supabase"
            )

            line_items = await workflow.execute_activity(
                fetch_bom_line_items,
                request.bom_id,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=1),
                    maximum_interval=timedelta(seconds=10),
                    backoff_coefficient=2.0
                )
            )

            workflow.logger.info(f"✅ Fetched {len(line_items)} line items from Supabase")

        # ============================================================================
        # AUDIT TRAIL: Save original BOM data (before enrichment)
        # ============================================================================
        try:
            await workflow.execute_activity(
                save_bom_original_audit,
                {
                    'job_id': request.bom_id,
                    'line_items': line_items
                },
                start_to_close_timeout=timedelta(seconds=30)
            )
            workflow.logger.info(f"💾 Saved BOM original data to audit trail ({len(line_items)} items)")
        except Exception as e:
            workflow.logger.warning(f"Failed to save BOM original to audit trail: {e}")

        # ============================================================================
        # BULK PRE-FILTER: Check which components are already in catalog
        # ============================================================================
        workflow.logger.info(f"🔍 Running bulk pre-filter against component catalog...")

        prefilter_result = await workflow.execute_activity(
            bulk_prefilter_components,
            line_items,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=10),
                backoff_coefficient=2.0
            )
        )

        workflow.logger.info(
            f"✅ Pre-filter complete: "
            f"{prefilter_result['stats']['found']} in catalog, "
            f"{prefilter_result['stats']['not_found']} need enrichment "
            f"(saved {prefilter_result['stats']['api_calls_saved']} API calls)"
        )

        # ============================================================================

        # Load configuration for rate limiting
        config_result = await workflow.execute_activity(
            load_enrichment_config,
            start_to_close_timeout=timedelta(seconds=5)
        )

        # Use .get() with defaults for defensive programming
        batch_size = config_result.get('batch_size', 10)
        delays_enabled = config_result.get('delays_enabled', True)
        delay_per_component_ms = config_result.get('delay_per_component_ms', 500)
        delay_per_batch_ms = config_result.get('delay_per_batch_ms', 2000)

        # BUG-023: Validate batch size to prevent invalid configurations
        if not isinstance(batch_size, int) or batch_size < 1:
            workflow.logger.warning(f"Invalid batch_size: {batch_size}, using default 10")
            batch_size = 10
        elif batch_size > 100:
            workflow.logger.warning(f"Batch size too large: {batch_size}, capped at 100")
            batch_size = 100

        # Validate delay times
        if not isinstance(delay_per_component_ms, int) or delay_per_component_ms < 0:
            delay_per_component_ms = 500
        if not isinstance(delay_per_batch_ms, int) or delay_per_batch_ms < 0:
            delay_per_batch_ms = 2000

        if delays_enabled:
            workflow.logger.info(
                f"⏱️ Rate limiting enabled: {delay_per_component_ms}ms per component, "
                f"{delay_per_batch_ms}ms per batch (batch_size={batch_size})"
            )
        else:
            workflow.logger.info(f"⚡ Rate limiting disabled - processing at full speed (batch_size={batch_size})")

        # Step 2: Process each line item (parallel batches with rate limiting)
        for i in range(0, len(line_items), batch_size):
            # ============================================================================
            # WORKFLOW CONTROL SIGNALS - Check before each batch
            # ============================================================================

            # Check if stopped
            if self.stopped:
                workflow.logger.info(f"⏹️ Enrichment stopped by signal at batch {i // batch_size + 1}")
                from temporalio.exceptions import ApplicationError
                raise ApplicationError(
                    "Enrichment stopped by user",
                    type="stopped_by_user",
                    non_retryable=True
                )

            # Check if paused - wait for resume signal
            if self.paused:
                workflow.logger.info(f"⏸️ Enrichment paused at batch {i // batch_size + 1}, waiting for resume...")
                await workflow.wait_condition(lambda: not self.paused)
                workflow.logger.info(f"▶️ Enrichment resumed, continuing from batch {i // batch_size + 1}")

            # ============================================================================

            batch = line_items[i:i + batch_size]
            batch_number = i // batch_size + 1
            total_batches = (len(line_items) + batch_size - 1) // batch_size

            workflow.logger.info(
                f"⚡ Processing batch {batch_number}/{total_batches} ({len(batch)} items)"
            )

            # Process batch - items processed in parallel, but with optional delays between them
            results = []
            for item_idx, item in enumerate(batch):
                # Execute enrichment for this component
                result = await workflow.execute_activity(
                    enrich_component,
                    ComponentEnrichmentTask(
                        line_item_id=item['id'],
                        mpn=item['manufacturer_part_number'],
                        manufacturer=item['manufacturer'],
                        quantity=item.get('quantity', 1),
                        bom_id=request.bom_id, organization_id=request.organization_id,
                        source=request.source,
                        reference_designator=item.get('reference_designator'),
                        line_number=item.get('line_number')
                    ),
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(
                        maximum_attempts=3,
                        initial_interval=timedelta(seconds=2),
                        maximum_interval=timedelta(seconds=30),
                        backoff_coefficient=2.0
                    )
                )
                results.append(result)

                # Add delay between components (if enabled and not the last item in batch)
                if delays_enabled and item_idx < len(batch) - 1 and delay_per_component_ms > 0:
                    delay_seconds = delay_per_component_ms / 1000.0
                    workflow.logger.info(
                        f"⏳ Waiting {delay_per_component_ms}ms before next component "
                        f"({item_idx + 1}/{len(batch)})"
                    )
                    await asyncio.sleep(delay_seconds)

            # Update progress
            for result in results:
                if result['status'] == 'success':
                    self.progress.enriched_items += 1
                else:
                    self.progress.failed_items += 1
                    self.errors.append(result)

                self.progress.pending_items -= 1
                
                # BUG-027: Prevent zero division for empty BOMs
                if self.progress.total_items > 0:
                    self.progress.percent_complete = (
                        (self.progress.enriched_items + self.progress.failed_items) /
                        self.progress.total_items * 100
                    )
                else:
                    self.progress.percent_complete = 100.0  # Empty BOM = 100% complete

            # Send audit entries for this batch (Directus field-level visibility)
            audit_entries = []
            for original_item, result in zip(batch, results):
                enrichment_meta = result.get('enrichment') or {}
                audit_entries.append({
                    'line_id': result.get('line_item_id') or original_item.get('id'),
                    'mpn': result.get('mpn') or original_item.get('manufacturer_part_number'),
                    'manufacturer': original_item.get('manufacturer'),
                    'status': result.get('status'),
                    'enrichment': enrichment_meta,
                    'tiers_used': result.get('tiers_used', []),
                    'ai_used': result.get('ai_used'),
                    'web_scraping_used': result.get('web_scraping_used'),
                    'error': result.get('error'),
                    'processing_time_ms': result.get('processing_time_ms'),
                })

            if audit_entries:
                try:
                    await workflow.execute_activity(
                        log_enrichment_audit_batch,
                        {
                            'upload_id': request.bom_id,
                            'entries': audit_entries
                        },
                        start_to_close_timeout=timedelta(seconds=20)
                    )
                except Exception as audit_error:
                    workflow.logger.warning(f"Failed to log enrichment audit batch: {audit_error}")

            # Update progress (Supabase or Redis based on source)
            await workflow.execute_activity(
                update_bom_progress,
                {
                    'bom_id': request.bom_id,
                    'source': request.source,  # ✅ Pass source to determine storage
                    'progress': {
                        'total_items': self.progress.total_items,
                        'enriched_items': self.progress.enriched_items,
                        'failed_items': self.progress.failed_items,
                        'pending_items': self.progress.pending_items,
                        'percent_complete': self.progress.percent_complete,
                        'last_updated': workflow.now().isoformat()
                    }
                },
                start_to_close_timeout=timedelta(seconds=10)
            )

            # Publish enrichment.progress event (real-time UI update)
            await workflow.execute_activity(
                publish_enrichment_event,
                {
                    'event_id': str(workflow.uuid4()),
                    'event_type': 'enrichment.progress',
                    'routing_key': f'{request.source}.enrichment.progress',
                    'timestamp': workflow.now().isoformat(),
                    'bom_id': request.bom_id,
                    'organization_id': request.organization_id,
                    'project_id': request.project_id,
                    'source': request.source,
                    'workflow_id': workflow_id,
                    'workflow_run_id': workflow.info().run_id,
                    'state': {
                        'status': 'enriching',
                        'total_items': self.progress.total_items,
                        'enriched_items': self.progress.enriched_items,
                        'failed_items': self.progress.failed_items,
                        'not_found_items': 0,  # TODO: Track separately
                        'pending_items': self.progress.pending_items,
                        'current_batch': (i // batch_size) + 1,
                        'total_batches': (len(line_items) + batch_size - 1) // batch_size,
                        'percent_complete': self.progress.percent_complete,
                        'last_update': workflow.now().isoformat()
                    },
                    'payload': {
                        'batch': {
                            'batch_number': (i // batch_size) + 1,
                            'batch_size': len(batch),
                            'completed': len(batch)
                        }
                    }
                },
                start_to_close_timeout=timedelta(seconds=10)
            )

            workflow.logger.info(
                f"📊 Progress: {self.progress.enriched_items}/{self.progress.total_items} "
                f"({self.progress.percent_complete:.1f}%)"
            )

            # Add delay between batches (if enabled and not the last batch)
            if delays_enabled and batch_number < total_batches and delay_per_batch_ms > 0:
                delay_seconds = delay_per_batch_ms / 1000.0
                workflow.logger.info(
                    f"⏸️ Batch {batch_number} complete. Waiting {delay_per_batch_ms}ms before next batch..."
                )
                await asyncio.sleep(delay_seconds)

        # Step 3: Final summary
        summary = {
            'job_id': request.job_id,
            'bom_id': request.bom_id,
            'status': 'completed',
            'total_items': self.progress.total_items,
            'enriched_items': self.progress.enriched_items,
            'failed_items': self.progress.failed_items,
            'success_rate': (
                self.progress.enriched_items / self.progress.total_items * 100
                if self.progress.total_items > 0 else 0
            ),
            'errors': self.errors[:10]  # Return first 10 errors only
        }

        workflow.logger.info(
            f"✅ BOM enrichment completed: {summary['enriched_items']}/{summary['total_items']} "
            f"({summary['success_rate']:.1f}% success)"
        )

        # Publish enrichment.completed event (real-time UI update)
        await workflow.execute_activity(
            publish_enrichment_event,
            {
                'event_id': str(workflow.uuid4()),
                'event_type': 'enrichment.completed',
                'routing_key': f'{request.source}.enrichment.completed',
                'timestamp': workflow.now().isoformat(),
                'bom_id': request.bom_id,
                'organization_id': request.organization_id,
                'project_id': request.project_id,
                'source': request.source,
                'workflow_id': workflow_id,
                'workflow_run_id': workflow.info().run_id,
                'state': {
                    'status': 'completed',
                    'total_items': self.progress.total_items,
                    'enriched_items': self.progress.enriched_items,
                    'failed_items': self.progress.failed_items,
                    'not_found_items': 0,
                    'pending_items': 0,
                    'percent_complete': 100.0,
                    'completed_at': workflow.now().isoformat(),
                    'started_at': workflow.now().isoformat()  # TODO: Track actual start time
                },
                'payload': {
                    'summary': summary
                }
            },
            start_to_close_timeout=timedelta(seconds=10)
        )

        workflow.logger.info(f"✅ Published enrichment.completed event")

        user_email = str(request.user_id) if request.user_id else 'unknown'
        try:
            EventPublisher.customer_bom_enrichment_completed(
                job_id=request.job_id,
                succeeded=self.progress.enriched_items,
                failed=self.progress.failed_items,
                user_email=user_email,
                bom_id=request.bom_id,
                organization_id=request.organization_id,
                user_id=request.user_id
            )
            workflow.logger.info(
                f"✅ customer.bom.enrichment_completed event published "
                f"(triggers RiskAnalysisConsumer)"
            )
        except Exception as e:
            workflow.logger.warning(
                f"Failed to publish customer.bom.enrichment_completed event: {e}"
            )

        # Publish queue stage completion event for logging/audit
        try:
            EventPublisher.workflow_enrichment_completed(
                bom_id=request.bom_id,
                organization_id=request.organization_id,
                user_id=request.user_id,
                total_items=self.progress.total_items,
                enriched_items=self.progress.enriched_items,
                failed_items=self.progress.failed_items,
                cached_items=0,  # Could track cache hits if needed
                duration_ms=None,  # Could calculate from start time
                avg_confidence=None  # Could average confidence scores
            )
            workflow.logger.info(f"✅ workflow.stage.enrichment.completed event published")
        except Exception as e:
            workflow.logger.warning(f"Failed to publish stage completion event: {e}")

        # Final status update: Mark as completed in Redis/database
        await workflow.execute_activity(
            update_bom_progress,
            {
                'bom_id': request.bom_id,
                'organization_id': request.organization_id,
                'source': request.source,
                'status': 'completed',
                'progress': {
                    'total_items': self.progress.total_items,
                    'enriched_items': self.progress.enriched_items,
                    'failed_items': self.progress.failed_items,
                    'pending_items': 0,
                    'percent_complete': 100.0
                }
            },
            start_to_close_timeout=timedelta(seconds=10)
        )

        workflow.logger.info(f"✅ Final status updated to 'completed'")

        # ============================================================================
        # FINALIZE AUDIT TRAIL: Combine JSON objects into CSVs
        # ============================================================================
        audit_csvs_finalized = False
        try:
            audit_csvs_finalized = await workflow.execute_activity(
                finalize_audit_trail,
                request.bom_id,
                start_to_close_timeout=timedelta(seconds=60)
            )
            workflow.logger.info(f"✅ Audit trail finalized (CSVs generated)")
        except Exception as e:
            workflow.logger.warning(f"Failed to finalize audit trail: {e}")

        if audit_csvs_finalized:
            try:
                # Use bom_id directly as label to avoid importing enrichment_audit (which imports MinIO - non-deterministic)
                label = request.bom_id
                audit_types = ['vendor_responses', 'normalized_data', 'comparison_summary']
                audit_files = [f"{audit_type}-{label}.csv" for audit_type in audit_types]
                audit_files.append(f"bom_original-{label}.csv")

                # Call audit_ready publishing as activity with Temporal retry policy
                retry_policy = RetryPolicy(
                    initial_interval=timedelta(seconds=2),
                    maximum_interval=timedelta(seconds=30),
                    backoff_coefficient=2.0,
                    maximum_attempts=5,
                )
                await workflow.execute_activity(
                    publish_audit_ready_event,
                    {
                        'job_id': request.job_id,
                        'bom_id': request.bom_id,
                        'label': label,
                        'audit_files': audit_files,
                    },
                    retry_policy=retry_policy,
                    start_to_close_timeout=timedelta(seconds=60),
                )
                workflow.logger.info("✅ customer.bom.audit_ready event published with retry policy")
            except Exception as e:
                workflow.logger.error(
                    f"Failed to publish customer.bom.audit_ready event after retries: {e}",
                    exc_info=True
                )

        # ============================================================================
        # DIRECTUS REDIS SNAPSHOT SYNC
        # ============================================================================
        try:
            await workflow.execute_activity(
                sync_directus_from_redis,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(seconds=30),
                    backoff_coefficient=2.0
                )
            )
            workflow.logger.info("✅ Directus Redis snapshot sync triggered")
        except Exception as sync_error:
            workflow.logger.warning(f"Directus Redis sync failed (non-critical): {sync_error}")

        # ============================================================================
        # RISK ANALYSIS - Event-Based Trigger
        # ============================================================================
        # Risk analysis is triggered via RiskAnalysisConsumer event handler
        # when customer.bom.enrichment_completed event is published above.
        #
        # Event Flow:
        #   BOM Enrichment → enrichment.completed event (RabbitMQ)
        #   → RiskAnalysisConsumer → BOMRiskAnalysisWorkflow
        #
        # This decoupled architecture provides:
        # - Independent scaling of enrichment and risk workflows
        # - Reliable event-driven processing with RabbitMQ retry
        # - Manual triggering from Risk Dashboard if needed
        # ============================================================================

        return summary

    @workflow.query
    def get_progress(self) -> EnrichmentProgress:
        """Query current progress (can be called anytime during workflow)"""
        return self.progress


# ============================================================================
# ACTIVITIES (Executed on workers)
# ============================================================================

@activity.defn
async def bulk_prefilter_components(line_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Bulk pre-filter components against central catalog.

    Looks up all components in catalog in a single query to determine
    which ones need enrichment from supplier APIs.

    Args:
        line_items: List of BOM line items with 'manufacturer_part_number' and 'manufacturer'

    Returns:
        Dict with:
        - 'found_in_catalog': List of (mpn, manufacturer) tuples already in catalog
        - 'need_enrichment': List of (mpn, manufacturer) tuples not in catalog
        - 'catalog_data': Dict mapping (mpn, manufacturer) to component data
        - 'stats': Statistics about the lookup
    """
    from app.services.component_catalog import ComponentCatalogService

    logger.info(f"🔍 Bulk pre-filtering {len(line_items)} components against catalog...")

    # Extract unique (mpn, manufacturer) pairs
    unique_components = {}
    for item in line_items:
        mpn = item.get('manufacturer_part_number')
        manufacturer = item.get('manufacturer')

        if mpn and manufacturer:
            key = (mpn, manufacturer)
            if key not in unique_components:
                unique_components[key] = {
                    'mpn': mpn,
                    'manufacturer': manufacturer
                }

    logger.info(f"   {len(unique_components)} unique components to check")

    if not unique_components:
        return {
            'found_in_catalog': [],
            'need_enrichment': [],
            'catalog_data': {},
            'stats': {
                'total_unique': 0,
                'found': 0,
                'not_found': 0,
                'api_calls_saved': 0
            }
        }

    # Bulk lookup in catalog
    catalog = ComponentCatalogService()
    lookup_results = catalog.bulk_lookup_components(list(unique_components.values()))

    # Split into found/not found with quality-based re-enrichment logic
    from app.config import settings
    from datetime import datetime, timedelta

    found_in_catalog = []
    need_enrichment = []
    catalog_data = {}

    # Track re-enrichment reasons for stats
    reenrich_reasons = {
        'not_found': 0,
        'low_quality': 0,
        'fallback_data': 0,
        'stale_data': 0
    }

    for key, component in lookup_results.items():
        # Convert tuple key to string for JSON serialization (Temporal requirement)
        key_str = f"{key[0]}|{key[1]}" if isinstance(key, tuple) else str(key)

        if component is None:
            # Not in catalog - needs enrichment
            need_enrichment.append(key_str)
            reenrich_reasons['not_found'] += 1
        else:
            # Component exists - check if it needs re-enrichment
            should_reenrich = False
            reenrich_reason = None
            mpn = key[0] if isinstance(key, tuple) else key

            # Check 1: Low quality score
            quality_score = component.get('quality_score') or 0
            if quality_score < settings.quality_reenrich_threshold:
                should_reenrich = True
                reenrich_reason = 'low_quality'
                logger.debug(f"Re-enriching {mpn}: quality {quality_score} < threshold {settings.quality_reenrich_threshold}")

            # Check 2: Fallback/mock data
            elif settings.reenrich_fallback_data:
                enrichment_source = component.get('enrichment_source') or ''
                if enrichment_source in ['fallback', 'mock', '']:
                    should_reenrich = True
                    reenrich_reason = 'fallback_data'
                    logger.debug(f"Re-enriching {mpn}: fallback/mock data (source: {enrichment_source})")

            # Check 3: Stale data
            elif settings.enrichment_staleness_days > 0:
                last_enriched = component.get('last_enriched_at')
                if last_enriched:
                    try:
                        if isinstance(last_enriched, str):
                            from dateutil import parser
                            last_enriched_dt = parser.parse(last_enriched)
                        else:
                            last_enriched_dt = last_enriched

                        staleness_cutoff = datetime.now() - timedelta(days=settings.enrichment_staleness_days)
                        if last_enriched_dt < staleness_cutoff:
                            should_reenrich = True
                            reenrich_reason = 'stale_data'
                            days_old = (datetime.now() - last_enriched_dt).days
                            logger.debug(f"Re-enriching {mpn}: {days_old} days old > {settings.enrichment_staleness_days} days")
                    except Exception as e:
                        logger.warning(f"Error parsing last_enriched_at for {mpn}: {e}")

            if should_reenrich:
                need_enrichment.append(key_str)
                reenrich_reasons[reenrich_reason] += 1
            else:
                # Good quality, recent data - reuse
                found_in_catalog.append(key_str)
                # Serialize component to JSON-safe format (convert datetime objects to strings)
                catalog_data[key_str] = _serialize_component_for_json(component)

    stats = {
        'total_unique': len(unique_components),
        'found': len(found_in_catalog),
        'not_found': len(need_enrichment),
        'api_calls_saved': len(found_in_catalog),
        'savings_percent': round((len(found_in_catalog) / len(unique_components) * 100), 1) if unique_components else 0,
        'reenrich_reasons': reenrich_reasons
    }

    logger.info(
        f"✅ Bulk pre-filter complete: "
        f"{stats['found']} reused, {stats['not_found']} need enrichment "
        f"({stats['savings_percent']}% API calls saved)"
    )
    logger.info(
        f"   Re-enrichment breakdown: "
        f"not_found={reenrich_reasons['not_found']}, "
        f"low_quality={reenrich_reasons['low_quality']}, "
        f"fallback_data={reenrich_reasons['fallback_data']}, "
        f"stale_data={reenrich_reasons['stale_data']}"
    )

    return _json_safe({
        'found_in_catalog': found_in_catalog,
        'need_enrichment': need_enrichment,
        'catalog_data': catalog_data,
        'stats': stats
    })


@activity.defn
async def load_enrichment_config() -> Dict[str, Any]:
    """
    Load enrichment configuration settings.

    Priority:
    1. Redis (runtime configuration, set via UI/API)
    2. Environment variables (fallback)
    3. Code defaults (last resort)

    Applies to ALL enrichment workflows:
    - Customer BOM uploads
    - Bulk uploads
    - Admin uploads

    Returns:
        Configuration dict with batch_size, delays_enabled, delay settings
    """
    from app.utils.rate_limiting_config import get_rate_limiting_config_manager

    logger.info("Loading enrichment rate limiting configuration")

    config_manager = get_rate_limiting_config_manager()
    config = config_manager.get_config()

    snapshot_meta = _maybe_refresh_category_snapshot("load_enrichment_config")
    status = snapshot_meta.get("status")
    if status == "refreshed":
        logger.info(
            "[Category Snapshot] auto-refreshed before enrichment (%s)",
            snapshot_meta.get("last_completed", "n/a"),
        )
    elif status == "failed":
        logger.warning("[Category Snapshot] auto-refresh failed; continuing with existing data")
    elif status == "fresh":
        logger.debug(
            "[Category Snapshot] fresh run detected (%s)",
            snapshot_meta.get("last_completed"),
        )

    logger.info(
        f"✅ Config loaded from {config['source'].upper()}: "
        f"batch_size={config['batch_size']}, "
        f"delays_enabled={config['delays_enabled']}, "
        f"delay_per_component={config['delay_per_component_ms']}ms, "
        f"delay_per_batch={config['delay_per_batch_ms']}ms"
    )

    return config


@activity.defn
async def fetch_bom_line_items(bom_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all pending line items for a BOM from Supabase (Customer BOMs only).

    Args:
        bom_id: BOM ID

    Returns:
        List of line items with enrichment_status='pending'
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text
    from decimal import Decimal

    logger.info(f"[Supabase] Fetching line items for BOM: {bom_id}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        query = text("""
            SELECT
                id,
                manufacturer_part_number,
                manufacturer,
                quantity,
                enrichment_status,
                reference_designator,
                line_number
            FROM bom_line_items
            WHERE bom_id = :bom_id
              AND (enrichment_status = 'pending' OR enrichment_status IS NULL)
            ORDER BY line_number
        """)

        result = db.execute(query, {"bom_id": bom_id})

        # Convert rows to dicts and handle Decimal/UUID serialization
        from uuid import UUID
        line_items = []
        for row in result.fetchall():
            item = dict(row._mapping)
            # Convert Decimal and UUID for JSON serialization (Temporal activities)
            for key, value in item.items():
                if isinstance(value, Decimal):
                    item[key] = float(value)
                elif isinstance(value, UUID):
                    item[key] = str(value)
            line_items.append(item)

        logger.info(f"✅ Found {len(line_items)} pending line items from Supabase")
        return _json_safe(line_items)

    except Exception as e:
        logger.error(f"Error fetching line items from Supabase: {e}", exc_info=True)
        raise


@activity.defn
async def fetch_bom_line_items_from_redis(bom_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all pending line items for a BOM from Redis (Staff bulk uploads only).

    Args:
        bom_id: Upload ID (used as bom_id for staff uploads)

    Returns:
        List of line items with enrichment_status='pending'
    """
    from app.utils.bulk_upload_redis import get_bulk_upload_storage

    logger.info(f"[Redis] Fetching line items for bulk upload: {bom_id}")

    try:
        # Get Redis storage for this upload
        redis_storage = get_bulk_upload_storage(bom_id)
        if not redis_storage:
            raise RuntimeError("Redis storage not available")

        # Check if upload exists
        if not redis_storage.exists():
            raise RuntimeError(f"Bulk upload not found in Redis: {bom_id} (may have expired)")

        # Get all line items from Redis
        line_items = redis_storage.get_line_items()

        if not line_items:
            logger.warning(f"No line items found in Redis for upload: {bom_id}")
            return []

        # Filter only pending items (in case some were already enriched)
        pending_items = [
            item for item in line_items
            if item.get('enrichment_status') == 'pending'
        ]

        logger.info(f"✅ Found {len(pending_items)} pending line items from Redis")
        return _json_safe(pending_items)

    except Exception as e:
        logger.error(f"Error fetching line items from Redis: {e}", exc_info=True)
        raise


@activity.defn
async def save_bom_original_audit(data: Dict[str, Any]) -> bool:
    """
    Save original BOM data to audit trail (before enrichment).

    Args:
        data: Dict with job_id and line_items

    Returns:
        True if saved successfully
    """
    from app.utils.enrichment_audit import get_audit_writer

    job_id = data['job_id']
    line_items = data['line_items']

    logger.info(f"💾 Saving BOM original to audit trail: {job_id} ({len(line_items)} items)")

    try:
        audit_writer = get_audit_writer()
        success = audit_writer.save_bom_original(job_id, line_items)

        if success:
            logger.info(f"✅ Saved BOM original to audit trail: {job_id}")
        else:
            logger.warning(f"⚠️  Failed to save BOM original (audit writer returned False)")

        return success

    except Exception as e:
        logger.error(f"❌ Error saving BOM original to audit trail: {e}", exc_info=True)
        return False


@activity.defn
async def finalize_audit_trail(job_id: str) -> bool:
    """
    Finalize audit trail by combining individual JSON objects into CSV files.

    Call this after enrichment workflow completion.

    Args:
        job_id: Job/BOM ID

    Returns:
        True if successful
    """
    from app.utils.enrichment_audit import get_audit_writer

    logger.info(f"📊 Finalizing audit trail for job: {job_id}")

    try:
        audit_writer = get_audit_writer()
        success = audit_writer.finalize_audit_csvs(job_id)

        if success:
            logger.info(f"✅ Finalized audit trail: {job_id}")
        else:
            logger.warning(f"⚠️  Failed to finalize audit trail")

        return success

    except Exception as e:
        logger.error(f"❌ Error finalizing audit trail: {e}", exc_info=True)
        return False


@activity.defn
async def sync_directus_from_redis() -> Dict[str, Any]:
    """
    Trigger Redis snapshot sync so Directus reflects latest Redis-held components.

    Returns:
        Dict with sync statistics
    """
    from app.models.dual_database import get_dual_database
    from app.utils.redis_snapshot_sync import RedisSnapshotSync

    logger.info("[Directus Sync] Starting Redis snapshot sync")

    dual_db = get_dual_database()
    session_gen = dual_db.get_session("components")
    db = next(session_gen)

    try:
        sync = RedisSnapshotSync(db)
        stats = sync.sync_all_components()
        logger.info(f"[Directus Sync] Completed: {stats}")
        return _json_safe(stats)
    except Exception as e:
        logger.error(f"[Directus Sync] Failed: {e}", exc_info=True)
        raise
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


@activity.defn
async def enrich_component(task: ComponentEnrichmentTask) -> Dict[str, Any]:
    """
    Enrich a single component with CRITICAL-5 distributed locking:
    1. Acquire distributed lock for MPN (prevent concurrent duplicates)
    2. Check central catalog (reuse if found)
    3. If not found, call supplier APIs
    4. Save to catalog
    5. Link to BOM line item
    6. Release lock and publish real-time event to Supabase

    Args:
        task: Component enrichment task

    Returns:
        Enrichment result (status, component_id, error)
    """
    from app.services.component_catalog import get_component_catalog
    from app.models.dual_database import get_dual_database
    from app.core.distributed_lock import get_enrichment_manager
    from sqlalchemy import text
    import uuid
    from datetime import datetime
    import os

    logger.info(f"⚡ Enriching component: {task.mpn} ({task.manufacturer})")
    activity_started_at = datetime.utcnow()

    def _processing_time_ms() -> int:
        """Helper to calculate elapsed processing time for audit logging."""
        delta = datetime.utcnow() - activity_started_at
        return int(delta.total_seconds() * 1000)

    def _attach_result_metadata(result_dict: Dict[str, Any], tiers: Optional[List[str]] = None):
        """Ensure enrichment results include timing + tier information."""
        if tiers is not None:
            result_dict['tiers_used'] = tiers
        if 'processing_time_ms' not in result_dict:
            result_dict['processing_time_ms'] = _processing_time_ms()

    # ============================================================================
    # CRITICAL-5: ACQUIRE DISTRIBUTED LOCK
    # Prevents duplicate enrichment when multiple workers process same MPN
    # ============================================================================
    enrichment_manager = get_enrichment_manager()
    lock = await enrichment_manager.get_enrichment_lock(task.mpn, timeout=120)
    
    try:
        lock_acquired = await lock.acquire()
        if not lock_acquired:
            logger.warning(
                f"⚠️  Could not acquire enrichment lock for {task.mpn}, "
                f"another worker may be processing this component. Retrying catalog lookup..."
            )
            raise TimeoutError(f"Could not acquire enrichment lock for {task.mpn} within timeout")
    except Exception as e:
        logger.warning(f"⚠️  Error acquiring lock for {task.mpn}: {e}. Failing enrichment to retry...")
        raise  # Fail enrichment so Temporal can retry with exponential backoff
        lock = None

    catalog = get_component_catalog()
    dual_db = get_dual_database()

    # Helper function to publish component event
    async def publish_component_event(event_type: str, result: Dict[str, Any]):
        """Publish component-level enrichment event with retry logic using dual_db"""
        import json  # For JSONB serialization
        from sqlalchemy.exc import OperationalError, IntegrityError, DataError

        try:
            event_record = {
                'event_id': str(uuid.uuid4()),
                'event_type': event_type,
                'routing_key': f'{task.source}.enrichment.component.{event_type.split(".")[-1]}',
                'bom_id': str(task.bom_id),
                'organization_id': str(task.organization_id),
                'source': task.source,
                'state': result.get('state', {}),
                'payload': {
                    'component': {
                        'line_item_id': task.line_item_id,
                        'line_number': task.line_number,
                        'mpn': task.mpn,
                        'manufacturer': task.manufacturer,
                        'quantity': task.quantity,
                        'reference_designator': task.reference_designator
                    },
                    'enrichment': result.get('enrichment', {}),
                    'error': result.get('error')
                },
                'created_at': datetime.utcnow().isoformat()
            }

            # Convert Decimal/UUID/datetime objects to JSON-serializable types
            event_record = _make_json_serializable(event_record)

            # Retry logic for transient failures
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    # Use dual_db to insert into Supabase enrichment_events table
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
                            "event_id": event_record['event_id'],
                            "event_type": event_record['event_type'],
                            "routing_key": event_record['routing_key'],
                            "bom_id": event_record['bom_id'],
                            "tenant_id": event_record['organization_id'],  # Map org_id to tenant_id column
                            "source": event_record['source'],
                            "state": json.dumps(event_record['state']),
                            "payload": json.dumps(event_record['payload']),
                            "created_at": event_record['created_at']
                        })
                        supabase_db.commit()
                        logger.info(f"✅ Published {event_type} event for {task.mpn}")
                        return
                    finally:
                        try:
                            next(supabase_db_gen)
                        except StopIteration:
                            pass
                except IntegrityError as e:
                    # Duplicate event_id - this is expected on retry, don't retry further
                    logger.warning(f"Duplicate event_id prevented re-insert (expected on retry): {e}")
                    return  # Success - event already exists
                except DataError as e:
                    # Malformed JSONB data - won't fix itself, don't retry
                    logger.error(f"Malformed JSONB data in component event: {e}", exc_info=True)
                    raise  # Fail fast - data error won't fix with retry
                except OperationalError as retry_error:
                    # Database connection issue - retry makes sense
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Exponential backoff: 1, 2, 4 seconds
                        logger.warning(
                            f"⚠️  DB connection error (attempt {attempt+1}/{max_retries}), "
                            f"retrying in {wait_time}s: {retry_error}"
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"❌ DB connection failed after {max_retries} attempts: {retry_error}")
                        raise
                except Exception as retry_error:
                    # Unknown error - retry with caution
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Exponential backoff: 1, 2, 4 seconds
                        logger.warning(
                            f"⚠️  Event publish failed (attempt {attempt+1}/{max_retries}), "
                            f"retrying in {wait_time}s: {retry_error}"
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"❌ Event publish failed after {max_retries} attempts: {retry_error}")
                        raise

        except Exception as e:
            logger.warning(f"Failed to publish component event: {e}")

    try:
        # Step 1: Check central catalog
        component = catalog.lookup_component(task.mpn, task.manufacturer)

        if component:
            # ✅ Found in catalog - normalize before reuse
            component_id = component['id']
            logger.info(f"✅ Reusing catalog entry for {task.mpn} (ID: {component_id})")

            # ============================================================================
            # NORMALIZE CATALOG DATA
            # Catalog data may be old/un-normalized, so normalize it now for consistency
            # ============================================================================
            from app.core.normalizers import normalize_component_data

            logger.debug(f"Normalizing catalog data for {task.mpn}")
            component = normalize_component_data(component)
            logger.debug(f"Catalog data normalized for {task.mpn}")

            # Link BOM line item to catalog component (source-aware)
            if task.source == 'staff':
                # Update Redis for staff bulk uploads
                from app.utils.bulk_upload_redis import get_bulk_upload_storage
                from datetime import datetime

                redis_storage = get_bulk_upload_storage(task.bom_id)
                redis_storage.update_line_item(task.line_item_id, {
                    'component_id': component_id,
                    'enrichment_status': 'completed',
                    'enriched_at': datetime.utcnow().isoformat(),
                    'quality_score': component.get('quality_score', 0),
                    'enrichment_source': 'catalog'
                })
                logger.info(f"✅ Found in catalog, linked in Redis: {task.mpn} (ID: {component_id})")
            else:
                # Update Supabase for customer BOMs
                # Copy all enrichment data from catalog to bom_line_items
                supabase_db_gen = dual_db.get_session("supabase")
                supabase_db = next(supabase_db_gen)
                try:
                    import json
                    from datetime import datetime
                    from app.cache.redis_cache import DecimalEncoder

                    # Build enrichment data from catalog component
                    update_query = text("""
                        UPDATE bom_line_items
                        SET
                            component_id = :component_id,
                            enrichment_status = 'enriched',
                            component_storage = 'catalog',
                            description = :description,
                            unit_price = :unit_price,
                            datasheet_url = :datasheet_url,
                            lifecycle_status = :lifecycle_status,
                            specifications = CAST(:specifications AS jsonb),
                            pricing = CAST(:pricing AS jsonb),
                            compliance_status = CAST(:compliance_status AS jsonb),
                            enriched_mpn = :enriched_mpn,
                            enriched_manufacturer = :enriched_manufacturer,
                            enriched_at = :enriched_at,
                            match_confidence = :match_confidence,
                            match_method = 'exact',
                            risk_level = :risk_level,
                            category = :category,
                            subcategory = :subcategory,
                            updated_at = NOW()
                        WHERE id = :line_item_id
                    """)
                    supabase_db.execute(update_query, {
                        "component_id": component_id,
                        "line_item_id": task.line_item_id,
                        "description": component.get('description'),
                        "unit_price": float(component.get('unit_price')) if component.get('unit_price') else None,
                        "datasheet_url": component.get('datasheet_url'),
                        "lifecycle_status": component.get('lifecycle_status'),
                        "specifications": json.dumps(component.get('specifications') or {}, cls=DecimalEncoder),
                        "pricing": json.dumps(component.get('supplier_data') or [], cls=DecimalEncoder),
                        "compliance_status": json.dumps({
                            "rohs": component.get('rohs_compliant'),
                            "reach": component.get('reach_compliant'),
                        }, cls=DecimalEncoder),
                        "enriched_mpn": component.get('manufacturer_part_number') or task.mpn,
                        "enriched_manufacturer": component.get('manufacturer') or task.manufacturer,
                        "enriched_at": datetime.utcnow(),
                        "match_confidence": component.get('quality_score', 0),
                        "risk_level": component.get('risk_level'),
                        "category": component.get('category'),
                        "subcategory": component.get('subcategory'),
                    })
                    supabase_db.commit()
                    logger.info(f"✅ Found in catalog, linked in Supabase with enrichment data: {task.mpn} (ID: {component_id})")
                finally:
                    try:
                        next(supabase_db_gen)
                    except StopIteration:
                        pass

            result = {
                'status': 'success',
                'line_item_id': task.line_item_id,
                'component_id': component_id,
                'source': 'catalog',
                'storage_location': 'database',
                'mpn': task.mpn,
                'enrichment': {
                    'component_id': component_id,
                    'quality_score': component.get('quality_score', 0),
                    'source': 'catalog',
                    'storage_location': 'database',
                    'data': component
                }
            }

            _attach_result_metadata(result, ['catalog'])

            # Publish component.completed event
            await publish_component_event('enrichment.component.completed', result)

            # Convert Decimal/UUID objects to JSON-serializable types for Temporal
            return _make_json_serializable(result)

        else:
            # ❌ Not found in database catalog
            # Check Redis for existing low-quality data before enriching from scratch
            from app.cache.component_redis_storage import get_low_quality_component, delete_low_quality_component

            existing_redis_component = get_low_quality_component(task.mpn, task.manufacturer)

            if existing_redis_component:
                logger.info(
                    f"⚡ Component found in Redis (low quality), re-enriching: {task.mpn} "
                    f"(quality={existing_redis_component.get('quality_score', 0)})"
                )
            else:
                logger.info(f"⚡ Component not in catalog, enriching: {task.mpn}")

            # Call unified modular enrichment service (suppliers + quality + normalization)
            from app.core.enrichment_types import EnrichmentContext
            from app.services.enrichment_service import ModularEnrichmentService
            from app.services.supplier_manager_service import get_supplier_manager

            # Create a short-lived Components V2 session for the
            # modular enrichment service (catalog + supplier data)
            # and ensure it is properly closed.
            db_gen = dual_db.get_session("components")
            components_session = next(db_gen)
            try:
                supplier_manager = get_supplier_manager()
                service = ModularEnrichmentService(
                    components_session,
                    supplier_manager=supplier_manager,
                )

                context = EnrichmentContext(
                    organization_id=task.organization_id,
                    project_id=None,
                    bom_id=task.bom_id,
                    line_item_id=task.line_item_id,
                    source=task.source,
                    priority="high" if task.source == "customer" else "normal",
                    user_id=None,
                )

                unified_result = await service.enrich_component_unified(
                    mpn=task.mpn,
                    manufacturer=task.manufacturer,
                    context=context,
                )
            finally:
                # Advance generator to trigger session cleanup
                try:
                    next(db_gen)
                except StopIteration:
                    pass

            if unified_result.success and unified_result.data:
                enrichment_data = unified_result.data
                quality_score = unified_result.quality_score
            else:
                logger.warning(
                    "Unified enrichment failed for %s (%s), using fallback data",
                    task.mpn,
                    task.manufacturer,
                )
                enrichment_data = _get_fallback_enrichment_data(
                    task.mpn,
                    task.manufacturer,
                )
                quality_score = enrichment_data.get("quality_score", 0)

            # ============================================================================
            # QUALITY-BASED STORAGE ROUTING
            # ============================================================================
            # High quality (>=80) → Components V2 database (permanent)
            # Low quality (<80) → Redis (temporary, for re-enrichment)
            # ============================================================================
            from app.config import settings

            # Ensure quality_score is present in enrichment_data for downstream consumers
            enrichment_data["quality_score"] = quality_score

            # ============================================================================
            # AUDIT TRAIL: Save vendor response and normalized data
            # ============================================================================
            try:
                from app.utils.enrichment_audit import get_audit_writer
                audit_writer = get_audit_writer()

                # Save raw vendor response data
                vendor_name = enrichment_data.get('api_source', 'unknown')
                audit_writer.save_vendor_response(
                    job_id=task.bom_id,
                    line_id=task.line_item_id,
                    mpn=task.mpn,
                    manufacturer=task.manufacturer or '',
                    vendor_name=vendor_name,
                    vendor_data=enrichment_data  # Contains supplier_data + raw fields
                )

                # Save normalized data
                audit_writer.save_normalized_data(
                    job_id=task.bom_id,
                    line_id=task.line_item_id,
                    mpn=task.mpn,
                    manufacturer=task.manufacturer or '',
                    normalized_data=enrichment_data
                )

                logger.debug(
                    f"💾 Saved vendor response and normalized data to audit trail: {task.mpn}"
                )
            except Exception as e:
                logger.warning(f"Failed to save vendor/normalized data to audit trail: {e}")

            component_id = None
            redis_component_key = None
            storage_location = None

            if quality_score >= settings.quality_persist_threshold:
                # HIGH QUALITY: Save to Components V2 database (permanent)
                logger.info(
                    f"✅ High quality ({quality_score} >= {settings.quality_persist_threshold}), "
                    f"saving to database: {task.mpn}"
                )

                component_id = catalog.upsert_component(
                    task.mpn,
                    task.manufacturer,
                    enrichment_data,
                    enrichment_data.get('api_source', 'supplier')
                )
                storage_location = 'database'

                logger.info(f"✅ Saved to Components V2 database: {task.mpn} (ID: {component_id})")

                # If this was previously in Redis (low quality), delete from Redis (upgraded!)
                if existing_redis_component:
                    deleted = delete_low_quality_component(task.mpn, task.manufacturer)
                    if deleted:
                        logger.info(
                            f"✅ Upgraded component from Redis to database: {task.mpn} "
                            f"(quality improved from {existing_redis_component.get('quality_score', 0)} to {quality_score})"
                        )

            else:
                # LOW QUALITY: Save to Redis (temporary, for re-enrichment)
                logger.info(
                    f"⚠️  Low quality ({quality_score} < {settings.quality_persist_threshold}), "
                    f"saving to Redis: {task.mpn}"
                )

                from app.cache.component_redis_storage import save_low_quality_component, update_low_quality_component

                # If component already exists in Redis, update it (re-enrichment attempt)
                if existing_redis_component:
                    logger.info(
                        f"⚠️  Re-enrichment still resulted in low quality "
                        f"({quality_score} < {settings.quality_persist_threshold}), "
                        f"updating in Redis: {task.mpn}"
                    )
                    success = update_low_quality_component(
                        task.mpn,
                        task.manufacturer,
                        enrichment_data,
                        ttl_days=settings.low_quality_redis_ttl_days
                    )
                    if success:
                        from app.cache.component_redis_storage import build_component_redis_key
                        redis_component_key = build_component_redis_key(task.mpn, task.manufacturer)
                    else:
                        redis_component_key = None
                else:
                    # New low-quality component, save to Redis
                    redis_component_key = save_low_quality_component(
                        task.mpn,
                        task.manufacturer,
                        enrichment_data,
                        ttl_days=settings.low_quality_redis_ttl_days
                    )

                if not redis_component_key:
                    # Redis save failed - fallback to database to avoid data loss
                    logger.warning(
                        f"⚠️  Redis save failed for low-quality component, "
                        f"falling back to database: {task.mpn}"
                    )
                    component_id = catalog.upsert_component(
                        task.mpn,
                        task.manufacturer,
                        enrichment_data,
                        enrichment_data.get('api_source', 'supplier')
                    )
                    storage_location = 'database'
                else:
                    storage_location = 'redis'
                    logger.info(
                        f"✅ Saved to Redis (TTL={settings.low_quality_redis_ttl_days}d): "
                        f"{task.mpn} (key: {redis_component_key})"
                    )

            # Link BOM line item to component (source-aware)
            if task.source == 'staff':
                # Update Redis for staff bulk uploads
                from app.utils.bulk_upload_redis import get_bulk_upload_storage
                from datetime import datetime

                redis_storage = get_bulk_upload_storage(task.bom_id)
                line_item_update = {
                    'enrichment_status': 'completed',
                    'enriched_at': datetime.utcnow().isoformat(),
                    'quality_score': quality_score,
                    'enrichment_source': enrichment_data.get('api_source', 'supplier'),
                    'component_storage': storage_location
                }

                # Add reference based on storage location
                if storage_location == 'database':
                    line_item_update['component_id'] = component_id
                elif storage_location == 'redis':
                    line_item_update['redis_component_key'] = redis_component_key

                redis_storage.update_line_item(task.line_item_id, line_item_update)
                logger.info(
                    f"✅ Enriched and linked in Redis: {task.mpn} "
                    f"(storage={storage_location}, quality={quality_score})"
                )
            else:
                # Update Supabase for customer BOMs
                supabase_db = next(dual_db.get_session("supabase"))

                # Prepare enrichment data fields for bom_line_items
                import json
                from datetime import datetime
                from app.cache.redis_cache import DecimalEncoder

                # Extract enrichment fields from enrichment_data dict
                # Note: match_method must be one of: 'exact', 'fuzzy', 'manual', 'unmatched'
                # Supplier API lookups are exact MPN matches
                # IMPORTANT: Use DecimalEncoder to handle Decimal values from supplier APIs
                # Extract unit_price from enrichment_data (may come as price, unit_price, or from price_breaks)
                raw_unit_price = enrichment_data.get('unit_price') or enrichment_data.get('price')
                if not raw_unit_price and enrichment_data.get('price_breaks'):
                    # Use first price break as unit_price
                    price_breaks = enrichment_data.get('price_breaks', [])
                    if price_breaks and len(price_breaks) > 0:
                        raw_unit_price = price_breaks[0].get('unit_price') or price_breaks[0].get('price')

                enrichment_fields = {
                    "description": enrichment_data.get('description'),
                    "unit_price": float(raw_unit_price) if raw_unit_price else None,
                    "datasheet_url": enrichment_data.get('datasheet_url'),
                    "lifecycle_status": enrichment_data.get('lifecycle_status'),
                    "specifications": json.dumps(enrichment_data.get('specifications') or enrichment_data.get('extracted_specs') or {}, cls=DecimalEncoder),
                    "pricing": json.dumps(enrichment_data.get('pricing') or enrichment_data.get('price_breaks') or [], cls=DecimalEncoder),
                    "compliance_status": json.dumps({
                        "rohs": enrichment_data.get('rohs_compliant'),
                        "reach": enrichment_data.get('reach_compliant'),
                    }, cls=DecimalEncoder),
                    "enriched_mpn": enrichment_data.get('mpn') or task.mpn,
                    "enriched_manufacturer": enrichment_data.get('manufacturer') or task.manufacturer,
                    "enriched_at": datetime.utcnow(),
                    "match_confidence": quality_score,
                    "match_method": 'exact',  # Supplier API lookups are exact MPN matches
                    "risk_level": enrichment_data.get('risk_level'),
                    "category": enrichment_data.get('category'),
                    "subcategory": enrichment_data.get('subcategory'),
                    "line_item_id": task.line_item_id
                }

                if storage_location == 'database':
                    # Reference to Components V2 database + enrichment data
                    # Note: Use CAST() instead of :: to avoid SQLAlchemy text() escaping issues
                    update_query = text("""
                        UPDATE bom_line_items
                        SET
                            component_id = :component_id,
                            enrichment_status = 'enriched',
                            component_storage = 'catalog',
                            description = :description,
                            unit_price = :unit_price,
                            datasheet_url = :datasheet_url,
                            lifecycle_status = :lifecycle_status,
                            specifications = CAST(:specifications AS jsonb),
                            pricing = CAST(:pricing AS jsonb),
                            compliance_status = CAST(:compliance_status AS jsonb),
                            enriched_mpn = :enriched_mpn,
                            enriched_manufacturer = :enriched_manufacturer,
                            enriched_at = :enriched_at,
                            match_confidence = :match_confidence,
                            match_method = :match_method,
                            risk_level = :risk_level,
                            category = :category,
                            subcategory = :subcategory,
                            updated_at = NOW()
                        WHERE id = :line_item_id
                    """)
                    supabase_db.execute(update_query, {
                        "component_id": component_id,
                        **enrichment_fields
                    })
                elif storage_location == 'redis':
                    # Reference to Redis temporary storage + enrichment data
                    # Note: Use CAST() instead of :: to avoid SQLAlchemy text() escaping issues
                    update_query = text("""
                        UPDATE bom_line_items
                        SET
                            redis_component_key = :redis_key,
                            enrichment_status = 'enriched',
                            component_storage = 'redis',
                            description = :description,
                            unit_price = :unit_price,
                            datasheet_url = :datasheet_url,
                            lifecycle_status = :lifecycle_status,
                            specifications = CAST(:specifications AS jsonb),
                            pricing = CAST(:pricing AS jsonb),
                            compliance_status = CAST(:compliance_status AS jsonb),
                            enriched_mpn = :enriched_mpn,
                            enriched_manufacturer = :enriched_manufacturer,
                            enriched_at = :enriched_at,
                            match_confidence = :match_confidence,
                            match_method = :match_method,
                            risk_level = :risk_level,
                            category = :category,
                            subcategory = :subcategory,
                            updated_at = NOW()
                        WHERE id = :line_item_id
                    """)
                    supabase_db.execute(update_query, {
                        "redis_key": redis_component_key,
                        **enrichment_fields
                    })

                supabase_db.commit()
                logger.info(
                    f"✅ Enriched and linked in Supabase: {task.mpn} "
                    f"(storage={storage_location}, quality={quality_score})"
                )

            # ============================================================================
            # AUDIT TRAIL: Save comparison summary (quality score & storage decision)
            # ============================================================================
            try:
                from app.utils.enrichment_audit import get_audit_writer
                audit_writer = get_audit_writer()

                # Track what changes were made during normalization
                changes_made = []
                if enrichment_data.get('category_normalization_method'):
                    changes_made.append(f"category_normalized_{enrichment_data.get('category_normalization_method')}")
                if enrichment_data.get('parameters'):
                    changes_made.append(f"parameters_extracted_{len(enrichment_data['parameters'])}")
                if enrichment_data.get('price_breaks'):
                    changes_made.append(f"price_breaks_{len(enrichment_data['price_breaks'])}")

                audit_writer.save_comparison_summary(
                    job_id=task.bom_id,
                    line_id=task.line_item_id,
                    mpn=task.mpn,
                    manufacturer=task.manufacturer,
                    vendor_name=enrichment_data.get('api_source', 'unknown'),
                    quality_score=quality_score,
                    changes_made=changes_made if changes_made else ['none'],
                    storage_location=storage_location
                )
                logger.debug(
                    f"💾 Saved comparison summary to audit trail: {task.mpn} "
                    f"(quality={quality_score}, storage={storage_location})"
                )
            except Exception as e:
                logger.warning(f"Failed to save comparison summary to audit trail: {e}")

            result = {
                'status': 'success',
                'line_item_id': task.line_item_id,
                'component_id': component_id,
                'redis_component_key': redis_component_key,
                'storage_location': storage_location,
                'source': 'enrichment',
                'mpn': task.mpn,
                'ai_used': unified_result.ai_used,
                'web_scraping_used': unified_result.web_scraping_used,
                'enrichment': {
                    'component_id': component_id,
                    'redis_component_key': redis_component_key,
                    'storage_location': storage_location,
                    'quality_score': enrichment_data.get('quality_score', 0),
                    'source': enrichment_data.get('api_source', 'supplier'),
                    'data': enrichment_data
                }
            }

            if unified_result.processing_time_ms:
                result['processing_time_ms'] = int(unified_result.processing_time_ms)

            tiers_from_service: List[str] = []
            for tier in unified_result.tiers_used or []:
                if hasattr(tier, "value"):
                    tiers_from_service.append(tier.value)
                else:
                    tiers_from_service.append(str(tier))
            if not tiers_from_service:
                tiers_from_service = ['suppliers']

            _attach_result_metadata(result, tiers_from_service)

            # ============================================================================
            # RISK CALCULATION & ALERT GENERATION
            # Only for database-stored components (customer BOMs with high quality)
            # ============================================================================
            if component_id and storage_location == 'database' and task.source == 'customer':
                try:
                    from app.services.risk_integration import process_component_risk

                    risk_result = await process_component_risk(
                        component_id=component_id,
                        organization_id=str(task.organization_id),
                        enrichment_data=enrichment_data,
                        mpn=task.mpn,
                        manufacturer=task.manufacturer,
                        previous_lifecycle_status=None,  # New enrichment, no previous status
                    )

                    # Add risk info to result
                    if risk_result.get('risk_calculated'):
                        result['risk'] = {
                            'score': risk_result.get('risk_score'),
                            'level': risk_result.get('risk_level'),
                            'alerts_generated': len(risk_result.get('alerts_generated', []))
                        }
                        logger.info(
                            f"Risk processed for {task.mpn}: "
                            f"score={risk_result.get('risk_score')}, "
                            f"alerts={len(risk_result.get('alerts_generated', []))}"
                        )

                except Exception as risk_error:
                    # Risk processing is non-blocking - log and continue
                    logger.warning(f"Risk processing failed for {task.mpn}: {risk_error}")

            # Publish component.completed event
            await publish_component_event('enrichment.component.completed', result)

            # Convert Decimal/UUID objects to JSON-serializable types for Temporal
            return _make_json_serializable(result)

    except Exception as e:
        logger.error(f"Error enriching {task.mpn}: {e}", exc_info=True)
        
        error_result = None

        # Mark as failed (source-aware)
        try:
            if task.source == 'staff':
                # Update Redis for staff bulk uploads
                from app.utils.bulk_upload_redis import get_bulk_upload_storage
                from datetime import datetime

                redis_storage = get_bulk_upload_storage(task.bom_id)
                redis_storage.update_line_item(task.line_item_id, {
                    'enrichment_status': 'error',
                    'enrichment_error': str(e),
                    'failed_at': datetime.utcnow().isoformat()
                })
                logger.info(f"❌ Marked as error in Redis: {task.mpn}")
            else:
                # Update Supabase for customer BOMs
                supabase_db_gen = dual_db.get_session("supabase")
                supabase_db = next(supabase_db_gen)
                try:
                    update_query = text("""
                        UPDATE bom_line_items
                        SET
                            enrichment_status = 'error',
                            enrichment_error = :error
                        WHERE id = :line_item_id
                    """)
                    supabase_db.execute(update_query, {
                        "line_item_id": task.line_item_id,
                        "error": str(e)
                    })
                    supabase_db.commit()
                    logger.info(f"❌ Marked as failed in Supabase: {task.mpn}")
                finally:
                    try:
                        next(supabase_db_gen)
                    except StopIteration:
                        pass
        except Exception as db_error:
            logger.warning(
                f"Failed to update error status for line item {task.line_item_id}",
                exc_info=True,
                extra={
                    'line_item_id': task.line_item_id,
                    'mpn': task.mpn,
                    'source': task.source,
                    'original_error': str(e),
                    'db_error_type': type(db_error).__name__
                }
            )

        error_result = {
            'status': 'failed',
            'line_item_id': task.line_item_id,
            'mpn': task.mpn,
            'error': {
                'error_type': type(e).__name__,
                'error_message': str(e)
            }
        }

        _attach_result_metadata(error_result, [])

        # Publish component.failed event (always, even if DB update failed)
        await publish_component_event('enrichment.component.failed', error_result)

        # Convert Decimal/UUID objects to JSON-serializable types for Temporal
        return _make_json_serializable(error_result)


@activity.defn
async def update_bom_progress(params: Dict[str, Any]) -> None:
    """
    Update BOM enrichment progress (Supabase or Redis based on source).

    For staff uploads: Updates BOTH Redis (real-time cache) AND Supabase (persistent storage).
    For customer uploads: Updates Supabase only.

    Args:
        params: {
            bom_id: UUID of the BOM/upload,
            progress: {total_items, enriched_items, failed_items, pending_items, percent_complete},
            source: 'staff' or 'customer' (default='customer'),
            status: Optional status string,
            organization_id: Optional org UUID (for staff uploads),
            filename: Optional filename (for staff uploads),
            temporal_workflow_id: Optional workflow ID,
            temporal_run_id: Optional run ID
        }
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text
    import json

    source = params.get('source', 'customer')
    bom_id = params['bom_id']
    progress = params['progress']
    status = params.get('status')  # Optional status update
    organization_id = params.get('organization_id')
    filename = params.get('filename')
    temporal_workflow_id = params.get('temporal_workflow_id')
    temporal_run_id = params.get('temporal_run_id')

    logger.info(f"[FLOW_PROGRESS] Updating progress for BOM: {bom_id} (source={source}, status={status})")

    try:
        if source == 'staff':
            # ================================================================
            # STAFF UPLOADS: Update BOTH Redis AND Supabase for persistence
            # ================================================================
            from app.utils.bulk_upload_redis import get_bulk_upload_storage

            # 1. Update Redis (real-time cache for fast reads during processing)
            redis_storage = get_bulk_upload_storage(bom_id)
            redis_ttl_hours = 48  # Extended TTL during processing

            redis_storage.update_progress(
                total_items=progress['total_items'],
                enriched_items=progress['enriched_items'],
                failed_items=progress['failed_items'],
                ttl_hours=redis_ttl_hours
            )

            # Update status if provided
            if status:
                redis_storage.set_status(status, ttl_hours=redis_ttl_hours)
                logger.info(f"[FLOW_PROGRESS] Redis status updated: {status}")

            logger.info(f"[FLOW_PROGRESS] Redis progress updated: {progress['percent_complete']:.1f}% complete")

            # 2. Sync to Supabase (persistent storage - survives Redis TTL expiry)
            try:
                dual_db = get_dual_database()
                db = next(dual_db.get_session("supabase"))

                # Use upsert function to persist staff upload status
                sync_query = text("""
                    SELECT upsert_staff_upload_progress(
                        p_upload_id := :upload_id,
                        p_status := :status,
                        p_progress := :progress,
                        p_organization_id := :organization_id,
                        p_filename := :filename,
                        p_temporal_workflow_id := :temporal_workflow_id,
                        p_temporal_run_id := :temporal_run_id,
                        p_redis_ttl_hours := :redis_ttl_hours
                    )
                """)

                db.execute(sync_query, {
                    "upload_id": bom_id,
                    "status": status or 'processing',
                    "progress": json.dumps(progress),
                    "organization_id": organization_id,
                    "filename": filename,
                    "temporal_workflow_id": temporal_workflow_id,
                    "temporal_run_id": temporal_run_id,
                    "redis_ttl_hours": redis_ttl_hours
                })
                db.commit()

                logger.info(f"[FLOW_PROGRESS] Supabase staff_bulk_uploads synced for: {bom_id}")

            except Exception as supabase_error:
                # Log but don't fail - Redis update succeeded, Supabase sync is best-effort
                logger.warning(
                    f"[FLOW_PROGRESS] Supabase sync failed for staff upload {bom_id} "
                    f"(Redis update succeeded): {supabase_error}"
                )
        else:
            # ================================================================
            # CUSTOMER UPLOADS: Update Supabase only
            # ================================================================
            dual_db = get_dual_database()
            db = next(dual_db.get_session("supabase"))

            # Build query based on whether status is provided
            if status:
                # Map workflow status to enrichment_status valid values
                # Valid values: 'pending', 'queued', 'processing', 'enriched', 'failed', 'requires_approval'
                enrichment_status_map = {
                    'completed': 'enriched',
                    'processing': 'processing',
                    'queued': 'queued',
                    'failed': 'failed',
                    'pending': 'pending',
                }
                enrichment_status = enrichment_status_map.get(status, 'processing')

                # Include temporal_workflow_id if provided
                if temporal_workflow_id:
                    query = text("""
                        UPDATE boms
                        SET enrichment_progress = CAST(:progress AS jsonb),
                            status = :status,
                            enrichment_status = :enrichment_status,
                            temporal_workflow_id = :temporal_workflow_id
                        WHERE id = :bom_id
                    """)
                    db.execute(query, {
                        "bom_id": bom_id,
                        "progress": json.dumps(progress),
                        "status": status,
                        "enrichment_status": enrichment_status,
                        "temporal_workflow_id": temporal_workflow_id
                    })
                    logger.info(f"[FLOW_PROGRESS] Supabase boms updated: {progress['percent_complete']:.1f}% complete, status={status}, enrichment_status={enrichment_status}, workflow_id={temporal_workflow_id}")
                else:
                    query = text("""
                        UPDATE boms
                        SET enrichment_progress = CAST(:progress AS jsonb),
                            status = :status,
                            enrichment_status = :enrichment_status
                        WHERE id = :bom_id
                    """)
                    db.execute(query, {
                        "bom_id": bom_id,
                        "progress": json.dumps(progress),
                        "status": status,
                        "enrichment_status": enrichment_status
                    })
                    logger.info(f"[FLOW_PROGRESS] Supabase boms updated: {progress['percent_complete']:.1f}% complete, status={status}, enrichment_status={enrichment_status}")
            else:
                query = text("""
                    UPDATE boms
                    SET enrichment_progress = CAST(:progress AS jsonb)
                    WHERE id = :bom_id
                """)
                db.execute(query, {
                    "bom_id": bom_id,
                    "progress": json.dumps(progress)
                })
                logger.info(f"[FLOW_PROGRESS] Supabase boms updated: {progress['percent_complete']:.1f}% complete")

            db.commit()

            # ALSO update bom_processing_jobs for Queue Card UI
            # This ensures real-time enrichment progress is visible in the Queue Cards
            try:
                items_processed = progress.get('enriched_items', 0) + progress.get('failed_items', 0)
                percent_complete = int(progress.get('percent_complete', 0))

                processing_query = text("""
                    UPDATE bom_processing_jobs
                    SET enriched_items = :enriched_items,
                        failed_items = :failed_items,
                        stages = jsonb_set(
                            jsonb_set(
                                stages,
                                '{enrichment,items_processed}',
                                to_jsonb(:items_processed::int)
                            ),
                            '{enrichment,progress}',
                            to_jsonb(:percent_complete::int)
                        ),
                        updated_at = NOW()
                    WHERE bom_id = :bom_id
                """)
                db.execute(processing_query, {
                    "bom_id": bom_id,
                    "enriched_items": progress.get('enriched_items', 0),
                    "failed_items": progress.get('failed_items', 0),
                    "items_processed": items_processed,
                    "percent_complete": percent_complete
                })
                db.commit()
                logger.info(f"[FLOW_PROGRESS] bom_processing_jobs enrichment progress updated: {percent_complete}%")
            except Exception as proc_jobs_error:
                # Log but don't fail - boms table update succeeded
                logger.warning(f"[FLOW_PROGRESS] Failed to update bom_processing_jobs for {bom_id}: {proc_jobs_error}")

    except Exception as e:
        logger.error(f"[FLOW_ERROR] Error updating progress (source={source}): {e}", exc_info=True)
        raise


@activity.defn
async def record_enrichment_audit_event(params: Dict[str, Any]) -> None:
    """
    Persist an enrichment-related audit log entry (bulk or customer) to Supabase.

    Args:
        params: Dict containing event_type, routing_key, organization_id, etc.
    """
    from app.models.dual_database import get_dual_database

    dual_db = get_dual_database()
    session_gen = dual_db.get_session("supabase")
    db = next(session_gen)

    try:
        record_audit_log_entry(
            db,
            event_type=params["event_type"],
            routing_key=params["routing_key"],
            organization_id=params["organization_id"],
            user_id=params.get("user_id"),
            username=params.get("username"),
            email=params.get("email"),
            source=params.get("source", "cns-service"),
            event_data=params.get("event_data"),
        )
        db.commit()
    except Exception as e:
        logger.warning(f"[Audit] Failed to record enrichment audit event: {e}", exc_info=True)
        db.rollback()
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


@activity.defn
async def log_enrichment_audit_batch(params: Dict[str, Any]) -> Dict[str, int]:
    """
    Persist batch enrichment audit entries for Directus field diff views.

    Args:
        params: {
            upload_id: str,
            entries: [
                {
                    line_id, mpn, manufacturer, status,
                    enrichment: {...}, tiers_used: [], error: {...}
                }
            ]
        }
    """
    from app.models.dual_database import get_dual_database
    from app.services.enrichment_audit_wrapper import BatchAuditLogger
    from app.services.enrichment_service import EnrichmentResult

    upload_id = params.get('upload_id')
    entries = params.get('entries') or []

    if not upload_id or not entries:
        return {'total': 0, 'logged': 0, 'failed': 0, 'flagged_for_review': 0}

    dual_db = get_dual_database()
    session_gen = dual_db.get_session("components")
    db = next(session_gen)

    try:
        batch_logger = BatchAuditLogger(db, upload_id=upload_id)

        for entry in entries:
            enrichment_meta = entry.get('enrichment') or {}
            normalized_data = enrichment_meta.get('data')
            supplier_data = enrichment_meta.get('supplier_data')

            # Supplier metadata may be stored inside normalized payload
            if not supplier_data and isinstance(normalized_data, dict):
                supplier_data = normalized_data.get('supplier_data')

            storage_location = enrichment_meta.get('storage_location')
            quality_score = enrichment_meta.get('quality_score')

            tiers_used = []
            for tier in entry.get('tiers_used') or []:
                if isinstance(tier, str):
                    tiers_used.append(tier)
                elif hasattr(tier, "value"):
                    tiers_used.append(tier.value)
                else:
                    tiers_used.append(str(tier))

            error_info = entry.get('error')
            error_message = None
            if isinstance(error_info, dict):
                error_message = error_info.get('error_message') or error_info.get('message')
            elif isinstance(error_info, str):
                error_message = error_info

            routing_destination = enrichment_meta.get('source') or (
                'database' if storage_location == 'database' else
                'redis' if storage_location == 'redis' else
                'rejected'
            )

            enrichment_result = EnrichmentResult(
                mpn=entry.get('mpn') or "UNKNOWN",
                success=entry.get('status') == 'success',
                data=normalized_data,
                quality_score=quality_score or 0.0,
                routing_destination=routing_destination,
                tiers_used=tiers_used,
                ai_used=bool(entry.get('ai_used')),
                web_scraping_used=bool(entry.get('web_scraping_used')),
                error=error_message,
                processing_time_ms=float(entry.get('processing_time_ms') or 0.0),
            )

            batch_logger.log(
                line_id=entry.get('line_id') or entry.get('mpn') or 'unknown',
                mpn=entry.get('mpn') or "UNKNOWN",
                manufacturer=entry.get('manufacturer'),
                enrichment_result=enrichment_result,
                supplier_data=supplier_data,
                normalized_data=normalized_data,
                storage_location=storage_location
            )

        stats = batch_logger.finalize()
        return stats

    except Exception:
        logger.exception("Failed to write enrichment audit entries")
        raise
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


@activity.defn
async def publish_enrichment_event(event_data: Dict[str, Any]) -> None:
    """
    Publish enrichment event to Supabase AND Redis for real-time UI updates.

    Dual-channel publishing:
    1. Supabase enrichment_events table (for history/persistence)
    2. Redis Pub/Sub (for real-time SSE streaming)

    Args:
        event_data: Event payload containing event_type, state, payload, etc.
    """
    import os
    import uuid
    import json
    from datetime import datetime

    logger.info(f"Publishing enrichment event: {event_data.get('event_type')}")

    # Prepare event record (used by both Supabase and Redis)
    event_record = {
        'event_id': event_data.get('event_id', str(uuid.uuid4())),
        'event_type': event_data['event_type'],
        'routing_key': event_data.get('routing_key'),
        'bom_id': event_data['bom_id'],
        'organization_id': event_data['organization_id'],
        'project_id': event_data.get('project_id'),
        'user_id': event_data.get('user_id'),
        'source': event_data['source'],
        'workflow_id': event_data.get('workflow_id'),
        'workflow_run_id': event_data.get('workflow_run_id'),
        'state': event_data['state'],  # Full state snapshot
        'payload': event_data.get('payload', {}),
        'created_at': event_data.get('timestamp', datetime.utcnow().isoformat())
    }

    # 1. Publish to Redis Pub/Sub for real-time SSE streaming
    try:
        from app.cache.redis_cache import get_redis_client

        redis_client = await get_redis_client()
        channel = f"enrichment:{event_data['bom_id']}"

        # Publish event to Redis (SSE endpoint subscribes to this)
        await redis_client.publish(
            channel,
            json.dumps(event_record)
        )

        logger.info(f"✅ Event published to Redis channel: {channel}")

    except Exception as e:
        logger.error(f"Failed to publish to Redis: {e}", exc_info=True)
        # Non-blocking - continue to Supabase even if Redis fails

    # 2. Publish to Supabase enrichment_events table (for persistence)
    try:
        # Use dual_db to insert into Supabase enrichment_events table
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text
        import json  # For JSONB serialization
        from sqlalchemy.exc import OperationalError, IntegrityError, DataError

        dual_db = get_dual_database()
        supabase_db_gen = dual_db.get_session("supabase")
        supabase_db = next(supabase_db_gen)
        try:
            insert_query = text("""
                INSERT INTO enrichment_events (
                    event_id, event_type, routing_key, bom_id, tenant_id,
                    project_id, user_id, source, workflow_id, workflow_run_id,
                    state, payload, created_at
                ) VALUES (
                    :event_id, :event_type, :routing_key, :bom_id, :tenant_id,
                    :project_id, :user_id, :source, :workflow_id, :workflow_run_id,
                    :state, :payload, :created_at
                )
            """)

            supabase_db.execute(insert_query, {
                "event_id": event_record['event_id'],
                "event_type": event_record['event_type'],
                "routing_key": event_record['routing_key'],
                "bom_id": str(event_record['bom_id']),
                "tenant_id": str(event_record['organization_id']),  # Map org_id to tenant_id column
                "project_id": str(event_record['project_id']) if event_record.get('project_id') else None,
                "user_id": str(event_record['user_id']) if event_record.get('user_id') else None,
                "source": event_record['source'],
                "workflow_id": event_record.get('workflow_id'),
                "workflow_run_id": event_record.get('workflow_run_id'),
                "state": json.dumps(event_record['state']),
                "payload": json.dumps(event_record['payload']),
                "created_at": event_record['created_at']
            })
            supabase_db.commit()
            logger.info(f"✅ Event published to Supabase: {event_data['event_type']}")
        finally:
            try:
                next(supabase_db_gen)
            except StopIteration:
                pass

    except IntegrityError as e:
        logger.warning(f"Duplicate event_id prevented re-insert to Supabase (expected): {e}")
        # This is expected if we retry - unique constraint on event_id prevents duplicates
    except OperationalError as e:
        logger.error(f"Database connection error publishing to Supabase: {e}", exc_info=True)
        # Non-blocking - don't fail the workflow if event publishing fails
    except DataError as e:
        logger.error(f"Malformed JSONB data in Supabase insert: {e}", exc_info=True)
        # Non-blocking - don't fail the workflow if event publishing fails
    except Exception as e:
        logger.error(f"Unexpected error publishing to Supabase: {e}", exc_info=True)
        # Non-blocking - don't fail the workflow if event publishing fails


def calculate_enrichment_quality_score(product_data) -> float:
    """
    Calculate enrichment quality score based on data completeness (0-100).

    Quality is based on how much useful data we have, NOT just MPN match confidence.

    Scoring breakdown:
    - Description (detailed): 10 pts
    - Datasheet URL: 15 pts
    - Lifecycle status: 15 pts
    - Pricing data: 10 pts
    - Availability/stock: 10 pts
    - Parameters (MOST IMPORTANT!): 20 pts
    - Category: 10 pts
    - Compliance data: 10 pts

    Args:
        product_data: SupplierProductData from vendor API

    Returns:
        Quality score (0-100)
    """
    score = 0.0

    # Description quality (10 pts)
    if product_data.description:
        desc_len = len(product_data.description)
        if desc_len > 50:
            score += 10
        elif desc_len > 20:
            score += 5
        else:
            score += 2

    # Datasheet availability (15 pts) - VERY IMPORTANT
    if product_data.datasheet_url:
        score += 15

    # Lifecycle status (15 pts) - CRITICAL for procurement
    if product_data.lifecycle_status and product_data.lifecycle_status != 'Unknown':
        score += 15

    # Pricing data (10 pts)
    if product_data.unit_price is not None and product_data.unit_price > 0:
        score += 10

    # Availability/stock (10 pts)
    if product_data.availability is not None:
        score += 10

    # Parameters - MOST IMPORTANT (20 pts)
    # Parameters are essential for component selection
    if product_data.parameters and isinstance(product_data.parameters, dict):
        param_count = len(product_data.parameters)
        if param_count >= 15:
            score += 20
        elif param_count >= 10:
            score += 15
        elif param_count >= 5:
            score += 10
        elif param_count >= 1:
            score += 5

    # Category (10 pts)
    if product_data.category and product_data.category != 'Unknown':
        score += 10

    # Compliance data (10 pts) - Important for regulatory
    compliance_fields = [
        product_data.rohs_compliant,
        product_data.reach_compliant,
        product_data.halogen_free,
        product_data.aec_qualified
    ]
    compliance_count = sum(1 for field in compliance_fields if field is not None)
    score += (compliance_count / 4.0) * 10

    logger.debug(
        f"Quality score calculated: {score:.1f}/100 "
        f"(desc={10 if product_data.description else 0}, "
        f"datasheet={15 if product_data.datasheet_url else 0}, "
        f"params={len(product_data.parameters) if product_data.parameters else 0})"
    )

    return round(score, 1)


async def enrich_from_suppliers(
    mpn: str,
    manufacturer: str,
    job_id: Optional[str] = None,
    line_item_id: Optional[str] = None
) -> Dict[str, Any]:
    """LEGACY helper (retired).

    This function previously implemented workflow-local supplier
    enrichment logic. The BOM enrichment workflow now uses the
    modular enrichment engine (ModularEnrichmentService) instead.

    It is kept as a stub for reference and to fail fast if
    accidentally called.
    """

    logger.error(
        "enrich_from_suppliers() legacy helper was called but is retired; "
        "use ModularEnrichmentService.enrich_component_unified instead",
        extra={
            'mpn': mpn,
            'manufacturer': manufacturer,
            'job_id': job_id,
            'line_item_id': line_item_id,
        },
    )
    raise RuntimeError(
        "legacy enrich_from_suppliers helper is retired; "
        "use ModularEnrichmentService.enrich_component_unified instead",
    )


def _get_fallback_enrichment_data(mpn: str, manufacturer: str) -> Dict[str, Any]:
    """
    Get fallback enrichment data when supplier APIs are unavailable.

    Args:
        mpn: Manufacturer Part Number
        manufacturer: Manufacturer name

    Returns:
        Mock enrichment data dict
    """
    import random

    logger.info(f"📝 Using fallback mock data for: {mpn}")

    # Mock enrichment data
    categories = ['Microcontrollers', 'Resistors', 'Capacitors', 'ICs', 'Connectors']
    lifecycle_statuses = ['Active', 'NRND', 'Obsolete']

    fallback_data = {
        'category': random.choice(categories),
        'description': f'{manufacturer} {mpn}',
        'lifecycle_status': random.choice(lifecycle_statuses),
        'unit_price': round(random.uniform(0.10, 50.00), 2),
        'currency': 'USD',
        'price_breaks': [],
        'quality_score': round(random.uniform(60.0, 80.0), 1),  # Lower quality for fallback data
        'rohs_compliant': True,
        'reach_compliant': None,
        'halogen_free': None,
        'aec_qualified': None,
        'moq': random.choice([1, 10, 100, 1000]),
        'lead_time_days': random.choice([0, 7, 14, 30, 60]),
        'stock_status': random.choice(['Unknown', 'Check Availability']),
        'availability': None,
        'datasheet_url': None,
        'image_url': None,
        'package': None,
        'parameters': {},
        'supplier_data': {},
        'enrichment_source': 'fallback',
        'api_source': 'mock'
    }

    # ============================================================================
    # NORMALIZATION: Apply to ALL fallback data (failure case)
    # ============================================================================
    from app.core.normalizers import normalize_component_data

    logger.info(f"🔧 Normalizing fallback data for: {mpn}")

    # Normalize all component fields (prices, parameters, specs, etc.)
    fallback_data = normalize_component_data(fallback_data)

    logger.info(f"✅ Fallback data normalized for {mpn}")

    return fallback_data


# ============================================================================
# ACTIVITY: Publish Audit-Ready Event with Retry
# ============================================================================

@activity.defn
async def publish_audit_ready_event(params: Dict[str, Any]) -> bool:
    """
    Publish customer.bom.audit_ready event with built-in retry.

    This is wrapped as a Temporal activity so Temporal's retry policy
    handles transient failures in event publishing.

    Args:
        params: Dictionary containing:
            - job_id: Enrichment job ID
            - bom_id: BOM ID
            - label: Human-friendly label for audit files
            - audit_files: List of audit CSV filenames

    Returns:
        True if event published successfully, False otherwise
    """
    job_id = params['job_id']
    bom_id = params['bom_id']
    label = params['label']
    audit_files = params['audit_files']

    try:
        EventPublisher.customer_bom_audit_ready(
            job_id,
            bom_id,
            label,
            audit_files
        )
        logger.info(f"✅ Published customer.bom.audit_ready for job_id={job_id}")
        return True
    except Exception as exc:
        logger.error(f"Failed to publish audit_ready event: {exc}", exc_info=True)
        raise  # Re-raise so Temporal can retry


# ============================================================================
# BOM INGEST AND ENRICH WORKFLOW (Phase 2: Event-Driven Ingestion)
# ============================================================================

@dataclass
class BOMIngestAndEnrichRequest:
    """Request to ingest a parsed BOM snapshot and start enrichment"""
    bom_id: str
    organization_id: str
    bom_name: str
    parsed_s3_key: str
    source: str  # 'customer' or 'staff_bulk'
    project_id: Optional[str] = None
    uploaded_by: Optional[str] = None


@workflow.defn
class BOMIngestAndEnrichWorkflow:
    """
    Workflow that ingests a parsed BOM snapshot from MinIO into Supabase
    and then starts enrichment.

    Flow:
    1. Download parsed snapshot from MinIO (JSON with line items)
    2. Create BOM + line items in Supabase
    3. Start BOMEnrichmentWorkflow for the BOM

    This workflow is triggered by bom.parsed events or directly via
    POST /api/bom-snapshots.
    """

    @workflow.run
    async def run(self, request: BOMIngestAndEnrichRequest) -> Dict[str, Any]:
        """
        Main workflow entry point

        Args:
            request: BOMIngestAndEnrichRequest with snapshot details

        Returns:
            Result dict with bom_id, line_items_count, enrichment_workflow_id
        """

        logger.info(
            f"[BOM Ingest Workflow] Starting ingestion for bom_id={request.bom_id}, "
            f"organization_id={request.organization_id}, source={request.source}"
        )

        # Determine source prefix for audit events
        source_prefix = "cns.bulk" if request.source == "staff" else "customer.bom"

        # Step 1: Download parsed snapshot from MinIO
        snapshot_data = await workflow.execute_activity(
            download_parsed_snapshot,
            request.parsed_s3_key,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=10),
                maximum_attempts=3,
                backoff_coefficient=2.0,
            ),
        )

        if not snapshot_data:
            logger.error(
                f"[BOM Ingest Workflow] Failed to download snapshot: {request.parsed_s3_key}"
            )
            return {
                'success': False,
                'bom_id': request.bom_id,
                'error': 'Failed to download parsed snapshot from storage',
            }

        line_items = snapshot_data.get('line_items', [])
        total_items = len(line_items)

        logger.info(
            f"[BOM Ingest Workflow] Downloaded snapshot with {total_items} line items"
        )

        # Record upload audit event (after snapshot download)
        try:
            await workflow.execute_activity(
                record_enrichment_audit_event,
                {
                    "event_type": f"{source_prefix}.uploaded",
                    "routing_key": f"{source_prefix}.uploaded",
                    "organization_id": request.organization_id,
                    "user_id": request.uploaded_by,
                    "username": request.uploaded_by,
                    "source": request.source,
                    "event_data": {
                        "bom_id": request.bom_id,
                        "bom_name": request.bom_name,
                        "project_id": request.project_id,
                        "total_items": total_items,
                        "parsed_s3_key": request.parsed_s3_key,
                        "workflow_id": workflow.info().workflow_id,
                        "workflow_run_id": workflow.info().run_id,
                    },
                },
                start_to_close_timeout=timedelta(seconds=10),
            )
        except Exception as log_error:
            workflow.logger.warning(
                f"Failed to record upload audit log entry: {log_error}"
            )

        # Step 2: Create BOM + line items in Supabase
        ingest_result = await workflow.execute_activity(
            ingest_bom_to_supabase,
            {
                'bom_id': request.bom_id,
                'organization_id': request.organization_id,
                'project_id': request.project_id,
                'bom_name': request.bom_name,
                'source': request.source,
                'uploaded_by': request.uploaded_by,
                'line_items': line_items,
                'parsed_s3_key': request.parsed_s3_key,
            },
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=2),
                maximum_interval=timedelta(seconds=20),
                maximum_attempts=3,
                backoff_coefficient=2.0,
            ),
        )

        if not ingest_result.get('success'):
            logger.error(
                f"[BOM Ingest Workflow] Failed to ingest BOM to Supabase: "
                f"{ingest_result.get('error')}"
            )
            return {
                'success': False,
                'bom_id': request.bom_id,
                'error': ingest_result.get('error', 'Unknown ingestion error'),
            }

        line_items_saved = ingest_result.get('line_items_saved', 0)

        logger.info(
            f"[BOM Ingest Workflow] ✅ Ingested {line_items_saved} line items to Supabase"
        )

        # Record upload completion audit event (after successful ingest)
        try:
            await workflow.execute_activity(
                record_enrichment_audit_event,
                {
                    "event_type": f"{source_prefix}.upload_completed",
                    "routing_key": f"{source_prefix}.upload_completed",
                    "organization_id": request.organization_id,
                    "user_id": request.uploaded_by,
                    "username": request.uploaded_by,
                    "source": request.source,
                    "event_data": {
                        "bom_id": request.bom_id,
                        "bom_name": request.bom_name,
                        "project_id": request.project_id,
                        "total_items": total_items,
                        "line_items_saved": line_items_saved,
                        "parsed_s3_key": request.parsed_s3_key,
                        "workflow_id": workflow.info().workflow_id,
                        "workflow_run_id": workflow.info().run_id,
                    },
                },
                start_to_close_timeout=timedelta(seconds=10),
            )
        except Exception as log_error:
            workflow.logger.warning(
                f"Failed to record upload completion audit log entry: {log_error}"
            )

        # Step 3: Start BOM enrichment workflow
        # Use execute_child_workflow to start enrichment as a child workflow
        # Use workflow.uuid4() for deterministic UUID generation
        job_id = str(workflow.uuid4())

        enrichment_request = BOMEnrichmentRequest(
            job_id=job_id,
            bom_id=request.bom_id, organization_id=request.organization_id,
            project_id=request.project_id,
            total_items=line_items_saved,
            source=request.source,
            user_id=request.uploaded_by,
        )

        logger.info(
            f"[BOM Ingest Workflow] Starting enrichment workflow with job_id={job_id}"
        )

        enrichment_result = await workflow.execute_child_workflow(
            BOMEnrichmentWorkflow.run,
            enrichment_request,
            id=f"enrich-{request.bom_id}-{job_id[:8]}",
            task_queue='cns-enrichment',
        )

        logger.info(
            f"[BOM Ingest Workflow] ✅ Completed: bom_id={request.bom_id}, "
            f"items={line_items_saved}, enrichment_job={job_id}"
        )

        return {
            'success': True,
            'bom_id': request.bom_id,
            'line_items_count': line_items_saved,
            'enrichment_job_id': job_id,
            'enrichment_result': enrichment_result,
        }


# ============================================================================
# ACTIVITIES FOR BOM INGEST WORKFLOW
# ============================================================================

@activity.defn
async def download_parsed_snapshot(parsed_s3_key: str) -> Optional[Dict[str, Any]]:
    """
    Download parsed BOM snapshot from MinIO

    Args:
        parsed_s3_key: S3 key for the parsed snapshot JSON

    Returns:
        Parsed snapshot dict or None if not found
    """
    from app.utils.minio_client import get_minio_client
    from app.config import settings
    import json

    logger.info(f"[Activity] Downloading parsed snapshot: {parsed_s3_key}")

    minio = get_minio_client()
    if not minio.is_enabled():
        logger.error("[Activity] MinIO is not enabled")
        return None

    bucket = settings.minio_bucket_uploads
    snapshot_bytes = minio.download_file(bucket, parsed_s3_key)

    if snapshot_bytes is None:
        logger.error(f"[Activity] Snapshot not found: {bucket}/{parsed_s3_key}")
        return None

    try:
        snapshot_data = json.loads(snapshot_bytes.decode('utf-8'))
        logger.info(
            f"[Activity] ✅ Downloaded snapshot: {len(snapshot_data.get('line_items', []))} items"
        )
        return snapshot_data
    except Exception as e:
        logger.error(f"[Activity] Failed to parse snapshot JSON: {e}")
        return None


@activity.defn
async def ingest_bom_to_supabase(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create BOM + line items in Supabase

    Args:
        params: Dict with bom_id, organization_id, project_id, bom_name, source,
                uploaded_by, line_items, parsed_s3_key

    Returns:
        Result dict with success, line_items_saved, error
    """
    from app.services.bom_ingest import create_supabase_bom_and_items
    from app.models.dual_database import get_dual_database, DatabaseType
    from uuid import uuid4

    logger.info(
        f"[Activity] Ingesting BOM to Supabase: bom_id={params['bom_id']}, "
        f"organization_id={params['organization_id']}"
    )

    # Generate upload_id for metadata tracking
    upload_id = str(uuid4())

    # Extract MinIO bucket from parsed_s3_key
    from app.config import settings
    s3_bucket = settings.minio_bucket_uploads

    # Get Supabase database session
    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        line_items_saved, error = create_supabase_bom_and_items(
            db,
            bom_id=params['bom_id'], organization_id=params['organization_id'],
            project_id=params.get('project_id'),
            bom_name=params['bom_name'],
            upload_id=upload_id,
            filename=params.get('bom_name', 'Parsed BOM'),
            s3_bucket=s3_bucket,
            s3_key=params['parsed_s3_key'],
            line_items=params['line_items'],
            source=params['source'],
            uploaded_by=params.get('uploaded_by'),
        )

        if error:
            logger.error(f"[Activity] Failed to ingest BOM: {error}")
            return {
                'success': False,
                'line_items_saved': 0,
                'error': str(error),
            }

        logger.info(f"[Activity] ✅ Ingested {line_items_saved} line items")

        return {
            'success': True,
            'line_items_saved': line_items_saved,
            'upload_id': upload_id,
        }

    except Exception as e:
        logger.error(f"[Activity] Exception during ingestion: {e}", exc_info=True)
        return {
            'success': False,
            'line_items_saved': 0,
            'error': str(e),
        }


# ============================================================================
# BOM UNIFIED WORKFLOW (Phase 3: Single Entry Point for All BOM Sources)
# ============================================================================

@dataclass
class BOMUnifiedRequest:
    """
    Unified request for all BOM processing workflows.

    This is the single entry point for all BOM sources:
    - Customer Portal uploads (source='customer')
    - CNS Bulk uploads (source='staff_bulk')
    - Snapshot-based uploads (source='snapshot')

    The workflow determines the processing path based on source and available data.
    """
    bom_id: str
    organization_id: str
    source: str  # 'customer', 'staff_bulk', 'snapshot'
    bom_name: Optional[str] = None
    project_id: Optional[str] = None
    uploaded_by: Optional[str] = None
    filename: Optional[str] = None
    parsed_s3_key: Optional[str] = None
    upload_id: Optional[str] = None
    priority: int = 5  # 1-9, default 5 (normal)
    routing_key: Optional[str] = None  # Original RabbitMQ routing key


@workflow.defn
class BOMUnifiedWorkflow:
    """
    Unified workflow for all BOM processing - single entry point.

    This workflow is triggered by the unified BOM stream consumer for ALL sources:
    - Customer Portal uploads (customer.bom.uploaded)
    - CNS Bulk uploads (cns.bom.bulk_uploaded)
    - Snapshot-based uploads (bom.parsed)

    The workflow routes to the appropriate processing path based on the source
    and available data (parsed S3 key, existing BOM record, etc.).

    Flow:
    1. Log workflow started event
    2. Determine processing path based on source
    3. For snapshot source: Use BOMIngestAndEnrichWorkflow (download + ingest + enrich)
    4. For customer/staff_bulk: Start enrichment directly if BOM already exists
    5. Log workflow completed event
    """

    def __init__(self):
        self.paused = False
        self.cancelled = False

    @workflow.signal
    async def pause(self):
        """Pause workflow processing"""
        self.paused = True
        workflow.logger.info("[BOMUnified] Workflow paused")

    @workflow.signal
    async def resume(self):
        """Resume workflow processing"""
        self.paused = False
        workflow.logger.info("[BOMUnified] Workflow resumed")

    @workflow.signal
    async def cancel(self):
        """Cancel workflow processing"""
        self.cancelled = True
        workflow.logger.info("[BOMUnified] Workflow cancelled")

    @workflow.query
    def get_status(self) -> Dict[str, Any]:
        """Query current workflow status"""
        return {
            'paused': self.paused,
            'cancelled': self.cancelled,
        }

    @workflow.run
    async def run(self, request: BOMUnifiedRequest) -> Dict[str, Any]:
        """
        Main workflow entry point

        Args:
            request: BOMUnifiedRequest with source and BOM details

        Returns:
            Result dict with success, bom_id, workflow details
        """
        workflow_id = workflow.info().workflow_id
        run_id = workflow.info().run_id

        workflow.logger.info(
            f"[BOMUnified] Starting unified workflow: bom_id={request.bom_id}, "
            f"source={request.source}, priority={request.priority}"
        )

        # Log workflow started event
        try:
            await workflow.execute_activity(
                record_enrichment_audit_event,
                {
                    "event_type": "workflow.unified.started",
                    "routing_key": request.routing_key or f"{request.source}.bom.processing",
                    "organization_id": request.organization_id,
                    "user_id": request.uploaded_by,
                    "username": request.uploaded_by,
                    "source": request.source,
                    "event_data": {
                        "bom_id": request.bom_id,
                        "bom_name": request.bom_name,
                        "project_id": request.project_id,
                        "workflow_id": workflow_id,
                        "workflow_run_id": run_id,
                        "priority": request.priority,
                        "parsed_s3_key": request.parsed_s3_key,
                    },
                },
                start_to_close_timeout=timedelta(seconds=10),
            )
        except Exception as log_error:
            workflow.logger.warning(f"[BOMUnified] Failed to record started event: {log_error}")

        # Check for cancellation
        if self.cancelled:
            return {
                'success': False,
                'bom_id': request.bom_id,
                'status': 'cancelled',
                'workflow_id': workflow_id,
            }

        # Wait while paused
        while self.paused and not self.cancelled:
            await asyncio.sleep(1)

        # Route based on source and available data
        result = await self._route_processing(request, workflow_id, run_id)

        # Log workflow completed event
        try:
            await workflow.execute_activity(
                record_enrichment_audit_event,
                {
                    "event_type": "workflow.unified.completed",
                    "routing_key": request.routing_key or f"{request.source}.bom.completed",
                    "organization_id": request.organization_id,
                    "user_id": request.uploaded_by,
                    "username": request.uploaded_by,
                    "source": request.source,
                    "event_data": {
                        "bom_id": request.bom_id,
                        "bom_name": request.bom_name,
                        "project_id": request.project_id,
                        "workflow_id": workflow_id,
                        "workflow_run_id": run_id,
                        "success": result.get('success', False),
                        "result_summary": {
                            k: v for k, v in result.items()
                            if k in ('success', 'status', 'line_items_count', 'enrichment_job_id')
                        },
                    },
                },
                start_to_close_timeout=timedelta(seconds=10),
            )
        except Exception as log_error:
            workflow.logger.warning(f"[BOMUnified] Failed to record completed event: {log_error}")

        return result

    async def _route_processing(
        self,
        request: BOMUnifiedRequest,
        workflow_id: str,
        run_id: str
    ) -> Dict[str, Any]:
        """
        Route to appropriate processing based on source and data

        For snapshot source with parsed_s3_key:
          -> BOMIngestAndEnrichWorkflow (download, ingest, enrich)

        For customer/staff_bulk with existing BOM:
          -> BOMEnrichmentWorkflow directly

        For customer/staff_bulk without existing BOM but with parsed_s3_key:
          -> BOMIngestAndEnrichWorkflow
        """

        # If we have a parsed S3 key, use ingest workflow
        if request.parsed_s3_key:
            workflow.logger.info(
                f"[BOMUnified] Routing to BOMIngestAndEnrichWorkflow (has parsed_s3_key)"
            )

            ingest_request = BOMIngestAndEnrichRequest(
                bom_id=request.bom_id,
                organization_id=request.organization_id,
                bom_name=request.bom_name or f"BOM {request.bom_id[:8]}",
                parsed_s3_key=request.parsed_s3_key,
                source=request.source,
                project_id=request.project_id,
                uploaded_by=request.uploaded_by,
            )

            result = await workflow.execute_child_workflow(
                BOMIngestAndEnrichWorkflow.run,
                ingest_request,
                id=f"ingest-{request.bom_id}-{str(workflow.uuid4())[:8]}",
                task_queue='cns-enrichment',
            )

            return {
                'success': result.get('success', False),
                'bom_id': request.bom_id,
                'status': 'ingested_and_enriched' if result.get('success') else 'failed',
                'workflow_id': workflow_id,
                'child_workflow_result': result,
                'line_items_count': result.get('line_items_count', 0),
                'enrichment_job_id': result.get('enrichment_job_id'),
            }

        # No parsed S3 key - check if BOM already exists and start enrichment directly
        workflow.logger.info(
            f"[BOMUnified] No parsed_s3_key, checking for existing BOM and starting enrichment"
        )

        # Check BOM exists and get line item count
        bom_info = await workflow.execute_activity(
            get_bom_info_for_enrichment,
            {
                'bom_id': request.bom_id,
                'organization_id': request.organization_id,
            },
            start_to_close_timeout=timedelta(seconds=15),
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=5),
                maximum_attempts=3,
            ),
        )

        if not bom_info.get('exists'):
            workflow.logger.error(
                f"[BOMUnified] BOM not found and no parsed_s3_key provided: {request.bom_id}"
            )
            return {
                'success': False,
                'bom_id': request.bom_id,
                'status': 'bom_not_found',
                'workflow_id': workflow_id,
                'error': 'BOM not found and no parsed snapshot provided',
            }

        # Start enrichment directly
        job_id = str(workflow.uuid4())
        total_items = bom_info.get('total_items', 0)

        workflow.logger.info(
            f"[BOMUnified] Starting enrichment for existing BOM with {total_items} items"
        )

        enrichment_request = BOMEnrichmentRequest(
            job_id=job_id,
            bom_id=request.bom_id,
            organization_id=request.organization_id,
            project_id=request.project_id,
            total_items=total_items,
            bom_name=request.bom_name,
            source=request.source,
            priority='high' if request.priority >= 7 else 'normal',
            user_id=request.uploaded_by,
            workflow_id=workflow_id,
        )

        enrichment_result = await workflow.execute_child_workflow(
            BOMEnrichmentWorkflow.run,
            enrichment_request,
            id=f"enrich-{request.bom_id}-{job_id[:8]}",
            task_queue='cns-enrichment',
        )

        return {
            'success': True,
            'bom_id': request.bom_id,
            'status': 'enriched',
            'workflow_id': workflow_id,
            'enrichment_job_id': job_id,
            'line_items_count': total_items,
            'enrichment_result': enrichment_result,
        }


@activity.defn
async def get_bom_info_for_enrichment(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get BOM info for enrichment routing

    Args:
        params: Dict with bom_id, organization_id

    Returns:
        Dict with exists, total_items, status
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    bom_id = params['bom_id']
    organization_id = params['organization_id']

    logger.info(f"[Activity] Getting BOM info: bom_id={bom_id}")

    try:
        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # Check if BOM exists and get line item count
        result = db.execute(
            text("""
                SELECT
                    b.id,
                    b.status,
                    COUNT(bli.id) as total_items
                FROM boms b
                LEFT JOIN bom_line_items bli ON bli.bom_id = b.id
                WHERE b.id = :bom_id
                  AND b.organization_id = :organization_id
                GROUP BY b.id, b.status
            """),
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
            }
        ).first()

        if not result:
            return {
                'exists': False,
                'total_items': 0,
                'status': None,
            }

        return {
            'exists': True,
            'total_items': result[2] or 0,
            'status': result[1],
        }

    except Exception as e:
        logger.error(f"[Activity] Failed to get BOM info: {e}", exc_info=True)
        return {
            'exists': False,
            'total_items': 0,
            'status': None,
            'error': str(e),
        }
