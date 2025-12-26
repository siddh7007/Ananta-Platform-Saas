#!/usr/bin/env python3
"""
Calculate Risk Scores for Existing BOMs

This script calculates risk scores for all enriched BOM line items that
don't yet have risk scores calculated.

Usage:
    docker-compose exec temporal-worker python /app/scripts/calculate_bom_risks.py --org-id <org_id>

    Or for specific BOM:
    docker-compose exec temporal-worker python /app/scripts/calculate_bom_risks.py --bom-id <bom_id>
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from typing import Optional

# Add app to path
sys.path.insert(0, "/app")

from sqlalchemy import text

# Initialize database before imports that use it
from app.models.dual_database import init_dual_database, get_dual_database

# Initialize database connections (uses env vars: DATABASE_URL, SUPABASE_DATABASE_URL)
init_dual_database()

from app.services.risk_calculation_service import (
    get_risk_calculation_service,
    ComponentBaseRisk,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def calculate_risks_for_bom(bom_id: str, organization_id: str):
    """Calculate risk scores for all line items in a BOM."""
    logger.info(f"[RiskCalc] Processing BOM: {bom_id} org: {organization_id}")

    service = get_risk_calculation_service()
    db = next(get_dual_database().get_session("supabase"))

    # Get all enriched line items for this BOM
    sql = """
        SELECT
            bli.id as line_item_id,
            bli.manufacturer_part_number as mpn,
            bli.manufacturer,
            COALESCE(bli.quantity, 1) as quantity,
            bli.lifecycle_status,
            bli.enrichment_status,
            bli.specifications,
            bli.compliance_status,
            bli.pricing,
            bli.datasheet_url
        FROM bom_line_items bli
        WHERE bli.bom_id = :bom_id
        AND bli.enrichment_status = 'enriched'
    """

    rows = db.execute(text(sql), {"bom_id": bom_id}).fetchall()

    if not rows:
        logger.warning(f"[RiskCalc] No enriched line items found for BOM: {bom_id}")
        return 0

    logger.info(f"[RiskCalc] Found {len(rows)} enriched line items")

    # Get or create risk profile
    profile = await service.get_or_create_profile(organization_id, db)

    processed = 0
    for row in rows:
        m = row._mapping
        try:
            mpn = m["mpn"] or "UNKNOWN"
            manufacturer = m["manufacturer"] or "UNKNOWN"

            # Build component data from enrichment
            specs = m.get("specifications") or {}
            if isinstance(specs, str):
                specs = json.loads(specs)

            compliance = m.get("compliance_status") or {}
            if isinstance(compliance, str):
                compliance = json.loads(compliance)

            component_data = {
                "lifecycle_status": m.get("lifecycle_status"),
                "stock_quantity": specs.get("stock_quantity"),
                "lead_time_days": specs.get("lead_time_days"),
                "supplier_count": specs.get("supplier_count", 1),
                "rohs_compliant": compliance.get("rohs"),
                "reach_compliant": compliance.get("reach"),
                "halogen_free": compliance.get("halogen_free"),
                "distributor_count": specs.get("distributor_count", 1),
            }

            # Calculate base risk
            base_risk = await service.calculate_component_base_risk(
                mpn=mpn,
                manufacturer=manufacturer,
                component_data=component_data,
                data_sources=["enrichment"]
            )

            # Store base risk
            base_risk_id = await service.store_component_base_risk(base_risk, db)

            # Calculate line item contextual risk
            line_item_risk = await service.calculate_line_item_contextual_risk(
                bom_line_item_id=str(m["line_item_id"]),
                organization_id=organization_id,
                base_risk=base_risk,
                quantity=m["quantity"],
                user_criticality=5,  # Default
                db=db
            )

            # Store line item risk
            await service.store_line_item_risk(
                line_item_risk,
                base_risk_id=base_risk_id,
                profile_id=profile.id,
                db=db
            )

            processed += 1
            logger.debug(f"[RiskCalc] Processed: {mpn} score={line_item_risk.contextual_risk_score}")

        except Exception as e:
            logger.error(f"[RiskCalc] Error processing line item {m['line_item_id']}: {e}")
            continue

    # Calculate and store BOM summary
    if processed > 0:
        summary = await service.calculate_bom_risk_summary(bom_id, organization_id, db)
        await service.store_bom_risk_summary(summary, profile_id=profile.id, db=db)
        logger.info(f"[RiskCalc] BOM summary: grade={summary.health_grade} avg={summary.average_risk_score}")

    return processed


async def calculate_risks_for_organization(organization_id: str):
    """Calculate risk scores for all BOMs in an organization."""
    logger.info(f"[RiskCalc] Processing organization: {organization_id}")

    db = next(get_dual_database().get_session("supabase"))

    # Get all BOMs for this organization with enriched items
    sql = """
        SELECT DISTINCT b.id as bom_id, b.name
        FROM boms b
        JOIN bom_line_items bli ON b.id = bli.bom_id
        WHERE b.organization_id = :org_id
        AND bli.enrichment_status = 'enriched'
        AND NOT EXISTS (
            SELECT 1 FROM bom_risk_summaries brs
            WHERE brs.bom_id = b.id
        )
    """

    rows = db.execute(text(sql), {"org_id": organization_id}).fetchall()

    if not rows:
        logger.info("[RiskCalc] No BOMs found without risk summaries")
        return

    logger.info(f"[RiskCalc] Found {len(rows)} BOMs to process")

    total_processed = 0
    for row in rows:
        bom_id = str(row._mapping["bom_id"])
        bom_name = row._mapping["name"]
        logger.info(f"[RiskCalc] Processing BOM: {bom_name}")

        processed = await calculate_risks_for_bom(bom_id, organization_id)
        total_processed += processed

    logger.info(f"[RiskCalc] Complete. Processed {total_processed} line items across {len(rows)} BOMs")


async def main():
    parser = argparse.ArgumentParser(description="Calculate BOM risk scores")
    parser.add_argument("--bom-id", help="Specific BOM ID to process")
    parser.add_argument("--org-id", help="Organization ID to process all BOMs")
    args = parser.parse_args()

    if args.bom_id:
        # Need org_id for specific BOM
        db = next(get_dual_database().get_session("supabase"))
        sql = "SELECT organization_id FROM boms WHERE id = :bom_id"
        row = db.execute(text(sql), {"bom_id": args.bom_id}).fetchone()
        if not row:
            logger.error(f"BOM not found: {args.bom_id}")
            sys.exit(1)
        org_id = str(row._mapping["organization_id"])
        await calculate_risks_for_bom(args.bom_id, org_id)
    elif args.org_id:
        await calculate_risks_for_organization(args.org_id)
    else:
        logger.error("Must specify --bom-id or --org-id")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
