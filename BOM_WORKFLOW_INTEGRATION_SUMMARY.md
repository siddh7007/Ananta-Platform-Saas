# BOM Processing Workflow Integration - Summary

## Overview
Updated the BOM upload flow to trigger the comprehensive BOM Processing Workflow instead of the old enrichment-only workflow. The new workflow orchestrates the complete BOM lifecycle with pause/resume support and persistent state tracking.

## Changes Made

### 1. Updated temporal_client.py
**File**: `app-plane/services/cns-service/app/workflows/temporal_client.py`

**Changes**:
- Added import for `BOMProcessingWorkflow` and `BOMProcessingRequest`
- Created new function `start_bom_processing()` to start the comprehensive workflow
- Added to public API exports

**New Function**:
```python
async def start_bom_processing(
    bom_id: str,
    organization_id: str,
    filename: str,
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    skip_enrichment: bool = False,
    skip_risk_analysis: bool = False,
    enrichment_level: str = "standard",
    priority: int = 5
) -> str
```

**Workflow Stages Handled**:
1. RAW_UPLOAD - Upload verification
2. PARSING - Line items validation
3. ENRICHMENT - Component enrichment from catalog + APIs
4. RISK_ANALYSIS - Risk scoring for each component
5. COMPLETE - Finalization and notifications

### 2. Updated bom.py Confirm Endpoint
**File**: `app-plane/services/cns-service/app/api/bom.py`

**Changes**:
- Updated `POST /jobs/{job_id}/confirm` endpoint
- Changed from `start_bom_enrichment()` to `start_bom_processing()`
- Extracts user metadata from job source_metadata
- Passes all required parameters to new workflow

**Before**:
```python
workflow_id = await start_bom_enrichment(
    job_id=job_id,
    bom_id=job_id,
    organization_id=organization_id,
    total_items=job.total_items,
    project_id=str(job.project_id) if job.project_id else None
)
```

**After**:
```python
workflow_id = await start_bom_processing(
    bom_id=job_id,
    organization_id=organization_id,
    filename=job.filename,
    project_id=str(job.project_id) if job.project_id else None,
    user_id=user_id_from_meta,
    user_email=user_email,
    enrichment_level="standard",
    priority=5
)
```

### 3. Added New Endpoint in bom_workflow.py
**File**: `app-plane/services/cns-service/app/api/bom_workflow.py`

**Changes**:
- Added import for `BOMProcessingWorkflow` and `BOMProcessingRequest`
- Created new Pydantic model `StartProcessingRequest`
- Added new endpoint `POST /start-processing`

**New Endpoint**:
```
POST /api/bom/workflow/start-processing
```

**Request Body**:
```json
{
    "bom_id": "uuid-123",
    "organization_id": "uuid-456",
    "filename": "my_bom.csv",
    "project_id": "uuid-789",
    "user_id": "user-uuid",
    "user_email": "user@example.com",
    "enrichment_level": "standard",
    "priority": 5,
    "skip_enrichment": false,
    "skip_risk_analysis": false
}
```

**Response**:
```json
{
    "job_id": "uuid-123",
    "workflow_id": "bom-processing-uuid-123",
    "status": "running"
}
```

## Workflow Features

### Persistent State Tracking
The workflow creates and maintains a `bom_processing_jobs` record with:
- `status`: pending, running, paused, completed, failed, cancelled
- `current_stage`: raw_upload, parsing, enrichment, risk_analysis, complete
- `stages`: JSONB with per-stage progress and status
- `total_items`, `enriched_items`, `failed_items`, `risk_scored_items`
- `health_grade`, `average_risk_score`
- Timestamps: `started_at`, `completed_at`, `paused_at`

### Real-time Progress Updates
- Workflow publishes state changes to Redis Pub/Sub
- Frontend can subscribe via SSE endpoint: `GET /api/bom/workflow/{bom_id}/processing-stream`
- UI Queue Cards display live progress

### Pause/Resume Support
- Workflow responds to Temporal signals (pause/resume)
- Endpoints available:
  - `POST /api/bom/workflow/{bom_id}/pause`
  - `POST /api/bom/workflow/{bom_id}/resume`
  - `POST /api/bom/workflow/{bom_id}/cancel`
  - `POST /api/bom/workflow/{bom_id}/restart`

### Workflow Status Query
- Query endpoint: `GET /api/bom/workflow/{bom_id}/processing-status`
- Returns comprehensive status including all stages and progress

## Flow Diagram

```
BOM Upload → Parse & Validate → User Confirms Mapping
                                        ↓
                        start_bom_processing() called
                                        ↓
                        BOMProcessingWorkflow started
                                        ↓
        ┌───────────────────────────────────────────────────┐
        │ Stage 1: RAW_UPLOAD - Verify upload exists       │
        └───────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │ Stage 2: PARSING - Validate line items created   │
        └───────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │ Stage 3: ENRICHMENT - Catalog + Supplier APIs    │
        │   - Batch processing with concurrency             │
        │   - Quality scoring                               │
        │   - Supplier data integration                     │
        └───────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │ Stage 4: RISK_ANALYSIS - Calculate risk scores   │
        │   - Obsolescence risk                             │
        │   - Supply chain risk                             │
        │   - Health grade (A-F)                            │
        └───────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │ Stage 5: COMPLETE - Finalize & notify            │
        │   - Update BOM status                             │
        │   - Send notifications                            │
        │   - Cleanup temporary data                        │
        └───────────────────────────────────────────────────┘
```

## Database Schema

The workflow uses the `bom_processing_jobs` table (must exist in Supabase):

```sql
CREATE TABLE IF NOT EXISTS bom_processing_jobs (
    bom_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    current_stage TEXT NOT NULL DEFAULT 'raw_upload',
    stages JSONB DEFAULT '{}',
    total_items INTEGER DEFAULT 0,
    enriched_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    risk_scored_items INTEGER DEFAULT 0,
    health_grade TEXT,
    average_risk_score DECIMAL(5,2),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bom_processing_org ON bom_processing_jobs(organization_id);
CREATE INDEX idx_bom_processing_status ON bom_processing_jobs(status);
```

## Testing

### Manual Test Flow
1. Upload a BOM via `POST /api/bom/upload`
2. Confirm mappings via `POST /api/bom/jobs/{job_id}/confirm`
3. Verify workflow started in Temporal UI at http://localhost:27021
4. Check processing status via `GET /api/bom/workflow/{bom_id}/processing-status`
5. Test pause/resume via respective endpoints
6. Monitor real-time updates via SSE stream

### Expected Workflow ID Format
- Enrichment (old): `bom-enrichment-{job_id}`
- Processing (new): `bom-processing-{bom_id}`

## Backward Compatibility

The old `start_bom_enrichment()` function is still available for:
- Legacy code that may still reference it
- Manual testing
- Gradual migration

The old endpoint `POST /api/bom/workflow/start` still works but is now marked as legacy.

## Next Steps

1. **Verify Database Schema**: Ensure `bom_processing_jobs` table exists with all required columns
2. **Test Upload Flow**: Upload a BOM and confirm workflow triggers correctly
3. **Monitor Temporal**: Check Temporal UI for workflow execution
4. **Test Pause/Resume**: Verify workflow can be paused and resumed mid-processing
5. **Verify SSE**: Test real-time progress updates in frontend
6. **Check Logs**: Review workflow logs for proper stage transitions

## Files Modified

1. `app-plane/services/cns-service/app/workflows/temporal_client.py`
   - Added `start_bom_processing()` function
   - Added imports for BOMProcessingWorkflow

2. `app-plane/services/cns-service/app/api/bom.py`
   - Updated `/jobs/{job_id}/confirm` endpoint
   - Changed workflow trigger to use `start_bom_processing()`

3. `app-plane/services/cns-service/app/api/bom_workflow.py`
   - Added `StartProcessingRequest` model
   - Added `POST /start-processing` endpoint
   - Added imports for BOMProcessingWorkflow

## Related Files (Already Existing)

- `app-plane/services/cns-service/app/workflows/bom_processing_workflow.py` - Workflow implementation
- `app-plane/services/cns-service/app/api/bom_workflow.py` - Processing status endpoints
