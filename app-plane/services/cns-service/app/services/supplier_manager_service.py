"""
Supplier Plugin Manager Service

Singleton service for initializing and accessing the supplier plugin manager.
"""

import logging
from typing import Optional
from functools import partial

from app.plugins.suppliers.manager import SupplierPluginManager
from app.config import settings
from app.services.supplier_token_store import (
    load_supplier_tokens,
    save_supplier_tokens,
)

logger = logging.getLogger(__name__)

# Global supplier manager instance
_supplier_manager: Optional[SupplierPluginManager] = None


def get_supplier_manager() -> SupplierPluginManager:
    """
    Get or create the global supplier plugin manager instance.

    Returns:
        SupplierPluginManager instance

    Raises:
        RuntimeError: If initialization fails
    """
    global _supplier_manager

    if _supplier_manager is None:
        _supplier_manager = initialize_supplier_manager()

    return _supplier_manager


def initialize_supplier_manager() -> SupplierPluginManager:
    """
    Initialize supplier plugin manager with configuration from settings.

    Returns:
        Configured SupplierPluginManager instance
    """
    logger.info("[INIT] Initializing supplier plugin manager...")

    # Build supplier configurations from settings
    supplier_config = {}

    # ===================================
    # Mouser Configuration
    # ===================================
    if settings.mouser_enabled:
        supplier_config['mouser'] = {
            'api_key': settings.mouser_api_key,
            'base_url': settings.mouser_base_url,
            'rate_limit': settings.mouser_rate_limit,
            'enabled': bool(settings.mouser_api_key)  # Only enable if API key is set
        }
        if settings.mouser_api_key:
            logger.info("  [OK] Mouser: enabled")
        else:
            logger.warning("  [WARN] Mouser: disabled (no API key)")
    else:
        logger.info("  [SKIP] Mouser: disabled by config")
        supplier_config['mouser'] = {'enabled': False}

    # ===================================
    # DigiKey Configuration
    # ===================================
    if settings.digikey_enabled:
        # DigiKey requires OAuth2 credentials
        has_credentials = bool(settings.digikey_client_id and settings.digikey_client_secret)

        stored_tokens = load_supplier_tokens('digikey')
        access_token = stored_tokens.get('access_token') or settings.digikey_access_token
        refresh_token = stored_tokens.get('refresh_token') or settings.digikey_refresh_token
        token_expires_at = stored_tokens.get('expires_at') or getattr(settings, 'digikey_token_expires_at', None)
        has_access_token = bool(access_token)

        supplier_config['digikey'] = {
            'client_id': settings.digikey_client_id,
            'client_secret': settings.digikey_client_secret,
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_expires_at': token_expires_at,
            'base_url': settings.digikey_base_url,
            'sandbox': settings.digikey_sandbox,
            'rate_limit': settings.digikey_rate_limit,
            'token_save_callback': partial(save_supplier_tokens, 'digikey'),
            'enabled': has_credentials and has_access_token
        }

        if has_credentials and has_access_token:
            logger.info("  [OK] DigiKey: enabled")
        elif has_credentials:
            logger.warning("  [WARN] DigiKey: configured but missing OAuth2 access token")
            logger.warning("      Set DIGIKEY_ACCESS_TOKEN to enable DigiKey API")
            supplier_config['digikey']['enabled'] = False
        else:
            logger.info("  [SKIP] DigiKey: disabled (no credentials)")
    else:
        logger.info("  [SKIP] DigiKey: disabled by config")
        supplier_config['digikey'] = {'enabled': False}

    # ===================================
    # Element14 Configuration
    # ===================================
    if settings.element14_enabled:
        supplier_config['element14'] = {
            'api_key': settings.element14_api_key,
            'store': settings.element14_store,
            'base_url': settings.element14_base_url,
            'rate_limit': settings.element14_rate_limit,
            'enabled': bool(settings.element14_api_key)
        }
        if settings.element14_api_key:
            logger.info(f"  [OK] Element14: enabled (store={settings.element14_store})")
        else:
            logger.warning("  [WARN] Element14: disabled (no API key)")
    else:
        logger.info("  [SKIP] Element14: disabled by config")
        supplier_config['element14'] = {'enabled': False}

    # Initialize plugin manager
    try:
        manager = SupplierPluginManager(supplier_config)

        # Log summary
        available_suppliers = manager.get_available_suppliers()
        if available_suppliers:
            logger.info(f"[OK] Supplier plugin manager initialized with {len(available_suppliers)} supplier(s): {', '.join(available_suppliers)}")
        else:
            logger.warning("[WARN] No suppliers are available - enrichment will use fallback/mock data")

        return manager

    except Exception as e:
        logger.error(f"[ERROR] Failed to initialize supplier plugin manager: {e}")
        raise RuntimeError(f"Supplier plugin manager initialization failed: {e}")


def reset_supplier_manager():
    """Reset the global supplier manager instance (for testing)"""
    global _supplier_manager
    _supplier_manager = None
    logger.info("Supplier plugin manager reset")
