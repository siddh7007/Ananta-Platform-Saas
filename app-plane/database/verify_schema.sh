#!/bin/bash
# Schema verification script for components_v2 database

echo "========================================="
echo "Components-V2 Database Schema Verification"
echo "========================================="
echo ""

echo "TABLES:"
docker exec app-plane-components-v2-postgres psql -U postgres -d components_v2 -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;"
echo ""

echo "VIEWS:"
docker exec app-plane-components-v2-postgres psql -U postgres -d components_v2 -t -A -c "SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name;"
echo ""

echo "FUNCTIONS:"
docker exec app-plane-components-v2-postgres psql -U postgres -d components_v2 -t -A -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION' ORDER BY routine_name;"
echo ""

echo "COLUMNS (sample from component_catalog):"
docker exec app-plane-components-v2-postgres psql -U postgres -d components_v2 -t -A -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='component_catalog' ORDER BY ordinal_position;"
echo ""

echo "========================================="
