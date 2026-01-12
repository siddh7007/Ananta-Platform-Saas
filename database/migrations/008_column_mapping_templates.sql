-- ==========================================
-- CNS Service - Column Mapping Templates
-- Migration: 008
-- Created: 2025-12-16
-- Description: Create table for storing organization-level column mapping templates
--
-- Purpose: Replace localStorage-based templates with persistent, organization-scoped templates.
-- Users in the same organization can share templates, set defaults, and sync across devices.
-- ==========================================

-- ==========================================
-- Column Mapping Templates Table
-- ==========================================

CREATE TABLE IF NOT EXISTS column_mapping_templates (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization Scope
    organization_id UUID NOT NULL,

    -- Template Identification
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Mapping Configuration
    -- JSONB mapping of internal field names to Excel column headers
    -- Example: {"mpn": "Part Number", "manufacturer": "Mfg", "description": "Description"}
    mappings JSONB NOT NULL,

    -- Default Template Flag
    is_default BOOLEAN DEFAULT FALSE,

    -- Audit Fields
    created_by UUID,  -- User ID who created the template
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_org_template_name UNIQUE(organization_id, name)
);

-- ==========================================
-- Indexes
-- ==========================================

-- Primary lookup by organization
CREATE INDEX IF NOT EXISTS idx_column_mapping_org
    ON column_mapping_templates(organization_id);

-- Find default template efficiently
CREATE INDEX IF NOT EXISTS idx_column_mapping_default
    ON column_mapping_templates(organization_id, is_default)
    WHERE is_default = TRUE;

-- JSONB index for mapping searches
CREATE INDEX IF NOT EXISTS idx_column_mapping_mappings
    ON column_mapping_templates USING GIN (mappings);

-- Timestamp indexes
CREATE INDEX IF NOT EXISTS idx_column_mapping_created
    ON column_mapping_templates(created_at);

-- ==========================================
-- Trigger for auto-updating updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_column_mapping_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_column_mapping_templates_updated_at ON column_mapping_templates;
CREATE TRIGGER trg_column_mapping_templates_updated_at
    BEFORE UPDATE ON column_mapping_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_column_mapping_templates_updated_at();

-- ==========================================
-- Constraint: Only one default per organization
-- ==========================================

-- Trigger to ensure only one template per org is marked as default
CREATE OR REPLACE FUNCTION ensure_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this template as default, unset all others in the org
    IF NEW.is_default = TRUE THEN
        UPDATE column_mapping_templates
        SET is_default = FALSE
        WHERE organization_id = NEW.organization_id
          AND id != NEW.id
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_default_template ON column_mapping_templates;
CREATE TRIGGER trg_ensure_single_default_template
    BEFORE INSERT OR UPDATE ON column_mapping_templates
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_template();

-- ==========================================
-- Comments
-- ==========================================

COMMENT ON TABLE column_mapping_templates IS 'Organization-scoped column mapping templates for BOM uploads';
COMMENT ON COLUMN column_mapping_templates.organization_id IS 'Organization that owns this template';
COMMENT ON COLUMN column_mapping_templates.name IS 'Template name (unique within organization)';
COMMENT ON COLUMN column_mapping_templates.mappings IS 'JSON mapping of internal fields to Excel column names';
COMMENT ON COLUMN column_mapping_templates.is_default IS 'Whether this is the default template for the organization';
COMMENT ON COLUMN column_mapping_templates.created_by IS 'User ID who created the template';

-- ==========================================
-- Migration Complete
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 008 complete:';
    RAISE NOTICE '  - Created column_mapping_templates table';
    RAISE NOTICE '  - Created indexes for performance';
    RAISE NOTICE '  - Created triggers for updated_at and default enforcement';
    RAISE NOTICE '  - Ready for organization-scoped template storage';
END$$;
