"""
Component Catalog Service

Manages the central component catalog in Components V2 database.
Provides lookup and upsert operations for component enrichment.

Key Features:
- Single source of truth for component data
- Deduplication by (MPN, Manufacturer)
- Usage tracking for popular components
- Automatic enrichment caching
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
from app.cache.redis_cache import DecimalEncoder

from app.models.dual_database import get_dual_database

logger = logging.getLogger(__name__)


class ComponentCatalogService:
    """
    Service for managing central component catalog.

    The catalog lives in Components V2 database and is shared across all customers.
    Each component (MPN + Manufacturer) is stored once and reused.
    """

    def __init__(self):
        self.dual_db = get_dual_database()

    def lookup_component(
        self,
        mpn: str,
        manufacturer: str
    ) -> Optional[Dict[str, Any]]:
        """
        Look up component in central catalog by MPN + Manufacturer.

        Args:
            mpn: Manufacturer Part Number
            manufacturer: Manufacturer name

        Returns:
            Component data dict if found, None if not found

        Example:
            >>> catalog = ComponentCatalogService()
            >>> component = catalog.lookup_component('STM32F407VGT6', 'STMicroelectronics')
            >>> if component:
            ...     print(f"Found: {component['id']}")
        """
        db = None
        try:
            db = next(self.dual_db.get_session("components"))

            query = text("""
                SELECT
                    id,
                    manufacturer_part_number,
                    manufacturer,
                    category,
                    subcategory,
                    description,
                    datasheet_url,
                    image_url,
                    specifications,
                    lifecycle_status,
                    risk_level,
                    rohs_compliant,
                    reach_compliant,
                    aec_qualified,
                    unit_price,
                    currency,
                    moq,
                    lead_time_days,
                    stock_status,
                    quality_score,
                    quality_metadata,
                    supplier_data,
                    ai_metadata,
                    enrichment_source,
                    last_enriched_at,
                    usage_count
                FROM component_catalog
                WHERE manufacturer_part_number = :mpn
                  AND manufacturer = :manufacturer
                LIMIT 1
            """)

            result = db.execute(query, {"mpn": mpn, "manufacturer": manufacturer})
            row = result.fetchone()

            if not row:
                logger.debug(f"Component not found in catalog: {mpn} ({manufacturer})")
                return None

            # Convert row to dict
            component = dict(row._mapping)

            logger.info(f"✅ Found component in catalog: {mpn} (ID: {component['id']})")

            # Increment usage counter (async, don't wait)
            self._increment_usage_async(db, component['id'])

            return component

        except Exception as e:
            logger.error(f"Error looking up component in catalog: {e}", exc_info=True)
            return None
        finally:
            # Always close database session
            if db is not None:
                db.close()

    def bulk_lookup_components(
        self,
        components: List[Dict[str, str]]
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Bulk look up multiple components in central catalog.

        Args:
            components: List of dicts with 'mpn' and 'manufacturer' keys
                Example: [{'mpn': 'STM32F407VGT6', 'manufacturer': 'STMicroelectronics'}, ...]

        Returns:
            Dict mapping (mpn, manufacturer) tuple to component data:
            {
                ('STM32F407VGT6', 'STMicroelectronics'): {...component data...},
                ('LM2596S-5.0', 'Texas Instruments'): None,  # Not found
            }

        Example:
            >>> catalog = ComponentCatalogService()
            >>> components = [
            ...     {'mpn': 'STM32F407VGT6', 'manufacturer': 'STMicroelectronics'},
            ...     {'mpn': 'LM2596S-5.0', 'manufacturer': 'Texas Instruments'}
            ... ]
            >>> results = catalog.bulk_lookup_components(components)
            >>> found_count = sum(1 for v in results.values() if v is not None)
            >>> print(f"Found {found_count}/{len(components)} in catalog")
        """
        if not components:
            return {}

        db = None
        try:
            db = next(self.dual_db.get_session("components"))

            # Build list of (mpn, manufacturer) tuples for query
            component_keys = [(c['mpn'], c['manufacturer']) for c in components]

            # Create CASE-WHEN pairs for IN clause
            # We need to match on (mpn AND manufacturer) pairs
            mpn_values = [c['mpn'] for c in components]
            manufacturer_values = [c['manufacturer'] for c in components]

            # Use VALUES clause for bulk lookup (more efficient than OR conditions)
            # Build the query with VALUES for PostgreSQL (avoids array casting issues)
            from sqlalchemy import bindparam

            # Build VALUES list for the query (escape single quotes for SQL)
            def escape_sql(val):
                return val.replace("'", "''") if val else ''

            values_list = ", ".join([
                f"('{escape_sql(mpn)}', '{escape_sql(mfr)}')"
                for mpn, mfr in zip(mpn_values, manufacturer_values)
            ])

            query_str = f"""
                WITH search_components AS (
                    VALUES {values_list}
                )
                SELECT
                    sc.column1 as search_mpn,
                    sc.column2 as search_manufacturer,
                    cc.id,
                    cc.manufacturer_part_number,
                    cc.manufacturer,
                    cc.category,
                    cc.subcategory,
                    cc.description,
                    cc.datasheet_url,
                    cc.image_url,
                    cc.specifications,
                    cc.lifecycle_status,
                    cc.risk_level,
                    cc.rohs_compliant,
                    cc.reach_compliant,
                    cc.aec_qualified,
                    cc.unit_price,
                    cc.currency,
                    cc.moq,
                    cc.lead_time_days,
                    cc.stock_status,
                    cc.quality_score,
                    cc.quality_metadata,
                    cc.supplier_data,
                    cc.ai_metadata,
                    cc.enrichment_source,
                    cc.last_enriched_at,
                    cc.usage_count
                FROM search_components sc (column1, column2)
                LEFT JOIN component_catalog cc
                    ON cc.manufacturer_part_number = sc.column1
                    AND cc.manufacturer = sc.column2
            """

            result = db.execute(text(query_str))

            # Build results dict
            results = {}
            component_ids_to_increment = []

            for row in result.fetchall():
                key = (row.search_mpn, row.search_manufacturer)

                if row.id is not None:
                    # Found in catalog
                    component_data = {
                        'id': row.id,
                        'manufacturer_part_number': row.manufacturer_part_number,
                        'manufacturer': row.manufacturer,
                        'category': row.category,
                        'subcategory': row.subcategory,
                        'description': row.description,
                        'datasheet_url': row.datasheet_url,
                        'image_url': row.image_url,
                        'model_3d_url': getattr(row, 'model_3d_url', None),
                        'specifications': row.specifications,
                        'lifecycle_status': row.lifecycle_status,
                        'risk_level': row.risk_level,
                        'rohs_compliant': row.rohs_compliant,
                        'reach_compliant': row.reach_compliant,
                        'aec_qualified': row.aec_qualified,
                        'unit_price': row.unit_price,
                        'currency': row.currency,
                        'moq': row.moq,
                        'lead_time_days': row.lead_time_days,
                        'stock_status': row.stock_status,
                        'quality_score': row.quality_score,
                        'quality_metadata': row.quality_metadata,
                        'supplier_data': row.supplier_data,
                        'ai_metadata': row.ai_metadata,
                        'enrichment_source': row.enrichment_source,
                        'last_enriched_at': row.last_enriched_at,
                        'usage_count': row.usage_count
                    }
                    results[key] = component_data
                    component_ids_to_increment.append(row.id)
                else:
                    # Not found in catalog
                    results[key] = None

            # Bulk increment usage counters for found components
            if component_ids_to_increment:
                self._bulk_increment_usage(db, component_ids_to_increment)

            found_count = sum(1 for v in results.values() if v is not None)
            not_found_count = len(results) - found_count

            logger.info(
                f"✅ Bulk lookup: {found_count} found, {not_found_count} not found "
                f"(total: {len(components)} components)"
            )

            return results

        except Exception as e:
            logger.error(f"Error in bulk component lookup: {e}", exc_info=True)
            # Return empty dict for all components on error
            return {(c['mpn'], c['manufacturer']): None for c in components}
        finally:
            # Always close database session
            if db is not None:
                db.close()

    def upsert_component(
        self,
        mpn: str,
        manufacturer: str,
        enrichment_data: Dict[str, Any],
        enrichment_source: str = 'cns'
    ) -> Optional[str]:
        """
        Insert or update component in central catalog.

        If component exists (MPN + Manufacturer), update enrichment data.
        If not, insert new component.

        Args:
            mpn: Manufacturer Part Number
            manufacturer: Manufacturer name
            enrichment_data: Dict with enriched component data
            enrichment_source: Source of enrichment ('mouser', 'digikey', 'ai', 'manual')

        Returns:
            Component UUID (str) if successful, None if failed

        Example:
            >>> catalog = ComponentCatalogService()
            >>> data = {
            ...     'category': 'Microcontrollers',
            ...     'lifecycle_status': 'Active',
            ...     'unit_price': 5.67,
            ...     'quality_score': 95.5
            ... }
            >>> component_id = catalog.upsert_component(
            ...     'STM32F407VGT6',
            ...     'STMicroelectronics',
            ...     data,
            ...     'mouser'
            ... )
        """
        db = None
        try:
            db = next(self.dual_db.get_session("components"))

            # Check if component exists
            existing = self.lookup_component(mpn, manufacturer)

            if existing:
                # Update existing component with quality gate
                component_id = existing['id']

                # Quality gate: Only update if new data is better or equal quality
                existing_quality = float(existing.get('quality_score') or 0)
                new_quality = float(enrichment_data.get('quality_score') or 0)
                existing_source = existing.get('enrichment_source') or ''
                new_source = enrichment_source or ''

                # Determine if we should update
                should_update = False
                update_reason = ''

                if new_source in ['mouser', 'digikey', 'element14'] and existing_source in ['fallback', 'mock', '']:
                    # Always update fallback data with real supplier data
                    should_update = True
                    update_reason = f'upgrading from {existing_source} to {new_source}'
                elif new_quality >= existing_quality:
                    # Update if quality is better or equal
                    should_update = True
                    update_reason = f'quality {new_quality} >= {existing_quality}'
                else:
                    # Don't downgrade quality
                    should_update = False
                    update_reason = f'rejecting downgrade: new quality {new_quality} < existing {existing_quality}'

                if not should_update:
                    logger.info(
                        f"⏭️  Skipping update for {mpn}: {update_reason} "
                        f"(existing: {existing_source}/{existing_quality}, new: {new_source}/{new_quality})"
                    )
                    return str(component_id)

                logger.info(
                    f"✅ Updating component {mpn} (ID: {component_id}): {update_reason}"
                )

                query = text("""
                    UPDATE component_catalog
                    SET
                        category = COALESCE(:category, category),
                        subcategory = COALESCE(:subcategory, subcategory),
                        description = COALESCE(:description, description),
                        datasheet_url = COALESCE(:datasheet_url, datasheet_url),
                        image_url = COALESCE(:image_url, image_url),
                        specifications = COALESCE(:specifications, specifications),
                        lifecycle_status = COALESCE(:lifecycle_status, lifecycle_status),
                        risk_level = COALESCE(:risk_level, risk_level),
                        rohs_compliant = COALESCE(:rohs_compliant, rohs_compliant),
                        reach_compliant = COALESCE(:reach_compliant, reach_compliant),
                        halogen_free = COALESCE(:halogen_free, halogen_free),
                        aec_qualified = COALESCE(:aec_qualified, aec_qualified),
                        eccn_code = COALESCE(:eccn_code, eccn_code),
                        unit_price = COALESCE(:unit_price, unit_price),
                        currency = COALESCE(:currency, currency),
                        price_breaks = COALESCE(:price_breaks, price_breaks),
                        moq = COALESCE(:moq, moq),
                        lead_time_days = COALESCE(:lead_time_days, lead_time_days),
                        stock_status = COALESCE(:stock_status, stock_status),
                        quality_score = COALESCE(:quality_score, quality_score),
                        quality_metadata = COALESCE(:quality_metadata, quality_metadata),
                        supplier_data = COALESCE(:supplier_data, supplier_data),
                        ai_metadata = COALESCE(:ai_metadata, ai_metadata),
                        enrichment_source = :enrichment_source,
                        last_enriched_at = NOW(),
                        enrichment_count = enrichment_count + 1
                    WHERE id = :id
                    RETURNING id
                """)

                params = self._prepare_params(enrichment_data, component_id)
                params['enrichment_source'] = enrichment_source

                result = db.execute(query, params)
                db.commit()

                return str(component_id)

            else:
                # Insert new component
                component_id = str(uuid.uuid4())
                logger.info(f"🔵 DEBUG: About to INSERT new component: {mpn} (ID: {component_id})")
                logger.info(f"Inserting new component into catalog: {mpn} (ID: {component_id})")

                query = text("""
                    INSERT INTO component_catalog (
                        id,
                        manufacturer_part_number,
                        manufacturer,
                        category,
                        subcategory,
                        description,
                        datasheet_url,
                        image_url,
                        specifications,
                        lifecycle_status,
                        risk_level,
                        rohs_compliant,
                        reach_compliant,
                        halogen_free,
                        aec_qualified,
                        eccn_code,
                        unit_price,
                        currency,
                        price_breaks,
                        moq,
                        lead_time_days,
                        stock_status,
                        quality_score,
                        quality_metadata,
                        supplier_data,
                        ai_metadata,
                        enrichment_source,
                        last_enriched_at,
                        enrichment_count,
                        usage_count
                    ) VALUES (
                        :id,
                        :mpn,
                        :manufacturer,
                        :category,
                        :subcategory,
                        :description,
                        :datasheet_url,
                        :image_url,
                        :specifications,
                        :lifecycle_status,
                        :risk_level,
                        :rohs_compliant,
                        :reach_compliant,
                        :halogen_free,
                        :aec_qualified,
                        :eccn_code,
                        :unit_price,
                        :currency,
                        :price_breaks,
                        :moq,
                        :lead_time_days,
                        :stock_status,
                        :quality_score,
                        :quality_metadata,
                        :supplier_data,
                        :ai_metadata,
                        :enrichment_source,
                        NOW(),
                        1,
                        1
                    )
                    RETURNING id
                """)

                params = self._prepare_params(enrichment_data, component_id)
                params['mpn'] = mpn
                params['manufacturer'] = manufacturer
                params['enrichment_source'] = enrichment_source

                logger.info(f"🔵 DEBUG: Executing INSERT for {mpn}...")
                logger.info(f"🔵 DEBUG: Params keys: {list(params.keys())}")
                logger.info(f"🔵 DEBUG: Sample params - mpn={params.get('mpn')}, manufacturer={params.get('manufacturer')}, quality_score={params.get('quality_score')}, id={params.get('id')}")
                logger.info(f"🔵 DEBUG: Params type check - compliance={type(params.get('rohs_compliant'))}, parameters={type(params.get('parameters'))}")
                result = db.execute(query, params)
                logger.info(f"🔵 DEBUG: INSERT executed, committing...")
                db.commit()
                logger.info(f"🔵 DEBUG: Commit successful, returning ID: {component_id}")

                return component_id

        except Exception as e:
            logger.error(f"🔴 DEBUG: Exception in upsert_component!")
            logger.error(f"Error upserting component in catalog: {e}", exc_info=True)
            if db is not None:
                try:
                    db.rollback()
                except Exception as rollback_error:
                    logger.warning(f"Failed to rollback transaction: {rollback_error}", exc_info=True)
            logger.error(f"🔴 DEBUG: Returning None due to exception")
            return None
        finally:
            # Always close database session
            if db is not None:
                db.close()

    def _prepare_params(self, enrichment_data: Dict[str, Any], component_id: str) -> Dict[str, Any]:
        """Prepare parameters for SQL query from enrichment data"""
        import json

        return {
            'id': component_id,
            'category': enrichment_data.get('category'),
            'subcategory': enrichment_data.get('subcategory'),
            'description': enrichment_data.get('description'),
            # Taxonomy / Category Hierarchy (Phase 2)
            'category_path': enrichment_data.get('category_path'),
            'product_family': enrichment_data.get('product_family'),
            'product_series': enrichment_data.get('product_series'),
            'datasheet_url': enrichment_data.get('datasheet_url'),
            'image_url': enrichment_data.get('image_url'),
            'model_3d_url': enrichment_data.get('model_3d_url'),
            'specifications': json.dumps(enrichment_data.get('extracted_specs') or enrichment_data.get('specifications', {}), cls=DecimalEncoder),
            'lifecycle_status': enrichment_data.get('lifecycle_status'),
            'risk_level': enrichment_data.get('risk_level'),
            # Technical specs (Phase 1 addition)
            'package': enrichment_data.get('package'),
            # Compliance fields (expanded to include all from supplier APIs)
            'rohs_compliant': enrichment_data.get('rohs_compliant'),
            'reach_compliant': enrichment_data.get('reach_compliant'),
            'halogen_free': enrichment_data.get('halogen_free'),
            'aec_qualified': enrichment_data.get('aec_qualified'),
            'eccn_code': enrichment_data.get('eccn_code'),
            # Pricing & availability (Phase 1 expanded)
            'unit_price': enrichment_data.get('unit_price'),
            'currency': enrichment_data.get('currency', 'USD'),
            'price_breaks': json.dumps(enrichment_data.get('price_breaks', []), cls=DecimalEncoder),
            'moq': enrichment_data.get('moq'),
            'lead_time_days': enrichment_data.get('lead_time_days'),
            'stock_status': enrichment_data.get('stock_status') or enrichment_data.get('availability'),
            # Quality & metadata
            'quality_score': enrichment_data.get('quality_score'),
            'quality_metadata': json.dumps(enrichment_data.get('quality_metadata', {}), cls=DecimalEncoder),
            'supplier_data': json.dumps(enrichment_data.get('supplier_data', {}), cls=DecimalEncoder),
            'ai_metadata': json.dumps(enrichment_data.get('ai_metadata', {}), cls=DecimalEncoder),
        }

    def _increment_usage_async(self, db: Session, component_id: str):
        """Increment usage counter (called asynchronously, failures are logged but not raised)"""
        try:
            query = text("""
                UPDATE component_catalog
                SET
                    usage_count = usage_count + 1,
                    last_used_at = NOW()
                WHERE id = :id
            """)
            db.execute(query, {"id": component_id})
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to increment usage counter for {component_id}: {e}")
            try:
                db.rollback()
            except Exception as rollback_error:
                logger.warning(f"Failed to rollback transaction: {rollback_error}", exc_info=True)

    def _bulk_increment_usage(self, db: Session, component_ids: List[str]):
        """Bulk increment usage counters for multiple components"""
        if not component_ids:
            return

        try:
            query = text("""
                UPDATE component_catalog
                SET
                    usage_count = usage_count + 1,
                    last_used_at = NOW()
                WHERE id = ANY(:ids)
            """)
            db.execute(query, {"ids": component_ids})
            db.commit()
            logger.debug(f"✅ Incremented usage for {len(component_ids)} components")
        except Exception as e:
            logger.warning(f"Failed to bulk increment usage counters: {e}")
            try:
                db.rollback()
            except Exception:
                pass

    def search_components(
        self,
        search_term: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Search components by MPN, manufacturer, or description.

        Args:
            search_term: Search query (MPN, manufacturer name, or keyword)
            limit: Maximum results to return

        Returns:
            List of matching components
        """
        db = None
        try:
            db = next(self.dual_db.get_session("components"))

            query = text("""
                SELECT
                    id,
                    manufacturer_part_number,
                    manufacturer,
                    category,
                    description,
                    lifecycle_status,
                    risk_level,
                    quality_score,
                    usage_count
                FROM component_catalog
                WHERE
                    manufacturer_part_number ILIKE :search
                    OR manufacturer ILIKE :search
                    OR description ILIKE :search
                ORDER BY usage_count DESC, quality_score DESC
                LIMIT :limit
            """)

            result = db.execute(query, {
                "search": f"%{search_term}%",
                "limit": limit
            })

            components = [dict(row._mapping) for row in result.fetchall()]

            logger.info(f"Found {len(components)} components matching '{search_term}'")

            return components

        except Exception as e:
            logger.error(f"Error searching components: {e}", exc_info=True)
            return []
        finally:
            # Always close database session
            if db is not None:
                db.close()

    def get_popular_components(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get most popular components (by usage count).

        Args:
            limit: Maximum results to return

        Returns:
            List of popular components
        """
        db = None
        try:
            db = next(self.dual_db.get_session("components"))

            query = text("""
                SELECT
                    id,
                    manufacturer_part_number,
                    manufacturer,
                    category,
                    usage_count,
                    quality_score,
                    last_used_at
                FROM component_catalog
                ORDER BY usage_count DESC, quality_score DESC
                LIMIT :limit
            """)

            result = db.execute(query, {"limit": limit})

            components = [dict(row._mapping) for row in result.fetchall()]

            logger.info(f"Retrieved {len(components)} popular components")

            return components

        except Exception as e:
            logger.error(f"Error getting popular components: {e}", exc_info=True)
            return []
        finally:
            # Always close database session
            if db is not None:
                db.close()


# Global singleton instance
_catalog_service: Optional[ComponentCatalogService] = None


def get_component_catalog() -> ComponentCatalogService:
    """
    Get global component catalog service instance.

    Returns:
        ComponentCatalogService instance
    """
    global _catalog_service
    if _catalog_service is None:
        _catalog_service = ComponentCatalogService()
    return _catalog_service
