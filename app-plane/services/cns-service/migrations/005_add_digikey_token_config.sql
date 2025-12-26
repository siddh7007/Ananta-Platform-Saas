-- ==========================================
-- CNS Service - DigiKey OAuth Token Configuration
-- Migration: 005
-- Created: 2025-11-23
-- Description: Add DigiKey OAuth token storage for dynamic token refresh without restart
-- ==========================================

-- ==========================================
-- DigiKey OAuth Token Configuration
-- ==========================================
-- Stores DigiKey OAuth2 tokens in database for dynamic loading
-- Eliminates need to restart container when tokens expire/refresh

INSERT INTO cns_enrichment_config (config_key, config_value, value_type, category, description, default_value, min_value, max_value, requires_restart, deprecated)
VALUES
    ('digikey_access_token', '', 'string', 'enrichment',
     'DigiKey OAuth2 access token (updated automatically on refresh)',
     '', NULL, NULL, false, false),

    ('digikey_refresh_token', '', 'string', 'enrichment',
     'DigiKey OAuth2 refresh token (updated automatically on refresh)',
     '', NULL, NULL, false, false),

    ('digikey_token_expires_at', '', 'string', 'enrichment',
     'DigiKey access token expiration timestamp (ISO 8601 format)',
     '', NULL, NULL, false, false),

    ('digikey_token_last_refresh', '', 'string', 'enrichment',
     'Last successful token refresh timestamp (ISO 8601 format)',
     '', NULL, NULL, false, false)
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value,
    updated_at = NOW();

-- ==========================================
-- Initialize with current .env values
-- ==========================================
-- IMPORTANT: Run this SQL to import tokens from .env:
--
-- UPDATE cns_enrichment_config
-- SET config_value = 'mSoOUjGr3G3JBkugcLTcSAuXFbTN'
-- WHERE config_key = 'digikey_access_token';
--
-- UPDATE cns_enrichment_config
-- SET config_value = 'nPgikFxyz3uMsiZy8zv4FcfTaCVwP2xq'
-- WHERE config_key = 'digikey_refresh_token';
--
-- UPDATE cns_enrichment_config
-- SET config_value = '2025-11-23T15:23:57Z'
-- WHERE config_key = 'digikey_token_expires_at';
--
-- UPDATE cns_enrichment_config
-- SET config_value = NOW()::text
-- WHERE config_key = 'digikey_token_last_refresh';

-- ==========================================
-- Migration Complete
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 005 complete:';
    RAISE NOTICE '   - Added 4 DigiKey OAuth token configuration keys';
    RAISE NOTICE '';
    RAISE NOTICE '📋 New Configuration Keys (category: enrichment):';
    RAISE NOTICE '   DigiKey OAuth:';
    RAISE NOTICE '     - digikey_access_token (string, requires_restart: false)';
    RAISE NOTICE '     - digikey_refresh_token (string, requires_restart: false)';
    RAISE NOTICE '     - digikey_token_expires_at (string, requires_restart: false)';
    RAISE NOTICE '     - digikey_token_last_refresh (string, requires_restart: false)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Benefits:';
    RAISE NOTICE '   - Tokens refresh automatically when expired (no restart needed)';
    RAISE NOTICE '   - DigiKey plugin reads/writes tokens from database dynamically';
    RAISE NOTICE '   - Eliminates 30-minute token expiration restarts';
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  Next Steps:';
    RAISE NOTICE '   1. Run UPDATE commands above to import current .env tokens';
    RAISE NOTICE '   2. DigiKey plugin will auto-update tokens on refresh';
    RAISE NOTICE '   3. Optional: Remove DIGIKEY_*_TOKEN from .env (use DB as source of truth)';
END$$;
