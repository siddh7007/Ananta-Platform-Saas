-- ==========================================
-- CIP Service - Initial Database Schema
-- Migration: 001
-- Created: 2025-11-02
-- Description: Create core tables for Component Intelligence Portal
-- ==========================================

-- ==========================================
-- Production Catalog Table
-- ==========================================
-- Stores auto-approved components (quality score >= 95%)

CREATE TABLE IF NOT EXISTS catalog_components (
    id SERIAL PRIMARY KEY,
    mpn VARCHAR(255) NOT NULL UNIQUE,
    manufacturer_id INTEGER REFERENCES catalog_manufacturers(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES catalog_categories(id) ON DELETE SET NULL,

    -- Basic Information
    description TEXT,
    datasheet_url TEXT,
    image_url TEXT,

    -- Lifecycle & Compliance
    lifecycle VARCHAR(50),  -- 'Active', 'NRND', 'Obsolete', 'Preview'
    rohs VARCHAR(50),       -- 'Compliant', 'Non-Compliant', 'Unknown'
    reach VARCHAR(50),      -- 'Compliant', 'Contains SVHC', 'Unknown'

    -- Specifications (JSONB for flexibility)
    specifications JSONB DEFAULT '{}'::jsonb,
    -- Example: {"resistance": "10kΩ", "tolerance": "1%", "power": "0.25W"}

    -- Pricing Information (JSONB)
    pricing JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"quantity": 1, "price": 0.50, "supplier": "mouser"}, ...]

    -- Quality & Enrichment Metadata
    quality_score DECIMAL(5,2) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
    enrichment_source VARCHAR(50),  -- 'customer_bom', 'staff_expansion', 'api_import'
    last_enriched_at TIMESTAMP,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER,  -- User ID who created/approved

    -- Search & Performance
    search_vector TSVECTOR  -- Full-text search vector
);

-- Indexes for catalog_components
CREATE INDEX idx_catalog_components_mpn ON catalog_components(mpn);
CREATE INDEX idx_catalog_components_manufacturer ON catalog_components(manufacturer_id);
CREATE INDEX idx_catalog_components_category ON catalog_components(category_id);
CREATE INDEX idx_catalog_components_quality ON catalog_components(quality_score);
CREATE INDEX idx_catalog_components_lifecycle ON catalog_components(lifecycle);
CREATE INDEX idx_catalog_components_created_at ON catalog_components(created_at);

-- GIN index for JSONB specifications (fast lookup)
CREATE INDEX idx_catalog_components_specifications ON catalog_components USING GIN (specifications);

-- GIN index for full-text search
CREATE INDEX idx_catalog_components_search ON catalog_components USING GIN (search_vector);

-- Comments
COMMENT ON TABLE catalog_components IS 'Production catalog of auto-approved components (quality >= 95%)';
COMMENT ON COLUMN catalog_components.quality_score IS 'Calculated quality score (0-100) based on data completeness';
COMMENT ON COLUMN catalog_components.specifications IS 'Component specifications as JSON (resistance, capacitance, voltage, etc.)';
COMMENT ON COLUMN catalog_components.pricing IS 'Pricing tiers from various suppliers as JSON array';

-- ==========================================
-- Enrichment Queue Table (Staging)
-- ==========================================
-- Stores components needing manual review (quality score 70-94%)

CREATE TABLE IF NOT EXISTS enrichment_queue (
    id SERIAL PRIMARY KEY,
    mpn VARCHAR(255) NOT NULL,

    -- Enrichment Data
    enrichment_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Complete normalized data from enrichment process

    -- AI Suggestions
    ai_suggestions JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"field": "category", "suggestion": "Resistors", "confidence": 0.85}]

    -- Quality & Issues
    quality_score DECIMAL(5,2) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
    issues JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"field": "datasheet_url", "issue": "Missing datasheet"}]

    -- Source Information
    enrichment_source VARCHAR(50) NOT NULL,  -- 'customer_bom', 'staff_expansion'
    customer_id INTEGER,  -- If from customer BOM upload
    bom_job_id VARCHAR(100),  -- Reference to BOM enrichment job

    -- Status & Review
    status VARCHAR(50) DEFAULT 'needs_review',  -- 'needs_review', 'under_review', 'approved', 'rejected'
    reviewed_by INTEGER,  -- User ID of reviewer
    reviewed_at TIMESTAMP,
    review_notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for enrichment_queue
CREATE INDEX idx_enrichment_queue_mpn ON enrichment_queue(mpn);
CREATE INDEX idx_enrichment_queue_quality ON enrichment_queue(quality_score);
CREATE INDEX idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX idx_enrichment_queue_source ON enrichment_queue(enrichment_source);
CREATE INDEX idx_enrichment_queue_customer ON enrichment_queue(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_enrichment_queue_created_at ON enrichment_queue(created_at);

-- GIN index for enrichment_data and ai_suggestions
CREATE INDEX idx_enrichment_queue_data ON enrichment_queue USING GIN (enrichment_data);
CREATE INDEX idx_enrichment_queue_suggestions ON enrichment_queue USING GIN (ai_suggestions);

-- Comments
COMMENT ON TABLE enrichment_queue IS 'Staging queue for components needing manual review (quality 70-94%)';
COMMENT ON COLUMN enrichment_queue.enrichment_data IS 'Complete normalized component data from enrichment process';
COMMENT ON COLUMN enrichment_queue.ai_suggestions IS 'AI-generated suggestions for missing or uncertain data';
COMMENT ON COLUMN enrichment_queue.issues IS 'List of data quality issues identified during enrichment';

-- ==========================================
-- Enrichment History Table (Audit Log)
-- ==========================================
-- Stores all enrichment attempts (approved, rejected, errors)

CREATE TABLE IF NOT EXISTS enrichment_history (
    id SERIAL PRIMARY KEY,
    mpn VARCHAR(255) NOT NULL,

    -- Enrichment Attempt Data
    enrichment_data JSONB,
    quality_score DECIMAL(5,2),

    -- Status & Outcome
    status VARCHAR(50) NOT NULL,  -- 'approved', 'rejected', 'error'
    rejection_reason TEXT,
    error_message TEXT,

    -- Issues Found
    issues JSONB DEFAULT '[]'::jsonb,

    -- Source Information
    enrichment_source VARCHAR(50),
    customer_id INTEGER,
    bom_job_id VARCHAR(100),

    -- Supplier API Calls Made
    api_calls JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"supplier": "mouser", "success": true, "latency_ms": 234}]

    -- Processing Metadata
    processing_time_ms INTEGER,
    tier_reached INTEGER,  -- 1-4 (which tier of fallback was used)

    -- Audit Fields
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER  -- User ID if manually processed
);

-- Indexes for enrichment_history
CREATE INDEX idx_enrichment_history_mpn ON enrichment_history(mpn);
CREATE INDEX idx_enrichment_history_status ON enrichment_history(status);
CREATE INDEX idx_enrichment_history_quality ON enrichment_history(quality_score);
CREATE INDEX idx_enrichment_history_created_at ON enrichment_history(created_at);
CREATE INDEX idx_enrichment_history_customer ON enrichment_history(customer_id) WHERE customer_id IS NOT NULL;

-- GIN index for JSONB columns
CREATE INDEX idx_enrichment_history_data ON enrichment_history USING GIN (enrichment_data);
CREATE INDEX idx_enrichment_history_api_calls ON enrichment_history USING GIN (api_calls);

-- Comments
COMMENT ON TABLE enrichment_history IS 'Audit log of all enrichment attempts (approved, rejected, errors)';
COMMENT ON COLUMN enrichment_history.tier_reached IS 'Highest tier of supplier fallback used (1=Tier1, 4=Web scraping)';
COMMENT ON COLUMN enrichment_history.api_calls IS 'Log of all supplier API calls made during enrichment';

-- ==========================================
-- BOM Upload Jobs Table
-- ==========================================
-- Tracks BOM upload and enrichment jobs

CREATE TABLE IF NOT EXISTS bom_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(100) UNIQUE NOT NULL,  -- UUID for tracking

    -- Customer Information
    customer_id INTEGER,
    customer_name VARCHAR(255),

    -- File Information
    filename VARCHAR(255),
    file_size INTEGER,  -- bytes
    total_items INTEGER,

    -- Processing Status
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    progress INTEGER DEFAULT 0,  -- 0-100

    -- Processing Results
    items_processed INTEGER DEFAULT 0,
    items_auto_approved INTEGER DEFAULT 0,  -- Quality >= 95%
    items_in_staging INTEGER DEFAULT 0,     -- Quality 70-94%
    items_rejected INTEGER DEFAULT 0,       -- Quality < 70%
    items_failed INTEGER DEFAULT 0,         -- Processing errors

    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    processing_time_ms INTEGER,

    -- Error Tracking
    error_message TEXT,

    -- Results
    results_data JSONB,  -- Summary and detailed results

    -- Audit Fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for bom_jobs
CREATE INDEX idx_bom_jobs_job_id ON bom_jobs(job_id);
CREATE INDEX idx_bom_jobs_customer ON bom_jobs(customer_id);
CREATE INDEX idx_bom_jobs_status ON bom_jobs(status);
CREATE INDEX idx_bom_jobs_created_at ON bom_jobs(created_at);

-- Comments
COMMENT ON TABLE bom_jobs IS 'Tracks BOM upload and enrichment jobs from customers';
COMMENT ON COLUMN bom_jobs.job_id IS 'UUID for tracking job status via WebSocket';

-- ==========================================
-- Triggers
-- ==========================================

-- Auto-update updated_at timestamp on catalog_components
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_catalog_components_updated_at
    BEFORE UPDATE ON catalog_components
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at timestamp on enrichment_queue
CREATE TRIGGER update_enrichment_queue_updated_at
    BEFORE UPDATE ON enrichment_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at timestamp on bom_jobs
CREATE TRIGGER update_bom_jobs_updated_at
    BEFORE UPDATE ON bom_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-populate search_vector on catalog_components
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.mpn, '') || ' ' ||
        COALESCE(NEW.description, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_catalog_search_vector
    BEFORE INSERT OR UPDATE ON catalog_components
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- ==========================================
-- Views (Optional - for convenience)
-- ==========================================

-- View: Components needing review (staging queue)
CREATE OR REPLACE VIEW components_needing_review AS
SELECT
    eq.id,
    eq.mpn,
    eq.enrichment_data->>'description' AS description,
    eq.quality_score,
    eq.enrichment_source,
    eq.status,
    eq.created_at,
    COALESCE(jsonb_array_length(eq.issues), 0) AS issue_count,
    COALESCE(jsonb_array_length(eq.ai_suggestions), 0) AS suggestion_count
FROM enrichment_queue eq
WHERE eq.status = 'needs_review'
ORDER BY eq.quality_score DESC, eq.created_at ASC;

COMMENT ON VIEW components_needing_review IS 'Components in staging queue awaiting staff review';

-- View: Enrichment statistics
CREATE OR REPLACE VIEW enrichment_stats AS
SELECT
    DATE(created_at) AS date,
    status,
    COUNT(*) AS count,
    AVG(quality_score) AS avg_quality,
    AVG(processing_time_ms) AS avg_processing_ms
FROM enrichment_history
GROUP BY DATE(created_at), status
ORDER BY date DESC, status;

COMMENT ON VIEW enrichment_stats IS 'Daily enrichment statistics (approved, rejected, errors)';

-- ==========================================
-- Initial Data (Optional)
-- ==========================================

-- Placeholder: Initial categories or manufacturers could be inserted here
-- For now, we assume these are already in the database from V1

-- ==========================================
-- Migration Complete
-- ==========================================

-- Verify table creation
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 001 complete:';
    RAISE NOTICE '   - Created catalog_components table (production)';
    RAISE NOTICE '   - Created enrichment_queue table (staging)';
    RAISE NOTICE '   - Created enrichment_history table (audit log)';
    RAISE NOTICE '   - Created bom_jobs table (job tracking)';
    RAISE NOTICE '   - Created indexes for performance';
    RAISE NOTICE '   - Created triggers for auto-update';
    RAISE NOTICE '   - Created convenience views';
END$$;
