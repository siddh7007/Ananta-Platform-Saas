-- Migration: 006_audit_enrichment_tables
-- Creates audit tables for enrichment tracking (Directus UI visualization)
--
-- Tables:
--   - audit_enrichment_runs: Master record for each component enrichment
--   - audit_field_comparisons: Field-by-field supplier vs normalized comparison
--   - audit_supplier_quality: Daily supplier quality aggregates

-- ========================================================================
-- AUDIT_ENRICHMENT_RUNS - Master record for each enrichment operation
-- ========================================================================
CREATE TABLE IF NOT EXISTS audit_enrichment_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id TEXT NOT NULL,              -- Bulk upload ID (BOM)
    line_id TEXT NOT NULL,                -- BOM line item ID
    mpn TEXT NOT NULL,                    -- Manufacturer part number
    manufacturer TEXT,                     -- Manufacturer name

    -- Enrichment metadata
    enrichment_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    successful BOOLEAN NOT NULL DEFAULT FALSE,
    quality_score NUMERIC(5,2),           -- 0-100 quality score
    storage_location TEXT,                -- 'database' or 'redis'

    -- Supplier info
    supplier_name TEXT NOT NULL,          -- mouser/digikey/element14
    supplier_match_confidence NUMERIC(5,2), -- Confidence from supplier

    -- Performance metrics
    processing_time_ms INTEGER,           -- Processing time in milliseconds

    -- Error handling
    error_message TEXT,                   -- Error message if failed

    -- Review flags (for Directus workflow)
    needs_review BOOLEAN DEFAULT FALSE,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_enrichment_runs_upload_id ON audit_enrichment_runs(upload_id);
CREATE INDEX IF NOT EXISTS idx_audit_enrichment_runs_line_id ON audit_enrichment_runs(line_id);
CREATE INDEX IF NOT EXISTS idx_audit_enrichment_runs_mpn ON audit_enrichment_runs(mpn);
CREATE INDEX IF NOT EXISTS idx_audit_enrichment_runs_supplier ON audit_enrichment_runs(supplier_name);
CREATE INDEX IF NOT EXISTS idx_audit_enrichment_runs_timestamp ON audit_enrichment_runs(enrichment_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_enrichment_runs_needs_review ON audit_enrichment_runs(needs_review) WHERE needs_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_enrichment_runs_quality ON audit_enrichment_runs(quality_score);

-- ========================================================================
-- AUDIT_FIELD_COMPARISONS - Field-level comparison records
-- ========================================================================
CREATE TABLE IF NOT EXISTS audit_field_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrichment_run_id UUID NOT NULL REFERENCES audit_enrichment_runs(id) ON DELETE CASCADE,

    -- Field identification
    field_name TEXT NOT NULL,             -- Name of field being compared
    field_category TEXT,                  -- compliance, technical, pricing, identification, etc.

    -- Values
    supplier_value TEXT,                  -- Raw value from supplier API
    normalized_value TEXT,                -- Value after normalization

    -- Change tracking
    changed BOOLEAN DEFAULT FALSE,        -- Was value changed during normalization
    change_type TEXT,                     -- cleaned, mapped, extracted, unchanged, missing, removed
    change_reason TEXT,                   -- Human-readable explanation

    -- Quality metrics
    confidence NUMERIC(5,2),              -- Confidence in normalized value (0-100)
    supplier_data_quality TEXT,           -- good, incomplete, invalid, missing
    normalization_applied BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_audit_field_comparisons_run ON audit_field_comparisons(enrichment_run_id);
CREATE INDEX IF NOT EXISTS idx_audit_field_comparisons_field ON audit_field_comparisons(field_name);
CREATE INDEX IF NOT EXISTS idx_audit_field_comparisons_category ON audit_field_comparisons(field_category);
CREATE INDEX IF NOT EXISTS idx_audit_field_comparisons_changed ON audit_field_comparisons(changed);

-- ========================================================================
-- AUDIT_SUPPLIER_QUALITY - Daily supplier quality aggregates
-- ========================================================================
CREATE TABLE IF NOT EXISTS audit_supplier_quality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    supplier_name TEXT NOT NULL,

    -- Volume metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,

    -- Quality metrics
    avg_quality_score NUMERIC(5,2),
    avg_match_confidence NUMERIC(5,2),
    avg_processing_time_ms INTEGER,

    -- Field quality breakdown
    fields_changed_count INTEGER DEFAULT 0,
    fields_missing_count INTEGER DEFAULT 0,
    fields_invalid_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(date, supplier_name)
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_audit_supplier_quality_date ON audit_supplier_quality(date);
CREATE INDEX IF NOT EXISTS idx_audit_supplier_quality_supplier ON audit_supplier_quality(supplier_name);

-- ========================================================================
-- FUNCTION: Update supplier quality stats for a given date
-- ========================================================================
CREATE OR REPLACE FUNCTION update_supplier_quality_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_supplier_quality (
        date, supplier_name,
        total_requests, successful_requests, failed_requests,
        avg_quality_score, avg_match_confidence, avg_processing_time_ms,
        fields_changed_count, fields_missing_count, fields_invalid_count
    )
    SELECT
        target_date,
        r.supplier_name,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE r.successful = TRUE) as successful_requests,
        COUNT(*) FILTER (WHERE r.successful = FALSE) as failed_requests,
        AVG(r.quality_score) as avg_quality_score,
        AVG(r.supplier_match_confidence) as avg_match_confidence,
        AVG(r.processing_time_ms)::INTEGER as avg_processing_time_ms,
        COUNT(fc.id) FILTER (WHERE fc.changed = TRUE) as fields_changed_count,
        COUNT(fc.id) FILTER (WHERE fc.supplier_data_quality = 'missing') as fields_missing_count,
        COUNT(fc.id) FILTER (WHERE fc.supplier_data_quality = 'invalid') as fields_invalid_count
    FROM audit_enrichment_runs r
    LEFT JOIN audit_field_comparisons fc ON fc.enrichment_run_id = r.id
    WHERE DATE(r.enrichment_timestamp) = target_date
    GROUP BY r.supplier_name
    ON CONFLICT (date, supplier_name) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        successful_requests = EXCLUDED.successful_requests,
        failed_requests = EXCLUDED.failed_requests,
        avg_quality_score = EXCLUDED.avg_quality_score,
        avg_match_confidence = EXCLUDED.avg_match_confidence,
        avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
        fields_changed_count = EXCLUDED.fields_changed_count,
        fields_missing_count = EXCLUDED.fields_missing_count,
        fields_invalid_count = EXCLUDED.fields_invalid_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- TRIGGER: Update updated_at timestamp
-- ========================================================================
CREATE OR REPLACE FUNCTION update_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_enrichment_runs_updated_at ON audit_enrichment_runs;
CREATE TRIGGER audit_enrichment_runs_updated_at
    BEFORE UPDATE ON audit_enrichment_runs
    FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

DROP TRIGGER IF EXISTS audit_supplier_quality_updated_at ON audit_supplier_quality;
CREATE TRIGGER audit_supplier_quality_updated_at
    BEFORE UPDATE ON audit_supplier_quality
    FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();
