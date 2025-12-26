"""
Enrichment Configuration Loader

Loads enrichment configuration from PostgreSQL database (cns_enrichment_config table).
Falls back to environment variables if database is unavailable or config not found.

This provides runtime configuration management via Directus UI without requiring
service restarts for most settings.

Usage:
    from app.core.enrichment_config_loader import get_enrichment_config

    config = get_enrichment_config()
    batch_size = config.get_int('enrichment_batch_size', default=10)
    quality_threshold = config.get_int('quality_threshold', default=80)
    enable_ai = config.get_bool('enable_ai_normalization', default=True)
"""

import logging
import os
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta
from sqlalchemy import text, create_engine
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)


class EnrichmentConfigLoader:
    """
    Loads enrichment configuration from database with caching and .env fallback
    """

    def __init__(self, db_session: Optional[Session] = None, cache_ttl_seconds: int = 300):
        """
        Initialize config loader

        Args:
            db_session: SQLAlchemy database session (Configuration DB)
                       If None, will create a session from CONFIG_DATABASE_URL env var
            cache_ttl_seconds: How long to cache config in memory (default: 5 minutes)
        """
        self.cache_ttl = timedelta(seconds=cache_ttl_seconds)
        self._cache: Dict[str, Any] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._owns_session = False

        # Use provided session or create one from CONFIG_DATABASE_URL
        if db_session is not None:
            self.db = db_session
        else:
            config_db_url = os.getenv('CONFIG_DATABASE_URL')
            if config_db_url:
                try:
                    engine = create_engine(
                        config_db_url,
                        pool_size=5,
                        max_overflow=10,
                        pool_pre_ping=True,
                        echo=False
                    )
                    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
                    self.db = SessionLocal()
                    self._owns_session = True
                    logger.info("Enrichment config loader connected to configuration database")
                except Exception as e:
                    logger.error(f"Failed to connect to configuration database: {e}")
                    self.db = None
            else:
                logger.warning("No CONFIG_DATABASE_URL provided, enrichment config will fall back to environment variables")
                self.db = None

    def __del__(self):
        """Cleanup: Close database session if we own it"""
        if self._owns_session and self.db is not None:
            try:
                self.db.close()
            except Exception:
                pass  # Ignore errors during cleanup

    def close(self):
        """Explicitly close database session if we own it"""
        if self._owns_session and self.db is not None:
            try:
                self.db.close()
                self.db = None
            except Exception as e:
                logger.error(f"Error closing config database session: {e}")

    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if self._cache_timestamp is None:
            return False
        return (datetime.now() - self._cache_timestamp) < self.cache_ttl

    def _load_all_configs(self) -> Dict[str, Any]:
        """Load all configs from database into cache"""
        if self.db is None:
            logger.warning("No database session provided, cannot load configs from database")
            return {}

        try:
            query = text("""
                SELECT config_key, config_value, value_type
                FROM cns_enrichment_config
                WHERE deprecated = FALSE
            """)

            result = self.db.execute(query).fetchall()

            configs = {}
            for row in result:
                key = row.config_key
                value = row.config_value
                value_type = row.value_type

                # Convert to appropriate Python type
                if value_type == 'integer':
                    configs[key] = int(value)
                elif value_type == 'float':
                    configs[key] = float(value)
                elif value_type == 'boolean':
                    configs[key] = value.lower() in ('true', 't', '1', 'yes')
                elif value_type == 'json':
                    import json
                    configs[key] = json.loads(value)
                else:  # string
                    configs[key] = value

            logger.info(f"Loaded {len(configs)} enrichment configs from database")
            return configs

        except Exception as e:
            logger.error(f"Failed to load enrichment configs from database: {e}", exc_info=True)
            return {}

    def _refresh_cache_if_needed(self):
        """Refresh cache if expired"""
        if not self._is_cache_valid():
            logger.debug("Config cache expired, refreshing...")
            self._cache = self._load_all_configs()
            self._cache_timestamp = datetime.now()

    def get(self, key: str, default: Any = None, use_env: bool = True) -> Any:
        """
        Get config value by key

        Args:
            key: Config key (e.g., 'enrichment_batch_size')
            default: Default value if not found
            use_env: Whether to fallback to environment variables

        Returns:
            Config value from database, or .env, or default
        """
        # Refresh cache if needed
        self._refresh_cache_if_needed()

        # Try cache first
        if key in self._cache:
            logger.debug(f"Config '{key}' loaded from cache: {self._cache[key]}")
            return self._cache[key]

        # Fallback to environment variable
        if use_env:
            env_key = key.upper()
            env_value = os.getenv(env_key)
            if env_value is not None:
                logger.debug(f"Config '{key}' loaded from environment: {env_value}")
                return env_value

        # Return default
        logger.debug(f"Config '{key}' not found, using default: {default}")
        return default

    def get_int(self, key: str, default: int = 0) -> int:
        """Get integer config value"""
        value = self.get(key, default)
        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning(f"Config '{key}' is not a valid integer: {value}, using default: {default}")
            return default

    def get_float(self, key: str, default: float = 0.0) -> float:
        """Get float config value"""
        value = self.get(key, default)
        try:
            return float(value)
        except (ValueError, TypeError):
            logger.warning(f"Config '{key}' is not a valid float: {value}, using default: {default}")
            return default

    def get_bool(self, key: str, default: bool = False) -> bool:
        """Get boolean config value"""
        value = self.get(key, default)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', 't', '1', 'yes')
        return bool(value)

    def get_string(self, key: str, default: str = '') -> str:
        """Get string config value"""
        value = self.get(key, default)
        return str(value)

    def get_all(self, category: Optional[str] = None) -> Dict[str, Any]:
        """
        Get all configs, optionally filtered by category

        Args:
            category: Optional category filter (enrichment, quality, ai, performance, storage, audit)

        Returns:
            Dictionary of config_key → config_value
        """
        self._refresh_cache_if_needed()

        if category is None:
            return self._cache.copy()

        # Filter by category (requires database query)
        if self.db is None:
            logger.warning("No database session, cannot filter by category")
            return {}

        try:
            query = text("""
                SELECT config_key, config_value, value_type
                FROM cns_enrichment_config
                WHERE category = :category
                  AND deprecated = FALSE
            """)

            result = self.db.execute(query, {'category': category}).fetchall()

            configs = {}
            for row in result:
                key = row.config_key
                value = row.config_value
                value_type = row.value_type

                # Convert to appropriate type
                if value_type == 'integer':
                    configs[key] = int(value)
                elif value_type == 'float':
                    configs[key] = float(value)
                elif value_type == 'boolean':
                    configs[key] = value.lower() in ('true', 't', '1', 'yes')
                else:
                    configs[key] = value

            return configs

        except Exception as e:
            logger.error(f"Failed to get configs by category '{category}': {e}")
            return {}

    def update(self, key: str, value: Any, updated_by: str = 'system', change_reason: Optional[str] = None) -> bool:
        """
        Update config value in database

        Args:
            key: Config key to update
            value: New value
            updated_by: User making the change
            change_reason: Reason for change (logged in history)

        Returns:
            True if updated successfully
        """
        if self.db is None:
            logger.error("No database session, cannot update config")
            return False

        try:
            # Convert value to string for storage
            if isinstance(value, bool):
                value_str = 'true' if value else 'false'
            else:
                value_str = str(value)

            query = text("""
                SELECT update_enrichment_config(:key, :value, :updated_by, :reason)
            """)

            result = self.db.execute(query, {
                'key': key,
                'value': value_str,
                'updated_by': updated_by,
                'reason': change_reason
            })

            success = result.scalar()
            if success:
                self.db.commit()
                # Invalidate cache
                self._cache_timestamp = None
                logger.info(f"Updated config '{key}' to '{value}' by {updated_by}")
            else:
                logger.warning(f"Failed to update config '{key}': not found in database")

            return success

        except Exception as e:
            logger.error(f"Failed to update config '{key}': {e}", exc_info=True)
            self.db.rollback()
            return False

    def invalidate_cache(self):
        """Force cache invalidation (will reload on next access)"""
        self._cache_timestamp = None
        logger.debug("Config cache invalidated")

    def get_config_info(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed config information including metadata

        Args:
            key: Config key

        Returns:
            Dictionary with config details or None if not found
        """
        if self.db is None:
            return None

        try:
            query = text("""
                SELECT
                    config_key,
                    config_value,
                    value_type,
                    category,
                    description,
                    default_value,
                    min_value,
                    max_value,
                    requires_restart,
                    deprecated,
                    updated_at,
                    updated_by
                FROM cns_enrichment_config
                WHERE config_key = :key
            """)

            result = self.db.execute(query, {'key': key}).fetchone()

            if result:
                return {
                    'config_key': result.config_key,
                    'config_value': result.config_value,
                    'value_type': result.value_type,
                    'category': result.category,
                    'description': result.description,
                    'default_value': result.default_value,
                    'min_value': float(result.min_value) if result.min_value else None,
                    'max_value': float(result.max_value) if result.max_value else None,
                    'requires_restart': result.requires_restart,
                    'deprecated': result.deprecated,
                    'updated_at': result.updated_at.isoformat() if result.updated_at else None,
                    'updated_by': result.updated_by,
                }

            return None

        except Exception as e:
            logger.error(f"Failed to get config info for '{key}': {e}")
            return None

    def get_change_history(self, key: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get change history for a config key

        Args:
            key: Config key
            limit: Max number of history entries to return

        Returns:
            List of change history entries
        """
        if self.db is None:
            return []

        try:
            query = text("""
                SELECT
                    old_value,
                    new_value,
                    changed_by,
                    changed_at,
                    change_reason,
                    ip_address
                FROM cns_enrichment_config_history
                WHERE config_key = :key
                ORDER BY changed_at DESC
                LIMIT :limit
            """)

            result = self.db.execute(query, {'key': key, 'limit': limit}).fetchall()

            history = []
            for row in result:
                history.append({
                    'old_value': row.old_value,
                    'new_value': row.new_value,
                    'changed_by': row.changed_by,
                    'changed_at': row.changed_at.isoformat() if row.changed_at else None,
                    'change_reason': row.change_reason,
                    'ip_address': row.ip_address,
                })

            return history

        except Exception as e:
            logger.error(f"Failed to get change history for '{key}': {e}")
            return []


# ============================================================================
# GLOBAL INSTANCE (Singleton Pattern)
# ============================================================================

_global_config_loader: Optional[EnrichmentConfigLoader] = None


def get_enrichment_config(db_session: Optional[Session] = None) -> EnrichmentConfigLoader:
    """
    Get global enrichment config loader instance

    Args:
        db_session: Optional database session. If not provided, uses existing global instance.

    Returns:
        EnrichmentConfigLoader instance

    Usage:
        config = get_enrichment_config()
        batch_size = config.get_int('enrichment_batch_size', default=10)
    """
    global _global_config_loader

    if _global_config_loader is None or db_session is not None:
        _global_config_loader = EnrichmentConfigLoader(db_session)

    return _global_config_loader


def invalidate_global_config_cache():
    """Invalidate global config cache (call after updating configs)"""
    global _global_config_loader
    if _global_config_loader:
        _global_config_loader.invalidate_cache()


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def get_enrichment_batch_size(db_session: Optional[Session] = None) -> int:
    """Get enrichment batch size"""
    config = get_enrichment_config(db_session)
    return config.get_int('enrichment_batch_size', default=10)


def get_quality_threshold(db_session: Optional[Session] = None) -> int:
    """Get quality threshold for database storage"""
    config = get_enrichment_config(db_session)
    return config.get_int('quality_threshold', default=80)


def is_ai_normalization_enabled(db_session: Optional[Session] = None) -> bool:
    """Check if AI normalization is enabled"""
    config = get_enrichment_config(db_session)
    return config.get_bool('enable_ai_normalization', default=True)


def get_ai_model_config(db_session: Optional[Session] = None) -> Dict[str, Any]:
    """Get AI model configuration"""
    config = get_enrichment_config(db_session)
    return {
        'model_name': config.get_string('ai_model_name', default='claude-sonnet-4'),
        'temperature': config.get_float('ai_temperature', default=0.2),
        'max_tokens': config.get_int('ai_max_tokens', default=4096),
        'timeout_seconds': config.get_int('ai_timeout_seconds', default=30),
        'fallback_to_rules': config.get_bool('ai_fallback_to_rules', default=True),
    }


def get_performance_config(db_session: Optional[Session] = None) -> Dict[str, Any]:
    """Get performance-related configuration"""
    config = get_enrichment_config(db_session)
    return {
        'batch_size': config.get_int('enrichment_batch_size', default=10),
        'delay_per_component_ms': config.get_int('enrichment_delay_per_component_ms', default=500),
        'delay_per_batch_ms': config.get_int('enrichment_delay_per_batch_ms', default=2000),
        'max_concurrent_enrichments': config.get_int('max_concurrent_enrichments', default=5),
        'max_retries': config.get_int('max_retries_per_component', default=3),
        'timeout_seconds': config.get_int('timeout_per_component_seconds', default=30),
    }
