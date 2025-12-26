-- ==========================================
-- CNS Service - Circuit Breaker & Retry Configuration
-- Migration: 004
-- Created: 2025-11-20
-- Description: Add circuit breaker and retry policy configuration (key-value rows)
-- ==========================================

-- ==========================================
-- Circuit Breaker Configuration
-- ==========================================

INSERT INTO cns_enrichment_config (config_key, config_value, value_type, category, description, default_value, min_value, max_value, requires_restart, deprecated)
VALUES
    ('circuit_breaker_enabled', 'false', 'boolean', 'performance',
     'Enable circuit breaker pattern for supplier API resilience (currently disabled due to async/sync mismatch)',
     'false', NULL, NULL, true, false),

    ('circuit_breaker_failure_threshold', '5', 'integer', 'performance',
     'Number of consecutive failures before circuit opens',
     '5', 1, 100, true, false),

    ('circuit_breaker_timeout_seconds', '60', 'integer', 'performance',
     'Seconds to wait before attempting to close circuit',
     '60', 5, 600, true, false),

    ('circuit_breaker_success_threshold', '2', 'integer', 'performance',
     'Number of consecutive successes needed to close circuit',
     '2', 1, 10, true, false)
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value,
    min_value = EXCLUDED.min_value,
    max_value = EXCLUDED.max_value;

-- ==========================================
-- Retry Policy Configuration
-- ==========================================

INSERT INTO cns_enrichment_config (config_key, config_value, value_type, category, description, default_value, min_value, max_value, requires_restart, deprecated)
VALUES
    ('retry_enabled', 'false', 'boolean', 'performance',
     'Enable retry policy for transient supplier API failures (currently disabled due to async/sync mismatch)',
     'false', NULL, NULL, true, false),

    ('retry_max_attempts', '3', 'integer', 'performance',
     'Maximum retry attempts per API call',
     '3', 1, 10, true, false),

    ('retry_initial_delay_seconds', '1.0', 'float', 'performance',
     'Initial delay before first retry in seconds',
     '1.0', 0.1, 10.0, true, false),

    ('retry_exponential_base', '2.0', 'float', 'performance',
     'Exponential backoff multiplier (2.0 = doubles each retry)',
     '2.0', 1.0, 5.0, true, false),

    ('retry_max_delay_seconds', '30.0', 'float', 'performance',
     'Maximum delay between retries in seconds',
     '30.0', 1.0, 300.0, true, false),

    ('retry_jitter_enabled', 'true', 'boolean', 'performance',
     'Add random jitter to retry delays to prevent thundering herd',
     'true', NULL, NULL, true, false)
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value,
    min_value = EXCLUDED.min_value,
    max_value = EXCLUDED.max_value;

-- ==========================================
-- Migration Complete
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 004 complete:';
    RAISE NOTICE '   - Added 10 circuit breaker and retry policy configuration keys';
    RAISE NOTICE '';
    RAISE NOTICE '📋 New Configuration Keys (category: performance):';
    RAISE NOTICE '   Circuit Breaker:';
    RAISE NOTICE '     - circuit_breaker_enabled (boolean, default: false - disabled until async fixed)';
    RAISE NOTICE '     - circuit_breaker_failure_threshold (integer, default: 5)';
    RAISE NOTICE '     - circuit_breaker_timeout_seconds (integer, default: 60)';
    RAISE NOTICE '     - circuit_breaker_success_threshold (integer, default: 2)';
    RAISE NOTICE '   Retry Policy:';
    RAISE NOTICE '     - retry_enabled (boolean, default: false - disabled until async fixed)';
    RAISE NOTICE '     - retry_max_attempts (integer, default: 3)';
    RAISE NOTICE '     - retry_initial_delay_seconds (float, default: 1.0)';
    RAISE NOTICE '     - retry_exponential_base (float, default: 2.0)';
    RAISE NOTICE '     - retry_max_delay_seconds (float, default: 30.0)';
    RAISE NOTICE '     - retry_jitter_enabled (boolean, default: true)';
    RAISE NOTICE '';
    RAISE NOTICE '🎛️  Configure via Directus UI → cns_enrichment_config table';
    RAISE NOTICE '⚠️  Requires service restart after changing these values';
END$$;
