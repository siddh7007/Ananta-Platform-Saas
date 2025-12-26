-- ============================================================================
-- Migration 066: Risk Analysis Restructuring
-- ============================================================================
-- Purpose: Implement multi-level risk analysis with configurable scoring
-- Date: 2025-11-29
--
-- Features:
--   1. Customer-specific risk profiles (configurable weights & thresholds)
--   2. Component base risk scores (from enrichment data)
--   3. BOM line item contextual risk scores
--   4. BOM health summaries (aggregate grades A-F)
--   5. Project risk summaries
--
-- Auth0 Compatibility:
--   - Uses current_user_organization_id() for RLS
--   - Uses is_super_admin() for admin bypass
--   - Compatible with Auth0 custom claims and Supabase fallbacks
--
-- Error Handling:
--   - All functions wrapped in EXCEPTION blocks
--   - Graceful degradation for missing data
--   - Detailed error logging via RAISE NOTICE/WARNING
-- ============================================================================

-- ============================================================================
-- SECTION 1: Organization Risk Profiles
-- Customer-specific risk configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_risk_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Risk Factor Weights (must sum to 100)
    lifecycle_weight INTEGER DEFAULT 30 CHECK (lifecycle_weight BETWEEN 0 AND 100),
    supply_chain_weight INTEGER DEFAULT 25 CHECK (supply_chain_weight BETWEEN 0 AND 100),
    compliance_weight INTEGER DEFAULT 20 CHECK (compliance_weight BETWEEN 0 AND 100),
    obsolescence_weight INTEGER DEFAULT 15 CHECK (obsolescence_weight BETWEEN 0 AND 100),
    single_source_weight INTEGER DEFAULT 10 CHECK (single_source_weight BETWEEN 0 AND 100),

    -- Risk Level Thresholds (defines boundaries)
    low_threshold INTEGER DEFAULT 30 CHECK (low_threshold BETWEEN 1 AND 99),
    medium_threshold INTEGER DEFAULT 60 CHECK (medium_threshold BETWEEN 1 AND 99),
    high_threshold INTEGER DEFAULT 85 CHECK (high_threshold BETWEEN 1 AND 99),

    -- Context Modifier Weights (for contextual scoring)
    quantity_weight DECIMAL(4,3) DEFAULT 0.150 CHECK (quantity_weight BETWEEN 0 AND 1),
    lead_time_weight DECIMAL(4,3) DEFAULT 0.100 CHECK (lead_time_weight BETWEEN 0 AND 1),
    criticality_weight DECIMAL(4,3) DEFAULT 0.200 CHECK (criticality_weight BETWEEN 0 AND 1),

    -- Industry Preset Name (optional)
    preset_name TEXT CHECK (preset_name IN ('default', 'automotive', 'medical', 'aerospace', 'consumer', 'industrial', 'custom')),

    -- Custom Risk Factors (JSONB for flexibility)
    -- Format: [{"name": "aec_q100", "weight": 0.15, "description": "AEC-Q100 qualified", "required": true}]
    custom_factors JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Constraints
    UNIQUE(organization_id),
    CHECK (low_threshold < medium_threshold AND medium_threshold < high_threshold),
    CHECK (
        lifecycle_weight + supply_chain_weight + compliance_weight +
        obsolescence_weight + single_source_weight = 100
    )
);

-- Indexes for organization_risk_profiles
CREATE INDEX IF NOT EXISTS idx_org_risk_profiles_org_id ON organization_risk_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_risk_profiles_preset ON organization_risk_profiles(preset_name);

COMMENT ON TABLE organization_risk_profiles IS 'Customer-specific risk scoring configuration with configurable weights and thresholds';
COMMENT ON COLUMN organization_risk_profiles.custom_factors IS 'Industry-specific custom risk factors as JSONB array';

-- ============================================================================
-- SECTION 2: Component Base Risk Scores
-- Base risk calculated from enrichment data (component-centric)
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_base_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Component identification (links to bom_line_items.component_id INTEGER)
    -- We store MPN + Manufacturer for deduplication since component_id is INTEGER
    mpn TEXT NOT NULL,
    manufacturer TEXT NOT NULL,

    -- Individual Risk Factors (0-100 scale)
    lifecycle_risk INTEGER DEFAULT 0 CHECK (lifecycle_risk BETWEEN 0 AND 100),
    supply_chain_risk INTEGER DEFAULT 0 CHECK (supply_chain_risk BETWEEN 0 AND 100),
    compliance_risk INTEGER DEFAULT 0 CHECK (compliance_risk BETWEEN 0 AND 100),
    obsolescence_risk INTEGER DEFAULT 0 CHECK (obsolescence_risk BETWEEN 0 AND 100),
    single_source_risk INTEGER DEFAULT 0 CHECK (single_source_risk BETWEEN 0 AND 100),

    -- Default Total Score (using standard weights: 30/25/20/15/10)
    default_total_score INTEGER DEFAULT 0 CHECK (default_total_score BETWEEN 0 AND 100),
    default_risk_level TEXT CHECK (default_risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',

    -- Risk Factors Detail (stores reasoning for each factor)
    risk_factors JSONB DEFAULT '{}'::jsonb,
    -- Example: {"lifecycle": {"reason": "NRND status", "data_source": "mouser"}}

    -- Calculation Metadata
    calculation_date TIMESTAMPTZ DEFAULT NOW(),
    calculation_method TEXT DEFAULT 'weighted_average_v1',
    data_sources TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Lead time from enrichment (used for context calculations)
    lead_time_days INTEGER,
    stock_quantity INTEGER,
    supplier_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint on MPN + Manufacturer (component deduplication)
    UNIQUE(mpn, manufacturer)
);

-- Indexes for component_base_risk_scores
CREATE INDEX IF NOT EXISTS idx_component_base_risk_mpn ON component_base_risk_scores(mpn);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_mfr ON component_base_risk_scores(manufacturer);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_mpn_mfr ON component_base_risk_scores(mpn, manufacturer);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_level ON component_base_risk_scores(default_risk_level);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_score ON component_base_risk_scores(default_total_score DESC);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_calc_date ON component_base_risk_scores(calculation_date DESC);

COMMENT ON TABLE component_base_risk_scores IS 'Base risk scores for components calculated from enrichment data';

-- ============================================================================
-- SECTION 3: BOM Line Item Risk Scores
-- Contextual risk per BOM line item (usage-context aware)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bom_line_item_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_line_item_id UUID NOT NULL REFERENCES bom_line_items(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Base Risk Reference
    base_risk_id UUID REFERENCES component_base_risk_scores(id) ON DELETE SET NULL,
    base_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (base_risk_score BETWEEN 0 AND 100),

    -- Context Modifiers (0-100 scale)
    quantity_modifier INTEGER DEFAULT 0 CHECK (quantity_modifier BETWEEN 0 AND 100),
    lead_time_modifier INTEGER DEFAULT 0 CHECK (lead_time_modifier BETWEEN 0 AND 100),
    criticality_modifier INTEGER DEFAULT 0 CHECK (criticality_modifier BETWEEN 0 AND 100),

    -- User-defined Criticality Level (1-10, used to calculate criticality_modifier)
    user_criticality_level INTEGER DEFAULT 5 CHECK (user_criticality_level BETWEEN 1 AND 10),

    -- Final Contextual Score (calculated using org risk profile weights)
    contextual_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (contextual_risk_score BETWEEN 0 AND 100),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',

    -- Alternate Components (risk mitigation)
    alternates_available INTEGER DEFAULT 0,
    alternate_risk_reduction INTEGER DEFAULT 0 CHECK (alternate_risk_reduction BETWEEN 0 AND 100),

    -- Calculation Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    profile_version_used UUID, -- Links to org_risk_profile.id used for calculation

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(bom_line_item_id)
);

-- Indexes for bom_line_item_risk_scores
CREATE INDEX IF NOT EXISTS idx_bli_risk_bom_line_item ON bom_line_item_risk_scores(bom_line_item_id);
CREATE INDEX IF NOT EXISTS idx_bli_risk_org ON bom_line_item_risk_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_bli_risk_level ON bom_line_item_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_bli_risk_score ON bom_line_item_risk_scores(contextual_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_bli_risk_org_level ON bom_line_item_risk_scores(organization_id, risk_level);

COMMENT ON TABLE bom_line_item_risk_scores IS 'Contextual risk scores per BOM line item with usage-context modifiers';

-- ============================================================================
-- SECTION 4: BOM Risk Summaries
-- Aggregate BOM health scores with grade (A-F)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bom_risk_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Risk Distribution (count of line items per level)
    low_risk_count INTEGER DEFAULT 0 CHECK (low_risk_count >= 0),
    medium_risk_count INTEGER DEFAULT 0 CHECK (medium_risk_count >= 0),
    high_risk_count INTEGER DEFAULT 0 CHECK (high_risk_count >= 0),
    critical_risk_count INTEGER DEFAULT 0 CHECK (critical_risk_count >= 0),
    total_line_items INTEGER DEFAULT 0 CHECK (total_line_items >= 0),

    -- Aggregate Scores
    average_risk_score DECIMAL(5,2) DEFAULT 0 CHECK (average_risk_score BETWEEN 0 AND 100),
    weighted_risk_score DECIMAL(5,2) DEFAULT 0 CHECK (weighted_risk_score BETWEEN 0 AND 100),
    max_risk_score INTEGER DEFAULT 0 CHECK (max_risk_score BETWEEN 0 AND 100),
    min_risk_score INTEGER DEFAULT 0 CHECK (min_risk_score BETWEEN 0 AND 100),

    -- BOM Health Grade (A-F)
    health_grade TEXT CHECK (health_grade IN ('A', 'B', 'C', 'D', 'F')) DEFAULT 'A',

    -- Top Risk Factors
    top_risk_factors JSONB DEFAULT '[]'::jsonb,
    -- Format: [{"factor": "lifecycle", "affected_count": 5, "avg_score": 75}]

    -- Top High-Risk Components
    top_risk_components JSONB DEFAULT '[]'::jsonb,
    -- Format: [{"mpn": "ABC123", "manufacturer": "Acme", "score": 85, "level": "critical"}]

    -- Trend Data
    previous_average_score DECIMAL(5,2),
    score_trend TEXT CHECK (score_trend IN ('improving', 'stable', 'worsening')) DEFAULT 'stable',

    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    profile_version_used UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(bom_id)
);

-- Indexes for bom_risk_summaries
CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_bom ON bom_risk_summaries(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_org ON bom_risk_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_grade ON bom_risk_summaries(health_grade);
CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_org_grade ON bom_risk_summaries(organization_id, health_grade);
CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_avg_score ON bom_risk_summaries(average_risk_score DESC);

COMMENT ON TABLE bom_risk_summaries IS 'Aggregate BOM health scores with distribution and grade';

-- ============================================================================
-- SECTION 5: Project Risk Summaries
-- Project-level aggregation across all BOMs
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_risk_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- BOM Counts by Health Grade
    total_boms INTEGER DEFAULT 0 CHECK (total_boms >= 0),
    healthy_boms INTEGER DEFAULT 0 CHECK (healthy_boms >= 0),     -- Grade A or B
    at_risk_boms INTEGER DEFAULT 0 CHECK (at_risk_boms >= 0),     -- Grade C
    critical_boms INTEGER DEFAULT 0 CHECK (critical_boms >= 0),   -- Grade D or F

    -- Component Counts
    total_components INTEGER DEFAULT 0 CHECK (total_components >= 0),
    unique_components INTEGER DEFAULT 0 CHECK (unique_components >= 0),

    -- Aggregate Metrics
    average_bom_health_score DECIMAL(5,2) DEFAULT 0 CHECK (average_bom_health_score BETWEEN 0 AND 100),
    weighted_project_score DECIMAL(5,2) DEFAULT 0 CHECK (weighted_project_score BETWEEN 0 AND 100),

    -- Risk Distribution (across all BOMs in project)
    low_risk_total INTEGER DEFAULT 0 CHECK (low_risk_total >= 0),
    medium_risk_total INTEGER DEFAULT 0 CHECK (medium_risk_total >= 0),
    high_risk_total INTEGER DEFAULT 0 CHECK (high_risk_total >= 0),
    critical_risk_total INTEGER DEFAULT 0 CHECK (critical_risk_total >= 0),

    -- Most Common Issues
    top_risk_factors JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(project_id)
);

-- Indexes for project_risk_summaries
CREATE INDEX IF NOT EXISTS idx_project_risk_summary_project ON project_risk_summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risk_summary_org ON project_risk_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_risk_summary_score ON project_risk_summaries(average_bom_health_score DESC);

COMMENT ON TABLE project_risk_summaries IS 'Project-level risk aggregation across all BOMs';

-- ============================================================================
-- SECTION 6: Risk Score History
-- Track changes over time for trend analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Polymorphic reference (can track BOM or component history)
    entity_type TEXT NOT NULL CHECK (entity_type IN ('bom', 'component', 'project')),
    entity_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Snapshot Data
    total_risk_score INTEGER NOT NULL CHECK (total_risk_score BETWEEN 0 AND 100),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    score_change INTEGER DEFAULT 0, -- Change from previous score

    -- Factor Breakdown (optional)
    lifecycle_risk INTEGER CHECK (lifecycle_risk BETWEEN 0 AND 100),
    supply_chain_risk INTEGER CHECK (supply_chain_risk BETWEEN 0 AND 100),
    compliance_risk INTEGER CHECK (compliance_risk BETWEEN 0 AND 100),
    obsolescence_risk INTEGER CHECK (obsolescence_risk BETWEEN 0 AND 100),
    single_source_risk INTEGER CHECK (single_source_risk BETWEEN 0 AND 100),

    -- Health Grade (for BOMs/projects)
    health_grade TEXT CHECK (health_grade IN ('A', 'B', 'C', 'D', 'F')),

    -- Metadata
    recorded_date TIMESTAMPTZ DEFAULT NOW(),
    calculation_method TEXT,

    -- Prevent duplicate entries for same entity on same day
    UNIQUE(entity_type, entity_id, recorded_date::DATE)
);

-- Indexes for risk_score_history
CREATE INDEX IF NOT EXISTS idx_risk_history_entity ON risk_score_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_org ON risk_score_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_date ON risk_score_history(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_history_entity_date ON risk_score_history(entity_type, entity_id, recorded_date DESC);

COMMENT ON TABLE risk_score_history IS 'Historical risk score snapshots for trend analysis';

-- ============================================================================
-- SECTION 7: Helper Functions
-- ============================================================================

-- Function: Get or create organization risk profile
CREATE OR REPLACE FUNCTION get_or_create_risk_profile(p_org_id UUID)
RETURNS organization_risk_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile organization_risk_profiles;
BEGIN
    -- Try to get existing profile
    SELECT * INTO v_profile
    FROM organization_risk_profiles
    WHERE organization_id = p_org_id;

    -- Create default profile if not exists
    IF v_profile IS NULL THEN
        INSERT INTO organization_risk_profiles (organization_id, preset_name)
        VALUES (p_org_id, 'default')
        RETURNING * INTO v_profile;

        RAISE NOTICE '[Risk] Created default risk profile for org=%', p_org_id;
    END IF;

    RETURN v_profile;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Risk] Error in get_or_create_risk_profile: %', SQLERRM;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION get_or_create_risk_profile IS 'Get existing or create default risk profile for organization';

-- Function: Classify risk level based on score and thresholds
CREATE OR REPLACE FUNCTION classify_risk_level_custom(
    p_score INTEGER,
    p_low_threshold INTEGER DEFAULT 30,
    p_medium_threshold INTEGER DEFAULT 60,
    p_high_threshold INTEGER DEFAULT 85
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_score IS NULL THEN
        RETURN 'low';
    END IF;

    IF p_score <= p_low_threshold THEN
        RETURN 'low';
    ELSIF p_score <= p_medium_threshold THEN
        RETURN 'medium';
    ELSIF p_score <= p_high_threshold THEN
        RETURN 'high';
    ELSE
        RETURN 'critical';
    END IF;
END;
$$;

COMMENT ON FUNCTION classify_risk_level_custom IS 'Classify risk level using custom thresholds';

-- Function: Calculate weighted risk score
CREATE OR REPLACE FUNCTION calculate_weighted_risk_score(
    p_lifecycle INTEGER,
    p_supply_chain INTEGER,
    p_compliance INTEGER,
    p_obsolescence INTEGER,
    p_single_source INTEGER,
    p_lifecycle_weight INTEGER DEFAULT 30,
    p_supply_chain_weight INTEGER DEFAULT 25,
    p_compliance_weight INTEGER DEFAULT 20,
    p_obsolescence_weight INTEGER DEFAULT 15,
    p_single_source_weight INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_score DECIMAL;
BEGIN
    -- Calculate weighted average
    v_score := (
        COALESCE(p_lifecycle, 0) * (p_lifecycle_weight / 100.0) +
        COALESCE(p_supply_chain, 0) * (p_supply_chain_weight / 100.0) +
        COALESCE(p_compliance, 0) * (p_compliance_weight / 100.0) +
        COALESCE(p_obsolescence, 0) * (p_obsolescence_weight / 100.0) +
        COALESCE(p_single_source, 0) * (p_single_source_weight / 100.0)
    );

    -- Clamp to 0-100 range
    RETURN GREATEST(0, LEAST(100, ROUND(v_score)::INTEGER));
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Risk] Error in calculate_weighted_risk_score: %', SQLERRM;
    RETURN 0;
END;
$$;

COMMENT ON FUNCTION calculate_weighted_risk_score IS 'Calculate weighted risk score from individual factors';

-- Function: Calculate BOM health grade
CREATE OR REPLACE FUNCTION calculate_bom_health_grade(
    p_critical_pct DECIMAL,
    p_high_pct DECIMAL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_combined_pct DECIMAL;
BEGIN
    v_combined_pct := COALESCE(p_critical_pct, 0) + COALESCE(p_high_pct, 0);

    -- Grade based on percentage of critical/high risk components
    IF v_combined_pct < 5 THEN
        RETURN 'A';  -- Excellent: Less than 5% high/critical
    ELSIF v_combined_pct < 15 THEN
        RETURN 'B';  -- Good: 5-15% high/critical
    ELSIF v_combined_pct < 30 THEN
        RETURN 'C';  -- Acceptable: 15-30% high/critical
    ELSIF v_combined_pct < 50 THEN
        RETURN 'D';  -- At Risk: 30-50% high/critical
    ELSE
        RETURN 'F';  -- Critical: More than 50% high/critical
    END IF;
END;
$$;

COMMENT ON FUNCTION calculate_bom_health_grade IS 'Calculate BOM health grade (A-F) based on risk distribution';

-- ============================================================================
-- SECTION 8: Triggers for Automatic Updates
-- ============================================================================

-- Trigger function: Update timestamps on risk profile change
CREATE OR REPLACE FUNCTION update_risk_profile_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_risk_profile_updated_at ON organization_risk_profiles;
CREATE TRIGGER trigger_risk_profile_updated_at
    BEFORE UPDATE ON organization_risk_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_risk_profile_timestamp();

-- Trigger function: Update timestamps on BOM risk summary change
CREATE OR REPLACE FUNCTION update_bom_risk_summary_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_bom_risk_summary_updated_at ON bom_risk_summaries;
CREATE TRIGGER trigger_bom_risk_summary_updated_at
    BEFORE UPDATE ON bom_risk_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_bom_risk_summary_timestamp();

-- ============================================================================
-- SECTION 9: Row-Level Security Policies
-- Auth0-compatible RLS using helper functions
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organization_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_base_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_item_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_risk_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_risk_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;

-- =========================
-- organization_risk_profiles RLS
-- =========================

-- SELECT: Users see own org's profile, super_admin sees all
DROP POLICY IF EXISTS "org_risk_profiles_select_policy" ON organization_risk_profiles;
CREATE POLICY "org_risk_profiles_select_policy" ON organization_risk_profiles
    FOR SELECT
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- INSERT: Users can create profile for own org
DROP POLICY IF EXISTS "org_risk_profiles_insert_policy" ON organization_risk_profiles;
CREATE POLICY "org_risk_profiles_insert_policy" ON organization_risk_profiles
    FOR INSERT
    WITH CHECK (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- UPDATE: Users can update own org's profile
DROP POLICY IF EXISTS "org_risk_profiles_update_policy" ON organization_risk_profiles;
CREATE POLICY "org_risk_profiles_update_policy" ON organization_risk_profiles
    FOR UPDATE
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- DELETE: Only super_admin can delete
DROP POLICY IF EXISTS "org_risk_profiles_delete_policy" ON organization_risk_profiles;
CREATE POLICY "org_risk_profiles_delete_policy" ON organization_risk_profiles
    FOR DELETE
    USING (is_super_admin());

-- =========================
-- component_base_risk_scores RLS
-- =========================

-- SELECT: All authenticated users can read (global component data)
DROP POLICY IF EXISTS "component_base_risk_select_policy" ON component_base_risk_scores;
CREATE POLICY "component_base_risk_select_policy" ON component_base_risk_scores
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT/UPDATE/DELETE: Only service_role (from enrichment workflows)
DROP POLICY IF EXISTS "component_base_risk_modify_policy" ON component_base_risk_scores;
CREATE POLICY "component_base_risk_modify_policy" ON component_base_risk_scores
    FOR ALL
    TO service_role
    USING (true);

-- =========================
-- bom_line_item_risk_scores RLS
-- =========================

-- SELECT: Users see own org's data
DROP POLICY IF EXISTS "bli_risk_select_policy" ON bom_line_item_risk_scores;
CREATE POLICY "bli_risk_select_policy" ON bom_line_item_risk_scores
    FOR SELECT
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- INSERT: Users can insert for own org
DROP POLICY IF EXISTS "bli_risk_insert_policy" ON bom_line_item_risk_scores;
CREATE POLICY "bli_risk_insert_policy" ON bom_line_item_risk_scores
    FOR INSERT
    WITH CHECK (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- UPDATE: Users can update own org's data
DROP POLICY IF EXISTS "bli_risk_update_policy" ON bom_line_item_risk_scores;
CREATE POLICY "bli_risk_update_policy" ON bom_line_item_risk_scores
    FOR UPDATE
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- DELETE: Users can delete own org's data
DROP POLICY IF EXISTS "bli_risk_delete_policy" ON bom_line_item_risk_scores;
CREATE POLICY "bli_risk_delete_policy" ON bom_line_item_risk_scores
    FOR DELETE
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- =========================
-- bom_risk_summaries RLS
-- =========================

-- SELECT: Users see own org's data
DROP POLICY IF EXISTS "bom_risk_summary_select_policy" ON bom_risk_summaries;
CREATE POLICY "bom_risk_summary_select_policy" ON bom_risk_summaries
    FOR SELECT
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- INSERT: Service role and org users
DROP POLICY IF EXISTS "bom_risk_summary_insert_policy" ON bom_risk_summaries;
CREATE POLICY "bom_risk_summary_insert_policy" ON bom_risk_summaries
    FOR INSERT
    WITH CHECK (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- UPDATE: Service role and org users
DROP POLICY IF EXISTS "bom_risk_summary_update_policy" ON bom_risk_summaries;
CREATE POLICY "bom_risk_summary_update_policy" ON bom_risk_summaries
    FOR UPDATE
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- DELETE: Only super_admin
DROP POLICY IF EXISTS "bom_risk_summary_delete_policy" ON bom_risk_summaries;
CREATE POLICY "bom_risk_summary_delete_policy" ON bom_risk_summaries
    FOR DELETE
    USING (is_super_admin());

-- =========================
-- project_risk_summaries RLS
-- =========================

-- SELECT: Users see own org's data
DROP POLICY IF EXISTS "project_risk_summary_select_policy" ON project_risk_summaries;
CREATE POLICY "project_risk_summary_select_policy" ON project_risk_summaries
    FOR SELECT
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- INSERT: Service role and org users
DROP POLICY IF EXISTS "project_risk_summary_insert_policy" ON project_risk_summaries;
CREATE POLICY "project_risk_summary_insert_policy" ON project_risk_summaries
    FOR INSERT
    WITH CHECK (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- UPDATE: Service role and org users
DROP POLICY IF EXISTS "project_risk_summary_update_policy" ON project_risk_summaries;
CREATE POLICY "project_risk_summary_update_policy" ON project_risk_summaries
    FOR UPDATE
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- DELETE: Only super_admin
DROP POLICY IF EXISTS "project_risk_summary_delete_policy" ON project_risk_summaries;
CREATE POLICY "project_risk_summary_delete_policy" ON project_risk_summaries
    FOR DELETE
    USING (is_super_admin());

-- =========================
-- risk_score_history RLS
-- =========================

-- SELECT: Users see own org's history
DROP POLICY IF EXISTS "risk_history_select_policy" ON risk_score_history;
CREATE POLICY "risk_history_select_policy" ON risk_score_history
    FOR SELECT
    USING (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- INSERT: Service role can insert (from calculation workflows)
DROP POLICY IF EXISTS "risk_history_insert_policy" ON risk_score_history;
CREATE POLICY "risk_history_insert_policy" ON risk_score_history
    FOR INSERT
    WITH CHECK (
        is_super_admin()
        OR organization_id = current_user_organization_id()
    );

-- DELETE: Only super_admin (for cleanup)
DROP POLICY IF EXISTS "risk_history_delete_policy" ON risk_score_history;
CREATE POLICY "risk_history_delete_policy" ON risk_score_history
    FOR DELETE
    USING (is_super_admin());

-- ============================================================================
-- SECTION 10: Permissions
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON organization_risk_profiles TO authenticated;
GRANT SELECT ON component_base_risk_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bom_line_item_risk_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bom_risk_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON project_risk_summaries TO authenticated;
GRANT SELECT, INSERT ON risk_score_history TO authenticated;

-- Grant full permissions to service_role (for backend services)
GRANT ALL ON organization_risk_profiles TO service_role;
GRANT ALL ON component_base_risk_scores TO service_role;
GRANT ALL ON bom_line_item_risk_scores TO service_role;
GRANT ALL ON bom_risk_summaries TO service_role;
GRANT ALL ON project_risk_summaries TO service_role;
GRANT ALL ON risk_score_history TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_or_create_risk_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_risk_profile TO service_role;
GRANT EXECUTE ON FUNCTION classify_risk_level_custom TO authenticated;
GRANT EXECUTE ON FUNCTION classify_risk_level_custom TO service_role;
GRANT EXECUTE ON FUNCTION calculate_weighted_risk_score TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_weighted_risk_score TO service_role;
GRANT EXECUTE ON FUNCTION calculate_bom_health_grade TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_bom_health_grade TO service_role;

-- ============================================================================
-- SECTION 11: Industry Presets Data
-- ============================================================================

-- Create industry presets table for reference
CREATE TABLE IF NOT EXISTS risk_profile_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,

    -- Weights
    lifecycle_weight INTEGER NOT NULL,
    supply_chain_weight INTEGER NOT NULL,
    compliance_weight INTEGER NOT NULL,
    obsolescence_weight INTEGER NOT NULL,
    single_source_weight INTEGER NOT NULL,

    -- Thresholds
    low_threshold INTEGER NOT NULL,
    medium_threshold INTEGER NOT NULL,
    high_threshold INTEGER NOT NULL,

    -- Context Weights
    quantity_weight DECIMAL(4,3) NOT NULL,
    lead_time_weight DECIMAL(4,3) NOT NULL,
    criticality_weight DECIMAL(4,3) NOT NULL,

    -- Custom Factors
    custom_factors JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default presets
INSERT INTO risk_profile_presets (name, display_name, description, lifecycle_weight, supply_chain_weight, compliance_weight, obsolescence_weight, single_source_weight, low_threshold, medium_threshold, high_threshold, quantity_weight, lead_time_weight, criticality_weight, custom_factors)
VALUES
    ('default', 'Default', 'Standard risk profile suitable for most applications', 30, 25, 20, 15, 10, 30, 60, 85, 0.150, 0.100, 0.200, '[]'),
    ('automotive', 'Automotive (ISO 26262)', 'High reliability requirements with AEC-Q qualification focus', 25, 30, 25, 15, 5, 25, 50, 75, 0.200, 0.150, 0.250, '[{"name": "aec_q100", "weight": 0.15, "description": "AEC-Q100 qualified", "required": true}]'),
    ('medical', 'Medical (IEC 62304)', 'Strict compliance focus with long lifecycle requirements', 20, 20, 40, 15, 5, 20, 45, 70, 0.100, 0.200, 0.300, '[{"name": "biocompatibility", "weight": 0.20, "description": "Biocompatibility certification"}]'),
    ('aerospace', 'Aerospace (AS9100)', 'Extended lifecycle with traceability requirements', 25, 25, 30, 15, 5, 20, 45, 70, 0.150, 0.250, 0.300, '[{"name": "mil_spec", "weight": 0.15, "description": "MIL-SPEC qualification"}]'),
    ('consumer', 'Consumer Electronics', 'Cost-optimized with shorter lifecycle tolerance', 35, 30, 15, 15, 5, 35, 65, 85, 0.100, 0.100, 0.150, '[]'),
    ('industrial', 'Industrial', 'Balanced profile for industrial applications', 30, 30, 20, 15, 5, 30, 60, 80, 0.150, 0.150, 0.200, '[]')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE risk_profile_presets IS 'Industry-standard risk profile presets';

-- Grant read access to presets
GRANT SELECT ON risk_profile_presets TO authenticated;
GRANT SELECT ON risk_profile_presets TO service_role;

-- ============================================================================
-- SECTION 12: Views for Convenience
-- ============================================================================

-- View: BOMs with risk summaries
CREATE OR REPLACE VIEW boms_with_risk AS
SELECT
    b.*,
    brs.average_risk_score,
    brs.weighted_risk_score,
    brs.health_grade,
    brs.low_risk_count AS risk_low_count,
    brs.medium_risk_count AS risk_medium_count,
    brs.high_risk_count AS risk_high_count,
    brs.critical_risk_count AS risk_critical_count,
    brs.score_trend,
    brs.top_risk_factors,
    brs.calculated_at AS risk_calculated_at
FROM boms b
LEFT JOIN bom_risk_summaries brs ON b.id = brs.bom_id;

COMMENT ON VIEW boms_with_risk IS 'BOMs joined with their risk summaries for easy querying';

-- Grant access to views
GRANT SELECT ON boms_with_risk TO authenticated;
GRANT SELECT ON boms_with_risk TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Notes:
-- 1. All tables use Auth0-compatible RLS via current_user_organization_id()
-- 2. component_base_risk_scores is globally readable (component data is shared)
-- 3. Risk profiles auto-create with default settings if not present
-- 4. Industry presets are provided for quick configuration
-- 5. History table tracks changes for trend analysis
-- 6. Error handling includes RAISE NOTICE/WARNING for debugging
--
-- Next Steps:
-- 1. Create risk_calculation_service.py to populate these tables
-- 2. Update BOM enrichment workflow to calculate base risk
-- 3. Add API endpoints for risk profile management
-- 4. Update Customer Portal UI for multi-level filtering
-- ============================================================================
