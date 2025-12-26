"""
Catalog API Endpoints

Provides search and retrieval of production-ready components.

Risk Enrichment:
    Search results can optionally include risk scores from the Redis cache.
    Use include_risk=true and provide organization_id header to enrich results.
    Risk data is fetched from Redis cache (populated by risk.calculated events).
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.models.base import get_db
from app.models.dual_database import get_dual_database
from app.repositories.catalog_repository import CatalogRepository

# Auth context for optional risk enrichment
try:
    from app.core.authorization import AuthContext, get_optional_auth_context
    AUTH_AVAILABLE = True
except ImportError:
    AUTH_AVAILABLE = False
    AuthContext = None  # type: ignore
    get_optional_auth_context = lambda: None  # type: ignore

# Import risk cache for optional enrichment
try:
    from app.cache.risk_cache import get_cached_risks_batch, CachedRiskScore
    RISK_CACHE_AVAILABLE = True
except ImportError:
    RISK_CACHE_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Dashboard-Specific Models (matches ComponentSearch.tsx interface)
# ============================================================================

class RiskInfo(BaseModel):
    """Risk score summary for catalog enrichment"""
    total_risk_score: int = 0
    risk_level: str = "unknown"  # low, medium, high, critical, unknown
    lifecycle_risk: Optional[int] = None
    supply_chain_risk: Optional[int] = None
    compliance_risk: Optional[int] = None
    cached: bool = False  # True if from cache


class DashboardSearchResult(BaseModel):
    """Search result format expected by CNS Dashboard ComponentSearch"""
    mpn: str
    manufacturer: str
    category: str
    description: str
    quality_score: float
    enrichment_status: str  # 'production', 'staging', 'rejected', 'pending'
    data_sources: List[str]
    last_updated: str
    # Optional risk enrichment (only populated when include_risk=true)
    risk: Optional[RiskInfo] = None
    component_id: Optional[str] = None  # For risk lookup


class DashboardSearchResponse(BaseModel):
    """Dashboard search response wrapper"""
    results: List[DashboardSearchResult]
    total: int
    risk_enriched: bool = False  # True if results include risk data


# ============================================================================
# Legacy Pydantic Models (for admin API)
# ============================================================================
class CatalogComponent(BaseModel):
    """Catalog component response model"""
    id: str  # UUID string from component_catalog table
    mpn: str
    manufacturer: Optional[str]  # Changed from manufacturer_id - matches DB
    category: Optional[str]  # Changed from category_id - matches DB
    description: Optional[str]
    datasheet_url: Optional[str]
    image_url: Optional[str]
    lifecycle: Optional[str]
    rohs: Optional[str]
    reach: Optional[str]
    specifications: dict
    parameters: Optional[dict] = None  # Technical parameters separate from specifications
    pricing: list
    quality_score: float
    enrichment_source: Optional[str]
    last_enriched_at: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    # Stock and pricing fields
    stock_status: Optional[str] = None
    stock_quantity: Optional[int] = None  # Integer quantity available
    lead_time_days: Optional[int] = None
    unit_price: Optional[float] = None
    currency: Optional[str] = None
    moq: Optional[int] = None  # Minimum Order Quantity
    # Compliance fields
    aec_qualified: Optional[bool] = None  # Automotive qualification
    halogen_free: Optional[bool] = None  # Halogen-free compliance


class CatalogSearchResponse(BaseModel):
    """Search response with results and metadata"""
    total: int
    results: List[CatalogComponent]
    query: str
    filters: dict


class CatalogStats(BaseModel):
    """Catalog statistics"""
    total_components: int
    by_lifecycle: dict
    by_quality_range: dict
    by_source: dict
    average_quality: float


@router.get("/search", response_model=DashboardSearchResponse)
def search_catalog(
    query: str = Query(..., description="Search query (MPN, manufacturer, category, or description)", min_length=2),
    search_type: Optional[str] = Query("mpn", description="Search type: mpn, manufacturer, category, description"),
    include_risk: bool = Query(False, description="Include risk scores from cache"),
    limit: int = Query(50, description="Maximum results", ge=1, le=500),
    db: Session = Depends(get_db),
    # Optional auth context for risk enrichment (not required for basic search)
    auth: Optional["AuthContext"] = Depends(get_optional_auth_context),
):
    """
    Search catalog - Dashboard-compatible endpoint

    Matches CNS Dashboard ComponentSearch.tsx interface expectations.

    Risk Enrichment:
        Set include_risk=true to enrich results with risk scores from Redis cache.
        Requires authentication via Auth0 JWT to determine organization scope.
        Risk data is populated by risk.calculated events from RiskCalculatorService.

    Args:
        query: Search query string
        search_type: Type of search (mpn, manufacturer, category, description)
        include_risk: Include risk scores in results (requires authentication)
        limit: Maximum results

    Returns:
        DashboardSearchResponse with results array (optionally risk-enriched)

    Example:
        # Basic search (no auth required)
        curl "http://localhost:27800/api/catalog/search?query=STM32&search_type=mpn&limit=50"

        # With risk enrichment (requires Auth0 JWT)
        curl -H "Authorization: Bearer <token>" \
             "http://localhost:27800/api/catalog/search?query=STM32&include_risk=true"
    """
    # Extract organization_id from auth context (if authenticated)
    organization_id = auth.organization_id if auth else None

    logger.info(f"[Catalog API] 🔍 Dashboard search - query='{query}', type={search_type}, limit={limit}, include_risk={include_risk}, org={organization_id}")

    # Build search query for component_catalog table
    search_filter = f"%{query}%"

    if search_type == "mpn":
        where_clause = "manufacturer_part_number ILIKE :search_filter"
    elif search_type == "manufacturer":
        where_clause = "manufacturer ILIKE :search_filter"
    elif search_type == "category":
        where_clause = "category ILIKE :search_filter"
    else:  # description
        where_clause = "description ILIKE :search_filter"

    logger.debug(f"[Catalog API] 📊 Search WHERE clause: {where_clause}")

    # Include ID for risk enrichment
    query_sql = text(f"""
        SELECT
            id,
            manufacturer_part_number as mpn,
            manufacturer,
            category,
            description,
            quality_score,
            enrichment_source,
            datasheet_url,
            created_at,
            updated_at
        FROM component_catalog
        WHERE {where_clause}
        ORDER BY quality_score DESC NULLS LAST
        LIMIT :limit
    """)

    # Execute query
    try:
        components = db.execute(query_sql, {"search_filter": search_filter, "limit": limit}).fetchall()
        logger.debug(f"[Catalog API] 📊 SQL query executed, fetched {len(components)} rows")
    except Exception as e:
        logger.error(f"[Catalog API] ❌ SQL query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search query failed: {str(e)}")

    # Fetch risk scores from cache if requested
    risk_data: Dict[str, CachedRiskScore] = {}
    risk_enriched = False

    if include_risk and organization_id and RISK_CACHE_AVAILABLE:
        component_ids = [str(c._mapping.get("id")) for c in components if c._mapping.get("id")]
        if component_ids:
            logger.debug(f"[Catalog API] 🎯 Fetching risk scores for {len(component_ids)} components")
            risk_data = get_cached_risks_batch(organization_id, component_ids)
            cached_count = sum(1 for v in risk_data.values() if v is not None)
            logger.debug(f"[Catalog API] ✅ Found {cached_count}/{len(component_ids)} cached risk scores")
            risk_enriched = True
    elif include_risk and not organization_id:
        logger.warning("[Catalog API] ⚠️ include_risk=true but user not authenticated or no organization_id in token")
    elif include_risk and not RISK_CACHE_AVAILABLE:
        logger.warning("[Catalog API] ⚠️ include_risk=true but risk cache module not available")

    # Convert to dashboard format
    results = []
    for c in components:
        row = dict(c._mapping)
        component_id = str(row.get("id")) if row.get("id") else None

        # Determine enrichment_status based on quality_score and datasheet presence
        quality = row.get("quality_score") or 0
        if quality >= 95 and row.get("datasheet_url"):
            enrichment_status = "production"
        elif quality >= 70:
            enrichment_status = "staging"
        elif row.get("datasheet_url"):
            enrichment_status = "staging"
        else:
            enrichment_status = "pending"

        # Build risk info if available
        risk_info = None
        if risk_enriched and component_id and component_id in risk_data:
            cached_risk = risk_data.get(component_id)
            if cached_risk:
                risk_info = RiskInfo(
                    total_risk_score=cached_risk.total_risk_score,
                    risk_level=cached_risk.risk_level,
                    lifecycle_risk=cached_risk.lifecycle_risk,
                    supply_chain_risk=cached_risk.supply_chain_risk,
                    compliance_risk=cached_risk.compliance_risk,
                    cached=True,
                )

        results.append(DashboardSearchResult(
            mpn=row.get("mpn") or "",
            manufacturer=row.get("manufacturer") or "Unknown",
            category=row.get("category") or "Uncategorized",
            description=row.get("description") or "",
            quality_score=float(quality),
            enrichment_status=enrichment_status,
            data_sources=[row.get("enrichment_source")] if row.get("enrichment_source") else ["catalog_db"],
            last_updated=row["updated_at"].isoformat() if row.get("updated_at") else row["created_at"].isoformat(),
            risk=risk_info,
            component_id=component_id,
        ))

    logger.info(f"[Catalog API] ✅ Dashboard search complete - found {len(results)} results (risk_enriched={risk_enriched})")

    return DashboardSearchResponse(
        results=results,
        total=len(results),
        risk_enriched=risk_enriched,
    )


@router.get("/component/{mpn}", response_model=CatalogComponent)
def get_component_by_mpn(
    mpn: str,
    db: Session = Depends(get_db)
):
    """
    Get component by MPN

    Args:
        mpn: Manufacturer Part Number

    Returns:
        Component details

    Example:
        ```bash
        curl "http://localhost:8003/api/catalog/component/STM32F407VGT6"
        ```
    """
    catalog_repo = CatalogRepository(db)
    component = catalog_repo.get_by_mpn(mpn)

    if not component:
        raise HTTPException(status_code=404, detail=f"Component not found: {mpn}")

    return CatalogComponent(
        id=component.id,
        mpn=component.mpn,
        manufacturer=component.manufacturer,  # Fixed: use string field
        category=component.category,  # Fixed: use string field
        description=component.description,
        datasheet_url=component.datasheet_url,
        image_url=component.image_url,
        lifecycle=component.lifecycle,
        rohs=component.rohs,
        reach=component.reach,
        specifications=component.specifications or {},
        pricing=component.pricing or [],
        quality_score=float(component.quality_score),
        enrichment_source=component.enrichment_source,
        last_enriched_at=component.last_enriched_at.isoformat() if component.last_enriched_at else None,
        created_at=component.created_at.isoformat() if component.created_at else None,
        updated_at=component.updated_at.isoformat() if component.updated_at else None
    )


@router.get("/component/id/{component_id}", response_model=CatalogComponent)
def get_component_by_id(
    component_id: str
):
    """
    Get component by ID from component_catalog table

    Args:
        component_id: Component database ID (UUID string)

    Returns:
        Component details from central component catalog

    Example:
        ```bash
        curl "http://localhost:8003/api/catalog/component/id/407df141-f5fa-45dd-8a79-d33c2e3b9472"
        ```
    """
    logger.info(f"[Catalog API] 🔍 Fetching component by ID: {component_id}")

    # Get components_v2 database session
    dual_db = get_dual_database()
    try:
        components_db = next(dual_db.get_session("components"))
        logger.debug(f"[Catalog API] ✅ Database session acquired for component {component_id}")
    except Exception as e:
        logger.error(f"[Catalog API] ❌ Failed to get components database session: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

    try:
        logger.debug(f"[Catalog API] 📊 Executing SQL query for component {component_id}")
        # Query component_catalog table (UUID primary key)
        query = text("""
            SELECT
                id,
                manufacturer_part_number as mpn,
                manufacturer,
                category,
                description,
                datasheet_url,
                image_url,
                lifecycle_status as lifecycle,
                CASE
                    WHEN rohs_compliant = true THEN 'Compliant'
                    WHEN rohs_compliant = false THEN 'Non-Compliant'
                    ELSE 'Unknown'
                END as rohs,
                CASE
                    WHEN reach_compliant = true THEN 'Compliant'
                    WHEN reach_compliant = false THEN 'Non-Compliant'
                    ELSE 'Unknown'
                END as reach,
                aec_qualified,
                halogen_free,
                specifications,
                parameters,
                price_breaks,
                supplier_data,
                quality_score,
                enrichment_source,
                last_enriched_at,
                created_at,
                updated_at,
                stock_status,
                stock_quantity,
                lead_time_days,
                unit_price,
                currency,
                moq
            FROM component_catalog
            WHERE id = :component_id
            LIMIT 1
        """)

        result = components_db.execute(query, {"component_id": component_id}).fetchone()

        if not result:
            logger.warning(f"[Catalog API] ⚠️ Component not found: {component_id}")
            raise HTTPException(status_code=404, detail=f"Component not found: ID {component_id}")

        # Convert to dict
        row = dict(result._mapping)
        logger.info(f"[Catalog API] ✅ Found component: {row.get('mpn')} (Manufacturer: {row.get('manufacturer')}, Quality: {row.get('quality_score')})")

        # Use dedicated price_breaks column if available, otherwise extract from supplier_data
        pricing = row.get("price_breaks") or []
        if not pricing:
            logger.debug(f"[Catalog API] 💰 price_breaks column empty, extracting from supplier_data for {component_id}")
            # Fallback: extract from supplier_data
            supplier_data = row.get("supplier_data") or {}
            if isinstance(supplier_data, dict):
                # Try to extract pricing from various supplier formats
                for supplier_name in ["mouser", "digikey", "element14"]:
                    supplier_info = supplier_data.get(supplier_name, {})
                    if isinstance(supplier_info, dict):
                        price_breaks = supplier_info.get("price_breaks") or supplier_info.get("pricing", [])
                        if price_breaks and isinstance(price_breaks, list):
                            pricing = price_breaks
                            logger.debug(f"[Catalog API] 💰 Extracted {len(pricing)} price breaks from {supplier_name}")
                            break
        else:
            logger.debug(f"[Catalog API] 💰 Using {len(pricing)} price breaks from price_breaks column")

        # Log field completeness
        fields_present = {
            "stock_quantity": row.get("stock_quantity") is not None,
            "parameters": bool(row.get("parameters")),
            "specifications": bool(row.get("specifications")),
            "aec_qualified": row.get("aec_qualified") is not None,
            "halogen_free": row.get("halogen_free") is not None,
        }
        logger.debug(f"[Catalog API] 📋 Field completeness for {component_id}: {fields_present}")

        return CatalogComponent(
            id=str(row["id"]),
            mpn=row["mpn"],
            manufacturer=row.get("manufacturer"),
            category=row.get("category"),
            description=row.get("description"),
            datasheet_url=row.get("datasheet_url"),
            image_url=row.get("image_url"),
            lifecycle=row.get("lifecycle"),
            rohs=row.get("rohs"),
            reach=row.get("reach"),
            specifications=row.get("specifications") or {},
            parameters=row.get("parameters") or {},
            pricing=pricing,
            quality_score=float(row["quality_score"]) if row.get("quality_score") else 0.0,
            enrichment_source=row.get("enrichment_source"),
            last_enriched_at=row["last_enriched_at"].isoformat() if row.get("last_enriched_at") else None,
            created_at=row["created_at"].isoformat() if row.get("created_at") else None,
            updated_at=row["updated_at"].isoformat() if row.get("updated_at") else None,
            # Stock and pricing fields
            stock_status=row.get("stock_status"),
            stock_quantity=row.get("stock_quantity"),
            lead_time_days=row.get("lead_time_days"),
            unit_price=float(row["unit_price"]) if row.get("unit_price") else None,
            currency=row.get("currency"),
            moq=row.get("moq"),
            # Compliance fields
            aec_qualified=row.get("aec_qualified"),
            halogen_free=row.get("halogen_free")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Catalog API] ❌ Error fetching component {component_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching component: {str(e)}")
    finally:
        if components_db:
            components_db.close()
            logger.debug(f"[Catalog API] 🔒 Database session closed for component {component_id}")


@router.get("/stats", response_model=CatalogStats)
def get_catalog_stats(db: Session = Depends(get_db)):
    """
    Get catalog statistics

    Returns:
        Statistics about catalog contents

    Example:
        ```bash
        curl "http://localhost:8003/api/catalog/stats"
        ```
    """
    catalog_repo = CatalogRepository(db)
    stats = catalog_repo.get_statistics()

    return CatalogStats(
        total_components=stats['total_components'],
        by_lifecycle=stats['by_lifecycle'],
        by_quality_range=stats['by_quality_range'],
        by_source=stats['by_source'],
        average_quality=stats['average_quality']
    )


@router.get("/filters/lifecycles")
def get_lifecycle_values(db: Session = Depends(get_db)):
    """
    Get all distinct lifecycle values

    Returns:
        List of lifecycle statuses in catalog

    Example:
        ```bash
        curl "http://localhost:8003/api/catalog/filters/lifecycles"
        ```
    """
    catalog_repo = CatalogRepository(db)

    from sqlalchemy import func
    from app.models.catalog import CatalogComponent

    lifecycles = db.query(CatalogComponent.lifecycle).distinct().filter(
        CatalogComponent.lifecycle.isnot(None)
    ).all()

    return {
        "lifecycles": sorted([lc[0] for lc in lifecycles if lc[0]])
    }


@router.get("/filters/manufacturers")
def get_manufacturer_ids(
    limit: int = Query(100, description="Maximum results", ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get distinct manufacturer IDs in catalog

    Returns:
        List of manufacturer IDs

    Example:
        ```bash
        curl "http://localhost:8003/api/catalog/filters/manufacturers"
        ```
    """
    from sqlalchemy import func
    from app.models.catalog import CatalogComponent

    manufacturers = db.query(
        CatalogComponent.manufacturer_id,
        func.count(CatalogComponent.id).label('component_count')
    ).filter(
        CatalogComponent.manufacturer_id.isnot(None)
    ).group_by(
        CatalogComponent.manufacturer_id
    ).order_by(
        func.count(CatalogComponent.id).desc()
    ).limit(limit).all()

    return {
        "manufacturers": [
            {"id": mfg[0], "component_count": mfg[1]}
            for mfg in manufacturers if mfg[0]
        ]
    }


@router.get("/filters/categories")
def get_category_ids(
    limit: int = Query(100, description="Maximum results", ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get distinct category IDs in catalog

    Returns:
        List of category IDs

    Example:
        ```bash
        curl "http://localhost:8003/api/catalog/filters/categories"
        ```
    """
    from sqlalchemy import func
    from app.models.catalog import CatalogComponent

    categories = db.query(
        CatalogComponent.category_id,
        func.count(CatalogComponent.id).label('component_count')
    ).filter(
        CatalogComponent.category_id.isnot(None)
    ).group_by(
        CatalogComponent.category_id
    ).order_by(
        func.count(CatalogComponent.id).desc()
    ).limit(limit).all()

    return {
        "categories": [
            {"id": cat[0], "component_count": cat[1]}
            for cat in categories if cat[0]
        ]
    }
