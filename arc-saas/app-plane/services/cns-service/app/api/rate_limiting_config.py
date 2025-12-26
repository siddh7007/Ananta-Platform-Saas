"""
Enrichment Rate Limiting Configuration API Endpoints

Provides runtime configuration for enrichment rate limiting delays.
Allows admins to adjust delays without restarting services.

Uses Redis for configuration storage (not database):
- Fast key-value access
- Runtime updates without restart
- Falls back to environment variables
- Applies to ALL enrichment workflows (customer, bulk, admin)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment/rate-limiting", tags=["Rate Limiting Config"])


class RateLimitingConfigResponse(BaseModel):
    """Rate limiting configuration response"""
    id: str
    delays_enabled: bool
    delay_per_component_ms: int
    delay_per_batch_ms: int
    batch_size: int
    updated_by: Optional[str] = None
    updated_at: datetime
    created_at: datetime


class RateLimitingConfigUpdate(BaseModel):
    """Request to update rate limiting configuration"""
    delays_enabled: bool = Field(description="Enable/disable rate limiting delays")
    delay_per_component_ms: int = Field(
        ge=0,
        description="Delay in milliseconds between processing each component"
    )
    delay_per_batch_ms: int = Field(
        ge=0,
        description="Delay in milliseconds between processing each batch"
    )
    batch_size: int = Field(
        gt=0,
        description="Number of components to process in parallel per batch"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "delays_enabled": True,
                "delay_per_component_ms": 500,
                "delay_per_batch_ms": 2000,
                "batch_size": 10
            }
        }


@router.get("", response_model=RateLimitingConfigResponse)
async def get_rate_limiting_config():
    """
    Get current enrichment rate limiting configuration.

    Returns the runtime configuration for enrichment rate limiting.
    This configuration takes precedence over environment variables.
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    logger.info("Fetching rate limiting configuration")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        query = text("""
            SELECT
                id,
                delays_enabled,
                delay_per_component_ms,
                delay_per_batch_ms,
                batch_size,
                updated_by,
                updated_at,
                created_at
            FROM enrichment_config
            LIMIT 1
        """)

        result = db.execute(query).fetchone()

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Rate limiting configuration not found. Run migration 014 to initialize."
            )

        config = RateLimitingConfigResponse(
            id=str(result.id),
            delays_enabled=result.delays_enabled,
            delay_per_component_ms=result.delay_per_component_ms,
            delay_per_batch_ms=result.delay_per_batch_ms,
            batch_size=result.batch_size,
            updated_by=str(result.updated_by) if result.updated_by else None,
            updated_at=result.updated_at,
            created_at=result.created_at
        )

        logger.info(
            f"✅ Rate limiting config fetched: delays={config.delays_enabled}, "
            f"component_delay={config.delay_per_component_ms}ms, "
            f"batch_delay={config.delay_per_batch_ms}ms, "
            f"batch_size={config.batch_size}"
        )

        return config

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rate limiting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("", response_model=RateLimitingConfigResponse)
async def update_rate_limiting_config(config: RateLimitingConfigUpdate):
    """
    Update enrichment rate limiting configuration.

    Updates the runtime configuration for enrichment rate limiting.
    Changes take effect immediately for new enrichment workflows.

    **Validation:**
    - `delay_per_component_ms` must be >= 0
    - `delay_per_batch_ms` must be >= 0
    - `batch_size` must be > 0

    **Preset Examples:**

    **Conservative (prevents all rate limit errors):**
    ```json
    {
        "delays_enabled": true,
        "delay_per_component_ms": 1000,
        "delay_per_batch_ms": 3000,
        "batch_size": 5
    }
    ```
    Processing speed: ~5-10 components/minute

    **Balanced (default, recommended for production):**
    ```json
    {
        "delays_enabled": true,
        "delay_per_component_ms": 500,
        "delay_per_batch_ms": 2000,
        "batch_size": 10
    }
    ```
    Processing speed: ~20 components/minute

    **Fast (testing only, may hit rate limits):**
    ```json
    {
        "delays_enabled": false,
        "delay_per_component_ms": 0,
        "delay_per_batch_ms": 0,
        "batch_size": 20
    }
    ```
    Processing speed: ~200+ components/minute (WARNING: May cause 429 errors)

    **Custom for Mouser (100 req/min limit):**
    ```json
    {
        "delays_enabled": true,
        "delay_per_component_ms": 600,
        "delay_per_batch_ms": 0,
        "batch_size": 10
    }
    ```
    Processing speed: ~100 components/minute (matches Mouser limit)
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    logger.info(
        f"Updating rate limiting config: delays={config.delays_enabled}, "
        f"component_delay={config.delay_per_component_ms}ms, "
        f"batch_delay={config.delay_per_batch_ms}ms, "
        f"batch_size={config.batch_size}"
    )

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        # Use the stored procedure to update config
        query = text("""
            SELECT * FROM update_enrichment_config(
                :delays_enabled,
                :delay_per_component_ms,
                :delay_per_batch_ms,
                :batch_size,
                NULL  -- updated_by (TODO: Add auth)
            )
        """)

        result = db.execute(query, {
            "delays_enabled": config.delays_enabled,
            "delay_per_component_ms": config.delay_per_component_ms,
            "delay_per_batch_ms": config.delay_per_batch_ms,
            "batch_size": config.batch_size
        }).fetchone()

        db.commit()

        updated_config = RateLimitingConfigResponse(
            id=str(result.id),
            delays_enabled=result.delays_enabled,
            delay_per_component_ms=result.delay_per_component_ms,
            delay_per_batch_ms=result.delay_per_batch_ms,
            batch_size=result.batch_size,
            updated_by=str(result.updated_by) if result.updated_by else None,
            updated_at=result.updated_at,
            created_at=result.created_at
        )

        logger.info("✅ Rate limiting config updated successfully")

        # Calculate and log expected processing rate
        if updated_config.delays_enabled:
            components_per_min = calculate_processing_rate(updated_config)
            logger.info(f"📊 Expected processing rate: ~{components_per_min} components/minute")

        return updated_config

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating rate limiting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/defaults", response_model=dict)
async def get_rate_limiting_defaults():
    """
    Get default rate limiting configuration from environment variables.

    Returns the fallback values that are used when database config is not available.
    Useful for understanding the system defaults.
    """
    from app.config import settings

    defaults = {
        "delays_enabled": settings.enrichment_delays_enabled,
        "delay_per_component_ms": settings.enrichment_delay_per_component_ms,
        "delay_per_batch_ms": settings.enrichment_delay_per_batch_ms,
        "batch_size": settings.enrichment_batch_size,
        "source": "environment_variables"
    }

    logger.info(f"Returning environment variable defaults: {defaults}")

    return defaults


@router.get("/audit", response_model=list)
async def get_rate_limiting_audit_log(limit: int = 50):
    """
    Get audit log of rate limiting configuration changes.

    Returns a history of configuration changes for compliance and debugging.

    **Parameters:**
    - `limit`: Maximum number of audit records to return (default: 50, max: 200)
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    # Enforce max limit
    if limit > 200:
        limit = 200

    logger.info(f"Fetching rate limiting config audit log (limit: {limit})")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        query = text("""
            SELECT
                id,
                config_id,
                old_delays_enabled,
                old_delay_per_component_ms,
                old_delay_per_batch_ms,
                old_batch_size,
                new_delays_enabled,
                new_delay_per_component_ms,
                new_delay_per_batch_ms,
                new_batch_size,
                changed_by,
                changed_at,
                change_reason
            FROM enrichment_config_audit
            ORDER BY changed_at DESC
            LIMIT :limit
        """)

        results = db.execute(query, {"limit": limit}).fetchall()

        audit_log = []
        for row in results:
            old_rate = calculate_processing_rate_from_values(
                row.old_delays_enabled,
                row.old_delay_per_component_ms,
                row.old_delay_per_batch_ms,
                row.old_batch_size
            )
            new_rate = calculate_processing_rate_from_values(
                row.new_delays_enabled,
                row.new_delay_per_component_ms,
                row.new_delay_per_batch_ms,
                row.new_batch_size
            )

            audit_log.append({
                "id": str(row.id),
                "config_id": str(row.config_id),
                "old_values": {
                    "delays_enabled": row.old_delays_enabled,
                    "delay_per_component_ms": row.old_delay_per_component_ms,
                    "delay_per_batch_ms": row.old_delay_per_batch_ms,
                    "batch_size": row.old_batch_size,
                    "estimated_rate_per_minute": old_rate
                },
                "new_values": {
                    "delays_enabled": row.new_delays_enabled,
                    "delay_per_component_ms": row.new_delay_per_component_ms,
                    "delay_per_batch_ms": row.new_delay_per_batch_ms,
                    "batch_size": row.new_batch_size,
                    "estimated_rate_per_minute": new_rate
                },
                "changed_by": str(row.changed_by) if row.changed_by else None,
                "changed_at": row.changed_at.isoformat() if row.changed_at else None,
                "change_reason": row.change_reason
            })

        logger.info(f"✅ Fetched {len(audit_log)} audit records")

        return audit_log

    except Exception as e:
        logger.error(f"Error fetching audit log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset", response_model=RateLimitingConfigResponse)
async def reset_rate_limiting_config_to_defaults():
    """
    Reset rate limiting configuration to default values.

    Resets the database configuration to match the environment variable defaults.
    Useful for troubleshooting or reverting changes.
    """
    from app.config import settings

    logger.info("Resetting rate limiting config to environment variable defaults")

    default_config = RateLimitingConfigUpdate(
        delays_enabled=settings.enrichment_delays_enabled,
        delay_per_component_ms=settings.enrichment_delay_per_component_ms,
        delay_per_batch_ms=settings.enrichment_delay_per_batch_ms,
        batch_size=settings.enrichment_batch_size
    )

    return await update_rate_limiting_config(default_config)


@router.get("/presets", response_model=dict)
async def get_rate_limiting_presets():
    """
    Get predefined rate limiting presets.

    Returns common configurations for different use cases.
    Useful for quick configuration via UI dropdowns.
    """
    presets = {
        "disabled": {
            "name": "Disabled (Testing Only)",
            "description": "No rate limiting - process at full speed. May cause 429 errors.",
            "config": {
                "delays_enabled": False,
                "delay_per_component_ms": 0,
                "delay_per_batch_ms": 0,
                "batch_size": 20
            },
            "estimated_rate_per_minute": "200+",
            "risk_level": "high",
            "use_case": "Local testing with mock APIs only"
        },
        "aggressive": {
            "name": "Aggressive (Fast)",
            "description": "Minimal delays for fast processing. Some risk of rate limits.",
            "config": {
                "delays_enabled": True,
                "delay_per_component_ms": 300,
                "delay_per_batch_ms": 1000,
                "batch_size": 15
            },
            "estimated_rate_per_minute": "30-40",
            "risk_level": "medium",
            "use_case": "Development environment with generous API limits"
        },
        "balanced": {
            "name": "Balanced (Default)",
            "description": "Recommended for production. Good balance of speed and reliability.",
            "config": {
                "delays_enabled": True,
                "delay_per_component_ms": 500,
                "delay_per_batch_ms": 2000,
                "batch_size": 10
            },
            "estimated_rate_per_minute": "20",
            "risk_level": "low",
            "use_case": "Production - recommended default setting"
        },
        "conservative": {
            "name": "Conservative (Safe)",
            "description": "Strict rate limiting to prevent any API errors. Slower processing.",
            "config": {
                "delays_enabled": True,
                "delay_per_component_ms": 1000,
                "delay_per_batch_ms": 3000,
                "batch_size": 5
            },
            "estimated_rate_per_minute": "5-10",
            "risk_level": "very_low",
            "use_case": "Strict API limits or multiple concurrent enrichments"
        },
        "mouser_limit": {
            "name": "Mouser API Limit (100/min)",
            "description": "Configured to match Mouser's 100 requests/minute limit.",
            "config": {
                "delays_enabled": True,
                "delay_per_component_ms": 600,
                "delay_per_batch_ms": 0,
                "batch_size": 10
            },
            "estimated_rate_per_minute": "100",
            "risk_level": "low",
            "use_case": "When using primarily Mouser APIs"
        },
        "element14_limit": {
            "name": "Element14 API Limit (50/min)",
            "description": "Configured to match Element14's 50 requests/minute limit.",
            "config": {
                "delays_enabled": True,
                "delay_per_component_ms": 1200,
                "delay_per_batch_ms": 0,
                "batch_size": 10
            },
            "estimated_rate_per_minute": "50",
            "risk_level": "very_low",
            "use_case": "When using primarily Element14 APIs"
        }
    }

    return presets


# Helper functions

def calculate_processing_rate(config: RateLimitingConfigResponse) -> int:
    """Calculate estimated components per minute from config"""
    return calculate_processing_rate_from_values(
        config.delays_enabled,
        config.delay_per_component_ms,
        config.delay_per_batch_ms,
        config.batch_size
    )


def calculate_processing_rate_from_values(
    delays_enabled: bool,
    delay_per_component_ms: int,
    delay_per_batch_ms: int,
    batch_size: int
) -> int:
    """Calculate estimated components per minute from individual values"""
    if not delays_enabled:
        return 200  # Rough estimate for no delays

    # Time per component = component delay
    time_per_component_ms = delay_per_component_ms

    # Time per batch = (batch_size * component_delay) + batch_delay
    time_per_batch_ms = (batch_size * time_per_component_ms) + delay_per_batch_ms

    # Components per minute = (60000ms / time_per_batch_ms) * batch_size
    if time_per_batch_ms == 0:
        return 200  # Avoid division by zero

    components_per_minute = (60000 / time_per_batch_ms) * batch_size

    return int(components_per_minute)
