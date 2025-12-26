"""
Risk Analysis API Endpoints

This module provides endpoints for component risk scoring and portfolio risk analysis.
Risk scores are calculated using weighted factors:
- Lifecycle (30%): Based on component status (Active, NRND, EOL, Obsolete)
- Supply Chain (25%): Based on stock levels, lead times, supplier count
- Compliance (20%): Based on RoHS, REACH, AEC-Q compliance
- Obsolescence (15%): Based on product age and market trends
- Single Source (10%): Based on supplier diversity

Caching Strategy (Cache-Aside Pattern):
- Individual risk scores are cached in Redis for fast lookups
- Portfolio summaries have separate cache with shorter TTL
- Cache is populated by:
  1. On-demand: Cache miss triggers DB read + cache write
  2. Event-driven: risk.calculated events populate cache asynchronously

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import logging
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.models.dual_database import get_dual_database
from app.core.authorization import (
    AuthContext,
    get_auth_context,
)

# Import risk cache helpers
try:
    from app.cache.risk_cache import (
        get_cached_risk_dict,
        cache_risk_score,
        get_cached_risks_batch,
        delete_cached_risk,
    )
    RISK_CACHE_AVAILABLE = True
except ImportError:
    RISK_CACHE_AVAILABLE = False

logger = logging.getLogger(__name__)

# Cache settings
PORTFOLIO_CACHE_TTL = 300  # 5 minutes


def _get_portfolio_cache_key(org_id: str) -> str:
    """Generate cache key for portfolio risk summary."""
    return f"risk:portfolio:{org_id}"


def _get_cached_portfolio(org_id: str) -> Optional[Dict]:
    """Get cached portfolio risk summary from Redis."""
    try:
        from app.cache.redis_cache import get_cache
        cache = get_cache()
        if cache and cache.is_connected:
            cached = cache.get(_get_portfolio_cache_key(org_id))
            if cached:
                logger.debug(f"[Risk] Cache hit for portfolio: org={org_id}")
                return cached
    except Exception as e:
        logger.warning(f"[Risk] Cache read error: {e}")
    return None


def _set_portfolio_cache(org_id: str, data: Dict) -> None:
    """Cache portfolio risk summary in Redis."""
    try:
        from app.cache.redis_cache import get_cache
        cache = get_cache()
        if cache and cache.is_connected:
            cache.set(_get_portfolio_cache_key(org_id), data, ttl=PORTFOLIO_CACHE_TTL)
            logger.debug(f"[Risk] Cached portfolio: org={org_id}, ttl={PORTFOLIO_CACHE_TTL}s")
    except Exception as e:
        logger.warning(f"[Risk] Cache write error: {e}")

router = APIRouter(prefix="/risk", tags=["Risk Analysis"])


# =============================================================================
# RESPONSE MODELS
# =============================================================================

class ComponentRiskScore(BaseModel):
    """Complete risk score for a component"""
    component_id: str
    mpn: Optional[str] = None
    manufacturer: Optional[str] = None

    # Individual risk factors (0-100)
    lifecycle_risk: int = Field(ge=0, le=100, default=0)
    supply_chain_risk: int = Field(ge=0, le=100, default=0)
    compliance_risk: int = Field(ge=0, le=100, default=0)
    obsolescence_risk: int = Field(ge=0, le=100, default=0)
    single_source_risk: int = Field(ge=0, le=100, default=0)

    # Total weighted score (0-100)
    total_risk_score: int = Field(ge=0, le=100, default=0)
    risk_level: str = "low"  # low, medium, high, critical

    # Detailed breakdown
    risk_factors: Optional[Dict[str, Any]] = None
    mitigation_suggestions: Optional[str] = None

    # Metadata
    calculated_at: Optional[datetime] = None
    calculation_method: str = "weighted_average_v1"


class RiskScoreHistory(BaseModel):
    """Historical risk score entry"""
    recorded_date: datetime
    total_risk_score: int
    risk_level: str
    score_change: int
    lifecycle_risk: Optional[int] = None
    supply_chain_risk: Optional[int] = None
    compliance_risk: Optional[int] = None
    obsolescence_risk: Optional[int] = None
    single_source_risk: Optional[int] = None


class PortfolioRiskSummary(BaseModel):
    """Portfolio-level risk summary"""
    total_components: int
    risk_distribution: Dict[str, int]
    average_risk_score: float
    trend: str  # improving, stable, worsening
    high_risk_components: List[ComponentRiskScore]
    top_risk_factors: List[str]


class RiskCalculationRequest(BaseModel):
    """Request to trigger risk calculation"""
    force_recalculate: bool = False


class BatchRiskRequest(BaseModel):
    """Request for batch risk scores"""
    component_ids: List[str]


class BulkCalculationRequest(BaseModel):
    """Request for bulk risk calculation"""
    component_ids: List[str] = Field(..., max_length=50, description="Up to 50 components")
    force_recalculate: bool = Field(default=False, description="Force recalculation even if recent score exists")


class BulkCalculationResult(BaseModel):
    """Result from bulk risk calculation"""
    total_requested: int
    successful: int
    failed: int
    scores: List[ComponentRiskScore]
    errors: List[Dict[str, str]]


# =============================================================================
# RISK ENDPOINTS
# =============================================================================

@router.get("/component/{component_id}", response_model=ComponentRiskScore)
async def get_component_risk(
    component_id: str,
    bypass_cache: bool = Query(default=False, description="Bypass cache and fetch from database"),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get the risk score for a single component.

    Uses cache-aside pattern:
    - First checks Redis cache for fast lookup
    - On cache miss, queries database and caches result
    - Use bypass_cache=true to force database lookup

    Returns the current risk score with all individual factors and
    the weighted total. If no risk score exists, returns 404.
    """
    try:
        logger.info(f"[Risk] get_component_risk: user={auth.user_id} component={component_id}")

        org_id = auth.organization_id

        # CACHE-ASIDE PATTERN: Check cache first (unless bypassed)
        if not bypass_cache and RISK_CACHE_AVAILABLE and org_id:
            cached = get_cached_risk_dict(org_id, component_id)
            if cached:
                logger.debug(f"[Risk] Cache hit for component={component_id}")
                factor_scores = cached.get("factor_scores", {})
                return ComponentRiskScore(
                    component_id=cached["component_id"],
                    mpn=cached.get("mpn"),
                    manufacturer=cached.get("manufacturer"),
                    lifecycle_risk=factor_scores.get("lifecycle", 0),
                    supply_chain_risk=factor_scores.get("supply_chain", 0),
                    compliance_risk=factor_scores.get("compliance", 0),
                    obsolescence_risk=factor_scores.get("obsolescence", 0),
                    single_source_risk=factor_scores.get("single_source", 0),
                    total_risk_score=cached.get("total_risk_score", 0),
                    risk_level=cached.get("risk_level", "low"),
                    calculated_at=cached.get("cached_at"),
                )

        # Cache miss - query database
        db = next(get_dual_database().get_session("supabase"))

        # Build query with tenant isolation
        params: Dict[str, Any] = {"component_id": component_id}

        # APP-LAYER RLS: Apply tenant filtering
        org_filter = ""
        if not auth.is_super_admin:
            org_filter = "AND blrs.organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        # Query from bom_line_item_risk_scores (component_id is actually bom_line_item_id)
        sql = f"""
            SELECT
                blrs.bom_line_item_id as component_id,
                cbrs.lifecycle_risk,
                cbrs.supply_chain_risk,
                cbrs.compliance_risk,
                cbrs.obsolescence_risk,
                cbrs.single_source_risk,
                blrs.contextual_risk_score as total_risk_score,
                blrs.risk_level,
                cbrs.risk_factors,
                NULL as mitigation_suggestions,
                blrs.calculated_at as calculation_date,
                cbrs.calculation_method,
                bli.manufacturer_part_number,
                bli.manufacturer
            FROM bom_line_item_risk_scores blrs
            JOIN bom_line_items bli ON bli.id = blrs.bom_line_item_id
            LEFT JOIN component_base_risk_scores cbrs ON cbrs.id = blrs.base_risk_id
            WHERE blrs.bom_line_item_id = :component_id
            {org_filter}
        """

        row = db.execute(text(sql), params).fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"No risk score found for component {component_id}"
            )

        m = row._mapping

        result = ComponentRiskScore(
            component_id=str(m["component_id"]),
            mpn=m.get("manufacturer_part_number"),
            manufacturer=m.get("manufacturer"),
            lifecycle_risk=m.get("lifecycle_risk") or 0,
            supply_chain_risk=m.get("supply_chain_risk") or 0,
            compliance_risk=m.get("compliance_risk") or 0,
            obsolescence_risk=m.get("obsolescence_risk") or 0,
            single_source_risk=m.get("single_source_risk") or 0,
            total_risk_score=m.get("total_risk_score") or 0,
            risk_level=m.get("risk_level") or "low",
            risk_factors=m.get("risk_factors"),
            mitigation_suggestions=m.get("mitigation_suggestions"),
            calculated_at=m.get("calculation_date"),
            calculation_method=m.get("calculation_method") or "weighted_average_v1",
        )

        # CACHE-ASIDE PATTERN: Populate cache on miss
        if RISK_CACHE_AVAILABLE and org_id:
            cache_data = {
                "component_id": result.component_id,
                "organization_id": org_id,
                "mpn": result.mpn,
                "manufacturer": result.manufacturer,
                "total_risk_score": result.total_risk_score,
                "risk_level": result.risk_level,
                "factor_scores": {
                    "lifecycle": result.lifecycle_risk,
                    "supply_chain": result.supply_chain_risk,
                    "compliance": result.compliance_risk,
                    "obsolescence": result.obsolescence_risk,
                    "single_source": result.single_source_risk,
                },
            }
            cache_risk_score(org_id, component_id, cache_data)
            logger.debug(f"[Risk] Cached risk score for component={component_id}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get risk score for component {component_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch risk score")


@router.post("/components", response_model=List[ComponentRiskScore])
async def get_batch_risk_scores(
    batch_request: BatchRiskRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get risk scores for multiple components in a single request.

    Returns risk scores for all requested components that have scores.
    Components without scores are omitted from the response.
    Maximum 100 components per request.
    """
    if len(batch_request.component_ids) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 components per batch request"
        )

    try:
        db = next(get_dual_database().get_session("supabase"))

        logger.info(f"[Risk] get_batch_risk_scores: user={auth.user_id} count={len(batch_request.component_ids)}")

        # Build IN clause
        placeholders = ", ".join([f":id_{i}" for i in range(len(batch_request.component_ids))])
        params: Dict[str, Any] = {f"id_{i}": cid for i, cid in enumerate(batch_request.component_ids)}

        # APP-LAYER RLS: Apply tenant filtering
        org_filter = ""
        if not auth.is_super_admin:
            org_filter = "AND blrs.organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        # Query from bom_line_item_risk_scores (component_ids are bom_line_item_ids)
        sql = f"""
            SELECT
                blrs.bom_line_item_id as component_id,
                cbrs.lifecycle_risk,
                cbrs.supply_chain_risk,
                cbrs.compliance_risk,
                cbrs.obsolescence_risk,
                cbrs.single_source_risk,
                blrs.contextual_risk_score as total_risk_score,
                blrs.risk_level,
                cbrs.risk_factors,
                NULL as mitigation_suggestions,
                blrs.calculated_at as calculation_date,
                bli.manufacturer_part_number,
                bli.manufacturer
            FROM bom_line_item_risk_scores blrs
            JOIN bom_line_items bli ON bli.id = blrs.bom_line_item_id
            LEFT JOIN component_base_risk_scores cbrs ON cbrs.id = blrs.base_risk_id
            WHERE blrs.bom_line_item_id IN ({placeholders})
            {org_filter}
        """

        rows = db.execute(text(sql), params).fetchall()

        scores = []
        for row in rows:
            m = row._mapping
            scores.append(ComponentRiskScore(
                component_id=str(m["component_id"]),
                mpn=m.get("manufacturer_part_number"),
                manufacturer=m.get("manufacturer"),
                lifecycle_risk=m.get("lifecycle_risk") or 0,
                supply_chain_risk=m.get("supply_chain_risk") or 0,
                compliance_risk=m.get("compliance_risk") or 0,
                obsolescence_risk=m.get("obsolescence_risk") or 0,
                single_source_risk=m.get("single_source_risk") or 0,
                total_risk_score=m.get("total_risk_score") or 0,
                risk_level=m.get("risk_level") or "low",
                risk_factors=m.get("risk_factors"),
                mitigation_suggestions=m.get("mitigation_suggestions"),
                calculated_at=m.get("calculation_date"),
            ))

        return scores

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get batch risk scores: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch risk scores")


@router.post("/calculate/{component_id}", response_model=ComponentRiskScore)
async def calculate_component_risk(
    component_id: str,
    calc_request: RiskCalculationRequest = RiskCalculationRequest(),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger risk recalculation for a specific component.

    This endpoint forces a fresh calculation of all risk factors
    and updates the stored risk score. The cache is automatically
    invalidated and repopulated via the risk.calculated event.
    """
    try:
        logger.info(f"[Risk] calculate_component_risk: user={auth.user_id} component={component_id}")

        # Invalidate cache before recalculation
        if RISK_CACHE_AVAILABLE and auth.organization_id:
            delete_cached_risk(auth.organization_id, component_id)
            logger.debug(f"[Risk] Invalidated cache for component={component_id}")

        # Import risk calculator service
        from app.services.risk_calculator import RiskCalculatorService

        calculator = RiskCalculatorService()
        risk_score = await calculator.calculate_total_risk(
            component_id=component_id,
            organization_id=auth.organization_id,
            force_recalculate=calc_request.force_recalculate
        )

        logger.info(f"[Risk] Calculated: component={component_id} score={risk_score.total_risk_score}")
        return risk_score

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to calculate risk for component {component_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to calculate risk score")


@router.post("/calculate/bulk", response_model=BulkCalculationResult)
async def calculate_bulk_risk(
    bulk_request: BulkCalculationRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger risk calculation for multiple components in a single request.

    This endpoint processes up to 50 components and returns results for all.
    Failed calculations are reported in the errors list without stopping
    processing of remaining components.

    Returns:
    - total_requested: Number of components in the request
    - successful: Number successfully calculated
    - failed: Number that failed
    - scores: List of successful risk scores
    - errors: List of component_id and error message for failures
    """
    if len(bulk_request.component_ids) > 50:
        raise HTTPException(
            status_code=400,
            detail="Maximum 50 components per bulk calculation request"
        )

    logger.info(
        f"[Risk] calculate_bulk_risk: user={auth.user_id} "
        f"count={len(bulk_request.component_ids)} force={bulk_request.force_recalculate}"
    )

    # Import risk calculator service
    from app.services.risk_calculator import RiskCalculatorService

    calculator = RiskCalculatorService()
    scores: List[ComponentRiskScore] = []
    errors: List[Dict[str, str]] = []

    for component_id in bulk_request.component_ids:
        try:
            risk_score = await calculator.calculate_total_risk(
                component_id=component_id,
                organization_id=auth.organization_id,
                force_recalculate=bulk_request.force_recalculate
            )
            scores.append(risk_score)
            logger.debug(f"[Risk] Bulk calculated: component={component_id} score={risk_score.total_risk_score}")
        except ValueError as e:
            logger.warning(f"[Risk] Bulk calculation not found: component={component_id} error={e}")
            errors.append({"component_id": component_id, "error": str(e)})
        except Exception as e:
            logger.error(f"[Risk] Bulk calculation failed: component={component_id} error={e}")
            errors.append({"component_id": component_id, "error": f"Calculation failed: {str(e)}"})

    logger.info(
        f"[Risk] Bulk calculation complete: successful={len(scores)} failed={len(errors)}"
    )

    # Invalidate portfolio cache since scores may have changed
    if auth.organization_id and scores:
        try:
            from app.cache.redis_cache import get_cache
            cache = get_cache()
            if cache and cache.is_connected:
                cache.delete(_get_portfolio_cache_key(auth.organization_id))
                logger.debug(f"[Risk] Invalidated portfolio cache after bulk calculation: org={auth.organization_id}")
        except Exception as cache_err:
            logger.warning(f"[Risk] Failed to invalidate cache: {cache_err}")

    return BulkCalculationResult(
        total_requested=len(bulk_request.component_ids),
        successful=len(scores),
        failed=len(errors),
        scores=scores,
        errors=errors
    )


@router.get("/portfolio", response_model=PortfolioRiskSummary)
async def get_portfolio_risk(
    force_refresh: bool = Query(default=False, description="Force bypass of cache"),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get portfolio-level risk summary for the organization.

    Returns:
    - Risk distribution across all components
    - Average risk score
    - Trend indicator (improving/stable/worsening)
    - Top high-risk components
    - Most common risk factors

    Results are cached for 5 minutes to improve performance.
    Use force_refresh=true to bypass cache.
    """
    try:
        logger.info(f"[Risk] get_portfolio_risk: user={auth.user_id} org={auth.organization_id}")

        # Check cache first (unless force refresh requested)
        if not force_refresh and auth.organization_id:
            cached = _get_cached_portfolio(auth.organization_id)
            if cached:
                logger.info(f"[Risk] Returning cached portfolio risk: org={auth.organization_id}")
                return PortfolioRiskSummary(**cached)

        db = next(get_dual_database().get_session("supabase"))

        params: Dict[str, Any] = {}

        # APP-LAYER RLS: Apply tenant filtering
        org_filter = "WHERE 1=1"
        if not auth.is_super_admin:
            org_filter = "WHERE blrs.organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        # Query from bom_line_item_risk_scores joined with component_base_risk_scores
        # to get both contextual and base risk data
        sql = f"""
            SELECT
                blrs.bom_line_item_id as component_id,
                cbrs.lifecycle_risk,
                cbrs.supply_chain_risk,
                cbrs.compliance_risk,
                cbrs.obsolescence_risk,
                cbrs.single_source_risk,
                blrs.contextual_risk_score as total_risk_score,
                blrs.risk_level,
                bli.manufacturer_part_number,
                bli.manufacturer
            FROM bom_line_item_risk_scores blrs
            JOIN bom_line_items bli ON bli.id = blrs.bom_line_item_id
            LEFT JOIN component_base_risk_scores cbrs ON cbrs.id = blrs.base_risk_id
            {org_filter}
        """

        rows = db.execute(text(sql), params).fetchall()

        if not rows:
            return PortfolioRiskSummary(
                total_components=0,
                risk_distribution={"low": 0, "medium": 0, "high": 0, "critical": 0},
                average_risk_score=0.0,
                trend="stable",
                high_risk_components=[],
                top_risk_factors=[],
            )

        # Calculate distribution
        distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        total_score = 0
        high_risk_components = []

        # Track risk factors
        factor_counts = {
            "lifecycle": 0,
            "supply_chain": 0,
            "compliance": 0,
            "obsolescence": 0,
            "single_source": 0,
        }

        for row in rows:
            m = row._mapping
            risk_level = m.get("risk_level") or "low"
            distribution[risk_level] = distribution.get(risk_level, 0) + 1
            total_score += m.get("total_risk_score") or 0

            # Track which factors contribute most
            if (m.get("lifecycle_risk") or 0) > 50:
                factor_counts["lifecycle"] += 1
            if (m.get("supply_chain_risk") or 0) > 50:
                factor_counts["supply_chain"] += 1
            if (m.get("compliance_risk") or 0) > 50:
                factor_counts["compliance"] += 1
            if (m.get("obsolescence_risk") or 0) > 50:
                factor_counts["obsolescence"] += 1
            if (m.get("single_source_risk") or 0) > 50:
                factor_counts["single_source"] += 1

            # Collect high-risk components
            if risk_level in ("high", "critical"):
                high_risk_components.append(ComponentRiskScore(
                    component_id=str(m["component_id"]),
                    mpn=m.get("manufacturer_part_number"),
                    manufacturer=m.get("manufacturer"),
                    lifecycle_risk=m.get("lifecycle_risk") or 0,
                    supply_chain_risk=m.get("supply_chain_risk") or 0,
                    compliance_risk=m.get("compliance_risk") or 0,
                    obsolescence_risk=m.get("obsolescence_risk") or 0,
                    single_source_risk=m.get("single_source_risk") or 0,
                    total_risk_score=m.get("total_risk_score") or 0,
                    risk_level=risk_level,
                ))

        # Sort high-risk by score descending, limit to top 10
        high_risk_components.sort(key=lambda x: x.total_risk_score, reverse=True)
        high_risk_components = high_risk_components[:10]

        # Get top risk factors
        sorted_factors = sorted(factor_counts.items(), key=lambda x: x[1], reverse=True)
        top_risk_factors = [f[0] for f in sorted_factors if f[1] > 0][:3]

        # Calculate trend from historical data (compare to 7 days ago)
        current_avg = round(total_score / len(rows), 1)
        trend = "stable"

        try:
            # Get historical average from 7 days ago
            history_org_filter = "WHERE 1=1"
            history_params: Dict[str, Any] = {}
            if not auth.is_super_admin:
                history_org_filter = "WHERE organization_id = :auth_org_id"
                history_params["auth_org_id"] = auth.organization_id

            history_sql = f"""
                SELECT AVG(total_risk_score) as avg_score
                FROM risk_score_history
                {history_org_filter}
                AND recorded_date BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
            """
            history_row = db.execute(text(history_sql), history_params).fetchone()

            if history_row and history_row._mapping.get("avg_score"):
                historical_avg = float(history_row._mapping["avg_score"])
                score_diff = current_avg - historical_avg

                # Determine trend based on score change
                if score_diff < -5:
                    trend = "improving"  # Score decreased (good)
                elif score_diff > 5:
                    trend = "worsening"  # Score increased (bad)
                else:
                    trend = "stable"
        except Exception as trend_err:
            logger.warning(f"Failed to calculate trend: {trend_err}")
            trend = "stable"

        result = PortfolioRiskSummary(
            total_components=len(rows),
            risk_distribution=distribution,
            average_risk_score=current_avg,
            trend=trend,
            high_risk_components=high_risk_components,
            top_risk_factors=top_risk_factors,
        )

        # Cache the result for future requests
        if auth.organization_id:
            _set_portfolio_cache(auth.organization_id, result.model_dump())
            logger.debug(f"[Risk] Cached portfolio risk summary: org={auth.organization_id}")

        return result

    except Exception as e:
        # Handle missing tables gracefully - return empty data
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning(f"[Risk] Risk tables not yet created - returning empty portfolio")
            return PortfolioRiskSummary(
                total_components=0,
                risk_distribution={"low": 0, "medium": 0, "high": 0, "critical": 0},
                average_risk_score=0.0,
                trend="stable",
                high_risk_components=[],
                top_risk_factors=[],
            )
        logger.error(f"Failed to get portfolio risk: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch portfolio risk summary")


@router.get("/history/{component_id}", response_model=List[RiskScoreHistory])
async def get_risk_history(
    component_id: str,
    limit: int = Query(default=30, ge=1, le=365),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get risk score history for a component.

    Returns historical risk scores to show trends over time.
    Default limit is 30 records (roughly one month of daily scores).
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        logger.info(f"[Risk] get_risk_history: user={auth.user_id} component={component_id}")

        params: Dict[str, Any] = {
            "component_id": component_id,
            "limit": limit
        }

        # APP-LAYER RLS: Apply tenant filtering
        org_filter = ""
        if not auth.is_super_admin:
            org_filter = "AND organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        sql = f"""
            SELECT
                recorded_date,
                total_risk_score,
                risk_level,
                score_change,
                lifecycle_risk,
                supply_chain_risk,
                compliance_risk,
                obsolescence_risk,
                single_source_risk
            FROM risk_score_history
            WHERE component_id = :component_id
            {org_filter}
            ORDER BY recorded_date DESC
            LIMIT :limit
        """

        rows = db.execute(text(sql), params).fetchall()

        history = []
        for row in rows:
            m = row._mapping
            history.append(RiskScoreHistory(
                recorded_date=m["recorded_date"],
                total_risk_score=m["total_risk_score"],
                risk_level=m["risk_level"],
                score_change=m.get("score_change") or 0,
                lifecycle_risk=m.get("lifecycle_risk"),
                supply_chain_risk=m.get("supply_chain_risk"),
                compliance_risk=m.get("compliance_risk"),
                obsolescence_risk=m.get("obsolescence_risk"),
                single_source_risk=m.get("single_source_risk"),
            ))

        return history

    except Exception as e:
        # Handle missing tables gracefully
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning(f"[Risk] Risk tables not yet created - returning empty history")
            return []
        logger.error(f"Failed to get risk history for component {component_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch risk history")


@router.get("/high-risk", response_model=List[ComponentRiskScore])
async def get_high_risk_components(
    min_score: int = Query(default=61, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=200),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    List components with high or critical risk.

    Parameters:
    - min_score: Minimum risk score to include (default: 61 = high risk)
    - limit: Maximum number of results (default: 50)

    Returns components sorted by risk score descending.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        logger.info(f"[Risk] get_high_risk_components: user={auth.user_id} min_score={min_score}")

        params: Dict[str, Any] = {
            "min_score": min_score,
            "limit": limit
        }

        # APP-LAYER RLS: Apply tenant filtering
        org_filter = ""
        if not auth.is_super_admin:
            org_filter = "AND blrs.organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        # Query from bom_line_item_risk_scores
        sql = f"""
            SELECT
                blrs.bom_line_item_id as component_id,
                cbrs.lifecycle_risk,
                cbrs.supply_chain_risk,
                cbrs.compliance_risk,
                cbrs.obsolescence_risk,
                cbrs.single_source_risk,
                blrs.contextual_risk_score as total_risk_score,
                blrs.risk_level,
                cbrs.risk_factors,
                NULL as mitigation_suggestions,
                blrs.calculated_at as calculation_date,
                bli.manufacturer_part_number,
                bli.manufacturer
            FROM bom_line_item_risk_scores blrs
            JOIN bom_line_items bli ON bli.id = blrs.bom_line_item_id
            LEFT JOIN component_base_risk_scores cbrs ON cbrs.id = blrs.base_risk_id
            WHERE blrs.contextual_risk_score >= :min_score
            {org_filter}
            ORDER BY blrs.contextual_risk_score DESC
            LIMIT :limit
        """

        rows = db.execute(text(sql), params).fetchall()

        components = []
        for row in rows:
            m = row._mapping
            components.append(ComponentRiskScore(
                component_id=str(m["component_id"]),
                mpn=m.get("manufacturer_part_number"),
                manufacturer=m.get("manufacturer"),
                lifecycle_risk=m.get("lifecycle_risk") or 0,
                supply_chain_risk=m.get("supply_chain_risk") or 0,
                compliance_risk=m.get("compliance_risk") or 0,
                obsolescence_risk=m.get("obsolescence_risk") or 0,
                single_source_risk=m.get("single_source_risk") or 0,
                total_risk_score=m.get("total_risk_score") or 0,
                risk_level=m.get("risk_level") or "low",
                risk_factors=m.get("risk_factors"),
                mitigation_suggestions=m.get("mitigation_suggestions"),
                calculated_at=m.get("calculation_date"),
            ))

        return components

    except Exception as e:
        # Handle missing tables gracefully
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning(f"[Risk] Risk tables not yet created - returning empty high-risk list")
            return []
        logger.error(f"Failed to get high-risk components: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch high-risk components")


@router.get("/stats", response_model=Dict[str, Any])
async def get_risk_statistics(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get aggregate risk statistics for the organization.

    Returns counts, averages, and distributions for quick dashboard display.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        logger.info(f"[Risk] get_risk_statistics: user={auth.user_id} org={auth.organization_id}")

        params: Dict[str, Any] = {}

        # APP-LAYER RLS: Apply tenant filtering
        org_filter = "WHERE 1=1"
        if not auth.is_super_admin:
            org_filter = "WHERE blrs.organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        # Query from bom_line_item_risk_scores joined with component_base_risk_scores
        sql = f"""
            SELECT
                blrs.contextual_risk_score as total_risk_score,
                blrs.risk_level,
                cbrs.lifecycle_risk,
                cbrs.supply_chain_risk,
                cbrs.compliance_risk,
                cbrs.obsolescence_risk,
                cbrs.single_source_risk
            FROM bom_line_item_risk_scores blrs
            LEFT JOIN component_base_risk_scores cbrs ON cbrs.id = blrs.base_risk_id
            {org_filter}
        """

        rows = db.execute(text(sql), params).fetchall()

        if not rows:
            return {
                "total_components": 0,
                "average_risk_score": 0,
                "risk_distribution": {"low": 0, "medium": 0, "high": 0, "critical": 0},
                "factor_averages": {
                    "lifecycle": 0,
                    "supply_chain": 0,
                    "compliance": 0,
                    "obsolescence": 0,
                    "single_source": 0,
                },
                "components_requiring_attention": 0,
            }

        # Calculate stats
        total = len(rows)
        total_score = 0

        distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        factor_totals = {
            "lifecycle": 0,
            "supply_chain": 0,
            "compliance": 0,
            "obsolescence": 0,
            "single_source": 0,
        }

        for row in rows:
            m = row._mapping
            distribution[m.get("risk_level") or "low"] += 1
            total_score += m.get("total_risk_score") or 0
            factor_totals["lifecycle"] += m.get("lifecycle_risk") or 0
            factor_totals["supply_chain"] += m.get("supply_chain_risk") or 0
            factor_totals["compliance"] += m.get("compliance_risk") or 0
            factor_totals["obsolescence"] += m.get("obsolescence_risk") or 0
            factor_totals["single_source"] += m.get("single_source_risk") or 0

        factor_averages = {k: round(v / total, 1) for k, v in factor_totals.items()}

        return {
            "total_components": total,
            "average_risk_score": round(total_score / total, 1),
            "risk_distribution": distribution,
            "factor_averages": factor_averages,
            "components_requiring_attention": distribution["high"] + distribution["critical"],
        }

    except Exception as e:
        # Handle missing tables gracefully
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning(f"[Risk] Risk tables not yet created - returning empty statistics")
            return {
                "total_components": 0,
                "average_risk_score": 0,
                "risk_distribution": {"low": 0, "medium": 0, "high": 0, "critical": 0},
                "factor_averages": {
                    "lifecycle": 0,
                    "supply_chain": 0,
                    "compliance": 0,
                    "obsolescence": 0,
                    "single_source": 0,
                },
                "components_requiring_attention": 0,
            }
        logger.error(f"Failed to get risk statistics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch risk statistics")


# =============================================================================
# RISK PROFILE MANAGEMENT ENDPOINTS
# =============================================================================

class RiskProfileResponse(BaseModel):
    """Organization risk profile response."""
    id: Optional[str] = None
    organization_id: str
    lifecycle_weight: int = 30
    supply_chain_weight: int = 25
    compliance_weight: int = 20
    obsolescence_weight: int = 15
    single_source_weight: int = 10
    low_threshold: int = 30
    medium_threshold: int = 60
    high_threshold: int = 85
    quantity_weight: float = 0.15
    lead_time_weight: float = 0.10
    criticality_weight: float = 0.20
    preset_name: str = "default"
    custom_factors: List[Dict] = []


class RiskProfileUpdateRequest(BaseModel):
    """Request to update risk profile."""
    lifecycle_weight: Optional[int] = Field(None, ge=0, le=100)
    supply_chain_weight: Optional[int] = Field(None, ge=0, le=100)
    compliance_weight: Optional[int] = Field(None, ge=0, le=100)
    obsolescence_weight: Optional[int] = Field(None, ge=0, le=100)
    single_source_weight: Optional[int] = Field(None, ge=0, le=100)
    low_threshold: Optional[int] = Field(None, ge=1, le=99)
    medium_threshold: Optional[int] = Field(None, ge=1, le=99)
    high_threshold: Optional[int] = Field(None, ge=1, le=99)
    quantity_weight: Optional[float] = Field(None, ge=0, le=1)
    lead_time_weight: Optional[float] = Field(None, ge=0, le=1)
    criticality_weight: Optional[float] = Field(None, ge=0, le=1)
    preset_name: Optional[str] = None
    custom_factors: Optional[List[Dict]] = None


class RiskPresetResponse(BaseModel):
    """Industry preset response."""
    id: str
    name: str
    display_name: str
    description: Optional[str]
    lifecycle_weight: int
    supply_chain_weight: int
    compliance_weight: int
    obsolescence_weight: int
    single_source_weight: int
    low_threshold: int
    medium_threshold: int
    high_threshold: int


class ApplyPresetRequest(BaseModel):
    """Request to apply an industry preset."""
    preset_name: str = Field(..., description="Preset name: default, automotive, medical, aerospace, consumer, industrial")


@router.get("/profile", response_model=RiskProfileResponse)
async def get_risk_profile(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get the organization's risk profile configuration.

    Returns current risk weights, thresholds, and custom factors.
    If no profile exists, creates and returns a default profile.
    """
    try:
        logger.info(f"[Risk] get_risk_profile: user={auth.user_id} org={auth.organization_id}")

        from app.services.risk_calculation_service import get_risk_calculation_service

        service = get_risk_calculation_service()
        profile = await service.get_or_create_profile(auth.organization_id)

        return RiskProfileResponse(
            id=profile.id,
            organization_id=profile.organization_id,
            lifecycle_weight=profile.lifecycle_weight,
            supply_chain_weight=profile.supply_chain_weight,
            compliance_weight=profile.compliance_weight,
            obsolescence_weight=profile.obsolescence_weight,
            single_source_weight=profile.single_source_weight,
            low_threshold=profile.low_threshold,
            medium_threshold=profile.medium_threshold,
            high_threshold=profile.high_threshold,
            quantity_weight=profile.quantity_weight,
            lead_time_weight=profile.lead_time_weight,
            criticality_weight=profile.criticality_weight,
            preset_name=profile.preset_name,
            custom_factors=profile.custom_factors,
        )

    except Exception as e:
        logger.error(f"[Risk] Failed to get risk profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get risk profile")


@router.put("/profile", response_model=RiskProfileResponse)
async def update_risk_profile(
    update_request: RiskProfileUpdateRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Update the organization's risk profile configuration.

    Note: Risk factor weights must sum to 100.
    Note: Thresholds must be in ascending order (low < medium < high).
    """
    try:
        logger.info(f"[Risk] update_risk_profile: user={auth.user_id} org={auth.organization_id}")

        from app.services.risk_calculation_service import get_risk_calculation_service

        # Build updates dict (only include non-None values)
        updates = {}
        for field, value in update_request.model_dump().items():
            if value is not None:
                updates[field] = value

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        service = get_risk_calculation_service()
        profile = await service.update_profile(auth.organization_id, updates)

        logger.info(f"[Risk] Updated risk profile: org={auth.organization_id} fields={list(updates.keys())}")

        return RiskProfileResponse(
            id=profile.id,
            organization_id=profile.organization_id,
            lifecycle_weight=profile.lifecycle_weight,
            supply_chain_weight=profile.supply_chain_weight,
            compliance_weight=profile.compliance_weight,
            obsolescence_weight=profile.obsolescence_weight,
            single_source_weight=profile.single_source_weight,
            low_threshold=profile.low_threshold,
            medium_threshold=profile.medium_threshold,
            high_threshold=profile.high_threshold,
            quantity_weight=profile.quantity_weight,
            lead_time_weight=profile.lead_time_weight,
            criticality_weight=profile.criticality_weight,
            preset_name=profile.preset_name,
            custom_factors=profile.custom_factors,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Risk] Failed to update risk profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update risk profile")


@router.post("/profile/reset", response_model=RiskProfileResponse)
async def reset_risk_profile(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Reset the organization's risk profile to default values.
    """
    try:
        logger.info(f"[Risk] reset_risk_profile: user={auth.user_id} org={auth.organization_id}")

        from app.services.risk_calculation_service import get_risk_calculation_service

        default_values = {
            "lifecycle_weight": 30,
            "supply_chain_weight": 25,
            "compliance_weight": 20,
            "obsolescence_weight": 15,
            "single_source_weight": 10,
            "low_threshold": 30,
            "medium_threshold": 60,
            "high_threshold": 85,
            "quantity_weight": 0.15,
            "lead_time_weight": 0.10,
            "criticality_weight": 0.20,
            "preset_name": "default",
            "custom_factors": [],
        }

        service = get_risk_calculation_service()
        profile = await service.update_profile(auth.organization_id, default_values)

        logger.info(f"[Risk] Reset risk profile to defaults: org={auth.organization_id}")

        return RiskProfileResponse(
            id=profile.id,
            organization_id=profile.organization_id,
            lifecycle_weight=profile.lifecycle_weight,
            supply_chain_weight=profile.supply_chain_weight,
            compliance_weight=profile.compliance_weight,
            obsolescence_weight=profile.obsolescence_weight,
            single_source_weight=profile.single_source_weight,
            low_threshold=profile.low_threshold,
            medium_threshold=profile.medium_threshold,
            high_threshold=profile.high_threshold,
            quantity_weight=profile.quantity_weight,
            lead_time_weight=profile.lead_time_weight,
            criticality_weight=profile.criticality_weight,
            preset_name=profile.preset_name,
            custom_factors=profile.custom_factors,
        )

    except Exception as e:
        logger.error(f"[Risk] Failed to reset risk profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reset risk profile")


@router.get("/profile/presets", response_model=List[RiskPresetResponse])
async def get_risk_presets(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get available industry presets for risk configuration.

    Returns presets for: default, automotive, medical, aerospace, consumer, industrial.
    """
    try:
        logger.info(f"[Risk] get_risk_presets: user={auth.user_id}")

        db = next(get_dual_database().get_session("supabase"))

        sql = """
            SELECT
                id, name, display_name, description,
                lifecycle_weight, supply_chain_weight, compliance_weight,
                obsolescence_weight, single_source_weight,
                low_threshold, medium_threshold, high_threshold
            FROM risk_profile_presets
            ORDER BY name
        """

        rows = db.execute(text(sql)).fetchall()

        presets = []
        for row in rows:
            m = row._mapping
            presets.append(RiskPresetResponse(
                id=str(m["id"]),
                name=m["name"],
                display_name=m["display_name"],
                description=m.get("description"),
                lifecycle_weight=m["lifecycle_weight"],
                supply_chain_weight=m["supply_chain_weight"],
                compliance_weight=m["compliance_weight"],
                obsolescence_weight=m["obsolescence_weight"],
                single_source_weight=m["single_source_weight"],
                low_threshold=m["low_threshold"],
                medium_threshold=m["medium_threshold"],
                high_threshold=m["high_threshold"],
            ))

        return presets

    except Exception as e:
        # Handle missing table gracefully
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning("[Risk] risk_profile_presets table not found - returning empty list")
            return []
        logger.error(f"[Risk] Failed to get risk presets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get risk presets")


@router.post("/profile/apply-preset", response_model=RiskProfileResponse)
async def apply_risk_preset(
    request: ApplyPresetRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Apply an industry preset to the organization's risk profile.

    Available presets: default, automotive, medical, aerospace, consumer, industrial.
    """
    try:
        logger.info(f"[Risk] apply_risk_preset: user={auth.user_id} preset={request.preset_name}")

        db = next(get_dual_database().get_session("supabase"))

        # Get preset configuration
        sql = """
            SELECT
                lifecycle_weight, supply_chain_weight, compliance_weight,
                obsolescence_weight, single_source_weight,
                low_threshold, medium_threshold, high_threshold,
                quantity_weight, lead_time_weight, criticality_weight,
                custom_factors
            FROM risk_profile_presets
            WHERE name = :preset_name
        """

        row = db.execute(text(sql), {"preset_name": request.preset_name}).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Preset '{request.preset_name}' not found")

        m = row._mapping
        updates = {
            "lifecycle_weight": m["lifecycle_weight"],
            "supply_chain_weight": m["supply_chain_weight"],
            "compliance_weight": m["compliance_weight"],
            "obsolescence_weight": m["obsolescence_weight"],
            "single_source_weight": m["single_source_weight"],
            "low_threshold": m["low_threshold"],
            "medium_threshold": m["medium_threshold"],
            "high_threshold": m["high_threshold"],
            "quantity_weight": float(m["quantity_weight"]),
            "lead_time_weight": float(m["lead_time_weight"]),
            "criticality_weight": float(m["criticality_weight"]),
            "preset_name": request.preset_name,
            "custom_factors": m.get("custom_factors") or [],
        }

        from app.services.risk_calculation_service import get_risk_calculation_service

        service = get_risk_calculation_service()
        profile = await service.update_profile(auth.organization_id, updates)

        logger.info(f"[Risk] Applied preset '{request.preset_name}': org={auth.organization_id}")

        return RiskProfileResponse(
            id=profile.id,
            organization_id=profile.organization_id,
            lifecycle_weight=profile.lifecycle_weight,
            supply_chain_weight=profile.supply_chain_weight,
            compliance_weight=profile.compliance_weight,
            obsolescence_weight=profile.obsolescence_weight,
            single_source_weight=profile.single_source_weight,
            low_threshold=profile.low_threshold,
            medium_threshold=profile.medium_threshold,
            high_threshold=profile.high_threshold,
            quantity_weight=profile.quantity_weight,
            lead_time_weight=profile.lead_time_weight,
            criticality_weight=profile.criticality_weight,
            preset_name=profile.preset_name,
            custom_factors=profile.custom_factors,
        )

    except HTTPException:
        raise
    except Exception as e:
        # Handle missing table gracefully
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning("[Risk] risk_profile_presets table not found")
            raise HTTPException(status_code=404, detail="Risk presets not configured")
        logger.error(f"[Risk] Failed to apply risk preset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to apply risk preset")


# =============================================================================
# MULTI-LEVEL RISK QUERY ENDPOINTS
# =============================================================================

class BOMRiskSummaryResponse(BaseModel):
    """BOM risk summary response."""
    bom_id: str
    bom_name: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    total_line_items: int = 0
    low_risk_count: int = 0
    medium_risk_count: int = 0
    high_risk_count: int = 0
    critical_risk_count: int = 0
    average_risk_score: float = 0.0
    weighted_risk_score: float = 0.0
    health_grade: str = "A"
    score_trend: str = "stable"
    top_risk_components: List[Dict] = []


class ProjectRiskSummaryResponse(BaseModel):
    """Project risk summary response."""
    project_id: str
    project_name: Optional[str] = None
    total_boms: int = 0
    healthy_boms: int = 0
    at_risk_boms: int = 0
    critical_boms: int = 0
    total_components: int = 0
    average_bom_health_score: float = 0.0
    risk_distribution: Dict[str, int] = {}


class BOMLineItemRiskResponse(BaseModel):
    """BOM line item risk response."""
    line_item_id: str
    mpn: Optional[str] = None
    manufacturer: Optional[str] = None
    quantity: int = 0
    base_risk_score: int = 0
    contextual_risk_score: int = 0
    risk_level: str = "low"
    user_criticality_level: int = 5
    quantity_modifier: int = 0
    lead_time_modifier: int = 0
    criticality_modifier: int = 0


class UpdateLineItemCriticalityRequest(BaseModel):
    """Request to update line item criticality."""
    criticality_level: int = Field(..., ge=1, le=10, description="Criticality level 1-10")


@router.get("/boms", response_model=List[BOMRiskSummaryResponse])
async def get_boms_with_risk(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    health_grade: Optional[str] = Query(None, description="Filter by health grade (A, B, C, D, F)"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get all BOMs with their risk summaries.

    Supports filtering by project and health grade.
    """
    try:
        logger.info(f"[Risk] get_boms_with_risk: user={auth.user_id} project={project_id}")

        db = next(get_dual_database().get_session("supabase"))

        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        filters = []

        # Tenant isolation
        if not auth.is_super_admin:
            filters.append("b.organization_id = :auth_org_id")
            params["auth_org_id"] = auth.organization_id

        if project_id:
            filters.append("b.project_id = :project_id")
            params["project_id"] = project_id

        if health_grade:
            filters.append("brs.health_grade = :health_grade")
            params["health_grade"] = health_grade.upper()

        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

        sql = f"""
            SELECT
                b.id as bom_id,
                b.name as bom_name,
                b.project_id,
                p.name as project_name,
                COALESCE(brs.total_line_items, 0) as total_line_items,
                COALESCE(brs.low_risk_count, 0) as low_risk_count,
                COALESCE(brs.medium_risk_count, 0) as medium_risk_count,
                COALESCE(brs.high_risk_count, 0) as high_risk_count,
                COALESCE(brs.critical_risk_count, 0) as critical_risk_count,
                COALESCE(brs.average_risk_score, 0) as average_risk_score,
                COALESCE(brs.weighted_risk_score, 0) as weighted_risk_score,
                COALESCE(brs.health_grade, 'N/A') as health_grade,
                COALESCE(brs.score_trend, 'stable') as score_trend,
                COALESCE(brs.top_risk_components, '[]'::jsonb) as top_risk_components
            FROM boms b
            LEFT JOIN bom_risk_summaries brs ON b.id = brs.bom_id
            LEFT JOIN projects p ON b.project_id = p.id
            {where_clause}
            ORDER BY brs.average_risk_score DESC NULLS LAST
            LIMIT :limit OFFSET :offset
        """

        rows = db.execute(text(sql), params).fetchall()

        results = []
        for row in rows:
            m = row._mapping
            results.append(BOMRiskSummaryResponse(
                bom_id=str(m["bom_id"]),
                bom_name=m.get("bom_name"),
                project_id=str(m["project_id"]) if m.get("project_id") else None,
                project_name=m.get("project_name"),
                total_line_items=m["total_line_items"],
                low_risk_count=m["low_risk_count"],
                medium_risk_count=m["medium_risk_count"],
                high_risk_count=m["high_risk_count"],
                critical_risk_count=m["critical_risk_count"],
                average_risk_score=float(m["average_risk_score"]),
                weighted_risk_score=float(m["weighted_risk_score"]),
                health_grade=m["health_grade"],
                score_trend=m["score_trend"],
                top_risk_components=m["top_risk_components"] if isinstance(m["top_risk_components"], list) else [],
            ))

        return results

    except Exception as e:
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning("[Risk] Risk tables not yet created - returning empty list")
            return []
        logger.error(f"[Risk] Failed to get BOMs with risk: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get BOMs with risk")


@router.get("/boms/{bom_id}", response_model=BOMRiskSummaryResponse)
async def get_bom_risk_detail(
    bom_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get detailed risk summary for a single BOM.

    Returns risk summary if available, or empty/default values if risk tables
    haven't been created or no risk analysis has been run for this BOM.
    """
    try:
        logger.info(f"[Risk] get_bom_risk_detail: user={auth.user_id} bom={bom_id}")

        db = next(get_dual_database().get_session("supabase"))

        params: Dict[str, Any] = {"bom_id": bom_id}

        org_filter = ""
        if not auth.is_super_admin:
            org_filter = "AND b.organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        # First, check if BOM exists (simple query without risk tables)
        bom_sql = f"""
            SELECT b.id, b.name, b.project_id, b.component_count,
                   p.name as project_name
            FROM boms b
            LEFT JOIN projects p ON b.project_id = p.id
            WHERE b.id = :bom_id {org_filter}
        """
        bom_row = db.execute(text(bom_sql), params).fetchone()

        if not bom_row:
            raise HTTPException(status_code=404, detail=f"BOM {bom_id} not found")

        bom_m = bom_row._mapping

        # Try to get risk summary if table exists
        risk_data = None
        try:
            risk_sql = """
                SELECT total_line_items, low_risk_count, medium_risk_count,
                       high_risk_count, critical_risk_count, average_risk_score,
                       weighted_risk_score, health_grade, score_trend, top_risk_components
                FROM bom_risk_summaries
                WHERE bom_id = :bom_id
            """
            risk_row = db.execute(text(risk_sql), {"bom_id": bom_id}).fetchone()
            if risk_row:
                risk_data = risk_row._mapping
        except Exception as risk_err:
            # Risk table doesn't exist or query failed - use defaults
            error_msg = str(risk_err).lower()
            if "relation" not in error_msg or "does not exist" not in error_msg:
                logger.warning(f"[Risk] Error querying risk summary: {risk_err}")

        # Build response with BOM data + risk data (or defaults)
        return BOMRiskSummaryResponse(
            bom_id=str(bom_m["id"]),
            bom_name=bom_m.get("name"),
            project_id=str(bom_m["project_id"]) if bom_m.get("project_id") else None,
            project_name=bom_m.get("project_name"),
            total_line_items=risk_data["total_line_items"] if risk_data else (bom_m.get("component_count") or 0),
            low_risk_count=risk_data["low_risk_count"] if risk_data else 0,
            medium_risk_count=risk_data["medium_risk_count"] if risk_data else 0,
            high_risk_count=risk_data["high_risk_count"] if risk_data else 0,
            critical_risk_count=risk_data["critical_risk_count"] if risk_data else 0,
            average_risk_score=float(risk_data["average_risk_score"]) if risk_data else 0.0,
            weighted_risk_score=float(risk_data["weighted_risk_score"]) if risk_data else 0.0,
            health_grade=risk_data["health_grade"] if risk_data else "N/A",
            score_trend=risk_data["score_trend"] if risk_data else "stable",
            top_risk_components=risk_data["top_risk_components"] if risk_data and isinstance(risk_data["top_risk_components"], list) else [],
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning("[Risk] Risk tables not yet created - returning empty data")
            # Return empty response for unknown BOM when tables don't exist
            return BOMRiskSummaryResponse(
                bom_id=bom_id,
                total_line_items=0,
                low_risk_count=0,
                medium_risk_count=0,
                high_risk_count=0,
                critical_risk_count=0,
                average_risk_score=0.0,
                weighted_risk_score=0.0,
                health_grade="N/A",
                score_trend="stable",
                top_risk_components=[],
            )
        logger.error(f"[Risk] Failed to get BOM risk detail: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get BOM risk detail")


@router.get("/boms/{bom_id}/line-items", response_model=List[BOMLineItemRiskResponse])
async def get_bom_line_items_with_risk(
    bom_id: str,
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get all line items for a BOM with their contextual risk scores.
    """
    try:
        logger.info(f"[Risk] get_bom_line_items_with_risk: user={auth.user_id} bom={bom_id}")

        db = next(get_dual_database().get_session("supabase"))

        params: Dict[str, Any] = {"bom_id": bom_id, "limit": limit, "offset": offset}
        filters = ["bli.bom_id = :bom_id"]

        if not auth.is_super_admin:
            filters.append("blirs.organization_id = :auth_org_id")
            params["auth_org_id"] = auth.organization_id

        if risk_level:
            filters.append("blirs.risk_level = :risk_level")
            params["risk_level"] = risk_level.lower()

        where_clause = f"WHERE {' AND '.join(filters)}"

        sql = f"""
            SELECT
                bli.id as line_item_id,
                bli.manufacturer_part_number as mpn,
                bli.manufacturer,
                COALESCE(bli.quantity, 1) as quantity,
                COALESCE(blirs.base_risk_score, 0) as base_risk_score,
                COALESCE(blirs.contextual_risk_score, 0) as contextual_risk_score,
                COALESCE(blirs.risk_level, 'low') as risk_level,
                COALESCE(blirs.user_criticality_level, 5) as user_criticality_level,
                COALESCE(blirs.quantity_modifier, 0) as quantity_modifier,
                COALESCE(blirs.lead_time_modifier, 0) as lead_time_modifier,
                COALESCE(blirs.criticality_modifier, 0) as criticality_modifier
            FROM bom_line_items bli
            LEFT JOIN bom_line_item_risk_scores blirs ON bli.id = blirs.bom_line_item_id
            {where_clause}
            ORDER BY blirs.contextual_risk_score DESC NULLS LAST
            LIMIT :limit OFFSET :offset
        """

        rows = db.execute(text(sql), params).fetchall()

        results = []
        for row in rows:
            m = row._mapping
            results.append(BOMLineItemRiskResponse(
                line_item_id=str(m["line_item_id"]),
                mpn=m.get("mpn"),
                manufacturer=m.get("manufacturer"),
                quantity=m["quantity"],
                base_risk_score=m["base_risk_score"],
                contextual_risk_score=m["contextual_risk_score"],
                risk_level=m["risk_level"],
                user_criticality_level=m["user_criticality_level"],
                quantity_modifier=m["quantity_modifier"],
                lead_time_modifier=m["lead_time_modifier"],
                criticality_modifier=m["criticality_modifier"],
            ))

        return results

    except Exception as e:
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning("[Risk] Risk tables not yet created - returning empty list")
            return []
        logger.error(f"[Risk] Failed to get BOM line items with risk: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get BOM line items with risk")


@router.put("/boms/{bom_id}/line-items/{line_item_id}/criticality")
async def update_line_item_criticality(
    bom_id: str,
    line_item_id: str,
    request: UpdateLineItemCriticalityRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Update the user-defined criticality level for a BOM line item.

    This triggers a recalculation of the contextual risk score.
    """
    try:
        logger.info(
            f"[Risk] update_line_item_criticality: user={auth.user_id} "
            f"line_item={line_item_id} criticality={request.criticality_level}"
        )

        db = next(get_dual_database().get_session("supabase"))

        # Update criticality and recalculate modifier
        criticality_modifier = int((request.criticality_level - 1) * 11.1)

        # Get current base risk score to recalculate contextual score
        sql = """
            UPDATE bom_line_item_risk_scores
            SET
                user_criticality_level = :criticality_level,
                criticality_modifier = :criticality_modifier,
                contextual_risk_score = LEAST(100,
                    base_risk_score + ROUND(
                        quantity_modifier * 0.15 +
                        lead_time_modifier * 0.10 +
                        :criticality_modifier * 0.20
                    )::INTEGER
                ),
                updated_at = NOW()
            WHERE bom_line_item_id = :line_item_id
            AND organization_id = :org_id
            RETURNING contextual_risk_score, risk_level
        """

        params = {
            "line_item_id": line_item_id,
            "org_id": auth.organization_id,
            "criticality_level": request.criticality_level,
            "criticality_modifier": criticality_modifier,
        }

        result = db.execute(text(sql), params)
        row = result.fetchone()
        db.commit()

        if not row:
            raise HTTPException(status_code=404, detail=f"Line item {line_item_id} not found")

        logger.info(f"[Risk] Updated criticality: line_item={line_item_id} level={request.criticality_level}")

        return {
            "status": "success",
            "line_item_id": line_item_id,
            "criticality_level": request.criticality_level,
            "new_contextual_score": row._mapping["contextual_risk_score"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Risk] Failed to update criticality: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update criticality")


@router.get("/projects", response_model=List[ProjectRiskSummaryResponse])
async def get_projects_with_risk(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get all projects with their risk summaries.
    """
    try:
        logger.info(f"[Risk] get_projects_with_risk: user={auth.user_id}")

        db = next(get_dual_database().get_session("supabase"))

        params: Dict[str, Any] = {"limit": limit, "offset": offset}

        org_filter = ""
        if not auth.is_super_admin:
            org_filter = "WHERE p.organization_id = :auth_org_id"
            params["auth_org_id"] = auth.organization_id

        # Aggregate directly from bom_risk_summaries (project_risk_summaries may be empty)
        sql = f"""
            WITH project_stats AS (
                SELECT
                    b.project_id,
                    COUNT(brs.id) as total_boms,
                    SUM(CASE WHEN brs.health_grade IN ('A', 'B') THEN 1 ELSE 0 END) as healthy_boms,
                    SUM(CASE WHEN brs.health_grade IN ('C', 'D') THEN 1 ELSE 0 END) as at_risk_boms,
                    SUM(CASE WHEN brs.health_grade = 'F' THEN 1 ELSE 0 END) as critical_boms,
                    COALESCE(SUM(brs.total_line_items), 0) as total_components,
                    COALESCE(AVG(brs.average_risk_score), 0) as average_bom_health_score,
                    COALESCE(SUM(brs.low_risk_count), 0) as low_risk_total,
                    COALESCE(SUM(brs.medium_risk_count), 0) as medium_risk_total,
                    COALESCE(SUM(brs.high_risk_count), 0) as high_risk_total,
                    COALESCE(SUM(brs.critical_risk_count), 0) as critical_risk_total
                FROM bom_risk_summaries brs
                JOIN boms b ON brs.bom_id = b.id
                GROUP BY b.project_id
            )
            SELECT
                p.id as project_id,
                p.name as project_name,
                COALESCE(ps.total_boms, 0) as total_boms,
                COALESCE(ps.healthy_boms, 0) as healthy_boms,
                COALESCE(ps.at_risk_boms, 0) as at_risk_boms,
                COALESCE(ps.critical_boms, 0) as critical_boms,
                COALESCE(ps.total_components, 0) as total_components,
                COALESCE(ps.average_bom_health_score, 0) as average_bom_health_score,
                COALESCE(ps.low_risk_total, 0) as low_risk_total,
                COALESCE(ps.medium_risk_total, 0) as medium_risk_total,
                COALESCE(ps.high_risk_total, 0) as high_risk_total,
                COALESCE(ps.critical_risk_total, 0) as critical_risk_total
            FROM projects p
            LEFT JOIN project_stats ps ON p.id = ps.project_id
            {org_filter}
            ORDER BY ps.average_bom_health_score DESC NULLS LAST
            LIMIT :limit OFFSET :offset
        """

        rows = db.execute(text(sql), params).fetchall()

        results = []
        for row in rows:
            m = row._mapping
            results.append(ProjectRiskSummaryResponse(
                project_id=str(m["project_id"]),
                project_name=m.get("project_name"),
                total_boms=m["total_boms"],
                healthy_boms=m["healthy_boms"],
                at_risk_boms=m["at_risk_boms"],
                critical_boms=m["critical_boms"],
                total_components=m["total_components"],
                average_bom_health_score=float(m["average_bom_health_score"]),
                risk_distribution={
                    "low": m["low_risk_total"],
                    "medium": m["medium_risk_total"],
                    "high": m["high_risk_total"],
                    "critical": m["critical_risk_total"],
                },
            ))

        return results

    except Exception as e:
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning("[Risk] Risk tables not yet created - returning empty list")
            return []
        logger.error(f"[Risk] Failed to get projects with risk: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get projects with risk")


# =============================================================================
# RISK RECALCULATION ENDPOINTS
# =============================================================================

@router.post("/recalculate/bom/{bom_id}")
async def recalculate_bom_risk(
    bom_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger recalculation of risk scores for all line items in a BOM.

    This recalculates contextual risk for each line item and updates
    the BOM risk summary.
    """
    try:
        logger.info(f"[Risk] recalculate_bom_risk: user={auth.user_id} bom={bom_id}")

        from app.services.risk_calculation_service import get_risk_calculation_service

        service = get_risk_calculation_service()
        summary = await service.calculate_bom_risk_summary(bom_id, auth.organization_id)

        if summary.total_line_items == 0:
            return {
                "status": "warning",
                "message": "No line items with risk scores found for this BOM",
                "bom_id": bom_id,
            }

        # Store the summary
        await service.store_bom_risk_summary(summary)

        logger.info(f"[Risk] Recalculated BOM risk: bom={bom_id} grade={summary.health_grade}")

        return {
            "status": "success",
            "bom_id": bom_id,
            "total_line_items": summary.total_line_items,
            "average_risk_score": summary.average_risk_score,
            "health_grade": summary.health_grade,
            "risk_distribution": {
                "low": summary.low_risk_count,
                "medium": summary.medium_risk_count,
                "high": summary.high_risk_count,
                "critical": summary.critical_risk_count,
            },
        }

    except Exception as e:
        logger.error(f"[Risk] Failed to recalculate BOM risk: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to recalculate BOM risk")


# =============================================================================
# RISK CACHE MANAGEMENT ENDPOINTS (Admin)
# =============================================================================

class CacheSyncRequest(BaseModel):
    """Request to trigger cache sync workflow."""
    organization_id: Optional[str] = Field(None, description="Org to sync (None = all orgs, super admin only)")
    batch_size: int = Field(default=500, ge=100, le=2000, description="Records per batch")
    max_batches: int = Field(default=100, ge=1, le=1000, description="Maximum batches to process")


class CacheMaintenanceRequest(BaseModel):
    """Request for cache maintenance."""
    organization_id: Optional[str] = Field(None, description="Org filter")
    refresh_stale: bool = Field(default=False, description="Refresh stale cache entries")


class CacheStatsResponse(BaseModel):
    """Cache statistics response."""
    connected: bool
    cached_risk_scores: int = 0
    pattern: Optional[str] = None
    ttl_seconds: int = 3600
    error: Optional[str] = None


@router.get("/cache/stats", response_model=CacheStatsResponse)
async def get_cache_stats(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get risk cache statistics.

    Returns connection status and count of cached risk scores.
    """
    try:
        logger.info(f"[Risk] get_cache_stats: user={auth.user_id} org={auth.organization_id}")

        from app.cache.risk_cache import get_risk_cache_stats

        # Non-super admins only see their org's stats
        org_filter = None if auth.is_super_admin else auth.organization_id
        stats = get_risk_cache_stats(org_filter)

        return CacheStatsResponse(**stats)

    except Exception as e:
        logger.error(f"[Risk] Failed to get cache stats: {e}", exc_info=True)
        return CacheStatsResponse(connected=False, error=str(e))


@router.post("/cache/invalidate")
async def invalidate_cache(
    organization_id: Optional[str] = Query(None, description="Org to invalidate (None = current org)"),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Invalidate cached risk scores for an organization.

    Non-super admins can only invalidate their own org's cache.
    """
    try:
        # Determine which org to invalidate
        target_org = organization_id if auth.is_super_admin else auth.organization_id

        if not target_org:
            raise HTTPException(status_code=400, detail="Organization ID required")

        logger.info(f"[Risk] invalidate_cache: user={auth.user_id} target_org={target_org}")

        from app.cache.risk_cache import invalidate_org_risk_cache

        deleted_count = invalidate_org_risk_cache(target_org)

        logger.info(f"[Risk] Invalidated {deleted_count} cached scores for org={target_org}")

        return {
            "status": "success",
            "organization_id": target_org,
            "deleted_count": deleted_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Risk] Failed to invalidate cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to invalidate cache")


@router.post("/cache/sync")
async def trigger_cache_sync(
    request: CacheSyncRequest = CacheSyncRequest(),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger a Temporal workflow to sync risk scores from database to Redis cache.

    Use cases:
    - Initial cache population on startup
    - Cache recovery after Redis restart
    - Scheduled cache refresh

    Non-super admins can only sync their own org's cache.
    """
    try:
        from app.config import settings
        from temporalio.client import Client

        # Determine target org
        target_org = request.organization_id if auth.is_super_admin else auth.organization_id

        logger.info(
            f"[Risk] trigger_cache_sync: user={auth.user_id} org={target_org} "
            f"batch_size={request.batch_size} max_batches={request.max_batches}"
        )

        # Connect to Temporal and start workflow
        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )

        from app.workflows.risk_cache_workflow import RiskCacheSyncWorkflow

        # Generate unique workflow ID
        import uuid
        workflow_id = f"risk-cache-sync-{uuid.uuid4().hex[:8]}"

        handle = await client.start_workflow(
            RiskCacheSyncWorkflow.run,
            args=[target_org, request.batch_size, request.max_batches],
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
        )

        logger.info(f"[Risk] Started cache sync workflow: {workflow_id}")

        return {
            "status": "started",
            "workflow_id": workflow_id,
            "organization_id": target_org,
            "batch_size": request.batch_size,
            "max_batches": request.max_batches,
            "message": "Cache sync workflow started. Check Temporal UI for progress.",
        }

    except Exception as e:
        logger.error(f"[Risk] Failed to start cache sync workflow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start cache sync: {str(e)}")


@router.post("/cache/maintenance")
async def trigger_cache_maintenance(
    request: CacheMaintenanceRequest = CacheMaintenanceRequest(),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger a Temporal workflow for cache maintenance.

    Operations:
    - Get cache statistics
    - Optionally refresh stale entries

    Non-super admins can only run maintenance on their own org.
    """
    try:
        from app.config import settings
        from temporalio.client import Client

        # Determine target org
        target_org = request.organization_id if auth.is_super_admin else auth.organization_id

        logger.info(
            f"[Risk] trigger_cache_maintenance: user={auth.user_id} org={target_org} "
            f"refresh_stale={request.refresh_stale}"
        )

        # Connect to Temporal and start workflow
        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )

        from app.workflows.risk_cache_workflow import RiskCacheMaintenanceWorkflow

        # Generate unique workflow ID
        import uuid
        workflow_id = f"risk-cache-maintenance-{uuid.uuid4().hex[:8]}"

        handle = await client.start_workflow(
            RiskCacheMaintenanceWorkflow.run,
            args=[target_org, request.refresh_stale],
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
        )

        logger.info(f"[Risk] Started cache maintenance workflow: {workflow_id}")

        return {
            "status": "started",
            "workflow_id": workflow_id,
            "organization_id": target_org,
            "refresh_stale": request.refresh_stale,
            "message": "Cache maintenance workflow started. Check Temporal UI for progress.",
        }

    except Exception as e:
        logger.error(f"[Risk] Failed to start cache maintenance workflow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start maintenance: {str(e)}")


# =============================================================================
# BOM RISK ANALYSIS WORKFLOW TRIGGER
# =============================================================================

class RunRiskAnalysisRequest(BaseModel):
    """Request to trigger BOM risk analysis workflow"""
    bom_id: Optional[str] = Field(
        default=None,
        description="Specific BOM ID to analyze. If not provided, analyzes all BOMs."
    )
    force_recalculate: bool = Field(
        default=False,
        description="Recalculate even if scores already exist"
    )


class RunRiskAnalysisResponse(BaseModel):
    """Response from risk analysis workflow trigger"""
    status: str
    workflow_id: str
    organization_id: str
    bom_id: Optional[str] = None
    message: str


@router.post("/analyze", response_model=RunRiskAnalysisResponse)
async def run_risk_analysis(
    request: RunRiskAnalysisRequest = None,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger BOM risk analysis workflow.

    This endpoint starts a Temporal workflow that:
    1. Finds all enriched BOMs (or specific BOM if bom_id provided)
    2. Calculates base risk scores for each component
    3. Calculates contextual risk based on quantity and criticality
    4. Generates BOM health grades (A-F)
    5. Updates portfolio risk summaries

    The workflow runs asynchronously. Check Temporal UI for progress,
    or poll the /api/risk/portfolio endpoint for updated data.

    **Authorization**: Requires authenticated user with organization context.
    """
    if request is None:
        request = RunRiskAnalysisRequest()

    logger.info(
        f"[Risk] run_risk_analysis: user={auth.user_id} org={auth.organization_id} "
        f"bom_id={request.bom_id or 'ALL'} force={request.force_recalculate}"
    )

    if not auth.organization_id:
        raise HTTPException(
            status_code=400,
            detail="Organization context required. Please select an organization."
        )

    try:
        from temporalio.client import Client
        from app.workflows.bom_risk_workflow import BOMRiskAnalysisWorkflow, BOMRiskRequest
        from app.config import settings
        import uuid

        # Build workflow request
        risk_request = BOMRiskRequest(
            organization_id=auth.organization_id,
            bom_id=request.bom_id,
            force_recalculate=request.force_recalculate,
            user_id=auth.user_id
        )

        # Connect to Temporal
        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )

        # Generate unique workflow ID
        suffix = request.bom_id[:8] if request.bom_id else uuid.uuid4().hex[:8]
        workflow_id = f"bom-risk-{auth.organization_id[:8]}-{suffix}"

        # Start the workflow
        handle = await client.start_workflow(
            BOMRiskAnalysisWorkflow.run,
            risk_request,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
        )

        logger.info(f"[Risk] ✅ Started BOM risk analysis workflow: {workflow_id}")

        return RunRiskAnalysisResponse(
            status="started",
            workflow_id=workflow_id,
            organization_id=auth.organization_id,
            bom_id=request.bom_id,
            message=f"Risk analysis workflow started. "
                    f"{'Processing specific BOM' if request.bom_id else 'Processing all BOMs'}. "
                    f"Refresh the Risk Dashboard to see results."
        )

    except Exception as e:
        logger.error(f"[Risk] ❌ Failed to start risk analysis workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start risk analysis: {str(e)}"
        )


@router.get("/analyze/{workflow_id}/status")
async def get_risk_analysis_status(
    workflow_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get status of a risk analysis workflow.

    Returns workflow execution status and results if completed.
    """
    logger.info(f"[Risk] get_risk_analysis_status: workflow={workflow_id} user={auth.user_id}")

    try:
        from temporalio.client import Client, WorkflowExecutionStatus
        from app.config import settings
        import asyncio

        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )

        handle = client.get_workflow_handle(workflow_id)
        description = await handle.describe()

        status_map = {
            WorkflowExecutionStatus.RUNNING: "running",
            WorkflowExecutionStatus.COMPLETED: "completed",
            WorkflowExecutionStatus.FAILED: "failed",
            WorkflowExecutionStatus.CANCELLED: "cancelled",
            WorkflowExecutionStatus.TERMINATED: "terminated",
            WorkflowExecutionStatus.CONTINUED_AS_NEW: "continued",
            WorkflowExecutionStatus.TIMED_OUT: "timed_out",
        }

        status = status_map.get(description.status, "unknown")

        result = None
        if description.status == WorkflowExecutionStatus.COMPLETED:
            try:
                result = await asyncio.wait_for(handle.result(), timeout=5.0)
            except asyncio.TimeoutError:
                pass
            except Exception as e:
                logger.warning(f"[Risk] Failed to get workflow result: {e}")

        return {
            "workflow_id": workflow_id,
            "status": status,
            "temporal_status": description.status.name,
            "result": result
        }

    except Exception as e:
        logger.error(f"[Risk] Failed to get workflow status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DASHBOARD RISK SUMMARY ENDPOINT (for Customer Portal)
# =============================================================================

class RiskCategorySummary(BaseModel):
    """Risk breakdown by severity for a category"""
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0


class RiskSummaryResponse(BaseModel):
    """Risk summary for dashboard display"""
    lifecycle: RiskCategorySummary = Field(default_factory=RiskCategorySummary)
    supplyChain: RiskCategorySummary = Field(default_factory=RiskCategorySummary)
    compliance: RiskCategorySummary = Field(default_factory=RiskCategorySummary)


@router.get("/summary", response_model=RiskSummaryResponse)
def get_risk_summary(
    organization_id: Optional[str] = Query(None, description="Filter by organization ID"),
    workspace_id: Optional[str] = Query(None, description="Filter by workspace ID"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Get risk summary for the customer portal dashboard.

    Returns aggregated risk counts by category (lifecycle, supply chain, compliance)
    and severity level (high, medium, low).

    This provides a quick overview for the RiskAlertsTab dashboard component.

    Args:
        organization_id: Filter by organization (tenant)
        workspace_id: Filter by workspace
        auth: Authentication context

    Returns:
        RiskSummaryResponse with counts by category and severity
    """
    org_id = organization_id or auth.organization_id
    logger.info(f"[Risk API] Get risk summary - org: {org_id}, workspace: {workspace_id}")

    # Try cache first
    if org_id:
        cached = _get_cached_portfolio(org_id)
        if cached and "summary" in cached:
            logger.info(f"[Risk API] Returning cached risk summary for org: {org_id}")
            summary_data = cached.get("summary", {})
            return RiskSummaryResponse(
                lifecycle=RiskCategorySummary(**summary_data.get("lifecycle", {})),
                supplyChain=RiskCategorySummary(**summary_data.get("supplyChain", {})),
                compliance=RiskCategorySummary(**summary_data.get("compliance", {})),
            )

    # Get database connection
    dual_db = get_dual_database()
    supabase_db = None

    try:
        supabase_db = next(dual_db.get_session("supabase"))

        # Build where clause for tenant filtering
        where_clauses = ["1=1"]
        params: Dict[str, Any] = {}

        if org_id:
            where_clauses.append("b.organization_id = :org_id")
            params["org_id"] = org_id

        if workspace_id:
            where_clauses.append("b.workspace_id = :workspace_id")
            params["workspace_id"] = workspace_id

        where_sql = " AND ".join(where_clauses)

        # Query BOM line items for risk data
        # We'll compute risk summary from bom_line_items and their component data
        summary_sql = f"""
            SELECT
                -- Lifecycle risk based on lifecycle_status
                COUNT(CASE WHEN LOWER(COALESCE(bli.lifecycle_status, '')) IN ('obsolete', 'eol', 'discontinued', 'end_of_life') THEN 1 END) as lifecycle_high,
                COUNT(CASE WHEN LOWER(COALESCE(bli.lifecycle_status, '')) IN ('nrnd', 'not_recommended', 'limited', 'last_time_buy') THEN 1 END) as lifecycle_medium,
                COUNT(CASE WHEN LOWER(COALESCE(bli.lifecycle_status, '')) IN ('active', 'production', 'available', 'in_production', '') THEN 1 END) as lifecycle_low,
                COUNT(DISTINCT bli.id) as lifecycle_total,

                -- Supply chain risk based on risk_level column
                COUNT(CASE WHEN LOWER(COALESCE(bli.risk_level, '')) IN ('high', 'critical') THEN 1 END) as supply_high,
                COUNT(CASE WHEN LOWER(COALESCE(bli.risk_level, '')) = 'medium' THEN 1 END) as supply_medium,
                COUNT(CASE WHEN LOWER(COALESCE(bli.risk_level, '')) IN ('low', '') OR bli.risk_level IS NULL THEN 1 END) as supply_low,
                COUNT(DISTINCT bli.id) as supply_total,

                -- Compliance risk based on compliance_status JSONB (structure: {"rohs": bool, "reach": bool})
                -- High risk: explicitly false for any compliance field
                COUNT(CASE WHEN (bli.compliance_status->>'rohs')::boolean = false OR (bli.compliance_status->>'reach')::boolean = false THEN 1 END) as compliance_high,
                -- Medium risk: null/missing compliance data
                COUNT(CASE WHEN bli.compliance_status IS NULL OR bli.compliance_status = '{{}}'::jsonb OR (bli.compliance_status->>'rohs' IS NULL AND bli.compliance_status->>'reach' IS NULL) THEN 1 END) as compliance_medium,
                -- Low risk: compliant (both rohs and reach are true, or at least one is true with none false)
                COUNT(CASE WHEN ((bli.compliance_status->>'rohs')::boolean = true OR (bli.compliance_status->>'reach')::boolean = true) AND NOT ((bli.compliance_status->>'rohs')::boolean = false OR (bli.compliance_status->>'reach')::boolean = false) THEN 1 END) as compliance_low,
                COUNT(DISTINCT bli.id) as compliance_total
            FROM bom_line_items bli
            JOIN boms b ON bli.bom_id = b.id
            WHERE {where_sql}
        """

        result = supabase_db.execute(text(summary_sql), params).fetchone()

        if result:
            row = dict(result._mapping)

            summary = RiskSummaryResponse(
                lifecycle=RiskCategorySummary(
                    high=row.get("lifecycle_high", 0) or 0,
                    medium=row.get("lifecycle_medium", 0) or 0,
                    low=row.get("lifecycle_low", 0) or 0,
                    total=row.get("lifecycle_total", 0) or 0,
                ),
                supplyChain=RiskCategorySummary(
                    high=row.get("supply_high", 0) or 0,
                    medium=row.get("supply_medium", 0) or 0,
                    low=row.get("supply_low", 0) or 0,
                    total=row.get("supply_total", 0) or 0,
                ),
                compliance=RiskCategorySummary(
                    high=row.get("compliance_high", 0) or 0,
                    medium=row.get("compliance_medium", 0) or 0,
                    low=row.get("compliance_low", 0) or 0,
                    total=row.get("compliance_total", 0) or 0,
                ),
            )

            # Cache the result
            if org_id:
                _set_portfolio_cache(org_id, {
                    "summary": {
                        "lifecycle": summary.lifecycle.model_dump(),
                        "supplyChain": summary.supplyChain.model_dump(),
                        "compliance": summary.compliance.model_dump(),
                    }
                })

            logger.info(f"[Risk API] Risk summary computed: lifecycle={summary.lifecycle.total}, supply={summary.supplyChain.total}, compliance={summary.compliance.total}")
            return summary

        # No data found - return empty summary
        return RiskSummaryResponse()

    except Exception as e:
        error_msg = str(e).lower()
        # Handle missing tables gracefully - return empty summary
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning(f"[Risk API] Required tables not yet configured - returning empty summary")
            return RiskSummaryResponse()
        logger.error(f"[Risk API] Error getting risk summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting risk summary: {str(e)}")
    finally:
        if supabase_db:
            supabase_db.close()
