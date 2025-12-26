# Phase 1.1 Implementation: User Management Schema & Backend

## Overview

This document tracks the implementation of Phase 1.1 from the comprehensive Arc SaaS Platform integration plan. Phase 1.1 establishes the foundational user management system with role-based access control (RBAC), invitation workflows, and activity logging.

**Status**: In Progress
**Started**: 2025-01-06
**Priority**: P0 (Critical)

---

## Database Migrations Created

### 1. Users Table Migration
**Files**:
- [20250106000001-add-users-table.js](services/tenant-management-service/migrations/pg/migrations/20250106000001-add-users-table.js)
- [20250106000001-add-users-table-up.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000001-add-users-table-up.sql)
- [20250106000001-add-users-table-down.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000001-add-users-table-down.sql)

**Table**: `main.users`

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| email | varchar(255) | User email address |
| first_name | varchar(100) | First name |
| last_name | varchar(100) | Last name |
| auth_id | varchar(255) | Keycloak user UUID for SSO integration |
| status | smallint | 0=pending, 1=active, 2=suspended, 3=deactivated |
| tenant_id | uuid | Foreign key to tenants table |
| phone | varchar(50) | Phone number (optional) |
| avatar_url | varchar(500) | Profile picture URL (optional) |
| last_login | timestamptz | Last successful login timestamp |
| created_on | timestamptz | Record creation timestamp |
| modified_on | timestamptz | Last modification timestamp |
| created_by | uuid | User who created this record |
| modified_by | uuid | User who last modified this record |
| deleted | boolean | Soft delete flag |
| deleted_on | timestamptz | Deletion timestamp |
| deleted_by | uuid | User who deleted this record |

**Constraints**:
- Primary Key: `pk_users_id` on `id`
- Foreign Key: `fk_users_tenants` → `main.tenants(id)`
- Unique: `uk_users_email_tenant` on `(email, tenant_id)` - ensures email uniqueness per tenant
- Unique: `uk_users_auth_id` on `auth_id` - ensures Keycloak user ID uniqueness

**Indexes**:
- `idx_users_tenant_id` on `tenant_id` (excludes deleted records)
- `idx_users_email` on `email` (excludes deleted records)
- `idx_users_auth_id` on `auth_id` (excludes deleted and NULL)
- `idx_users_status` on `status` (excludes deleted records)

**Design Notes**:
- Follows `UserModifiableEntity` pattern with audit fields
- Multi-tenant isolation via `tenant_id`
- Keycloak SSO integration via `auth_id` field
- Soft delete support with `deleted` flag
- Status field supports user lifecycle: pending → active → suspended/deactivated

---

### 2. User Roles Table Migration
**Files**:
- [20250106000002-add-user-roles-table.js](services/tenant-management-service/migrations/pg/migrations/20250106000002-add-user-roles-table.js)
- [20250106000002-add-user-roles-table-up.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000002-add-user-roles-table-up.sql)
- [20250106000002-add-user-roles-table-down.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000002-add-user-roles-table-down.sql)

**Table**: `main.user_roles`

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| user_id | uuid | Foreign key to users table |
| role_key | varchar(50) | Role identifier (admin, member, billing_manager, viewer) |
| permissions | text[] | Array of permission codes |
| scope_type | varchar(50) | tenant, workspace, or project |
| scope_id | uuid | NULL for tenant-level, otherwise workspace/project ID |
| tenant_id | uuid | Foreign key to tenants table |
| created_on | timestamptz | Record creation timestamp |
| modified_on | timestamptz | Last modification timestamp |
| created_by | uuid | User who created this record |
| modified_by | uuid | User who last modified this record |
| deleted | boolean | Soft delete flag |
| deleted_on | timestamptz | Deletion timestamp |
| deleted_by | uuid | User who deleted this record |

**Constraints**:
- Primary Key: `pk_user_roles_id` on `id`
- Foreign Key: `fk_user_roles_users` → `main.users(id)` ON DELETE CASCADE
- Foreign Key: `fk_user_roles_tenants` → `main.tenants(id)`
- Unique: `uk_user_roles_unique` on `(user_id, role_key, scope_type, scope_id)` - prevents duplicate role assignments

**Indexes**:
- `idx_user_roles_user_id` on `user_id` (excludes deleted records)
- `idx_user_roles_tenant_id` on `tenant_id` (excludes deleted records)
- `idx_user_roles_role_key` on `role_key` (excludes deleted records)
- `idx_user_roles_scope` on `(scope_type, scope_id)` (excludes deleted records)

**Design Notes**:
- Supports hierarchical RBAC: tenant → workspace → project scopes
- Permissions stored as text array for flexibility
- Cascade delete: when a user is deleted, their roles are automatically removed
- Example roles: admin, member, billing_manager, viewer
- Example permissions: CreateUser, ViewUser, UpdateUser, DeleteUser, etc.

---

### 3. User Invitations Table Migration
**Files**:
- [20250106000003-add-user-invitations-table.js](services/tenant-management-service/migrations/pg/migrations/20250106000003-add-user-invitations-table.js)
- [20250106000003-add-user-invitations-table-up.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000003-add-user-invitations-table-up.sql)
- [20250106000003-add-user-invitations-table-down.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000003-add-user-invitations-table-down.sql)

**Table**: `main.user_invitations`

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| email | varchar(255) | Invitee email address |
| token | varchar(255) | Secure random token for invitation link |
| role_key | varchar(50) | Initial role to assign upon acceptance |
| invited_by | uuid | User who sent the invitation |
| tenant_id | uuid | Foreign key to tenants table |
| expires_at | timestamptz | Invitation expiration (typically +7 days) |
| status | smallint | 0=pending, 1=accepted, 2=expired, 3=revoked |
| accepted_at | timestamptz | Acceptance timestamp |
| accepted_by | uuid | User ID created upon acceptance |
| first_name | varchar(100) | Optional first name |
| last_name | varchar(100) | Optional last name |
| custom_message | text | Optional personalized message from inviter |
| created_on | timestamptz | Record creation timestamp |
| modified_on | timestamptz | Last modification timestamp |
| created_by | uuid | User who created this record |
| modified_by | uuid | User who last modified this record |
| deleted | boolean | Soft delete flag |
| deleted_on | timestamptz | Deletion timestamp |
| deleted_by | uuid | User who deleted this record |

**Constraints**:
- Primary Key: `pk_user_invitations_id` on `id`
- Foreign Key: `fk_user_invitations_invited_by` → `main.users(id)`
- Foreign Key: `fk_user_invitations_tenants` → `main.tenants(id)`
- Foreign Key: `fk_user_invitations_accepted_by` → `main.users(id)`
- Unique: `uk_user_invitations_token` on `token`

**Indexes**:
- `idx_user_invitations_email` on `email` (excludes deleted records)
- `idx_user_invitations_tenant_id` on `tenant_id` (excludes deleted records)
- `idx_user_invitations_token` on `token` (excludes deleted and non-pending)
- `idx_user_invitations_status` on `(status, expires_at)` (excludes deleted records)

**Design Notes**:
- Email-based invitation workflow
- Secure random token generation for invitation links
- 7-day default expiration
- Status lifecycle: pending → accepted/expired/revoked
- Links accepted_by to created user for audit trail
- Supports custom messages for personalization
- Integration point: Novu sends invitation emails

---

### 4. User Activities Table Migration
**Files**:
- [20250106000004-add-user-activities-table.js](services/tenant-management-service/migrations/pg/migrations/20250106000004-add-user-activities-table.js)
- [20250106000004-add-user-activities-table-up.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000004-add-user-activities-table-up.sql)
- [20250106000004-add-user-activities-table-down.sql](services/tenant-management-service/migrations/pg/migrations/sqls/20250106000004-add-user-activities-table-down.sql)

**Table**: `main.user_activities`

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| user_id | uuid | Foreign key to users table |
| tenant_id | uuid | Foreign key to tenants table |
| action | varchar(100) | Action identifier (e.g., user.created, user.login) |
| entity_type | varchar(50) | Type of affected entity (user, tenant, subscription) |
| entity_id | uuid | UUID of affected entity |
| metadata | jsonb | Additional context (changed fields, IP, user agent) |
| ip_address | varchar(45) | IPv4 or IPv6 address |
| user_agent | text | Browser/client user agent string |
| occurred_at | timestamptz | Timestamp when activity occurred |

**Constraints**:
- Primary Key: `pk_user_activities_id` on `id`
- Foreign Key: `fk_user_activities_users` → `main.users(id)` ON DELETE CASCADE
- Foreign Key: `fk_user_activities_tenants` → `main.tenants(id)`

**Indexes**:
- `idx_user_activities_user_id` on `(user_id, occurred_at DESC)`
- `idx_user_activities_tenant_id` on `(tenant_id, occurred_at DESC)`
- `idx_user_activities_action` on `(action, occurred_at DESC)`
- `idx_user_activities_entity` on `(entity_type, entity_id, occurred_at DESC)`
- `idx_user_activities_occurred_at` on `occurred_at DESC`

**Design Notes**:
- Comprehensive activity logging for audit trails
- JSONB metadata field for flexible context storage
- Optimized for time-series queries (DESC indexes)
- Captures IP and user agent for security analysis
- Cascade delete: activities removed when user is deleted
- Example actions: user.created, user.login, user.role_changed, user.suspended
- Integration point: Admin UI activity feed

---

## Migration Execution

### Prerequisites
- PostgreSQL 15+ running
- Database: `arc-saas` (or configured DB)
- Schema: `main` already exists (from init migration)
- User: Database user with CREATE TABLE privileges

### Running Migrations

```bash
# Navigate to service directory
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service

# Run all pending migrations
npm run migrate:up

# Or run migrations individually
npx db-migrate up:20250106000001
npx db-migrate up:20250106000002
npx db-migrate up:20250106000003
npx db-migrate up:20250106000004
```

### Rolling Back Migrations

```bash
# Rollback all 4 migrations
npm run migrate:down

# Or rollback individually (in reverse order)
npx db-migrate down:20250106000004
npx db-migrate down:20250106000003
npx db-migrate down:20250106000002
npx db-migrate down:20250106000001
```

### Verification

After migration, verify tables exist:

```sql
-- Check table creation
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'main'
AND table_name IN ('users', 'user_roles', 'user_invitations', 'user_activities');

-- Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'main'
AND tablename IN ('users', 'user_roles', 'user_invitations', 'user_activities');

-- Check foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'main'
AND tc.table_name IN ('users', 'user_roles', 'user_invitations', 'user_activities');
```

---

## Next Steps

### Immediate (Phase 1.1 Continuation)
1. ✅ Database migrations created
2. ⏳ Create Loopback 4 models:
   - `User` model
   - `UserRole` model
   - `UserInvitation` model
   - `UserActivity` model
3. ⏳ Create API controllers:
   - `UsersController` (CRUD + role management)
   - `UserInvitationsController` (send, accept, revoke invitations)
4. ⏳ Update `permissions.ts` with user management permissions
5. ⏳ Create services:
   - `UserService` (business logic, Keycloak sync)
   - `InvitationService` (token generation, email integration)
   - `ActivityLoggerService` (centralized activity logging)

### Integration Points
- **Keycloak**: Sync `users.auth_id` with Keycloak user UUID on creation
- **Novu**: Send invitation emails via Novu notification templates
- **Temporal**: User provisioning workflow (create user → assign roles → send welcome email)
- **Admin Portal**: User management UI (list, create, edit, suspend users)
- **Customer Portal**: Team management UI (invite members, manage roles)

---

## Design Decisions

### Multi-Tenancy
- All user tables include `tenant_id` for strict tenant isolation
- Email uniqueness enforced per tenant (same email can exist in different tenants)
- Activity logging includes tenant context for cross-tenant analytics

### Soft Deletes
- All tables use soft delete pattern (`deleted` boolean flag)
- Indexes exclude deleted records for performance
- Allows data recovery and maintains audit trail

### Performance
- Strategic indexes on foreign keys and query patterns
- JSONB for flexible metadata storage
- Cascade deletes for referential integrity

### Security
- Secure random tokens for invitations
- IP and user agent tracking for security analysis
- Activity logging for compliance and audit

---

## References

- [Comprehensive Plan](C:\Users\siddh\.claude\plans\breezy-brewing-pumpkin.md)
- [Loopback 4 Documentation](https://loopback.io/doc/en/lb4/)
- [db-migrate Documentation](https://db-migrate.readthedocs.io/)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)

---

**Last Updated**: 2025-01-06
**Implemented By**: Claude (Arc SaaS Development)
**Review Status**: Pending User Approval
