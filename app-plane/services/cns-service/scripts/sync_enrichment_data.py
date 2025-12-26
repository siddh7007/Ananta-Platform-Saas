#!/usr/bin/env python3
"""
Sync enrichment data from component_catalog to bom_line_items.

This script backfills description, unit_price, and other fields for
bom_line_items that were enriched before the fix was applied.

Run this inside the CNS service container:
  docker exec -it app-plane-cns-service python /app/scripts/sync_enrichment_data.py
"""

import json
import os
import sys

# Add the app directory to the path
sys.path.insert(0, '/app')

from decimal import Decimal
from sqlalchemy import create_engine, text

# Database connection strings
SUPABASE_URL = os.getenv('SUPABASE_DATABASE_URL', 'postgresql://postgres:postgres@supabase-db:5432/postgres')
COMPONENTS_URL = os.getenv('COMPONENTS_DATABASE_URL', 'postgresql://postgres:postgres@components-v2-postgres:5432/components_v2')


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal values."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def map_risk_level(catalog_risk: str) -> str:
    """Map catalog risk_level to bom_line_items format.

    Catalog uses: low, medium, high, critical (or None)
    BOM requires: GREEN, YELLOW, ORANGE, RED
    """
    if not catalog_risk:
        return None  # Will use existing value or NULL

    mapping = {
        'low': 'GREEN',
        'medium': 'YELLOW',
        'high': 'ORANGE',
        'critical': 'RED',
        # Also handle if already uppercase colors
        'GREEN': 'GREEN',
        'YELLOW': 'YELLOW',
        'ORANGE': 'ORANGE',
        'RED': 'RED',
    }
    return mapping.get(catalog_risk.lower() if catalog_risk else None, None)


def main():
    print("=" * 60)
    print("Syncing enrichment data from component_catalog to bom_line_items")
    print("=" * 60)

    # Connect to both databases
    supabase_engine = create_engine(SUPABASE_URL)
    components_engine = create_engine(COMPONENTS_URL)

    # First, get all the component IDs that need updating
    with supabase_engine.connect() as supabase_conn:
        # Get enriched bom_line_items with component_id but missing category data
        items_query = text("""
            SELECT id, component_id, manufacturer_part_number, manufacturer
            FROM bom_line_items
            WHERE enrichment_status = 'enriched'
              AND component_id IS NOT NULL
              AND (category IS NULL OR category = '')
        """)
        items = supabase_conn.execute(items_query).fetchall()
        print(f"Found {len(items)} items needing data sync")

        if not items:
            print("No items to sync!")
            return

        # Get component_ids as a list
        component_ids = [str(item[1]) for item in items]

    # Now fetch the catalog data for these components
    with components_engine.connect() as components_conn:
        # Fetch catalog data
        catalog_query = text("""
            SELECT
                id::text,
                description,
                unit_price,
                datasheet_url,
                lifecycle_status,
                specifications,
                risk_level,
                rohs_compliant,
                reach_compliant,
                manufacturer_part_number,
                manufacturer,
                category,
                subcategory
            FROM component_catalog
            WHERE id::text = ANY(:ids)
        """)
        catalog_data = components_conn.execute(catalog_query, {"ids": component_ids}).fetchall()

        # Build lookup dict
        catalog_lookup = {}
        for row in catalog_data:
            catalog_lookup[row[0]] = {
                "description": row[1],
                "unit_price": float(row[2]) if row[2] else None,
                "datasheet_url": row[3],
                "lifecycle_status": row[4],
                "specifications": row[5] if isinstance(row[5], dict) else (json.loads(row[5]) if row[5] else {}),
                "risk_level": row[6],
                "rohs_compliant": row[7],
                "reach_compliant": row[8],
                "mpn": row[9],
                "manufacturer": row[10],
                "category": row[11],
                "subcategory": row[12],
            }

        print(f"Found catalog data for {len(catalog_lookup)} components")

    # Now update the bom_line_items
    updated = 0
    with supabase_engine.connect() as supabase_conn:
        for item in items:
            item_id = item[0]
            component_id = str(item[1])

            catalog = catalog_lookup.get(component_id)
            if not catalog:
                print(f"  [SKIP] {item[2]} - No catalog data for component_id {component_id}")
                continue

            # Build update
            update_query = text("""
                UPDATE bom_line_items
                SET
                    description = :description,
                    unit_price = :unit_price,
                    datasheet_url = :datasheet_url,
                    lifecycle_status = :lifecycle_status,
                    specifications = CAST(:specifications AS jsonb),
                    compliance_status = CAST(:compliance_status AS jsonb),
                    risk_level = :risk_level,
                    enriched_mpn = :enriched_mpn,
                    enriched_manufacturer = :enriched_manufacturer,
                    category = :category,
                    subcategory = :subcategory,
                    updated_at = NOW()
                WHERE id = :item_id
            """)

            # Map risk_level from catalog format to BOM format
            mapped_risk = map_risk_level(catalog["risk_level"])

            params = {
                "item_id": item_id,
                "description": catalog["description"],
                "unit_price": catalog["unit_price"],
                "datasheet_url": catalog["datasheet_url"],
                "lifecycle_status": catalog["lifecycle_status"],
                "specifications": json.dumps(catalog["specifications"], cls=DecimalEncoder),
                "compliance_status": json.dumps({
                    "rohs": catalog["rohs_compliant"],
                    "reach": catalog["reach_compliant"],
                }, cls=DecimalEncoder),
                "risk_level": mapped_risk,  # Use mapped value (GREEN/YELLOW/ORANGE/RED)
                "enriched_mpn": catalog["mpn"],
                "enriched_manufacturer": catalog["manufacturer"],
                "category": catalog["category"],
                "subcategory": catalog["subcategory"],
            }

            supabase_conn.execute(update_query, params)
            updated += 1

            if updated % 20 == 0:
                print(f"  Updated {updated} items...")

        supabase_conn.commit()

    print(f"\n{'=' * 60}")
    print(f"DONE! Updated {updated} bom_line_items with catalog data")
    print("=" * 60)


if __name__ == "__main__":
    main()
