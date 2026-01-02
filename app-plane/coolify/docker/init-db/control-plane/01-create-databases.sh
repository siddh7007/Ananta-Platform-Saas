#!/bin/bash
# =============================================================================
# Control Plane PostgreSQL Initialization
# =============================================================================
# Creates all required databases for control plane services
# This script runs automatically when the PostgreSQL container starts fresh
# =============================================================================

set -e

echo "[init-db] Creating control-plane databases..."

# Create keycloak database (used by Keycloak identity provider)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE keycloak'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

    SELECT 'CREATE DATABASE arc_saas'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'arc_saas')\gexec
EOSQL

echo "[init-db] Control-plane databases created successfully!"

# Configure pg_hba.conf to allow connections from docker network
echo "[init-db] Configuring pg_hba.conf for docker network access..."
echo "host all all all trust" >> "$PGDATA/pg_hba.conf"
echo "[init-db] pg_hba.conf configured!"
