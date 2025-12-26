"""
CNS Enrichment Configuration API

Allows UI to manage enrichment settings:
- Enable/disable AI enhancement (Phase 6)
- Enable/disable web scraping (Phase 7)
- Configure AI provider selection
- Set quality thresholds
- Manage cost limits

Configuration is stored in Directus/PostgreSQL for persistence.
"""

import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


# ==========================================
# Pydantic Models
# ==========================================

class EnrichmentConfigBase(BaseModel):
    """Base enrichment configuration"""
    config_name: str = Field(default="default", description="Configuration name")
    is_active: bool = Field(default=True, description="Is this config active?")

    # Tier 2: Supplier APIs
    enable_suppliers: bool = Field(default=True, description="Enable supplier APIs")
    preferred_suppliers: Optional[List[str]] = Field(
        default=["mouser", "digikey", "element14"],
        description="Preferred supplier order"
    )
    supplier_min_confidence: float = Field(
        default=90.0,
        ge=0, le=100,
        description="Minimum confidence for supplier match"
    )

    # Tier 3: AI Enhancement (OPTIONAL)
    enable_ai: bool = Field(default=False, description="Enable AI enhancement (OFF by default)")
    ai_provider: Optional[str] = Field(
        default=None,
        description="AI provider: ollama, openai, claude, langflow"
    )
    ai_operations: List[str] = Field(
        default=["category", "specs"],
        description="AI operations: category, specs, description"
    )
    ai_min_confidence: float = Field(
        default=70.0,
        ge=0, le=100,
        description="Minimum AI confidence threshold"
    )
    ai_cost_limit_monthly: Optional[float] = Field(
        default=None,
        description="Monthly budget limit for AI (USD)"
    )

    # Tier 4: Web Scraping (OPTIONAL)
    enable_web_scraping: bool = Field(
        default=False,
        description="Enable web scraping fallback (OFF by default)"
    )
    scraping_sources: List[str] = Field(
        default=["manufacturer", "datasheet"],
        description="Web scraping sources"
    )
    scraping_timeout_seconds: int = Field(
        default=10,
        ge=1, le=60,
        description="Web scraping timeout"
    )

    # Quality thresholds
    quality_reject_threshold: int = Field(default=70, ge=0, le=100)
    quality_staging_threshold: int = Field(default=94, ge=0, le=100)
    quality_auto_approve_threshold: int = Field(default=95, ge=0, le=100)

    # Audit trail
    enable_enrichment_audit: bool = Field(
        default=True,
        description="Enable CSV/S3 audit trail for enrichment debugging"
    )

    # Processing
    batch_size: int = Field(default=100, ge=1, le=1000)
    max_retries: int = Field(default=2, ge=0, le=10)


class EnrichmentConfigCreate(EnrichmentConfigBase):
    """Create new enrichment configuration"""
    organization_id: Optional[str] = None
    is_global: bool = False


class EnrichmentConfigUpdate(BaseModel):
    """Update existing configuration (all fields optional)"""
    is_active: Optional[bool] = None
    enable_suppliers: Optional[bool] = None
    preferred_suppliers: Optional[List[str]] = None
    enable_ai: Optional[bool] = None
    ai_provider: Optional[str] = None
    ai_operations: Optional[List[str]] = None
    enable_web_scraping: Optional[bool] = None
    ai_cost_limit_monthly: Optional[float] = None
    quality_reject_threshold: Optional[int] = None
    quality_staging_threshold: Optional[int] = None
    quality_auto_approve_threshold: Optional[int] = None
    enable_enrichment_audit: Optional[bool] = None


class EnrichmentConfigResponse(EnrichmentConfigBase):
    """Enrichment configuration response"""
    model_config = ConfigDict(from_attributes=True, json_encoders={datetime: lambda v: v.isoformat()})

    id: int
    organization_id: Optional[str]
    is_global: bool
    ai_cost_current_month: float
    ai_requests_current_month: int
    web_scraping_requests_current_month: int
    created_at: str  # Changed back to str
    updated_at: str  # Changed back to str


class CostTrackingResponse(BaseModel):
    """Cost tracking response"""
    month: str
    organization_id: Optional[str]
    total_enrichments: int
    ai_enrichments: int
    web_scraping_enrichments: int
    total_ai_cost: float
    avg_processing_time_ms: float
    avg_quality_score: float
    routed_production: int
    routed_staging: int
    routed_rejected: int


# ==========================================
# API Endpoints
# ==========================================

@router.get("/config/", response_model=List[EnrichmentConfigResponse])
async def list_configs(
    organization_id: Optional[str] = Query(None, description="Filter by organization ID"),
    is_global: Optional[bool] = Query(None, description="Filter global configs"),
    is_active: Optional[bool] = Query(True, description="Filter active configs"),
    db: Session = Depends(get_db)
):
    """
    List enrichment configurations

    Returns configurations filtered by organization, global flag, and active status.
    """
    try:
        query = "SELECT * FROM cns_enrichment_config WHERE 1=1"
        params = {}

        if organization_id:
            query += " AND organization_id = :organization_id"
            params['organization_id'] = organization_id

        if is_global is not None:
            query += " AND is_global = :is_global"
            params['is_global'] = is_global

        if is_active is not None:
            query += " AND is_active = :is_active"
            params['is_active'] = is_active

        query += " ORDER BY is_global DESC, created_at DESC"

        result = db.execute(text(query), params)
        configs = result.fetchall()

        # Convert Row objects to dicts for Pydantic with datetime conversion
        results = []
        for row in configs:
            data = dict(row._mapping)
            # Convert datetime objects to ISO strings
            if data.get('created_at'):
                data['created_at'] = data['created_at'].isoformat()
            if data.get('updated_at'):
                data['updated_at'] = data['updated_at'].isoformat()
            results.append(EnrichmentConfigResponse(**data))
        return results

    except Exception as e:
        logger.error(f"Error listing configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/active", response_model=EnrichmentConfigResponse)
async def get_active_config(
    organization_id: Optional[str] = Query(None, description="Organization ID (null for global)"),
    db: Session = Depends(get_db)
):
    """
    Get active enrichment configuration for an organization

    Returns the active config for the specified organization, or global config if no organization-specific config exists.
    """
    try:
        query = """
        SELECT * FROM get_active_cns_config(:organization_id)
        """
        result = db.execute(text(query), {"organization_id": organization_id})
        config = result.fetchone()

        if not config:
            raise HTTPException(status_code=404, detail="No active configuration found")

        # Convert Row object to dict for Pydantic with datetime conversion
        data = dict(config._mapping)
        if data.get('created_at'):
            data['created_at'] = data['created_at'].isoformat()
        if data.get('updated_at'):
            data['updated_at'] = data['updated_at'].isoformat()
        return EnrichmentConfigResponse(**data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/", response_model=EnrichmentConfigResponse, status_code=201)
async def create_config(
    config: EnrichmentConfigCreate,
    db: Session = Depends(get_db)
):
    """
    Create new enrichment configuration

    Allows creating tenant-specific or global configurations.
    """
    try:
        query = """
        INSERT INTO cns_enrichment_config (
            organization_id, config_name, is_active, is_global,
            enable_suppliers, preferred_suppliers, supplier_min_confidence,
            enable_ai, ai_provider, ai_operations, ai_min_confidence, ai_cost_limit_monthly,
            enable_web_scraping, scraping_sources, scraping_timeout_seconds,
            quality_reject_threshold, quality_staging_threshold, quality_auto_approve_threshold,
            batch_size, max_retries
        ) VALUES (
            :organization_id, :config_name, :is_active, :is_global,
            :enable_suppliers, :preferred_suppliers, :supplier_min_confidence,
            :enable_ai, :ai_provider, :ai_operations, :ai_min_confidence, :ai_cost_limit_monthly,
            :enable_web_scraping, :scraping_sources, :scraping_timeout_seconds,
            :quality_reject_threshold, :quality_staging_threshold,
            :quality_auto_approve_threshold,
            :batch_size, :max_retries
        ) RETURNING *
        """

        params = {
            'organization_id': config.organization_id,
            'config_name': config.config_name,
            'is_active': config.is_active,
            'is_global': config.is_global,
            'enable_suppliers': config.enable_suppliers,
            'preferred_suppliers': config.preferred_suppliers,
            'supplier_min_confidence': config.supplier_min_confidence,
            'enable_ai': config.enable_ai,
            'ai_provider': config.ai_provider,
            'ai_operations': config.ai_operations,
            'ai_min_confidence': config.ai_min_confidence,
            'ai_cost_limit_monthly': config.ai_cost_limit_monthly,
            'enable_web_scraping': config.enable_web_scraping,
            'scraping_sources': config.scraping_sources,
            'scraping_timeout_seconds': config.scraping_timeout_seconds,
            'quality_reject_threshold': config.quality_reject_threshold,
            'quality_staging_threshold': config.quality_staging_threshold,
            'quality_auto_approve_threshold': config.quality_auto_approve_threshold,
            'batch_size': config.batch_size,
            'max_retries': config.max_retries
        }

        result = db.execute(text(query), params)
        db.commit()
        new_config = result.fetchone()

        # Convert Row object to dict for Pydantic with datetime conversion
        data = dict(new_config._mapping)
        if data.get('created_at'):
            data['created_at'] = data['created_at'].isoformat()
        if data.get('updated_at'):
            data['updated_at'] = data['updated_at'].isoformat()
        return EnrichmentConfigResponse(**data)

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/config/{config_id}", response_model=EnrichmentConfigResponse)
async def update_config(
    config_id: int,
    updates: EnrichmentConfigUpdate,
    db: Session = Depends(get_db)
):
    """
    Update enrichment configuration

    Allows partial updates (only specified fields are updated).
    """
    try:
        # Build dynamic UPDATE query
        update_fields = []
        params = {}

        for field, value in updates.dict(exclude_unset=True).items():
            update_fields.append(f"{field} = :{field}")
            params[field] = value

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        params['config_id'] = config_id

        query = f"""
        UPDATE cns_enrichment_config
        SET {', '.join(update_fields)}
        WHERE id = :config_id
        RETURNING *
        """

        result = db.execute(text(query), params)
        db.commit()
        updated_config = result.fetchone()

        if not updated_config:
            raise HTTPException(status_code=404, detail="Configuration not found")

        # Convert Row object to dict for Pydantic with datetime conversion
        data = dict(updated_config._mapping)
        if data.get('created_at'):
            data['created_at'] = data['created_at'].isoformat()
        if data.get('updated_at'):
            data['updated_at'] = data['updated_at'].isoformat()
        return EnrichmentConfigResponse(**data)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/config/{config_id}", status_code=204)
async def delete_config(
    config_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete enrichment configuration

    Note: Cannot delete global default configuration.
    """
    try:
        # Check if it's the global default
        check_query = "SELECT is_global, config_name FROM cns_enrichment_config WHERE id = :config_id"
        result = db.execute(text(check_query), {"config_id": config_id})
        config = result.fetchone()

        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")

        if config.is_global and config.config_name == "global_default":
            raise HTTPException(status_code=400, detail="Cannot delete global default configuration")

        delete_query = "DELETE FROM cns_enrichment_config WHERE id = :config_id"
        db.execute(text(delete_query), {"config_id": config_id})
        db.commit()

        return None

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cost-tracking", response_model=List[CostTrackingResponse])
async def get_cost_tracking(
    organization_id: Optional[str] = Query(None, description="Filter by organization ID"),
    months: int = Query(6, ge=1, le=24, description="Number of months to retrieve"),
    db: Session = Depends(get_db)
):
    """
    Get cost tracking data

    Returns monthly statistics for AI and web scraping usage.
    """
    try:
        query = """
        SELECT * FROM cns_cost_tracking
        WHERE 1=1
        """
        params = {}

        if organization_id:
            query += " AND organization_id = :organization_id"
            params['organization_id'] = organization_id

        query += " ORDER BY month DESC LIMIT :months"
        params['months'] = months

        result = db.execute(text(query), params)
        tracking_data = result.fetchall()

        # Convert Row objects to dicts for Pydantic
        return [CostTrackingResponse(**dict(row._mapping)) for row in tracking_data]

    except Exception as e:
        logger.error(f"Error retrieving cost tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/{config_id}/toggle-ai", response_model=EnrichmentConfigResponse)
async def toggle_ai(
    config_id: int,
    enable: bool = Query(..., description="Enable or disable AI"),
    db: Session = Depends(get_db)
):
    """
    Quick toggle for AI enhancement

    Convenience endpoint for UI toggle switches.
    """
    return await update_config(
        config_id,
        EnrichmentConfigUpdate(enable_ai=enable),
        db
    )


@router.post("/config/{config_id}/toggle-web-scraping", response_model=EnrichmentConfigResponse)
async def toggle_web_scraping(
    config_id: int,
    enable: bool = Query(..., description="Enable or disable web scraping"),
    db: Session = Depends(get_db)
):
    """
    Quick toggle for web scraping

    Convenience endpoint for UI toggle switches.
    """
    return await update_config(
        config_id,
        EnrichmentConfigUpdate(enable_web_scraping=enable),
        db
    )
