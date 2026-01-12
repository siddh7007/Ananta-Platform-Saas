-- =============================================================================
-- 001-init-schemas.sql
-- Initialize database schemas and extensions
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Create Databases (run as superuser)
-- =============================================================================

-- Create databases if they don't exist
SELECT 'CREATE DATABASE keycloak OWNER postgres'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

SELECT 'CREATE DATABASE temporal OWNER postgres'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal')\gexec

SELECT 'CREATE DATABASE temporal_visibility OWNER postgres'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal_visibility')\gexec

-- =============================================================================
-- Create Schemas for Ananta Platform (in ananta database)
-- =============================================================================

-- Tenant Management schema
CREATE SCHEMA IF NOT EXISTS tenant_management;

-- Authentication schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Audit logging schema
CREATE SCHEMA IF NOT EXISTS audit;

-- =============================================================================
-- Create Database Users (with Vault-managed passwords in production)
-- =============================================================================

-- These will be created by Vault in production
-- For local dev, we create them here with default passwords

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak') THEN
    CREATE ROLE keycloak WITH LOGIN PASSWORD 'keycloak_pass';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'temporal') THEN
    CREATE ROLE temporal WITH LOGIN PASSWORD 'temporal_pass';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ananta_app') THEN
    CREATE ROLE ananta_app WITH LOGIN PASSWORD 'ananta_pass';
  END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON SCHEMA tenant_management TO ananta_app;
GRANT ALL PRIVILEGES ON SCHEMA auth TO ananta_app;
GRANT ALL PRIVILEGES ON SCHEMA audit TO ananta_app;

-- =============================================================================
-- Tenant Management Helper Functions
-- =============================================================================

-- Function to create tenant schema
CREATE OR REPLACE FUNCTION tenant_management.create_tenant_schema(tenant_key VARCHAR(50))
RETURNS VOID AS $$
DECLARE
  schema_name VARCHAR(60);
BEGIN
  schema_name := 'tenant_' || tenant_key;

  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA %I TO ananta_app', schema_name);

  RAISE NOTICE 'Created schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Function to drop tenant schema
CREATE OR REPLACE FUNCTION tenant_management.drop_tenant_schema(tenant_key VARCHAR(50))
RETURNS VOID AS $$
DECLARE
  schema_name VARCHAR(60);
BEGIN
  schema_name := 'tenant_' || tenant_key;

  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);

  RAISE NOTICE 'Dropped schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION tenant_management.create_tenant_schema(VARCHAR) TO ananta_app;
GRANT EXECUTE ON FUNCTION tenant_management.drop_tenant_schema(VARCHAR) TO ananta_app;

-- =============================================================================
-- Migration Tracking Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(64)
);

-- Record this migration
INSERT INTO public.schema_migrations (version, name, checksum)
VALUES ('001', 'init-schemas', md5('001-init-schemas'))
ON CONFLICT (version) DO NOTHING;
