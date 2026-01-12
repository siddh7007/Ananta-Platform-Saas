-- =============================================================================
-- 003-seed-data.sql
-- Initial seed data for the platform
-- =============================================================================

SET search_path TO tenant_management, public;

-- =============================================================================
-- Default Roles
-- =============================================================================

INSERT INTO roles (key, name, description, permissions, is_system) VALUES
  ('super_admin', 'Super Admin', 'Platform administrator with full access',
   ARRAY['*'], TRUE),
  ('owner', 'Owner', 'Organization owner with billing access',
   ARRAY['tenant:*', 'user:*', 'billing:*', 'subscription:*'], TRUE),
  ('admin', 'Admin', 'Organization admin for user management',
   ARRAY['tenant:read', 'tenant:update', 'user:*', 'subscription:read'], TRUE),
  ('engineer', 'Engineer', 'Technical user for managing resources',
   ARRAY['tenant:read', 'user:read', 'subscription:read', 'resource:*'], TRUE),
  ('analyst', 'Analyst', 'Read-only user for viewing data and reports',
   ARRAY['tenant:read', 'user:read', 'subscription:read', 'report:read'], TRUE)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- =============================================================================
-- Default Plans
-- =============================================================================

INSERT INTO plans (key, name, tier, description, price, currency, billing_cycle, features, limits, sort_order) VALUES
  ('plan-free', 'Free', 'free', 'Get started with basic features',
   0.00, 'USD', 'monthly',
   '["Up to 3 users", "Basic support", "1GB storage", "Community access"]'::JSONB,
   '{"users": 3, "storage_gb": 1, "api_calls_per_month": 1000}'::JSONB,
   0),
  ('plan-basic', 'Basic', 'basic', 'Essential features for small teams',
   29.00, 'USD', 'monthly',
   '["Up to 10 users", "Email support", "10GB storage", "API access"]'::JSONB,
   '{"users": 10, "storage_gb": 10, "api_calls_per_month": 10000}'::JSONB,
   1),
  ('plan-standard', 'Standard', 'standard', 'Advanced features for growing teams',
   79.00, 'USD', 'monthly',
   '["Up to 50 users", "Priority support", "100GB storage", "Advanced analytics", "Custom integrations"]'::JSONB,
   '{"users": 50, "storage_gb": 100, "api_calls_per_month": 100000}'::JSONB,
   2),
  ('plan-premium', 'Premium', 'premium', 'Full-featured for large organizations',
   199.00, 'USD', 'monthly',
   '["Unlimited users", "24/7 support", "1TB storage", "Advanced analytics", "Custom integrations", "SSO/SAML", "Dedicated account manager"]'::JSONB,
   '{"users": -1, "storage_gb": 1000, "api_calls_per_month": -1}'::JSONB,
   3),
  ('plan-enterprise', 'Enterprise', 'enterprise', 'Custom solutions for enterprise needs',
   0.00, 'USD', 'custom',
   '["Everything in Premium", "Custom deployment", "SLA guarantee", "Custom development", "On-premise option"]'::JSONB,
   '{"users": -1, "storage_gb": -1, "api_calls_per_month": -1}'::JSONB,
   4)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  tier = EXCLUDED.tier,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  sort_order = EXCLUDED.sort_order;

-- =============================================================================
-- Default Platform Settings
-- =============================================================================

INSERT INTO settings (key, value, description) VALUES
  ('platform.name', '"Ananta Platform"', 'Platform display name'),
  ('platform.version', '"1.0.0"', 'Platform version'),
  ('platform.support_email', '"support@ananta.io"', 'Support email address'),
  ('platform.default_plan', '"plan-basic"', 'Default plan for new tenants'),
  ('platform.trial_days', '14', 'Number of trial days for new subscriptions'),
  ('platform.max_tenants', '-1', 'Maximum number of tenants (-1 for unlimited)'),
  ('auth.password_min_length', '8', 'Minimum password length'),
  ('auth.mfa_required', 'false', 'Require MFA for all users'),
  ('auth.session_timeout_minutes', '60', 'Session timeout in minutes'),
  ('notifications.email_enabled', 'true', 'Enable email notifications'),
  ('notifications.slack_enabled', 'false', 'Enable Slack notifications'),
  ('billing.tax_rate', '0', 'Default tax rate percentage'),
  ('billing.invoice_prefix', '"INV"', 'Invoice number prefix')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- =============================================================================
-- Demo Tenant (for local development)
-- =============================================================================

-- Only insert demo data if not already present
DO $$
DECLARE
  demo_tenant_id UUID;
  demo_user_id UUID;
  basic_plan_id UUID;
  admin_role_id UUID;
BEGIN
  -- Check if demo tenant exists
  SELECT id INTO demo_tenant_id FROM tenants WHERE key = 'demo';

  IF demo_tenant_id IS NULL THEN
    -- Get plan and role IDs
    SELECT id INTO basic_plan_id FROM plans WHERE key = 'plan-basic';
    SELECT id INTO admin_role_id FROM roles WHERE key = 'admin';

    -- Create demo tenant
    INSERT INTO tenants (name, key, status, tier, primary_contact_email, metadata)
    VALUES ('Demo Organization', 'demo', 'active', 'basic', 'demo@example.com',
            '{"demo": true, "created_by": "seed"}'::JSONB)
    RETURNING id INTO demo_tenant_id;

    -- Create demo subscription
    INSERT INTO subscriptions (tenant_id, plan_id, status, start_date, end_date)
    VALUES (demo_tenant_id, basic_plan_id, 'active', NOW(), NOW() + INTERVAL '1 year');

    -- Create demo user
    INSERT INTO users (tenant_id, username, email, first_name, last_name, status)
    VALUES (demo_tenant_id, 'demo.user', 'demo@example.com', 'Demo', 'User', 'active')
    RETURNING id INTO demo_user_id;

    -- Assign admin role to demo user
    INSERT INTO user_roles (user_id, role_id, tenant_id)
    VALUES (demo_user_id, admin_role_id, demo_tenant_id);

    RAISE NOTICE 'Created demo tenant with ID: %', demo_tenant_id;
  ELSE
    RAISE NOTICE 'Demo tenant already exists with ID: %', demo_tenant_id;
  END IF;
END
$$;

-- Record this migration
INSERT INTO public.schema_migrations (version, name, checksum)
VALUES ('003', 'seed-data', md5('003-seed-data'))
ON CONFLICT (version) DO NOTHING;
