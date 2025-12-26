"""
Catalog API Endpoints

Provides search and retrieval of production-ready components.

Risk Enrichment:
    Search results can optionally include risk scores from the Redis cache.
    Use include_risk=true and provide organization_id header to enrich results.
    Risk data is fetched from Redis cache (populated by risk.calculated events).
"""

import logging
import re
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.models.base import get_db
from app.models.dual_database import get_dual_database
from app.repositories.catalog_repository import CatalogRepository
from app.services.supplier_manager_service import get_supplier_manager

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
# Input Validation Constants (DoS Prevention)
# ============================================================================
MAX_QUERY_LENGTH = 500  # Maximum search query length
MAX_FILTER_VALUE_LENGTH = 200  # Maximum length for filter strings (category, manufacturer, etc.)
MAX_FILTER_LIST_SIZE = 50  # Maximum number of filter values in array parameters


def _validate_string_length(value: str, param_name: str, max_length: int) -> None:
    """
    Validate string parameter length to prevent DoS attacks.

    Args:
        value: String value to validate
        param_name: Parameter name for error message
        max_length: Maximum allowed length

    Raises:
        HTTPException: 400 if validation fails
    """
    if len(value) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} is too long. Maximum {max_length} characters allowed. (Received: {len(value)})"
        )


def _validate_filter_list(values: Optional[List[str]], param_name: str, max_length: int, max_items: int) -> None:
    """
    Validate list of filter values to prevent DoS attacks.

    Args:
        values: List of filter values
        param_name: Parameter name for error message
        max_length: Maximum length per value
        max_items: Maximum number of items in list

    Raises:
        HTTPException: 400 if validation fails
    """
    if values is None:
        return

    if len(values) > max_items:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} list is too long. Maximum {max_items} values allowed. (Received: {len(values)})"
        )

    for idx, value in enumerate(values):
        if len(value) > max_length:
            raise HTTPException(
                status_code=400,
                detail=f"{param_name}[{idx}] is too long. Maximum {max_length} characters allowed. (Received: {len(value)})"
            )


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

    # Extended fields for complete component data
    package: Optional[str] = None
    subcategory: Optional[str] = None
    lifecycle_status: Optional[str] = None

    # Media & Documentation
    image_url: Optional[str] = None
    datasheet_url: Optional[str] = None
    model_3d_url: Optional[str] = None

    # Compliance
    rohs_compliant: Optional[bool] = None
    reach_compliant: Optional[bool] = None
    aec_qualified: Optional[bool] = None
    halogen_free: Optional[bool] = None

    # Pricing & Availability
    unit_price: Optional[float] = None
    currency: Optional[str] = None
    moq: Optional[int] = None
    lead_time_days: Optional[int] = None
    stock_status: Optional[str] = None
    stock_quantity: Optional[int] = None
    in_stock: Optional[bool] = False  # Can be None from DB, defaults to False

    # Technical specifications
    specifications: Optional[Dict[str, Any]] = None


class SearchFacet(BaseModel):
    """Facet item for filter counts"""
    value: str
    label: str
    count: int


class SearchFacets(BaseModel):
    """Facet aggregations for filtering"""
    categories: List[SearchFacet] = []
    manufacturers: List[SearchFacet] = []
    packages: List[SearchFacet] = []
    lifecycle_statuses: List[SearchFacet] = []
    data_sources: List[SearchFacet] = []


class DashboardSearchResponse(BaseModel):
    """Dashboard search response wrapper"""
    results: List[DashboardSearchResult]
    total: int
    risk_enriched: bool = False  # True if results include risk data
    facets: Optional[SearchFacets] = None  # Aggregation counts for filters


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


# ============================================================================
# Full SELECT columns for search results
# ============================================================================
SEARCH_SELECT_COLUMNS = """
    id,
    manufacturer_part_number as mpn,
    manufacturer,
    category,
    subcategory,
    description,
    package,
    lifecycle_status,
    quality_score,
    enrichment_source,
    datasheet_url,
    image_url,
    model_3d_url,
    rohs_compliant,
    reach_compliant,
    aec_qualified,
    halogen_free,
    unit_price,
    currency,
    moq,
    lead_time_days,
    stock_status,
    stock_quantity,
    specifications,
    created_at,
    updated_at
"""

# ============================================================================
# Sort field mappings for search/browse endpoints
# ============================================================================
SORT_FIELD_MAP = {
    "relevance": "quality_score DESC",
    "quality_score": "quality_score",
    "mpn": "manufacturer_part_number",
    "manufacturer": "manufacturer",
    "price": "unit_price",
    "leadtime": "lead_time_days",
    "created_at": "created_at",
    "updated_at": "updated_at",
}
"""
Maps API sort field names to database column names.

This constant is used by both /search and /browse endpoints to normalize
sort parameters and build ORDER BY clauses. The 'relevance' sort defaults
to quality_score DESC for best results first.

Special handling:
- 'relevance': Defaults to 'quality_score DESC' (pre-formatted with DESC)
- 'price', 'leadtime': Require NULLS LAST to handle missing values
- All others: Sort order (ASC/DESC) is appended dynamically by endpoint
"""


def _build_filter_clauses(
    categories: Optional[List[str]] = None,
    manufacturers: Optional[List[str]] = None,
    packages: Optional[List[str]] = None,
    lifecycle_statuses: Optional[List[str]] = None,
    rohs_compliant: Optional[bool] = None,
    reach_compliant: Optional[bool] = None,
    aec_qualified: Optional[bool] = None,
    halogen_free: Optional[bool] = None,
    in_stock_only: Optional[bool] = None,
    quality_score_min: Optional[int] = None,
    quality_score_max: Optional[int] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
) -> tuple[str, dict]:
    """Build WHERE clause conditions and params for server-side filtering."""
    conditions = []
    params = {}

    if categories:
        conditions.append("category = ANY(:categories)")
        params["categories"] = categories

    if manufacturers:
        conditions.append("manufacturer = ANY(:manufacturers)")
        params["manufacturers"] = manufacturers

    if packages:
        conditions.append("package = ANY(:packages)")
        params["packages"] = packages

    if lifecycle_statuses:
        conditions.append("lifecycle_status = ANY(:lifecycle_statuses)")
        params["lifecycle_statuses"] = lifecycle_statuses

    if rohs_compliant is not None:
        conditions.append("rohs_compliant = :rohs_compliant")
        params["rohs_compliant"] = rohs_compliant

    if reach_compliant is not None:
        conditions.append("reach_compliant = :reach_compliant")
        params["reach_compliant"] = reach_compliant

    if aec_qualified is not None:
        conditions.append("aec_qualified = :aec_qualified")
        params["aec_qualified"] = aec_qualified

    if halogen_free is not None:
        conditions.append("halogen_free = :halogen_free")
        params["halogen_free"] = halogen_free

    if in_stock_only:
        conditions.append("(stock_quantity > 0 OR stock_status = 'In Stock')")

    if quality_score_min is not None:
        conditions.append("quality_score >= :quality_score_min")
        params["quality_score_min"] = quality_score_min

    if quality_score_max is not None:
        conditions.append("quality_score <= :quality_score_max")
        params["quality_score_max"] = quality_score_max

    if price_min is not None:
        conditions.append("unit_price >= :price_min")
        params["price_min"] = price_min

    if price_max is not None:
        conditions.append("unit_price <= :price_max")
        params["price_max"] = price_max

    return " AND ".join(conditions) if conditions else "", params


def _fetch_facets(db: Session, base_where: str, base_params: dict) -> SearchFacets:
    """
    Fetch facet aggregations for filter sidebar.

    SECURITY NOTE: base_where MUST be a parameterized SQL fragment from
    _build_filter_clauses() or a trusted source. NEVER pass user input directly.
    This function assumes base_where is already a safe WHERE clause with proper
    parameterization via base_params.

    Args:
        db: Database session
        base_where: Pre-validated parameterized WHERE clause fragment (from _build_filter_clauses)
        base_params: Corresponding bind parameters for the WHERE clause

    Returns:
        SearchFacets with category, manufacturer, package, lifecycle, and data source counts
    """
    # SECURITY ASSERTION: Verify this is called only with trusted input
    # The base_where comes from _build_filter_clauses() which uses parameterized queries
    # If you modify callers, ensure they maintain this security invariant
    assert base_params is not None, "base_params must be provided for parameterized queries"

    facets = SearchFacets()

    # Base query - facet_where uses the pre-validated parameterized WHERE clause
    facet_where = f"WHERE {base_where}" if base_where else ""

    try:
        # Categories facet
        cat_sql = text(f"""
            SELECT category as value, COUNT(*) as count
            FROM component_catalog
            {facet_where}
            GROUP BY category
            HAVING category IS NOT NULL
            ORDER BY count DESC
            LIMIT 50
        """)
        cat_results = db.execute(cat_sql, base_params).fetchall()
        facets.categories = [
            SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
            for r in cat_results
        ]

        # Manufacturers facet
        mfg_sql = text(f"""
            SELECT manufacturer as value, COUNT(*) as count
            FROM component_catalog
            {facet_where}
            GROUP BY manufacturer
            HAVING manufacturer IS NOT NULL
            ORDER BY count DESC
            LIMIT 50
        """)
        mfg_results = db.execute(mfg_sql, base_params).fetchall()
        facets.manufacturers = [
            SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
            for r in mfg_results
        ]

        # Packages facet
        pkg_sql = text(f"""
            SELECT package as value, COUNT(*) as count
            FROM component_catalog
            {facet_where}
            GROUP BY package
            HAVING package IS NOT NULL
            ORDER BY count DESC
            LIMIT 30
        """)
        pkg_results = db.execute(pkg_sql, base_params).fetchall()
        facets.packages = [
            SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
            for r in pkg_results
        ]

        # Lifecycle status facet
        lc_sql = text(f"""
            SELECT lifecycle_status as value, COUNT(*) as count
            FROM component_catalog
            {facet_where}
            GROUP BY lifecycle_status
            HAVING lifecycle_status IS NOT NULL
            ORDER BY count DESC
        """)
        lc_results = db.execute(lc_sql, base_params).fetchall()
        facets.lifecycle_statuses = [
            SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
            for r in lc_results
        ]

        # Data sources facet
        ds_sql = text(f"""
            SELECT enrichment_source as value, COUNT(*) as count
            FROM component_catalog
            {facet_where}
            GROUP BY enrichment_source
            HAVING enrichment_source IS NOT NULL
            ORDER BY count DESC
        """)
        ds_results = db.execute(ds_sql, base_params).fetchall()
        facets.data_sources = [
            SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
            for r in ds_results
        ]

    except Exception as e:
        logger.warning(f"[Catalog API] Facet aggregation failed: {e}")

    return facets


def _row_to_search_result(row: dict, risk_info: Optional[RiskInfo] = None) -> DashboardSearchResult:
    """Convert database row to DashboardSearchResult with all fields."""
    component_id = str(row.get("id")) if row.get("id") else None
    quality = row.get("quality_score") or 0

    # Determine enrichment_status based on quality_score and datasheet presence
    if quality >= 95 and row.get("datasheet_url"):
        enrichment_status = "production"
    elif quality >= 70:
        enrichment_status = "staging"
    elif row.get("datasheet_url"):
        enrichment_status = "staging"
    else:
        enrichment_status = "pending"

    # Determine in_stock
    stock_qty = row.get("stock_quantity")
    stock_status = row.get("stock_status")
    in_stock = (stock_qty and stock_qty > 0) or (stock_status and "stock" in stock_status.lower())

    return DashboardSearchResult(
        mpn=row.get("mpn") or "",
        manufacturer=row.get("manufacturer") or "Unknown",
        category=row.get("category") or "Uncategorized",
        description=row.get("description") or "",
        quality_score=float(quality),
        enrichment_status=enrichment_status,
        data_sources=[row.get("enrichment_source")] if row.get("enrichment_source") else ["catalog_db"],
        last_updated=row["updated_at"].isoformat() if row.get("updated_at") else (row["created_at"].isoformat() if row.get("created_at") else ""),
        risk=risk_info,
        component_id=component_id,
        # Extended fields
        package=row.get("package"),
        subcategory=row.get("subcategory"),
        lifecycle_status=row.get("lifecycle_status"),
        image_url=row.get("image_url"),
        datasheet_url=row.get("datasheet_url"),
        model_3d_url=row.get("model_3d_url"),
        rohs_compliant=row.get("rohs_compliant"),
        reach_compliant=row.get("reach_compliant"),
        aec_qualified=row.get("aec_qualified"),
        halogen_free=row.get("halogen_free"),
        unit_price=float(row["unit_price"]) if row.get("unit_price") else None,
        currency=row.get("currency"),
        moq=row.get("moq"),
        lead_time_days=row.get("lead_time_days"),
        stock_status=stock_status,
        stock_quantity=stock_qty,
        in_stock=in_stock,
        specifications=row.get("specifications"),
    )


@router.get("/search", response_model=DashboardSearchResponse)
def search_catalog(
    query: str = Query(..., description="Search query (MPN, manufacturer, category, or description)", min_length=2, max_length=MAX_QUERY_LENGTH),
    search_type: Optional[str] = Query("mpn", description="Search type: all, mpn, manufacturer, category, description", max_length=50),
    include_risk: bool = Query(False, description="Include risk scores from cache"),
    limit: int = Query(50, description="Maximum results", ge=1, le=500),
    offset: int = Query(0, description="Offset for pagination", ge=0),
    # Server-side filters
    categories: Optional[List[str]] = Query(None, description="Filter by categories"),
    manufacturers: Optional[List[str]] = Query(None, description="Filter by manufacturers"),
    packages: Optional[List[str]] = Query(None, description="Filter by packages"),
    lifecycle_statuses: Optional[List[str]] = Query(None, description="Filter by lifecycle: active, nrnd, obsolete"),
    rohs_compliant: Optional[bool] = Query(None, description="Filter RoHS compliant"),
    reach_compliant: Optional[bool] = Query(None, description="Filter REACH compliant"),
    aec_qualified: Optional[bool] = Query(None, description="Filter AEC-Q qualified"),
    halogen_free: Optional[bool] = Query(None, description="Filter halogen-free"),
    in_stock_only: Optional[bool] = Query(None, description="Only show in-stock items"),
    quality_score_min: Optional[int] = Query(None, description="Minimum quality score", ge=0, le=100),
    quality_score_max: Optional[int] = Query(None, description="Maximum quality score", ge=0, le=100),
    price_min: Optional[float] = Query(None, description="Minimum price"),
    price_max: Optional[float] = Query(None, description="Maximum price"),
    sort_by: str = Query("relevance", description="Sort by: relevance, quality_score, mpn, manufacturer, price, leadtime", max_length=50),
    sort_order: str = Query("desc", description="Sort order: asc, desc", max_length=10),
    include_facets: bool = Query(True, description="Include facet aggregations"),
    db: Session = Depends(get_db),
    auth: Optional["AuthContext"] = Depends(get_optional_auth_context),
):
    """
    Search catalog with server-side filtering - Dashboard-compatible endpoint

    Supports full server-side filtering, pagination, sorting, and facet aggregations.

    Args:
        query: Search query string
        search_type: Type of search (mpn, manufacturer, category, description, all)
        include_risk: Include risk scores in results (requires authentication)
        limit: Maximum results per page
        offset: Pagination offset
        categories: Filter by category names
        manufacturers: Filter by manufacturer names
        packages: Filter by package types
        lifecycle_statuses: Filter by lifecycle status
        rohs_compliant: Filter by RoHS compliance
        reach_compliant: Filter by REACH compliance
        aec_qualified: Filter by AEC-Q qualification
        halogen_free: Filter by halogen-free status
        in_stock_only: Only show in-stock components
        quality_score_min/max: Filter by quality score range
        price_min/max: Filter by price range
        sort_by: Sort field
        sort_order: Sort direction
        include_facets: Include aggregation facets in response

    Returns:
        DashboardSearchResponse with results, total count, and facets
    """
    organization_id = auth.organization_id if auth else None

    # SECURITY: Validate input lengths to prevent DoS attacks
    _validate_filter_list(categories, "categories", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
    _validate_filter_list(manufacturers, "manufacturers", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
    _validate_filter_list(packages, "packages", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
    _validate_filter_list(lifecycle_statuses, "lifecycle_statuses", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)

    # SECURITY: Validate sort_order strictly to prevent SQL injection
    if sort_order.lower() not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="sort_order must be 'asc' or 'desc'")
    sort_order = sort_order.lower()  # Normalize to lowercase

    # SECURITY: Validate sort_by against whitelist to prevent SQL injection
    if sort_by not in SORT_FIELD_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"sort_by must be one of: {', '.join(SORT_FIELD_MAP.keys())}"
        )

    logger.info(f"[Catalog API] Search - query='{query}', type={search_type}, limit={limit}, offset={offset}")

    # Build search WHERE clause
    search_filter = f"%{query}%"
    if search_type == "all":
        search_where = """(
            manufacturer_part_number ILIKE :search_filter
            OR manufacturer ILIKE :search_filter
            OR category ILIKE :search_filter
            OR description ILIKE :search_filter
        )"""
    elif search_type == "mpn":
        search_where = "manufacturer_part_number ILIKE :search_filter"
    elif search_type == "manufacturer":
        search_where = "manufacturer ILIKE :search_filter"
    elif search_type == "category":
        search_where = "category ILIKE :search_filter"
    else:  # description
        search_where = "description ILIKE :search_filter"

    # Build filter clauses
    filter_where, filter_params = _build_filter_clauses(
        categories=categories,
        manufacturers=manufacturers,
        packages=packages,
        lifecycle_statuses=lifecycle_statuses,
        rohs_compliant=rohs_compliant,
        reach_compliant=reach_compliant,
        aec_qualified=aec_qualified,
        halogen_free=halogen_free,
        in_stock_only=in_stock_only,
        quality_score_min=quality_score_min,
        quality_score_max=quality_score_max,
        price_min=price_min,
        price_max=price_max,
    )

    # Combine WHERE clauses
    where_clause = search_where
    if filter_where:
        where_clause = f"{search_where} AND {filter_where}"

    # Build ORDER BY using shared constant
    base_column = SORT_FIELD_MAP.get(sort_by, "quality_score")

    # 'relevance' is pre-formatted with DESC, others need sort_order appended
    if sort_by == "relevance":
        order_by = base_column  # Already "quality_score DESC"
    elif sort_by in ("price", "leadtime"):
        # Price and leadtime need NULLS LAST
        order_by = f"{base_column} {sort_order.upper()} NULLS LAST"
    else:
        # Standard sort fields
        order_by = f"{base_column} {sort_order.upper()}"

    # Build and execute main query
    params = {"search_filter": search_filter, "limit": limit, "offset": offset, **filter_params}

    query_sql = text(f"""
        SELECT {SEARCH_SELECT_COLUMNS}
        FROM component_catalog
        WHERE {where_clause}
        ORDER BY {order_by} NULLS LAST
        LIMIT :limit OFFSET :offset
    """)

    count_sql = text(f"""
        SELECT COUNT(*) as total FROM component_catalog WHERE {where_clause}
    """)

    try:
        components = db.execute(query_sql, params).fetchall()
        total_result = db.execute(count_sql, {k: v for k, v in params.items() if k not in ['limit', 'offset']}).fetchone()
        total = total_result._mapping["total"] if total_result else 0
    except Exception as e:
        logger.error(f"[Catalog API] Search query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search query failed: {str(e)}")

    # Fetch risk scores if requested
    risk_data: Dict[str, Any] = {}
    risk_enriched = False
    if include_risk and organization_id and RISK_CACHE_AVAILABLE:
        component_ids = [str(c._mapping.get("id")) for c in components if c._mapping.get("id")]
        if component_ids:
            risk_data = get_cached_risks_batch(organization_id, component_ids)
            risk_enriched = True

    # Convert to results
    results = []
    for c in components:
        row = dict(c._mapping)
        component_id = str(row.get("id")) if row.get("id") else None
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
        results.append(_row_to_search_result(row, risk_info))

    # Fetch facets
    facets = None
    if include_facets:
        # Use only search filter for facet base (not the filter params, so we see all available options)
        facets = _fetch_facets(db, search_where, {"search_filter": search_filter})

    logger.info(f"[Catalog API] Search complete - {len(results)}/{total} results")

    return DashboardSearchResponse(
        results=results,
        total=total,
        risk_enriched=risk_enriched,
        facets=facets,
    )




@router.get("/browse", response_model=DashboardSearchResponse)
def browse_catalog(
    limit: int = Query(50, description="Maximum results", ge=1, le=500),
    offset: int = Query(0, description="Offset for pagination", ge=0),
    # Server-side filters (same as /search)
    categories: Optional[List[str]] = Query(None, description="Filter by categories"),
    manufacturers: Optional[List[str]] = Query(None, description="Filter by manufacturers"),
    packages: Optional[List[str]] = Query(None, description="Filter by packages"),
    lifecycle_statuses: Optional[List[str]] = Query(None, description="Filter by lifecycle: active, nrnd, obsolete"),
    rohs_compliant: Optional[bool] = Query(None, description="Filter RoHS compliant"),
    reach_compliant: Optional[bool] = Query(None, description="Filter REACH compliant"),
    aec_qualified: Optional[bool] = Query(None, description="Filter AEC-Q qualified"),
    halogen_free: Optional[bool] = Query(None, description="Filter halogen-free"),
    in_stock_only: Optional[bool] = Query(None, description="Only show in-stock items"),
    quality_score_min: Optional[int] = Query(None, description="Minimum quality score", ge=0, le=100),
    quality_score_max: Optional[int] = Query(None, description="Maximum quality score", ge=0, le=100),
    price_min: Optional[float] = Query(None, description="Minimum price"),
    price_max: Optional[float] = Query(None, description="Maximum price"),
    sort_by: str = Query("quality_score", description="Sort field: quality_score, mpn, manufacturer, price, leadtime", max_length=50),
    sort_order: str = Query("desc", description="Sort order: asc, desc", max_length=10),
    include_facets: bool = Query(True, description="Include facet aggregations"),
    include_risk: bool = Query(False, description="Include risk scores from cache"),
    db: Session = Depends(get_db),
    auth: Optional["AuthContext"] = Depends(get_optional_auth_context),
):
    """
    Browse all catalog components without search query.

    Returns paginated list of components sorted by quality score (default).
    Use this endpoint for initial page load to show top components.
    Supports server-side filtering, pagination, sorting, and facet aggregations.

    Args:
        limit: Maximum results per page
        offset: Pagination offset
        categories: Filter by category names
        manufacturers: Filter by manufacturer names
        packages: Filter by package types
        lifecycle_statuses: Filter by lifecycle status
        rohs_compliant: Filter by RoHS compliance
        reach_compliant: Filter by REACH compliance
        aec_qualified: Filter by AEC-Q qualification
        halogen_free: Filter by halogen-free status
        in_stock_only: Only show in-stock components
        quality_score_min/max: Filter by quality score range
        price_min/max: Filter by price range
        sort_by: Sort field
        sort_order: Sort direction
        include_facets: Include aggregation facets in response
        include_risk: Include risk scores from cache

    Returns:
        DashboardSearchResponse with results, total count, and facets
    """
    organization_id = auth.organization_id if auth else None

    # SECURITY: Validate input lengths to prevent DoS attacks
    _validate_filter_list(categories, "categories", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
    _validate_filter_list(manufacturers, "manufacturers", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
    _validate_filter_list(packages, "packages", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
    _validate_filter_list(lifecycle_statuses, "lifecycle_statuses", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)

    # SECURITY: Validate sort_order strictly to prevent SQL injection
    if sort_order.lower() not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="sort_order must be 'asc' or 'desc'")
    sort_order = sort_order.lower()  # Normalize to lowercase

    # SECURITY: Validate sort_by against whitelist to prevent SQL injection
    if sort_by not in SORT_FIELD_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"sort_by must be one of: {', '.join(SORT_FIELD_MAP.keys())}"
        )

    logger.info(f"[Catalog API] Browse catalog - limit={limit}, offset={offset}, sort={sort_by} {sort_order}")

    # Build filter clauses
    filter_where, filter_params = _build_filter_clauses(
        categories=categories,
        manufacturers=manufacturers,
        packages=packages,
        lifecycle_statuses=lifecycle_statuses,
        rohs_compliant=rohs_compliant,
        reach_compliant=reach_compliant,
        aec_qualified=aec_qualified,
        halogen_free=halogen_free,
        in_stock_only=in_stock_only,
        quality_score_min=quality_score_min,
        quality_score_max=quality_score_max,
        price_min=price_min,
        price_max=price_max,
    )

    # Build WHERE clause
    where_clause = f"WHERE {filter_where}" if filter_where else ""

    # Build ORDER BY using shared constant
    base_column = SORT_FIELD_MAP.get(sort_by, "quality_score")

    # 'relevance' is pre-formatted with DESC, others need sort_order appended
    if sort_by == "relevance":
        order_by = base_column  # Already "quality_score DESC"
    elif sort_by in ("price", "leadtime"):
        # Price and leadtime need NULLS LAST
        order_by = f"{base_column} {sort_order.upper()} NULLS LAST"
    else:
        # Standard sort fields
        order_by = f"{base_column} {sort_order.upper()}"

    # Build and execute main query
    params = {"limit": limit, "offset": offset, **filter_params}

    query_sql = text(f"""
        SELECT {SEARCH_SELECT_COLUMNS}
        FROM component_catalog
        {where_clause}
        ORDER BY {order_by} NULLS LAST
        LIMIT :limit OFFSET :offset
    """)

    count_sql = text(f"""
        SELECT COUNT(*) as total FROM component_catalog {where_clause}
    """)

    try:
        components = db.execute(query_sql, params).fetchall()
        total_result = db.execute(count_sql, {k: v for k, v in params.items() if k not in ['limit', 'offset']}).fetchone()
        total = total_result._mapping["total"] if total_result else 0
    except Exception as e:
        logger.error(f"[Catalog API] Browse query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Browse query failed: {str(e)}")

    # Fetch risk scores if requested
    risk_data: Dict[str, Any] = {}
    risk_enriched = False
    if include_risk and organization_id and RISK_CACHE_AVAILABLE:
        component_ids = [str(c._mapping.get("id")) for c in components if c._mapping.get("id")]
        if component_ids:
            risk_data = get_cached_risks_batch(organization_id, component_ids)
            risk_enriched = True

    # Convert to results using helper function
    results = []
    for c in components:
        row = dict(c._mapping)
        component_id = str(row.get("id")) if row.get("id") else None
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
        results.append(_row_to_search_result(row, risk_info))

    # Fetch facets
    facets = None
    if include_facets:
        # Use empty base where for browse (show all available options)
        facets = _fetch_facets(db, "", {})

    logger.info(f"[Catalog API] Browse complete - {len(results)}/{total} results")

    return DashboardSearchResponse(
        results=results,
        total=total,
        risk_enriched=risk_enriched,
        facets=facets,
    )


# ============================================================================
# Shared Component Query Logic (DRY refactor)
# ============================================================================

# SQL query for fetching full component details
COMPONENT_DETAIL_SQL = """
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
        model_3d_url,
        package,
        subcategory,
        category_path,
        product_family,
        product_series,
        risk_level,
        quality_metadata,
        ai_metadata,
        eccn_code,
        enrichment_count,
        usage_count,
        last_used_at,
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
"""

# MPN validation regex (alphanumeric, hyphens, underscores, slashes, dots, commas, spaces)
MPN_PATTERN = re.compile(r'^[a-zA-Z0-9\-_/\.\,\s]{1,100}$')

# UUID validation regex
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)


def _extract_pricing_from_row(row: dict) -> list:
    """Extract pricing data from row, falling back to supplier_data if needed."""
    pricing = row.get("price_breaks") or []
    if not pricing:
        supplier_data = row.get("supplier_data") or {}
        if isinstance(supplier_data, dict):
            for supplier_name in ["mouser", "digikey", "element14"]:
                supplier_info = supplier_data.get(supplier_name, {})
                if isinstance(supplier_info, dict):
                    price_breaks = supplier_info.get("price_breaks") or supplier_info.get("pricing", [])
                    if price_breaks and isinstance(price_breaks, list):
                        pricing = price_breaks
                        break
    return pricing


def _row_to_catalog_component(row: dict) -> CatalogComponent:
    """Convert database row to CatalogComponent model."""
    pricing = _extract_pricing_from_row(row)

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
        stock_status=row.get("stock_status"),
        stock_quantity=row.get("stock_quantity"),
        lead_time_days=row.get("lead_time_days"),
        unit_price=float(row["unit_price"]) if row.get("unit_price") else None,
        currency=row.get("currency"),
        moq=row.get("moq"),
        aec_qualified=row.get("aec_qualified"),
        halogen_free=row.get("halogen_free")
    )


def _fetch_component(where_clause: str, params: dict, identifier: str) -> CatalogComponent:
    """
    Shared logic for fetching a component from component_catalog.

    Args:
        where_clause: SQL WHERE clause (e.g., "id = :component_id")
        params: Query parameters
        identifier: Human-readable identifier for error messages

    Returns:
        CatalogComponent model

    Raises:
        HTTPException: 404 if not found, 500 on database error
    """
    dual_db = get_dual_database()
    components_db = None

    try:
        components_db = next(dual_db.get_session("components"))
    except Exception as e:
        logger.error(f"[Catalog API] Failed to get components database session: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

    try:
        query = text(f"{COMPONENT_DETAIL_SQL} WHERE {where_clause} LIMIT 1")
        result = components_db.execute(query, params).fetchone()

        if not result:
            logger.warning(f"[Catalog API] Component not found: {identifier}")
            raise HTTPException(status_code=404, detail=f"Component not found: {identifier}")

        row = dict(result._mapping)
        logger.info(f"[Catalog API] Found component: {row.get('mpn')} (Manufacturer: {row.get('manufacturer')}, Quality: {row.get('quality_score')})")

        return _row_to_catalog_component(row)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Catalog API] Error fetching component {identifier}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching component: {str(e)}")
    finally:
        if components_db:
            components_db.close()


# ============================================================================
# Component Detail Endpoints
# ============================================================================

@router.get("/component/{mpn}", response_model=CatalogComponent)
def get_component_by_mpn(mpn: str):
    """
    Get component by MPN from component_catalog table

    Args:
        mpn: Manufacturer Part Number

    Returns:
        Component details from central component catalog

    Example:
        ```bash
        curl "http://localhost:8003/api/catalog/component/STM32F407VGT6"
        ```
    """
    # Input validation
    if not mpn or not mpn.strip():
        raise HTTPException(status_code=400, detail="MPN parameter is required")

    mpn = mpn.strip()
    if not MPN_PATTERN.match(mpn):
        raise HTTPException(
            status_code=400,
            detail="Invalid MPN format. Must be 1-100 characters, alphanumeric with hyphens, underscores, dots, commas, or spaces."
        )

    logger.info(f"[Catalog API] Fetching component by MPN: {mpn}")

    return _fetch_component(
        where_clause="LOWER(manufacturer_part_number) = LOWER(:mpn)",
        params={"mpn": mpn},
        identifier=mpn
    )


@router.get("/component/id/{component_id}", response_model=CatalogComponent)
def get_component_by_id(component_id: str):
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
    # Input validation
    if not component_id or not component_id.strip():
        raise HTTPException(status_code=400, detail="Component ID parameter is required")

    component_id = component_id.strip()
    if not UUID_PATTERN.match(component_id):
        raise HTTPException(status_code=400, detail="Invalid component ID format. Must be a valid UUID.")

    logger.info(f"[Catalog API] Fetching component by ID: {component_id}")

    return _fetch_component(
        where_clause="id = :component_id",
        params={"component_id": component_id},
        identifier=f"ID {component_id}"
    )


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


# ============================================================================
# Supplier API Fallback Endpoint (Search Unknown Components)
# ============================================================================

def _extract_price_from_supplier_data(supplier_data: Dict[str, Any]) -> Optional[float]:
    """
    Extract unit price from supplier data.

    Tries multiple common field patterns:
    - unit_price, price, UnitPrice
    - price_breaks[0] structure
    - pricing[0] structure
    """
    # Direct price fields
    for field in ['unit_price', 'price', 'UnitPrice', 'unitPrice']:
        if field in supplier_data:
            price = supplier_data[field]
            try:
                return float(price) if price is not None else None
            except (ValueError, TypeError):
                continue

    # Price breaks array
    for breaks_field in ['price_breaks', 'pricing', 'priceBreaks', 'PriceBreaks']:
        if breaks_field in supplier_data:
            breaks = supplier_data[breaks_field]
            if isinstance(breaks, list) and len(breaks) > 0:
                first_break = breaks[0]
                if isinstance(first_break, dict):
                    for price_field in ['price', 'unit_price', 'unitPrice', 'Price']:
                        if price_field in first_break:
                            try:
                                return float(first_break[price_field])
                            except (ValueError, TypeError):
                                continue

    return None


def _normalize_supplier_result(raw_data: Dict[str, Any], source: str) -> DashboardSearchResult:
    """
    Normalize a single supplier API response to DashboardSearchResult.

    Args:
        raw_data: Raw response from supplier API
        source: Supplier name (digikey, mouser, element14)

    Returns:
        DashboardSearchResult with normalized data
    """
    # Extract MPN (different suppliers use different field names)
    mpn = (
        raw_data.get('mpn') or
        raw_data.get('partNumber') or
        raw_data.get('manufacturerPartNumber') or
        raw_data.get('ManufacturerPartNumber') or
        raw_data.get('part_number') or
        ""
    )

    # Extract manufacturer
    manufacturer = raw_data.get('manufacturer')
    if not manufacturer and 'Manufacturer' in raw_data:
        mfg_obj = raw_data['Manufacturer']
        if isinstance(mfg_obj, dict):
            manufacturer = mfg_obj.get('Name') or mfg_obj.get('name')
        else:
            manufacturer = str(mfg_obj)
    if not manufacturer:
        manufacturer = (
            raw_data.get('manufacturerName') or
            raw_data.get('manufacturer_name') or
            "Unknown"
        )

    # Extract description
    description = (
        raw_data.get('description') or
        raw_data.get('Description') or
        raw_data.get('productDescription') or
        raw_data.get('detailedDescription') or
        ""
    )

    # Extract category
    category = (
        raw_data.get('category') or
        raw_data.get('Category') or
        raw_data.get('categoryName') or
        "Uncategorized"
    )

    # Extract compliance
    rohs_compliant = raw_data.get('rohs_compliant') or raw_data.get('RoHSStatus')
    if rohs_compliant and isinstance(rohs_compliant, str):
        rohs_compliant = rohs_compliant.lower() in ('compliant', 'yes', 'true')

    # Extract media URLs
    image_url = (
        raw_data.get('image_url') or
        raw_data.get('PhotoUrl') or
        raw_data.get('imageUrl') or
        raw_data.get('primaryPhoto')
    )

    datasheet_url = (
        raw_data.get('datasheet_url') or
        raw_data.get('DatasheetUrl') or
        raw_data.get('datasheetUrl') or
        raw_data.get('primaryDatasheet')
    )

    # Extract pricing and stock
    unit_price = _extract_price_from_supplier_data(raw_data)

    stock_quantity = raw_data.get('stock_quantity') or raw_data.get('QuantityAvailable')
    if stock_quantity and isinstance(stock_quantity, str):
        try:
            stock_quantity = int(stock_quantity.replace(',', ''))
        except ValueError:
            stock_quantity = None

    in_stock = raw_data.get('in_stock') or False  # Handle explicit None values
    if stock_quantity is not None and stock_quantity > 0:
        in_stock = True

    stock_status = raw_data.get('stock_status') or raw_data.get('stockStatus')
    if not stock_status:
        stock_status = 'In Stock' if in_stock else 'Unknown'

    # Extract specifications
    specifications = raw_data.get('specifications') or raw_data.get('parameters') or {}

    # Determine lifecycle status
    lifecycle_status = raw_data.get('lifecycle_status') or raw_data.get('lifecycleStatus')

    return DashboardSearchResult(
        mpn=mpn,
        manufacturer=manufacturer,
        category=category,
        description=description,
        quality_score=30.0,  # Initial quality score for supplier-sourced data (not enriched)
        enrichment_status='pending',
        data_sources=[source],
        last_updated=datetime.utcnow().isoformat(),
        image_url=image_url,
        datasheet_url=datasheet_url,
        unit_price=unit_price,
        in_stock=in_stock,
        stock_status=stock_status,
        stock_quantity=stock_quantity,
        rohs_compliant=rohs_compliant,
        lifecycle_status=lifecycle_status,
        specifications=specifications,
    )


def _save_to_component_catalog(db: Session, components: List[DashboardSearchResult]) -> List[DashboardSearchResult]:
    """
    Save normalized components to component_catalog table.
    Uses INSERT ... ON CONFLICT DO UPDATE (upsert) to avoid duplicates.

    Args:
        db: Components database session
        components: List of normalized search results to save

    Returns:
        List of successfully saved components
    """
    saved = []

    for comp in components:
        try:
            # Check if component exists
            existing = db.execute(
                text("""
                    SELECT id FROM component_catalog
                    WHERE LOWER(manufacturer_part_number) = LOWER(:mpn)
                    AND LOWER(manufacturer) = LOWER(:manufacturer)
                """),
                {"mpn": comp.mpn, "manufacturer": comp.manufacturer}
            ).fetchone()

            if existing:
                # Update existing component with new data from supplier
                logger.info(f"[Catalog API] Updating existing component: {comp.mpn}")
                db.execute(
                    text("""
                        UPDATE component_catalog SET
                            description = COALESCE(:description, description),
                            image_url = COALESCE(:image_url, image_url),
                            datasheet_url = COALESCE(:datasheet_url, datasheet_url),
                            unit_price = COALESCE(:unit_price, unit_price),
                            stock_status = COALESCE(:stock_status, stock_status),
                            stock_quantity = COALESCE(:stock_quantity, stock_quantity),
                            rohs_compliant = COALESCE(:rohs_compliant, rohs_compliant),
                            specifications = COALESCE(:specifications::jsonb, specifications),
                            supplier_data = COALESCE(supplier_data, '{}'::jsonb) || :supplier_data::jsonb,
                            updated_at = NOW()
                        WHERE id = :id
                    """),
                    {
                        "id": existing[0],
                        "description": comp.description,
                        "image_url": comp.image_url,
                        "datasheet_url": comp.datasheet_url,
                        "unit_price": comp.unit_price,
                        "stock_status": comp.stock_status,
                        "stock_quantity": comp.stock_quantity,
                        "rohs_compliant": comp.rohs_compliant,
                        "specifications": json.dumps(comp.specifications or {}),
                        "supplier_data": json.dumps({
                            "sources": comp.data_sources,
                            "last_supplier_update": datetime.utcnow().isoformat()
                        })
                    }
                )
            else:
                # Insert new component
                logger.info(f"[Catalog API] Inserting new component: {comp.mpn}")
                db.execute(
                    text("""
                        INSERT INTO component_catalog (
                            id, manufacturer_part_number, manufacturer, description,
                            category, quality_score, enrichment_source, image_url,
                            datasheet_url, unit_price, currency, stock_status,
                            stock_quantity, rohs_compliant, lifecycle_status,
                            supplier_data, specifications, created_at, updated_at
                        ) VALUES (
                            gen_random_uuid(), :mpn, :manufacturer, :description,
                            :category, :quality_score, :source, :image_url,
                            :datasheet_url, :unit_price, :currency, :stock_status,
                            :stock_quantity, :rohs_compliant, :lifecycle_status,
                            :supplier_data::jsonb, :specifications::jsonb, NOW(), NOW()
                        )
                    """),
                    {
                        "mpn": comp.mpn,
                        "manufacturer": comp.manufacturer,
                        "description": comp.description,
                        "category": comp.category,
                        "quality_score": comp.quality_score,
                        "source": ','.join(comp.data_sources),
                        "image_url": comp.image_url,
                        "datasheet_url": comp.datasheet_url,
                        "unit_price": comp.unit_price,
                        "currency": comp.currency or "USD",
                        "stock_status": comp.stock_status,
                        "stock_quantity": comp.stock_quantity,
                        "rohs_compliant": comp.rohs_compliant,
                        "lifecycle_status": comp.lifecycle_status,
                        "supplier_data": json.dumps({
                            "sources": comp.data_sources,
                            "first_supplier_import": datetime.utcnow().isoformat()
                        }),
                        "specifications": json.dumps(comp.specifications or {})
                    }
                )

            db.commit()
            saved.append(comp)

        except Exception as e:
            logger.error(f"[Catalog API] Failed to save component {comp.mpn}: {e}", exc_info=True)
            db.rollback()

    return saved


@router.get("/search-and-enrich", response_model=DashboardSearchResponse)
def search_and_enrich(
    q: str = Query(..., min_length=2, max_length=MAX_QUERY_LENGTH, description="Search query (MPN or keyword)"),
    suppliers: Optional[List[str]] = Query(None, description="Supplier list: digikey, mouser, element14 (default: all enabled)"),
    save_to_catalog: bool = Query(True, description="Save found components to catalog"),
    db: Session = Depends(get_db),
    auth: Optional["AuthContext"] = Depends(get_optional_auth_context),
):
    """
    Search catalog and fall back to supplier APIs if no results found.

    This endpoint implements a 2-step search:
    1. Search local component_catalog database
    2. If no results, query external supplier APIs (DigiKey, Mouser, Element14)
    3. Normalize supplier responses to standard format
    4. Optionally save new components to catalog for future searches

    Use Cases:
    - Unknown component lookup during BOM enrichment
    - Discovering components not yet in local catalog
    - Getting real-time pricing/availability from suppliers

    Args:
        q: Search query (MPN, manufacturer, or keyword)
        suppliers: List of suppliers to query (default: all enabled suppliers)
        save_to_catalog: Whether to save found components to catalog (default: true)
        db: Database session (Supabase for search, Components V2 for catalog save)
        auth: Optional authentication context

    Returns:
        DashboardSearchResponse with results from catalog or suppliers

    Example:
        ```bash
        # Search with all suppliers
        curl "http://localhost:27200/api/catalog/search-and-enrich?q=STM32F407VGT6"

        # Search with specific suppliers only
        curl "http://localhost:27200/api/catalog/search-and-enrich?q=STM32F407VGT6&suppliers=digikey&suppliers=mouser"

        # Search without saving to catalog
        curl "http://localhost:27200/api/catalog/search-and-enrich?q=STM32F407VGT6&save_to_catalog=false"
        ```
    """
    # SECURITY: Validate supplier list to prevent DoS attacks
    _validate_filter_list(suppliers, "suppliers", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)

    logger.info(f"[Catalog API] Search-and-enrich query: '{q}'")

    # Step 1: Search local catalog first (fast, free)
    try:
        local_results = search_catalog(
            query=q,
            search_type="all",  # Search across all fields
            limit=50,
            offset=0,
            include_facets=False,
            db=db,
            auth=auth,
        )

        if local_results.total > 0:
            logger.info(f"[Catalog API] Found {local_results.total} results in local catalog")
            return local_results
    except Exception as e:
        logger.warning(f"[Catalog API] Local catalog search failed: {e}")
        # Continue to supplier API fallback

    # Step 2: No local results - query supplier APIs
    logger.info(f"[Catalog API] No local results, querying supplier APIs for: '{q}'")

    try:
        supplier_manager = get_supplier_manager()
    except Exception as e:
        logger.error(f"[Catalog API] Failed to get supplier manager: {e}")
        raise HTTPException(
            status_code=503,
            detail="Supplier API service unavailable"
        )

    # Get available suppliers
    available_suppliers = supplier_manager.get_available_suppliers()

    if not available_suppliers:
        logger.warning("[Catalog API] No suppliers are enabled - cannot query external APIs")
        return DashboardSearchResponse(
            results=[],
            total=0,
            facets=None
        )

    # Filter to requested suppliers (or use all available)
    target_suppliers = suppliers if suppliers else available_suppliers
    target_suppliers = [s for s in target_suppliers if s in available_suppliers]

    if not target_suppliers:
        logger.warning(f"[Catalog API] Requested suppliers {suppliers} not available. Available: {available_suppliers}")
        return DashboardSearchResponse(
            results=[],
            total=0,
            facets=None
        )

    logger.info(f"[Catalog API] Querying suppliers: {target_suppliers}")

    # Query each supplier (with resilience patterns from manager)
    supplier_results = []

    for supplier_name in target_suppliers:
        try:
            logger.info(f"[Catalog API] Querying {supplier_name} for: '{q}'")

            # Use supplier manager's search method (handles circuit breaker, retries, rate limiting)
            search_results = supplier_manager.search(supplier_name, q, limit=20)

            if search_results:
                logger.info(f"[Catalog API] {supplier_name} returned {len(search_results)} results")

                # Normalize each result
                for result in search_results:
                    # Convert SupplierSearchResult to dict for normalization
                    raw_data = {
                        'mpn': result.mpn,
                        'manufacturer': result.manufacturer,
                        'description': result.description,
                        'category': getattr(result, 'category', None),
                        'image_url': getattr(result, 'image_url', None),
                        'datasheet_url': getattr(result, 'datasheet_url', None),
                        'unit_price': getattr(result, 'unit_price', None),
                        'stock_quantity': getattr(result, 'stock_quantity', None),
                        'stock_status': getattr(result, 'stock_status', None),
                        'in_stock': getattr(result, 'in_stock', False),
                        'rohs_compliant': getattr(result, 'rohs_compliant', None),
                        'lifecycle_status': getattr(result, 'lifecycle_status', None),
                        'specifications': getattr(result, 'specifications', {}),
                    }
                    supplier_results.append((supplier_name, raw_data))
            else:
                logger.info(f"[Catalog API] {supplier_name} returned no results for '{q}'")

        except Exception as e:
            logger.warning(f"[Catalog API] Supplier {supplier_name} query failed: {e}")
            # Continue with other suppliers

    if not supplier_results:
        logger.info(f"[Catalog API] No supplier results found for: '{q}'")
        return DashboardSearchResponse(
            results=[],
            total=0,
            facets=None
        )

    # Step 3: Normalize and deduplicate supplier results
    logger.info(f"[Catalog API] Normalizing {len(supplier_results)} supplier results")

    normalized = []
    seen_keys = set()

    for supplier_name, raw_data in supplier_results:
        # Deduplicate by MPN+Manufacturer
        mpn = raw_data.get('mpn', '').strip().lower()
        mfg = raw_data.get('manufacturer', '').strip().lower()
        key = f"{mpn}|{mfg}"

        if key in seen_keys:
            logger.debug(f"[Catalog API] Skipping duplicate: {mpn} ({mfg})")
            continue

        seen_keys.add(key)

        try:
            normalized_result = _normalize_supplier_result(raw_data, supplier_name)
            normalized.append(normalized_result)
        except Exception as e:
            logger.warning(f"[Catalog API] Failed to normalize result from {supplier_name}: {e}")

    logger.info(f"[Catalog API] Normalized {len(normalized)} unique results from suppliers")

    # Step 4: Save to catalog if requested
    if save_to_catalog and normalized:
        logger.info(f"[Catalog API] Saving {len(normalized)} components to catalog")

        # Get components database session
        dual_db = get_dual_database()
        components_db = None

        try:
            components_db = next(dual_db.get_session("components"))
            saved_components = _save_to_component_catalog(components_db, normalized)
            logger.info(f"[Catalog API] Saved {len(saved_components)}/{len(normalized)} components to catalog")
        except Exception as e:
            logger.error(f"[Catalog API] Failed to save components to catalog: {e}", exc_info=True)
        finally:
            if components_db:
                components_db.close()

    return DashboardSearchResponse(
        results=normalized,
        total=len(normalized),
        facets=None
    )


# ============================================================================
# Dashboard Components List Endpoint (for Customer Portal)
# ============================================================================

class ComponentListItem(BaseModel):
    """Component list item for dashboard display"""
    id: str
    mpn: str
    manufacturer: str
    description: Optional[str] = None
    category: Optional[str] = None
    package: Optional[str] = None
    status: str = "pending"  # 'enriched', 'pending', 'failed'
    qualityScore: Optional[float] = None
    lifecycle: Optional[str] = None
    createdAt: Optional[str] = None


class ComponentListResponse(BaseModel):
    """Response for component listing"""
    data: List[ComponentListItem]
    total: int


@router.get("/components", response_model=ComponentListResponse)
def list_components(
    organization_id: Optional[str] = Query(None, description="Filter by organization ID"),
    workspace_id: Optional[str] = Query(None, description="Filter by workspace ID"),
    search: Optional[str] = Query(None, description="Search query for MPN, manufacturer, or description"),
    status: Optional[str] = Query(None, description="Filter by status: enriched, pending, failed"),
    page: int = Query(1, description="Page number", ge=1),
    limit: int = Query(20, description="Results per page", ge=1, le=100),
    auth: Optional["AuthContext"] = Depends(get_optional_auth_context),
):
    """
    List components for the customer portal dashboard.

    This endpoint returns components from the component_catalog table,
    formatted for the dashboard's ComponentSearchTab.

    Args:
        organization_id: Filter by organization (tenant)
        workspace_id: Filter by workspace
        search: Optional search query
        status: Filter by enrichment status
        page: Page number (1-indexed)
        limit: Results per page

    Returns:
        ComponentListResponse with list of components and total count
    """
    logger.info(f"[Catalog API] List components - org: {organization_id}, workspace: {workspace_id}, search: {search}, status: {status}")

    # Get components database connection
    dual_db = get_dual_database()
    components_db = None

    try:
        components_db = next(dual_db.get_session("components"))

        # Build query - search in component_catalog
        where_clauses = ["1=1"]
        params: Dict[str, Any] = {}

        # Search filter
        if search:
            _validate_string_length(search, "search", MAX_QUERY_LENGTH)
            where_clauses.append("""
                (LOWER(manufacturer_part_number) LIKE LOWER(:search)
                 OR LOWER(manufacturer) LIKE LOWER(:search)
                 OR LOWER(description) LIKE LOWER(:search))
            """)
            params["search"] = f"%{search}%"

        # Status filter - map to quality_score ranges
        if status:
            if status == "enriched":
                where_clauses.append("quality_score >= 60")
            elif status == "pending":
                where_clauses.append("quality_score < 60 AND quality_score >= 0")
            elif status == "failed":
                where_clauses.append("quality_score IS NULL OR quality_score < 0")

        where_sql = " AND ".join(where_clauses)

        # Count query
        count_sql = f"SELECT COUNT(*) FROM component_catalog WHERE {where_sql}"
        count_result = components_db.execute(text(count_sql), params).scalar()
        total = count_result or 0

        # Fetch query with pagination
        offset = (page - 1) * limit
        select_sql = f"""
            SELECT
                id,
                manufacturer_part_number as mpn,
                manufacturer,
                description,
                category,
                package,
                quality_score,
                lifecycle_status,
                created_at
            FROM component_catalog
            WHERE {where_sql}
            ORDER BY created_at DESC NULLS LAST
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = limit
        params["offset"] = offset

        results = components_db.execute(text(select_sql), params).fetchall()

        # Convert to response format
        items = []
        for row in results:
            row_dict = dict(row._mapping)

            # Determine status from quality_score
            quality = row_dict.get("quality_score")
            if quality is None or quality < 0:
                status_val = "failed"
            elif quality >= 60:
                status_val = "enriched"
            else:
                status_val = "pending"

            items.append(ComponentListItem(
                id=str(row_dict.get("id", "")),
                mpn=row_dict.get("mpn") or "",
                manufacturer=row_dict.get("manufacturer") or "Unknown",
                description=row_dict.get("description"),
                category=row_dict.get("category"),
                package=row_dict.get("package"),
                status=status_val,
                qualityScore=float(quality) if quality is not None else None,
                lifecycle=row_dict.get("lifecycle_status"),
                createdAt=row_dict["created_at"].isoformat() if row_dict.get("created_at") else None,
            ))

        logger.info(f"[Catalog API] Returning {len(items)} of {total} components")

        return ComponentListResponse(data=items, total=total)

    except Exception as e:
        logger.error(f"[Catalog API] Error listing components: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error listing components: {str(e)}")
    finally:
        if components_db:
            components_db.close()


# ============================================================================
# My Components Endpoint - Scoped by Workspace/Project/BOM
# ============================================================================
# This endpoint queries bom_line_items from Supabase, scoped to the user's
# workspace, project, and/or BOM. Unlike /catalog/browse and /catalog/search
# which query the global component_catalog, this returns components that
# are specifically in the user's BOMs.

def _bom_line_item_to_search_result(row: dict) -> DashboardSearchResult:
    """Convert bom_line_item row to DashboardSearchResult format.

    The row may be enriched with data from component_catalog if component_id was available.
    Fields directly in row take precedence over nested specs/pricing data.
    """
    # Determine enrichment status from bom_line_items.enrichment_status
    enrichment_status = row.get("enrichment_status", "pending") or "pending"

    # Map enrichment_status to the expected format
    status_map = {
        "matched": "production",
        "enriched": "production",
        "completed": "production",
        "partial": "staging",
        "pending": "pending",
        "failed": "pending",
        "error": "pending",
    }
    mapped_status = status_map.get(enrichment_status.lower(), "pending")

    # Determine in_stock from pricing/metadata if available
    # NOTE: pricing can be a list of price tiers, not a dict
    raw_pricing = row.get("pricing")
    pricing = raw_pricing if isinstance(raw_pricing, dict) else {}
    # If pricing is a list of price tiers, extract from first tier
    if isinstance(raw_pricing, list) and raw_pricing:
        pricing = raw_pricing[0] if isinstance(raw_pricing[0], dict) else {}

    # Stock info - check row first (from catalog enrichment), then pricing
    stock_qty = row.get("stock_quantity") or pricing.get("stock_quantity")
    stock_status = row.get("stock_status") or pricing.get("stock_status")
    in_stock = (stock_qty and stock_qty > 0) or (stock_status and "stock" in str(stock_status).lower())

    # Get specifications - ensure it's a dict, not a list
    raw_specs = row.get("specifications")
    specs = raw_specs if isinstance(raw_specs, dict) else {}

    # Get compliance from specs or compliance_status - ensure it's a dict
    raw_compliance = row.get("compliance_status")
    compliance = raw_compliance if isinstance(raw_compliance, dict) else {}

    # Quality score: prefer catalog quality_score, fallback to match_confidence
    quality_score = row.get("quality_score")
    if quality_score is None:
        quality_score = float(row.get("match_confidence") or 0) if row.get("match_confidence") else 0
    else:
        quality_score = float(quality_score)

    # Data sources - include enrichment source if from catalog
    data_sources = ["bom_upload"]
    if row.get("catalog_enriched") and row.get("enrichment_source"):
        data_sources.append(row.get("enrichment_source"))

    return DashboardSearchResult(
        mpn=row.get("manufacturer_part_number") or row.get("enriched_mpn") or "",
        manufacturer=row.get("manufacturer") or row.get("enriched_manufacturer") or "Unknown",
        # Category: prefer direct field (from catalog), then specs, then fallback
        category=row.get("category") or specs.get("category") or "",
        description=row.get("description") or specs.get("description") or "",
        quality_score=quality_score,
        enrichment_status=mapped_status,
        data_sources=data_sources,
        last_updated=row["updated_at"].isoformat() if row.get("updated_at") else (row["created_at"].isoformat() if row.get("created_at") else ""),
        risk=None,  # Risk can be added later
        # ALWAYS use bom_line_items.id for My Components - the detail endpoint looks up by li.id
        component_id=str(row.get("id")),
        # Extended fields - prefer direct (from catalog enrichment), then specs
        package=row.get("package") or specs.get("package"),
        subcategory=row.get("subcategory") or specs.get("subcategory"),
        lifecycle_status=row.get("lifecycle_status") or specs.get("lifecycle_status"),
        image_url=row.get("image_url") or specs.get("image_url"),
        datasheet_url=row.get("datasheet_url") or specs.get("datasheet_url"),
        model_3d_url=row.get("model_3d_url") or specs.get("model_3d_url"),
        # Compliance - prefer direct (from catalog), then compliance dict
        rohs_compliant=row.get("rohs_compliant") if row.get("rohs_compliant") is not None else compliance.get("rohs_compliant"),
        reach_compliant=row.get("reach_compliant") if row.get("reach_compliant") is not None else compliance.get("reach_compliant"),
        aec_qualified=row.get("aec_qualified") if row.get("aec_qualified") is not None else compliance.get("aec_qualified"),
        halogen_free=row.get("halogen_free") if row.get("halogen_free") is not None else compliance.get("halogen_free"),
        # Pricing - prefer direct (from catalog), then pricing dict
        unit_price=float(row.get("unit_price")) if row.get("unit_price") else (float(pricing.get("unit_price")) if pricing.get("unit_price") else None),
        currency=row.get("currency") or pricing.get("currency"),
        moq=row.get("moq") or pricing.get("moq"),
        lead_time_days=row.get("lead_time_days") or pricing.get("lead_time_days"),
        stock_status=stock_status,
        stock_quantity=stock_qty,
        in_stock=in_stock,
        specifications=specs if specs else None,
    )


@router.get("/my-components", response_model=DashboardSearchResponse)
def get_my_components(
    # Required scoping parameters
    organization_id: str = Query(..., description="Organization ID (tenant)"),
    # Optional scope refinement
    workspace_id: Optional[str] = Query(None, description="Filter by workspace ID"),
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    bom_id: Optional[str] = Query(None, description="Filter by specific BOM ID"),
    # Search parameters
    query: Optional[str] = Query(None, description="Search query (MPN, manufacturer, description)", max_length=MAX_QUERY_LENGTH),
    search_type: str = Query("all", description="Search type: all, mpn, manufacturer, description"),
    # Pagination
    limit: int = Query(50, description="Maximum results", ge=1, le=500),
    offset: int = Query(0, description="Offset for pagination", ge=0),
    # Filters (similar to /browse and /search)
    categories: Optional[List[str]] = Query(None, description="Filter by categories"),
    manufacturers: Optional[List[str]] = Query(None, description="Filter by manufacturers"),
    lifecycle_statuses: Optional[List[str]] = Query(None, description="Filter by lifecycle status"),
    enrichment_status: Optional[str] = Query(None, description="Filter by enrichment status"),
    # Quality Score filters
    quality_score_min: Optional[float] = Query(None, description="Minimum quality score (0-100)", ge=0, le=100),
    quality_score_max: Optional[float] = Query(None, description="Maximum quality score (0-100)", ge=0, le=100),
    # Compliance filters
    rohs_compliant: Optional[bool] = Query(None, description="Filter RoHS compliant components"),
    reach_compliant: Optional[bool] = Query(None, description="Filter REACH compliant components"),
    aec_qualified: Optional[bool] = Query(None, description="Filter AEC-Q qualified components"),
    halogen_free: Optional[bool] = Query(None, description="Filter halogen-free components"),
    # Stock filter
    in_stock_only: Optional[bool] = Query(None, description="Only show in-stock components"),
    sort_by: str = Query("updated_at", description="Sort by: updated_at, mpn, manufacturer, quantity"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    include_facets: bool = Query(True, description="Include facet aggregations"),
    auth: Optional["AuthContext"] = Depends(get_optional_auth_context),
):
    """
    Get components from user's BOMs (My Components) - scoped by workspace/project/BOM.

    Unlike /catalog/browse and /catalog/search which query the global component_catalog,
    this endpoint queries bom_line_items from Supabase, scoped to the user's BOMs.

    The scoping hierarchy:
    - organization_id (required): Base tenant isolation
    - workspace_id (optional): Filter to specific workspace
    - project_id (optional): Filter to specific project within workspace
    - bom_id (optional): Filter to specific BOM within project

    Returns:
        DashboardSearchResponse with components from user's BOMs
    """
    logger.info(
        f"[Catalog API] My Components - org={organization_id}, workspace={workspace_id}, "
        f"project={project_id}, bom={bom_id}, query={query}, limit={limit}"
    )

    # Validate sort parameters
    if sort_order.lower() not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="sort_order must be 'asc' or 'desc'")
    sort_order = sort_order.lower()

    sort_field_map = {
        "updated_at": "li.updated_at",
        "created_at": "li.created_at",
        "mpn": "li.manufacturer_part_number",
        "manufacturer": "li.manufacturer",
        "quantity": "li.quantity",
        "enrichment_status": "li.enrichment_status",
    }

    if sort_by not in sort_field_map:
        raise HTTPException(status_code=400, detail=f"sort_by must be one of: {', '.join(sort_field_map.keys())}")

    # Get Supabase database connection
    dual_db = get_dual_database()
    supabase_db = None

    try:
        supabase_db = dual_db.SupabaseSession()

        # Build WHERE clauses with proper scoping via JOINs
        # Join chain: bom_line_items -> boms -> projects -> workspaces (for org_id check)
        where_clauses = ["b.organization_id = :organization_id"]
        params: Dict[str, Any] = {"organization_id": organization_id}

        # Apply scope filters
        if workspace_id:
            # Validate workspace_id belongs to org via projects table
            where_clauses.append("p.workspace_id = :workspace_id")
            params["workspace_id"] = workspace_id

        if project_id:
            where_clauses.append("b.project_id = :project_id")
            params["project_id"] = project_id

        if bom_id:
            where_clauses.append("li.bom_id = :bom_id")
            params["bom_id"] = bom_id

        # Search filter
        if query:
            _validate_string_length(query, "query", MAX_QUERY_LENGTH)
            search_filter = f"%{query}%"
            params["search_filter"] = search_filter

            if search_type == "all":
                where_clauses.append("""(
                    li.manufacturer_part_number ILIKE :search_filter
                    OR li.manufacturer ILIKE :search_filter
                    OR li.description ILIKE :search_filter
                )""")
            elif search_type == "mpn":
                where_clauses.append("li.manufacturer_part_number ILIKE :search_filter")
            elif search_type == "manufacturer":
                where_clauses.append("li.manufacturer ILIKE :search_filter")
            else:  # description
                where_clauses.append("li.description ILIKE :search_filter")

        # Category filter (from specifications JSONB)
        if categories:
            _validate_filter_list(categories, "categories", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
            where_clauses.append("li.specifications->>'category' = ANY(:categories)")
            params["categories"] = categories

        # Manufacturer filter
        if manufacturers:
            _validate_filter_list(manufacturers, "manufacturers", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
            where_clauses.append("li.manufacturer = ANY(:manufacturers)")
            params["manufacturers"] = manufacturers

        # Lifecycle status filter
        if lifecycle_statuses:
            _validate_filter_list(lifecycle_statuses, "lifecycle_statuses", MAX_FILTER_VALUE_LENGTH, MAX_FILTER_LIST_SIZE)
            where_clauses.append("li.lifecycle_status = ANY(:lifecycle_statuses)")
            params["lifecycle_statuses"] = lifecycle_statuses

        # Enrichment status filter
        if enrichment_status:
            where_clauses.append("li.enrichment_status = :enrichment_status")
            params["enrichment_status"] = enrichment_status

        # Quality score filters (match_confidence is stored as percentage 0-100)
        if quality_score_min is not None:
            where_clauses.append("COALESCE(li.match_confidence, 0) >= :quality_score_min")
            params["quality_score_min"] = quality_score_min

        if quality_score_max is not None:
            where_clauses.append("COALESCE(li.match_confidence, 0) <= :quality_score_max")
            params["quality_score_max"] = quality_score_max

        # Compliance filters - check compliance_status JSONB or specifications JSONB
        if rohs_compliant is not None:
            if rohs_compliant:
                where_clauses.append("""(
                    (li.compliance_status->>'rohs_compliant')::boolean = true
                    OR li.specifications->>'rohs_status' ILIKE '%compliant%'
                    OR li.specifications->>'rohs_status' ILIKE '%yes%'
                )""")
            else:
                where_clauses.append("""(
                    (li.compliance_status->>'rohs_compliant')::boolean = false
                    OR li.compliance_status->>'rohs_compliant' IS NULL
                )""")

        if reach_compliant is not None:
            if reach_compliant:
                where_clauses.append("""(
                    (li.compliance_status->>'reach_compliant')::boolean = true
                    OR li.specifications->>'reach_status' ILIKE '%compliant%'
                    OR li.specifications->>'reach_status' ILIKE '%yes%'
                )""")
            else:
                where_clauses.append("""(
                    (li.compliance_status->>'reach_compliant')::boolean = false
                    OR li.compliance_status->>'reach_compliant' IS NULL
                )""")

        if aec_qualified is not None:
            if aec_qualified:
                where_clauses.append("""(
                    (li.compliance_status->>'aec_qualified')::boolean = true
                    OR li.specifications->>'aec_q_status' ILIKE '%qualified%'
                    OR li.specifications->>'aec_q_status' ILIKE '%yes%'
                )""")
            else:
                where_clauses.append("""(
                    (li.compliance_status->>'aec_qualified')::boolean = false
                    OR li.compliance_status->>'aec_qualified' IS NULL
                )""")

        if halogen_free is not None:
            if halogen_free:
                where_clauses.append("""(
                    (li.compliance_status->>'halogen_free')::boolean = true
                    OR li.specifications->>'halogen_free' ILIKE '%true%'
                    OR li.specifications->>'halogen_free' ILIKE '%yes%'
                )""")
            else:
                where_clauses.append("""(
                    (li.compliance_status->>'halogen_free')::boolean = false
                    OR li.compliance_status->>'halogen_free' IS NULL
                )""")

        # In-stock filter - check pricing JSONB for stock info
        if in_stock_only:
            where_clauses.append("""(
                (li.pricing->>'stock')::int > 0
                OR (li.pricing->'suppliers'->0->>'stock')::int > 0
                OR li.specifications->>'availability' ILIKE '%in stock%'
            )""")

        where_sql = " AND ".join(where_clauses)

        # Build ORDER BY
        order_by = f"{sort_field_map[sort_by]} {sort_order.upper()} NULLS LAST"

        # Main query with JOINs for scoping
        select_sql = f"""
            SELECT
                li.id,
                li.bom_id,
                li.line_number,
                li.manufacturer_part_number,
                li.manufacturer,
                li.description,
                li.quantity,
                li.component_id,
                li.enrichment_status,
                li.enriched_mpn,
                li.enriched_manufacturer,
                li.specifications,
                li.datasheet_url,
                li.lifecycle_status,
                li.compliance_status,
                li.pricing,
                li.unit_price,
                li.match_confidence,
                li.risk_level,
                li.created_at,
                li.updated_at,
                b.name as bom_name,
                p.name as project_name
            FROM bom_line_items li
            INNER JOIN boms b ON li.bom_id = b.id
            INNER JOIN projects p ON b.project_id = p.id
            WHERE {where_sql}
            ORDER BY {order_by}
            LIMIT :limit OFFSET :offset
        """

        # Count query
        count_sql = f"""
            SELECT COUNT(*)
            FROM bom_line_items li
            INNER JOIN boms b ON li.bom_id = b.id
            INNER JOIN projects p ON b.project_id = p.id
            WHERE {where_sql}
        """

        # Execute queries
        params["limit"] = limit
        params["offset"] = offset

        results = supabase_db.execute(text(select_sql), params).fetchall()

        # Get total count (without limit/offset)
        count_params = {k: v for k, v in params.items() if k not in ['limit', 'offset']}
        total_result = supabase_db.execute(text(count_sql), count_params).fetchone()
        total = total_result[0] if total_result else 0

        # Convert results to dict format for processing
        row_dicts = []
        for row in results:
            row_dicts.append(dict(row._mapping))

        # Enrich descriptions from component_catalog for rows missing descriptions
        # Since bom_line_items and component_catalog are in different databases,
        # we need to do a separate lookup for items without descriptions
        rows_needing_desc = [
            r for r in row_dicts
            if not r.get("description") and not (r.get("specifications") or {}).get("description")
        ]

        if rows_needing_desc:
            try:
                # Get components database session for catalog lookup
                components_db = next(dual_db.get_session("components"))

                # Build a lookup query for all MPNs that need descriptions
                mpn_list = [
                    (r.get("manufacturer_part_number") or r.get("enriched_mpn"), r.get("manufacturer") or r.get("enriched_manufacturer"))
                    for r in rows_needing_desc
                    if r.get("manufacturer_part_number") or r.get("enriched_mpn")
                ]

                if mpn_list:
                    # Query component_catalog for descriptions
                    # Use case-insensitive matching for better hit rate
                    catalog_lookup_sql = text("""
                        SELECT manufacturer_part_number, manufacturer, description
                        FROM component_catalog
                        WHERE LOWER(manufacturer_part_number) = ANY(:mpns)
                        AND description IS NOT NULL AND description != ''
                    """)
                    mpns_lower = [mpn[0].lower() for mpn in mpn_list if mpn[0]]
                    catalog_results = components_db.execute(catalog_lookup_sql, {"mpns": mpns_lower}).fetchall()

                    # Build lookup dict (lowercase MPN -> description)
                    catalog_desc_map = {
                        r._mapping["manufacturer_part_number"].lower(): r._mapping["description"]
                        for r in catalog_results
                    }

                    # Apply catalog descriptions to rows missing descriptions
                    for row_dict in row_dicts:
                        if not row_dict.get("description") and not (row_dict.get("specifications") or {}).get("description"):
                            mpn = (row_dict.get("manufacturer_part_number") or row_dict.get("enriched_mpn") or "").lower()
                            if mpn in catalog_desc_map:
                                row_dict["description"] = catalog_desc_map[mpn]

                    logger.info(f"[Catalog API] My Components - enriched {len(catalog_desc_map)} descriptions from catalog")

                components_db.close()
            except Exception as e:
                logger.warning(f"[Catalog API] My Components - catalog description lookup failed: {e}")

        # Convert to DashboardSearchResult format
        search_results = []
        for row_dict in row_dicts:
            search_results.append(_bom_line_item_to_search_result(row_dict))

        # Fetch facets if requested
        facets = None
        if include_facets:
            facets = SearchFacets()

            try:
                # Manufacturers facet
                mfg_sql = text(f"""
                    SELECT li.manufacturer as value, COUNT(*) as count
                    FROM bom_line_items li
                    INNER JOIN boms b ON li.bom_id = b.id
                    INNER JOIN projects p ON b.project_id = p.id
                    WHERE {where_sql} AND li.manufacturer IS NOT NULL
                    GROUP BY li.manufacturer
                    ORDER BY count DESC
                    LIMIT 50
                """)
                mfg_results = supabase_db.execute(mfg_sql, count_params).fetchall()
                facets.manufacturers = [
                    SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
                    for r in mfg_results
                ]

                # Categories facet (from specifications JSONB)
                cat_sql = text(f"""
                    SELECT li.specifications->>'category' as value, COUNT(*) as count
                    FROM bom_line_items li
                    INNER JOIN boms b ON li.bom_id = b.id
                    INNER JOIN projects p ON b.project_id = p.id
                    WHERE {where_sql} AND li.specifications->>'category' IS NOT NULL
                    GROUP BY li.specifications->>'category'
                    ORDER BY count DESC
                    LIMIT 50
                """)
                cat_results = supabase_db.execute(cat_sql, count_params).fetchall()
                facets.categories = [
                    SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
                    for r in cat_results
                ]

                # Lifecycle status facet
                lc_sql = text(f"""
                    SELECT li.lifecycle_status as value, COUNT(*) as count
                    FROM bom_line_items li
                    INNER JOIN boms b ON li.bom_id = b.id
                    INNER JOIN projects p ON b.project_id = p.id
                    WHERE {where_sql} AND li.lifecycle_status IS NOT NULL
                    GROUP BY li.lifecycle_status
                    ORDER BY count DESC
                """)
                lc_results = supabase_db.execute(lc_sql, count_params).fetchall()
                facets.lifecycle_statuses = [
                    SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
                    for r in lc_results
                ]

                # Data sources facet (based on enrichment_status)
                ds_sql = text(f"""
                    SELECT li.enrichment_status as value, COUNT(*) as count
                    FROM bom_line_items li
                    INNER JOIN boms b ON li.bom_id = b.id
                    INNER JOIN projects p ON b.project_id = p.id
                    WHERE {where_sql} AND li.enrichment_status IS NOT NULL
                    GROUP BY li.enrichment_status
                    ORDER BY count DESC
                """)
                ds_results = supabase_db.execute(ds_sql, count_params).fetchall()
                facets.data_sources = [
                    SearchFacet(value=r._mapping["value"], label=r._mapping["value"], count=r._mapping["count"])
                    for r in ds_results
                ]
            except Exception as e:
                logger.warning(f"[Catalog API] My Components facet aggregation failed: {e}")

        logger.info(f"[Catalog API] My Components - returning {len(search_results)}/{total} results")

        return DashboardSearchResponse(
            results=search_results,
            total=total,
            risk_enriched=False,
            facets=facets,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Catalog API] My Components error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching my components: {str(e)}")
    finally:
        if supabase_db:
            supabase_db.close()


@router.get("/my-components/{line_item_id}", response_model=DashboardSearchResult)
def get_my_component_by_id(
    line_item_id: str,
    organization_id: Optional[str] = Query(None, description="Organization/tenant ID for access control"),
    auth: Optional["AuthContext"] = Depends(get_optional_auth_context),
):
    """
    Get a single BOM line item by ID (for My Components detail view)

    This endpoint is used when viewing details of a component from My Components.
    Unlike the global catalog, My Components items come from bom_line_items table.

    Args:
        line_item_id: BOM line item UUID
        organization_id: Required for multi-tenant access control

    Returns:
        BOM line item details in DashboardSearchResult format
    """
    # Validate ID format
    if not line_item_id or not line_item_id.strip():
        raise HTTPException(status_code=400, detail="Line item ID is required")

    line_item_id = line_item_id.strip()
    if not UUID_PATTERN.match(line_item_id):
        raise HTTPException(status_code=400, detail="Invalid line item ID format. Must be a valid UUID.")

    # Organization ID required for tenant isolation
    if not organization_id:
        raise HTTPException(status_code=400, detail="organization_id is required")

    if not UUID_PATTERN.match(organization_id):
        raise HTTPException(status_code=400, detail="Invalid organization_id format")

    logger.info(f"[Catalog API] Fetching BOM line item by ID: {line_item_id} for org {organization_id}")

    # Get dual database connection
    dual_db = get_dual_database()

    supabase_db = None
    try:
        supabase_db = next(dual_db.get_session("supabase"))

        # Query bom_line_items with org access control through project->workspace hierarchy
        # Also fetch component_id for catalog enrichment
        sql = text("""
            SELECT
                li.id,
                li.bom_id,
                li.manufacturer_part_number,
                li.enriched_mpn,
                li.manufacturer,
                li.enriched_manufacturer,
                li.description,
                li.quantity,
                li.reference_designator,
                li.unit_price,
                li.specifications,
                li.lifecycle_status,
                li.enrichment_status,
                li.datasheet_url,
                li.pricing,
                li.match_confidence,
                li.component_id,
                li.created_at,
                li.updated_at,
                b.name as bom_name,
                p.name as project_name,
                p.workspace_id
            FROM bom_line_items li
            INNER JOIN boms b ON li.bom_id = b.id
            INNER JOIN projects p ON b.project_id = p.id
            INNER JOIN workspaces w ON p.workspace_id = w.id
            WHERE li.id = :line_item_id
            AND w.organization_id = :organization_id
        """)

        result = supabase_db.execute(sql, {
            "line_item_id": line_item_id,
            "organization_id": organization_id
        }).fetchone()

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"BOM line item not found or access denied"
            )

        row_dict = dict(result._mapping)

        # Enrich from component_catalog if component_id is available
        # This fetches all enriched data from the Central Component Vault
        component_id = row_dict.get("component_id")
        if component_id:
            try:
                components_db = next(dual_db.get_session("components"))
                catalog_sql = text("""
                    SELECT
                        description,
                        category,
                        subcategory,
                        category_path,
                        product_family,
                        product_series,
                        package,
                        lifecycle_status,
                        risk_level,
                        rohs_compliant,
                        reach_compliant,
                        halogen_free,
                        aec_qualified,
                        eccn_code,
                        datasheet_url,
                        image_url,
                        model_3d_url,
                        unit_price,
                        currency,
                        moq,
                        lead_time_days,
                        stock_status,
                        quality_score,
                        enrichment_source,
                        supplier_data
                    FROM component_catalog
                    WHERE id = :component_id
                    LIMIT 1
                """)
                catalog_result = components_db.execute(catalog_sql, {"component_id": str(component_id)}).fetchone()
                if catalog_result:
                    catalog_data = dict(catalog_result._mapping)
                    logger.info(f"[Catalog API] Enriching from catalog component {component_id}")
                    # Merge catalog data into row_dict, preferring catalog values for missing fields
                    for key, value in catalog_data.items():
                        if value is not None:
                            # Only override if row_dict doesn't have a value
                            if key not in row_dict or row_dict.get(key) is None:
                                row_dict[key] = value
                            # Special handling: always use catalog quality_score if available
                            elif key == "quality_score":
                                row_dict[key] = value
                    # Also set catalog_enriched flag for debugging
                    row_dict["catalog_enriched"] = True
                    row_dict["enrichment_source"] = catalog_data.get("enrichment_source")
                components_db.close()
            except Exception as e:
                logger.warning(f"[Catalog API] Catalog enrichment by component_id failed: {e}")
        # Fallback: try MPN-based lookup if no component_id or enrichment failed
        elif not row_dict.get("description") and not (row_dict.get("specifications") or {}).get("description"):
            try:
                components_db = next(dual_db.get_session("components"))
                mpn = (row_dict.get("manufacturer_part_number") or row_dict.get("enriched_mpn") or "").lower()
                if mpn:
                    catalog_sql = text("""
                        SELECT description FROM component_catalog
                        WHERE LOWER(manufacturer_part_number) = :mpn
                        AND description IS NOT NULL AND description != ''
                        LIMIT 1
                    """)
                    catalog_result = components_db.execute(catalog_sql, {"mpn": mpn}).fetchone()
                    if catalog_result:
                        row_dict["description"] = catalog_result._mapping["description"]
                        logger.info(f"[Catalog API] Enriched description from catalog for {mpn}")
                components_db.close()
            except Exception as e:
                logger.warning(f"[Catalog API] Catalog description lookup failed: {e}")

        # Convert to DashboardSearchResult format
        search_result = _bom_line_item_to_search_result(row_dict)

        logger.info(f"[Catalog API] Found BOM line item: {line_item_id}")
        return search_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Catalog API] Error fetching BOM line item {line_item_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching component: {str(e)}")
    finally:
        if supabase_db:
            supabase_db.close()
