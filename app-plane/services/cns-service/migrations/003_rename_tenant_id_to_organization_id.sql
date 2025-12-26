-- ==========================================
-- Migration: 003 - Rename tenant_id to organization_id
-- Created: 2025-11-19
-- Database: components-v2 (PostgreSQL - CNS Service)
-- Description: Complete multi-tenancy migration in CNS-specific tables
-- ==========================================

-- This migration renames all tenant_id columns to organization_id in the
-- Components V2 database to ensure consistency with the Supabase schema
-- and multi-tenancy model throughout the platform.

BEGIN;

-- ==========================================
-- STEP 1: Rename columns in cns_enrichment_config
-- ==========================================

-- Rename tenant_id to organization_id
ALTER TABLE cns_enrichment_config
    RENAME COLUMN tenant_id TO organization_id;

-- Update index name for clarity
DROP INDEX IF EXISTS idx_cns_enrichment_config_tenant;
CREATE INDEX idx_cns_enrichment_config_organization ON cns_enrichment_config(organization_id);

-- Update constraint comment
COMMENT ON COLUMN cns_enrichment_config.organization_id IS 'Organization identifier (NULL for global/default config)';

-- ==========================================
-- STEP 2: Rename columns in cns_cost_tracking
-- ==========================================

-- Rename tenant_id to organization_id
ALTER TABLE cns_cost_tracking
    RENAME COLUMN tenant_id TO organization_id;

-- Update index name
DROP INDEX IF EXISTS idx_cns_cost_tracking_tenant;
CREATE INDEX idx_cns_cost_tracking_organization ON cns_cost_tracking(organization_id);

-- ==========================================
-- STEP 3: Verification
-- ==========================================

-- Verify no tenant_id columns remain
DO $$
DECLARE
    tenant_id_count INT;
BEGIN
    SELECT COUNT(*) INTO tenant_id_count
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name IN ('cns_enrichment_config', 'cns_cost_tracking')
      AND column_name = 'tenant_id';
    
    IF tenant_id_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % tenant_id columns still exist in CNS tables', tenant_id_count;
    END IF;
    
    RAISE NOTICE '✓ Successfully renamed tenant_id → organization_id in CNS tables';
    RAISE NOTICE '  - cns_enrichment_config.tenant_id → cns_enrichment_config.organization_id';
    RAISE NOTICE '  - cns_cost_tracking.tenant_id → cns_cost_tracking.organization_id';
    RAISE NOTICE '  - Updated indexes for performance';
    RAISE NOTICE '✓ Migration 003 Complete: tenant_id → organization_id (CNS Service)';
END $$;

COMMIT;
