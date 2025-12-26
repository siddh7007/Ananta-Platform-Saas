# Platform Super Admin Organization

## Overview

The Platform Super Admin organization is a **system-level organization** used for platform administration and shared test/demo data across the Ananta Platform SaaS.

| Property | Value |
|----------|-------|
| **ID** | `a0000000-0000-0000-0000-000000000000` |
| **Name** | Platform Super Admin |
| **Key** | `platform` |
| **Purpose** | Platform administration, shared test data, staff operations |

## Why It Exists

1. **Tenant Isolation**: Customer data must be isolated, but platform staff need a "home" for test uploads and administrative work
2. **Shared Test Data**: BOMs uploaded to this org are accessible to ALL authenticated staff, making them perfect for demos and testing
3. **Cross-Org Access**: The Platform Super Admin org acts as a "public" organization for platform staff

## Where It's Defined

The Platform Super Admin org must be seeded in **multiple databases** to maintain consistency:

### 1. App Plane - Supabase (`app-plane-supabase-db`)

**Table**: `organizations`

```sql
-- Seeded via migration: 089_platform_staff_organization.sql
INSERT INTO organizations (id, name, slug, org_type, ...)
VALUES (
  'a0000000-0000-0000-0000-000000000000',
  'Platform Super Admin',
  'platform-super-admin',
  'platform',
  ...
);
```

**Migration File**: `app-plane/supabase/migrations/089_platform_staff_organization.sql`

### 2. Control Plane - PostgreSQL (`arc-saas-postgres`)

**Table**: `main.tenants`

```sql
-- Seeded via migration: 20250110000001-seed-platform-super-admin-tenant
INSERT INTO main.tenants (id, name, key, status, ...)
VALUES (
  'a0000000-0000-0000-0000-000000000000',
  'Platform Super Admin',
  'platform',
  0,  -- active
  ...
);
```

**Migration File**: `arc-saas/services/tenant-management-service/migrations/pg/migrations/20250110000001-seed-platform-super-admin-tenant.js`

### 3. Keycloak - ananta-saas & components-platform realms

**Group**: `Platform Super Admin`

**Attributes**:
- `organization_id`: `a0000000-0000-0000-0000-000000000000`
- `is_platform_org`: `true`

**User**: `platform-admin`
- Email: `platform-admin@platform.local`
- Default Password: `platform-admin-change-me`
- Attributes: `organization_id`, `is_platform_admin`

**Setup Script**: `scripts/seed-platform-super-admin.sh`

## Code References

### CNS Service (App Plane)

The constant is defined in `app-plane/services/cns-service/app/config.py`:

```python
# Platform Super Admin organization - a system-level org for testing/admin operations.
# BOMs belonging to this org are accessible to all authenticated staff users.
PLATFORM_SUPER_ADMIN_ORG = "a0000000-0000-0000-0000-000000000000"
```

Used in these files:
- `app/api/bom_enrichment.py` - Access bypass for enrichment triggers
- `app/api/bom_line_items.py` - Access bypass for line item queries
- `app/api/bulk_upload.py` - Allow uploads to Platform org
- `app/api/activity_log.py` - Include Platform org logs for staff
- `app/api/audit_objects.py` - Access bypass for audit data

### Access Control Pattern

```python
from app.config import PLATFORM_SUPER_ADMIN_ORG

# Check if BOM belongs to Platform Super Admin org
is_platform_admin_bom = bom_organization_id == PLATFORM_SUPER_ADMIN_ORG

# Allow access if:
# 1. User's org matches BOM's org, OR
# 2. BOM belongs to Platform Super Admin org (accessible to all staff)
if bom_organization_id != user_org_id and not is_platform_admin_bom:
    raise HTTPException(status_code=403, detail="Access denied")
```

## Seeding Commands

### Fresh Deployment

Run the unified seed script:

```bash
# From project root
./scripts/seed-platform-super-admin.sh
```

Or run individual migrations:

```bash
# Control Plane
cd arc-saas/services/tenant-management-service
npm run migrate

# App Plane Supabase
docker exec -i app-plane-supabase-db psql -U postgres -d postgres \
  < app-plane/supabase/migrations/089_platform_staff_organization.sql
```

### Verify Seeding

```bash
# Check Control Plane
docker exec -e PGPASSWORD=postgres arc-saas-postgres psql -U postgres -d arc_saas -c \
  "SELECT id, name, key FROM main.tenants WHERE id = 'a0000000-0000-0000-0000-000000000000';"

# Check App Plane
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c \
  "SELECT id, name, slug FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000000';"

# Check Keycloak (requires token)
curl -s "http://localhost:8180/admin/realms/components-platform/groups?search=Platform%20Super%20Admin" \
  -H "Authorization: Bearer $KC_TOKEN" | jq '.[0]'
```

## Security Considerations

1. **Not a Real Customer**: This org should never contain production customer data
2. **Staff-Only Access**: Only authenticated platform staff can access this org's data
3. **Audit Logging**: All access via Platform Super Admin bypass is logged for audit purposes
4. **Password Rotation**: Change the default `platform-admin` password in production

## Troubleshooting

### "Organization not found" errors

Ensure the org is seeded in the correct database:
- For CNS Service endpoints → Check Supabase `organizations` table
- For Control Plane endpoints → Check PostgreSQL `main.tenants` table

### "Access denied" for Platform Super Admin BOMs

1. Check that the BOM's `organization_id` matches exactly: `a0000000-0000-0000-0000-000000000000`
2. Verify the user is authenticated (has valid JWT)
3. Check the service code imports `PLATFORM_SUPER_ADMIN_ORG` from config

### Keycloak token missing `organization_id`

1. Ensure user is in the "Platform Super Admin" group
2. Verify group has `organization_id` attribute set
3. Check realm client scopes include group attributes in tokens
