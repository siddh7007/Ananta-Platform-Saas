-- Migration: Upgrade component_base_risk_scores to Migration 066 schema
-- Date: 2026-01-11
-- Reason: December 27 dump has old schema (pre-migration-066)
--         CNS service code expects new column names from migration 066
--
-- This migration upgrades the risk analysis schema from the old naming convention
-- (*_score, composite_score, factors) to the new convention (*_risk, default_total_score, risk_factors)

-- Step 1: Drop the old table (it's empty or has old data)
DROP TABLE IF EXISTS component_base_risk_scores CASCADE;

-- Step 2: Recreate with correct schema from migration 066
CREATE TABLE IF NOT EXISTS component_base_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Component identification (deduplication by MPN + manufacturer)
    mpn TEXT NOT NULL,
    manufacturer TEXT NOT NULL,

    -- Individual Risk Factors (0-100 scale) - NEW NAMING: *_risk instead of *_score
    lifecycle_risk INTEGER DEFAULT 0 CHECK (lifecycle_risk BETWEEN 0 AND 100),
    supply_chain_risk INTEGER DEFAULT 0 CHECK (supply_chain_risk BETWEEN 0 AND 100),
    compliance_risk INTEGER DEFAULT 0 CHECK (compliance_risk BETWEEN 0 AND 100),
    obsolescence_risk INTEGER DEFAULT 0 CHECK (obsolescence_risk BETWEEN 0 AND 100),
    single_source_risk INTEGER DEFAULT 0 CHECK (single_source_risk BETWEEN 0 AND 100),

    -- Default Total Score (NEW NAMING: default_total_score instead of composite_score)
    default_total_score INTEGER DEFAULT 0 CHECK (default_total_score BETWEEN 0 AND 100),
    default_risk_level TEXT CHECK (default_risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',

    -- Risk Factors Detail (NEW NAMING: risk_factors instead of factors)
    risk_factors JSONB DEFAULT '{}'::jsonb,

    -- Calculation Metadata (NEW: calculation_method column added)
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

-- Step 3: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_component_base_risk_mpn ON component_base_risk_scores(mpn);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_mfr ON component_base_risk_scores(manufacturer);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_mpn_mfr ON component_base_risk_scores(mpn, manufacturer);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_level ON component_base_risk_scores(default_risk_level);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_score ON component_base_risk_scores(default_total_score DESC);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_calc_date ON component_base_risk_scores(calculation_date DESC);

-- Step 4: Add comment
COMMENT ON TABLE component_base_risk_scores IS 'Base risk scores for components calculated from enrichment data (Migration 066 schema)';

-- Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'component_base_risk_scores'
  AND column_name IN ('lifecycle_risk', 'supply_chain_risk', 'risk_factors', 'calculation_method', 'default_total_score')
ORDER BY column_name;
