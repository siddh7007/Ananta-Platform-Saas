"""
Temporal Activities for BOM Enrichment

Activities perform the actual work of enriching BOMs:
1. Check BOM quality
2. Match components against central catalog
3. Enrich with additional data
4. Write results to database
5. Send notifications
"""

import os
import json
import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from temporalio import activity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class QualityCheckResult:
    """Result from BOM quality check"""
    score: int  # 0-100
    total_items: int
    issues: List[str]
    passed: bool


@dataclass
class ComponentMatch:
    """Component match result"""
    bom_item_id: str
    component_id: int
    mpn: str
    manufacturer: str
    confidence: float  # 0.0-1.0


@dataclass
class EnrichedData:
    """Enriched component data"""
    bom_id: str
    items: List[Dict[str, Any]]
    stats: Dict[str, Any]


@dataclass
class WriteResult:
    """Result from writing enriched data"""
    success: bool
    items_updated: int


# ============================================================================
# Database Connections
# ============================================================================

def get_supabase_connection():
    """Get Supabase database connection"""
    return psycopg2.connect(
        host=os.getenv('SUPABASE_DB_HOST', 'components-v2-supabase-db'),
        port=os.getenv('SUPABASE_DB_PORT', '5432'),
        database=os.getenv('SUPABASE_DB_NAME', 'supabase'),
        user=os.getenv('SUPABASE_DB_USER', 'postgres'),
        password=os.getenv('SUPABASE_DB_PASSWORD', 'supabase-postgres-secure-2024'),
        cursor_factory=RealDictCursor
    )


def get_components_v2_connection():
    """Get Components V2 Postgres connection (READ ONLY)"""
    return psycopg2.connect(
        host=os.getenv('COMPONENTS_DB_HOST', 'components-v2-postgres'),
        port=os.getenv('COMPONENTS_DB_PORT', '5432'),
        database=os.getenv('COMPONENTS_DB_NAME', 'components_v2'),
        user=os.getenv('COMPONENTS_DB_USER', 'postgres'),
        password=os.getenv('COMPONENTS_DB_PASSWORD', 'postgres'),
        cursor_factory=RealDictCursor
    )


# ============================================================================
# ACTIVITY 1: Check BOM Quality
# ============================================================================

@activity.defn
async def check_bom_quality(bom_id: str) -> QualityCheckResult:
    """
    Check BOM data quality before enrichment

    Quality checks:
    - MPN present (weight: 30%)
    - Manufacturer present (weight: 25%)
    - Valid quantities (weight: 20%)
    - Reference designators present (weight: 15%)
    - Description present (weight: 10%)
    """
    activity.logger.info(f"Checking quality for BOM {bom_id}")

    with get_components_v2_connection() as conn:
        with conn.cursor() as cur:
            # Get all BOM items from components_v2 database
            cur.execute("""
                SELECT id, mpn, manufacturer, quantity, reference_designator, description
                FROM bom_items
                WHERE job_id = %s
            """, (bom_id,))
            items = cur.fetchall()

    total_items = len(items)
    if total_items == 0:
        return QualityCheckResult(
            score=0,
            total_items=0,
            issues=["BOM has no items"],
            passed=False
        )

    issues = []
    score = 100

    # Check 1: MPN present (30 points)
    items_with_mpn = sum(1 for item in items if item['mpn'])
    mpn_rate = items_with_mpn / total_items
    mpn_points = int(mpn_rate * 30)
    score_loss = 30 - mpn_points

    if mpn_rate < 0.9:
        issues.append(
            f"Only {mpn_rate*100:.1f}% of items have MPN "
            f"({items_with_mpn}/{total_items})"
        )
        score -= score_loss

    # Check 2: Manufacturer present (25 points)
    items_with_mfr = sum(1 for item in items if item['manufacturer'])
    mfr_rate = items_with_mfr / total_items
    mfr_points = int(mfr_rate * 25)
    score_loss = 25 - mfr_points

    if mfr_rate < 0.8:
        issues.append(
            f"Only {mfr_rate*100:.1f}% of items have manufacturer "
            f"({items_with_mfr}/{total_items})"
        )
        score -= score_loss

    # Check 3: Valid quantities (20 points)
    items_with_qty = sum(
        1 for item in items
        if item['quantity'] and item['quantity'] > 0
    )
    qty_rate = items_with_qty / total_items
    qty_points = int(qty_rate * 20)
    score_loss = 20 - qty_points

    if qty_rate < 1.0:
        issues.append(
            f"Only {qty_rate*100:.1f}% of items have valid quantity "
            f"({items_with_qty}/{total_items})"
        )
        score -= score_loss

    # Check 4: Reference designators (15 points)
    items_with_refdes = sum(1 for item in items if item['reference_designator'])
    refdes_rate = items_with_refdes / total_items
    refdes_points = int(refdes_rate * 15)
    score_loss = 15 - refdes_points

    if refdes_rate < 0.7:
        issues.append(
            f"Only {refdes_rate*100:.1f}% of items have reference designator "
            f"({items_with_refdes}/{total_items})"
        )
        score -= score_loss

    # Check 5: Description (10 points)
    items_with_desc = sum(1 for item in items if item['description'])
    desc_rate = items_with_desc / total_items
    desc_points = int(desc_rate * 10)
    score_loss = 10 - desc_points

    if desc_rate < 0.5:
        issues.append(
            f"Only {desc_rate*100:.1f}% of items have description "
            f"({items_with_desc}/{total_items})"
        )
        score -= score_loss

    final_score = max(0, score)

    activity.logger.info(
        f"Quality check complete: score={final_score}, "
        f"items={total_items}, issues={len(issues)}"
    )

    return QualityCheckResult(
        score=final_score,
        total_items=total_items,
        issues=issues,
        passed=final_score >= 70
    )


# ============================================================================
# ACTIVITY 2: Match Components
# ============================================================================

@activity.defn
async def match_components(
    bom_id: str,
    batch_start: int,
    batch_end: int
) -> List[ComponentMatch]:
    """
    Match BOM items to Components V2 catalog

    Matching strategy:
    1. Try exact match on (MPN + Manufacturer)
    2. Try fuzzy match on MPN only (if manufacturer missing)
    3. Return confidence score for each match
    """
    activity.logger.info(
        f"Matching components {batch_start}-{batch_end} for BOM {bom_id}"
    )

    matches = []

    # Get BOM items from components_v2 database and match against catalog
    with get_components_v2_connection() as components_conn:
        with components_conn.cursor() as cur:
            # First, get BOM items
            cur.execute("""
                SELECT id, mpn, manufacturer, quantity, line_number
                FROM bom_items
                WHERE job_id = %s
                ORDER BY line_number
                LIMIT %s OFFSET %s
            """, (bom_id, batch_end - batch_start, batch_start))
            items = cur.fetchall()

            # Now match each item against catalog
            for item in items:
                if not item['mpn']:
                    # No MPN - cannot match
                    continue

                # Try exact match first
                if item['manufacturer']:
                    cur.execute("""
                        SELECT id, mpn, manufacturer
                        FROM catalog_components
                        WHERE UPPER(mpn) = UPPER(%s)
                        AND UPPER(manufacturer) = UPPER(%s)
                        LIMIT 1
                    """, (item['mpn'], item['manufacturer']))

                    component = cur.fetchone()

                    if component:
                        matches.append(ComponentMatch(
                            bom_item_id=str(item['id']),
                            component_id=component['id'],
                            mpn=component['mpn'],
                            manufacturer=component['manufacturer'],
                            confidence=1.0
                        ))
                        continue

                # Try MPN-only match (fuzzy)
                cur.execute("""
                    SELECT id, mpn, manufacturer,
                           similarity(mpn, %s) as sim
                    FROM catalog_components
                    WHERE mpn %% %s
                    ORDER BY sim DESC
                    LIMIT 1
                """, (item['mpn'], item['mpn']))

                fuzzy_match = cur.fetchone()

                if fuzzy_match and fuzzy_match['sim'] > 0.7:
                    matches.append(ComponentMatch(
                        bom_item_id=str(item['id']),
                        component_id=fuzzy_match['id'],
                        mpn=fuzzy_match['mpn'],
                        manufacturer=fuzzy_match['manufacturer'],
                        confidence=float(fuzzy_match['sim'])
                    ))

    activity.logger.info(
        f"Matched {len(matches)} out of {len(items)} items "
        f"in batch {batch_start}-{batch_end}"
    )

    return matches


# ============================================================================
# ACTIVITY 3: Enrich Component Data
# ============================================================================

@activity.defn
async def enrich_component_data(
    bom_id: str,
    matches: List[ComponentMatch]
) -> EnrichedData:
    """
    Enrich matched components with full data from Central Catalog

    Fetches:
    - Component specifications
    - Pricing data
    - Lifecycle status
    - Compliance information
    """
    activity.logger.info(f"Enriching {len(matches)} components for BOM {bom_id}")

    enriched_items = []
    component_ids = [match.component_id for match in matches]

    if not component_ids:
        return EnrichedData(
            bom_id=bom_id,
            items=[],
            stats={
                'total': 0,
                'matched': 0,
                'match_rate': 0.0,
                'avg_confidence': 0.0
            }
        )

    with get_components_v2_connection() as conn:
        with conn.cursor() as cur:
            # Get all enrichment data in one query
            cur.execute("""
                SELECT
                    c.id,
                    c.mpn,
                    c.manufacturer,
                    c.description,
                    c.specifications,
                    c.datasheet_url,
                    cl.status as lifecycle_status,
                    cl.estimated_lifetime,
                    cc.reach_compliant,
                    cc.rohs_compliant,
                    array_agg(
                        json_build_object(
                            'supplier', cp.supplier,
                            'price', cp.price,
                            'quantity_break', cp.quantity_break,
                            'currency', cp.currency,
                            'updated_at', cp.updated_at
                        )
                    ) FILTER (WHERE cp.id IS NOT NULL) as pricing
                FROM catalog_components c
                LEFT JOIN catalog_component_lifecycle cl ON c.id = cl.component_id
                LEFT JOIN catalog_component_compliance cc ON c.id = cc.component_id
                LEFT JOIN catalog_component_pricing cp ON c.id = cp.component_id
                WHERE c.id = ANY(%s)
                GROUP BY c.id, cl.status, cl.estimated_lifetime,
                         cc.reach_compliant, cc.rohs_compliant
            """, (component_ids,))

            enrichment_data = {row['id']: dict(row) for row in cur.fetchall()}

    # Combine matches with enrichment data
    for match in matches:
        enriched = enrichment_data.get(match.component_id)
        if enriched:
            enriched_items.append({
                'bom_item_id': match.bom_item_id,
                'component_id': match.component_id,
                'enriched_mpn': enriched['mpn'],
                'enriched_manufacturer': enriched['manufacturer'],
                'description': enriched['description'],
                'specifications': enriched['specifications'],
                'datasheet_url': enriched['datasheet_url'],
                'lifecycle_status': enriched['lifecycle_status'],
                'estimated_lifetime': str(enriched['estimated_lifetime']) if enriched['estimated_lifetime'] else None,
                'compliance_status': {
                    'reach': enriched['reach_compliant'],
                    'rohs': enriched['rohs_compliant']
                },
                'pricing': enriched['pricing'] if enriched['pricing'] else [],
                'match_confidence': match.confidence
            })

    # Calculate statistics
    total_confidence = sum(item['match_confidence'] for item in enriched_items)
    stats = {
        'total': len(matches),
        'matched': len(enriched_items),
        'match_rate': len(enriched_items) / len(matches) if matches else 0.0,
        'avg_confidence': total_confidence / len(enriched_items) if enriched_items else 0.0
    }

    activity.logger.info(
        f"Enrichment complete: {len(enriched_items)} items, "
        f"match_rate={stats['match_rate']*100:.1f}%, "
        f"avg_confidence={stats['avg_confidence']:.2f}"
    )

    return EnrichedData(
        bom_id=bom_id,
        items=enriched_items,
        stats=stats
    )


# ============================================================================
# ACTIVITY 4: Write Enriched Data
# ============================================================================

@activity.defn
async def write_enriched_data(bom_id: str, enriched_data: EnrichedData) -> WriteResult:
    """
    Write enriched data back to components_v2 database

    Updates:
    - bom_items table with enriched data
    - bom_jobs table with status='enriched'
    """
    activity.logger.info(f"Writing enriched data for BOM {bom_id}")

    with get_components_v2_connection() as conn:
        with conn.cursor() as cur:
            # Update each BOM item
            items_updated = 0
            for item in enriched_data.items:
                cur.execute("""
                    UPDATE bom_items
                    SET
                        enriched_mpn = %s,
                        enriched_manufacturer = %s,
                        component_id = %s,
                        description = COALESCE(description, %s),
                        specifications = %s,
                        datasheet_url = %s,
                        lifecycle_status = %s,
                        estimated_lifetime = %s,
                        compliance_status = %s,
                        pricing = %s,
                        match_confidence = %s,
                        enrichment_status = 'enriched',
                        updated_at = NOW()
                    WHERE id = %s
                """, (
                    item['enriched_mpn'],
                    item['enriched_manufacturer'],
                    item['component_id'],
                    item['description'],
                    json.dumps(item['specifications']) if item['specifications'] else None,
                    item['datasheet_url'],
                    item['lifecycle_status'],
                    item['estimated_lifetime'],
                    json.dumps(item['compliance_status']) if item.get('compliance_status') else None,
                    json.dumps(item['pricing']) if item.get('pricing') else None,
                    item['match_confidence'],
                    item['bom_item_id']
                ))

                items_updated += cur.rowcount

            # Update BOM job status
            cur.execute("""
                UPDATE bom_jobs
                SET
                    status = 'enriched',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE job_id = %s
            """, (bom_id,))

            conn.commit()

    activity.logger.info(f"Write complete: {items_updated} items updated")

    return WriteResult(
        success=True,
        items_updated=items_updated
    )


# ============================================================================
# ACTIVITY 5: Notify Customer
# ============================================================================

@activity.defn
async def notify_customer(
    bom_id: str,
    organization_id: str,
    stats: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Notify customer that BOM enrichment is complete

    Notification channels:
    - Email (TODO)
    - WebSocket (TODO)
    - Push notification (TODO)
    - Database flag (implemented)
    """
    activity.logger.info(f"Notifying customer for BOM {bom_id}")

    # For now, just log the notification
    # TODO: Implement actual notification system (Email, WebSocket, Push)

    activity.logger.info(
        f"BOM {bom_id} enriched for organization {organization_id}: "
        f"{stats['matched']}/{stats['total']} items matched "
        f"({stats['match_rate']*100:.1f}%)"
    )

    # TODO: Add notification table support later
    # For now, customers can check BOM job status via API

    return {'success': True, 'notification_sent': False}
