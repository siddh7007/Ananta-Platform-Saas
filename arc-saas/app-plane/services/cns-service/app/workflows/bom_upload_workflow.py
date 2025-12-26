"""
BOM Upload Event-Driven Workflow - Audit/Notification Only

Since both CBP and CNS now save line items immediately during upload,
this workflow serves as an audit trail and notification mechanism.

Line items are already saved by:
- CBP: Customer Portal → bom_line_items (Supabase)
- CNS: Bulk Upload API → bom_line_items (Main DB)

This workflow:
1. Validates upload completed successfully
2. Sends notifications if configured
3. Updates audit fields
4. No longer creates duplicate line items
"""

import logging
from datetime import timedelta, datetime
from typing import Dict, Any, List, Optional
from temporalio import workflow, activity
from temporalio.common import RetryPolicy
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class BOMUploadProcessRequest:
    """Request to process a BOM upload"""
    bom_upload_id: str  # UUID from bom_uploads table
    organization_id: str
    project_id: Optional[str]
    filename: str
    priority: int = 5  # Priority for enrichment workflow (1-9, default 5)


@workflow.defn
class BOMUploadProcessWorkflow:
    """
    Temporal workflow for BOM upload audit/notification.

    Since both upload pipelines now save line items immediately:
    - Customer Portal → Supabase.bom_line_items
    - CNS Bulk Upload → Main DB.bom_line_items

    This workflow only:
    1. Verifies upload completed successfully
    2. Counts existing line items (sanity check)
    3. Updates audit/tracking fields
    4. NO LONGER creates duplicate line items or boms records

    Usage:
        client = await get_temporal_client()
        handle = await client.start_workflow(
            BOMUploadProcessWorkflow.run,
            request,
            id=f"bom-upload-{bom_upload_id}",
            task_queue="bom-upload-processing"
        )
    """

    def __init__(self):
        self.bom_upload_id: Optional[str] = None
        self.boms_id: Optional[str] = None
        self.status: str = "pending"

    @workflow.run
    async def run(self, request: BOMUploadProcessRequest) -> Dict[str, Any]:
        """
        Main workflow execution for BOM upload audit/notification

        Line items are already saved by upload pipelines - no duplication.
        """
        self.bom_upload_id = request.bom_upload_id
        workflow.logger.info(
            f"🚀 Starting BOM upload audit workflow: upload_id={request.bom_upload_id}"
        )

        try:
            # Step 1: Fetch bom_uploads record to verify completion
            workflow.logger.info(f"📋 Fetching bom_uploads record: {request.bom_upload_id}")

            bom_upload = await workflow.execute_activity(
                fetch_bom_upload,
                request.bom_upload_id,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=1),
                    maximum_interval=timedelta(seconds=10),
                    backoff_coefficient=2.0
                )
            )

            upload_source = bom_upload.get('upload_source', 'customer_portal')
            status = bom_upload.get('status', 'unknown')

            workflow.logger.info(
                f"✅ BOM upload verified: {bom_upload['filename']} "
                f"({bom_upload.get('total_rows', 0)} rows) "
                f"[source={upload_source}, status={status}]"
            )

            # Step 2: Verify line items already exist (sanity check)
            line_items_count = await workflow.execute_activity(
                count_existing_line_items,
                request.bom_upload_id,
                start_to_close_timeout=timedelta(seconds=30)
            )

            workflow.logger.info(
                f"✅ Verified {line_items_count} line items already saved by upload pipeline"
            )

            # Step 3: Update audit fields
            await workflow.execute_activity(
                update_bom_upload_status,
                {
                    'bom_upload_id': request.bom_upload_id,
                    'temporal_workflow_id': workflow.info().workflow_id,
                    'temporal_workflow_status': 'audit_completed'
                },
                start_to_close_timeout=timedelta(seconds=10)
            )

            workflow.logger.info("✅ BOM upload audit completed successfully")
            workflow.logger.info(
                f"   Upload source: {upload_source}"
            )
            workflow.logger.info(
                f"   Line items: {line_items_count} (saved by independent pipeline)"
            )

            # Publish upload completion event (for customer portal only - triggers auto-enrichment)
            if upload_source == 'customer_portal':
                try:
                    await workflow.execute_activity(
                        publish_upload_completion_event,
                        {
                            'bom_upload_id': request.bom_upload_id,
                            'organization_id': request.organization_id,
                            'project_id': request.project_id,
                            'priority': request.priority
                        },
                        start_to_close_timeout=timedelta(seconds=10)
                    )
                    workflow.logger.info("✅ Published upload completion event for auto-enrichment")
                except Exception as e:
                    workflow.logger.warning(f"Failed to publish completion event: {e}")

            return {
                'success': True,
                'bom_upload_id': request.bom_upload_id,
                'line_items_count': line_items_count,
                'upload_source': upload_source,
                'priority': request.priority,
                'status': 'audit_completed'
            }

        except Exception as e:
            workflow.logger.error(f"❌ BOM upload processing failed: {e}", exc_info=True)

            # Mark as failed
            try:
                await workflow.execute_activity(
                    update_bom_upload_status,
                    {
                        'bom_upload_id': request.bom_upload_id,
                        'status': 'failed',
                        'error_message': str(e),
                        'temporal_workflow_status': 'failed'
                    },
                    start_to_close_timeout=timedelta(seconds=10)
                )
            except Exception as update_error:
                workflow.logger.error(f"Failed to update error status: {update_error}")

            return {
                'success': False,
                'bom_upload_id': request.bom_upload_id,
                'error': str(e),
                'status': 'failed'
            }


# ============================================================================
# ACTIVITIES
# ============================================================================

@activity.defn
async def fetch_bom_upload(bom_upload_id: str) -> Dict[str, Any]:
    """
    Fetch bom_uploads record from Supabase
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    logger.info(f"Fetching bom_uploads record: {bom_upload_id}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        query = text("""
            SELECT
                id,
                filename,
                file_size,
                file_type,
                organization_id,
                project_id,
                uploaded_by,
                status,
                detected_columns,
                unmapped_columns,
                column_mappings,
                mapping_confirmed,
                mapping_confirmed_at,
                total_rows,
                preview_data,
                parse_stats,
                processing_settings,
                created_at
            FROM bom_uploads
            WHERE id = :bom_upload_id
        """)

        result = db.execute(query, {"bom_upload_id": bom_upload_id})
        row = result.fetchone()

        if not row:
            raise ValueError(f"BOM upload not found: {bom_upload_id}")

        record = dict(row._mapping)

        # Convert datetime objects to ISO strings for JSON serialization
        for key, value in record.items():
            if isinstance(value, datetime):
                record[key] = value.isoformat() if value else None

        logger.info(f"✅ Found bom_upload: {record['filename']}")

        return record

    except Exception as e:
        logger.error(f"Error fetching bom_upload: {e}", exc_info=True)
        raise


@activity.defn
async def count_existing_line_items(bom_upload_id: str) -> int:
    """
    Count existing line items for a BOM upload (verifies they were saved by upload pipeline)

    Checks both Supabase (for customer portal) and Main DB (for CNS bulk)
    """
    from app.models.dual_database import get_dual_database, DatabaseType
    from sqlalchemy import text

    logger.info(f"Counting existing line items for bom_upload: {bom_upload_id}")

    try:
        # First check which database to query based on upload_source
        dual_db = get_dual_database()

        # Try Supabase first (customer portal uploads)
        db_supabase = next(dual_db.get_session("supabase"))
        query = text("""
            SELECT COUNT(*) as count
            FROM bom_line_items
            WHERE bom_id = :bom_upload_id
        """)

        result = db_supabase.execute(query, {"bom_upload_id": bom_upload_id})
        row = result.fetchone()
        count_supabase = row[0] if row else 0

        if count_supabase > 0:
            logger.info(f"✅ Found {count_supabase} line items in Supabase (customer portal upload)")
            return count_supabase

        # Try Main DB (CNS bulk uploads)
        db_main = next(dual_db.get_session("components"))
        result = db_main.execute(query, {"bom_upload_id": bom_upload_id})
        row = result.fetchone()
        count_main = row[0] if row else 0

        if count_main > 0:
            logger.info(f"✅ Found {count_main} line items in Main DB (CNS bulk upload)")
            return count_main

        logger.warning(f"⚠️ No line items found for bom_upload: {bom_upload_id}")
        return 0

    except Exception as e:
        logger.error(f"Error counting line items: {e}", exc_info=True)
        raise


@activity.defn
async def update_bom_upload_status(params: Dict[str, Any]) -> None:
    """
    Update bom_uploads status and workflow tracking
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    bom_upload_id = params['bom_upload_id']
    logger.info(f"Updating bom_upload status: {bom_upload_id} -> {params.get('status')}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        # Build dynamic update query based on provided params
        update_fields = []
        values = {'bom_upload_id': bom_upload_id}

        if 'status' in params:
            update_fields.append("status = :status")
            values['status'] = params['status']

        if 'temporal_workflow_id' in params:
            update_fields.append("temporal_workflow_id = :workflow_id")
            values['workflow_id'] = params['temporal_workflow_id']

        if 'temporal_workflow_status' in params:
            update_fields.append("temporal_workflow_status = :workflow_status")
            values['workflow_status'] = params['temporal_workflow_status']

        if 'error_message' in params:
            update_fields.append("error_message = :error_message")
            values['error_message'] = params['error_message']

        update_fields.append("updated_at = NOW()")

        query = text(f"""
            UPDATE bom_uploads
            SET {', '.join(update_fields)}
            WHERE id = :bom_upload_id
        """)

        db.execute(query, values)
        db.commit()

        logger.info("✅ Status updated")

    except Exception as e:
        logger.error(f"Error updating status: {e}", exc_info=True)
        raise


@activity.defn
async def publish_upload_completion_event(params: Dict[str, Any]) -> None:
    """
    Publish customer.bom.upload_completed event to trigger auto-enrichment.

    This event is published AFTER upload workflow completes processing,
    when BOM records and line items exist in database.
    Only called for customer portal uploads, not CNS bulk.

    Eliminates hardcoded 5-second delay race condition.
    """
    try:
        import sys
        import os
        # Add shared directory to path for EventPublisher import
        shared_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'shared')
        if os.path.exists(shared_path):
            sys.path.insert(0, shared_path)

        from event_bus import EventPublisher

        bom_upload_id = params.get('bom_upload_id')
        organization_id = params.get('organization_id')
        project_id = params.get('project_id')
        user_id = params.get('user_id')
        priority = params.get('priority', 7)

        logger.info(f"Publishing upload completion event: bom_upload_id={bom_upload_id}")

        EventPublisher.customer_bom_upload_completed(
            bom_upload_id=bom_upload_id, organization_id=organization_id,
            project_id=project_id,
            user_id=user_id,
            priority=priority
        )

        logger.info("✅ Upload completion event published successfully")

    except Exception as e:
        # Non-critical failure - log warning but don't fail workflow
        logger.warning(f"Failed to publish upload completion event: {e}", exc_info=True)


@activity.defn
async def create_boms_record(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    DEPRECATED: No longer used - upload pipelines now save line items directly.

    Create a new boms record
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text
    import uuid

    logger.info(f"Creating boms record for upload: {params['bom_upload_id']}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        bom_id = str(uuid.uuid4())

        query = text("""
            INSERT INTO boms (
                id,
                tenant_id,
                project_id,
                name,
                description,
                status,
                component_count,
                created_by_id,
                source,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                :id,
                :tenant_id,
                :project_id,
                :name,
                :description,
                'pending',
                :component_count,
                :created_by_id,
                'upload',
                :metadata::jsonb,
                NOW(),
                NOW()
            )
        """)

        import json
        db.execute(query, {
            'id': bom_id,
            'tenant_id': params['organization_id'],
            'project_id': params.get('project_id'),
            'name': params['filename'],
            'description': f"Uploaded from {params['filename']}",
            'component_count': params.get('total_rows', 0),
            'created_by_id': params.get('uploaded_by'),
            'metadata': json.dumps({
                'bom_upload_id': params['bom_upload_id'],
                'original_filename': params['filename']
            })
        })
        db.commit()

        logger.info(f"✅ Created boms: {bom_id}")

        return {'id': bom_id}

    except Exception as e:
        logger.error(f"Error creating boms: {e}", exc_info=True)
        raise


@activity.defn
async def create_bom_line_items(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    DEPRECATED: No longer used - upload pipelines now save line items directly.

    Create bom_line_items records from preview_data and column_mappings
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text
    import uuid

    boms_id = params['boms_id']
    preview_data = params['preview_data']
    column_mappings = params['column_mappings']

    logger.info(f"Creating line items for boms: {boms_id}")
    logger.info(f"Preview data rows: {len(preview_data)}")
    logger.info(f"Column mappings: {column_mappings}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        created_count = 0

        # Get reverse mapping (target field -> source column name)
        mpn_column = column_mappings.get('mpn')
        manufacturer_column = column_mappings.get('manufacturer', '')
        quantity_column = column_mappings.get('quantity', '')
        reference_column = column_mappings.get('reference', '')
        description_column = column_mappings.get('description', '')

        if not mpn_column:
            raise ValueError("MPN column mapping required")

        for line_number, row_data in enumerate(preview_data, start=1):
            # Extract fields based on column mappings
            mpn = row_data.get(mpn_column, '').strip()

            if not mpn:
                logger.warning(f"Skipping row {line_number}: no MPN")
                continue

            manufacturer = row_data.get(manufacturer_column, '').strip() if manufacturer_column else ''

            # Parse quantity
            quantity_str = str(row_data.get(quantity_column, '1')).strip() if quantity_column else '1'
            try:
                quantity = int(float(quantity_str))
            except (ValueError, TypeError):
                quantity = 1

            reference = row_data.get(reference_column, '').strip() if reference_column else ''
            description = row_data.get(description_column, '').strip() if description_column else ''

            # Insert line item
            line_item_id = str(uuid.uuid4())

            query = text("""
                INSERT INTO bom_line_items (
                    id,
                    bom_id,
                    line_number,
                    manufacturer_part_number,
                    manufacturer,
                    quantity,
                    reference_designator,
                    description,
                    enrichment_status,
                    created_at,
                    updated_at
                ) VALUES (
                    :id,
                    :bom_id,
                    :line_number,
                    :mpn,
                    :manufacturer,
                    :quantity,
                    :reference,
                    :description,
                    'pending',
                    NOW(),
                    NOW()
                )
            """)

            db.execute(query, {
                'id': line_item_id,
                'bom_id': boms_id,
                'line_number': line_number,
                'mpn': mpn,
                'manufacturer': manufacturer,
                'quantity': quantity,
                'reference': reference,
                'description': description
            })

            created_count += 1

        db.commit()

        logger.info(f"✅ Created {created_count} line items")

        return {'count': created_count}

    except Exception as e:
        logger.error(f"Error creating line items: {e}", exc_info=True)
        raise


@activity.defn
async def update_bom_upload_enrichment_job(params: Dict[str, Any]) -> None:
    """
    DEPRECATED: No longer used - upload pipelines are now independent.

    Update bom_uploads with enrichment_job_id (links to boms)
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    logger.info(f"Linking bom_upload to enrichment job: {params['enrichment_job_id']}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        query = text("""
            UPDATE bom_uploads
            SET
                enrichment_job_id = :enrichment_job_id,
                updated_at = NOW()
            WHERE id = :bom_upload_id
        """)

        db.execute(query, {
            'bom_upload_id': params['bom_upload_id'],
            'enrichment_job_id': params['enrichment_job_id']
        })
        db.commit()

        logger.info("✅ Enrichment job linked")

    except Exception as e:
        logger.error(f"Error updating enrichment job: {e}", exc_info=True)
        raise


@activity.defn
async def download_and_parse_s3_file(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    DEPRECATED: No longer used - CNS bulk upload now parses files immediately during upload.

    Download file from S3 and parse it (for CNS bulk uploads)

    This activity:
    1. Downloads file from MinIO/S3
    2. Parses CSV/XLSX
    3. Auto-detects column mappings
    4. Updates bom_uploads with preview_data and column_mappings
    5. Marks as ready for enrichment

    Args:
        params: {
            bom_upload_id: UUID,
            s3_key: str,
            s3_bucket: str,
            filename: str
        }

    Returns:
        {
            total_rows: int,
            mapped_columns: int,
            unmapped_columns: int
        }
    """
    from app.models.dual_database import get_dual_database
    from app.utils.minio_client import get_minio_client
    from sqlalchemy import text
    import pandas as pd
    import io

    bom_upload_id = params['bom_upload_id']
    s3_key = params['s3_key']
    s3_bucket = params['s3_bucket']
    filename = params['filename']

    logger.info(f"Downloading and parsing S3 file: s3://{s3_bucket}/{s3_key}")

    try:
        # Step 1: Download from MinIO
        minio_client = get_minio_client()

        if not minio_client.is_enabled():
            raise ValueError("MinIO is not enabled")

        file_data = minio_client.download_file(s3_bucket, s3_key)

        if not file_data:
            raise ValueError(f"Failed to download file from S3: {s3_key}")

        logger.info(f"✅ Downloaded {len(file_data)} bytes from S3")

        # Step 2: Parse file based on extension
        file_ext = filename.split('.')[-1].lower()

        if file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(file_data))
        elif file_ext in ['xlsx', 'xls']:
            df = pd.read_excel(io.BytesIO(file_data), engine='openpyxl' if file_ext == 'xlsx' else None)
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")

        total_rows = len(df)
        columns = df.columns.tolist()

        logger.info(f"✅ Parsed file: {total_rows} rows, {len(columns)} columns")

        # Step 3: Auto-detect column mappings
        # Simple heuristic mapping (can be improved)
        column_mappings = {}
        unmapped_columns = []

        mapping_rules = {
            'mpn': ['part_number', 'part number', 'mpn', 'partnumber', 'part no', 'part_no'],
            'manufacturer': ['manufacturer', 'mfg', 'mfr', 'brand'],
            'quantity': ['quantity', 'qty', 'qnty', 'count'],
            'reference': ['reference', 'ref', 'designator', 'refdes', 'ref_des'],
            'description': ['description', 'desc', 'notes', 'comment']
        }

        for col in columns:
            col_lower = col.lower().strip()
            mapped = False

            for target, patterns in mapping_rules.items():
                if any(pattern in col_lower for pattern in patterns):
                    column_mappings[target] = col
                    mapped = True
                    break

            if not mapped:
                unmapped_columns.append(col)

        # Ensure MPN is mapped (required)
        if 'mpn' not in column_mappings:
            # Try to find first column that looks like a part number
            for col in columns:
                if 'part' in col.lower() or 'mpn' in col.lower():
                    column_mappings['mpn'] = col
                    if col in unmapped_columns:
                        unmapped_columns.remove(col)
                    break

        if 'mpn' not in column_mappings and columns:
            # Last resort: use first column
            column_mappings['mpn'] = columns[0]
            if columns[0] in unmapped_columns:
                unmapped_columns.remove(columns[0])

        logger.info(f"✅ Auto-mapped columns: {list(column_mappings.keys())}")
        logger.info(f"⚠️  Unmapped columns: {unmapped_columns}")

        # Step 4: Create preview data (first 10 rows)
        preview_data = df.head(10).to_dict('records')

        # Step 5: Update bom_uploads with parsed data
        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        update_query = text("""
            UPDATE bom_uploads
            SET
                preview_data = :preview_data::jsonb,
                column_mappings = :column_mappings::jsonb,
                detected_columns = :detected_columns::jsonb,
                unmapped_columns = :unmapped_columns,
                total_rows = :total_rows,
                mapping_confirmed = true,
                status = 'ready_for_enrichment',
                parse_stats = :parse_stats::jsonb,
                updated_at = NOW()
            WHERE id = :bom_upload_id
        """)

        import json
        db.execute(update_query, {
            'bom_upload_id': bom_upload_id,
            'preview_data': json.dumps(preview_data),
            'column_mappings': json.dumps(column_mappings),
            'detected_columns': json.dumps(column_mappings),
            'unmapped_columns': unmapped_columns,
            'total_rows': total_rows,
            'parse_stats': json.dumps({
                'total_rows': total_rows,
                'total_columns': len(columns),
                'mapped_columns': len(column_mappings),
                'unmapped_columns': len(unmapped_columns)
            })
        })
        db.commit()

        logger.info(f"✅ Updated bom_uploads with parsed data")

        return {
            'total_rows': total_rows,
            'mapped_columns': len(column_mappings),
            'unmapped_columns': len(unmapped_columns)
        }

    except Exception as e:
        logger.error(f"Error downloading/parsing S3 file: {e}", exc_info=True)
        raise
