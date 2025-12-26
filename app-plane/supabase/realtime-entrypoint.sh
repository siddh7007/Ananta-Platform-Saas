#!/bin/sh
set -e

# Export all environment variables explicitly
export APP_NAME="${APP_NAME:-realtime}"
export DB_HOST="${DB_HOST:-components-v2-supabase-db}"
export DB_PORT="${DB_PORT:-5432}"
export DB_USER="${DB_USER:-supabase_admin}"
export DB_PASSWORD="${DB_PASSWORD}"
export DB_NAME="${DB_NAME:-supabase}"
export DB_SSL="${DB_SSL:-false}"
export PORT="${PORT:-4000}"
export JWT_SECRET="${JWT_SECRET}"
export SECRET_KEY_BASE="${SECRET_KEY_BASE}"
export REPLICATION_MODE="${REPLICATION_MODE:-RLS}"
export REPLICATION_POLL_INTERVAL="${REPLICATION_POLL_INTERVAL:-100}"
export SECURE_CHANNELS="${SECURE_CHANNELS:-true}"
export SLOT_NAME="${SLOT_NAME:-supabase_realtime_rls}"
export TEMPORARY_SLOT="${TEMPORARY_SLOT:-true}"

# Debug: Show that APP_NAME is set
echo "🔍 Entrypoint check: APP_NAME=${APP_NAME}"

# Execute the original command
exec "$@"
