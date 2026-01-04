#!/bin/sh
set -euo pipefail

WORKDIR=/workspace
STATE_DIR=/state
DONE_FILE="$STATE_DIR/migrate-and-seed.done"

wait_for_db() {
  host="$1"
  user="$2"
  db="$3"
  echo "Waiting for $host/$db..."
  until PGPASSWORD="$PGPASSWORD" pg_isready -h "$host" -U "$user" -d "$db" >/dev/null 2>&1; do
    sleep 2
  done
}

run_sql() {
  host="$1"
  user="$2"
  db="$3"
  file="$4"
  echo "Applying $file to $host/$db"
  PGPASSWORD="$PGPASSWORD" psql -h "$host" -U "$user" -d "$db" -f "$file"
}

if [ -f "$DONE_FILE" ]; then
  echo "Migrations already completed. Remove $DONE_FILE to re-run."
  exit 0
fi

if [ -z "${CONTROL_PLANE_DB_PASSWORD:-}" ] || [ -z "${SUPABASE_DB_PASSWORD:-}" ] || [ -z "${COMPONENTS_V2_DB_PASSWORD:-}" ]; then
  echo "Missing required DB passwords. Set CONTROL_PLANE_DB_PASSWORD, SUPABASE_DB_PASSWORD, and COMPONENTS_V2_DB_PASSWORD."
  exit 1
fi

# Control plane migrations
PGPASSWORD="$CONTROL_PLANE_DB_PASSWORD"
wait_for_db control-plane-postgres postgres arc_saas
run_sql control-plane-postgres postgres postgres "$WORKDIR/app-plane/coolify/migrations/000_init_databases.sql"
run_sql control-plane-postgres postgres arc_saas "$WORKDIR/app-plane/coolify/migrations/003_ARC_SAAS_MASTER.sql"

# Seed control plane (platform tenant + contact)
PGPASSWORD="$CONTROL_PLANE_DB_PASSWORD" psql -h control-plane-postgres -U postgres -d arc_saas <<'EOSQL'
CREATE SCHEMA IF NOT EXISTS main;

INSERT INTO main.tenants (id, name, key, status, domains, created_on, modified_on)
VALUES (
  'a0000000-0000-0000-0000-000000000000',
  'Platform Super Admin',
  'platform',
  0,
  ARRAY['platform.local'],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  key = 'platform',
  status = 0,
  modified_on = NOW();

INSERT INTO main.contacts (id, first_name, last_name, email, is_primary, tenant_id, created_on)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Platform',
  'Administrator',
  'platform-admin@example.com',
  TRUE,
  'a0000000-0000-0000-0000-000000000000',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
EOSQL

# App plane migrations (Supabase + Components)
PGPASSWORD="$SUPABASE_DB_PASSWORD"
wait_for_db supabase-db postgres postgres
run_sql supabase-db postgres postgres "$WORKDIR/app-plane/coolify/migrations/001_SUPABASE_MASTER.sql"

PGPASSWORD="$COMPONENTS_V2_DB_PASSWORD"
wait_for_db components-v2-postgres postgres components_v2
run_sql components-v2-postgres postgres components_v2 "$WORKDIR/app-plane/coolify/migrations/002_COMPONENTS_V2_MASTER.sql"

# Seed app plane organization
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h supabase-db -U postgres -d postgres <<'EOSQL'
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.organizations (id, name, slug, status)
VALUES (
  'a0000000-0000-0000-0000-000000000000',
  'Platform Super Admin',
  'platform',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();
EOSQL

mkdir -p "$STATE_DIR"
touch "$DONE_FILE"
echo "Migrations and seeds complete."
