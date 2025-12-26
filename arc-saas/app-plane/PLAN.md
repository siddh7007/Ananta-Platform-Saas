# Arc-SaaS App Plane - Tenancy Model Implementation Plan

## Current Status

### What's Working
- **Supabase App Plane** deployed with MASTER_MIGRATION_V4_KEYCLOAK.sql
- **34 tables** with Row Level Security (RLS) enabled
- **Keycloak JWT integration** via `auth.tenant_id()` function
- **Pooled tenancy model** - all tenants share one Supabase instance with RLS isolation

### Issues Fixed (2024-12-08)
- **FIXED**: Updated `normalizeToDeploymentTier()` in `temporal-provisioning.service.ts`
- **FIXED**: Premium tier now correctly maps to `pooled` (was incorrectly `silo`)
- Only **Enterprise** tier uses Silo model

---

## Tenancy Model Strategy

### Current Configuration (CORRECTED)

| Plan ID | Plan Name | Price | Tenancy Model | Infrastructure |
|---------|-----------|-------|---------------|----------------|
| `plan-free` | Free | $0/mo | Pooled | Shared Supabase + RLS |
| `plan-basic` | Basic | $29/mo | Pooled | Shared Supabase + RLS |
| `plan-standard` | Standard | $79/mo | Pooled | Shared Supabase + RLS |
| `plan-premium` | Premium | $199/mo | Pooled | Shared Supabase + RLS |
| `plan-enterprise` | Enterprise | Custom | Silo | Dedicated PostgreSQL |

### Why This Approach?
1. **Cost Efficiency**: Pooled model for 90%+ of tenants reduces infrastructure costs
2. **Operational Simplicity**: Single Supabase instance to manage for most tenants
3. **Enterprise Compliance**: Silo model satisfies enterprise security/compliance requirements
4. **Scalability**: Add more pooled Supabase instances if needed (pool sharding)

---

## Implementation Tasks

### Phase 1: Fix Plan Configuration (Priority: HIGH) - COMPLETED

**Goal**: All plans except Enterprise should use Pooled model

#### Completed Tasks:
1. [x] Updated `normalizeToDeploymentTier()` in `temporal-provisioning.service.ts`
   - Changed `premium: 'silo'` to `premium: 'pooled'`
   - Added explicit mappings for all plan tiers
   - Added clear comments explaining the mapping

2. [x] Updated `planTierToInfraTier()` in `common.types.ts`
   - Updated `PlanTier` type to include all tiers (FREE, BASIC, STANDARD, PREMIUM, ENTERPRISE)
   - Only ENTERPRISE returns 'silo', all others return 'pooled'

#### Files Modified:
- `services/tenant-management-service/src/services/temporal-provisioning.service.ts:40-52`
- `services/temporal-worker-service/src/types/common.types.ts:7-35`

---

### Phase 2: Pooled Model Enhancements (Priority: MEDIUM)

**Goal**: Optimize the pooled Supabase experience

#### Tasks:
1. [ ] Verify all RLS policies use `auth.tenant_id()` correctly
2. [ ] Add tenant usage monitoring/quotas
3. [ ] Implement connection pooling limits per tenant
4. [ ] Add tenant-specific rate limiting in Kong

---

### Phase 3: Silo Model Implementation (Priority: LOW - Future)

**Goal**: Support dedicated PostgreSQL for Enterprise tenants

#### Effort Analysis

| Component | Effort | Notes |
|-----------|--------|-------|
| Schema Deployment | Low | Reuse same migration, optionally strip RLS |
| Connection Management | Medium | Store per-tenant connection strings |
| Provisioning Workflow | Medium | Automate database creation |
| Keycloak Integration | Low | Same JWT, different database |
| Monitoring | Medium | Per-tenant metrics |
| Backup/Recovery | High | Individual backup schedules |

#### Architecture Options

**Option A: Plain PostgreSQL (Recommended for Silo)**
- Pros: Lower cost, simpler, no Supabase overhead
- Cons: No PostgREST API, need direct DB access or custom API

**Option B: Dedicated Supabase per Tenant**
- Pros: Consistent API across pooled/silo
- Cons: Higher cost, more resources per tenant

**Recommendation**: Use **Option A** (Plain PostgreSQL) for silo tenants with:
- Same schema as Supabase (MASTER_MIGRATION_V4_KEYCLOAK.sql)
- RLS can be removed (single tenant = physical isolation)
- Connect via standard PostgreSQL client from app services

#### Tasks:
1. [ ] Create `silo-provisioning` Temporal workflow
2. [ ] Implement PostgreSQL database creation activity
3. [ ] Apply schema migration to new database
4. [ ] Store connection string in Control Plane (encrypted)
5. [ ] Route tenant requests to correct database
6. [ ] Implement tenant database backup strategy
7. [ ] Add monitoring for silo databases

---

## Database Connection Routing

### Pooled Tenants
```
Request → Kong → PostgREST → Shared Supabase (RLS by tenant_id)
```

### Silo Tenants
```
Request → App Service → Lookup Connection → Dedicated PostgreSQL
```

### Implementation Approach
1. Store `database_connection_string` in `tenants` table (encrypted)
2. For pooled: Use shared Supabase URL
3. For silo: Use dedicated PostgreSQL connection
4. App services check tenant tier and route accordingly

---

## Migration Path for Existing Tenants

### Pooled → Silo Upgrade
1. Create dedicated PostgreSQL database
2. Apply schema migration
3. Export tenant data from pooled Supabase (filter by organization_id)
4. Import data into dedicated database
5. Update tenant connection string in Control Plane
6. Verify routing works correctly
7. Remove tenant data from pooled database

---

## Security Considerations

### Pooled Model
- RLS policies MUST be enforced on ALL tables
- JWT claims MUST be validated
- Tenant ID cannot be spoofed (extracted from signed JWT)

### Silo Model
- Database credentials stored encrypted
- Network isolation (private VPC/subnet)
- Individual database users per tenant
- Regular security audits

---

## Monitoring & Observability

### Pooled Metrics
- Queries per tenant
- Storage usage per tenant (via `organization_id`)
- Connection count per tenant

### Silo Metrics
- Database health per tenant
- Storage/CPU/Memory per database
- Backup status

---

## Cost Estimates

### Pooled (Shared Supabase)
- Base: ~$25/month for Supabase Pro
- Scales with total usage across all tenants
- Very cost-effective for many small tenants

### Silo (Dedicated PostgreSQL)
- Per-tenant: ~$15-50/month depending on size
- Only viable for Enterprise tier pricing ($199/mo+)
- Consider managed PostgreSQL (AWS RDS, etc.)

---

## Next Steps

1. ~~**Immediate**: Fix Starter/Pro plans to use Pooled model~~ **DONE (2024-12-08)**
2. **Short-term**: Verify RLS policies work correctly with Keycloak JWT
3. **Short-term**: Rebuild tenant-management-service to apply changes
4. **Medium-term**: Add usage monitoring for pooled tenants
5. **Long-term**: Implement silo provisioning for Enterprise tier

---

## References

- [MASTER_MIGRATION_V4_KEYCLOAK.sql](./supabase/migrations/MASTER_MIGRATION_V4_KEYCLOAK.sql) - Main schema
- [001_keycloak_jwt_auth_functions.sql](./supabase/migrations/001_keycloak_jwt_auth_functions.sql) - Auth functions
- [docker-compose.supabase.yml](./docker-compose.supabase.yml) - Supabase deployment
