# CBP Test Credentials & Seeded Data

## Unified 5-Level Role Hierarchy

| Level | Role | Description | Access |
|-------|------|-------------|--------|
| 5 | `super_admin` | Platform staff | Platform-wide access |
| 4 | `owner` | Organization owner | Billing, delete org, all admin |
| 3 | `admin` | Organization admin | User management, settings |
| 2 | `engineer` | Technical user | Manage BOMs, components |
| 1 | `analyst` | Read-only user | View data, reports |

## Keycloak Test Users (ananta-saas realm)

| Username | Password | Role | Email |
|----------|----------|------|-------|
| superadmin | Test123! | super_admin | superadmin@platform.local |
| orgowner | Test123! | owner | owner@test.local |
| orgadmin | Test123! | admin | admin@test.local |
| engineer1 | Test123! | engineer | engineer@test.local |
| analyst1 | Test123! | analyst | analyst@test.local |
| cbpadmin | Test123! | super_admin | admin@cbp.local |

## Database Seeded Users

| Email | Profile Role | Org Role | Notes |
|-------|--------------|----------|-------|
| super_admin@test.local | super_admin | owner | Legacy super admin |
| superadmin@platform.local | super_admin | owner | Test super admin |
| owner@test.local | admin | owner | Test org owner |
| admin@test.local | admin | admin | Test org admin |
| engineer@test.local | engineer | engineer | Test engineer |
| staff@test.local | engineer | admin | Platform staff |

## Role CHECK Constraints (All Tables)

All role columns use unified constraint:
```sql
CHECK (role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst'))
```

**Tables**: `user_profiles`, `users`, `organization_memberships`, `workspace_members`

## Seeded Data

### Organization
- ID: `a0000000-0000-0000-0000-000000000000`
- Name: Platform Super Admin

### Default Workspace
- ID: `c13f4caa-fee3-4e9b-805c-a8282bfd59ed`
- Name: Default Workspace

### Projects
| ID | Name | Status |
|----|------|--------|
| b1000000-0000-4000-8000-000000000001 | Hardware Design Project | active |
| b1000000-0000-4000-8000-000000000002 | Prototype Alpha | active |
| b1000000-0000-4000-8000-000000000003 | Legacy Migration | on_hold |

## API Endpoints

### Base URLs
| Service | URL |
|---------|-----|
| CNS API | http://localhost:27200/api |
| Keycloak | http://localhost:8180 |
| Customer Portal | http://localhost:27100 |
| Control Plane | http://localhost:14000 |
| Temporal UI | http://localhost:27021 |

### Get Token (Keycloak)
```bash
# For test users
curl -X POST http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=cbpadmin" \
  -d "password=Test123!"

# Extract token
TOKEN=$(curl -s -X POST http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=cbpadmin" \
  -d "password=Test123!" | jq -r '.access_token')
```

### Example API Calls
```bash
# Get workspaces (requires organization_id)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/workspaces?organization_id=a0000000-0000-0000-0000-000000000000"

# Get projects (requires workspace_id)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/projects?workspace_id=c13f4caa-fee3-4e9b-805c-a8282bfd59ed"

# Create project
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "http://localhost:27200/api/projects" \
  -d '{"workspace_id":"c13f4caa-fee3-4e9b-805c-a8282bfd59ed","name":"Test Project","tags":["test"]}'
```

## MinIO/S3 Storage

| Setting | Value |
|---------|-------|
| Endpoint | http://localhost:27040 |
| Console | http://localhost:27041 |
| Access Key | minioadmin |
| Secret Key | minioadmin |

### Buckets
- `bom-uploads` - BOM file storage
- `bulk-uploads` - Bulk component imports
- `enrichment-audit` - Audit trails
- `documents` - General documents
- `exports` - Export files
- `avatars` - User avatars

## Verification Commands

### Test Authentication
```bash
cd e:/Work/Ananta-Platform-Saas
python test_role_auth.py
```

### Check Database Roles
```bash
# Check user roles
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c \
  "SELECT email, role FROM users;"

# Check organization memberships
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c \
  "SELECT u.email, om.role, om.organization_id FROM organization_memberships om JOIN users u ON u.id = om.user_id;"

# Verify role constraints
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c \
  "SELECT table_name, constraint_name FROM information_schema.table_constraints WHERE constraint_name LIKE '%role%';"
```

### Seed Database
```bash
python seed_and_verify.py
```

## API Status

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /workspaces | GET | OK | Requires organization_id |
| /workspaces | POST | OK | |
| /workspaces/{id} | PUT | OK | |
| /workspaces/{id} | DELETE | OK | |
| /projects | GET | OK | Requires workspace_id |
| /projects | POST | OK | |
| /projects/{id} | PATCH | OK | |
| /projects/{id} | DELETE | OK | Soft delete |
| /boms/{id}/line_items | GET | OK | |
| /admin/boms | GET | 403 | Requires admin role |

## Keycloak Configuration

### Realm: ananta-saas
- Login with email: Enabled
- Brute force protection: Enabled
- SSL required: External

### Clients
| Client ID | Type | Purpose |
|-----------|------|---------|
| admin-app | Confidential | Admin Portal |
| cbp-frontend | Public | Customer Portal |
| admin-cli | Public | Testing/CLI |

### Role Mappers
- `realm roles` mapper includes roles in `realm_access.roles` claim
- All clients have `fullScopeAllowed: true`

## Troubleshooting

### Roles not appearing in JWT
```bash
python keycloak_fix_roles_in_token.py
```

### Database role constraint errors
```bash
# Apply unified role migration
docker exec -i app-plane-supabase-db psql -U postgres -d postgres \
  < app-plane/database/migrations/014_unify_role_constraints.sql
```

### Re-setup Keycloak realm
```bash
python keycloak_setup.py
```
