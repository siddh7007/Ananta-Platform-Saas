-- =============================================================================
-- Control Plane PostgreSQL Initialization
-- =============================================================================
-- Creates all required databases for control plane services
-- This script runs automatically when the PostgreSQL container starts fresh
-- =============================================================================

-- Create keycloak database (used by Keycloak identity provider)
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

-- Create arc_saas database (used by tenant-management-service)
SELECT 'CREATE DATABASE arc_saas'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'arc_saas')\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE keycloak TO postgres;
GRANT ALL PRIVILEGES ON DATABASE arc_saas TO postgres;
