"""
Modular Component Enrichment Service

Coordinates multi-tier enrichment with configurable fallbacks:
- Tier 1: Local Catalog (always enabled, free, fast)
- Tier 2: Supplier APIs (Mouser, DigiKey, Element14) - configurable per supplier
- Tier 3: AI Enhancement (Ollama, OpenAI, Claude) - optional, UI toggle
- Tier 4: Web Scraping (manufacturer sites, datasheets) - optional, UI toggle

All tiers except Tier 1 can be bypassed via configuration or UI toggles.
"""

import logging
import os
import asyncio
from typing import Dict, Any, List, Optional
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from app.repositories.catalog_repository import CatalogRepository
from app.plugins.suppliers.manager import SupplierPluginManager
from app.core.quality_scorer import QualityScorer
from app.core.plugin_manager import get_plugin_manager
from app.core.enrichment_types import EnrichmentContext, UnifiedEnrichmentResult
from app.core.normalizers import normalize_component_data
from app.core.category_normalizer import normalize_vendor_category
from app.core.category_registry import (
    CategoryRegistryResolver,
    DualCategoryNormalizationMonitor,
)
from app.utils.supplier_response_store import get_supplier_response_store

logger = logging.getLogger(__name__)


class EnrichmentTier(str, Enum):
    """Enrichment tiers (in fallback order)"""
    CATALOG = "catalog"  # Always enabled
    SUPPLIERS = "suppliers"  # Configurable per supplier
    AI = "ai"  # Optional (UI toggle)
    WEB_SCRAPING = "web_scraping"  # Optional (UI toggle)


@dataclass
class EnrichmentConfig:
    """
    Configuration for enrichment process

    Can be set via:
    1. Environment variables (.env)
    2. Directus configuration
    3. API request parameters
    4. UI toggles (stored in Directus)
    """
    # Tier 2: Supplier APIs
    enable_suppliers: bool = True
    preferred_suppliers: Optional[List[str]] = None  # ["mouser", "digikey"]
    supplier_min_confidence: float = 90.0

    # Tier 3: AI Enhancement (OPTIONAL)
    enable_ai: bool = False  # Default OFF - must be explicitly enabled
    ai_provider: Optional[str] = None  # "ollama", "openai", "claude"
    ai_operations: List[str] = field(default_factory=lambda: ["category", "specs"])  # What to use AI for
    ai_min_confidence: float = 70.0

    # Tier 4: Web Scraping (OPTIONAL)
    enable_web_scraping: bool = False  # Default OFF
    scraping_sources: List[str] = field(default_factory=lambda: ["manufacturer", "datasheet"])
    scraping_timeout: int = 10  # seconds

    # Quality routing
    quality_reject_threshold: int = 70
    quality_staging_threshold: int = 94
    quality_auto_approve_threshold: int = 95

    # Processing options
    batch_size: int = 100
    max_retries: int = 2


@dataclass
class EnrichmentResult:
    """Result of enriching a single component"""
    mpn: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    quality_score: float = 0.0
    routing_destination: str = "rejected"  # "production", "staging", "rejected"
    tiers_used: List[str] = field(default_factory=list)
    ai_used: bool = False
    web_scraping_used: bool = False
    error: Optional[str] = None
    processing_time_ms: float = 0.0


class ModularEnrichmentService:
    """
    Modular enrichment service with configurable tiers

    Features:
    - Tier-based fallback system
    - Each tier can be enabled/disabled
    - UI-configurable via Directus
    - Statistics tracking per tier
    - Cost tracking for paid services
    """

    def __init__(
        self,
        db: Session,
        supplier_manager: Optional[SupplierPluginManager] = None,
        config: Optional[EnrichmentConfig] = None
    ):
        self.db = db
        self.supplier_manager = supplier_manager
        self.config = config or EnrichmentConfig()

        # Repositories
        self.catalog_repo = CatalogRepository(db)
        self.quality_scorer = QualityScorer()

        # Plugin manager for AI
        self.plugin_manager = get_plugin_manager()

        # Statistics
        self.stats = {
            'tier_catalog': 0,
            'tier_suppliers': 0,
            'tier_ai': 0,
            'tier_web_scraping': 0,
            'total_processed': 0,
            'total_success': 0,
            'total_failed': 0,
            'routed_production': 0,
            'routed_staging': 0,
            'routed_rejected': 0,
        }
        self.supplier_response_store = get_supplier_response_store()
        self.category_dual_monitor = self._init_dual_run_monitor()

    async def enrich_component(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        config_override: Optional[EnrichmentConfig] = None,
        context: Optional[EnrichmentContext] = None
    ) -> EnrichmentResult:
        """
        Enrich a single component using configured tiers

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name
            config_override: Override default configuration

        Returns:
            EnrichmentResult with data and metadata
        """
        # Validate required inputs
        if not mpn:
            logger.error("Invalid enrichment request: MPN is required")
            return EnrichmentResult(
                mpn=mpn or "UNKNOWN",
                success=False,
                error="MPN cannot be empty"
            )
        
        start_time = datetime.now()
        config = config_override or self.config
        tiers_used = []

        result = EnrichmentResult(
            mpn=mpn,
            success=False
        )

        try:
            # TIER 1: Local Catalog (always enabled, always first)
            #
            # Important: any catalog lookup failure (including missing
            # tables in a given environment) should NOT prevent
            # supplier-based enrichment from running. We catch and
            # log catalog errors here so Tier 2 can still execute.
            logger.info(f"[Tier 1] Checking local catalog: {mpn}")
            try:
                catalog_data = await self._enrich_from_catalog(mpn)
            except Exception as catalog_error:
                logger.warning(
                    "[Tier 1] Catalog lookup failed, skipping catalog tier: %s",
                    catalog_error,
                    exc_info=True,
                )
                catalog_data = None

            if catalog_data:
                logger.info(f"✅ [Tier 1] Found in catalog: {mpn}")
                result.data = catalog_data
                result.success = True
                tiers_used.append(EnrichmentTier.CATALOG)
                self.stats['tier_catalog'] += 1

                # Calculate quality and routing
                quality = await self._calculate_quality(result.data)
                result.quality_score = quality
                result.routing_destination = self._route_by_quality(quality, config)

            # TIER 2: Supplier APIs (if enabled and not found in catalog)
            if not result.success and config.enable_suppliers and self.supplier_manager:
                logger.info(f"[Tier 2] Querying supplier APIs: {mpn}")
                supplier_data = await self._enrich_from_suppliers(
                    mpn, manufacturer, config, context=context
                )

                if supplier_data:
                    logger.info(f"✅ [Tier 2] Found via suppliers: {mpn}")
                    result.data = supplier_data
                    result.success = True
                    tiers_used.append(EnrichmentTier.SUPPLIERS)
                    self.stats['tier_suppliers'] += 1

                    # Calculate quality
                    quality = await self._calculate_quality(result.data)
                    result.quality_score = quality
                    result.routing_destination = self._route_by_quality(quality, config)

            # TIER 3: AI Enhancement (OPTIONAL - only if enabled via UI)
            if result.success and config.enable_ai:
                logger.info(f"[Tier 3] Applying AI enhancement: {mpn}")
                ai_enhanced = await self._apply_ai_enhancement(result.data, config)

                if ai_enhanced:
                    logger.info(f"✅ [Tier 3] AI enhanced: {mpn}")
                    result.data = ai_enhanced
                    result.ai_used = True
                    tiers_used.append(EnrichmentTier.AI)
                    self.stats['tier_ai'] += 1

                    # Recalculate quality after AI enhancement
                    quality = await self._calculate_quality(result.data)
                    result.quality_score = quality
                    result.routing_destination = self._route_by_quality(quality, config)

            # TIER 4: Web Scraping (OPTIONAL - only if enabled and low quality)
            if (result.success and
                config.enable_web_scraping and
                result.quality_score < config.quality_auto_approve_threshold):

                logger.info(f"[Tier 4] Applying web scraping fallback: {mpn}")
                scraped_data = await self._enrich_from_web_scraping(
                    mpn, manufacturer, result.data, config
                )

                if scraped_data:
                    logger.info(f"✅ [Tier 4] Web scraping enhanced: {mpn}")
                    result.data = scraped_data
                    result.web_scraping_used = True
                    tiers_used.append(EnrichmentTier.WEB_SCRAPING)
                    self.stats['tier_web_scraping'] += 1

                    # Recalculate quality
                    quality = await self._calculate_quality(result.data)
                    result.quality_score = quality
                    result.routing_destination = self._route_by_quality(quality, config)

            if not result.success:
                logger.warning(f"❌ All tiers failed: {mpn}")
                result.error = "Component not found in any tier"
                self.stats['total_failed'] += 1
            else:
                self.stats['total_success'] += 1

                # Update routing stats
                if result.routing_destination == "production":
                    self.stats['routed_production'] += 1
                elif result.routing_destination == "staging":
                    self.stats['routed_staging'] += 1
                else:
                    self.stats['routed_rejected'] += 1

        except Exception as e:
            logger.error(f"Enrichment error for {mpn}: {e}")
            result.error = str(e)
            self.stats['total_failed'] += 1

        finally:
            # Calculate processing time
            elapsed = (datetime.now() - start_time).total_seconds() * 1000
            result.processing_time_ms = elapsed
            result.tiers_used = tiers_used
            self.stats['total_processed'] += 1

        return result

    async def enrich_component_unified(
        self,
        mpn: str,
        manufacturer: Optional[str],
        context: EnrichmentContext,
        config_override: Optional[EnrichmentConfig] = None,
    ) -> UnifiedEnrichmentResult:
        """Adapter that exposes a unified enrichment result.

        This method wraps the existing enrich_component logic so that
        callers like BOMEnrichmentWorkflow can depend on the shared
        EnrichmentContext/UnifiedEnrichmentResult types without
        changing the underlying tier logic.
        """

        base_result = await self.enrich_component(
            mpn=mpn,
            manufacturer=manufacturer,
            config_override=config_override,
            context=context,
        )

        # Optional: write normalized data to audit trail when we
        # have BOM/line-item context. This centralizes the
        # "normalized_data" audit for all callers using the
        # unified enrichment path.
        if base_result.success and base_result.data and context.bom_id and context.line_item_id:
            try:
                from app.utils.enrichment_audit import get_audit_writer

                audit_writer = get_audit_writer()
                audit_writer.save_normalized_data(
                    job_id=context.bom_id,
                    line_id=context.line_item_id,
                    mpn=mpn,
                    manufacturer=manufacturer,
                    normalized_data=base_result.data,
                )
            except Exception as e:  # pragma: no cover - best-effort audit
                logger.warning(
                    "Failed to save normalized data to audit trail",
                    exc_info=True,
                    extra={
                        'bom_id': context.bom_id,
                        'line_item_id': context.line_item_id,
                        'mpn': mpn,
                        'error': str(e),
                    },
                )

        return UnifiedEnrichmentResult(
            mpn=base_result.mpn,
            success=base_result.success,
            data=base_result.data,
            quality_score=base_result.quality_score,
            routing_destination=base_result.routing_destination,
            tiers_used=base_result.tiers_used,
            ai_used=base_result.ai_used,
            web_scraping_used=base_result.web_scraping_used,
            error=base_result.error,
            processing_time_ms=base_result.processing_time_ms,
        )

    def _init_dual_run_monitor(self) -> Optional[DualCategoryNormalizationMonitor]:
        """Configure dual-run instrumentation without impacting production output."""
        flag = os.getenv("CATEGORY_REGISTRY_DUAL_RUN", "0").strip().lower()
        enabled = flag in {"1", "true", "yes", "on"}
        if not enabled:
            return None

        table_name = os.getenv("CATEGORY_REGISTRY_TABLE", "vendor_category_mappings_stage").strip()
        min_conf_default = os.getenv("CATEGORY_REGISTRY_MIN_CONFIDENCE", "0.0").strip()
        experiment_name = os.getenv("CATEGORY_REGISTRY_EXPERIMENT_NAME", "category-registry-shadow").strip() or "category-registry-shadow"

        try:
            minimum_confidence = float(min_conf_default)
        except ValueError:
            minimum_confidence = 0.0

        try:
            resolver = CategoryRegistryResolver(
                self.db,
                table_name=table_name,
                minimum_confidence=minimum_confidence,
            )
        except Exception as exc:  # pragma: no cover - config issues shouldn't block service
            logger.warning(
                "Category registry dual-run disabled",
                exc_info=True,
                extra={
                    "table": table_name,
                    "error": str(exc),
                },
            )
            return None

        logger.info(
            "Category registry dual-run enabled",
            extra={
                "table": table_name,
                "experiment": experiment_name,
                "minimum_confidence": minimum_confidence,
            },
        )
        return DualCategoryNormalizationMonitor(resolver, experiment_name=experiment_name)

    async def _enrich_from_catalog(self, mpn: str) -> Optional[Dict[str, Any]]:
        """Tier 1: Check local catalog"""
        component = self.catalog_repo.get_by_mpn(mpn)

        if not component:
            return None

        # Build raw component-style dict from catalog model
        raw_data: Dict[str, Any] = {
            'mpn': component.mpn,
            'manufacturer': component.manufacturer.name if component.manufacturer else None,
            'manufacturer_id': component.manufacturer_id,
            'category': component.category.name if component.category else None,
            'category_id': component.category_id,
            'description': component.description,
            'datasheet_url': component.datasheet_url,
            'image_url': getattr(component, 'image_url', None),
            'model_3d_url': getattr(component, 'model_3d_url', None),
            'lifecycle_status': getattr(component, 'lifecycle', None),
            'specifications': component.specifications or {},
            'pricing': component.pricing or [],
            'quality_score': float(component.quality_score),
        }

        # Normalize using the shared normalization engine for consistency
        normalized = normalize_component_data(raw_data)
        normalized['enrichment_source'] = 'catalog'
        normalized['tier_used'] = 'catalog'

        return normalized

    async def _enrich_from_suppliers(
        self,
        mpn: str,
        manufacturer: Optional[str],
        config: EnrichmentConfig,
        context: Optional[EnrichmentContext] = None
    ) -> Optional[Dict[str, Any]]:
        """Tier 2: Query supplier APIs"""
        if not self.supplier_manager:
            return None

        product_data = self.supplier_manager.get_best_match(
            mpn=mpn,
            manufacturer=manufacturer,
            min_confidence=config.supplier_min_confidence
        )

        if not product_data:
            return None

        # Build raw component-style dict from supplier product data
        # IMPORTANT: Extract ALL fields from SupplierProductData to avoid data loss
        raw_data: Dict[str, Any] = {
            # Basic identification
            'mpn': product_data.mpn,
            'manufacturer': product_data.manufacturer,
            'description': product_data.description,
            'category': product_data.category,

            # Taxonomy / Category Hierarchy (Phase 2)
            'category_path': product_data.category_path,
            'subcategory': product_data.subcategory,
            'product_family': product_data.product_family,
            'product_series': product_data.product_series,

            # Documentation & Media
            'datasheet_url': product_data.datasheet_url,
            'image_url': product_data.image_url,
            'model_3d_url': product_data.model_3d_url,

            # Lifecycle & Packaging
            'lifecycle_status': product_data.lifecycle_status,
            'package': product_data.package,

            # Pricing & Availability (TOP LEVEL - critical for normalization)
            'unit_price': product_data.unit_price,
            'currency': product_data.currency,
            'price_breaks': product_data.price_breaks,
            'availability': product_data.availability,
            'stock_quantity': product_data.availability,  # Map for quality scorer HIGH_PRIORITY_FIELDS
            'lead_time_days': product_data.lead_time_days,

            # Compliance Fields (CRITICAL - were being dropped!)
            'rohs_compliant': product_data.rohs_compliant,
            'reach_compliant': product_data.reach_compliant,
            'halogen_free': product_data.halogen_free,
            'aec_qualified': product_data.aec_qualified,
            'eccn_code': product_data.eccn_code,

            # Supplier reference (for quality scorer RECOMMENDED_FIELDS)
            'supplier_part_number': product_data.supplier_sku,

            # Additional RECOMMENDED_FIELDS for quality scoring
            # Extract from parameters dict if available (DigiKey stores these there)
            'packaging': product_data.parameters.get('packaging') if product_data.parameters else None,
            'minimum_order_quantity': product_data.parameters.get('minimum_order_quantity') if product_data.parameters else None,
            'hts_code': product_data.parameters.get('hts_code') if product_data.parameters else None,
        }

        # Attach supplier-specific metadata under supplier_data
        # (for audit trail and reference, not for normalization)
        raw_data['supplier_data'] = {
            'supplier_name': product_data.supplier_name,
            'supplier_sku': product_data.supplier_sku,
            'supplier_url': product_data.supplier_url,
            'match_confidence': product_data.match_confidence,
            'last_updated': product_data.last_updated.isoformat() if getattr(product_data, 'last_updated', None) else None,
        }

        # Add parameters as extracted specs for normalization
        # The normalizer will process these and merge into extracted_specs
        raw_data['parameters'] = product_data.parameters or {}

        # CRITICAL FIX: Normalize vendor-specific parameters (e.g. "Operating Temperature" -> "temp_range")
        # This bridges the gap between raw vendor data and canonical fields
        from app.core.normalizers import normalize_vendor_parameters
        if raw_data.get('parameters'):
            normalized_params = normalize_vendor_parameters(raw_data['parameters'])
            # Merge normalized params into raw_data so normalize_component_data can see them
            # This ensures fields like 'temp_range', 'voltage', etc. are populated
            raw_data.update(normalized_params)

        # Normalize all fields (MPN, prices, specs, etc.)
        normalized = normalize_component_data(raw_data)

        # Normalize vendor category to canonical category when possible
        vendor_name = (product_data.supplier_name or '').lower()
        vendor_category = product_data.category
        canonical_category: Optional[str] = None
        confidence: Optional[float] = None
        method: Optional[str] = None

        if normalized.get('category') and vendor_category:
            canonical_category, confidence, method = normalize_vendor_category(
                vendor=vendor_name,
                vendor_category=vendor_category,
            )

        if canonical_category and confidence is not None and confidence >= 0.7:
            normalized['category'] = canonical_category
            normalized['category_normalization_method'] = method

        if confidence is not None:
            normalized['category_confidence'] = confidence

        if vendor_category:
            # Keep vendor category for shadow comparisons even when canonical mapping wins
            normalized['vendor_category'] = vendor_category

        if self.category_dual_monitor and vendor_name and vendor_category:
            self.category_dual_monitor.compare(
                vendor=vendor_name,
                vendor_category=vendor_category,
                mpn=mpn,
                legacy_category=normalized.get('category'),
                legacy_confidence=normalized.get('category_confidence'),
            )

        # Mark enrichment source / tier for downstream consumers
        normalized['enrichment_source'] = 'supplier_api'
        normalized['api_source'] = product_data.supplier_name
        normalized['tier_used'] = 'suppliers'

        # CRITICAL: Ensure quality scorer fields are populated (re-map after normalization)
        # These mappings ensure HIGH_PRIORITY_FIELDS and RECOMMENDED_FIELDS are present
        if product_data.availability is not None and 'stock_quantity' not in normalized:
            normalized['stock_quantity'] = product_data.availability
        if product_data.supplier_sku and 'supplier_part_number' not in normalized:
            normalized['supplier_part_number'] = product_data.supplier_sku

        # Additional RECOMMENDED_FIELDS safety checks (packaging, minimum_order_quantity, hts_code)
        if product_data.parameters:
            if 'packaging' not in normalized and product_data.parameters.get('packaging'):
                normalized['packaging'] = product_data.parameters.get('packaging')
            if 'minimum_order_quantity' not in normalized and product_data.parameters.get('minimum_order_quantity'):
                normalized['minimum_order_quantity'] = product_data.parameters.get('minimum_order_quantity')
            if 'hts_code' not in normalized and product_data.parameters.get('hts_code'):
                normalized['hts_code'] = product_data.parameters.get('hts_code')

        # Persist raw supplier payload for admin review (if context available)
        # Use asyncio.to_thread to avoid blocking the event loop with synchronous SQL
        try:
            if context and (context.bom_id or context.line_item_id):
                payload = product_data.to_dict()
                await asyncio.to_thread(
                    self.supplier_response_store.save_response,
                    job_id=context.bom_id,
                    line_id=context.line_item_id,
                    mpn=mpn,
                    manufacturer=manufacturer,
                    vendor=product_data.supplier_name,
                    payload=payload,
                    normalized=normalized,
                )
        except Exception as exc:
            logger.debug(f"Failed to store supplier response for {mpn}: {exc}")

        return normalized

    async def _apply_ai_enhancement(
        self,
        component_data: Dict[str, Any],
        config: EnrichmentConfig
    ) -> Optional[Dict[str, Any]]:
        """Tier 3: Apply AI enhancement (OPTIONAL)"""
        if not config.enable_ai:
            return None

        try:
            ai_provider = self.plugin_manager.get_ai_provider()

            if not ai_provider:
                logger.warning("AI provider not available")
                return None

            enhanced_data = component_data.copy()

            # AI operation: Category suggestion
            if "category" in config.ai_operations and not component_data.get('category'):
                suggestion = await ai_provider.suggest_category(
                    description=component_data.get('description', ''),
                    mpn=component_data.get('mpn', ''),
                    manufacturer=component_data.get('manufacturer')
                )

                if suggestion and suggestion.get('confidence', 0) >= config.ai_min_confidence:
                    enhanced_data['category'] = suggestion.get('suggestion')
                    enhanced_data['category_ai_confidence'] = suggestion.get('confidence')

            # AI operation: Specification extraction
            if "specs" in config.ai_operations:
                specs = await ai_provider.extract_specifications(
                    description=component_data.get('description', ''),
                    mpn=component_data.get('mpn', ''),
                    category=component_data.get('category')
                )

                if specs:
                    # Merge with existing specs
                    existing_specs = enhanced_data.get('specifications', {})
                    enhanced_data['specifications'] = {**existing_specs, **specs}
                    enhanced_data['specifications_ai_enhanced'] = True

            enhanced_data['ai_enhanced'] = True
            enhanced_data['ai_provider'] = config.ai_provider or "default"

            return enhanced_data

        except Exception as e:
            logger.error(f"AI enhancement error: {e}")
            return None

    async def _enrich_from_web_scraping(
        self,
        mpn: str,
        manufacturer: Optional[str],
        existing_data: Dict[str, Any],
        config: EnrichmentConfig
    ) -> Optional[Dict[str, Any]]:
        """Tier 4: Web scraping fallback (OPTIONAL)"""
        if not config.enable_web_scraping:
            return None

        # TODO: Implement web scraping in Phase 7
        # This will scrape:
        # - Manufacturer product pages
        # - Datasheet PDFs
        # - Distributor listings (non-API)

        logger.info(f"Web scraping not yet implemented for {mpn}")
        return None

    async def _calculate_quality(self, component_data: Dict[str, Any]) -> float:
        """Calculate quality score for component data"""
        quality_result = self.quality_scorer.calculate_quality_score(component_data)
        return quality_result.total_score

    def _route_by_quality(
        self,
        quality_score: float,
        config: EnrichmentConfig
    ) -> str:
        """Route component based on quality score"""
        if quality_score >= config.quality_auto_approve_threshold:
            return "production"
        elif quality_score >= config.quality_reject_threshold:
            return "staging"
        else:
            return "rejected"

    def get_stats(self) -> Dict[str, Any]:
        """Get enrichment statistics"""
        stats = self.stats.copy()
        if self.category_dual_monitor:
            stats['dual_run_category'] = self.category_dual_monitor.get_stats()
        return stats

    def reset_stats(self):
        """Reset statistics"""
        self.stats = {k: 0 for k in self.stats}
        if self.category_dual_monitor:
            self.category_dual_monitor.reset()
