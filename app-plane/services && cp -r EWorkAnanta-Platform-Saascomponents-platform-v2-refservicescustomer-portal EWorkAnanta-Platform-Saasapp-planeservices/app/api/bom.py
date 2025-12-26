"""
BOM Upload API Endpoints

Handles BOM file upload, parsing, and enrichment workflow.

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    Customer-facing endpoints use Supabase auth context for tenant filtering.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import uuid
import logging
from contextlib import contextmanager
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.models.base import get_db
from app.models.dual_database import get_dual_database, DatabaseType
from app.repositories.bom_repository import BOMRepository
from app.repositories.enrichment_repository import EnrichmentRepository
from app.repositories.catalog_repository import CatalogRepository
from app.core.normalizers import normalize_component_data
from app.core.quality_scorer import calculate_quality_score, QualityRouting
from app.utils.bom_parser_v2 import BOMParserV2, BOMParseError
from app.utils.activity_log import record_audit_log_entry
from app.core.temporal_client import get_temporal_client_manager
from app.config import settings

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
    require_role,
)

logger = logging.getLogger(__name__)

def gate_log(message: str, **context):
    """Gate logging helper - logs only if ENABLE_GATE_LOGGING is True"""
    if settings.enable_gate_logging:
        logger.info(f"[GATE: BOM] {message}", extra=context if context else {})


@contextmanager
def get_db_for_upload(source: str = "customer"):
    """Context manager that yields a Supabase session for unified uploads.

    All customer and staff uploads share the same Supabase storage so downstream
    workflows only read from one database. The ``source`` value is still logged
    for analytics/observability but no longer affects the target database.
    """
    dual_db = get_dual_database()
    logger.info(f"📍 Unified upload routing: source='{source}' → Supabase database")
    session_gen = dual_db.get_session("supabase")
    session = next(session_gen)
    try:
        yield session
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass

router = APIRouter()


# Test endpoint for threading
@router.get("/test-thread")
def test_thread_endpoint():
    """Test if threading works at all"""
    import threading
    import os
    from datetime import datetime as dt

    test_file = os.path.join(os.getcwd(), "thread_test.txt")

    def write_test():
        try:
            with open(test_file, 'a') as f:
                f.write(f"{dt.utcnow().isoformat()} - Thread executed successfully!\n")
            print(f"THREAD_TEST: Wrote to {test_file}", flush=True)
        except Exception as e:
            print(f"THREAD_TEST ERROR: {e}", flush=True)

    thread = threading.Thread(target=write_test, daemon=False)
    thread.start()

    return {"message": "Thread started", "test_file": test_file}


# Pydantic Models
class ColumnMapping(BaseModel):
    """Column mapping model"""
    source_column: str
    target_field: str
    sample_value: Optional[str] = None

class BOMUploadResponse(BaseModel):
    """Response model for BOM upload - Step 1: Parse and detect"""
    job_id: str
    filename: str
    total_items: int
    status: str
    detected_columns: dict
    unmapped_columns: List[str]
    file_type: str
    encoding_used: str
    preview_data: List[dict]  # First 10 rows for user preview
    message: str


class BOMJobStatus(BaseModel):
    """BOM job status model"""
    job_id: str
    status: str
    progress: int = Field(..., ge=0, le=100)
    total_items: int
    items_processed: int
    items_auto_approved: int
    items_in_staging: int
    items_rejected: int
    items_failed: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    processing_time_ms: Optional[int]
    error_message: Optional[str]


class BOMItem(BaseModel):
    """Single BOM item result"""
    mpn: str
    manufacturer: Optional[str]
    quality_score: float
    routing: str
    issues: List[str]
    catalog_id: Optional[int] = None


class BOMResults(BaseModel):
    """Complete BOM processing results"""
    job_id: str
    status: str
    total_items: int
    results: List[BOMItem]


@router.post("/jobs/{job_id}/retry_failed")
async def retry_failed_items_only(
    job_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Create a new BOM job that retries only the failed items from a previous job.

    Steps:
    - Load original job and its results_data
    - Identify failed items (items with non-empty issues)
    - Create a new job and copy only failed items into bom_items
    - Trigger processing (Temporal if available, otherwise background thread)
    """
    from sqlalchemy import text
    import uuid as _uuid
    bom_repo = BOMRepository(db)

    job = bom_repo.get_by_job_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"BOM job not found: {job_id}")

    if not job.results_data or 'items' not in job.results_data:
        raise HTTPException(status_code=400, detail="Original job has no results to determine failed items")

    # Collect failed items by (mpn, manufacturer)
    failed_keys = set()
    for it in job.results_data.get('items', []):
        issues = it.get('issues') or []
        if len(issues) > 0:
            key = (it.get('mpn') or '', (it.get('manufacturer') or '').strip())
            failed_keys.add(key)

    if not failed_keys:
        raise HTTPException(status_code=400, detail="No failed items to retry")

    # Pull original rows for those failed keys
    rows = db.execute(text("""
        SELECT line_number, mpn, manufacturer, quantity, reference_designator, description
        FROM bom_items
        WHERE job_id = :job_id
        ORDER BY line_number
    """), {"job_id": job_id}).fetchall()

    retry_rows = []
    for ln, mpn, manufacturer, qty, refdes, desc in rows:
        key = (mpn or '', (manufacturer or '').strip())
        if key in failed_keys:
            retry_rows.append({
                'mpn': mpn,
                'manufacturer': manufacturer,
                'quantity': qty or 1,
                'reference_designator': refdes,
                'description': desc,
            })

    if not retry_rows:
        raise HTTPException(status_code=400, detail="Failed items could not be matched to original rows")

    # Create a new job
    new_job_id = str(_uuid.uuid4())
    new_job = bom_repo.create_job({
        "job_id": new_job_id,
        "customer_id": job.customer_id,
        "customer_name": job.customer_name,
        "filename": (job.filename or "retry-failed.csv"),
        "file_size": job.file_size,
        "total_items": len(retry_rows),
        "status": "pending",
        "organization_id": job.organization_id,
        "project_id": job.project_id,
        "source": job.source or 'customer',
        "priority": job.priority or 5,
    })

    # Insert bom_items for new job
    for idx, it in enumerate(retry_rows, start=1):
        db.execute(text("""
            INSERT INTO bom_items (
                job_id, line_number, mpn, manufacturer,
                quantity, reference_designator, description
            ) VALUES (
                :job_id, :line_number, :mpn, :manufacturer,
                :quantity, :reference_designator, :description
            )
        """), {
            "job_id": new_job_id,
            "line_number": idx,
            "mpn": it['mpn'],
            "manufacturer": it.get('manufacturer'),
            "quantity": it.get('quantity', 1),
            "reference_designator": it.get('reference_designator'),
            "description": it.get('description'),
        })
    db.commit()

    # Trigger processing (Temporal preferred)
    try:
        temporal_client_manager = get_temporal_client_manager()
        if temporal_client_manager and temporal_client_manager.is_connected():
            from app.workflows.bom_enrichment import BOMEnrichmentWorkflow, BOMEnrichmentRequest
            handle = temporal_client_manager.client
            workflow_input = BOMEnrichmentRequest(
                job_id=new_job_id,
                bom_id=new_job_id, organization_id=str(job.organization_id or job.customer_id or 'default'),
                project_id=str(job.project_id) if job.project_id else None,
                total_items=len(retry_rows),
                bom_name=job.filename,
                user_id=auth.user_id,  # For completion notifications
            )
            wf_handle = await handle.start_workflow(  # type: ignore
                BOMEnrichmentWorkflow.run,
                workflow_input,
                id=f"bom-enrichment-{new_job_id}",
                task_queue=settings.temporal_task_queue
            )
            logger.info(f"✅ Temporal workflow started for retry job: {wf_handle.id}")
            bom_repo.update_job_status(new_job_id, "processing")
        else:
            raise Exception("Temporal not connected")
    except Exception:
        # Fallback to background thread
        import threading
        thread = threading.Thread(
            target=process_bom_job,
            args=(new_job_id, retry_rows, job.customer_id),
            daemon=False
        )
        thread.start()
        bom_repo.update_job_status(new_job_id, "processing")

    return {
        "old_job_id": job_id,
        "job_id": new_job_id,
        "status": "processing",
        "total_items": len(retry_rows)
    }


@router.post("/upload", response_model=BOMUploadResponse)
@require_role(Role.ANALYST)  # Any authenticated user can upload
async def upload_bom(
    file: UploadFile = File(...),
    customer_id: Optional[int] = Form(None),
    customer_name: Optional[str] = Form(None),
    organization_id: Optional[str] = Form(None),  # Changed to str for UUID support
    project_id: Optional[str] = Form(None),  # Changed to str for UUID support
    source: str = Form("customer"),
    user_email: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Upload BOM file for enrichment

    Accepts CSV, Excel (.xlsx, .xls) files with columns:
    - MPN (required)
    - Manufacturer (optional)
    - Quantity (optional)
    - Reference Designators (optional)

    Routing:
    - All uploads (customer + staff) persist to Supabase for unified storage

    Returns job_id for tracking processing status.

    Example:
        ```bash
        curl -X POST "http://localhost:8003/api/bom/upload" \\
          -F "file=@bom.csv" \\
          -F "customer_id=123" \\
          -F "customer_name=Acme Corp" \\
          -F "source=customer"
        ```
    """
    # APP-LAYER RLS: If organization_id is provided, verify user has access
    if organization_id and not auth.is_super_admin and auth.organization_id != organization_id:
        logger.warning(f"[BOM Upload] Unauthorized upload attempt: user={auth.user_id} tried to upload to org={organization_id}")
        raise HTTPException(status_code=403, detail="Cannot upload BOMs to other organizations")

    # Use auth org if none provided
    effective_org_id = organization_id or auth.organization_id

    gate_log("Upload started", bom_file=file.filename, size_bytes=file.size, source=source,
             organization_id=effective_org_id, project_id=project_id, user_id=auth.user_id)

    # Validate file type
    if not file.filename:
        gate_log("Upload failed: No filename", source=source)
        raise HTTPException(status_code=400, detail="Filename is required")

    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in ['csv', 'xlsx', 'xls', 'txt', 'tsv']:
        gate_log("Upload failed: Unsupported file type", bom_file=file.filename, extension=file_ext)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Supported: csv, xlsx, xls, txt, tsv"
        )

    # Generate job ID
    job_id = str(uuid.uuid4())
    gate_log("Job ID generated", job_id=job_id, bom_file=file.filename)

    try:
        with get_db_for_upload(source) as db:
            # Read file content
            content = await file.read()
            file_size = len(content)

            gate_log("File parsing started", job_id=job_id, bom_file=file.filename,
                    size_bytes=file_size, format=file_ext)

            # Parse BOM file with V2 parser (V1-style auto-detection)
            logger.info(f"Parsing BOM file: {file.filename} ({file_size} bytes)")
            try:
                parser = BOMParserV2(content, file.filename)
                bom_items, parse_stats = parser.parse()
            except BOMParseError as e:
                gate_log("File parsing failed", job_id=job_id, bom_file=file.filename, error=str(e))
                raise HTTPException(status_code=400, detail=str(e))

            # Log parsing statistics
            logger.info(f"✅ Parse complete: {parse_stats.valid_rows}/{parse_stats.total_rows} items, "
                       f"encoding={parse_stats.encoding_used}, "
                       f"detected={parse_stats.detected_columns}")

            gate_log("File parsing complete", job_id=job_id, bom_file=file.filename,
                    total_rows=parse_stats.total_rows, valid_rows=parse_stats.valid_rows,
                    encoding=parse_stats.encoding_used)

            if not bom_items:
                raise HTTPException(status_code=400, detail="No valid items found in BOM file")

            # Prepare preview data (first 10 rows)
            preview_data = bom_items[:10]

            # Create BOM job record with multi-tenancy support
            gate_log("Creating BOM job", job_id=job_id, total_items=len(bom_items),
                    organization_id=organization_id, project_id=project_id)

            bom_repo = BOMRepository(db)
            job = bom_repo.create_job({
                "job_id": job_id,
                "customer_id": customer_id,
                "customer_name": customer_name,
                "filename": file.filename,
                "file_size": file_size,
                "total_items": len(bom_items),
                "status": "pending",
                "organization_id": organization_id,
                "project_id": project_id,
                "source": source,
                "priority": 5  # Default priority
            })

            gate_log("BOM job created", job_id=job_id, status="pending", total_items=len(bom_items))

            resolved_org_id = organization_id or job.organization_id
            if resolved_org_id:
                # Record upload audit event for both customer and staff uploads
                event_prefix = "customer.bom" if source == "customer" else "cns.bulk"
                event_source = "customer_portal" if source == "customer" else "cns-dashboard"

                try:
                    record_audit_log_entry(
                        db,
                        event_type=f"{event_prefix}.uploaded",
                        routing_key=f"{event_prefix}.uploaded",
                        organization_id=resolved_org_id,
                        user_id=user_id,
                        username=user_email or user_id,
                        email=user_email,
                        source=event_source,
                        event_data={
                            "job_id": job_id,
                            "bom_id": job_id,
                            "upload_id": job_id,
                            "filename": file.filename,
                            "bom_name": file.filename,
                            "total_items": len(bom_items),
                            "project_id": project_id,
                            "organization_id": resolved_org_id,
                        },
                    )
                    logger.info(f"✅ Recorded {event_prefix}.uploaded audit event for job {job_id}")
                except Exception as audit_error:
                    logger.warning(
                        f"Failed to record upload audit log for job {job_id}: {audit_error}",
                        exc_info=True,
                    )

            # Store BOM items and parsed data for user review
            # Status='pending' means awaiting user confirmation
            logger.info(f"Storing {len(bom_items)} BOM items with detected mappings...")
            try:
                from sqlalchemy import text

                # Store BOM items
                for idx, item in enumerate(bom_items):
                    db.execute(text("""
                        INSERT INTO bom_items (
                            job_id, line_number, mpn, manufacturer,
                            quantity, reference_designator, description
                        )
                        VALUES (:job_id, :line_number, :mpn, :manufacturer,
                                :quantity, :reference_designator, :description)
                    """), {
                        "job_id": job_id,
                        "line_number": idx + 1,
                        "mpn": item.get('mpn'),
                        "manufacturer": item.get('manufacturer'),
                        "quantity": item.get('quantity', 1),
                        "reference_designator": item.get('reference_designator'),
                        "description": item.get('description')
                    })

                # Store parse stats and detected mappings in job source_metadata
                import json
                metadata_json = json.dumps({
                    "detected_columns": parse_stats.detected_columns,
                    "unmapped_columns": parse_stats.unmapped_columns,
                    "file_type": parse_stats.file_type,
                    "encoding_used": parse_stats.encoding_used,
                    "total_rows": parse_stats.total_rows,
                    "valid_rows": parse_stats.valid_rows,
                    "audit": {
                        "user_email": user_email,
                        "user_id": user_id,
                        "organization_id": organization_id,
                        "project_id": project_id,
                        "source": source
                    }
                })
                db.execute(text("""
                    UPDATE bom_jobs
                    SET source_metadata = :metadata
                    WHERE job_id = :job_id
                """), {
                    "job_id": job_id,
                    "metadata": metadata_json
                })

                db.commit()
                logger.info(f"✅ Stored {len(bom_items)} items with detected mappings")
            except Exception as e:
                logger.error(f"Failed to store BOM data: {e}")
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Failed to store BOM data: {e}")

            # Return detected mappings and preview data for user review
            logger.info(f"✅ BOM parsed successfully: {job_id} ({len(bom_items)} items) - awaiting user confirmation")

            return BOMUploadResponse(
                job_id=job_id,
                filename=file.filename,
                total_items=len(bom_items),
                status="pending",  # Awaiting user confirmation
                detected_columns=parse_stats.detected_columns,
                unmapped_columns=parse_stats.unmapped_columns,
                file_type=parse_stats.file_type,
                encoding_used=parse_stats.encoding_used,
                preview_data=preview_data,
                message=f"BOM parsed successfully. Please review the detected field mappings and preview data."
            )

    except ValueError as e:
        logger.error(f"BOM parsing error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"BOM upload error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during BOM upload")


class BOMConfirmRequest(BaseModel):
    """User-confirmed column mappings"""
    column_mappings: dict  # {field_name: column_name or None}


@router.post("/jobs/{job_id}/confirm")
async def confirm_bom_mapping(
    job_id: str,
    request: BOMConfirmRequest,
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Confirm BOM field mappings and trigger processing

    User reviews detected mappings, makes changes if needed, then confirms.
    This triggers the Temporal workflow for enrichment.

    NOTE: Checks both Supabase and Components V2 databases to find the job
    """
    # Get dual database manager
    dual_db = get_dual_database()

    # Try to find job in both databases
    job = None
    db = None

    # Try Supabase first (customer uploads)
    try:
        for supabase_session in dual_db.get_session("supabase"):
            bom_repo_supabase = BOMRepository(supabase_session)
            job = bom_repo_supabase.get_by_job_id(job_id)
            if job:
                db = supabase_session
                logger.info(f"🔍 Found job {job_id} in Supabase database")
                break
    except Exception as e:
        logger.warning(f"Error checking Supabase for job {job_id}: {e}")

    # If not found in Supabase, try Components V2 (staff uploads)
    if not job:
        try:
            for components_session in dual_db.get_session("components"):
                bom_repo_components = BOMRepository(components_session)
                job = bom_repo_components.get_by_job_id(job_id)
                if job:
                    db = components_session
                    logger.info(f"🔍 Found job {job_id} in Components V2 database")
                    break
        except Exception as e:
            logger.warning(f"Error checking Components V2 for job {job_id}: {e}")

    # If still not found, raise 404
    if not job or not db:
        raise HTTPException(status_code=404, detail=f"BOM job not found: {job_id}")

    if job.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Job already confirmed (status: {job.status}). Cannot re-confirm."
        )

    logger.info(f"User confirmed mappings for job {job_id}: {request.column_mappings}")

    # Update job metadata with confirmed mappings
    try:
        from sqlalchemy import text
        import json

        # Get current metadata
        current_metadata = job.source_metadata or {}
        current_metadata['confirmed_mappings'] = request.column_mappings
        current_metadata['mapping_confirmed_at'] = datetime.utcnow().isoformat()

        # Prepare metadata JSON string (be tolerant of datetimes/decimals)
        try:
            metadata_json = json.dumps(current_metadata, default=str)
        except TypeError:
            # Fallback: coerce to dict and stringify non-serializables
            safe_meta = {}
            for k, v in (current_metadata.items() if isinstance(current_metadata, dict) else []):
                try:
                    json.dumps(v)  # test
                    safe_meta[k] = v
                except TypeError:
                    safe_meta[k] = str(v)
            metadata_json = json.dumps(safe_meta)

        db.execute(text("""
            UPDATE bom_jobs
            SET source_metadata = :metadata,
                status = 'queued'
            WHERE job_id = :job_id
        """), {
            "job_id": job_id,
            "metadata": metadata_json
        })
        db.commit()

        logger.info(f"✅ Confirmed mappings stored for job {job_id}")
    except Exception as e:
        logger.error(f"Failed to update confirmed mappings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to store confirmed mappings: {e}")

    # Trigger Temporal workflow for BOM enrichment
    workflow_id = None
    try:
        # Import new Temporal client helper
        from app.workflows.temporal_client import start_bom_enrichment

        # Determine organization_id (prioritize organization_id, fallback to customer_id)
        organization_id = str(job.organization_id) if job.organization_id else str(job.customer_id) if job.customer_id else "default"

        # Start BOM enrichment workflow
        workflow_id = await start_bom_enrichment(
            job_id=job_id,
            bom_id=job_id,  # Using job_id as bom_id for now (can be different if needed)
            organization_id=organization_id,
            total_items=job.total_items,
            project_id=str(job.project_id) if job.project_id else None
        )

        logger.info(f"✅ Temporal workflow started: {workflow_id} for job: {job_id}")

        # Update job status to processing
        db.execute(text("""
            UPDATE bom_jobs
            SET status = 'processing',
                progress = 0,
                updated_at = NOW()
            WHERE job_id = :job_id
        """), {"job_id": job_id})
        db.commit()

        # Record upload_completed audit event (after user confirms and before enrichment starts)
        try:
            # Determine event prefix based on source
            source = job.source or "customer"
            event_prefix = "customer.bom" if source == "customer" else "cns.bulk"
            event_source = "customer_portal" if source == "customer" else "cns-dashboard"

            # Get user metadata from job source_metadata if available
            source_metadata = job.source_metadata or {}
            audit_meta = source_metadata.get('audit', {}) if isinstance(source_metadata, dict) else {}
            user_email = audit_meta.get('user_email')
            user_id_from_meta = audit_meta.get('user_id')

            record_audit_log_entry(
                db,
                event_type=f"{event_prefix}.upload_completed",
                routing_key=f"{event_prefix}.upload_completed",
                organization_id=organization_id,
                user_id=user_id_from_meta,
                username=user_email or user_id_from_meta,
                email=user_email,
                source=event_source,
                event_data={
                    "job_id": job_id,
                    "bom_id": job_id,
                    "upload_id": job_id,
                    "bom_name": job.filename,
                    "project_id": str(job.project_id) if job.project_id else None,
                    "total_items": job.total_items,
                    "workflow_id": workflow_id,
                    "mappings_confirmed": True,
                    "organization_id": organization_id,
                },
            )
            logger.info(f"✅ Recorded {event_prefix}.upload_completed audit event for job {job_id}")
        except Exception as audit_error:
            logger.warning(
                f"Failed to record upload_completed audit log for job {job_id}: {audit_error}",
                exc_info=True,
            )

    except Exception as e:
        logger.error(f"❌ Failed to start Temporal workflow for job {job_id}: {e}", exc_info=True)
        logger.warning("⚠️  Falling back to threading for background processing")

        # Fallback to threading if Temporal is unavailable
        import threading
        from sqlalchemy import text

        # Get BOM items from database
        items_result = db.execute(text("""
            SELECT id, manufacturer_part_number, manufacturer, quantity, reference_designator, description
            FROM bom_line_items
            WHERE job_id = :job_id
            ORDER BY line_number
        """), {"job_id": job_id})

        bom_items = [
            {
                'id': row[0],
                'manufacturer_part_number': row[1],
                'manufacturer': row[2],
                'quantity': row[3],
                'reference_designator': row[4],
                'description': row[5]
            }
            for row in items_result
        ]

        # Start background thread for processing
        def process_bom_job_background(job_id, items, organization_id):
            """
            Background thread fallback for BOM processing.

            IMPORTANT: Creates its own database sessions to avoid transaction errors.
            The parent request's database session is closed after the endpoint returns,
            so we must create fresh sessions within this thread.

            Environment Variables:
                DEBUG_BOM_PROCESSING: Set to 'true' for detailed console logging
            """
            import os
            import asyncio
            from datetime import datetime
            debug_mode = os.getenv('DEBUG_BOM_PROCESSING', 'false').lower() == 'true'

            def debug_log(message):
                """Conditional debug logging to console"""
                if debug_mode:
                    print(f"[DEBUG BOM] {message}", flush=True)
                logger.info(message)

            def send_ws_event(event: str, data: dict):
                """Send WebSocket event from sync thread"""
                try:
                    from app.api.websocket import get_connection_manager
                    manager = get_connection_manager()

                    # Check if there are any connected clients
                    if manager.get_connection_count(job_id) > 0:
                        # Create new event loop for this thread
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        try:
                            loop.run_until_complete(
                                manager.broadcast_to_job(job_id, {
                                    "event": event,
                                    "job_id": job_id,
                                    "data": data,
                                    "timestamp": datetime.utcnow().isoformat() + "Z"
                                })
                            )
                        finally:
                            loop.close()
                except Exception as e:
                    logger.warning(f"Failed to send WebSocket event: {e}")

            debug_log(f"🔄 Background processing started for job {job_id} ({len(items)} items)")
            debug_log(f"   Tenant ID: {organization_id}")
            debug_log(f"   Debug mode: {'ENABLED' if debug_mode else 'DISABLED'}")

            # Send initial WebSocket event
            send_ws_event("status_change", {
                "status": "processing",
                "message": f"Started processing {len(items)} items",
                "total_items": len(items)
            })

            # Create fresh database session for this background thread
            # DO NOT reuse parent session (it will be closed)
            from app.database import get_supabase_db

            try:
                debug_log("📦 Initializing component catalog service...")
                from app.services.component_catalog import get_component_catalog

                catalog = get_component_catalog()
                debug_log("✅ Component catalog initialized")

                enriched_count = 0
                failed_count = 0

                for idx, item in enumerate(items):
                    mpn = item.get('mpn', 'UNKNOWN')
                    manufacturer = item.get('manufacturer', 'UNKNOWN')

                    debug_log(f"\n--- Item {idx + 1}/{len(items)} ---")
                    debug_log(f"   MPN: {mpn}")
                    debug_log(f"   Manufacturer: {manufacturer}")

                    try:
                        debug_log(f"   🔍 Looking up component in catalog...")
                        # Lookup or enrich component
                        component = catalog.lookup_or_enrich_component(
                            mpn=mpn,
                            manufacturer=manufacturer
                        )

                        if component:
                            enriched_count += 1
                            component_id = component.get('id', 'NO_ID')
                            debug_log(f"   ✅ Component found/enriched: {component_id}")

                            # Update line item with component_id (using fresh session)
                            try:
                                debug_log(f"   💾 Updating line item {item['id']} in database...")
                                thread_db = get_supabase_db()  # Fresh session for this thread
                                thread_db.execute(text("""
                                    UPDATE bom_line_items
                                    SET component_id = :component_id,
                                        enrichment_status = 'completed',
                                        updated_at = NOW()
                                    WHERE id = :item_id
                                """), {
                                    "component_id": component_id,
                                    "item_id": item['id']
                                })
                                thread_db.commit()
                                debug_log(f"   ✅ Line item updated successfully")

                                # Send WebSocket event for item completion
                                send_ws_event("item_completed", {
                                    "item_number": idx + 1,
                                    "total_items": len(items),
                                    "mpn": mpn,
                                    "manufacturer": manufacturer,
                                    "component_id": component_id
                                })
                            except Exception as db_err:
                                logger.error(f"Failed to update line item {item['id']}: {db_err}")
                                debug_log(f"   ❌ Database error: {db_err}")
                                thread_db.rollback()
                        else:
                            failed_count += 1
                            debug_log(f"   ⚠️  Component not found and enrichment failed")

                        # Update job progress (using fresh session)
                        progress = int((idx + 1) / len(items) * 100)

                        try:
                            debug_log(f"   📊 Updating job progress to {progress}%...")
                            thread_db = get_supabase_db()  # Fresh session
                            thread_db.execute(text("""
                                UPDATE bom_jobs
                                SET progress = :progress,
                                    updated_at = NOW()
                                WHERE job_id = :job_id
                            """), {
                                "progress": progress,
                                "job_id": job_id
                            })
                            thread_db.commit()
                            debug_log(f"   ✅ Progress updated")

                            # Send WebSocket progress event
                            send_ws_event("progress", {
                                "progress": progress,
                                "total_items": len(items),
                                "enriched_count": enriched_count,
                                "failed_count": failed_count,
                                "current_item": idx + 1,
                                "message": f"Processing item {idx + 1}/{len(items)}"
                            })
                        except Exception as db_err:
                            logger.error(f"Failed to update job progress: {db_err}")
                            debug_log(f"   ❌ Progress update error: {db_err}")
                            thread_db.rollback()

                        logger.info(f"Job {job_id}: {progress}% ({idx + 1}/{len(items)}) - Enriched: {enriched_count}, Failed: {failed_count}")

                    except Exception as e:
                        failed_count += 1
                        logger.error(f"Failed to process item {mpn}: {e}")
                        debug_log(f"   ❌ Processing error: {e}")

                        # Mark item as failed (using fresh session)
                        try:
                            debug_log(f"   💾 Marking item as failed in database...")
                            thread_db = get_supabase_db()  # Fresh session
                            thread_db.execute(text("""
                                UPDATE bom_line_items
                                SET enrichment_status = 'failed',
                                    enrichment_error = :error,
                                    updated_at = NOW()
                                WHERE id = :item_id
                            """), {
                                "error": str(e)[:500],  # Limit error message length
                                "item_id": item['id']
                            })
                            thread_db.commit()
                            debug_log(f"   ✅ Item marked as failed")

                            # Send WebSocket event for item failure
                            send_ws_event("item_failed", {
                                "item_number": idx + 1,
                                "total_items": len(items),
                                "mpn": mpn,
                                "manufacturer": manufacturer,
                                "error": str(e)[:200]
                            })
                        except Exception as db_err:
                            logger.error(f"Failed to mark item as failed: {db_err}")
                            debug_log(f"   ❌ Failed to mark item as failed: {db_err}")
                            thread_db.rollback()

                # Mark job as completed (using fresh session)
                try:
                    debug_log(f"\n🏁 Finalizing job status...")
                    thread_db = get_supabase_db()  # Fresh session
                    final_status = 'completed' if failed_count == 0 else 'completed_with_errors'
                    debug_log(f"   Final status: {final_status}")
                    debug_log(f"   Total enriched: {enriched_count}")
                    debug_log(f"   Total failed: {failed_count}")

                    thread_db.execute(text("""
                        UPDATE bom_jobs
                        SET status = :status,
                            progress = 100,
                            updated_at = NOW()
                        WHERE job_id = :job_id
                    """), {
                        "status": final_status,
                        "job_id": job_id
                    })
                    thread_db.commit()
                    debug_log(f"   ✅ Job marked as {final_status}")

                    # Send WebSocket completion event
                    send_ws_event("completed", {
                        "status": final_status,
                        "total_items": len(items),
                        "enriched_count": enriched_count,
                        "failed_count": failed_count,
                        "message": f"Processing complete: {enriched_count} enriched, {failed_count} failed"
                    })
                except Exception as db_err:
                    logger.error(f"Failed to mark job as completed: {db_err}")
                    debug_log(f"   ❌ Failed to finalize job: {db_err}")
                    thread_db.rollback()

                logger.info(f"✅ Background processing completed for job {job_id} - Enriched: {enriched_count}, Failed: {failed_count}")
                debug_log(f"\n✅ BACKGROUND PROCESSING COMPLETE")
                debug_log(f"   Job ID: {job_id}")
                debug_log(f"   Total items: {len(items)}")
                debug_log(f"   Enriched: {enriched_count}")
                debug_log(f"   Failed: {failed_count}")

            except Exception as e:
                logger.error(f"❌ Background processing failed for job {job_id}: {e}", exc_info=True)
                debug_log(f"\n❌ BACKGROUND PROCESSING FAILED")
                debug_log(f"   Job ID: {job_id}")
                debug_log(f"   Error: {e}")

                # Mark job as failed (using fresh session)
                try:
                    debug_log(f"   💾 Marking job as failed...")
                    thread_db = get_supabase_db()  # Fresh session
                    thread_db.execute(text("""
                        UPDATE bom_jobs
                        SET status = 'failed',
                            updated_at = NOW()
                        WHERE job_id = :job_id
                    """), {"job_id": job_id})
                    thread_db.commit()
                    debug_log(f"   ✅ Job marked as failed")

                    # Send WebSocket error event
                    send_ws_event("error", {
                        "status": "failed",
                        "error": str(e)[:200],
                        "message": "Background processing failed"
                    })
                except Exception as db_err:
                    logger.error(f"Failed to mark job as failed: {db_err}")
                    debug_log(f"   ❌ Could not mark job as failed: {db_err}")
                    thread_db.rollback()

        thread = threading.Thread(
            target=process_bom_job_background,
            args=(job_id, bom_items, organization_id),
            daemon=True
        )
        thread.start()
        logger.info(f"⚠️  Background thread started (Temporal fallback) for job: {job_id}")

    return {
        "job_id": job_id,
        "status": "processing",
        "message": "BOM processing started with confirmed mappings"
    }


@router.get("/status/{job_id}", response_model=BOMJobStatus)
@require_role(Role.ANALYST)  # Any authenticated user can check status
def get_bom_status(
    job_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Get BOM job processing status. Requires authentication.

    Args:
        job_id: BOM job ID from upload response

    Returns:
        Job status with processing progress

    Example:
        ```bash
        curl "http://localhost:8003/api/bom/status/550e8400-e29b-41d4-a716-446655440000"
        ```
    """
    gate_log("Status check requested", job_id=job_id, user_id=auth.user_id)

    bom_repo = BOMRepository(db)
    job = bom_repo.get_by_job_id(job_id)

    if not job:
        gate_log("Status check failed: Job not found", job_id=job_id)
        raise HTTPException(status_code=404, detail=f"BOM job not found: {job_id}")

    # APP-LAYER RLS: Non-super_admins can only access their organization's jobs
    job_org_id = str(job.organization_id) if job.organization_id else None
    if job_org_id and not auth.is_super_admin and auth.organization_id != job_org_id:
        raise HTTPException(status_code=403, detail="Access denied to this job")

    gate_log("Status retrieved", job_id=job_id, status=job.status, progress=job.progress,
            items_processed=job.items_processed, total_items=job.total_items)

    return BOMJobStatus(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        total_items=job.total_items,
        items_processed=job.items_processed,
        items_auto_approved=job.items_auto_approved,
        items_in_staging=job.items_in_staging,
        items_rejected=job.items_rejected,
        items_failed=job.items_failed,
        started_at=job.started_at,
        completed_at=job.completed_at,
        processing_time_ms=job.processing_time_ms,
        error_message=job.error_message
    )


@router.get("/results/{job_id}", response_model=BOMResults)
@require_role(Role.ANALYST)  # Any authenticated user can view results
def get_bom_results(
    job_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Get BOM processing results. Requires authentication.

    Args:
        job_id: BOM job ID

    Returns:
        Complete results with routing decisions for each item

    Example:
        ```bash
        curl "http://localhost:8003/api/bom/results/550e8400-e29b-41d4-a716-446655440000"
        ```
    """
    gate_log("Results retrieval requested", job_id=job_id, user_id=auth.user_id)

    bom_repo = BOMRepository(db)
    job = bom_repo.get_by_job_id(job_id)

    if not job:
        gate_log("Results retrieval failed: Job not found", job_id=job_id)
        raise HTTPException(status_code=404, detail=f"BOM job not found: {job_id}")

    # APP-LAYER RLS: Non-super_admins can only access their organization's jobs
    job_org_id = str(job.organization_id) if job.organization_id else None
    if job_org_id and not auth.is_super_admin and auth.organization_id != job_org_id:
        raise HTTPException(status_code=403, detail="Access denied to this job")

    if job.status not in ['completed', 'failed']:
        gate_log("Results retrieval failed: Job still processing", job_id=job_id, status=job.status)
        raise HTTPException(
            status_code=400,
            detail=f"Job is still processing (status: {job.status})"
        )

    # Extract results from results_data JSONB field
    results = []
    if job.results_data:
        for item in job.results_data.get('items', []):
            results.append(BOMItem(
                mpn=item['mpn'],
                manufacturer=item.get('manufacturer'),
                quality_score=item['quality_score'],
                routing=item['routing'],
                issues=item.get('issues', []),
                catalog_id=item.get('catalog_id')
            ))

    gate_log("Results retrieved", job_id=job_id, status=job.status,
            total_items=job.total_items, result_count=len(results))

    return BOMResults(
        job_id=job_id,
        status=job.status,
        total_items=job.total_items,
        results=results
    )


# Background task for BOM processing
def process_bom_job(job_id: str, bom_items: List[dict], customer_id: Optional[int] = None):
    """
    Background task to process BOM items

    This runs asynchronously after BOM upload:
    1. Check local catalog first (fast)
    2. Query supplier APIs if not found (auto-import)
    3. Normalize each component
    4. Calculate quality score
    5. Route to production/staging/rejected based on score
    6. Update job progress

    Args:
        job_id: BOM job ID
        bom_items: List of parsed BOM items
        customer_id: Customer ID (if applicable)
    """
    # Comprehensive error tracking
    import sys
    import traceback
    import os
    from datetime import datetime as dt

    # Use absolute path for error log
    error_log_file = os.path.join(os.getcwd(), "bom_background_errors.log")

    def log_error(message):
        """Log errors to both file and database"""
        timestamp = dt.utcnow().isoformat()
        try:
            with open(error_log_file, 'a', encoding='utf-8') as f:
                f.write(f"{timestamp} - {job_id} - {message}\n")
        except Exception as e:
            print(f"FAILED TO WRITE LOG: {e}", file=sys.stderr, flush=True)
        print(f"BOM_TASK [{job_id}]: {message}", file=sys.stderr, flush=True)

    try:
        log_error(f"🚀 Background task STARTED with {len(bom_items)} items")
        logger.info(f"🚀 Background task STARTED for job: {job_id} with {len(bom_items)} items")

        from app.models.base import get_database
        from app.services.supplier_enrichment import SupplierEnrichmentService
        from app.services.supplier_manager_service import get_supplier_manager
        from app.config import settings

        log_error(f"📦 Imports complete, getting database...")
        db_instance = get_database()
        db = db_instance.SessionLocal()
        log_error(f"✅ Database session created")

        bom_repo = BOMRepository(db)
        catalog_repo = CatalogRepository(db)
        enrichment_repo = EnrichmentRepository(db)

        log_error(f"✅ Repositories initialized")

        # Initialize supplier enrichment service using token-aware helper
        supplier_enrichment = None
        enabled_suppliers = settings.get_enabled_tier1_suppliers()

        if enabled_suppliers:
            logger.info(f"Initializing supplier enrichment with: {', '.join(enabled_suppliers)}")

            # Use get_supplier_manager() to load persisted tokens (DigiKey access/refresh tokens)
            supplier_manager = get_supplier_manager()
            supplier_enrichment = SupplierEnrichmentService(supplier_manager, db)
        else:
            logger.info("No supplier APIs enabled - processing with local data only")

        # Mark job as started
        bom_repo.update_job_status(job_id, status="processing", started_at=datetime.utcnow())

        total_items = len(bom_items)
        results = []

        items_auto_approved = 0
        items_in_staging = 0
        items_rejected = 0
        items_failed = 0

        start_time = datetime.utcnow()

        for idx, item in enumerate(bom_items):
            try:
                mpn = item.get('mpn')
                if not mpn:
                    items_failed += 1
                    results.append({
                        'mpn': 'UNKNOWN',
                        'quality_score': 0.0,
                        'routing': 'rejected',
                        'issues': ['Missing MPN']
                    })
                    continue

                # Step 1: Check if component exists in local catalog OR enrich from suppliers
                enriched_data = None

                if supplier_enrichment:
                    # 2-step matching: Check local catalog first, then query suppliers
                    enriched_data = supplier_enrichment.enrich_component(
                        mpn=mpn,
                        manufacturer=item.get('manufacturer'),
                        min_confidence=90.0
                    )

                    if enriched_data:
                        if enriched_data.get('is_new'):
                            logger.info(f"✅ New component imported from {enriched_data.get('source_supplier')}: {mpn}")
                        else:
                            logger.info(f"✅ Existing component found in catalog: {mpn}")

                # Step 2: Normalize component data (use enriched data if available)
                if enriched_data:
                    # Use enriched data from supplier or catalog
                    normalized = enriched_data
                else:
                    # Fallback to basic normalization with BOM data only
                    normalized = normalize_component_data(item)

                # Calculate quality score
                quality_result = calculate_quality_score(normalized)

                # Route based on quality score
                if quality_result.routing == QualityRouting.PRODUCTION:
                    # Auto-approve to production catalog
                    catalog_component = catalog_repo.create({
                        'mpn': normalized['mpn'],
                        'manufacturer': normalized.get('manufacturer'),
                        'category': normalized.get('category'),
                        'description': normalized.get('description'),
                        'datasheet_url': normalized.get('datasheet_url'),
                        'image_url': normalized.get('image_url'),
                        'lifecycle': normalized.get('lifecycle_status'),
                        'rohs': normalized.get('rohs_status'),
                        'reach': normalized.get('reach_status'),
                        'specifications': normalized.get('extracted_specs', {}),
                        'pricing': normalized.get('pricing', []),
                        'quality_score': quality_result.total_score,
                        'enrichment_source': 'customer_bom',
                        'created_by': customer_id
                    })
                    items_auto_approved += 1
                    results.append({
                        'mpn': normalized['mpn'],
                        'manufacturer': normalized.get('manufacturer'),
                        'quality_score': quality_result.total_score,
                        'routing': 'production',
                        'issues': quality_result.issues,
                        'catalog_id': catalog_component.id
                    })

                elif quality_result.routing == QualityRouting.STAGING:
                    # Send to staging for manual review
                    enrichment_repo.create_queue_item(
                        mpn=normalized['mpn'],
                        enrichment_data=normalized,
                        ai_suggestions=[],  # Will be populated by AI later
                        quality_score=quality_result.total_score,
                        issues=quality_result.issues,
                        enrichment_source='customer_bom',
                        customer_id=customer_id,
                        bom_job_id=job_id
                    )
                    items_in_staging += 1
                    results.append({
                        'mpn': normalized['mpn'],
                        'manufacturer': normalized.get('manufacturer'),
                        'quality_score': quality_result.total_score,
                        'routing': 'staging',
                        'issues': quality_result.issues
                    })

                else:  # REJECTED
                    # Log to history but don't add to catalog
                    enrichment_repo.create_history(
                        mpn=normalized['mpn'],
                        enrichment_data=normalized,
                        quality_score=quality_result.total_score,
                        status='rejected',
                        rejection_reason='Quality score too low',
                        issues=quality_result.issues,
                        enrichment_source='customer_bom',
                        customer_id=customer_id,
                        bom_job_id=job_id
                    )
                    items_rejected += 1
                    results.append({
                        'mpn': normalized['mpn'],
                        'manufacturer': normalized.get('manufacturer'),
                        'quality_score': quality_result.total_score,
                        'routing': 'rejected',
                        'issues': quality_result.issues
                    })

            except Exception as e:
                logger.error(f"Error processing item {idx}: {e}")
                items_failed += 1
                results.append({
                    'mpn': item.get('mpn', 'UNKNOWN'),
                    'quality_score': 0.0,
                    'routing': 'failed',
                    'issues': [str(e)]
                })

            # Update progress
            progress = int(((idx + 1) / total_items) * 100)
            bom_repo.update_job_progress(
                job_id,
                progress=progress,
                items_processed=idx + 1,
                items_auto_approved=items_auto_approved,
                items_in_staging=items_in_staging,
                items_rejected=items_rejected,
                items_failed=items_failed
            )

        # Mark job as completed
        end_time = datetime.utcnow()
        processing_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Log enrichment statistics if supplier enrichment was used
        if supplier_enrichment:
            enrichment_stats = supplier_enrichment.get_stats()
            logger.info(f"📊 Enrichment Statistics:")
            logger.info(f"  - Matched existing: {enrichment_stats['matched_existing']}")
            logger.info(f"  - Newly imported: {enrichment_stats['newly_imported']}")
            logger.info(f"  - Import failed: {enrichment_stats['import_failed']}")
            logger.info(f"  - Vendors used: {enrichment_stats['vendors_used']}")

            # Add enrichment stats to results
            results_data = {
                'items': results,
                'enrichment_stats': enrichment_stats
            }
        else:
            results_data = {'items': results}

        bom_repo.complete_job(
            job_id,
            results_data=results_data,
            processing_time_ms=processing_time_ms
        )

        log_error(f"✅ BOM job completed: {job_id} ({total_items} items, {processing_time_ms}ms)")
        logger.info(f"✅ BOM job completed: {job_id} ({total_items} items, {processing_time_ms}ms)")

    except Exception as e:
        error_details = f"❌ BOM job failed: {job_id} - {type(e).__name__}: {str(e)}"
        error_trace = traceback.format_exc()

        log_error(error_details)
        log_error(f"Full traceback:\n{error_trace}")
        logger.error(error_details)
        logger.error(error_trace)

        try:
            bom_repo.fail_job(job_id, error_message=f"{error_details}\n\n{error_trace}")
        except Exception as fail_error:
            log_error(f"Failed to update job failure status: {fail_error}")

    finally:
        try:
            db.close()
            log_error(f"✅ Database connection closed")
        except Exception as close_error:
            log_error(f"Error closing database: {close_error}")


# =====================================================================
# Multi-File BOM Merge Endpoint
# =====================================================================

class BOMMergeRequest(BaseModel):
    """Request model for merging multiple BOM files"""
    merge_strategy: str = Field(default="sum_quantity", description="sum_quantity, max_quantity, or first_only")
    name: Optional[str] = Field(default=None, description="Name for merged BOM")
    description: Optional[str] = Field(default=None, description="Description for merged BOM")


@router.post("/merge", response_model=BOMUploadResponse)
async def merge_bom_files(
    files: List[UploadFile] = File(...),
    merge_strategy: str = Form("sum_quantity"),
    customer_id: Optional[int] = Form(None),
    customer_name: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    project_id: Optional[int] = Form(None),
    source: str = Form("customer"),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    user_email: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None)
):
    """
    Merge multiple BOM files into a single BOM

    Supports all file formats: CSV, XLSX, XLS, TXT, TSV

    Merge Strategies:
    - sum_quantity: Sum quantities for duplicate part numbers (default)
    - max_quantity: Take maximum quantity for duplicates
    - first_only: Keep first occurrence, ignore duplicates

    Example:
        ```bash
        curl -X POST "http://localhost:27500/cns-api/api/bom/merge" \\
          -F "files=@bom1.csv" \\
          -F "files=@bom2.xlsx" \\
          -F "files=@bom3.csv" \\
          -F "merge_strategy=sum_quantity" \\
          -F "customer_id=123" \\
          -F "source=customer"
        ```
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")

    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required for merge")

    logger.info(f"📦 Merging {len(files)} BOM files with strategy: {merge_strategy}")

    # Validate merge strategy
    valid_strategies = ['sum_quantity', 'max_quantity', 'first_only']
    if merge_strategy not in valid_strategies:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid merge strategy. Must be one of: {', '.join(valid_strategies)}"
        )

    # Always write merged results to Supabase for unified storage
    try:
        with get_db_for_upload(source) as db:
            # Step 1: Parse all files
            all_bom_items = []
            file_stats = []
            all_detected_columns = {}

        for idx, file in enumerate(files):
            logger.info(f"  📄 [{idx+1}/{len(files)}] Parsing {file.filename}")

            # Validate file type
            if not file.filename:
                raise HTTPException(status_code=400, detail=f"File {idx+1} has no filename")

            file_ext = file.filename.lower().split('.')[-1]
            if file_ext not in ['csv', 'xlsx', 'xls', 'txt', 'tsv']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type for {file.filename}: {file_ext}. Supported: csv, xlsx, xls, txt, tsv"
                )

            # Read and parse file
            content = await file.read()
            file_size = len(content)

            try:
                parser = BOMParserV2(content, file.filename)
                bom_items, parse_stats = parser.parse()
            except BOMParseError as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse {file.filename}: {str(e)}")

            if not bom_items:
                logger.warning(f"⚠️  {file.filename} contains no valid items, skipping")
                continue

            logger.info(f"  ✅ Parsed {len(bom_items)} items from {file.filename}")

            # Track source file for each item
            for item in bom_items:
                item['source_file'] = file.filename

            all_bom_items.extend(bom_items)
            file_stats.append({
                'filename': file.filename,
                'items': len(bom_items),
                'detected_columns': parse_stats.detected_columns,
                'file_type': parse_stats.file_type,
                'encoding': parse_stats.encoding_used
            })

            # Collect all detected columns
            for field, col in parse_stats.detected_columns.items():
                if field not in all_detected_columns and col:
                    all_detected_columns[field] = col

        if not all_bom_items:
            raise HTTPException(status_code=400, detail="No valid items found in any of the uploaded files")

        logger.info(f"  📊 Total items before merge: {len(all_bom_items)}")

        # Step 2: Merge items by MPN (manufacturer part number)
        merged_items = {}

        for item in all_bom_items:
            mpn = item.get('mpn', '').strip().upper()
            if not mpn:
                continue

            manufacturer = item.get('manufacturer', '').strip()
            quantity = item.get('quantity', 1)

            # Create unique key: MPN + Manufacturer
            key = f"{mpn}|{manufacturer}"

            if key in merged_items:
                # Merge logic based on strategy
                if merge_strategy == 'sum_quantity':
                    merged_items[key]['quantity'] += quantity
                    merged_items[key]['source_files'].append(item.get('source_file', 'unknown'))
                elif merge_strategy == 'max_quantity':
                    if quantity > merged_items[key]['quantity']:
                        merged_items[key]['quantity'] = quantity
                    merged_items[key]['source_files'].append(item.get('source_file', 'unknown'))
                elif merge_strategy == 'first_only':
                    # Keep first occurrence, just track source
                    merged_items[key]['source_files'].append(item.get('source_file', 'unknown'))
            else:
                # First occurrence
                merged_items[key] = {
                    'mpn': mpn,
                    'manufacturer': manufacturer,
                    'quantity': quantity,
                    'reference_designator': item.get('reference_designator', ''),
                    'description': item.get('description', ''),
                    'source_files': [item.get('source_file', 'unknown')]
                }

        # Convert to list
        final_items = list(merged_items.values())
        logger.info(f"  ✅ Merged to {len(final_items)} unique components using strategy: {merge_strategy}")

        # Step 3: Create merged BOM job
        job_id = str(uuid.uuid4())
        merged_filename = name or f"merged_bom_{len(files)}_files.csv"

        bom_repo = BOMRepository(db)
        job = bom_repo.create_job({
            "job_id": job_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "filename": merged_filename,
            "file_size": sum(stat['items'] for stat in file_stats),
            "total_items": len(final_items),
            "status": "pending",
            "organization_id": organization_id,
            "project_id": project_id,
            "source": source,
            "priority": 5
        })

        # Step 4: Store merged BOM items
        logger.info(f"  💾 Storing {len(final_items)} merged items...")

        try:
            from sqlalchemy import text

            for idx, item in enumerate(final_items):
                db.execute(text("""
                    INSERT INTO bom_items (
                        job_id, line_number, mpn, manufacturer,
                        quantity, reference_designator, description
                    )
                    VALUES (:job_id, :line_number, :mpn, :manufacturer,
                            :quantity, :reference_designator, :description)
                """), {
                    "job_id": job_id,
                    "line_number": idx + 1,
                    "mpn": item['mpn'],
                    "manufacturer": item['manufacturer'],
                    "quantity": item['quantity'],
                    "reference_designator": item.get('reference_designator', ''),
                    "description": item.get('description', '')
                })

            # Store merge metadata
            import json
            metadata_json = json.dumps({
                "merge_strategy": merge_strategy,
                "source_files": [stat['filename'] for stat in file_stats],
                "file_stats": file_stats,
                "detected_columns": all_detected_columns,
                "total_files_merged": len(files),
                "total_items_before_merge": len(all_bom_items),
                "total_items_after_merge": len(final_items),
                "audit": {
                    "user_email": user_email,
                    "user_id": user_id,
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "source": source
                }
            })

            db.execute(text("""
                UPDATE bom_jobs
                SET source_metadata = :metadata
                WHERE job_id = :job_id
            """), {
                "job_id": job_id,
                "metadata": metadata_json
            })

            db.commit()
            logger.info(f"  ✅ Stored {len(final_items)} merged items with metadata")

        except Exception as e:
            logger.error(f"Failed to store merged BOM items: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to store merged BOM: {e}")

        # Prepare preview data (first 10 items)
        preview_data = [
            {
                'mpn': item['mpn'],
                'manufacturer': item['manufacturer'],
                'quantity': item['quantity'],
                'reference_designator': item.get('reference_designator', ''),
                'description': item.get('description', '')
            }
            for item in final_items[:10]
        ]

        logger.info(f"✅ BOM merge complete: {job_id} ({len(final_items)} items from {len(files)} files)")

        return BOMUploadResponse(
            job_id=job_id,
            filename=merged_filename,
            total_items=len(final_items),
            status="pending",
            detected_columns=all_detected_columns,
            unmapped_columns=[],
            file_type="merged",
            encoding_used="utf-8",
            preview_data=preview_data,
            message=(
                f"Successfully merged {len(files)} files into {len(final_items)} unique components using "
                f"{merge_strategy} strategy. Original item count: {len(all_bom_items)}, "
                f"Merged item count: {len(final_items)}."
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"BOM merge error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during BOM merge: {str(e)}")


@router.post("/bulk-upload", response_model=BOMUploadResponse)
async def bulk_upload_to_central_catalog(
    files: List[UploadFile] = File(...),
    merge_strategy: str = Form("sum_quantity"),
    customer_id: Optional[int] = Form(None),
    customer_name: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    project_id: Optional[int] = Form(None),
    source: str = Form("customer"),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    user_email: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    save_to_central_catalog: bool = Form(True)
):
    """
    Bulk upload multiple BOM files and save enriched components to central catalog

    This endpoint combines file merge functionality with central catalog storage:
    1. Accepts multiple files (CSV, XLSX, XLS, TXT, TSV)
    2. Merges components by MPN+Manufacturer
    3. Creates single BOM job
    4. Enriches components via Temporal workflow
    5. Saves enriched data to central component_catalog (Components V2 DB)
    6. Links BOM line items via component_id foreign key

    Merge Strategies:
    - sum_quantity: Sum quantities for duplicate components (default)
    - max_quantity: Take maximum quantity for duplicates
    - first_only: Keep first occurrence only

    Central Catalog Benefits:
    - Deduplication: Each MPN+Manufacturer stored once
    - Shared enrichment: Enrichment data reused across all customers
    - Cost reduction: Reduces supplier API calls by ~80%
    - Performance: Faster BOM processing after first enrichment
    """
    try:
        logger.info(f"Bulk upload started: {len(files)} files, merge_strategy={merge_strategy}, save_to_central={save_to_central_catalog}")

        # Validate merge strategy
        valid_strategies = ['sum_quantity', 'max_quantity', 'first_only']
        if merge_strategy not in valid_strategies:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid merge strategy. Must be one of: {', '.join(valid_strategies)}"
            )

        # Validate files
        if not files or len(files) == 0:
            raise HTTPException(status_code=400, detail="No files provided")

        # Step 1: Parse all files using BOMParserV2
        all_bom_items = []
        file_stats = []

        for idx, file in enumerate(files):
            filename = file.filename or f"file_{idx + 1}"
            logger.info(f"Parsing file {idx + 1}/{len(files)}: {filename}")

            # Read file content
            content = await file.read()

            # Parse using BOMParserV2 (supports all formats)
            parser = BOMParserV2(content, filename)
            try:
                bom_items, parse_stats = parser.parse()

                # Track per-file stats
                file_stats.append({
                    'filename': filename,
                    'items_before': len(bom_items),
                    'format': parse_stats.get('file_type', 'unknown'),
                    'encoding': parse_stats.get('encoding_used', 'unknown')
                })

                # Add source file tracking to each item
                for item in bom_items:
                    item['_source_file'] = filename

                all_bom_items.extend(bom_items)
                logger.info(f"Parsed {len(bom_items)} items from {filename}")

            except Exception as e:
                logger.error(f"Failed to parse {filename}: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to parse file '{filename}': {str(e)}"
                )

        logger.info(f"Total items before merge: {len(all_bom_items)}")

        # Step 2: Merge components by MPN|Manufacturer key
        merged_items = {}

        for item in all_bom_items:
            mpn = item.get('mpn', '').strip().upper()
            manufacturer = item.get('manufacturer', '').strip()

            if not mpn:
                continue  # Skip items without MPN

            # Create unique key
            key = f"{mpn}|{manufacturer}"

            quantity = item.get('quantity', 1)
            ref = item.get('reference_designator', '')
            desc = item.get('description', '')
            source_file = item.get('_source_file', '')

            if key in merged_items:
                # Handle duplicate based on strategy
                if merge_strategy == 'sum_quantity':
                    merged_items[key]['quantity'] += quantity
                elif merge_strategy == 'max_quantity':
                    if quantity > merged_items[key]['quantity']:
                        merged_items[key]['quantity'] = quantity
                # first_only: do nothing (keep existing)

                # Append reference designators
                if ref and ref not in merged_items[key]['reference_designator']:
                    merged_items[key]['reference_designator'] += f", {ref}"

                # Track source files
                if source_file not in merged_items[key].get('_source_files', []):
                    merged_items[key].setdefault('_source_files', []).append(source_file)
            else:
                # First occurrence
                merged_items[key] = {
                    'mpn': mpn,
                    'manufacturer': manufacturer,
                    'quantity': quantity,
                    'reference_designator': ref,
                    'description': desc,
                    '_source_files': [source_file]
                }

        final_items = list(merged_items.values())
        duplicates_merged = len(all_bom_items) - len(final_items)

        logger.info(f"Items after merge: {len(final_items)}, duplicates merged: {duplicates_merged}")

        # Step 3: Create merged BOM job
        job_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)

        # Determine database routing
        use_supabase = (source == "customer")
        db_label = "Supabase" if use_supabase else "Components V2"

        # Generate merged filename
        if name:
            merged_filename = name
        else:
            merged_filename = f"Bulk Upload ({len(files)} files)"

        # Build source metadata
        source_metadata = {
            'upload_type': 'bulk_upload',
            'merge_strategy': merge_strategy,
            'save_to_central_catalog': save_to_central_catalog,
            'source_files': file_stats,
            'items_before_merge': len(all_bom_items),
            'items_after_merge': len(final_items),
            'duplicates_merged': duplicates_merged,
            'uploaded_by': user_email or 'unknown',
            'upload_timestamp': timestamp.isoformat()
        }

        # Create BOM job record
        bom_job_data = {
            'job_id': job_id,
            'customer_id': customer_id,
            'customer_name': customer_name or 'Unknown',
            'organization_id': organization_id,
            'project_id': project_id,
            'filename': merged_filename,
            'file_size': sum(stat['items_before'] for stat in file_stats),
            'total_items': len(final_items),
            'status': 'pending',
            'progress': 0,
            'source': source,
            'source_metadata': source_metadata,
            'created_at': timestamp,
            'updated_at': timestamp
        }

        if description:
            bom_job_data['description'] = description

        # Initialize BOMRepository with correct database
        bom_repo = BOMRepository(use_supabase=use_supabase)

        # Insert BOM job
        await bom_repo.create_bom_job(bom_job_data)
        logger.info(f"Created bulk upload job {job_id} in {db_label}")

        # Step 4: Insert BOM line items
        line_items = []
        for idx, item in enumerate(final_items):
            line_item = {
                'id': str(uuid.uuid4()),
                'job_id': job_id,
                'line_number': idx + 1,
                'manufacturer_part_number': item['mpn'],
                'manufacturer': item['manufacturer'],
                'quantity': item['quantity'],
                'reference_designator': item['reference_designator'],
                'description': item['description'],
                'enrichment_status': 'pending',
                'created_at': timestamp
            }
            line_items.append(line_item)

        await bom_repo.insert_bom_items_batch(line_items)
        logger.info(f"Inserted {len(line_items)} line items for job {job_id}")

        # Step 5: Auto-detect column mappings
        detected_columns = {
            'mpn': 'mpn',
            'manufacturer': 'manufacturer',
            'quantity': 'quantity',
            'reference_designator': 'reference_designator',
            'description': 'description'
        }

        unmapped_columns = []

        # Step 6: Generate preview data
        preview_data = []
        for item in final_items[:10]:  # First 10 items
            preview_data.append({
                'mpn': item['mpn'],
                'manufacturer': item['manufacturer'],
                'quantity': item['quantity'],
                'reference_designator': item['reference_designator'],
                'description': item['description']
            })

        # Step 7: Return response (ready for confirmation)
        return BOMUploadResponse(
            job_id=job_id,
            filename=merged_filename,
            total_items=len(final_items),
            status='pending',
            detected_columns=detected_columns,
            unmapped_columns=unmapped_columns,
            file_type='bulk_merged',
            encoding_used=f'multi-file bulk upload ({len(files)} files)',
            preview_data=preview_data,
            message=f"Bulk upload successful: {len(files)} files merged into {len(final_items)} components ({duplicates_merged} duplicates merged). Ready for enrichment to central catalog."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during bulk upload: {str(e)}")


# ==============================================================================
# JOB MANAGEMENT ENDPOINTS
# ==============================================================================

@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """
    Cancel a running BOM enrichment job.

    Cancels the Temporal workflow associated with the job and updates
    the job status in the database.

    Args:
        job_id: BOM job ID

    Returns:
        Cancellation confirmation

    Example:
        POST /api/bom/jobs/abc-123-uuid/cancel

        Response:
        {
            "job_id": "abc-123-uuid",
            "status": "cancelled",
            "message": "Job cancelled successfully"
        }
    """
    logger.info(f"⚠️  Cancelling job: {job_id}")

    try:
        # Import Temporal client helper
        from app.workflows.temporal_client import cancel_workflow

        # Cancel Temporal workflow
        workflow_id = f"bom-enrichment-{job_id}"
        success = await cancel_workflow(workflow_id)

        if not success:
            logger.warning(f"Failed to cancel Temporal workflow for job {job_id}, updating DB anyway")

        # Update job status in database (Supabase)
        db = get_supabase_db()

        update_query = text("""
            UPDATE bom_jobs
            SET status = 'cancelled',
                source_metadata = jsonb_set(
                    COALESCE(source_metadata, '{}'::jsonb),
                    '{cancelled_at}',
                    to_jsonb(NOW()::text)
                )
            WHERE job_id = :job_id
            RETURNING job_id, status
        """)

        result = db.execute(update_query, {"job_id": job_id})
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

        db.commit()

        logger.info(f"✅ Job cancelled: {job_id}")

        return {
            "job_id": job_id,
            "status": "cancelled",
            "message": "Job cancelled successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")


@router.post("/jobs/{job_id}/retry-failed")
async def retry_failed_items(job_id: str):
    """
    Retry only failed items from a BOM job.

    Creates a new job containing only the components that failed enrichment
    in the original job. Useful for retrying after fixing supplier API issues
    or other transient errors.

    Args:
        job_id: Original BOM job ID

    Returns:
        New job information for retry

    Example:
        POST /api/bom/jobs/abc-123-uuid/retry-failed

        Response:
        {
            "job_id": "def-456-uuid",
            "original_job_id": "abc-123-uuid",
            "status": "pending",
            "total_items": 15,
            "message": "Retry job created with 15 failed items from original job"
        }
    """
    logger.info(f"🔄 Creating retry job for failed items from job: {job_id}")

    try:
        # Get original job from Supabase
        db = get_supabase_db()

        job_query = text("""
            SELECT job_id, organization_id, customer_id, project_id, filename, source_metadata
            FROM bom_jobs
            WHERE job_id = :job_id
        """)

        job_result = db.execute(job_query, {"job_id": job_id})
        original_job = job_result.fetchone()

        if not original_job:
            raise HTTPException(status_code=404, detail=f"Original job not found: {job_id}")

        # Get failed line items from original job
        failed_items_query = text("""
            SELECT
                manufacturer_part_number as mpn,
                manufacturer,
                quantity,
                reference_designator,
                description
            FROM bom_line_items
            WHERE bom_id = :job_id
              AND enrichment_status = 'failed'
        """)

        failed_items_result = db.execute(failed_items_query, {"job_id": job_id})
        failed_items = [dict(row._mapping) for row in failed_items_result]

        if not failed_items:
            return {
                "job_id": None,
                "original_job_id": job_id,
                "status": "no_failed_items",
                "total_items": 0,
                "message": "No failed items to retry. All items from original job were enriched successfully."
            }

        # Create new job for retry
        new_job_id = str(uuid.uuid4())

        # Prepare source metadata for new job
        source_metadata = dict(original_job.source_metadata) if original_job.source_metadata else {}
        source_metadata['retry_of_job_id'] = job_id
        source_metadata['retry_type'] = 'failed_items_only'
        source_metadata['retry_created_at'] = str(datetime.now())
        source_metadata['original_total_items'] = len(failed_items)

        # Create new job record
        create_job_query = text("""
            INSERT INTO bom_jobs (
                job_id,
                filename,
                total_items,
                status,
                organization_id,
                customer_id,
                project_id,
                source_metadata
            ) VALUES (
                :job_id,
                :filename,
                :total_items,
                'pending',
                :organization_id,
                :customer_id,
                :project_id,
                :source_metadata::jsonb
            )
            RETURNING job_id
        """)

        db.execute(create_job_query, {
            "job_id": new_job_id,
            "filename": f"retry_{original_job.filename}",
            "total_items": len(failed_items),
            "organization_id": original_job.organization_id,
            "customer_id": original_job.customer_id,
            "project_id": original_job.project_id,
            "source_metadata": json.dumps(source_metadata)
        })

        # Create line items for failed components
        insert_items_query = text("""
            INSERT INTO bom_line_items (
                bom_id,
                manufacturer_part_number,
                manufacturer,
                quantity,
                reference_designator,
                description,
                enrichment_status
            ) VALUES (
                :bom_id,
                :mpn,
                :manufacturer,
                :quantity,
                :reference_designator,
                :description,
                'pending'
            )
        """)

        for item in failed_items:
            db.execute(insert_items_query, {
                "bom_id": new_job_id,
                "mpn": item['mpn'],
                "manufacturer": item.get('manufacturer', ''),
                "quantity": item.get('quantity', 1),
                "reference_designator": item.get('reference_designator', ''),
                "description": item.get('description', '')
            })

        db.commit()

        logger.info(f"✅ Retry job created: {new_job_id} ({len(failed_items)} failed items from {job_id})")

        return {
            "job_id": new_job_id,
            "original_job_id": job_id,
            "status": "pending",
            "total_items": len(failed_items),
            "message": f"Retry job created with {len(failed_items)} failed items from original job. Use confirm endpoint to start enrichment."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create retry job for {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create retry job: {str(e)}")
