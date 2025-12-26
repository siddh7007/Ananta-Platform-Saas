-- Custom Alert Generation System Migration
-- Implements user preferences, component watching, and alert delivery tracking
-- Created: 2025-11-11

-- ============================================================================
-- 1. Enhanced Alerts Table
-- ============================================================================

-- Add missing columns to existing alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_archived ON alerts(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_snoozed ON alerts(snoozed_until) WHERE snoozed_until IS NOT NULL;

COMMENT ON COLUMN alerts.user_id IS 'User who should receive this alert';
COMMENT ON COLUMN alerts.context IS 'Additional context data for the alert (JSONB)';
COMMENT ON COLUMN alerts.action_url IS 'URL for alert action button';
COMMENT ON COLUMN alerts.snoozed_until IS 'Alert is hidden until this timestamp';
COMMENT ON COLUMN alerts.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- 2. Alert Preferences Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Alert Type
  alert_type TEXT NOT NULL CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN')),

  -- Delivery Channels
  email_enabled BOOLEAN DEFAULT TRUE,
  webhook_enabled BOOLEAN DEFAULT FALSE,
  in_app_enabled BOOLEAN DEFAULT TRUE,

  -- Contact Info
  email_address TEXT,
  webhook_url TEXT,

  -- Filtering
  component_filter JSONB DEFAULT '{}'::jsonb,
  threshold_config JSONB DEFAULT '{}'::jsonb,

  -- Batching
  batch_enabled BOOLEAN DEFAULT FALSE,
  batch_time TIME,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one preference per user/org/type
  UNIQUE(user_id, organization_id, alert_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_prefs_user ON alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_prefs_org ON alert_preferences(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_prefs_type ON alert_preferences(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_prefs_active ON alert_preferences(is_active) WHERE is_active = true;

COMMENT ON TABLE alert_preferences IS 'User preferences for alert delivery and filtering';
COMMENT ON COLUMN alert_preferences.component_filter IS 'JSON filter for components (e.g., {"category": "Capacitors"})';
COMMENT ON COLUMN alert_preferences.threshold_config IS 'JSON thresholds (e.g., {"risk_min": 60, "price_change_pct": 10})';

-- ============================================================================
-- 3. Component Watch Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_watches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,

  -- What to watch for
  watch_pcn BOOLEAN DEFAULT TRUE,
  watch_lifecycle BOOLEAN DEFAULT TRUE,
  watch_risk BOOLEAN DEFAULT TRUE,
  watch_price BOOLEAN DEFAULT FALSE,
  watch_stock BOOLEAN DEFAULT FALSE,
  watch_compliance BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one watch per user/component
  UNIQUE(user_id, component_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_watches_user ON component_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_watches_component ON component_watches(component_id);

COMMENT ON TABLE component_watches IS 'Track which components users are watching for alerts';

-- ============================================================================
-- 4. Alert Delivery Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,

  -- Delivery Method
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'webhook', 'sms', 'in_app')),
  recipient TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'retrying')) DEFAULT 'pending',

  -- Retry Logic
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,

  -- Result Tracking
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  response_code INTEGER,
  response_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_alert ON alert_deliveries(alert_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON alert_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_method ON alert_deliveries(delivery_method);
CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry ON alert_deliveries(next_retry_at) WHERE status = 'retrying';

COMMENT ON TABLE alert_deliveries IS 'Track alert delivery attempts and results';

-- ============================================================================
-- 5. Alert Generation Functions
-- ============================================================================

-- Function to create risk threshold alert
CREATE OR REPLACE FUNCTION create_risk_threshold_alert(
  component_id_param UUID,
  old_risk_level TEXT,
  new_risk_level TEXT,
  new_risk_score INTEGER
)
RETURNS UUID AS $$
DECLARE
  alert_id UUID;
  component_record RECORD;
  watch_record RECORD;
BEGIN
  -- Only create alert for high/critical risk
  IF new_risk_level NOT IN ('high', 'critical') THEN
    RETURN NULL;
  END IF;

  -- Get component details
  SELECT * INTO component_record FROM components WHERE id = component_id_param;

  -- Create alert for each user watching this component
  FOR watch_record IN
    SELECT * FROM component_watches
    WHERE component_id = component_id_param
      AND watch_risk = TRUE
  LOOP
    INSERT INTO alerts (
      organization_id,
      user_id,
      component_id,
      severity,
      alert_type,
      title,
      message,
      context,
      action_url
    ) VALUES (
      component_record.organization_id,
      watch_record.user_id,
      component_id_param,
      CASE
        WHEN new_risk_level = 'critical' THEN 'CRITICAL'
        WHEN new_risk_level = 'high' THEN 'HIGH'
        ELSE 'MEDIUM'
      END,
      'RISK',
      format('Risk Level Changed: %s → %s', old_risk_level, new_risk_level),
      format('Component %s (MPN: %s) risk score changed to %s/100 (%s risk)',
        component_record.manufacturer,
        component_record.manufacturer_part_number,
        new_risk_score,
        new_risk_level
      ),
      jsonb_build_object(
        'old_risk_level', old_risk_level,
        'new_risk_level', new_risk_level,
        'risk_score', new_risk_score
      ),
      format('/components/%s', component_id_param)
    )
    RETURNING id INTO alert_id;

    -- Queue delivery
    PERFORM queue_alert_delivery(alert_id, watch_record.user_id);
  END LOOP;

  RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_risk_threshold_alert IS 'Create alert when component risk exceeds threshold';

-- Function to create lifecycle change alert
CREATE OR REPLACE FUNCTION create_lifecycle_change_alert(
  component_id_param UUID,
  old_status TEXT,
  new_status TEXT
)
RETURNS UUID AS $$
DECLARE
  alert_id UUID;
  component_record RECORD;
  watch_record RECORD;
  severity_val TEXT;
BEGIN
  -- Determine severity based on new status
  severity_val := CASE new_status
    WHEN 'OBSOLETE' THEN 'CRITICAL'
    WHEN 'EOL' THEN 'HIGH'
    WHEN 'NRND' THEN 'MEDIUM'
    ELSE 'LOW'
  END;

  -- Get component details
  SELECT * INTO component_record FROM components WHERE id = component_id_param;

  -- Create alert for each user watching this component
  FOR watch_record IN
    SELECT * FROM component_watches
    WHERE component_id = component_id_param
      AND watch_lifecycle = TRUE
  LOOP
    INSERT INTO alerts (
      organization_id,
      user_id,
      component_id,
      severity,
      alert_type,
      title,
      message,
      context,
      action_url
    ) VALUES (
      component_record.organization_id,
      watch_record.user_id,
      component_id_param,
      severity_val,
      'LIFECYCLE',
      format('Lifecycle Status Changed: %s → %s', old_status, new_status),
      format('Component %s (MPN: %s) lifecycle status changed from %s to %s',
        component_record.manufacturer,
        component_record.manufacturer_part_number,
        old_status,
        new_status
      ),
      jsonb_build_object(
        'old_status', old_status,
        'new_status', new_status
      ),
      format('/components/%s', component_id_param)
    )
    RETURNING id INTO alert_id;

    -- Queue delivery
    PERFORM queue_alert_delivery(alert_id, watch_record.user_id);
  END LOOP;

  RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_lifecycle_change_alert IS 'Create alert when component lifecycle status changes';

-- Function to queue alert delivery
CREATE OR REPLACE FUNCTION queue_alert_delivery(
  alert_id_param UUID,
  user_id_param UUID
)
RETURNS VOID AS $$
DECLARE
  pref_record RECORD;
  alert_record RECORD;
BEGIN
  -- Get alert details
  SELECT * INTO alert_record FROM alerts WHERE id = alert_id_param;

  -- Get user preferences for this alert type
  SELECT * INTO pref_record
  FROM alert_preferences
  WHERE user_id = user_id_param
    AND organization_id = alert_record.organization_id
    AND alert_type = alert_record.alert_type
    AND is_active = TRUE;

  -- If no preferences found, use defaults
  IF NOT FOUND THEN
    -- Default: in-app only
    INSERT INTO alert_deliveries (alert_id, delivery_method, recipient, status)
    VALUES (alert_id_param, 'in_app', user_id_param::TEXT, 'delivered');
    RETURN;
  END IF;

  -- Queue email delivery if enabled
  IF pref_record.email_enabled AND NOT pref_record.batch_enabled THEN
    INSERT INTO alert_deliveries (
      alert_id,
      delivery_method,
      recipient,
      status
    ) VALUES (
      alert_id_param,
      'email',
      COALESCE(pref_record.email_address, (SELECT email FROM auth.users WHERE id = user_id_param)),
      'pending'
    );
  END IF;

  -- Queue webhook delivery if enabled
  IF pref_record.webhook_enabled AND pref_record.webhook_url IS NOT NULL THEN
    INSERT INTO alert_deliveries (
      alert_id,
      delivery_method,
      recipient,
      status
    ) VALUES (
      alert_id_param,
      'webhook',
      pref_record.webhook_url,
      'pending'
    );
  END IF;

  -- In-app delivery is always instant
  IF pref_record.in_app_enabled THEN
    INSERT INTO alert_deliveries (alert_id, delivery_method, recipient, status, delivered_at)
    VALUES (alert_id_param, 'in_app', user_id_param::TEXT, 'delivered', NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION queue_alert_delivery IS 'Queue alert for delivery via configured channels';

-- ============================================================================
-- 6. Triggers for Automatic Alert Generation
-- ============================================================================

-- Trigger function for risk level changes
CREATE OR REPLACE FUNCTION trigger_risk_level_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create alert if risk level changed and is high/critical
  IF OLD.risk_level IS DISTINCT FROM NEW.risk_level
     AND NEW.risk_level IN ('high', 'critical') THEN
    PERFORM create_risk_threshold_alert(
      NEW.component_id,
      OLD.risk_level,
      NEW.risk_level,
      NEW.total_risk_score
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trigger_alert_on_risk_change ON component_risk_scores;
CREATE TRIGGER trigger_alert_on_risk_change
  AFTER UPDATE OF risk_level
  ON component_risk_scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_risk_level_alert();

-- Trigger function for lifecycle changes
CREATE OR REPLACE FUNCTION trigger_lifecycle_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status THEN
    PERFORM create_lifecycle_change_alert(
      NEW.id,
      OLD.lifecycle_status,
      NEW.lifecycle_status
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trigger_alert_on_lifecycle_change ON components;
CREATE TRIGGER trigger_alert_on_lifecycle_change
  AFTER UPDATE OF lifecycle_status
  ON components
  FOR EACH ROW
  EXECUTE FUNCTION trigger_lifecycle_alert();

-- ============================================================================
-- 7. Helper Views
-- ============================================================================

-- View: Unread alerts with delivery status
CREATE OR REPLACE VIEW user_alerts_with_status AS
SELECT
  a.*,
  COUNT(ad.id) as delivery_attempts,
  MAX(ad.delivered_at) as last_delivered_at,
  BOOL_OR(ad.status = 'failed') as has_failed_delivery
FROM alerts a
LEFT JOIN alert_deliveries ad ON a.id = ad.alert_id
WHERE a.deleted_at IS NULL
  AND (a.snoozed_until IS NULL OR a.snoozed_until < NOW())
GROUP BY a.id;

COMMENT ON VIEW user_alerts_with_status IS 'Alerts with delivery status aggregates';

-- View: Alert statistics per user
CREATE OR REPLACE VIEW user_alert_stats AS
SELECT
  user_id,
  organization_id,
  COUNT(*) as total_alerts,
  COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count,
  COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_count,
  MAX(created_at) as latest_alert_at
FROM alerts
WHERE deleted_at IS NULL
GROUP BY user_id, organization_id;

COMMENT ON VIEW user_alert_stats IS 'Per-user alert statistics';

-- ============================================================================
-- 8. Row-Level Security Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies for alert_preferences
CREATE POLICY "Users manage own alert preferences" ON alert_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- Policies for component_watches
CREATE POLICY "Users manage own component watches" ON component_watches
  FOR ALL
  USING (user_id = auth.uid());

-- Policies for alert_deliveries (read-only for users)
CREATE POLICY "Users see own alert deliveries" ON alert_deliveries
  FOR SELECT
  USING (
    alert_id IN (
      SELECT id FROM alerts WHERE user_id = auth.uid()
    )
  );

-- Enhanced RLS for alerts table (user isolation)
DROP POLICY IF EXISTS "Users see own alerts" ON alerts;
CREATE POLICY "Users see own alerts" ON alerts
  FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Users update own alerts" ON alerts
  FOR UPDATE
  USING (user_id = auth.uid());

COMMENT ON POLICY "Users manage own alert preferences" ON alert_preferences IS 'Users can only manage their own alert preferences';
COMMENT ON POLICY "Users manage own component watches" ON component_watches IS 'Users can only manage their own component watches';
COMMENT ON POLICY "Users see own alert deliveries" ON alert_deliveries IS 'Users can only see delivery status for their own alerts';
COMMENT ON POLICY "Users see own alerts" ON alerts IS 'Users can only see their own non-deleted alerts';
COMMENT ON POLICY "Users update own alerts" ON alerts IS 'Users can only update their own alerts';

-- ============================================================================
-- 9. Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON alert_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON component_watches TO authenticated;
GRANT SELECT ON alert_deliveries TO authenticated;
GRANT SELECT ON user_alerts_with_status TO authenticated;
GRANT SELECT ON user_alert_stats TO authenticated;

-- ============================================================================
-- 10. Default Alert Preferences
-- ============================================================================

-- Function to create default alert preferences for new users
CREATE OR REPLACE FUNCTION create_default_alert_preferences()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Get user's organization ID (assuming it's in user_metadata)
  org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;

  IF org_id IS NOT NULL THEN
    -- Create default preferences for each alert type
    INSERT INTO alert_preferences (user_id, organization_id, alert_type, email_enabled, in_app_enabled)
    VALUES
      (NEW.id, org_id, 'LIFECYCLE', TRUE, TRUE),
      (NEW.id, org_id, 'RISK', TRUE, TRUE),
      (NEW.id, org_id, 'COMPLIANCE', TRUE, TRUE)
    ON CONFLICT (user_id, organization_id, alert_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to create default preferences
DROP TRIGGER IF EXISTS trigger_create_default_alert_prefs ON auth.users;
CREATE TRIGGER trigger_create_default_alert_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_alert_preferences();

COMMENT ON FUNCTION create_default_alert_preferences IS 'Automatically create default alert preferences for new users';
