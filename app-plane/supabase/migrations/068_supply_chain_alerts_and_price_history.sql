-- Migration: 068_supply_chain_alerts_and_price_history.sql
-- Description: Add SUPPLY_CHAIN alert type, price history tracking, and watch column
-- Date: 2025-11-29

-- ============================================================================
-- 1. Create component_price_history table for price change tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS component_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES central_component_catalog(id) ON DELETE CASCADE,
    last_unit_price DECIMAL(12, 6) NOT NULL,
    price_breaks JSONB,
    price_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for upsert
    CONSTRAINT unique_component_price UNIQUE (component_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_price_history_component ON component_price_history(component_id);
CREATE INDEX IF NOT EXISTS idx_price_history_updated ON component_price_history(price_updated_at DESC);

-- ============================================================================
-- 2. Add watch_supply_chain column to component_watches table
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'component_watches' AND column_name = 'watch_supply_chain'
    ) THEN
        ALTER TABLE component_watches ADD COLUMN watch_supply_chain BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- ============================================================================
-- 3. Update alert_type CHECK constraint to include SUPPLY_CHAIN
-- ============================================================================
-- Drop existing constraint if exists
DO $$
BEGIN
    -- Try to drop the constraint on alerts table
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'alerts_alert_type_check' AND table_name = 'alerts'
    ) THEN
        ALTER TABLE alerts DROP CONSTRAINT alerts_alert_type_check;
    END IF;
EXCEPTION WHEN undefined_object THEN
    NULL;
END $$;

-- Add updated constraint including SUPPLY_CHAIN
DO $$
BEGIN
    ALTER TABLE alerts ADD CONSTRAINT alerts_alert_type_check
    CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN'));
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 4. Update alert_preferences constraint for SUPPLY_CHAIN
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'alert_preferences_alert_type_check' AND table_name = 'alert_preferences'
    ) THEN
        ALTER TABLE alert_preferences DROP CONSTRAINT alert_preferences_alert_type_check;
    END IF;
EXCEPTION WHEN undefined_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE alert_preferences ADD CONSTRAINT alert_preferences_alert_type_check
    CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN'));
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 5. Add default preferences for SUPPLY_CHAIN alert type for existing users
-- ============================================================================
INSERT INTO alert_preferences (
    user_id,
    organization_id,
    alert_type,
    is_active,
    in_app_enabled,
    email_enabled,
    webhook_enabled
)
SELECT DISTINCT
    ap.user_id,
    ap.organization_id,
    'SUPPLY_CHAIN',
    TRUE,
    TRUE,
    FALSE,
    FALSE
FROM alert_preferences ap
WHERE NOT EXISTS (
    SELECT 1 FROM alert_preferences ap2
    WHERE ap2.user_id = ap.user_id
    AND ap2.organization_id = ap.organization_id
    AND ap2.alert_type = 'SUPPLY_CHAIN'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. RLS policies for component_price_history
-- ============================================================================
ALTER TABLE component_price_history ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to price history"
    ON component_price_history
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON component_price_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON component_price_history TO service_role;

-- ============================================================================
-- 8. Create index for alert type filtering
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alerts_supply_chain
    ON alerts(alert_type)
    WHERE alert_type = 'SUPPLY_CHAIN';

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE component_price_history IS 'Tracks component price history for price change alerts';
COMMENT ON COLUMN component_price_history.last_unit_price IS 'Most recent unit price (quantity=1 tier)';
COMMENT ON COLUMN component_price_history.price_breaks IS 'Full price break structure from supplier';
COMMENT ON COLUMN component_watches.watch_supply_chain IS 'Watch for supply chain alerts (scarcity, single-source)';
