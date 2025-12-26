"""
Enrichment Rate Limiting Configuration API Endpoints (Redis-based)

Provides runtime configuration for enrichment rate limiting delays.
Allows admins to adjust delays without restarting services.

Uses Redis for configuration storage:
- Fast key-value access
- Runtime updates without restart
- Falls back to environment variables
- Applies to ALL enrichment workflows (customer, bulk, admin)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment/rate-limiting", tags=["Rate Limiting Config"])


class RateLimitingConfigResponse(BaseModel):
    """Rate limiting configuration response"""
    delays_enabled: bool
    delay_per_component_ms: int
    delay_per_batch_ms: int
    batch_size: int
    source: str  # "redis", "environment_variables", or "code_defaults"
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


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


class RateLimitingPreset(BaseModel):
    """Predefined rate limiting preset"""
    name: str
    description: str
    config: RateLimitingConfigUpdate
    estimated_rate_per_minute: str
    risk_level: str
    use_case: str


class RateLimitingPresetsResponse(BaseModel):
    """Response containing all presets"""
    disabled: RateLimitingPreset
    aggressive: RateLimitingPreset
    balanced: RateLimitingPreset
    conservative: RateLimitingPreset
    mouser_limit: RateLimitingPreset
    element14_limit: RateLimitingPreset


@router.get("", response_model=RateLimitingConfigResponse)
async def get_rate_limiting_config():
    """
    Get current enrichment rate limiting configuration.

    Returns the runtime configuration for enrichment rate limiting.
    Configuration is loaded from Redis (if available) or environment variables.
    """
    from app.utils.rate_limiting_config import get_rate_limiting_config_manager

    logger.info("API: Fetching rate limiting configuration")

    try:
        config_manager = get_rate_limiting_config_manager()
        config = config_manager.get_config()

        response = RateLimitingConfigResponse(
            delays_enabled=config['delays_enabled'],
            delay_per_component_ms=config['delay_per_component_ms'],
            delay_per_batch_ms=config['delay_per_batch_ms'],
            batch_size=config['batch_size'],
            source=config['source'],
            updated_at=config.get('updated_at'),
            updated_by=config.get('updated_by')
        )

        logger.info(
            f"✅ API: Rate limiting config fetched from {config['source']}: "
            f"delays={response.delays_enabled}, "
            f"component_delay={response.delay_per_component_ms}ms"
        )

        return response

    except Exception as e:
        logger.error(f"API: Error fetching rate limiting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("", response_model=RateLimitingConfigResponse)
async def update_rate_limiting_config(config: RateLimitingConfigUpdate):
    """
    Update enrichment rate limiting configuration.

    Updates the runtime configuration in Redis.
    Changes take effect immediately for new enrichment workflows.

    **Applies to ALL enrichment workflows:**
    - Customer BOM uploads
    - Bulk uploads
    - Admin uploads

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

    **Balanced (default, recommended):**
    ```json
    {
        "delays_enabled": true,
        "delay_per_component_ms": 500,
        "delay_per_batch_ms": 2000,
        "batch_size": 10
    }
    ```

    **Fast (testing only):**
    ```json
    {
        "delays_enabled": false,
        "delay_per_component_ms": 0,
        "delay_per_batch_ms": 0,
        "batch_size": 20
    }
    ```
    """
    from app.utils.rate_limiting_config import get_rate_limiting_config_manager, calculate_processing_rate

    logger.info(
        f"API: Updating rate limiting config: delays={config.delays_enabled}, "
        f"component_delay={config.delay_per_component_ms}ms, "
        f"batch_delay={config.delay_per_batch_ms}ms, "
        f"batch_size={config.batch_size}"
    )

    try:
        config_manager = get_rate_limiting_config_manager()

        updated_config = config_manager.set_config(
            delays_enabled=config.delays_enabled,
            delay_per_component_ms=config.delay_per_component_ms,
            delay_per_batch_ms=config.delay_per_batch_ms,
            batch_size=config.batch_size,
            updated_by=None  # TODO: Add authentication
        )

        response = RateLimitingConfigResponse(
            delays_enabled=updated_config['delays_enabled'],
            delay_per_component_ms=updated_config['delay_per_component_ms'],
            delay_per_batch_ms=updated_config['delay_per_batch_ms'],
            batch_size=updated_config['batch_size'],
            source=updated_config['source'],
            updated_at=updated_config.get('updated_at'),
            updated_by=updated_config.get('updated_by')
        )

        # Calculate and log expected processing rate
        processing_rate = calculate_processing_rate(updated_config)
        logger.info(f"✅ API: Rate limiting config updated. Expected rate: ~{processing_rate} components/minute")

        return response

    except ValueError as e:
        logger.warning(f"API: Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"API: Runtime error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"API: Error updating rate limiting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/defaults", response_model=dict)
async def get_rate_limiting_defaults():
    """
    Get default rate limiting configuration from environment variables.

    Returns the fallback values that are used when Redis config is not available.
    """
    from app.config import settings

    defaults = {
        "delays_enabled": settings.enrichment_delays_enabled,
        "delay_per_component_ms": settings.enrichment_delay_per_component_ms,
        "delay_per_batch_ms": settings.enrichment_delay_per_batch_ms,
        "batch_size": settings.enrichment_batch_size,
        "source": "environment_variables"
    }

    logger.info(f"API: Returning environment variable defaults")

    return defaults


@router.get("/history", response_model=list)
async def get_rate_limiting_history(limit: int = 50):
    """
    Get configuration change history from Redis.

    Returns a history of configuration changes (stored in Redis).

    **Parameters:**
    - `limit`: Maximum number of history entries to return (default: 50, max: 100)
    """
    from app.utils.rate_limiting_config import get_rate_limiting_config_manager

    # Enforce max limit
    if limit > 100:
        limit = 100

    logger.info(f"API: Fetching rate limiting config history (limit: {limit})")

    try:
        config_manager = get_rate_limiting_config_manager()
        history = config_manager.get_history(limit=limit)

        logger.info(f"✅ API: Fetched {len(history)} history records")

        return history

    except Exception as e:
        logger.error(f"API: Error fetching history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset", response_model=RateLimitingConfigResponse)
async def reset_rate_limiting_config():
    """
    Reset rate limiting configuration to environment variable defaults.

    Resets the Redis configuration to match the environment variable defaults.
    Useful for troubleshooting or reverting changes.
    """
    from app.utils.rate_limiting_config import get_rate_limiting_config_manager

    logger.info("API: Resetting rate limiting config to environment variable defaults")

    try:
        config_manager = get_rate_limiting_config_manager()
        reset_config = config_manager.reset_to_defaults(updated_by=None)

        response = RateLimitingConfigResponse(
            delays_enabled=reset_config['delays_enabled'],
            delay_per_component_ms=reset_config['delay_per_component_ms'],
            delay_per_batch_ms=reset_config['delay_per_batch_ms'],
            batch_size=reset_config['batch_size'],
            source=reset_config['source'],
            updated_at=reset_config.get('updated_at'),
            updated_by=reset_config.get('updated_by')
        )

        logger.info("✅ API: Configuration reset to defaults")

        return response

    except Exception as e:
        logger.error(f"API: Error resetting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def delete_rate_limiting_config():
    """
    Delete Redis configuration (falls back to environment variables).

    Removes the runtime configuration from Redis.
    After deletion, configuration will be loaded from environment variables.
    """
    from app.utils.rate_limiting_config import get_rate_limiting_config_manager

    logger.info("API: Deleting Redis configuration")

    try:
        config_manager = get_rate_limiting_config_manager()
        config_manager.delete_config()

        logger.info("✅ API: Redis configuration deleted. Will use environment variables.")

        return {"message": "Configuration deleted successfully. Now using environment variables."}

    except Exception as e:
        logger.error(f"API: Error deleting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/presets", response_model=RateLimitingPresetsResponse)
async def get_rate_limiting_presets():
    """
    Get predefined rate limiting presets.

    Returns common configurations for different use cases.
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
            "description": "Minimal delays for fast processing.",
            "config": {
                "delays_enabled": True,
                "delay_per_component_ms": 300,
                "delay_per_batch_ms": 1000,
                "batch_size": 15
            },
            "estimated_rate_per_minute": "30-40",
            "risk_level": "medium",
            "use_case": "Development environment"
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
            "use_case": "Production - recommended default"
        },
        "conservative": {
            "name": "Conservative (Safe)",
            "description": "Strict rate limiting to prevent any API errors.",
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
            "description": "Configured for Mouser's 100 requests/minute limit.",
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
            "description": "Configured for Element14's 50 requests/minute limit.",
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
