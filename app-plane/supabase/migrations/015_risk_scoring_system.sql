-- Risk Scoring System Migration
-- Implements multi-factor risk scoring for components
-- Created: 2025-11-11

-- ============================================================================
-- 1. Component Risk Scores Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id UUID NOT NULL UNIQUE REFERENCES components(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Individual Risk Factors (0-100 scale)
  lifecycle_risk INTEGER DEFAULT 0 CHECK (lifecycle_risk BETWEEN 0 AND 100),
  supply_chain_risk INTEGER DEFAULT 0 CHECK (supply_chain_risk BETWEEN 0 AND 100),
  compliance_risk INTEGER DEFAULT 0 CHECK (compliance_risk BETWEEN 0 AND 100),
  obsolescence_risk INTEGER DEFAULT 0 CHECK (obsolescence_risk BETWEEN 0 AND 100),
  single_source_risk INTEGER DEFAULT 0 CHECK (single_source_risk BETWEEN 0 AND 100),

  -- Total Weighted Score (0-100)
  total_risk_score INTEGER DEFAULT 0 CHECK (total_risk_score BETWEEN 0 AND 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',

  -- Detailed Risk Factors (JSONB for flexibility)
  risk_factors JSONB DEFAULT '{}'::jsonb,

  -- Mitigation Suggestions
  mitigation_suggestions TEXT,

  -- Metadata
  calculation_method TEXT DEFAULT 'weighted_average_v1',
  calculation_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_risk_scores_component ON component_risk_scores(component_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_org ON component_risk_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON component_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_scores_total ON component_risk_scores(total_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_calculation_date ON component_risk_scores(calculation_date DESC);

COMMENT ON TABLE component_risk_scores IS 'Multi-factor risk scores for components';
COMMENT ON COLUMN component_risk_scores.lifecycle_risk IS 'Risk based on lifecycle status (0-100)';
COMMENT ON COLUMN component_risk_scores.supply_chain_risk IS 'Risk based on availability and suppliers (0-100)';
COMMENT ON COLUMN component_risk_scores.compliance_risk IS 'Risk based on regulatory compliance (0-100)';
COMMENT ON COLUMN component_risk_scores.obsolescence_risk IS 'Risk based on component age and market trends (0-100)';
COMMENT ON COLUMN component_risk_scores.single_source_risk IS 'Risk from limited suppliers (0-100)';
COMMENT ON COLUMN component_risk_scores.total_risk_score IS 'Weighted total risk score (0-100)';

-- ============================================================================
-- 2. Risk Score History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Risk Score Snapshot
  total_risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  score_change INTEGER DEFAULT 0, -- Change from previous score

  -- Individual Risk Factors Snapshot
  lifecycle_risk INTEGER,
  supply_chain_risk INTEGER,
  compliance_risk INTEGER,
  obsolescence_risk INTEGER,
  single_source_risk INTEGER,

  -- Metadata
  recorded_date TIMESTAMPTZ DEFAULT NOW(),
  calculation_method TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_risk_history_component ON risk_score_history(component_id, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_history_org ON risk_score_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_date ON risk_score_history(recorded_date DESC);

COMMENT ON TABLE risk_score_history IS 'Historical risk score snapshots for trend analysis';

-- ============================================================================
-- 3. Risk Calculation Functions
-- ============================================================================

-- Function to classify risk level based on total score
CREATE OR REPLACE FUNCTION classify_risk_level(score INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF score <= 30 THEN
    RETURN 'low';
  ELSIF score <= 60 THEN
    RETURN 'medium';
  ELSIF score <= 85 THEN
    RETURN 'high';
  ELSE
    RETURN 'critical';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION classify_risk_level IS 'Classify risk level: low (0-30), medium (31-60), high (61-85), critical (86-100)';

-- Function to calculate lifecycle risk
CREATE OR REPLACE FUNCTION calculate_lifecycle_risk(lifecycle_status_param TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE lifecycle_status_param
    WHEN 'ACTIVE' THEN 0
    WHEN 'NRND' THEN 50
    WHEN 'EOL' THEN 80
    WHEN 'OBSOLETE' THEN 100
    ELSE 25 -- UNKNOWN
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_lifecycle_risk IS 'Calculate lifecycle risk based on component status';

-- Function to calculate compliance risk
CREATE OR REPLACE FUNCTION calculate_compliance_risk(
  rohs_param TEXT,
  reach_param BOOLEAN
)
RETURNS INTEGER AS $$
DECLARE
  risk_score INTEGER := 0;
BEGIN
  -- RoHS Non-Compliance adds 40 points
  IF rohs_param = 'NON_COMPLIANT' THEN
    risk_score := risk_score + 40;
  ELSIF rohs_param = 'UNKNOWN' THEN
    risk_score := risk_score + 20;
  END IF;

  -- REACH Non-Compliance adds 30 points
  IF reach_param = FALSE THEN
    risk_score := risk_score + 30;
  END IF;

  RETURN LEAST(risk_score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_compliance_risk IS 'Calculate compliance risk based on RoHS and REACH status';

-- Function to calculate total risk score (weighted average)
CREATE OR REPLACE FUNCTION calculate_total_risk_score(
  lifecycle_risk_param INTEGER,
  supply_chain_risk_param INTEGER,
  compliance_risk_param INTEGER,
  obsolescence_risk_param INTEGER,
  single_source_risk_param INTEGER
)
RETURNS INTEGER AS $$
BEGIN
  RETURN ROUND(
    COALESCE(lifecycle_risk_param, 0) * 0.30 +
    COALESCE(supply_chain_risk_param, 0) * 0.25 +
    COALESCE(compliance_risk_param, 0) * 0.20 +
    COALESCE(obsolescence_risk_param, 0) * 0.15 +
    COALESCE(single_source_risk_param, 0) * 0.10
  )::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_total_risk_score IS 'Calculate weighted total risk score from individual factors (NULL values treated as 0)';

-- ============================================================================
-- 4. Auto-Update Risk Score Function
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_update_component_risk()
RETURNS TRIGGER AS $$
DECLARE
  lifecycle_risk_val INTEGER;
  compliance_risk_val INTEGER;
  supply_chain_risk_val INTEGER := 25; -- Placeholder
  obsolescence_risk_val INTEGER := 15; -- Placeholder
  single_source_risk_val INTEGER := 10; -- Placeholder
  total_risk_val INTEGER;
  risk_level_val TEXT;
  prev_score INTEGER;
BEGIN
  -- Calculate individual risk factors
  lifecycle_risk_val := calculate_lifecycle_risk(NEW.lifecycle_status);
  compliance_risk_val := calculate_compliance_risk(NEW.rohs_compliant, NEW.reach_compliant);

  -- For now, use placeholder values for other factors
  -- In production, these would be calculated based on real data
  -- (moved to DECLARE section above)

  -- Calculate total risk
  total_risk_val := calculate_total_risk_score(
    lifecycle_risk_val,
    supply_chain_risk_val,
    compliance_risk_val,
    obsolescence_risk_val,
    single_source_risk_val
  );

  -- Classify risk level
  risk_level_val := classify_risk_level(total_risk_val);

  -- Get previous score for change tracking
  SELECT total_risk_score INTO prev_score
  FROM component_risk_scores
  WHERE component_id = NEW.id;

  -- Upsert risk score
  INSERT INTO component_risk_scores (
    component_id,
    organization_id,
    lifecycle_risk,
    supply_chain_risk,
    compliance_risk,
    obsolescence_risk,
    single_source_risk,
    total_risk_score,
    risk_level,
    calculation_date,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.organization_id,
    lifecycle_risk_val,
    supply_chain_risk_val,
    compliance_risk_val,
    obsolescence_risk_val,
    single_source_risk_val,
    total_risk_val,
    risk_level_val,
    NOW(),
    NOW()
  )
  ON CONFLICT (component_id) DO UPDATE SET
    lifecycle_risk = lifecycle_risk_val,
    compliance_risk = compliance_risk_val,
    total_risk_score = total_risk_val,
    risk_level = risk_level_val,
    calculation_date = NOW(),
    updated_at = NOW();

  -- Insert into history if score changed
  IF prev_score IS NULL OR prev_score != total_risk_val THEN
    INSERT INTO risk_score_history (
      component_id,
      organization_id,
      total_risk_score,
      risk_level,
      score_change,
      lifecycle_risk,
      supply_chain_risk,
      compliance_risk,
      obsolescence_risk,
      single_source_risk,
      recorded_date
    ) VALUES (
      NEW.id,
      NEW.organization_id,
      total_risk_val,
      risk_level_val,
      COALESCE(total_risk_val - prev_score, total_risk_val),
      lifecycle_risk_val,
      supply_chain_risk_val,
      compliance_risk_val,
      obsolescence_risk_val,
      single_source_risk_val,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_update_component_risk IS 'Automatically update component risk score when lifecycle or compliance fields change';

-- ============================================================================
-- 5. Trigger to Auto-Calculate Risk
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_update_risk ON components;
CREATE TRIGGER trigger_auto_update_risk
  AFTER INSERT OR UPDATE OF lifecycle_status, rohs_compliant, reach_compliant
  ON components
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_component_risk();

COMMENT ON TRIGGER trigger_auto_update_risk ON components IS 'Automatically calculate risk score when component is created or risk-related fields change';

-- ============================================================================
-- 6. Helper Views
-- ============================================================================

-- View: Components with Risk Scores
CREATE OR REPLACE VIEW components_with_risk AS
SELECT
  c.*,
  crs.total_risk_score,
  crs.risk_level,
  crs.lifecycle_risk,
  crs.supply_chain_risk,
  crs.compliance_risk,
  crs.obsolescence_risk,
  crs.single_source_risk,
  crs.mitigation_suggestions,
  crs.calculation_date as risk_calculation_date
FROM components c
LEFT JOIN component_risk_scores crs ON c.id = crs.component_id;

COMMENT ON VIEW components_with_risk IS 'Components with their calculated risk scores';

-- View: High Risk Components
CREATE OR REPLACE VIEW high_risk_components AS
SELECT
  c.*,
  crs.total_risk_score,
  crs.risk_level,
  crs.mitigation_suggestions
FROM components c
INNER JOIN component_risk_scores crs ON c.id = crs.component_id
WHERE crs.risk_level IN ('high', 'critical')
ORDER BY crs.total_risk_score DESC;

COMMENT ON VIEW high_risk_components IS 'Components with high or critical risk levels';

-- ============================================================================
-- 7. Row-Level Security Policies
-- ============================================================================

-- Enable RLS on risk scoring tables
ALTER TABLE component_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see risk scores for components in their organization
CREATE POLICY "Users see own org risk scores" ON component_risk_scores
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert risk scores for components in their organization
CREATE POLICY "Users insert own org risk scores" ON component_risk_scores
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update risk scores for components in their organization
CREATE POLICY "Users update own org risk scores" ON component_risk_scores
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only see risk score history for their organization
CREATE POLICY "Users see own org risk history" ON risk_score_history
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users see own org risk scores" ON component_risk_scores IS 'Tenant isolation: users can only see risk scores for their organization';
COMMENT ON POLICY "Users insert own org risk scores" ON component_risk_scores IS 'Tenant isolation: users can only insert risk scores for their organization';
COMMENT ON POLICY "Users update own org risk scores" ON component_risk_scores IS 'Tenant isolation: users can only update risk scores for their organization';
COMMENT ON POLICY "Users see own org risk history" ON risk_score_history IS 'Tenant isolation: users can only see risk history for their organization';

-- ============================================================================
-- 8. Grant Permissions
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON component_risk_scores TO authenticated;
GRANT SELECT ON risk_score_history TO authenticated;
GRANT SELECT ON components_with_risk TO authenticated;
GRANT SELECT ON high_risk_components TO authenticated;

-- Grant access to anonymous users (read-only for public data)
GRANT SELECT ON components_with_risk TO anon;

-- ============================================================================
-- 9. Sample Data & Testing
-- ============================================================================

-- Update existing components to calculate risk
-- This will trigger the auto_update_component_risk function
-- UPDATE components SET updated_at = NOW() WHERE lifecycle_status IS NOT NULL;

-- ============================================================================
-- 10. Analytics Queries (Examples)
-- ============================================================================

-- Example 1: Risk distribution
-- SELECT risk_level, COUNT(*) as component_count
-- FROM component_risk_scores
-- GROUP BY risk_level
-- ORDER BY
--   CASE risk_level
--     WHEN 'critical' THEN 1
--     WHEN 'high' THEN 2
--     WHEN 'medium' THEN 3
--     WHEN 'low' THEN 4
--   END;

-- Example 2: Components with increasing risk
-- SELECT
--   c.manufacturer_part_number,
--   c.manufacturer,
--   crs.total_risk_score,
--   (SELECT score_change FROM risk_score_history
--    WHERE component_id = c.id
--    ORDER BY recorded_date DESC LIMIT 1) as recent_change
-- FROM components c
-- INNER JOIN component_risk_scores crs ON c.id = crs.component_id
-- WHERE (SELECT score_change FROM risk_score_history
--        WHERE component_id = c.id
--        ORDER BY recorded_date DESC LIMIT 1) > 10
-- ORDER BY recent_change DESC;

-- Example 3: Risk trend over time
-- SELECT
--   DATE_TRUNC('day', recorded_date) as date,
--   AVG(total_risk_score) as avg_risk_score,
--   COUNT(*) as changes
-- FROM risk_score_history
-- WHERE component_id = '<component-id>'
-- GROUP BY DATE_TRUNC('day', recorded_date)
-- ORDER BY date DESC;
