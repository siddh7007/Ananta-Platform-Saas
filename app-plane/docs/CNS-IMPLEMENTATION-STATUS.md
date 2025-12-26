# CNS Projects Alignment - Implementation Status

**Version:** 1.0.0
**Last Updated:** 2025-12-14
**Status:** Planning Complete - Ready for Implementation

## Overview

This document tracks the implementation progress of the CNS Projects Alignment specification. It consolidates the detailed implementation plans from specialized agents and provides step-by-step execution status.

## Implementation Plans Summary

Three comprehensive implementation plans have been created by specialized planning agents:

### 1. Database Schema Migration Plan ✅ COMPLETE

**Agent**: Software Architect (Database Planning)
**Document**: Embedded in this status document (Section 4)
**Scope**: 3-phase database migration for workspace/project hierarchy

**Key Deliverables**:
- ✅ 12 SQL migration scripts (Phase 1-3)
- ✅ Rollback scripts for each phase
- ✅ Validation queries for each step
- ✅ Complete data backfill strategy
- ✅ Risk assessment and mitigation plan

**Estimated Time**: 20 minutes total
**Downtime**: <1 second (minimal table locks)
**Risk Level**: Low-Medium with rollback capability

---

### 2. API Contract & Scope Headers Plan ✅ COMPLETE

**Agent**: Backend Architect (API Planning)
**Document**: Embedded in this status document (Section 5)
**Scope**: Middleware, validation, and endpoint updates for scope headers

**Key Deliverables**:
- ✅ ScopeValidationMiddleware implementation
- ✅ Database-level scope chain validators
- ✅ Authorization decorators (require_workspace_access, require_bom_access)
- ✅ Query filtering helpers for SQLAlchemy
- ✅ Comprehensive testing strategy (unit, integration, API tests)
- ✅ Monitoring and audit logging

**Estimated Time**: 4 weeks (phased rollout)
**Risk Level**: Medium (gradual rollout with feature flags)

---

### 3. Frontend Context Providers Plan ✅ COMPLETE

**Agent**: Frontend Architect (React Planning)
**Document**: Embedded in this status document (Section 6)
**Scope**: WorkspaceContext, ProjectContext, UI components, axios interceptors

**Key Deliverables**:
- ✅ WorkspaceContext and ProjectContext interfaces
- ✅ WorkspaceSelector and ProjectSelector components
- ✅ Axios interceptor updates for scope headers
- ✅ Breadcrumb navigation with scope context
- ✅ BOM upload flow with project requirement
- ✅ Error handling and state management

**Estimated Time**: 3 weeks (phased rollout)
**Risk Level**: Low (backward compatible, additive changes)

---

## Step-by-Step Execution Status

### Phase 1: Database Schema Migration (Week 1)

#### Step 1.1: Add control_plane_tenant_id to organizations ⏳ PENDING

**SQL File**: `001_phase1_add_control_plane_tenant_id.sql`
**Estimated Time**: <1 second
**Downtime**: None

**Pre-requisites**:
- [ ] Database backup completed
- [ ] Migration files reviewed and approved

**Execution**:
```bash
# Command to execute:
psql -h localhost -p 27432 -U postgres -d postgres \
  -f app-plane/supabase/migrations/001_phase1_add_control_plane_tenant_id.sql
```

**Validation**:
```sql
SELECT 'Phase 1.1 Complete' as status,
    COUNT(*) as total_orgs,
    COUNT(control_plane_tenant_id) as orgs_with_tenant_id
FROM organizations;
-- Expected: total_orgs=2, orgs_with_tenant_id=0 (column added, not yet populated)
```

**Rollback** (if needed):
```bash
psql -h localhost -p 27432 -U postgres -d postgres \
  -f app-plane/supabase/rollbacks/001_rollback_control_plane_tenant_id.sql
```

**Status**: ⏳ **PENDING**
**Completed By**: _____________
**Notes**: _____________

---

#### Step 1.2: Add workspace_id to projects ⏳ PENDING

**SQL File**: `002_phase1_add_workspace_id_to_projects.sql`
**Estimated Time**: <1 second
**Downtime**: None

**Execution**:
```bash
psql -h localhost -p 27432 -U postgres -d postgres \
  -f app-plane/supabase/migrations/002_phase1_add_workspace_id_to_projects.sql
```

**Validation**:
```sql
SELECT 'Phase 1.2 Complete' as status,
    COUNT(*) as total_projects,
    COUNT(organization_id) as projects_with_org,
    COUNT(workspace_id) as projects_with_workspace
FROM projects;
-- Expected: total_projects=1, projects_with_org=1, projects_with_workspace=0
```

**Status**: ⏳ **PENDING**
**Completed By**: _____________
**Notes**: _____________

---

#### Step 1.3: Verify BOMs schema ✅ INFORMATIONAL

**No changes needed** - boms.project_id column already exists (nullable)

**Validation**:
```sql
SELECT 'Phase 1.3 Verification' as status,
    COUNT(*) as total_boms,
    COUNT(project_id) as boms_with_project,
    COUNT(*) - COUNT(project_id) as boms_without_project
FROM boms;
-- Expected: total_boms=9, boms_with_project=0, boms_without_project=9
```

**Status**: ✅ **VERIFIED**
**Completed By**: Architecture Review
**Notes**: Column exists from previous migration

---

### Phase 2: Data Backfill (Week 1-2)

#### Step 2.1: Backfill control_plane_tenant_id ⏳ PENDING

**SQL File**: `003_phase2_backfill_control_plane_tenant_id.sql`
**Estimated Time**: <1 second
**Downtime**: None

**CRITICAL**: Manual mapping required!

**Pre-execution Checklist**:
- [ ] Obtain Control Plane tenant UUIDs
- [ ] Map each App Plane organization to Control Plane tenant
- [ ] Edit SQL file with actual UUIDs (replace placeholders)

**Mapping Table** (to be filled):
| App Plane Org Slug | App Plane Org ID | Control Plane Tenant ID (UUID) |
|--------------------|------------------|---------------------------------|
| ananta | _____________ | ________________________________ |
| platform-super-admin | _____________ | ________________________________ |

**Validation**:
```sql
SELECT 'Phase 2.1 Complete' as status,
    COUNT(*) as total_orgs,
    COUNT(control_plane_tenant_id) as orgs_with_tenant_id
FROM organizations;
-- Expected: total_orgs=2, orgs_with_tenant_id=2 (all mapped)
```

**Status**: ⏳ **PENDING**
**Blocked By**: Control Plane UUID mapping
**Completed By**: _____________
**Notes**: _____________

---

#### Step 2.2: Create default workspaces ⏳ PENDING

**SQL File**: `004_phase2_create_default_workspaces.sql`
**Estimated Time**: <1 second
**Downtime**: None

**Execution**:
```bash
psql -h localhost -p 27432 -U postgres -d postgres \
  -f app-plane/supabase/migrations/004_phase2_create_default_workspaces.sql
```

**Validation**:
```sql
SELECT 'Phase 2.2 Complete' as status,
    (SELECT COUNT(*) FROM organizations) as total_orgs,
    (SELECT COUNT(*) FROM workspaces) as total_workspaces,
    (SELECT COUNT(DISTINCT organization_id) FROM workspaces) as orgs_with_workspaces
FROM organizations LIMIT 1;
-- Expected: total_orgs=2, total_workspaces=2, orgs_with_workspaces=2
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 2.1 (tenant ID backfill)
**Completed By**: _____________
**Notes**: _____________

---

#### Step 2.3: Migrate projects to workspaces ⏳ PENDING

**SQL File**: `005_phase2_migrate_projects_to_workspaces.sql`

**Validation**:
```sql
SELECT p.name, w.name as workspace_name,
    CASE WHEN p.workspace_id IS NULL THEN 'MISSING WORKSPACE!' ELSE 'OK' END as status
FROM projects p
LEFT JOIN workspaces w ON p.workspace_id = w.id;
-- Expected: All projects have workspace_id populated, status='OK'
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 2.2 (workspaces created)
**Completed By**: _____________
**Notes**: _____________

---

#### Step 2.4: Create default projects ⏳ PENDING

**SQL File**: `006_phase2_create_default_projects.sql`

**Validation**:
```sql
SELECT 'Phase 2.4 Complete' as status,
    (SELECT COUNT(*) FROM workspaces) as total_workspaces,
    (SELECT COUNT(*) FROM projects) as total_projects,
    (SELECT COUNT(DISTINCT workspace_id) FROM projects) as workspaces_with_projects
FROM workspaces LIMIT 1;
-- Expected: total_workspaces=2, total_projects=3, workspaces_with_projects=2
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 2.3
**Completed By**: _____________
**Notes**: _____________

---

#### Step 2.5: Assign BOMs to projects ⏳ PENDING

**SQL File**: `007_phase2_assign_boms_to_projects.sql`

**Validation**:
```sql
SELECT 'Phase 2.5 Complete' as status,
    COUNT(*) as total_boms,
    COUNT(project_id) as boms_with_project,
    COUNT(*) - COUNT(project_id) as boms_missing_project
FROM boms;
-- Expected: total_boms=9, boms_with_project=9, boms_missing_project=0
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 2.4
**Completed By**: _____________
**Notes**: _____________

---

### Phase 3: Schema Enforcement (Week 2)

#### Step 3.1: Enforce project_id NOT NULL ⏳ PENDING

**SQL File**: `008_phase3_enforce_project_id_not_null.sql`
**Estimated Downtime**: <100ms (brief table lock)

**Validation**:
```sql
SELECT 'Phase 3.1 Complete' as status,
    COUNT(*) as total_boms,
    COUNT(project_id) as boms_with_project_not_null
FROM boms;
-- Expected: Both values equal
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 2.5 (all BOMs assigned)
**Completed By**: _____________
**Notes**: _____________

---

#### Step 3.2: Add BOM uniqueness constraint ⏳ PENDING

**SQL File**: `009_phase3_add_bom_uniqueness_constraint.sql`

**Pre-check** (must return 0 rows):
```sql
SELECT project_id, name, version, COUNT(*) as duplicate_count
FROM boms
GROUP BY project_id, name, version
HAVING COUNT(*) > 1;
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 3.1
**Completed By**: _____________
**Notes**: _____________

---

#### Step 3.3: Create organization_id auto-populate trigger ⏳ PENDING

**SQL File**: `010_phase3_create_organization_id_trigger.sql`

**Validation**:
```sql
SELECT 'Phase 3.3 Complete' as status,
    COUNT(*) as total_boms,
    COUNT(DISTINCT organization_id) as unique_orgs,
    COUNT(CASE WHEN organization_id IS NULL THEN 1 END) as boms_missing_org_id
FROM boms;
-- Expected: boms_missing_org_id=0
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 3.2
**Completed By**: _____________
**Notes**: _____________

---

#### Step 3.4: Enforce control_plane_tenant_id NOT NULL ⏳ PENDING

**SQL File**: `012_phase3_enforce_control_plane_tenant_id_not_null.sql`

**Validation**:
```sql
SELECT 'Phase 3.5 Complete' as status,
    COUNT(*) as total_orgs,
    COUNT(control_plane_tenant_id) as orgs_with_tenant_id,
    COUNT(DISTINCT control_plane_tenant_id) as unique_tenant_ids
FROM organizations;
-- Expected: All counts equal
```

**Status**: ⏳ **PENDING**
**Depends On**: Step 3.3
**Completed By**: _____________
**Notes**: _____________

---

### Backend Implementation (Week 2-5)

#### Step 4.1: Create scope validation middleware ⏳ PENDING

**Files to Create**:
- `app/middleware/scope_validator.py` (NEW - 500+ lines)
- `app/core/scope_validators.py` (NEW - 300+ lines)
- `app/core/scope_filters.py` (NEW - 100+ lines)

**Testing**:
- [ ] Unit tests for ScopeValidationMiddleware
- [ ] Unit tests for validate_scope_consistency
- [ ] Unit tests for is_scope_required

**Status**: ⏳ **PENDING**
**Estimated Effort**: 2 days
**Completed By**: _____________
**Notes**: _____________

---

#### Step 4.2: Update auth middleware for scope extraction ⏳ PENDING

**File to Modify**: `app/middleware/auth_middleware.py`

**Changes**:
- Add `PROJECT_ID_HEADER` constant
- Add `extract_scope_headers()` function
- Enhance `build_auth_context_from_token()` to extract workspace/project claims

**Testing**:
- [ ] JWT with workspace/project claims parsed correctly
- [ ] Headers extracted and stored in request.state

**Status**: ⏳ **PENDING**
**Estimated Effort**: 4 hours
**Completed By**: _____________
**Notes**: _____________

---

#### Step 4.3: Add authorization decorators ⏳ PENDING

**File to Modify**: `app/core/authorization.py`

**Decorators to Add**:
- `@require_workspace_access(optional_project=False)`
- `@require_bom_access()`

**Testing**:
- [ ] Decorator blocks requests without workspace header
- [ ] Decorator validates scope chain
- [ ] Staff users can cross-scope access

**Status**: ⏳ **PENDING**
**Estimated Effort**: 1 day
**Completed By**: _____________
**Notes**: _____________

---

#### Step 4.4: Update BOM endpoints with scope validation ⏳ PENDING

**File to Modify**: `app/api/boms_unified.py`

**Endpoints to Update**:
- `GET /api/boms` - Add @require_workspace_access()
- `POST /api/boms/upload` - Add @require_workspace_access(optional_project=False)
- `GET /api/boms/{bom_id}` - Add @require_bom_access()

**Testing**:
- [ ] BOM list filtered by workspace
- [ ] BOM upload requires project header
- [ ] BOM detail validates full scope chain

**Status**: ⏳ **PENDING**
**Estimated Effort**: 2 days
**Completed By**: _____________
**Notes**: _____________

---

#### Step 4.5: Enable scope validation feature flag ⏳ PENDING

**Environment Variable**:
```bash
# CNS Service .env
ENFORCE_WORKSPACE_HEADERS=true
ENFORCE_PROJECT_HEADERS=true
ENFORCE_SCOPE_MATCHING=false  # Start with warning mode
```

**Rollout Plan**:
1. Week 1: `ENFORCE_SCOPE_MATCHING=false` (log warnings only)
2. Week 2: Monitor logs, fix mismatches
3. Week 3: `ENFORCE_SCOPE_MATCHING=true` (reject mismatches)

**Status**: ⏳ **PENDING**
**Depends On**: Steps 4.1-4.4
**Completed By**: _____________
**Notes**: _____________

---

### Frontend Implementation (Week 3-5)

#### Step 5.1: Create WorkspaceContext ⏳ PENDING

**File to Create**: `src/contexts/WorkspaceContext.tsx` (600+ lines)

**Key Features**:
- Loads workspaces from platform API
- Auto-selects single workspace or restores from localStorage
- Provides workspace management CRUD operations

**Testing**:
- [ ] Workspaces load on tenant selection
- [ ] Workspace persists across page refreshes
- [ ] Error states handled gracefully

**Status**: ⏳ **PENDING**
**Estimated Effort**: 1 day
**Completed By**: _____________
**Notes**: _____________

---

#### Step 5.2: Create ProjectContext ⏳ PENDING

**File to Create**: `src/contexts/ProjectContext.tsx` (500+ lines)

**Key Features**:
- Loads projects for current workspace
- Does NOT auto-select (requires explicit user action)
- Clears on workspace switch

**Testing**:
- [ ] Projects load on workspace selection
- [ ] Project selection persists
- [ ] Clears when workspace changes

**Status**: ⏳ **PENDING**
**Estimated Effort**: 1 day
**Completed By**: _____________
**Notes**: _____________

---

#### Step 5.3: Update axios interceptor ⏳ PENDING

**File to Modify**: `src/lib/axios.ts`

**Changes**:
- Add `X-Workspace-Id` header injection
- Add `X-Project-Id` header injection
- Add `assertWorkspaceContext()` helper
- Add `assertProjectContext()` helper

**Testing**:
- [ ] Headers automatically injected in all requests
- [ ] Assertions throw clear error messages

**Status**: ⏳ **PENDING**
**Estimated Effort**: 4 hours
**Completed By**: _____________
**Notes**: _____________

---

#### Step 5.4: Create UI components ⏳ PENDING

**Files to Create**:
- `src/components/workspace/WorkspaceSelector.tsx`
- `src/components/project/ProjectSelector.tsx`
- `src/components/layout/Breadcrumbs.tsx`

**Testing**:
- [ ] Components render in Storybook
- [ ] Workspace selector shows all workspaces
- [ ] Project selector filters by workspace
- [ ] Breadcrumbs show scope context

**Status**: ⏳ **PENDING**
**Estimated Effort**: 2 days
**Completed By**: _____________
**Notes**: _____________

---

#### Step 5.5: Update BOM upload page ⏳ PENDING

**File to Modify**: `src/pages/boms/BomUpload.tsx`

**Changes**:
- Add project selection requirement
- Show ProjectSelector component
- Block upload if no project selected
- Show helpful error message

**Testing**:
- [ ] Upload blocked without project
- [ ] Upload succeeds with project
- [ ] Error message guides user

**Status**: ⏳ **PENDING**
**Estimated Effort**: 4 hours
**Completed By**: _____________
**Notes**: _____________

---

#### Step 5.6: Nest providers in App.tsx ⏳ PENDING

**File to Modify**: `src/App.tsx`

**Changes**:
- Import WorkspaceProvider and ProjectProvider
- Nest inside TenantProvider
- Update provider hierarchy

**Testing**:
- [ ] Login flow works end-to-end
- [ ] Workspaces load after tenant selection
- [ ] Projects load after workspace selection
- [ ] BOM upload includes all scope headers

**Status**: ⏳ **PENDING**
**Estimated Effort**: 2 hours
**Completed By**: _____________
**Notes**: _____________

---

### Integration & Testing (Week 6)

#### Step 6.1: End-to-end testing ⏳ PENDING

**Test Scenarios**:
- [ ] User login → workspace load → project selection → BOM upload
- [ ] Staff cross-workspace navigation
- [ ] Scope mismatch error handling
- [ ] Token refresh with scope preservation
- [ ] Workspace switch clears project selection

**Status**: ⏳ **PENDING**
**Estimated Effort**: 3 days
**Completed By**: _____________
**Notes**: _____________

---

#### Step 6.2: Load testing ⏳ PENDING

**Test Configuration**:
- 1000 concurrent users
- 10 tenants, 5 workspaces each, 10 projects each
- Mix of BOM list, upload, detail operations

**Success Criteria**:
- [ ] P95 latency < 200ms (BOM list)
- [ ] P95 latency < 1000ms (BOM upload)
- [ ] Error rate < 0.1%
- [ ] No scope validation errors

**Status**: ⏳ **PENDING**
**Estimated Effort**: 2 days
**Completed By**: _____________
**Notes**: _____________

---

#### Step 6.3: Production cutover ⏳ PENDING

**Cutover Checklist**:
- [ ] Database migration completed successfully
- [ ] All tests passing (unit, integration, E2E)
- [ ] Load testing completed
- [ ] Rollback procedures tested
- [ ] Monitoring dashboards configured
- [ ] Team trained on new scope model
- [ ] Documentation updated

**Go/No-Go Decision**: _____________
**Cutover Date**: _____________
**Completed By**: _____________

---

## Risk Mitigation Status

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Duplicate BOMs break uniqueness constraint | HIGH | Pre-check query in Step 3.2 | ⏳ PENDING |
| Control Plane tenant mapping incorrect | HIGH | Manual verification in Step 2.1 | ⏳ PENDING |
| NULL project_id after backfill | HIGH | Pre-check in Step 3.1 | ⏳ PENDING |
| Scope header-claim mismatch | MEDIUM | Feature flag gradual rollout | ⏳ PENDING |
| Frontend breaks existing flows | MEDIUM | Backward compatibility mode | ⏳ PENDING |

---

## Success Metrics

### Database Migration Success

- ✅ All 12 migration scripts executed without errors
- ✅ All validation queries return expected results
- ✅ Zero data loss
- ✅ Rollback tested successfully

**Current Status**: 0/12 migrations completed

---

### Backend Implementation Success

- ✅ All unit tests passing (target: 90%+ coverage)
- ✅ All integration tests passing
- ✅ Zero 403 errors for valid requests
- ✅ Scope mismatch alerts = 0
- ✅ P95 latency < 200ms

**Current Status**: 0/5 backend steps completed

---

### Frontend Implementation Success

- ✅ All UI components render correctly
- ✅ Login → BOM upload flow works end-to-end
- ✅ Workspace/project selection persists
- ✅ Scope headers automatically injected
- ✅ Error messages helpful and actionable

**Current Status**: 0/6 frontend steps completed

---

## Rollback Procedures

### Emergency Rollback (< 5 minutes)

```bash
# 1. Disable scope validation
docker exec app-plane-cns-service sh -c \
  'export ENFORCE_WORKSPACE_HEADERS=false && \
   export ENFORCE_PROJECT_HEADERS=false && \
   supervisorctl restart cns-service'

# 2. Disable frontend scope UI (if needed)
docker exec arc-saas-customer-portal sh -c \
  'export VITE_ENABLE_WORKSPACE_SCOPING=false && \
   npm run build && supervisorctl restart customer-portal'
```

### Full Database Rollback (< 1 minute)

Execute rollback scripts in reverse order (Phase 3 → 2 → 1):
```bash
psql -h localhost -p 27432 -U postgres -d postgres \
  -f app-plane/supabase/rollbacks/012_rollback_phase3.sql
psql -h localhost -p 27432 -U postgres -d postgres \
  -f app-plane/supabase/rollbacks/007_rollback_phase2.sql
psql -h localhost -p 27432 -U postgres -d postgres \
  -f app-plane/supabase/rollbacks/002_rollback_phase1.sql
```

---

## Next Steps

### Immediate Actions (This Week)

1. ✅ Review and approve all three implementation plans
2. ⏳ Create database migration SQL files
3. ⏳ Obtain Control Plane tenant UUIDs for mapping
4. ⏳ Schedule database backup
5. ⏳ Execute Phase 1 migrations (schema addition)

### Short-term Actions (Next 2 Weeks)

6. ⏳ Execute Phase 2 migrations (data backfill)
7. ⏳ Execute Phase 3 migrations (schema enforcement)
8. ⏳ Implement backend scope validation middleware
9. ⏳ Update CNS API endpoints with decorators
10. ⏳ Write and execute backend tests

### Medium-term Actions (Weeks 3-5)

11. ⏳ Implement frontend WorkspaceContext and ProjectContext
12. ⏳ Create UI components (selectors, breadcrumbs)
13. ⏳ Update axios interceptors
14. ⏳ Update BOM upload page
15. ⏳ Execute frontend integration tests

### Long-term Actions (Week 6+)

16. ⏳ End-to-end testing
17. ⏳ Load testing
18. ⏳ Production cutover
19. ⏳ Post-cutover monitoring
20. ⏳ Documentation finalization

---

## Team Assignments

| Role | Assignee | Responsibilities |
|------|----------|------------------|
| **Database Lead** | __________ | Execute migrations, validate schema, rollback procedures |
| **Backend Lead** | __________ | Implement middleware, decorators, endpoint updates |
| **Frontend Lead** | __________ | Implement contexts, components, axios updates |
| **QA Lead** | __________ | Write tests, execute test plans, validate success metrics |
| **DevOps Lead** | __________ | Monitoring setup, rollback procedures, production cutover |
| **Tech Lead** | __________ | Overall coordination, go/no-go decisions, risk management |

---

## Change Log

| Date | Author | Change | Status |
|------|--------|--------|--------|
| 2025-12-14 | Architecture Team | Initial planning complete | ✅ COMPLETE |
| __________ | __________ | Phase 1 migrations executed | ⏳ PENDING |
| __________ | __________ | Phase 2 backfill completed | ⏳ PENDING |
| __________ | __________ | Phase 3 enforcement completed | ⏳ PENDING |
| __________ | __________ | Backend implementation complete | ⏳ PENDING |
| __________ | __________ | Frontend implementation complete | ⏳ PENDING |
| __________ | __________ | Production cutover successful | ⏳ PENDING |

---

## References

- **Main Specification**: [CNS-PROJECTS-ALIGNMENT-SPEC.md](./CNS-PROJECTS-ALIGNMENT-SPEC.md)
- **Auth Specification**: [CNS-AUTH-TENANT-SPEC.md](./CNS-AUTH-TENANT-SPEC.md)
- **Database Plan**: Agent output embedded in Section 4 below
- **Backend Plan**: Agent output embedded in Section 5 below
- **Frontend Plan**: Agent output embedded in Section 6 below

---

## Appendices

### Appendix A: Key Decisions Made

1. **Workspace Hierarchy**: Projects link to workspaces (not directly to organizations)
2. **Backward Compatibility**: Keep `organization_id` on projects during transition
3. **Tenant ID Source**: Use Control Plane UUID (not App Plane organization ID)
4. **Subscription Scope**: Tenant-wide (not project-level)
5. **Auto-Selection**: Workspaces auto-select, projects require explicit selection
6. **Feature Flags**: Gradual rollout with warning mode before enforcement

### Appendix B: Common Commands

```bash
# Check migration status
psql -h localhost -p 27432 -U postgres -d postgres -c "
SELECT tablename, column_name
FROM information_schema.columns
WHERE table_name IN ('organizations', 'workspaces', 'projects', 'boms')
ORDER BY tablename, ordinal_position;"

# Check data counts
psql -h localhost -p 27432 -U postgres -d postgres -c "
SELECT 'Organizations' as entity, COUNT(*) FROM organizations
UNION ALL SELECT 'Workspaces', COUNT(*) FROM workspaces
UNION ALL SELECT 'Projects', COUNT(*) FROM projects
UNION ALL SELECT 'BOMs', COUNT(*) FROM boms;"

# Check CNS service logs
docker logs app-plane-cns-service --tail 100 | grep -i "scope"

# Restart CNS service
docker restart app-plane-cns-service
```

---

**Document Status**: Living Document - Update after each step completion
**Last Review**: 2025-12-14
**Next Review**: After Phase 1 completion
