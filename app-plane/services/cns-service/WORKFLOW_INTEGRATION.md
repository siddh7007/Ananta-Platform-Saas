# BOM Processing Workflow Integration

## Overview

The BOM Processing Workflow (`bom_processing_workflow.py`) provides an end-to-end pipeline for processing BOMs through multiple stages. During the ENRICHMENT stage, it properly integrates with the existing BOM Enrichment Workflow to avoid code duplication.

## Architecture

```
BOMProcessingWorkflow (Parent)
│
├── Stage 1: RAW_UPLOAD (verify file uploaded)
│   └── Activity: verify_upload
│
├── Stage 2: PARSING (verify line items created)
│   └── Activity: verify_parsing
│
├── Stage 3: ENRICHMENT (enrich components)
│   └── Child Workflow: BOMEnrichmentWorkflow
│       ├── Activity: fetch_bom_line_items (Supabase)
│       ├── Activity: bulk_prefilter_components (catalog lookup)
│       ├── Activity: load_enrichment_config (rate limiting)
│       ├── For each line item:
│       │   └── Activity: enrich_component (supplier APIs)
│       ├── Activity: update_bom_progress (Supabase)
│       └── Activity: log_enrichment_audit_batch (audit trail)
│
├── Stage 4: RISK_ANALYSIS (calculate risk scores)
│   └── Activity: run_risk_analysis
│
└── Stage 5: COMPLETE (finalize)
```

## Key Integration Points

### 1. Child Workflow Execution

The BOMProcessingWorkflow invokes BOMEnrichmentWorkflow as a **child workflow**, not an activity:

```python
# In bom_processing_workflow.py: _run_enrichment_stage()
enrichment_result = await workflow.execute_child_workflow(
    BOMEnrichmentWorkflow.run,
    enrichment_request,
    id=f"bom-enrichment-{request.bom_id}",
    retry_policy=RetryPolicy(...)
)
```

**Why child workflow instead of activity?**
- Enrichment can take hours for large BOMs (exceeds activity timeout limits)
- Enrichment has its own complex state management and progress tracking
- Enrichment needs pause/resume capability
- Enrichment publishes real-time events to Redis/SSE

### 2. Reused Enrichment Logic

The child BOMEnrichmentWorkflow executes ALL existing enrichment logic:

| Component | Purpose | Activity/Workflow |
|-----------|---------|-------------------|
| `bulk_prefilter_components` | Bulk catalog lookup | Activity |
| `enrich_component` | Individual component enrichment via supplier APIs | Activity |
| `update_bom_progress` | Update Supabase boms table with progress | Activity |
| `log_enrichment_audit_batch` | Audit logging for field-level diff views | Activity |
| `publish_enrichment_event` | Real-time Redis/SSE events | Activity |
| `save_bom_original_audit` | Save original BOM data before enrichment | Activity |

### 3. Organization ID Mapping

**CRITICAL**: The same entity has different names across planes:

| Plane | Term | Usage |
|-------|------|-------|
| Control Plane | `tenant_id` | Admin app, tenant management |
| App Plane/CNS | `organization_id` | BOM processing, enrichment |

In this workflow:
- `BOMProcessingRequest.organization_id` is the organization/tenant ID
- Passed to `BOMEnrichmentRequest.organization_id` (same value)
- Used for multi-tenant isolation in database queries

### 4. Progress Tracking

Progress is tracked at TWO levels:

**Parent Workflow (BOMProcessingWorkflow)**:
- Tracks stage-level progress (raw_upload → parsing → enrichment → risk_analysis → complete)
- Stored in `bom_processing_jobs` table
- Published to Redis channel: `bom:processing:{bom_id}`

**Child Workflow (BOMEnrichmentWorkflow)**:
- Tracks item-level progress (enriched, failed, pending items)
- Updates `boms.enrichment_progress` column in Supabase
- Published to Redis channel: `bom:enrichment:{bom_id}`

Frontends can subscribe to BOTH channels for comprehensive status:
```javascript
// Overall pipeline status
const processingChannel = `bom:processing:${bomId}`;

// Enrichment item-level progress
const enrichmentChannel = `bom:enrichment:${bomId}`;
```

### 5. Error Handling

**Child workflow failures**:
- BOMEnrichmentWorkflow has retry policy (max 2 attempts)
- If enrichment fails, parent workflow catches exception
- Parent workflow marks ENRICHMENT stage as FAILED
- Overall workflow status becomes FAILED

**Partial success**:
- If some items enrich successfully before failure, counts are preserved
- `enrichment_result.total_enriched` and `enrichment_result.total_failed` returned
- Parent workflow can decide whether to continue to RISK_ANALYSIS or not

## Data Flow

### Input: BOMProcessingRequest
```python
BOMProcessingRequest(
    bom_id="uuid",
    organization_id="uuid",  # Same as tenant_id in control plane
    filename="example.csv",
    project_id="uuid" (optional),
    user_id="user@example.com" (optional),
    skip_enrichment=False,
    skip_risk_analysis=False,
    enrichment_level="standard",  # basic | standard | comprehensive
    priority=5
)
```

### Output: Workflow State
```python
{
    "bom_id": "uuid",
    "organization_id": "uuid",
    "status": "completed",  # pending | running | paused | completed | failed | cancelled
    "current_stage": "complete",
    "stages": {
        "raw_upload": {"status": "completed", "progress": 100, ...},
        "parsing": {"status": "completed", "progress": 100, "total_items": 150},
        "enrichment": {"status": "completed", "progress": 100, "items_processed": 150},
        "risk_analysis": {"status": "completed", "progress": 100},
        "complete": {"status": "completed", "progress": 100}
    },
    "total_items": 150,
    "enriched_items": 145,
    "failed_items": 5,
    "risk_scored_items": 150,
    "health_grade": "B+",
    "average_risk_score": 3.2
}
```

## Temporal UI Visibility

In Temporal UI (http://localhost:27021, namespace: `default`):

1. Parent workflow: `bom-processing-{bom_id}`
   - Shows 5 stages
   - Shows child workflow execution as part of ENRICHMENT stage
   - Can pause/resume/cancel entire pipeline

2. Child workflow: `bom-enrichment-{bom_id}`
   - Shows detailed enrichment progress
   - Shows individual activity executions (fetch, prefilter, enrich, update)
   - Can be queried for item-level progress

## Database Schema

### bom_processing_jobs (Supabase)
```sql
CREATE TABLE bom_processing_jobs (
    bom_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,  -- pending | running | paused | completed | failed | cancelled
    current_stage TEXT NOT NULL,
    stages JSONB NOT NULL,
    total_items INTEGER DEFAULT 0,
    enriched_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    risk_scored_items INTEGER DEFAULT 0,
    health_grade TEXT,
    average_risk_score NUMERIC(5,2),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### boms (Supabase) - Updated by Child Workflow
```sql
-- enrichment_progress column updated by BOMEnrichmentWorkflow
UPDATE boms SET enrichment_progress = {
    "total_items": 150,
    "enriched_items": 145,
    "failed_items": 5,
    "percent_complete": 96.7
}
WHERE id = :bom_id;
```

## Usage Examples

### Start BOM Processing Workflow
```python
from temporalio.client import Client
from app.workflows.bom_processing_workflow import (
    BOMProcessingWorkflow,
    BOMProcessingRequest
)

client = await Client.connect("localhost:27020")

handle = await client.start_workflow(
    BOMProcessingWorkflow.run,
    BOMProcessingRequest(
        bom_id="550e8400-e29b-41d4-a716-446655440000",
        organization_id="org-123-uuid",
        filename="myproduct.csv",
        user_email="engineer@company.com",
        enrichment_level="comprehensive"
    ),
    id="bom-processing-550e8400",
    task_queue="bom-processing"
)

print(f"Workflow started: {handle.id}")
```

### Query Status
```python
# Query parent workflow status
status = await handle.query(BOMProcessingWorkflow.get_status)
print(f"Current stage: {status['current_stage']}")
print(f"Progress: {status['enriched_items']}/{status['total_items']}")

# Query child enrichment workflow directly
enrichment_handle = client.get_workflow_handle(
    f"bom-enrichment-{bom_id}"
)
enrichment_progress = await enrichment_handle.query(
    BOMEnrichmentWorkflow.get_progress
)
print(f"Enrichment: {enrichment_progress['percent_complete']}%")
```

### Pause/Resume
```python
# Pause entire pipeline
await handle.signal(BOMProcessingWorkflow.pause)

# Resume pipeline
await handle.signal(BOMProcessingWorkflow.resume)
```

### Cancel
```python
# Cancel entire pipeline (including child workflows)
await handle.signal(BOMProcessingWorkflow.cancel)
```

## Benefits of This Architecture

1. **No Code Duplication**: Enrichment logic lives in ONE place (BOMEnrichmentWorkflow)
2. **Composability**: BOMEnrichmentWorkflow can be used standalone OR as child
3. **Proper Timeouts**: Child workflows can run for hours without activity timeout issues
4. **State Isolation**: Each workflow manages its own state independently
5. **Progress Visibility**: Two-level progress tracking (stage + item)
6. **Failure Isolation**: Enrichment failures don't crash parent workflow
7. **Testability**: Each workflow can be tested independently

## Migration Notes

**Before**: BOMProcessingWorkflow had its own `run_enrichment` activity that duplicated enrichment logic.

**After**: BOMProcessingWorkflow uses `execute_child_workflow` to invoke BOMEnrichmentWorkflow, ensuring consistency with existing enrichment flows.

**Breaking Changes**: None - API surface unchanged, only internal implementation improved.

## Related Files

| File | Purpose |
|------|---------|
| `app/workflows/bom_processing_workflow.py` | Parent workflow (5 stages) |
| `app/workflows/bom_enrichment.py` | Child enrichment workflow |
| `app/services/enrichment_service.py` | Enrichment business logic (called by activities) |
| `app/services/component_catalog.py` | Catalog lookup service |
| `app/services/risk_calculator.py` | Risk analysis service |
| `app/models/dual_database.py` | Database connection manager |
