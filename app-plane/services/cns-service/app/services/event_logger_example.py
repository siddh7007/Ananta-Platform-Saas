"""
EventLogger Usage Examples

This file demonstrates how to use the EventLogger service for comprehensive
event logging in the CNS service.
"""

from app.services.event_logger import EventLogger
from app.database import get_db_session


# ============================================================================
# EXAMPLE 1: Workflow Lifecycle Tracking
# ============================================================================

def example_workflow_lifecycle():
    """
    Track complete workflow lifecycle from start to finish
    """
    with get_db_session() as db:
        event_logger = EventLogger(db)

        bom_id = "550e8400-e29b-41d4-a716-446655440000"
        organization_id = "org-123"
        workflow_id = "enrich-bom-550e8400"
        user_id = "user-456"

        # 1. Log workflow started
        event_logger.log_processing_started(
            bom_id=bom_id,
            organization_id=organization_id,
            workflow_id=workflow_id,
            source="customer",
            total_items=150,
            user_id=user_id,
            project_id="project-789"
        )

        # 2. Log parsing stage
        event_logger.log_stage_started(
            bom_id=bom_id,
            stage_name="parsing",
            organization_id=organization_id,
            workflow_id=workflow_id,
            user_id=user_id,
            metadata={"parser_version": "2.0"}
        )

        # 3. Log parsing completion
        event_logger.log_stage_completed(
            bom_id=bom_id,
            stage_name="parsing",
            organization_id=organization_id,
            workflow_id=workflow_id,
            user_id=user_id,
            duration_ms=1250,
            metadata={
                "items_parsed": 150,
                "items_skipped": 0,
                "warnings": []
            }
        )

        # 4. Log enrichment stage
        event_logger.log_stage_started(
            bom_id=bom_id,
            stage_name="enrichment",
            organization_id=organization_id,
            workflow_id=workflow_id,
            user_id=user_id
        )

        # Database session will auto-commit when context exits


# ============================================================================
# EXAMPLE 2: Component Enrichment Progress
# ============================================================================

def example_enrichment_progress():
    """
    Track component-level enrichment progress
    """
    with get_db_session() as db:
        event_logger = EventLogger(db)

        bom_id = "550e8400-e29b-41d4-a716-446655440000"
        organization_id = "org-123"
        workflow_id = "enrich-bom-550e8400"

        # Components being enriched
        components = [
            {"mpn": "LM358", "manufacturer": "Texas Instruments"},
            {"mpn": "STM32F407", "manufacturer": "STMicroelectronics"},
            {"mpn": "ATMEGA328P", "manufacturer": "Microchip"},
        ]

        for idx, comp in enumerate(components):
            # Successful match from DigiKey
            event_logger.log_enrichment_progress(
                bom_id=bom_id,
                organization_id=organization_id,
                mpn=comp["mpn"],
                manufacturer=comp["manufacturer"],
                status="matched",
                confidence=0.95,
                source="DigiKey",
                component_id=f"comp-{idx}",
                line_item_id=f"line-{idx}",
                workflow_id=workflow_id,
                enrichment_data={
                    "category": "Integrated Circuits",
                    "lifecycle_status": "Active",
                    "pricing_available": True
                }
            )

        # Component not found (no match)
        event_logger.log_enrichment_progress(
            bom_id=bom_id,
            organization_id=organization_id,
            mpn="CUSTOM-PART-001",
            manufacturer="Custom Manufacturer",
            status="no_match",
            confidence=0.0,
            source="DigiKey",
            workflow_id=workflow_id,
            enrichment_data={
                "attempted_suppliers": ["DigiKey", "Mouser", "Element14"],
                "fallback_used": True
            }
        )

        # Cached component (no API call needed)
        event_logger.log_enrichment_progress(
            bom_id=bom_id,
            organization_id=organization_id,
            mpn="LM358",
            manufacturer="Texas Instruments",
            status="cached",
            confidence=0.98,
            source="cache",
            component_id="comp-cached-123",
            workflow_id=workflow_id,
            enrichment_data={
                "cache_age_hours": 12,
                "cache_hit_count": 45
            }
        )


# ============================================================================
# EXAMPLE 3: Risk Analysis Events
# ============================================================================

def example_risk_analysis():
    """
    Track risk analysis events and alerts
    """
    with get_db_session() as db:
        event_logger = EventLogger(db)

        bom_id = "550e8400-e29b-41d4-a716-446655440000"
        organization_id = "org-123"
        workflow_id = "risk-analysis-550e8400"

        # Critical risk component
        event_logger.log_risk_alert(
            bom_id=bom_id,
            organization_id=organization_id,
            component_id="comp-123",
            mpn="OBSOLETE-CHIP-2000",
            manufacturer="Legacy Semiconductors",
            risk_score=85.5,
            risk_factors=[
                "End of Life (EOL) status",
                "No alternative suppliers",
                "High lead time (26+ weeks)",
                "Price volatility: +45% in 6 months"
            ],
            workflow_id=workflow_id
        )

        # Medium risk component
        event_logger.log_risk_alert(
            bom_id=bom_id,
            organization_id=organization_id,
            component_id="comp-456",
            mpn="STM32F407VGT6",
            manufacturer="STMicroelectronics",
            risk_score=62.0,
            risk_factors=[
                "Limited stock at primary supplier",
                "Single source component",
                "NRND (Not Recommended for New Designs)"
            ],
            workflow_id=workflow_id
        )


# ============================================================================
# EXAMPLE 4: Workflow Control (Pause/Resume)
# ============================================================================

def example_workflow_control():
    """
    Track workflow pause and resume events
    """
    with get_db_session() as db:
        event_logger = EventLogger(db)

        bom_id = "550e8400-e29b-41d4-a716-446655440000"
        organization_id = "org-123"
        workflow_id = "enrich-bom-550e8400"
        admin_user_id = "admin-789"

        # Admin pauses workflow
        event_logger.log_workflow_paused(
            bom_id=bom_id,
            workflow_id=workflow_id,
            organization_id=organization_id,
            user_id=admin_user_id,
            reason="Supplier API maintenance window"
        )

        # ... later, admin resumes workflow
        event_logger.log_workflow_resumed(
            bom_id=bom_id,
            workflow_id=workflow_id,
            organization_id=organization_id,
            user_id=admin_user_id,
            reason="Supplier API maintenance completed"
        )


# ============================================================================
# EXAMPLE 5: Error Logging
# ============================================================================

def example_error_logging():
    """
    Log various types of errors
    """
    with get_db_session() as db:
        event_logger = EventLogger(db)

        bom_id = "550e8400-e29b-41d4-a716-446655440000"
        organization_id = "org-123"
        workflow_id = "enrich-bom-550e8400"

        # Supplier API error
        event_logger.log_error(
            bom_id=bom_id,
            organization_id=organization_id,
            error_message="DigiKey API rate limit exceeded",
            error_code="RATE_LIMIT_EXCEEDED",
            workflow_id=workflow_id,
            error_details={
                "supplier": "DigiKey",
                "status_code": 429,
                "retry_after_seconds": 60,
                "request_count": 1050,
                "limit": 1000
            }
        )

        # Data validation error
        event_logger.log_error(
            bom_id=bom_id,
            organization_id=organization_id,
            error_message="Invalid BOM format: missing required columns",
            error_code="VALIDATION_ERROR",
            workflow_id=workflow_id,
            error_details={
                "missing_columns": ["Manufacturer", "MPN"],
                "file_format": "CSV",
                "row_count": 150
            }
        )

        # Workflow execution error
        event_logger.log_error(
            bom_id=bom_id,
            organization_id=organization_id,
            error_message="Workflow timeout after 30 minutes",
            error_code="WORKFLOW_TIMEOUT",
            workflow_id=workflow_id,
            error_details={
                "timeout_seconds": 1800,
                "items_processed": 120,
                "items_remaining": 30,
                "last_stage": "enrichment"
            }
        )


# ============================================================================
# EXAMPLE 6: Querying Events
# ============================================================================

def example_query_events():
    """
    Query logged events from database
    """
    with get_db_session() as db:
        event_logger = EventLogger(db)

        bom_id = "550e8400-e29b-41d4-a716-446655440000"
        organization_id = "org-123"
        workflow_id = "enrich-bom-550e8400"

        # 1. Get all events for a BOM
        all_events = event_logger.get_events_by_bom(
            bom_id=bom_id,
            limit=100
        )
        print(f"Found {len(all_events)} events for BOM {bom_id}")

        # 2. Get specific event types for a BOM
        enrichment_events = event_logger.get_events_by_bom(
            bom_id=bom_id,
            event_types=["enrichment_progress", "stage_completed"],
            limit=50
        )
        print(f"Found {len(enrichment_events)} enrichment events")

        # 3. Get all events for a workflow
        workflow_events = event_logger.get_events_by_workflow(
            workflow_id=workflow_id,
            limit=100
        )
        print(f"Found {len(workflow_events)} events for workflow {workflow_id}")

        # 4. Get recent errors for an organization
        recent_errors = event_logger.get_recent_errors(
            organization_id=organization_id,
            hours=24,
            limit=50
        )
        print(f"Found {len(recent_errors)} errors in last 24 hours")

        # 5. Convert events to dictionaries for API responses
        for event in all_events[:5]:
            event_dict = event.to_dict()
            print(f"Event: {event_dict['event_type']} at {event_dict['created_at']}")


# ============================================================================
# EXAMPLE 7: Complete Enrichment Workflow
# ============================================================================

def example_complete_enrichment_workflow():
    """
    Complete enrichment workflow with all event types
    """
    with get_db_session() as db:
        event_logger = EventLogger(db)

        bom_id = "550e8400-e29b-41d4-a716-446655440000"
        organization_id = "org-123"
        workflow_id = "enrich-bom-550e8400"
        user_id = "user-456"

        # 1. Workflow started
        event_logger.log_processing_started(
            bom_id=bom_id,
            organization_id=organization_id,
            workflow_id=workflow_id,
            source="customer",
            total_items=10,
            user_id=user_id
        )

        # 2. Enrichment stage started
        event_logger.log_stage_started(
            bom_id=bom_id,
            stage_name="enrichment",
            organization_id=organization_id,
            workflow_id=workflow_id,
            user_id=user_id
        )

        # 3. Enrich components (simulate processing)
        components = [
            {"mpn": "LM358", "mfr": "TI", "confidence": 0.95},
            {"mpn": "STM32F407", "mfr": "ST", "confidence": 0.92},
            {"mpn": "ATMEGA328P", "mfr": "Microchip", "confidence": 0.98},
        ]

        for comp in components:
            event_logger.log_enrichment_progress(
                bom_id=bom_id,
                organization_id=organization_id,
                mpn=comp["mpn"],
                manufacturer=comp["mfr"],
                status="matched",
                confidence=comp["confidence"],
                source="DigiKey",
                workflow_id=workflow_id
            )

        # 4. Enrichment completed
        event_logger.log_stage_completed(
            bom_id=bom_id,
            stage_name="enrichment",
            organization_id=organization_id,
            workflow_id=workflow_id,
            user_id=user_id,
            duration_ms=45000,
            metadata={
                "total_items": 10,
                "matched": 8,
                "no_match": 2,
                "cached": 3,
                "api_calls": 7
            }
        )

        # 5. Risk analysis started
        event_logger.log_stage_started(
            bom_id=bom_id,
            stage_name="risk_analysis",
            organization_id=organization_id,
            workflow_id=workflow_id,
            user_id=user_id
        )

        # 6. Risk alert detected
        event_logger.log_risk_alert(
            bom_id=bom_id,
            organization_id=organization_id,
            component_id="comp-7",
            mpn="OBSOLETE-PART",
            manufacturer="Legacy Corp",
            risk_score=88.0,
            risk_factors=["EOL", "No stock"],
            workflow_id=workflow_id
        )

        # 7. Risk analysis completed
        event_logger.log_stage_completed(
            bom_id=bom_id,
            stage_name="risk_analysis",
            organization_id=organization_id,
            workflow_id=workflow_id,
            user_id=user_id,
            duration_ms=12000,
            metadata={
                "average_risk_score": 45.2,
                "high_risk_count": 1,
                "medium_risk_count": 2,
                "low_risk_count": 7,
                "health_grade": "B"
            }
        )

        print("Complete enrichment workflow logged successfully!")


# ============================================================================
# EXAMPLE 8: Integration with FastAPI Endpoints
# ============================================================================

"""
Example FastAPI endpoint using EventLogger:

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
"""


if __name__ == "__main__":
    """
    Run examples
    """
    print("EventLogger Examples")
    print("=" * 80)

    print("\n1. Workflow Lifecycle Tracking")
    example_workflow_lifecycle()

    print("\n2. Component Enrichment Progress")
    example_enrichment_progress()

    print("\n3. Risk Analysis Events")
    example_risk_analysis()

    print("\n4. Workflow Control (Pause/Resume)")
    example_workflow_control()

    print("\n5. Error Logging")
    example_error_logging()

    print("\n6. Querying Events")
    example_query_events()

    print("\n7. Complete Enrichment Workflow")
    example_complete_enrichment_workflow()

    print("\n" + "=" * 80)
    print("All examples completed successfully!")
