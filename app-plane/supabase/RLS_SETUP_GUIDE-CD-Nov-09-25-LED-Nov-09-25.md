# Row-Level Security (RLS) Setup Guide

## Current Status

**RLS is temporarily DISABLED** because the Supabase Auth schema is not fully configured in this instance.

## Role Hierarchy (Industry Standard)

1. **super_admin** - Platform administrator (Ananta staff)
   - Full CRUD across ALL tenants
   - Can create/delete organizations
   - Can manage all users, projects, BOMs

2. **admin** - Organization administrator
   - Full CRUD within THEIR organization
   - Can manage users in their org
   - Can manage all projects and BOMs in their org

3. **engineer** - Product engineer/designer (core user role)
   - Can CREATE/UPDATE/DELETE their own projects
   - Can CREATE/UPDATE/DELETE BOMs in their projects
   - Can VIEW components catalog (read-only)
   - Can VIEW other users in their org

4. **analyst** - Read-only reporter
   - Can VIEW all data in their organization
   - Can export reports
   - CANNOT create, update, or delete anything

## Current Role Assignments

- `dev@ananta.com` → `admin`
- (New users default to `engineer`)

## Required Setup to Enable RLS

### 1. Ensure Supabase Auth is Configured

The following must be set up in Supabase:

```sql
-- Verify auth schema has users table
SELECT * FROM auth.users LIMIT 1;

-- Verify auth.uid() function exists
SELECT auth.uid();
```

### 2. Apply RLS Migration

Once Supabase Auth is ready, apply:

```bash
psql -U postgres -d postgres -f supabase/migrations/003_rbac_industry_standard.sql
```

### 3. Verify RLS Policies

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '%_v2';

-- Check policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Permissions Matrix

| Resource   | super_admin | admin    | engineer | analyst |
|------------|-------------|----------|----------|---------|
| Tenants    | CRUD (all)  | R (own)  | R (own)  | R (own) |
| Users      | CRUD (all)  | CRUD (org)| R (org) | R (org) |
| Projects   | CRUD (all)  | CRUD (org)| CRUD (own)| R (org) |
| BOMs       | CRUD (all)  | CRUD (org)| CRUD (own)| R (org) |
| Components | CRUD (all)  | CRUD (org)| R (org)  | R (org) |
| Alerts     | CRUD (all)  | CRUD (org)| CRU (own)| R (org) |

**Legend:**
- C=Create, R=Read, U=Update, D=Delete
- (all) = across all tenants
- (org) = within own organization
- (own) = own projects only

## Testing RLS Policies

### Test as engineer

```sql
-- Set session to engineer user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<engineer-uuid>"}';

-- Should only see own projects
SELECT * FROM projects_v2;

-- Should NOT be able to create in other tenant
INSERT INTO projects_v2 (name, tenant_id) VALUES ('Test', '<other-tenant-id>');
-- Expected: permission denied
```

### Test as admin

```sql
-- Set session to admin user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<admin-uuid>"}';

-- Should see all projects in org
SELECT * FROM projects_v2;

-- Should be able to create users in org
INSERT INTO users_v2 (email, tenant_id, role) VALUES (...);
```

## Current Workaround

Until RLS is enabled:

1. ✅ Table-level permissions are enforced (GRANT statements)
2. ✅ Role constraints prevent invalid role assignments
3. ⚠️ Users can access data across tenants (multi-tenancy not enforced)
4. ⚠️ Engineers can see all projects (not just their own)

**Security Note:** For production, RLS MUST be enabled to enforce proper multi-tenant isolation.

## Migration Path

When ready to enable RLS:

1. Ensure all users have valid `auth_subject` matching `auth.users.id`
2. Test RLS policies in staging environment
3. Enable RLS table by table
4. Monitor for permission errors
5. Adjust policies as needed

## Helper Functions (Will be created when RLS is enabled)

- `auth_user_id()` - Get current user's UUID from auth
- `current_user_info()` - Get user profile (id, tenant, role)
- `is_super_admin()` - Check if user is super_admin
- `is_admin()` - Check if user is admin or higher
- `is_engineer()` - Check if user is engineer or higher
- `current_user_tenant()` - Get user's tenant_id
- `current_app_user_id()` - Get user's UUID from users_v2

## Support

For questions about RLS setup, contact Ananta platform team.
