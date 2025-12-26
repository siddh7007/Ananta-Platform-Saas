"""
Supplier Enrichment Service

Integrates supplier API plugins into the CNS enrichment workflow.
Provides 2-step matching: local catalog → supplier APIs.
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session

from app.plugins.suppliers.manager import SupplierPluginManager
from app.repositories.catalog_repository import CatalogRepository
from app.core.normalizers import normalize_component_data

logger = logging.getLogger(__name__)


class SupplierEnrichmentService:
    """
    Service for enriching component data using supplier APIs.

    Implements 2-step matching strategy:
    1. Check local catalog first (fast, free)
    2. Fall back to supplier APIs if not found (slower, may have cost)
    """

    def __init__(self, supplier_manager: SupplierPluginManager, db: Session):
        """
        Initialize supplier enrichment service.

        Args:
            supplier_manager: Configured supplier plugin manager
            db: Database session
        """
        self.supplier_manager = supplier_manager
        self.db = db
        self.catalog_repo = CatalogRepository(db)

        # Statistics tracking
        self.stats = {
            'matched_existing': 0,
            'newly_imported': 0,
            'import_failed': 0,
            'multiple_matches': 0,
            'vendors_used': {}
        }

    def enrich_component(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        min_confidence: float = 90.0,
        preferred_suppliers: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Enrich component data using 2-step matching.

        Step 1: Check local catalog
        Step 2: Query supplier APIs if not found

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name for better matching
            min_confidence: Minimum match confidence threshold (0-100)
            preferred_suppliers: List of suppliers to try (in order)

        Returns:
            Enriched component data dict or None if not found
        """
        # STEP 1: Check local catalog first
        logger.info(f"🔍 Searching local catalog for: {mpn}")
        existing_component = self.catalog_repo.get_by_mpn(mpn)

        if existing_component:
            logger.info(f"✅ Found in local catalog: {mpn} (quality: {existing_component.quality_score}%)")
            self.stats['matched_existing'] += 1

            # Convert to dict for consistent return format
            return {
                'mpn': existing_component.mpn,
                'manufacturer': existing_component.manufacturer.name if existing_component.manufacturer else None,
                'manufacturer_id': existing_component.manufacturer_id,
                'category': existing_component.category,
                'description': existing_component.description,
                'datasheet_url': existing_component.datasheet_url,
                'image_url': existing_component.image_url,
                'model_3d_url': getattr(existing_component, 'model_3d_url', None),
                'lifecycle_status': existing_component.lifecycle_status,
                'rohs_compliant': existing_component.rohs_compliant,
                'reach_compliant': existing_component.reach_compliant,
                'extracted_specs': existing_component.extracted_specs or existing_component.specifications or {},
                'pricing': existing_component.pricing or [],
                'quality_score': float(existing_component.quality_score),
                'enrichment_source': existing_component.enrichment_source,
                'source_supplier': 'local_catalog',
                'is_new': False
            }

        # STEP 2: Query supplier APIs if not in catalog
        logger.info(f"⚠️  Not in local catalog, querying suppliers: {mpn}")

        product_data = self.supplier_manager.get_best_match(
            mpn=mpn,
            manufacturer=manufacturer,
            min_confidence=min_confidence
        )

        if not product_data:
            logger.warning(f"❌ No supplier found component: {mpn}")
            self.stats['import_failed'] += 1
            return None

        logger.info(f"✅ Found via {product_data.supplier_name}: {mpn} (confidence: {product_data.match_confidence}%)")

        # Track vendor usage
        vendor = product_data.supplier_name.lower()
        self.stats['vendors_used'][vendor] = self.stats['vendors_used'].get(vendor, 0) + 1
        self.stats['newly_imported'] += 1

        # Convert supplier product data to normalized component data
        enriched_data = self._convert_supplier_data_to_component(product_data)
        enriched_data['source_supplier'] = product_data.supplier_name
        enriched_data['is_new'] = True

        return enriched_data

    def _convert_supplier_data_to_component(self, product_data) -> Dict[str, Any]:
        """
        Convert SupplierProductData to normalized component dict.

        Args:
            product_data: SupplierProductData from plugin

        Returns:
            Normalized component data dict
        """
        # Build raw component data from supplier
        raw_data = {
            'mpn': product_data.mpn,
            'manufacturer': product_data.manufacturer,
            'description': product_data.description,
            'category': product_data.category,
            'datasheet_url': product_data.datasheet_url,
            'image_url': product_data.image_url,
            'model_3d_url': product_data.model_3d_url,
            'lifecycle_status': product_data.lifecycle_status,
            'package': product_data.package,
            'rohs_compliant': product_data.rohs_compliant,
            'reach_compliant': product_data.reach_compliant,
            'halogen_free': product_data.halogen_free,
            'aec_qualified': product_data.aec_qualified,
        }

        # Add supplier-specific data
        raw_data['supplier_data'] = {
            'supplier_name': product_data.supplier_name,
            'supplier_sku': product_data.supplier_sku,
            'supplier_url': product_data.supplier_url,
            'availability': product_data.availability,
            'unit_price': product_data.unit_price,
            'currency': product_data.currency,
            'price_breaks': product_data.price_breaks,
            'lead_time_days': product_data.lead_time_days,
            'match_confidence': product_data.match_confidence,
            'last_updated': product_data.last_updated.isoformat() if product_data.last_updated else None
        }

        # Add parameters as specs
        raw_data['extracted_specs'] = product_data.parameters

        # Normalize the data (MPN, prices, specs)
        normalized = normalize_component_data(raw_data)

        # Add enrichment metadata
        normalized['enrichment_source'] = 'supplier_api'
        normalized['api_source'] = product_data.supplier_name

        return normalized

    def bulk_enrich(
        self,
        bom_items: List[Dict[str, Any]],
        min_confidence: float = 90.0,
        preferred_suppliers: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Enrich multiple components in bulk.

        Args:
            bom_items: List of BOM items with 'mpn' and optional 'manufacturer'
            min_confidence: Minimum match confidence threshold
            preferred_suppliers: List of suppliers to try

        Returns:
            List of enriched component data (may include None for failed items)
        """
        enriched_items = []

        for item in bom_items:
            mpn = item.get('mpn')
            manufacturer = item.get('manufacturer')

            if not mpn:
                enriched_items.append(None)
                continue

            enriched = self.enrich_component(
                mpn=mpn,
                manufacturer=manufacturer,
                min_confidence=min_confidence,
                preferred_suppliers=preferred_suppliers
            )

            enriched_items.append(enriched)

        return enriched_items

    def get_stats(self) -> Dict[str, Any]:
        """
        Get enrichment statistics.

        Returns:
            Dictionary with statistics:
            {
                'matched_existing': 120,
                'newly_imported': 30,
                'import_failed': 5,
                'multiple_matches': 0,
                'vendors_used': {'digikey': 15, 'mouser': 10, 'element14': 5},
                'total_processed': 155
            }
        """
        stats = self.stats.copy()
        stats['total_processed'] = (
            stats['matched_existing'] +
            stats['newly_imported'] +
            stats['import_failed']
        )
        return stats

    def reset_stats(self):
        """Reset statistics counters"""
        self.stats = {
            'matched_existing': 0,
            'newly_imported': 0,
            'import_failed': 0,
            'multiple_matches': 0,
            'vendors_used': {}
        }
