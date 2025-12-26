# EventLogger Quick Start Guide

**5-Minute Guide to Using EventLogger in CNS**

## Basic Setup

```python
from app.services.event_logger import EventLogger
from app.database import get_db_session

with get_db_session() as db:
    event_logger = EventLogger(db)
    # Log events here...
    # Session auto-commits on exit
```

## Most Common Use Cases

### 1. Start Workflow Processing

```python
event_logger.log_processing_started(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    organization_id="org-123",
    workflow_id="enrich-bom-550e8400",
    total_items=100
)
```

### 2. Track Workflow Stages

```python
# Stage started
event_logger.log_stage_started(
    bom_id=bom_id,
    stage_name="enrichment",  # or "parsing", "risk_analysis", "validation"
    organization_id=org_id,
    workflow_id=workflow_id
)

# Stage completed
event_logger.log_stage_completed(
    bom_id=bom_id,
    stage_name="enrichment",
    organization_id=org_id,
    workflow_id=workflow_id,
    duration_ms=45000,
    metadata={"matched": 95, "no_match": 5}
)
```

### 3. Log Component Enrichment

```python
event_logger.log_enrichment_progress(
    bom_id=bom_id,
    organization_id=org_id,
    mpn="LM358",
    manufacturer="Texas Instruments",
    status="matched",  # or "no_match", "cached", "error"
    confidence=0.95,
    source="DigiKey",
    workflow_id=workflow_id
)
```

### 4. Log Errors

```python
event_logger.log_error(
    bom_id=bom_id,
    organization_id=org_id,
    error_message="DigiKey API rate limit exceeded",
    error_code="RATE_LIMIT_EXCEEDED",
    workflow_id=workflow_id,
    error_details={
        "supplier": "DigiKey",
        "retry_after_seconds": 60
    }
)
```

### 5. Query Events

```python
# Get all events for a BOM
events = event_logger.get_events_by_bom(
    bom_id=bom_id,
    limit=100
)

# Get specific event types
enrichment_events = event_logger.get_events_by_bom(
    bom_id=bom_id,
    event_types=["enrichment_progress", "stage_completed"],
    limit=50
)

# Get recent errors
errors = event_logger.get_recent_errors(
    organization_id=org_id,
    hours=24,
    limit=50
)
```

## FastAPI Integration

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.event_logger import EventLogger

router = APIRouter()

@router.post("/boms/{bom_id}/enrich")
async def start_enrichment(
    bom_id: str,
    organization_id: str,
    db: Session = Depends(get_db)
):
    event_logger = EventLogger(db)

    event_logger.log_processing_started(
        bom_id=bom_id,
        organization_id=organization_id,
        workflow_id=f"enrich-{bom_id}",
        total_items=100
    )

    # Start enrichment...
    return {"status": "started"}
```

## Complete Workflow Example

```python
with get_db_session() as db:
    event_logger = EventLogger(db)

    # 1. Start workflow
    event_logger.log_processing_started(
        bom_id=bom_id,
        organization_id=org_id,
        workflow_id=workflow_id,
        total_items=100
    )

    # 2. Start enrichment stage
    event_logger.log_stage_started(
        bom_id=bom_id,
        stage_name="enrichment",
        organization_id=org_id,
        workflow_id=workflow_id
    )

    # 3. Enrich components
    for component in components:
        try:
            result = enrich_component(component)

            event_logger.log_enrichment_progress(
                bom_id=bom_id,
                organization_id=org_id,
                mpn=component.mpn,
                manufacturer=component.manufacturer,
                status="matched",
                confidence=result.confidence,
                source=result.source,
                workflow_id=workflow_id
            )
        except Exception as e:
            event_logger.log_error(
                bom_id=bom_id,
                organization_id=org_id,
                error_message=str(e),
                error_code="ENRICHMENT_ERROR",
                workflow_id=workflow_id
            )

    # 4. Complete enrichment stage
    event_logger.log_stage_completed(
        bom_id=bom_id,
        stage_name="enrichment",
        organization_id=org_id,
        workflow_id=workflow_id,
        duration_ms=45000,
        metadata={"total": 100, "matched": 95, "no_match": 5}
    )
```

## Event Types Reference

| Event Type | Method | When to Use |
|------------|--------|-------------|
| processing_started | `log_processing_started()` | Start of workflow |
| stage_started | `log_stage_started()` | Before each major stage |
| stage_completed | `log_stage_completed()` | After each stage |
| enrichment_progress | `log_enrichment_progress()` | Each component enriched |
| risk_alert | `log_risk_alert()` | High-risk component detected |
| workflow_paused | `log_workflow_paused()` | Admin pauses workflow |
| workflow_resumed | `log_workflow_resumed()` | Admin resumes workflow |
| error | `log_error()` | Any error occurs |

## Required Parameters

**All events require**:
- `bom_id` (str) - BOM identifier
- `organization_id` (str) - Organization identifier

**Most events also need**:
- `workflow_id` (str) - Temporal workflow ID

## Common Stages

- `parsing` - BOM file parsing
- `validation` - Data validation
- `enrichment` - Component enrichment
- `risk_analysis` - Risk scoring

## Common Statuses (for enrichment_progress)

- `matched` - Component found and matched
- `no_match` - No match in any source
- `cached` - Retrieved from cache
- `error` - Enrichment failed

## Testing

```bash
# Run test suite
cd app-plane/services/cns-service
python -m app.services.test_event_logger
```

## Troubleshooting

**Events not appearing?**
1. Check session is committed: Use `with get_db_session()` context manager
2. Verify database connection: Check `DATABASE_URL` environment variable
3. Check logs: `docker logs app-plane-cns-service | grep -i "event"`

**RabbitMQ errors?**
- Not critical - events still saved to database
- Check RabbitMQ: `docker logs app-plane-rabbitmq`

## Full Documentation

See `EVENT_LOGGER_README.md` for complete API reference and advanced usage.
