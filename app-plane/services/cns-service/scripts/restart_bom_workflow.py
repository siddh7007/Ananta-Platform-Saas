#!/usr/bin/env python3
"""
Helper script to restart a BOM workflow that failed to start.

Usage:
    docker exec -it app-plane-cns-service python /app/scripts/restart_bom_workflow.py <bom_id>

Example:
    docker exec -it app-plane-cns-service python /app/scripts/restart_bom_workflow.py effe2da8-823e-472b-a149-c596306a681c
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import timedelta
from temporalio.client import Client
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


async def restart_bom_workflow(bom_id: str):
    """Start or restart the enrichment workflow for a BOM."""

    # Database connection
    db_url = os.getenv("SUPABASE_DATABASE_URL", "postgresql://postgres:postgres@supabase-db:5432/postgres")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)

    print(f"[INFO] Looking up BOM: {bom_id}")

    with Session() as db:
        # Get BOM info
        result = db.execute(text("""
            SELECT id, name, organization_id, project_id, status, enrichment_status,
                   (SELECT COUNT(*) FROM bom_line_items WHERE bom_id = boms.id) as line_count
            FROM boms WHERE id = :bom_id
        """), {"bom_id": bom_id})
        row = result.fetchone()

        if not row:
            print(f"[ERROR] BOM not found: {bom_id}")
            return False

        m = row._mapping
        print(f"[INFO] Found BOM:")
        print(f"       Name: {m['name']}")
        print(f"       Organization: {m['organization_id']}")
        print(f"       Project: {m['project_id']}")
        print(f"       Status: {m['status']}")
        print(f"       Enrichment Status: {m['enrichment_status']}")
        print(f"       Line Count: {m['line_count']}")

        organization_id = str(m['organization_id'])
        project_id = str(m['project_id']) if m['project_id'] else None
        total_items = m['line_count'] or 0

        # Connect to Temporal
        temporal_url = os.getenv("TEMPORAL_URL", "shared-temporal:7233")
        temporal_namespace = os.getenv("TEMPORAL_NAMESPACE", "default")
        temporal_task_queue = os.getenv("TEMPORAL_TASK_QUEUE", "bom-processing")

        print(f"[INFO] Connecting to Temporal at {temporal_url}")

        try:
            client = await Client.connect(temporal_url, namespace=temporal_namespace)
        except Exception as e:
            print(f"[ERROR] Failed to connect to Temporal: {e}")
            return False

        # Import workflow classes
        from app.workflows.bom_enrichment import BOMEnrichmentRequest, BOMEnrichmentWorkflow

        # Create workflow request
        enrichment_request = BOMEnrichmentRequest(
            job_id=bom_id,
            bom_id=bom_id,
            organization_id=organization_id,
            project_id=project_id,
            total_items=total_items
        )

        workflow_id = f"bom-enrichment-{bom_id}"

        print(f"[INFO] Starting workflow: {workflow_id}")
        print(f"[INFO] Task Queue: {temporal_task_queue}")

        try:
            handle = await client.start_workflow(
                BOMEnrichmentWorkflow.run,
                enrichment_request,
                id=workflow_id,
                task_queue=temporal_task_queue,
                execution_timeout=timedelta(hours=2)
            )

            print(f"[OK] Workflow started successfully!")
            print(f"[OK] Workflow ID: {workflow_id}")
            print(f"[OK] Check Temporal UI at http://localhost:27021")

            # Update BOM status
            db.execute(text("""
                UPDATE boms SET
                    status = 'processing',
                    enrichment_status = 'processing',
                    temporal_workflow_id = :workflow_id,
                    updated_at = NOW()
                WHERE id = :bom_id
            """), {"bom_id": bom_id, "workflow_id": workflow_id})
            db.commit()

            print(f"[OK] BOM status updated to 'processing'")
            return True

        except Exception as e:
            print(f"[ERROR] Failed to start workflow: {e}")
            return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python restart_bom_workflow.py <bom_id>")
        sys.exit(1)

    bom_id = sys.argv[1]
    success = asyncio.run(restart_bom_workflow(bom_id))
    sys.exit(0 if success else 1)
