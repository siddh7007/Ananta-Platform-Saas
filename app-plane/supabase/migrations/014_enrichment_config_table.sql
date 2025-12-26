-- =====================================================
-- Enrichment Configuration Table
-- =====================================================
-- Stores runtime-configurable enrichment settings
-- Allows CNS admins to adjust rate limiting without restarts
-- Created: 2025-11-11

-- Create enrichment_config table
CREATE TABLE IF NOT EXISTS public.enrichment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Configuration fields
    delays_enabled BOOLEAN NOT NULL DEFAULT true,
    delay_per_component_ms INTEGER NOT NULL DEFAULT 500,
    delay_per_batch_ms INTEGER NOT NULL DEFAULT 2000,
    batch_size INTEGER NOT NULL DEFAULT 10,

    -- Metadata
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Validation constraints
    CONSTRAINT valid_delay_per_component CHECK (delay_per_component_ms >= 0),
    CONSTRAINT valid_delay_per_batch CHECK (delay_per_batch_ms >= 0),
    CONSTRAINT valid_batch_size CHECK (batch_size > 0)
);

-- Add helpful comments
COMMENT ON TABLE public.enrichment_config IS 'Runtime configuration for BOM enrichment rate limiting';
COMMENT ON COLUMN public.enrichment_config.delays_enabled IS 'Enable/disable rate limiting delays';
COMMENT ON COLUMN public.enrichment_config.delay_per_component_ms IS 'Delay in milliseconds between processing each component';
COMMENT ON COLUMN public.enrichment_config.delay_per_batch_ms IS 'Delay in milliseconds between processing each batch';
COMMENT ON COLUMN public.enrichment_config.batch_size IS 'Number of components to process in parallel per batch';

-- Insert default configuration (only one row should exist)
INSERT INTO public.enrichment_config (
    delays_enabled,
    delay_per_component_ms,
    delay_per_batch_ms,
    batch_size
) VALUES (
    true,
    500,
    2000,
    10
) ON CONFLICT DO NOTHING;

-- Ensure only one configuration row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_config_singleton ON public.enrichment_config ((1));

-- Create function to update configuration
CREATE OR REPLACE FUNCTION public.update_enrichment_config(
    p_delays_enabled BOOLEAN,
    p_delay_per_component_ms INTEGER,
    p_delay_per_batch_ms INTEGER,
    p_batch_size INTEGER,
    p_updated_by UUID DEFAULT NULL
)
RETURNS public.enrichment_config AS $$
DECLARE
    v_config public.enrichment_config;
BEGIN
    -- Validate inputs
    IF p_delay_per_component_ms < 0 THEN
        RAISE EXCEPTION 'delay_per_component_ms must be non-negative';
    END IF;

    IF p_delay_per_batch_ms < 0 THEN
        RAISE EXCEPTION 'delay_per_batch_ms must be non-negative';
    END IF;

    IF p_batch_size <= 0 THEN
        RAISE EXCEPTION 'batch_size must be positive';
    END IF;

    -- Update or insert configuration (upsert)
    INSERT INTO public.enrichment_config (
        delays_enabled,
        delay_per_component_ms,
        delay_per_batch_ms,
        batch_size,
        updated_by,
        updated_at
    ) VALUES (
        p_delays_enabled,
        p_delay_per_component_ms,
        p_delay_per_batch_ms,
        p_batch_size,
        p_updated_by,
        NOW()
    )
    ON CONFLICT ((1))
    DO UPDATE SET
        delays_enabled = EXCLUDED.delays_enabled,
        delay_per_component_ms = EXCLUDED.delay_per_component_ms,
        delay_per_batch_ms = EXCLUDED.delay_per_batch_ms,
        batch_size = EXCLUDED.batch_size,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    RETURNING * INTO v_config;

    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.enrichment_config TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON public.enrichment_config TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_enrichment_config TO authenticated, service_role;

-- Enable Row Level Security (RLS)
ALTER TABLE public.enrichment_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow anyone to read config (needed for enrichment workflows)
CREATE POLICY "Allow read access to enrichment config"
    ON public.enrichment_config
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

-- Only authenticated users can update config
CREATE POLICY "Allow authenticated users to update enrichment config"
    ON public.enrichment_config
    FOR UPDATE
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Service role can insert/delete (for initialization)
CREATE POLICY "Allow service role full access to enrichment config"
    ON public.enrichment_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create audit log trigger for configuration changes
CREATE TABLE IF NOT EXISTS public.enrichment_config_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL,

    -- Old values
    old_delays_enabled BOOLEAN,
    old_delay_per_component_ms INTEGER,
    old_delay_per_batch_ms INTEGER,
    old_batch_size INTEGER,

    -- New values
    new_delays_enabled BOOLEAN,
    new_delay_per_component_ms INTEGER,
    new_delay_per_batch_ms INTEGER,
    new_batch_size INTEGER,

    -- Metadata
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT
);

COMMENT ON TABLE public.enrichment_config_audit IS 'Audit log for enrichment configuration changes';

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.log_enrichment_config_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.enrichment_config_audit (
        config_id,
        old_delays_enabled,
        old_delay_per_component_ms,
        old_delay_per_batch_ms,
        old_batch_size,
        new_delays_enabled,
        new_delay_per_component_ms,
        new_delay_per_batch_ms,
        new_batch_size,
        changed_by
    ) VALUES (
        NEW.id,
        OLD.delays_enabled,
        OLD.delay_per_component_ms,
        OLD.delay_per_batch_ms,
        OLD.batch_size,
        NEW.delays_enabled,
        NEW.delay_per_component_ms,
        NEW.delay_per_batch_ms,
        NEW.batch_size,
        NEW.updated_by
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
CREATE TRIGGER enrichment_config_audit_trigger
    AFTER UPDATE ON public.enrichment_config
    FOR EACH ROW
    WHEN (
        OLD.delays_enabled IS DISTINCT FROM NEW.delays_enabled OR
        OLD.delay_per_component_ms IS DISTINCT FROM NEW.delay_per_component_ms OR
        OLD.delay_per_batch_ms IS DISTINCT FROM NEW.delay_per_batch_ms OR
        OLD.batch_size IS DISTINCT FROM NEW.batch_size
    )
    EXECUTE FUNCTION public.log_enrichment_config_changes();

-- Grant audit table permissions
GRANT SELECT ON public.enrichment_config_audit TO authenticated, service_role;
GRANT INSERT ON public.enrichment_config_audit TO authenticated, service_role;

-- Enable RLS on audit table
ALTER TABLE public.enrichment_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read audit log"
    ON public.enrichment_config_audit
    FOR SELECT
    TO authenticated, service_role
    USING (true);
