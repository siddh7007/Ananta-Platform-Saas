"""
CNS Enrichment Activities for Temporal

Integrates the modular CNS enrichment service into Temporal workflows.
Loads configuration from Directus and respects UI toggles for AI/web scraping.
"""

import os
import logging
import json
from dataclasses import dataclass
from typing import Dict, List, Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from temporalio import activity

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class EnrichmentConfigData:
    """Enrichment configuration loaded from Directus"""
    config_id: int
    enable_suppliers: bool
    preferred_suppliers: List[str]
    enable_ai: bool
    ai_provider: Optional[str]
    ai_operations: List[str]
    enable_web_scraping: bool
    quality_reject_threshold: int
    quality_staging_threshold: int
    quality_auto_approve_threshold: int
    ai_cost_limit_monthly: Optional[float]
    ai_cost_current_month: float


@dataclass
class ComponentEnrichmentResult:
    """Result of enriching a single component"""
    mpn: str
    success: bool
    quality_score: float
    routing_destination: str  # "production", "staging", "rejected"
    tier_catalog_used: bool
    tier_suppliers_used: bool
    tier_ai_used: bool
    tier_web_scraping_used: bool
    ai_cost: float
    processing_time_ms: float
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class BOMEnrichmentStats:
    """Statistics for BOM enrichment"""
    total_items: int
    success_count: int
    failed_count: int
    catalog_hits: int
    supplier_hits: int
    ai_enhanced: int
    web_scraped: int
    routed_production: int
    routed_staging: int
    routed_rejected: int
    total_ai_cost: float
    avg_processing_time_ms: float


# ============================================================================
# Database Helpers
# ============================================================================

def get_components_db():
    """Get Components V2 database connection"""
    return psycopg2.connect(
        host=os.getenv('COMPONENTS_DB_HOST', 'components-v2-postgres'),
        port=os.getenv('COMPONENTS_DB_PORT', '5432'),
        database=os.getenv('COMPONENTS_DB_NAME', 'components_v2'),
        user=os.getenv('COMPONENTS_DB_USER', 'postgres'),
        password=os.getenv('COMPONENTS_DB_PASSWORD', 'postgres'),
        cursor_factory=RealDictCursor
    )


def get_supabase_db():
    """Get Supabase database connection"""
    return psycopg2.connect(
        host=os.getenv('SUPABASE_DB_HOST', 'components-v2-supabase-db'),
        port=os.getenv('SUPABASE_DB_PORT', '5432'),
        database=os.getenv('SUPABASE_DB_NAME', 'supabase'),
        user=os.getenv('SUPABASE_DB_USER', 'postgres'),
        password=os.getenv('SUPABASE_DB_PASSWORD', 'supabase-postgres-secure-2024'),
        cursor_factory=RealDictCursor
    )


# ============================================================================
# ACTIVITY 1: Load Enrichment Configuration
# ============================================================================

@activity.defn
async def load_enrichment_config(
    organization_id: Optional[str] = None
) -> EnrichmentConfigData:
    """
    Load active enrichment configuration from Directus

    Checks for tenant-specific configuration first, falls back to global config.
    """
    activity.logger.info(f"Loading enrichment config for tenant: {tenant_id or 'global'}")

    with get_components_db() as conn:
        with conn.cursor() as cur:
            # Use the database function to get active config
            cur.execute("""
                SELECT * FROM get_active_cns_config(%s)
            """, (tenant_id,))

            config = cur.fetchone()

            if not config:
                # Fallback to default global config
                activity.logger.warning("No config found, using safe defaults")
                return EnrichmentConfigData(
                    config_id=0,
                    enable_suppliers=True,
                    preferred_suppliers=["mouser", "digikey", "element14"],
                    enable_ai=False,  # AI OFF by default
                    ai_provider=None,
                    ai_operations=[],
                    enable_web_scraping=False,  # Web scraping OFF by default
                    quality_reject_threshold=70,
                    quality_staging_threshold=94,
                    quality_auto_approve_threshold=95,
                    ai_cost_limit_monthly=None,
                    ai_cost_current_month=0.0
                )

            # Check AI budget limit
            ai_enabled = config['enable_ai']
            if ai_enabled and config['ai_cost_limit_monthly']:
                if config['ai_cost_current_month'] >= config['ai_cost_limit_monthly']:
                    activity.logger.warning(
                        f"AI budget limit reached: "
                        f"${config['ai_cost_current_month']:.2f} / ${config['ai_cost_limit_monthly']:.2f}"
                    )
                    ai_enabled = False  # Disable AI if budget exceeded

            return EnrichmentConfigData(
                config_id=config['id'],
                enable_suppliers=config['enable_suppliers'],
                preferred_suppliers=config.get('preferred_suppliers') or [],
                enable_ai=ai_enabled,
                ai_provider=config.get('ai_provider'),
                ai_operations=config.get('ai_operations') or [],
                enable_web_scraping=config['enable_web_scraping'],
                quality_reject_threshold=config['quality_reject_threshold'],
                quality_staging_threshold=config['quality_staging_threshold'],
                quality_auto_approve_threshold=config['quality_auto_approve_threshold'],
                ai_cost_limit_monthly=config.get('ai_cost_limit_monthly'),
                ai_cost_current_month=config['ai_cost_current_month']
            )


# ============================================================================
# ACTIVITY 2: Enrich Components with Modular Service
# ============================================================================

@activity.defn
async def enrich_components_modular(
    bom_items: List[Dict[str, Any]],
    config: EnrichmentConfigData,
    organization_id: Optional[str] = None
) -> List[ComponentEnrichmentResult]:
    """
    Enrich components using the modular enrichment service

    Respects UI configuration for AI and web scraping.
    Tracks costs and tier usage.
    """
    activity.logger.info(
        f"Enriching {len(bom_items)} components "
        f"(AI: {config.enable_ai}, Scraping: {config.enable_web_scraping})"
    )

    results = []

    # TODO: Import and use ModularEnrichmentService
    # For now, simulate enrichment with configuration awareness

    for item in bom_items:
        mpn = item.get('mpn')
        manufacturer = item.get('manufacturer')

        if not mpn:
            results.append(ComponentEnrichmentResult(
                mpn="",
                success=False,
                quality_score=0.0,
                routing_destination="rejected",
                tier_catalog_used=False,
                tier_suppliers_used=False,
                tier_ai_used=False,
                tier_web_scraping_used=False,
                ai_cost=0.0,
                processing_time_ms=0.0,
                error="Missing MPN"
            ))
            continue

        # Simulate enrichment result
        # TODO: Replace with actual ModularEnrichmentService.enrich_component()
        result = ComponentEnrichmentResult(
            mpn=mpn,
            success=True,
            quality_score=85.0,  # Example
            routing_destination="staging",  # Example
            tier_catalog_used=True,
            tier_suppliers_used=config.enable_suppliers,
            tier_ai_used=config.enable_ai,
            tier_web_scraping_used=config.enable_web_scraping,
            ai_cost=0.015 if config.enable_ai else 0.0,
            processing_time_ms=250.0,
            data={
                'mpn': mpn,
                'manufacturer': manufacturer,
                'enriched': True,
                'ai_enhanced': config.enable_ai,
                'web_scraped': config.enable_web_scraping
            }
        )

        results.append(result)

    activity.logger.info(f"Enrichment complete: {len(results)} results")
    return results


# ============================================================================
# ACTIVITY 3: Track AI Costs
# ============================================================================

@activity.defn
async def track_ai_costs(
    enrichment_results: List[ComponentEnrichmentResult],
    config_id: int
) -> Dict[str, float]:
    """
    Track AI costs and update monthly budget

    Updates cns_enrichment_config with cumulative costs.
    Writes audit records to cns_enrichment_audit.
    """
    total_ai_cost = sum(r.ai_cost for r in enrichment_results)
    ai_requests = sum(1 for r in enrichment_results if r.tier_ai_used)

    if total_ai_cost == 0:
        activity.logger.info("No AI costs to track")
        return {"total_ai_cost": 0.0, "ai_requests": 0}

    activity.logger.info(
        f"Tracking AI costs: ${total_ai_cost:.4f} "
        f"({ai_requests} requests)"
    )

    with get_components_db() as conn:
        with conn.cursor() as cur:
            # Update cumulative costs
            cur.execute("""
                UPDATE cns_enrichment_config
                SET
                    ai_cost_current_month = ai_cost_current_month + %s,
                    ai_requests_current_month = ai_requests_current_month + %s
                WHERE id = %s
            """, (total_ai_cost, ai_requests, config_id))

            # Write audit records
            for result in enrichment_results:
                if result.tier_ai_used:
                    cur.execute("""
                        INSERT INTO cns_enrichment_audit (
                            tenant_id,
                            config_id,
                            mpn,
                            manufacturer,
                            success,
                            quality_score,
                            routing_destination,
                            tier_catalog_used,
                            tier_suppliers_used,
                            tier_ai_used,
                            tier_web_scraping_used,
                            ai_cost_usd,
                            processing_time_ms
                        ) VALUES (
                            NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        config_id,
                        result.mpn,
                        result.data.get('manufacturer') if result.data else None,
                        result.success,
                        result.quality_score,
                        result.routing_destination,
                        result.tier_catalog_used,
                        result.tier_suppliers_used,
                        result.tier_ai_used,
                        result.tier_web_scraping_used,
                        result.ai_cost,
                        result.processing_time_ms
                    ))

            conn.commit()

    return {
        "total_ai_cost": total_ai_cost,
        "ai_requests": ai_requests
    }


# ============================================================================
# ACTIVITY 4: Calculate Enrichment Statistics
# ============================================================================

@activity.defn
async def calculate_enrichment_stats(
    enrichment_results: List[ComponentEnrichmentResult]
) -> BOMEnrichmentStats:
    """
    Calculate statistics for enrichment results
    """
    total = len(enrichment_results)
    success = sum(1 for r in enrichment_results if r.success)
    failed = total - success

    catalog_hits = sum(1 for r in enrichment_results if r.tier_catalog_used)
    supplier_hits = sum(1 for r in enrichment_results if r.tier_suppliers_used)
    ai_enhanced = sum(1 for r in enrichment_results if r.tier_ai_used)
    web_scraped = sum(1 for r in enrichment_results if r.tier_web_scraping_used)

    routed_production = sum(
        1 for r in enrichment_results
        if r.routing_destination == "production"
    )
    routed_staging = sum(
        1 for r in enrichment_results
        if r.routing_destination == "staging"
    )
    routed_rejected = sum(
        1 for r in enrichment_results
        if r.routing_destination == "rejected"
    )

    total_ai_cost = sum(r.ai_cost for r in enrichment_results)
    avg_processing_time = (
        sum(r.processing_time_ms for r in enrichment_results) / total
        if total > 0 else 0.0
    )

    return BOMEnrichmentStats(
        total_items=total,
        success_count=success,
        failed_count=failed,
        catalog_hits=catalog_hits,
        supplier_hits=supplier_hits,
        ai_enhanced=ai_enhanced,
        web_scraped=web_scraped,
        routed_production=routed_production,
        routed_staging=routed_staging,
        routed_rejected=routed_rejected,
        total_ai_cost=total_ai_cost,
        avg_processing_time_ms=avg_processing_time
    )


# ============================================================================
# ACTIVITY 5: Check AI Budget Remaining
# ============================================================================

@activity.defn
async def check_ai_budget_remaining(config_id: int) -> Dict[str, Any]:
    """
    Check if AI budget is available

    Returns budget status and whether AI should be disabled.
    """
    with get_components_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    ai_cost_limit_monthly,
                    ai_cost_current_month,
                    ai_requests_current_month
                FROM cns_enrichment_config
                WHERE id = %s
            """, (config_id,))

            config = cur.fetchone()

            if not config or not config['ai_cost_limit_monthly']:
                return {
                    "has_limit": False,
                    "budget_ok": True,
                    "remaining_budget": None,
                    "usage_percentage": 0.0
                }

            limit = float(config['ai_cost_limit_monthly'])
            current = float(config['ai_cost_current_month'])
            remaining = limit - current
            usage_pct = (current / limit * 100) if limit > 0 else 0.0

            budget_ok = current < limit

            activity.logger.info(
                f"AI budget: ${current:.2f} / ${limit:.2f} "
                f"({usage_pct:.1f}% used, ${remaining:.2f} remaining)"
            )

            return {
                "has_limit": True,
                "budget_ok": budget_ok,
                "limit": limit,
                "current": current,
                "remaining_budget": remaining,
                "usage_percentage": usage_pct,
                "requests_count": config['ai_requests_current_month']
            }
