-- ============================================================================
-- Migration: Add Auto-Enrichment Toggle to Organizations
-- ============================================================================
-- Date: 2025-11-10
-- Description: Adds per-organization auto-enrichment control
--
-- This allows organizations to choose whether BOM enrichment should:
--   - Start automatically after upload (auto_enrichment = true)
--   - Require manual trigger via UI (auto_enrichment = false, default)
--
-- Usage:
--   UPDATE organizations_v2 SET auto_enrichment = true WHERE slug = 'acme-corp';
-- ============================================================================

-- Add auto_enrichment column to organizations_v2
ALTER TABLE organizations_v2
ADD COLUMN IF NOT EXISTS auto_enrichment BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comment
COMMENT ON COLUMN organizations_v2.auto_enrichment IS 'Enable automatic BOM enrichment after upload completes (default: false for manual control)';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_organizations_v2_auto_enrichment
ON organizations_v2(auto_enrichment)
WHERE auto_enrichment = true;

-- Example: Enable auto-enrichment for test organizations
-- UPDATE organizations_v2
-- SET auto_enrichment = true
-- WHERE slug IN ('test-org', 'demo-org');

-- View organizations with auto-enrichment enabled
CREATE OR REPLACE VIEW organizations_with_auto_enrichment AS
SELECT
    id,
    name,
    slug,
    auto_enrichment,
    created_at
FROM organizations_v2
WHERE auto_enrichment = true
ORDER BY name;

COMMENT ON VIEW organizations_with_auto_enrichment IS 'Organizations that have auto-enrichment enabled';

-- Grant access to service role
GRANT SELECT ON organizations_with_auto_enrichment TO service_role;
