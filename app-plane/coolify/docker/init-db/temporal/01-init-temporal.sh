#!/bin/bash
# =============================================================================
# Temporal PostgreSQL Initialization
# =============================================================================
# Configures pg_hba.conf for docker network access
# The temporal database is already created by POSTGRES_DB env var
# =============================================================================

set -e

echo "[init-db] Configuring Temporal PostgreSQL for docker network access..."

# Configure pg_hba.conf to allow connections from docker network
# This must be done during init to work on first boot
echo "host all all all trust" >> "$PGDATA/pg_hba.conf"

echo "[init-db] Temporal PostgreSQL configured successfully!"
