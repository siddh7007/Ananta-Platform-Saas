"""
Supplier Plugin Manager

Handles loading, configuration, and usage of supplier API plugins.

CRITICAL-7 Integration:
- Circuit breaker pattern prevents cascading failures from vendor APIs
- Retry policy handles transient errors with exponential backoff
- Per-vendor error handling isolates failures to individual suppliers
"""

import logging
from typing import List, Optional, Dict, Any
from enum import Enum
import asyncio

from .base import SupplierPlugin, SupplierSearchResult, SupplierProductData, SupplierAPIError
from .digikey import DigiKeyPlugin
from .mouser import MouserPlugin
from .element14 import Element14Plugin
from app.core.circuit_breaker import sync_circuit_breaker_manager, CircuitBreaker
from app.core.retry_policy import RetryPolicy, RetryConfig
from app.core.enrichment_config_loader import get_enrichment_config
from app.utils.rate_limiter import RateLimiter
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class SupplierName(str, Enum):
    """Supported supplier names"""
    DIGIKEY = 'digikey'
    MOUSER = 'mouser'
    ELEMENT14 = 'element14'


# Plugin registry mapping supplier name to plugin class
SUPPLIER_PLUGINS = {
    SupplierName.DIGIKEY: DigiKeyPlugin,
    SupplierName.MOUSER: MouserPlugin,
    SupplierName.ELEMENT14: Element14Plugin,
}


class SupplierPluginManager:
    """
    Manages supplier API plugins.

    Handles:
    - Plugin initialization and configuration
    - Multi-supplier search with fallback
    - Plugin health checking
    - Rate limit management
    """

    def __init__(self, config: Dict[str, Dict[str, Any]], db_session=None):
        """
        Initialize plugin manager with supplier configurations.

        Args:
            config: Dictionary of supplier configs:
            {
                "digikey": {
                    "client_id": "...",
                    "client_secret": "...",
                    "access_token": "...",
                    "enabled": true
                },
                "mouser": {
                    "api_key": "...",
                    "enabled": true
                },
                "element14": {
                    "api_key": "...",
                    "store": "us",
                    "enabled": false
                }
            }
            db_session: Optional SQLAlchemy database session for loading config from database
        """
        self.plugins: Dict[str, SupplierPlugin] = {}
        self.circuit_breakers: Dict[str, Any] = {}  # Per-vendor circuit breakers
        self.retry_policies: Dict[str, RetryPolicy] = {}  # Per-vendor retry policies
        self.rate_limiter = RateLimiter() # Redis-backed rate limiter
        self.db_session = db_session
        self._initialize_plugins(config)
        self._initialize_resilience_patterns()

    def _initialize_plugins(self, config: Dict[str, Dict[str, Any]]) -> None:
        """Initialize all configured plugins"""
        for supplier_name, plugin_class in SUPPLIER_PLUGINS.items():
            supplier_config = config.get(supplier_name, {})

            # Skip if not enabled
            if not supplier_config.get('enabled', False):
                logger.info(f"⏭️  Supplier plugin '{supplier_name}' is disabled")
                continue

            try:
                plugin = plugin_class(supplier_config)
                self.plugins[supplier_name] = plugin
                logger.info(f"✅ Initialized supplier plugin: {supplier_name}")
            except Exception as e:
                logger.error(f"❌ Failed to initialize {supplier_name} plugin: {e}")

    def _initialize_resilience_patterns(self) -> None:
        """
        Initialize circuit breakers and retry policies for all enabled suppliers.

        CRITICAL-7: Resilience patterns prevent cascading failures and handle transients.
        Configuration now loaded from database (cns_enrichment_config table) with fallback to defaults.

        Circuit breaker settings (database-driven):
        - circuit_breaker_enabled: Enable/disable circuit breaker pattern (default: false)
        - circuit_breaker_failure_threshold: Consecutive failures to open circuit (default: 5)
        - circuit_breaker_timeout_seconds: Wait time before attempting to close (default: 60)
        - circuit_breaker_success_threshold: Consecutive successes to close circuit (default: 2)

        Retry policy settings (database-driven):
        - retry_enabled: Enable/disable retry policy (default: false)
        - retry_max_attempts: Maximum retry attempts (default: 3)
        - retry_initial_delay_seconds: Initial delay before first retry (default: 1.0)
        - retry_exponential_base: Exponential backoff multiplier (default: 2.0)
        - retry_max_delay_seconds: Maximum delay between retries (default: 30.0)
        - retry_jitter_enabled: Add random jitter to prevent thundering herd (default: true)
        """
        # Load configuration from database with fallback to defaults
        config = get_enrichment_config(self.db_session)

        # Get circuit breaker configuration
        cb_enabled = config.get_bool('circuit_breaker_enabled', default=False)
        cb_failure_threshold = config.get_int('circuit_breaker_failure_threshold', default=5)
        cb_timeout_seconds = config.get_int('circuit_breaker_timeout_seconds', default=60)
        cb_success_threshold = config.get_int('circuit_breaker_success_threshold', default=2)

        # Get retry policy configuration
        retry_enabled = config.get_bool('retry_enabled', default=False)
        retry_max_attempts = config.get_int('retry_max_attempts', default=3)
        retry_initial_delay = config.get_float('retry_initial_delay_seconds', default=1.0)
        retry_exponential_base = config.get_float('retry_exponential_base', default=2.0)
        retry_max_delay = config.get_float('retry_max_delay_seconds', default=30.0)
        retry_jitter = config.get_bool('retry_jitter_enabled', default=True)

        for supplier_name in self.plugins.keys():
            # Initialize per-vendor circuit breaker with database-driven config
            breaker_name = f"{supplier_name}_api"

            # Create circuit breaker instance if enabled
            breaker_instance = None
            if cb_enabled:
                try:
                    breaker_instance = sync_circuit_breaker_manager.get_or_create(
                        name=breaker_name,
                        failure_threshold=cb_failure_threshold,
                        success_threshold=cb_success_threshold,
                        timeout=cb_timeout_seconds
                    )
                    logger.info(f"✅ Created circuit breaker for {supplier_name}: {breaker_name}")
                except Exception as e:
                    logger.error(f"❌ Failed to create circuit breaker for {supplier_name}: {e}")

            self.circuit_breakers[supplier_name] = {
                'instance': breaker_instance,
                'name': breaker_name,
                'failure_threshold': cb_failure_threshold,
                'timeout': cb_timeout_seconds,
                'success_threshold': cb_success_threshold,
                'enabled': cb_enabled
            }

            # Initialize per-vendor retry policy with database-driven config
            # Always create RetryPolicy instance (even if disabled) to avoid None errors
            self.retry_policies[supplier_name] = RetryPolicy(
                RetryConfig(
                    max_retries=retry_max_attempts,
                    initial_delay=retry_initial_delay,
                    exponential_base=retry_exponential_base,
                    max_delay=retry_max_delay,
                    jitter=retry_jitter
                )
            )

            logger.info(
                f"✅ Initialized resilience patterns for {supplier_name} "
                f"(CB: {cb_enabled} [{cb_failure_threshold}/{cb_timeout_seconds}s], "
                f"Retry: {retry_enabled} [{retry_max_attempts}x])"
            )

    def _get_circuit_breaker(self, supplier_name: str) -> Optional[CircuitBreaker]:
        """Get circuit breaker for supplier (synchronous)"""
        cb_config = self.circuit_breakers.get(supplier_name)
        if not cb_config:
            return None

        if not cb_config.get('enabled', False):
            return None

        return cb_config.get('instance')

    def _get_retry_policy(self, supplier_name: str) -> Optional[RetryPolicy]:
        """Get retry policy for supplier"""
        return self.retry_policies.get(supplier_name)

    def search_by_mpn(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        preferred_suppliers: Optional[List[str]] = None,
        limit: int = 10
    ) -> Dict[str, List[SupplierSearchResult]]:
        """
        Search for component across multiple suppliers with resilience patterns.

        CRITICAL-7: Implements circuit breaker and retry policy
        - Circuit breaker prevents cascading failures from unavailable APIs
        - Retry policy handles transient errors (timeouts, connection issues)
        - Per-vendor isolation: one vendor's failure doesn't affect others

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name
            preferred_suppliers: List of supplier names to try (in order)
            limit: Maximum results per supplier

        Returns:
            Dictionary mapping supplier name to search results:
            {
                "digikey": [SupplierSearchResult(...), ...],
                "mouser": [SupplierSearchResult(...), ...]
            }
        """
        results = {}

        # Determine which suppliers to query
        if preferred_suppliers:
            suppliers_to_query = [s for s in preferred_suppliers if s in self.plugins]
        else:
            suppliers_to_query = list(self.plugins.keys())

        # Query each supplier with resilience patterns
        for supplier_name in suppliers_to_query:
            plugin = self.plugins.get(supplier_name)
            if not plugin or not plugin.enabled:
                continue

            # Get circuit breaker and retry policy for this vendor
            circuit_breaker = self._get_circuit_breaker(supplier_name)
            retry_policy = self._get_retry_policy(supplier_name)

            try:
                # Check rate limit before making request
                # Default limits: DigiKey 1000/hr, Mouser 1000/hr, Element14 500/hr
                rate_limit_max = 1000
                if supplier_name == 'element14':
                    rate_limit_max = 500

                try:
                    self.rate_limiter.check_rate_limit(
                        identifier=f"supplier:{supplier_name}",
                        max_requests=rate_limit_max,
                        window_seconds=3600
                    )
                except HTTPException as e:
                    if e.status_code == 429:
                        logger.warning(f"[RATE_LIMIT] {supplier_name}: Rate limit exceeded ({rate_limit_max}/hr), skipping")
                        continue
                    raise e

                # Check circuit breaker first
                if circuit_breaker and not circuit_breaker.can_execute():
                    logger.warning(f"[CIRCUIT_OPEN] {supplier_name}: Circuit breaker is OPEN, skipping")
                    continue

                # Execute search with circuit breaker protection
                # Note: Retry policy available but disabled by default in config
                supplier_results = plugin.search_by_mpn(mpn, manufacturer, limit)

                # Record success in circuit breaker
                if circuit_breaker:
                    circuit_breaker.record_success()

                if supplier_results:
                    results[supplier_name] = supplier_results
                    logger.info(f"[OK] {supplier_name}: found {len(supplier_results)} results")
                else:
                    logger.info(f"[WARN] {supplier_name}: no results found")

            except SupplierAPIError as e:
                # Record failure in circuit breaker
                if circuit_breaker:
                    circuit_breaker.record_failure(e)

                logger.error(f"[ERROR] {supplier_name} search error: {e}")
                # Continue with other suppliers (isolation)
            except TimeoutError as e:
                # Transient error - circuit breaker tracks this
                if circuit_breaker:
                    circuit_breaker.record_failure(e)
                
                logger.error(f"❌ {supplier_name} timeout: {e}")
            except ConnectionError as e:
                # Transient error - circuit breaker tracks this
                if circuit_breaker:
                    circuit_breaker.record_failure(e)
                
                logger.error(f"❌ {supplier_name} connection error: {e}")
            except Exception as e:
                # Unexpected error - circuit breaker tracks this
                if circuit_breaker:
                    circuit_breaker.record_failure(e)
                
                logger.error(f"❌ {supplier_name} unexpected error: {e}")

        return results

    def get_product_details(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        preferred_suppliers: Optional[List[str]] = None
    ) -> Optional[SupplierProductData]:
        """
        Get product details from the first available supplier with resilience patterns.

        CRITICAL-7: Implements circuit breaker, retry policy, and caching
        - Circuit breaker prevents cascading failures from unavailable APIs
        - Retry policy handles transient errors (timeouts, connection issues)
        - Redis caching reduces API calls (7-day TTL)
        - Per-vendor isolation: one vendor's failure doesn't affect others

        Tries suppliers in order until one returns data.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name
            preferred_suppliers: List of supplier names to try (in order)

        Returns:
            Product data from first successful supplier, or None
        """
        from app.cache.supplier_cache import get_cached_supplier_response, set_cached_supplier_response

        # Determine which suppliers to query
        if preferred_suppliers:
            suppliers_to_query = [s for s in preferred_suppliers if s in self.plugins]
        else:
            suppliers_to_query = list(self.plugins.keys())

        # Try each supplier until one succeeds
        for supplier_name in suppliers_to_query:
            plugin = self.plugins.get(supplier_name)
            if not plugin or not plugin.enabled:
                continue

            # Get circuit breaker and retry policy for this vendor
            circuit_breaker = self._get_circuit_breaker(supplier_name)
            retry_policy = self._get_retry_policy(supplier_name)

            # Check rate limit before making request
            try:
                # Default limits: DigiKey 1000/hr, Mouser 1000/hr, Element14 500/hr
                limit = 1000
                if supplier_name == 'element14':
                    limit = 500
                
                self.rate_limiter.check_rate_limit(
                    identifier=f"supplier:{supplier_name}",
                    max_requests=limit,
                    window_seconds=3600
                )
            except HTTPException as e:
                if e.status_code == 429:
                    logger.warning(f"⏳ {supplier_name}: Rate limit exceeded ({limit}/hr), skipping")
                    continue
                # Ignore other HTTP exceptions from rate limiter (shouldn't happen)

            # Check circuit breaker first
            if circuit_breaker and not circuit_breaker.can_execute():
                logger.warning(f"⏸️  {supplier_name}: Circuit breaker is OPEN, skipping")
                continue

            # ============================================================================
            # CACHE CHECK: Look for cached response first
            # ============================================================================
            cached_data = get_cached_supplier_response(supplier_name, mpn, manufacturer)
            if cached_data:
                # Convert dict back to SupplierProductData
                try:
                    product_data = SupplierProductData(**cached_data)
                    logger.info(f"✅ {supplier_name}: cache hit for '{mpn}'")
                    return product_data
                except Exception as e:
                    logger.warning(f"Failed to deserialize cached data: {e}")
                    # Fall through to API call

            # ============================================================================
            # CACHE MISS: Call supplier API with retry policy and circuit breaker
            # ============================================================================
            try:
                # Execute with circuit breaker protection
                # Note: Retry policy available but disabled by default in config
                product_data = plugin.get_product_details(mpn, manufacturer)

                if product_data:
                    # Record success in circuit breaker
                    if circuit_breaker:
                        circuit_breaker.record_success()
                    
                    logger.info(f"✅ {supplier_name}: found product details for '{mpn}'")

                    # Cache the response for future requests
                    try:
                        # Convert SupplierProductData to dict for caching
                        product_dict = {
                            'supplier_name': product_data.supplier_name,
                            'mpn': product_data.mpn,
                            'manufacturer': product_data.manufacturer,
                            'category': product_data.category,
                            'description': product_data.description,
                            'unit_price': product_data.unit_price,
                            'currency': product_data.currency,
                            'availability': product_data.availability,
                            'lifecycle_status': product_data.lifecycle_status,
                            'datasheet_url': product_data.datasheet_url,
                            'image_url': product_data.image_url,
                            'package': product_data.package,
                            'parameters': product_data.parameters,
                            'price_breaks': product_data.price_breaks,
                            'rohs_compliant': product_data.rohs_compliant,
                            'reach_compliant': product_data.reach_compliant,
                            'halogen_free': product_data.halogen_free,
                            'aec_qualified': product_data.aec_qualified,
                            'lead_time_days': product_data.lead_time_days,
                            'minimum_order_quantity': product_data.minimum_order_quantity,
                            'packaging': product_data.packaging,
                            'supplier_sku': product_data.supplier_sku,
                            'supplier_url': product_data.supplier_url,
                            'eccn_code': product_data.eccn_code,
                            'hts_code': product_data.hts_code,
                            'match_confidence': product_data.match_confidence,
                            'last_updated': product_data.last_updated.isoformat() if product_data.last_updated else None
                        }
                        set_cached_supplier_response(supplier_name, mpn, product_dict, manufacturer)
                    except Exception as e:
                        logger.warning(f"Failed to cache supplier response: {e}")

                    return product_data
                else:
                    logger.info(f"⚠️  {supplier_name}: no product found for '{mpn}'")

            except SupplierAPIError as e:
                # Record failure in circuit breaker
                if circuit_breaker:
                    circuit_breaker.record_failure(e)
                
                logger.error(f"❌ {supplier_name} error: {e}")
                # Continue with next supplier
            except TimeoutError as e:
                # Record transient failure in circuit breaker
                if circuit_breaker:
                    circuit_breaker.record_failure(e)
                
                logger.error(f"❌ {supplier_name} timeout: {e}")
            except ConnectionError as e:
                # Record transient failure in circuit breaker
                if circuit_breaker:
                    circuit_breaker.record_failure(e)
                
                logger.error(f"❌ {supplier_name} connection error: {e}")
            except Exception as e:
                # Record unexpected failure in circuit breaker
                if circuit_breaker:
                    circuit_breaker.record_failure(e)
                
                logger.error(f"❌ {supplier_name} unexpected error: {e}")

        logger.warning(f"⚠️  No supplier could provide details for '{mpn}'")
        return None

    def get_best_match(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        min_confidence: float = 90.0
    ) -> Optional[SupplierProductData]:
        """
        Get the best matching product across all suppliers.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name
            min_confidence: Minimum match confidence threshold (0-100)

        Returns:
            Best matching product or None
        """
        all_results = self.search_by_mpn(mpn, manufacturer)

        best_match = None
        best_confidence = 0.0

        for supplier_name, search_results in all_results.items():
            for result in search_results:
                if result.match_confidence >= min_confidence and result.match_confidence > best_confidence:
                    best_confidence = result.match_confidence
                    # Convert to product data
                    plugin = self.plugins[supplier_name]
                    try:
                        product_data = plugin.get_product_details(result.mpn, result.manufacturer)
                        if product_data:
                            best_match = product_data
                    except Exception as e:
                        logger.error(f"Error getting details for best match: {e}")

        return best_match

    def get_available_suppliers(self) -> List[str]:
        """Get list of available (enabled and configured) suppliers"""
        return [name for name, plugin in self.plugins.items() if plugin.enabled]

    def check_health(self) -> Dict[str, bool]:
        """
        Check health status of all plugins.

        Returns:
            Dictionary mapping supplier name to health status
        """
        health = {}
        for supplier_name, plugin in self.plugins.items():
            try:
                health[supplier_name] = plugin.is_available()
            except Exception as e:
                logger.error(f"Health check failed for {supplier_name}: {e}")
                health[supplier_name] = False

        return health

    def get_rate_limit_info(self) -> Dict[str, Dict[str, Any]]:
        """
        Get rate limit information for all plugins.

        Returns:
            Dictionary mapping supplier name to rate limit info
        """
        rate_limits = {}
        for supplier_name, plugin in self.plugins.items():
            try:
                rate_limits[supplier_name] = plugin.get_rate_limit_info()
            except Exception as e:
                logger.error(f"Failed to get rate limit info for {supplier_name}: {e}")
                rate_limits[supplier_name] = {}

        return rate_limits

    def get_circuit_breaker_status(self) -> Dict[str, Dict[str, Any]]:
        """
        Get circuit breaker status for all suppliers.

        Returns:
            Dictionary mapping supplier name to circuit breaker status
        """
        from app.core.circuit_breaker import sync_circuit_breaker_manager

        status = {}
        for supplier_name in self.plugins.keys():
            cb_config = self.circuit_breakers.get(supplier_name)
            if cb_config and cb_config.get('instance'):
                breaker = cb_config['instance']
                status[supplier_name] = breaker.get_status()
            else:
                status[supplier_name] = {'state': 'N/A', 'message': 'No circuit breaker configured'}

        return status

    def reset_circuit_breaker(self, supplier_name: Optional[str] = None) -> Dict[str, str]:
        """
        Reset circuit breaker(s) for one or all suppliers.

        Args:
            supplier_name: Optional supplier name to reset (None = reset all)

        Returns:
            Dictionary with reset status messages
        """
        from app.core.circuit_breaker import sync_circuit_breaker_manager

        result = {}

        if supplier_name:
            # Reset specific supplier
            supplier_name_upper = supplier_name.upper()
            cb_config = self.circuit_breakers.get(supplier_name_upper)
            if cb_config and cb_config.get('instance'):
                breaker = cb_config['instance']
                breaker.failure_count = 0
                breaker.success_count = 0
                breaker._change_state(breaker.state.__class__.CLOSED)
                result[supplier_name_upper] = 'Circuit breaker reset successfully'
                logger.info(f"✅ Reset circuit breaker for {supplier_name_upper}")
            else:
                result[supplier_name_upper] = 'No circuit breaker found for this supplier'
                logger.warning(f"⚠️  No circuit breaker found for {supplier_name_upper}")
        else:
            # Reset all suppliers
            for supplier_name_key in self.circuit_breakers.keys():
                cb_config = self.circuit_breakers[supplier_name_key]
                if cb_config and cb_config.get('instance'):
                    breaker = cb_config['instance']
                    breaker.failure_count = 0
                    breaker.success_count = 0
                    breaker._change_state(breaker.state.__class__.CLOSED)
                    result[supplier_name_key] = 'Circuit breaker reset successfully'
                    logger.info(f"✅ Reset circuit breaker for {supplier_name_key}")

            if not result:
                result['message'] = 'No circuit breakers configured'

        return result
