"""
Central Catalog API - Search and CRUD functionality for catalog tables

This provides API endpoints for:
- Component search with full-text and filter capabilities
- Manufacturer, Supplier, Category management
- Pricing and compliance data access
"""

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from typing import Dict, List, Any, Optional


# =============================================================================
# DATABASE HELPER FUNCTIONS
# =============================================================================

def dictfetchall(cursor) -> List[Dict[str, Any]]:
    """Return all rows from a cursor as a dict"""
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def execute_query(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Execute a query and return results as list of dicts"""
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        return dictfetchall(cursor)


# =============================================================================
# COMPONENT SEARCH API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def search_components(request):
    """
    Search components in the central catalog

    Query params:
    - q: Search query (searches mpn, manufacturer, description)
    - manufacturer: Filter by manufacturer
    - category: Filter by category
    - lifecycle_status: Filter by lifecycle status (Active, NRND, EOL, Obsolete)
    - limit: Number of results (default 50, max 500)
    - offset: Offset for pagination

    Returns:
    {
        "results": [...],
        "total": 123,
        "limit": 50,
        "offset": 0
    }
    """
    # Parse query parameters
    search_query = request.GET.get('q', '')
    manufacturer = request.GET.get('manufacturer', '')
    category = request.GET.get('category', '')
    lifecycle_status = request.GET.get('lifecycle_status', '')

    # Safely parse pagination parameters to avoid ValueError bubbling as 500s
    try:
        raw_limit = request.GET.get('limit', '50')
        raw_offset = request.GET.get('offset', '0')
        limit = int(raw_limit)
        offset = int(raw_offset)
    except ValueError:
        return JsonResponse(
            {
                'error': 'Invalid pagination parameters',
                'detail': 'limit and offset must be integers',
            },
            status=400,
        )

    # Enforce sane bounds
    if limit <= 0:
        limit = 50
    limit = min(limit, 500)
    if offset < 0:
        offset = 0

    # Build WHERE clause
    where_clauses = []
    params = []

    if search_query:
        where_clauses.append("""
            (mpn ILIKE %s OR manufacturer ILIKE %s OR description ILIKE %s)
        """)
        search_pattern = f"%{search_query}%"
        params.extend([search_pattern, search_pattern, search_pattern])

    if manufacturer:
        where_clauses.append("manufacturer ILIKE %s")
        params.append(f"%{manufacturer}%")

    if category:
        where_clauses.append("category ILIKE %s")
        params.append(f"%{category}%")

    if lifecycle_status:
        where_clauses.append("lifecycle_status = %s")
        params.append(lifecycle_status)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Get total count
    count_query = f"""
        SELECT COUNT(*) as total
        FROM catalog_components
        WHERE {where_sql}
    """
    count_result = execute_query(count_query, tuple(params))
    total = count_result[0]['total'] if count_result else 0

    # Get results
    results_query = f"""
        SELECT
            id, mpn, manufacturer, category, description,
            datasheet_url, image_url, lifecycle_status,
            specifications, created_at, updated_at
        FROM catalog_components
        WHERE {where_sql}
        ORDER BY
            CASE
                WHEN mpn ILIKE %s THEN 1
                WHEN manufacturer ILIKE %s THEN 2
                ELSE 3
            END,
            mpn ASC
        LIMIT %s OFFSET %s
    """

    # Add ordering params
    search_pattern = f"%{search_query}%" if search_query else "%"
    results_params = list(params) + [search_pattern, search_pattern, limit, offset]

    results = execute_query(results_query, tuple(results_params))

    return JsonResponse({
        'results': results,
        'total': total,
        'limit': limit,
        'offset': offset,
        'has_more': (offset + limit) < total
    })


# =============================================================================
# COMPONENT CRUD API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_component(request, component_id: int):
    """Get a single component by ID with pricing and compliance data"""
    query = """
        SELECT
            c.*,
            comp.rohs_compliant, comp.reach_compliant, comp.reach_svhc_count,
            comp.eccn_code, comp.hts_code, comp.country_of_origin
        FROM catalog_components c
        LEFT JOIN catalog_component_compliance comp ON c.id = comp.component_id
        WHERE c.id = %s
    """
    results = execute_query(query, (component_id,))

    if not results:
        return JsonResponse({'error': 'Component not found'}, status=404)

    component = results[0]

    # Get pricing data
    pricing_query = """
        SELECT supplier, price, quantity_break, currency, updated_at
        FROM catalog_component_pricing
        WHERE component_id = %s
        ORDER BY quantity_break ASC
    """
    component['pricing'] = execute_query(pricing_query, (component_id,))

    return JsonResponse(component)


@csrf_exempt
@require_http_methods(["POST"])
def create_component(request):
    """Create a new component"""
    try:
        data = json.loads(request.body)

        query = """
            INSERT INTO catalog_components
            (mpn, manufacturer, category, description, datasheet_url, image_url, lifecycle_status, specifications)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, mpn, manufacturer, category, created_at
        """

        params = (
            data.get('mpn'),
            data.get('manufacturer'),
            data.get('category'),
            data.get('description'),
            data.get('datasheet_url'),
            data.get('image_url'),
            data.get('lifecycle_status', 'Active'),
            json.dumps(data.get('specifications', {}))
        )

        results = execute_query(query, params)

        if results:
            return JsonResponse({'success': True, 'component': results[0]}, status=201)
        else:
            return JsonResponse({'error': 'Failed to create component'}, status=500)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# =============================================================================
# MANUFACTURER API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def list_manufacturers(request):
    """List all manufacturers"""
    query = """
        SELECT id, name, website, created_at
        FROM catalog_manufacturers
        ORDER BY name ASC
    """
    results = execute_query(query)
    return JsonResponse({'manufacturers': results})


# =============================================================================
# SUPPLIER API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def list_suppliers(request):
    """List all suppliers"""
    query = """
        SELECT id, name, website, api_enabled, created_at
        FROM catalog_suppliers
        ORDER BY name ASC
    """
    results = execute_query(query)
    return JsonResponse({'suppliers': results})


# =============================================================================
# CATEGORY API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def list_categories(request):
    """List all categories with hierarchy"""
    query = """
        SELECT id, name, path, parent_id, created_at
        FROM catalog_categories
        ORDER BY path ASC
    """
    results = execute_query(query)
    return JsonResponse({'categories': results})


# =============================================================================
# PRICING API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_component_pricing(request, component_id: int):
    """Get all pricing for a component across suppliers"""
    query = """
        SELECT
            p.id, p.supplier, p.price, p.quantity_break, p.currency, p.updated_at,
            c.mpn, c.manufacturer
        FROM catalog_component_pricing p
        JOIN catalog_components c ON p.component_id = c.id
        WHERE p.component_id = %s
        ORDER BY p.quantity_break ASC, p.price ASC
    """
    results = execute_query(query, (component_id,))

    return JsonResponse({
        'component_id': component_id,
        'pricing': results
    })


# =============================================================================
# COMPLIANCE API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_component_compliance(request, component_id: int):
    """Get compliance information for a component"""
    query = """
        SELECT
            comp.*,
            c.mpn, c.manufacturer
        FROM catalog_component_compliance comp
        JOIN catalog_components c ON comp.component_id = c.id
        WHERE comp.component_id = %s
    """
    results = execute_query(query, (component_id,))

    if not results:
        return JsonResponse({
            'component_id': component_id,
            'compliance': None,
            'message': 'No compliance data available'
        })

    return JsonResponse({
        'component_id': component_id,
        'compliance': results[0]
    })


# =============================================================================
# BULK IMPORT API (for migrating from V1)
# =============================================================================

@csrf_exempt
@require_http_methods(["POST"])
def bulk_import_components(request):
    """
    Bulk import components from V1 or external source

    Expects JSON array:
    [
        {
            "mpn": "...",
            "manufacturer": "...",
            "category": "...",
            ...
        }
    ]
    """
    try:
        data = json.loads(request.body)

        if not isinstance(data, list):
            return JsonResponse({'error': 'Expected array of components'}, status=400)

        imported = 0
        errors = []

        with connection.cursor() as cursor:
            for idx, component in enumerate(data):
                try:
                    cursor.execute("""
                        INSERT INTO catalog_components
                        (mpn, manufacturer, category, description, datasheet_url,
                         image_url, lifecycle_status, specifications)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (
                        component.get('mpn'),
                        component.get('manufacturer'),
                        component.get('category'),
                        component.get('description'),
                        component.get('datasheet_url'),
                        component.get('image_url'),
                        component.get('lifecycle_status', 'Active'),
                        json.dumps(component.get('specifications', {}))
                    ))
                    imported += cursor.rowcount
                except Exception as e:
                    errors.append({'index': idx, 'error': str(e), 'mpn': component.get('mpn')})

        return JsonResponse({
            'success': True,
            'imported': imported,
            'total': len(data),
            'errors': errors
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# =============================================================================
# STATS API
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def catalog_stats(request):
    """Get catalog statistics"""
    query = """
        SELECT
            COUNT(*) as total_components,
            COUNT(DISTINCT manufacturer) as total_manufacturers,
            COUNT(DISTINCT category) as total_categories,
            COUNT(CASE WHEN lifecycle_status = 'Active' THEN 1 END) as active_components,
            COUNT(CASE WHEN lifecycle_status = 'NRND' THEN 1 END) as nrnd_components,
            COUNT(CASE WHEN lifecycle_status = 'EOL' THEN 1 END) as eol_components,
            COUNT(CASE WHEN lifecycle_status = 'Obsolete' THEN 1 END) as obsolete_components
        FROM catalog_components
    """
    results = execute_query(query)

    # Get pricing stats
    pricing_query = """
        SELECT COUNT(*) as total_pricing_records
        FROM catalog_component_pricing
    """
    pricing_stats = execute_query(pricing_query)

    # Get compliance stats
    compliance_query = """
        SELECT
            COUNT(*) as total_compliance_records,
            COUNT(CASE WHEN rohs_compliant = TRUE THEN 1 END) as rohs_compliant_count
        FROM catalog_component_compliance
    """
    compliance_stats = execute_query(compliance_query)

    return JsonResponse({
        'catalog': results[0] if results else {},
        'pricing': pricing_stats[0] if pricing_stats else {},
        'compliance': compliance_stats[0] if compliance_stats else {}
    })
