"""
Supplier Settings Loader - Database-Driven Configuration

Loads supplier API settings from cns_supplier_settings table instead of ENV variables.
Provides caching and fallback to default values.
"""

import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from functools import lru_cache
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.dual_database import get_dual_database

logger = logging.getLogger(__name__)


@dataclass
class SupplierConfig:
    """Supplier API configuration"""
    supplier_name: str
    display_name: str
    enabled: bool
    priority: int
    base_url: str
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    rate_limit_per_minute: int = 100
    timeout_seconds: int = 10

    # Quality metrics (from audit system)
    avg_response_time_ms: Optional[int] = None
    avg_match_confidence: Optional[float] = None
    avg_quality_score: Optional[float] = None
    success_rate: Optional[float] = None


class SupplierSettingsLoader:
    """
    Loads supplier settings from database with caching

    Replaces hardcoded config.py supplier settings with database-driven configuration.
    """

    def __init__(self, db: Optional[Session] = None):
        """
        Initialize loader

        Args:
            db: Database session (optional - will create if not provided)
        """
        self.db = db
        self._cache = {}
        self._cache_timestamp = None
        self._cache_ttl = timedelta(minutes=5)  # Cache for 5 minutes

    def get_enabled_suppliers(self) -> List[SupplierConfig]:
        """
        Get all enabled suppliers in priority order

        Returns:
            List of SupplierConfig objects sorted by priority (1=first)
        """
        try:
            # Check cache
            if self._is_cache_valid():
                return self._cache.get('enabled_suppliers', [])

            # Load from database
            db = self._get_db_session()

            query = text("""
                SELECT
                    supplier_name,
                    display_name,
                    supplier_url,
                    enabled,
                    priority,
                    api_key,
                    api_secret,
                    base_url,
                    rate_limit_per_minute,
                    timeout_seconds,
                    avg_response_time_ms,
                    avg_match_confidence,
                    avg_quality_score,
                    success_rate
                FROM cns_supplier_settings
                WHERE enabled = TRUE
                  AND priority > 0
                ORDER BY priority ASC
            """)

            result = db.execute(query).fetchall()

            suppliers = []
            for row in result:
                suppliers.append(SupplierConfig(
                    supplier_name=row.supplier_name,
                    display_name=row.display_name or row.supplier_name,
                    enabled=row.enabled,
                    priority=row.priority,
                    base_url=row.base_url,
                    api_key=row.api_key,
                    api_secret=row.api_secret,
                    rate_limit_per_minute=row.rate_limit_per_minute or 100,
                    timeout_seconds=row.timeout_seconds or 10,
                    avg_response_time_ms=row.avg_response_time_ms,
                    avg_match_confidence=float(row.avg_match_confidence) if row.avg_match_confidence else None,
                    avg_quality_score=float(row.avg_quality_score) if row.avg_quality_score else None,
                    success_rate=float(row.success_rate) if row.success_rate else None,
                ))

            # Update cache
            self._cache['enabled_suppliers'] = suppliers
            self._cache_timestamp = datetime.now()

            logger.info(f"Loaded {len(suppliers)} enabled suppliers from database")
            return suppliers

        except Exception as e:
            logger.error(f"Failed to load supplier settings from database: {e}", exc_info=True)
            return self._get_default_suppliers()

    def get_supplier_config(self, supplier_name: str) -> Optional[SupplierConfig]:
        """
        Get configuration for a specific supplier

        Args:
            supplier_name: Supplier identifier ('mouser', 'digikey', 'element14')

        Returns:
            SupplierConfig or None if not found/disabled
        """
        try:
            # Check cache
            cache_key = f'supplier_{supplier_name}'
            if self._is_cache_valid() and cache_key in self._cache:
                return self._cache[cache_key]

            # Load from database
            db = self._get_db_session()

            query = text("""
                SELECT
                    supplier_name,
                    display_name,
                    supplier_url,
                    enabled,
                    priority,
                    api_key,
                    api_secret,
                    base_url,
                    rate_limit_per_minute,
                    timeout_seconds,
                    avg_response_time_ms,
                    avg_match_confidence,
                    avg_quality_score,
                    success_rate
                FROM cns_supplier_settings
                WHERE supplier_name = :supplier_name
            """)

            result = db.execute(query, {'supplier_name': supplier_name}).fetchone()

            if not result:
                logger.warning(f"Supplier {supplier_name} not found in database")
                return self._get_default_supplier_config(supplier_name)

            config = SupplierConfig(
                supplier_name=result.supplier_name,
                display_name=result.display_name or result.supplier_name,
                enabled=result.enabled,
                priority=result.priority,
                base_url=result.base_url,
                api_key=result.api_key,
                api_secret=result.api_secret,
                rate_limit_per_minute=result.rate_limit_per_minute or 100,
                timeout_seconds=result.timeout_seconds or 10,
                avg_response_time_ms=result.avg_response_time_ms,
                avg_match_confidence=float(result.avg_match_confidence) if result.avg_match_confidence else None,
                avg_quality_score=float(result.avg_quality_score) if result.avg_quality_score else None,
                success_rate=float(result.success_rate) if result.success_rate else None,
            )

            # Update cache
            self._cache[cache_key] = config
            self._cache_timestamp = datetime.now()

            return config

        except Exception as e:
            logger.error(f"Failed to load config for supplier {supplier_name}: {e}", exc_info=True)
            return self._get_default_supplier_config(supplier_name)

    def invalidate_cache(self):
        """Force reload from database on next access"""
        self._cache = {}
        self._cache_timestamp = None
        logger.info("Supplier settings cache invalidated")

    # ========================================================================
    # PRIVATE METHODS
    # ========================================================================

    def _get_db_session(self) -> Session:
        """Get database session (create if not provided)"""
        if self.db:
            return self.db

        # Create temporary session
        try:
            dual_db = get_dual_database()
            return next(dual_db.get_session("components"))
        except Exception as e:
            logger.error(f"Failed to get database session: {e}", exc_info=True)
            raise

    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._cache_timestamp:
            return False

        age = datetime.now() - self._cache_timestamp
        return age < self._cache_ttl

    def _get_default_suppliers(self) -> List[SupplierConfig]:
        """Fallback default supplier configurations"""
        return [
            SupplierConfig(
                supplier_name='mouser',
                display_name='Mouser Electronics',
                enabled=True,
                priority=1,
                base_url='https://api.mouser.com/api/v1',
                rate_limit_per_minute=100,
                timeout_seconds=10,
            ),
            SupplierConfig(
                supplier_name='digikey',
                display_name='DigiKey Electronics',
                enabled=True,
                priority=2,
                base_url='https://api.digikey.com',
                rate_limit_per_minute=1000,
                timeout_seconds=10,
            ),
            SupplierConfig(
                supplier_name='element14',
                display_name='Element14',
                enabled=True,
                priority=3,
                base_url='https://api.element14.com/catalog/products',
                rate_limit_per_minute=50,
                timeout_seconds=10,
            ),
        ]

    def _get_default_supplier_config(self, supplier_name: str) -> Optional[SupplierConfig]:
        """Get default config for a specific supplier"""
        defaults = {
            'mouser': SupplierConfig(
                supplier_name='mouser',
                display_name='Mouser Electronics',
                enabled=True,
                priority=1,
                base_url='https://api.mouser.com/api/v1',
                rate_limit_per_minute=100,
                timeout_seconds=10,
            ),
            'digikey': SupplierConfig(
                supplier_name='digikey',
                display_name='DigiKey Electronics',
                enabled=True,
                priority=2,
                base_url='https://api.digikey.com',
                rate_limit_per_minute=1000,
                timeout_seconds=10,
            ),
            'element14': SupplierConfig(
                supplier_name='element14',
                display_name='Element14',
                enabled=True,
                priority=3,
                base_url='https://api.element14.com/catalog/products',
                rate_limit_per_minute=50,
                timeout_seconds=10,
            ),
        }
        return defaults.get(supplier_name)


# ============================================================================
# GLOBAL INSTANCE (SINGLETON PATTERN)
# ============================================================================

_supplier_settings_loader: Optional[SupplierSettingsLoader] = None


def get_supplier_settings_loader(db: Optional[Session] = None) -> SupplierSettingsLoader:
    """
    Get global supplier settings loader instance

    Args:
        db: Optional database session

    Returns:
        SupplierSettingsLoader instance
    """
    global _supplier_settings_loader

    if _supplier_settings_loader is None:
        _supplier_settings_loader = SupplierSettingsLoader(db)

    return _supplier_settings_loader


def reload_supplier_settings():
    """Force reload supplier settings from database"""
    global _supplier_settings_loader

    if _supplier_settings_loader:
        _supplier_settings_loader.invalidate_cache()
        logger.info("Supplier settings reloaded from database")
