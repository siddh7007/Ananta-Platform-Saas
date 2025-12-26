"""
Rate Limiting Configuration Manager

Manages enrichment rate limiting configuration with Redis caching.

Priority:
1. Redis (runtime configuration, set via UI/API)
2. Environment variables (fallback)
3. Code defaults (last resort)

Benefits:
- No database needed
- Applies to ALL enrichment workflows (customer, bulk, admin)
- Runtime updates without restart
- Simple key-value storage
"""

import logging
import json
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Redis keys
REDIS_CONFIG_KEY = "enrichment:rate_limiting:config"
REDIS_HISTORY_KEY = "enrichment:rate_limiting:history"


class RateLimitingConfigManager:
    """Manages rate limiting configuration with Redis caching"""

    def __init__(self, redis_client=None, settings=None):
        """
        Initialize configuration manager.

        Args:
            redis_client: Redis client instance (optional)
            settings: Application settings instance (optional)
        """
        self.redis = redis_client
        self.settings = settings

    def get_config(self) -> Dict[str, Any]:
        """
        Get current rate limiting configuration.

        Priority:
        1. Redis (runtime config)
        2. Environment variables
        3. Code defaults

        Returns:
            Configuration dict with delays_enabled, delay_per_component_ms, etc.
        """
        # Try Redis first (runtime configuration)
        if self.redis:
            try:
                config_json = self.redis.get(REDIS_CONFIG_KEY)
                if config_json:
                    config = json.loads(config_json)
                    config['source'] = 'redis'
                    logger.info(
                        f"✅ Rate limiting config loaded from REDIS: "
                        f"delays_enabled={config['delays_enabled']}, "
                        f"delay_per_component={config['delay_per_component_ms']}ms"
                    )
                    return config
            except Exception as e:
                logger.warning(f"Failed to load config from Redis: {e}. Falling back to environment variables.")

        # Fallback to environment variables
        if self.settings:
            config = {
                'delays_enabled': self.settings.enrichment_delays_enabled,
                'delay_per_component_ms': self.settings.enrichment_delay_per_component_ms,
                'delay_per_batch_ms': self.settings.enrichment_delay_per_batch_ms,
                'batch_size': self.settings.enrichment_batch_size,
                'source': 'environment_variables'
            }

            logger.info(
                f"✅ Rate limiting config loaded from ENVIRONMENT VARIABLES: "
                f"delays_enabled={config['delays_enabled']}, "
                f"delay_per_component={config['delay_per_component_ms']}ms"
            )

            return config

        # Last resort: code defaults
        config = {
            'delays_enabled': True,
            'delay_per_component_ms': 500,
            'delay_per_batch_ms': 2000,
            'batch_size': 10,
            'source': 'code_defaults'
        }

        logger.warning(
            f"⚠️ Rate limiting config loaded from CODE DEFAULTS: "
            f"delays_enabled={config['delays_enabled']}, "
            f"delay_per_component={config['delay_per_component_ms']}ms"
        )

        return config

    def set_config(
        self,
        delays_enabled: bool,
        delay_per_component_ms: int,
        delay_per_batch_ms: int,
        batch_size: int,
        updated_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update rate limiting configuration in Redis.

        Args:
            delays_enabled: Enable/disable delays
            delay_per_component_ms: Delay between components (ms)
            delay_per_batch_ms: Delay between batches (ms)
            batch_size: Components per batch
            updated_by: User who made the change (optional)

        Returns:
            Updated configuration dict

        Raises:
            ValueError: If validation fails
            RuntimeError: If Redis is unavailable
        """
        # Validate inputs
        if delay_per_component_ms < 0:
            raise ValueError("delay_per_component_ms must be non-negative")

        if delay_per_batch_ms < 0:
            raise ValueError("delay_per_batch_ms must be non-negative")

        if batch_size <= 0:
            raise ValueError("batch_size must be positive")

        if not self.redis:
            raise RuntimeError("Redis is not available. Cannot update configuration.")

        # Get old config for history
        old_config = self.get_config()

        # Create new config
        config = {
            'delays_enabled': delays_enabled,
            'delay_per_component_ms': delay_per_component_ms,
            'delay_per_batch_ms': delay_per_batch_ms,
            'batch_size': batch_size,
            'updated_at': datetime.utcnow().isoformat(),
            'updated_by': updated_by,
            'source': 'redis'
        }

        try:
            # Save to Redis
            self.redis.set(REDIS_CONFIG_KEY, json.dumps(config))

            # Save to history (keep last 100 changes)
            history_entry = {
                'timestamp': config['updated_at'],
                'updated_by': updated_by,
                'old_config': old_config,
                'new_config': config
            }

            self.redis.lpush(REDIS_HISTORY_KEY, json.dumps(history_entry))
            self.redis.ltrim(REDIS_HISTORY_KEY, 0, 99)  # Keep only last 100

            logger.info(
                f"✅ Rate limiting config updated in Redis: "
                f"delays_enabled={config['delays_enabled']}, "
                f"delay_per_component={config['delay_per_component_ms']}ms, "
                f"delay_per_batch={config['delay_per_batch_ms']}ms, "
                f"batch_size={config['batch_size']}"
            )

            return config

        except Exception as e:
            logger.error(f"Failed to save config to Redis: {e}")
            raise RuntimeError(f"Failed to update configuration: {e}")

    def get_history(self, limit: int = 50) -> list:
        """
        Get configuration change history.

        Args:
            limit: Maximum number of history entries to return

        Returns:
            List of history entries (newest first)
        """
        if not self.redis:
            return []

        try:
            history_json = self.redis.lrange(REDIS_HISTORY_KEY, 0, limit - 1)
            history = [json.loads(entry) for entry in history_json]
            return history
        except Exception as e:
            logger.error(f"Failed to load history from Redis: {e}")
            return []

    def reset_to_defaults(self, updated_by: Optional[str] = None) -> Dict[str, Any]:
        """
        Reset configuration to environment variable defaults.

        Args:
            updated_by: User who initiated the reset

        Returns:
            Reset configuration dict
        """
        if not self.settings:
            raise RuntimeError("Settings not available")

        return self.set_config(
            delays_enabled=self.settings.enrichment_delays_enabled,
            delay_per_component_ms=self.settings.enrichment_delay_per_component_ms,
            delay_per_batch_ms=self.settings.enrichment_delay_per_batch_ms,
            batch_size=self.settings.enrichment_batch_size,
            updated_by=updated_by
        )

    def delete_config(self):
        """
        Delete Redis configuration (falls back to environment variables).
        """
        if self.redis:
            try:
                self.redis.delete(REDIS_CONFIG_KEY)
                logger.info("✅ Redis configuration deleted. Will use environment variables.")
            except Exception as e:
                logger.error(f"Failed to delete Redis config: {e}")


def get_rate_limiting_config_manager():
    """
    Get rate limiting configuration manager instance.

    Returns:
        RateLimitingConfigManager instance with Redis and settings
    """
    from app.config import settings
    from app.cache.redis_cache import get_cache

    cache = get_cache()
    redis_client = cache.get_client() if cache else None

    return RateLimitingConfigManager(redis_client=redis_client, settings=settings)


def calculate_processing_rate(config: Dict[str, Any]) -> int:
    """
    Calculate estimated components per minute from configuration.

    Args:
        config: Configuration dict

    Returns:
        Estimated components per minute
    """
    if not config.get('delays_enabled', True):
        return 200  # Rough estimate for no delays

    delay_per_component_ms = config.get('delay_per_component_ms', 0)
    delay_per_batch_ms = config.get('delay_per_batch_ms', 0)
    batch_size = config.get('batch_size', 10)

    # Time per batch = (batch_size * component_delay) + batch_delay
    time_per_batch_ms = (batch_size * delay_per_component_ms) + delay_per_batch_ms

    if time_per_batch_ms == 0:
        return 200

    # Components per minute = (60000ms / time_per_batch_ms) * batch_size
    components_per_minute = (60000 / time_per_batch_ms) * batch_size

    return int(components_per_minute)
