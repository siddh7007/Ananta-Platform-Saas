-- ============================================================================
-- INIT SCRIPT: Create all required databases for Control Plane
-- ============================================================================
-- This script runs FIRST (000_) and creates the databases needed by:
--   - Arc-SaaS Control Plane (arc_saas)
--   - Keycloak (keycloak)
--
-- Note: 003_ARC_SAAS_MASTER.sql runs after this and populates arc_saas
-- ============================================================================

-- Create arc_saas database if not exists
SELECT 'CREATE DATABASE arc_saas'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'arc_saas')\gexec

-- Create keycloak database if not exists
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE arc_saas TO postgres;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO postgres;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Database initialization complete:';
    RAISE NOTICE '  - arc_saas database created/verified';
    RAISE NOTICE '  - keycloak database created/verified';
    RAISE NOTICE '==============================================';
END $$;
