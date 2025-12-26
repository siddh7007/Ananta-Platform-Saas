# CNS Event Logger Service

Comprehensive event logging service for the CNS (Component Normalization Service) that integrates with both database persistence and RabbitMQ event streaming.

## Overview

The EventLogger service provides a unified interface for logging all CNS processing events, from high-level workflow lifecycle events to granular component-level enrichment progress.

### Key Features

1. **Dual Persistence**: Events are logged to both:
   - **PostgreSQL** (enrichment_events table) - for querying and historical analysis
   - **RabbitMQ** - for real-time event streaming and notifications

2. **Comprehensive Event Types**:
   - Workflow lifecycle (started, stage transitions, completed)
   - Component enrichment progress
   - Risk analysis and alerts
   - Workflow control (pause/resume)
   - Error tracking

3. **Graceful Error Handling**: Logging failures won't crash your application

4. **Type-Safe**: Full type hints for better IDE support

## Architecture

```
┌─────────────────┐
│   Your Code     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  EventLogger    │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────┐   ┌──────────┐
│ DB  │   │ RabbitMQ │
└─────┘   └──────────┘
```

## Installation

The EventLogger is already integrated into the CNS service. Simply import and use:

```python
from app.services.event_logger import EventLogger
from app.database import get_db_session

with get_db_session() as db:
    event_logger = EventLogger(db)
    # Use event logger...
```

## Database Schema

Table: `enrichment_events` (Supabase database)

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | Yes | Primary key (auto-generated) |
| event_id | VARCHAR(255) | Yes | Unique event identifier |
| event_type | VARCHAR(100) | Yes | Event type identifier |
| routing_key | VARCHAR(255) | No | RabbitMQ routing key |
| bom_id | UUID | Yes | BOM identifier |
| tenant_id | UUID | Yes | Tenant/organization ID |
| organization_id | TEXT | No | Organization ID (preferred) |
| project_id | UUID | No | Project identifier |
| user_id | UUID | No | User identifier |
| source | VARCHAR(20) | Yes | Event source (customer/staff) |
| workflow_id | VARCHAR(255) | No | Temporal workflow ID |
| state | JSONB | Yes | Current workflow state |
| payload | JSONB | Yes | Event-specific data |
| created_at | TIMESTAMPTZ | Yes | Event timestamp (auto) |

**Constraints**:
- `event_id` is UNIQUE
- `source` must be 'customer' or 'staff' (CHECK constraint)

## API Reference

### Core Methods

#### `log_processing_started()`

Log the start of a processing workflow.

```python
event_logger.log_processing_started(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    organization_id="org-123",
    workflow_id="enrich-bom-550e8400",
    source="customer",  # or "staff"
    total_items=150,
    user_id="user-456",
    project_id="project-789"
)
```

**Parameters**:
- `bom_id` (str, required): BOM identifier
- `organization_id` (str, required): Organization identifier
- `workflow_id` (str, required): Temporal workflow ID
- `source` (str, default="customer"): Event source (customer/staff)
- `total_items` (int, default=0): Total number of line items
- `user_id` (str, optional): User who triggered processing
- `project_id` (str, optional): Project identifier

**Returns**: Event ID (str) if successful, None otherwise

---

#### `log_stage_started()` / `log_stage_completed()`

Track workflow stage transitions.

```python
# Stage started
event_logger.log_stage_started(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    stage_name="enrichment",
    organization_id="org-123",
    workflow_id="enrich-bom-550e8400",
    user_id="user-456",
    metadata={"parser_version": "2.0"}
)

# Stage completed
event_logger.log_stage_completed(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    stage_name="enrichment",
    organization_id="org-123",
    workflow_id="enrich-bom-550e8400",
    user_id="user-456",
    duration_ms=45000,
    metadata={
        "total_items": 150,
        "matched": 140,
        "no_match": 10
    }
)
```

**Common Stages**:
- `parsing` - BOM parsing and validation
- `enrichment` - Component data enrichment
- `risk_analysis` - Risk scoring and analysis
- `validation` - Data validation

---

#### `log_enrichment_progress()`

Log component-level enrichment progress.

```python
event_logger.log_enrichment_progress(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    organization_id="org-123",
    mpn="LM358",
    manufacturer="Texas Instruments",
    status="matched",
    confidence=0.95,
    source="DigiKey",
    component_id="comp-123",
    line_item_id="line-456",
    workflow_id="enrich-bom-550e8400",
    enrichment_data={
        "category": "Integrated Circuits",
        "lifecycle_status": "Active"
    }
)
```

**Status Values**:
- `matched` - Component successfully matched
- `no_match` - No match found
- `cached` - Retrieved from cache
- `error` - Enrichment failed

---

#### `log_risk_alert()`

Log component risk alerts.

```python
event_logger.log_risk_alert(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    organization_id="org-123",
    component_id="comp-123",
    mpn="OBSOLETE-CHIP-2000",
    manufacturer="Legacy Semiconductors",
    risk_score=85.5,
    risk_factors=[
        "End of Life (EOL) status",
        "No alternative suppliers",
        "High lead time (26+ weeks)"
    ],
    workflow_id="risk-analysis-550e8400"
)
```

**Risk Severities** (auto-calculated):
- `critical`: risk_score >= 80
- `high`: risk_score >= 60
- `medium`: risk_score < 60

---

#### `log_workflow_paused()` / `log_workflow_resumed()`

Track workflow control events.

```python
# Pause workflow
event_logger.log_workflow_paused(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    workflow_id="enrich-bom-550e8400",
    organization_id="org-123",
    user_id="admin-789",
    reason="Supplier API maintenance window"
)

# Resume workflow
event_logger.log_workflow_resumed(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    workflow_id="enrich-bom-550e8400",
    organization_id="org-123",
    user_id="admin-789",
    reason="Maintenance completed"
)
```

---

#### `log_error()`

Log error events with detailed context.

```python
event_logger.log_error(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    organization_id="org-123",
    error_message="DigiKey API rate limit exceeded",
    error_code="RATE_LIMIT_EXCEEDED",
    workflow_id="enrich-bom-550e8400",
    error_details={
        "supplier": "DigiKey",
        "status_code": 429,
        "retry_after_seconds": 60
    }
)
```

---

### Query Methods

#### `get_events_by_bom()`

Retrieve events for a specific BOM.

```python
events = event_logger.get_events_by_bom(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    event_types=["enrichment_progress", "stage_completed"],  # Optional filter
    limit=100
)

for event in events:
    print(f"{event.event_type}: {event.payload}")
```

---

#### `get_events_by_workflow()`

Retrieve all events for a specific workflow.

```python
events = event_logger.get_events_by_workflow(
    workflow_id="enrich-bom-550e8400",
    limit=100
)
```

---

#### `get_recent_errors()`

Get recent error events for an organization.

```python
errors = event_logger.get_recent_errors(
    organization_id="org-123",
    hours=24,
    limit=50
)

for error in errors:
    print(f"Error: {error.payload['error_message']}")
```

---

## Usage Examples

### Example 1: Complete Enrichment Workflow

```python
from app.services.event_logger import EventLogger
from app.database import get_db_session

with get_db_session() as db:
    event_logger = EventLogger(db)

    bom_id = "550e8400-e29b-41d4-a716-446655440000"
    org_id = "org-123"
    workflow_id = "enrich-bom-550e8400"

    # 1. Workflow started
    event_logger.log_processing_started(
        bom_id=bom_id,
        organization_id=org_id,
        workflow_id=workflow_id,
        total_items=100
    )

    # 2. Enrichment stage
    event_logger.log_stage_started(
        bom_id=bom_id,
        stage_name="enrichment",
        organization_id=org_id,
        workflow_id=workflow_id
    )

    # 3. Enrich components
    for component in components:
        event_logger.log_enrichment_progress(
            bom_id=bom_id,
            organization_id=org_id,
            mpn=component.mpn,
            manufacturer=component.manufacturer,
            status="matched",
            confidence=0.95,
            source="DigiKey",
            workflow_id=workflow_id
        )

    # 4. Stage completed
    event_logger.log_stage_completed(
        bom_id=bom_id,
        stage_name="enrichment",
        organization_id=org_id,
        workflow_id=workflow_id,
        duration_ms=45000,
        metadata={"matched": 95, "no_match": 5}
    )
```

### Example 2: FastAPI Integration

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

    # Log enrichment started
    event_logger.log_processing_started(
        bom_id=bom_id,
        organization_id=organization_id,
        workflow_id=f"enrich-{bom_id}",
        source="customer",
        total_items=100
    )

    # Start enrichment workflow...

    return {"status": "started", "bom_id": bom_id}


@router.get("/boms/{bom_id}/events")
async def get_bom_events(
    bom_id: str,
    db: Session = Depends(get_db)
):
    event_logger = EventLogger(db)

    events = event_logger.get_events_by_bom(
        bom_id=bom_id,
        limit=100
    )

    return {
        "bom_id": bom_id,
        "event_count": len(events),
        "events": [e.to_dict() for e in events]
    }
```

### Example 3: Error Handling

```python
try:
    # Attempt enrichment
    result = enrich_component(mpn, manufacturer)

    event_logger.log_enrichment_progress(
        bom_id=bom_id,
        organization_id=org_id,
        mpn=mpn,
        status="matched",
        confidence=result.confidence,
        source=result.source,
        workflow_id=workflow_id
    )
except RateLimitError as e:
    event_logger.log_error(
        bom_id=bom_id,
        organization_id=org_id,
        error_message="Supplier API rate limit exceeded",
        error_code="RATE_LIMIT_EXCEEDED",
        workflow_id=workflow_id,
        error_details={
            "supplier": e.supplier,
            "retry_after_seconds": e.retry_after
        }
    )
except Exception as e:
    event_logger.log_error(
        bom_id=bom_id,
        organization_id=org_id,
        error_message=str(e),
        error_code="ENRICHMENT_ERROR",
        workflow_id=workflow_id
    )
```

---

## RabbitMQ Integration

Events are automatically published to RabbitMQ with the following routing keys:

| Event Type | Routing Key | Priority |
|------------|-------------|----------|
| Processing Started | `cns.processing.started` | 7 (high) |
| Stage Started | `cns.stage.{stage_name}.started` | 6 (medium) |
| Stage Completed | `cns.stage.{stage_name}.completed` | 6 (medium) |
| Enrichment Progress | `cns.enrichment.progress` | 4 (low) |
| Risk Alert | `cns.risk.alert.{severity}` | 8-7 (high) |
| Workflow Paused | `cns.workflow.paused` | 9 (critical) |
| Workflow Resumed | `cns.workflow.resumed` | 9 (critical) |
| Error | `cns.error` | 8 (high) |

**Priority Levels**:
- 9: Critical (workflow control)
- 8: High (completion events, critical risks)
- 7: Medium-high (start events, high risks)
- 6: Medium (stage transitions)
- 4-5: Low (frequent updates)

---

## Best Practices

### 1. Always Use Context Managers

```python
with get_db_session() as db:
    event_logger = EventLogger(db)
    # Log events...
    # Session auto-commits on exit
```

### 2. Log at Key Workflow Points

```python
# Start of workflow
event_logger.log_processing_started(...)

# Before each major stage
event_logger.log_stage_started(stage_name="enrichment", ...)

# After each stage
event_logger.log_stage_completed(stage_name="enrichment", duration_ms=..., ...)
```

### 3. Include Meaningful Metadata

```python
event_logger.log_stage_completed(
    bom_id=bom_id,
    stage_name="enrichment",
    organization_id=org_id,
    workflow_id=workflow_id,
    duration_ms=45000,
    metadata={
        "total_items": 150,
        "matched": 140,
        "no_match": 5,
        "cached": 85,
        "api_calls_made": 65,
        "average_confidence": 0.92
    }
)
```

### 4. Handle Errors Gracefully

EventLogger failures won't crash your application, but you should still log them:

```python
event_id = event_logger.log_enrichment_progress(...)
if event_id is None:
    logger.warning("Failed to log enrichment progress")
```

### 5. Use Appropriate Sources

- `source="customer"` - User-initiated workflows
- `source="staff"` - Admin/staff operations

---

## Troubleshooting

### Events Not Appearing in Database

1. Check database connection:
   ```python
   from app.database import get_database
   db = get_database()
   print(f"Connected: {db.engine.url}")
   ```

2. Verify session is committed:
   ```python
   with get_db_session() as db:
       event_logger = EventLogger(db)
       event_logger.log_processing_started(...)
       # Session auto-commits here
   ```

3. Check logs for database errors:
   ```bash
   docker logs app-plane-cns-service | grep -i "event"
   ```

### Events Not Published to RabbitMQ

1. Check RabbitMQ connection:
   ```bash
   docker logs app-plane-rabbitmq
   ```

2. Verify event_bus import:
   ```python
   from shared.event_bus import event_bus
   event_bus.connect()  # Should succeed
   ```

3. Check RabbitMQ environment variables:
   ```bash
   RABBITMQ_HOST=localhost
   RABBITMQ_PORT=27250
   RABBITMQ_USER=admin
   RABBITMQ_PASS=admin123_change_in_production
   ```

### UUID Type Errors

Ensure UUIDs are strings when calling EventLogger:

```python
# Good
event_logger.log_processing_started(
    bom_id="550e8400-e29b-41d4-a716-446655440000",
    organization_id="org-123"
)

# Bad (will fail)
event_logger.log_processing_started(
    bom_id=uuid.UUID("550e8400-e29b-41d4-a716-446655440000")  # Don't pass UUID objects
)
```

---

## Testing

Run the example file to test the EventLogger:

```bash
cd app-plane/services/cns-service
python -m app.services.event_logger_example
```

---

## Performance Considerations

1. **Database Writes**: Events are batched in the transaction context
2. **RabbitMQ Publishing**: Non-blocking, failures don't affect database writes
3. **Query Performance**: Indexes on `bom_id`, `tenant_id`, `event_type`, `workflow_id`

---

## Related Documentation

- [Event Bus Documentation](../../../shared/event_bus.py)
- [Database Models](../models/)
- [Temporal Workflows](../../temporal-worker-service/)

---

## Support

For issues or questions:
1. Check logs: `docker logs app-plane-cns-service`
2. Verify database schema: `docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "\d enrichment_events"`
3. Check RabbitMQ: http://localhost:27673 (admin/admin123_change_in_production)
