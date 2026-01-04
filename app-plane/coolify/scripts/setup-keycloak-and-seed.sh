#!/bin/bash
# Keycloak and Database Seeding Script
# Creates realms, clients, users and seeds databases

set -e

echo "=== Step 1: Get Keycloak admin token ==="
KEYCLOAK_TOKEN=$(curl -s -X POST 'http://localhost:8180/realms/master/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=admin' \
  -d 'password=admin' \
  -d 'grant_type=password' \
  -d 'client_id=admin-cli' | grep -o '"access_token":"[^"]*"' | sed 's/"access_token":"//;s/"$//')

if [ -z "$KEYCLOAK_TOKEN" ]; then
  echo "ERROR: Failed to get Keycloak admin token"
  exit 1
fi
echo "Got Keycloak admin token"

echo ""
echo "=== Step 2: Create components-platform realm ==="
curl -s -X POST 'http://localhost:8180/admin/realms' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -d '{
    "realm": "components-platform",
    "enabled": true,
    "displayName": "Components Platform",
    "registrationAllowed": false,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "sslRequired": "external"
  }' && echo "Realm created" || echo "Realm may already exist"

echo ""
echo "=== Step 3: Create cns-service client ==="
curl -s -X POST 'http://localhost:8180/admin/realms/components-platform/clients' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -d '{
    "clientId": "cns-service",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": false,
    "serviceAccountsEnabled": true,
    "authorizationServicesEnabled": false,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "secret": "cns-service-secret",
    "redirectUris": ["http://localhost:27200/*", "http://localhost:27700/*"],
    "webOrigins": ["http://localhost:27200", "http://localhost:27700", "+"]
  }' && echo "cns-service client created" || echo "Client may already exist"

echo ""
echo "=== Step 4: Create cns-dashboard client ==="
curl -s -X POST 'http://localhost:8180/admin/realms/components-platform/clients' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -d '{
    "clientId": "cns-dashboard",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "redirectUris": ["http://localhost:27800/*", "http://localhost:27810/*", "http://localhost:27500/*"],
    "webOrigins": ["http://localhost:27800", "http://localhost:27810", "http://localhost:27500", "+"]
  }' && echo "cns-dashboard client created" || echo "Client may already exist"

echo ""
echo "=== Step 5: Create realm roles for components-platform ==="
for role in super_admin owner admin engineer analyst; do
  curl -s -X POST "http://localhost:8180/admin/realms/components-platform/roles" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
    -d "{\"name\": \"$role\"}" 2>/dev/null || true
  echo "Created role: $role"
done

echo ""
echo "=== Step 6: Create test user for CNS (cnsadmin) ==="
curl -s -X POST 'http://localhost:8180/admin/realms/components-platform/users' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
  -d '{
    "username": "cnsadmin",
    "enabled": true,
    "emailVerified": true,
    "email": "cnsadmin@example.com",
    "firstName": "CNS",
    "lastName": "Administrator",
    "credentials": [{
      "type": "password",
      "value": "admin123",
      "temporary": false
    }]
  }' && echo "User cnsadmin created" || echo "User may already exist"

echo ""
echo "=== Step 7: Assign admin role to cnsadmin ==="
USER_ID=$(curl -s "http://localhost:8180/admin/realms/components-platform/users?username=cnsadmin" \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')

ROLE_ID=$(curl -s "http://localhost:8180/admin/realms/components-platform/roles/admin" \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN" | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"$//')

if [ -n "$USER_ID" ] && [ -n "$ROLE_ID" ]; then
  curl -s -X POST "http://localhost:8180/admin/realms/components-platform/users/$USER_ID/role-mappings/realm" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $KEYCLOAK_TOKEN" \
    -d "[{\"id\": \"$ROLE_ID\", \"name\": \"admin\"}]"
  echo "Admin role assigned to cnsadmin"
fi

echo ""
echo "=== Step 8: Seed Control Plane Database (arc_saas) ==="
docker exec -i arc-saas-postgres psql -U postgres -d arc_saas << 'EOSQL'
-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS main;

-- Platform Super Admin tenant
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

-- Platform contact
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

SELECT 'Control Plane seeded successfully' as status;
EOSQL

echo ""
echo "=== Step 9: Seed App Plane Database (Supabase - postgres) ==="
docker exec -i app-plane-supabase-db psql -U postgres -d postgres << 'EOSQL'
-- Create organizations table if not exists
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Super Admin organization (matches Control Plane tenant ID)
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

SELECT 'App Plane Supabase seeded successfully' as status;
EOSQL

echo ""
echo "=== Keycloak and Database Seeding Complete! ==="
echo ""
echo "Summary:"
echo "  Keycloak Realms:"
echo "    - ananta-saas (Admin App)"
echo "    - components-platform (CNS Service/Dashboard)"
echo ""
echo "  Keycloak Users:"
echo "    - testadmin@example.com (ananta-saas realm, role: admin)"
echo "    - cnsadmin@example.com (components-platform realm, role: admin)"
echo "    - Password: admin123"
echo ""
echo "  Database Seeds:"
echo "    - Control Plane (arc_saas): Platform Super Admin tenant"
echo "    - App Plane (Supabase): Platform Super Admin organization"
echo "    - ID: a0000000-0000-0000-0000-000000000000"
