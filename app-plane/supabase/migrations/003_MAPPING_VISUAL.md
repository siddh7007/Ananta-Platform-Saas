# Control Plane Tenant UUID Mapping - Visual Reference

**Date:** 2025-12-14
**Migration:** 003_phase2_backfill_control_plane_tenant_id.sql
**Status:** ✅ EXECUTED

---

## Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APP PLANE (Supabase)                            │
│  Container: app-plane-supabase-db                                       │
│  Database: postgres                                                     │
│  Schema: public                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Table: organizations                                                   │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ id (PK)                                    UUID              │       │
│  │ name                                       VARCHAR           │       │
│  │ slug                                       VARCHAR           │       │
│  │ subscription_status                        VARCHAR           │       │
│  │ control_plane_tenant_id (FK → tenants.id)  UUID NULL        │       │
│  │ created_at                                 TIMESTAMP         │       │
│  └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Phase 2 Step 2.1
                                    │ Mapping Backfill
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONTROL PLANE (PostgreSQL)                         │
│  Container: arc-saas-postgres                                           │
│  Database: arc_saas                                                     │
│  Schema: main                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Table: main.tenants                                                    │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ id (PK)                                    UUID              │       │
│  │ name                                       VARCHAR           │       │
│  │ key                                        VARCHAR(10)       │       │
│  │ status                                     INTEGER           │       │
│  │ created_on                                 TIMESTAMP         │       │
│  └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Mapping 1: Ananta Platform → Ananta

```
APP PLANE ORGANIZATION
┌────────────────────────────────────────────────────────────────┐
│ ID:     a1111111-1111-1111-1111-111111111111                   │
│ Name:   Ananta Platform                                        │
│ Slug:   ananta                                                 │
│ Status: active                                                 │
└────────────────────────────────────────────────────────────────┘
                        │
                        │ slug/key exact match
                        │ (ananta == ananta)
                        ↓
CONTROL PLANE TENANT
┌────────────────────────────────────────────────────────────────┐
│ ID:     468224c2-82a0-6286-57e7-eff8da9982f2                   │
│ Name:   Ananta                                                 │
│ Key:    ananta                                                 │
│ Status: 1 (active)                                             │
└────────────────────────────────────────────────────────────────┘

RESULT:
organizations.control_plane_tenant_id = '468224c2-82a0-6286-57e7-eff8da9982f2'
```

---

## Mapping 2: Platform Super Admin → Platform Super Admin

```
APP PLANE ORGANIZATION
┌────────────────────────────────────────────────────────────────┐
│ ID:     a0000000-0000-0000-0000-000000000000                   │
│ Name:   Platform Super Admin                                   │
│ Slug:   platform-super-admin                                   │
│ Status: active                                                 │
└────────────────────────────────────────────────────────────────┘
                        │
                        │ UUID identity match
                        │ (same UUID in both systems - special case)
                        ↓
CONTROL PLANE TENANT
┌────────────────────────────────────────────────────────────────┐
│ ID:     a0000000-0000-0000-0000-000000000000                   │
│ Name:   Platform Super Admin                                   │
│ Key:    platform                                               │
│ Status: 0 (inactive)                                           │
└────────────────────────────────────────────────────────────────┘

RESULT:
organizations.control_plane_tenant_id = 'a0000000-0000-0000-0000-000000000000'
```

---

## Migration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Create Temporary Mapping Table                         │
├─────────────────────────────────────────────────────────────────┤
│ CREATE TEMP TABLE temp_tenant_mapping (                        │
│     app_org_id UUID,                                            │
│     app_org_name TEXT,                                          │
│     control_plane_tenant_id UUID,                               │
│     control_plane_tenant_name TEXT,                             │
│     mapping_method TEXT,                                        │
│     verified BOOLEAN                                            │
│ );                                                              │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Insert Discovered Mappings                             │
├─────────────────────────────────────────────────────────────────┤
│ INSERT INTO temp_tenant_mapping VALUES                         │
│   ('a1111111...', 'Ananta Platform',                            │
│    '468224c2...', 'Ananta', 'slug_key_match', TRUE),            │
│   ('a0000000...', 'Platform Super Admin',                       │
│    'a0000000...', 'Platform Super Admin', 'uuid_match', TRUE);  │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Validation Checks                                      │
├─────────────────────────────────────────────────────────────────┤
│ ✓ All active organizations have mappings                       │
│ ✓ No duplicate mappings (1:1 relationship)                     │
│ ✓ All mappings verified = TRUE                                 │
│ ✓ UUID format valid for all tenant IDs                         │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Backfill Organizations Table                           │
├─────────────────────────────────────────────────────────────────┤
│ UPDATE organizations o                                          │
│ SET control_plane_tenant_id = tm.control_plane_tenant_id        │
│ FROM temp_tenant_mapping tm                                     │
│ WHERE o.id = tm.app_org_id                                      │
│ AND o.control_plane_tenant_id IS NULL;                          │
│                                                                 │
│ Result: 2 rows updated                                          │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Post-Migration Validation                              │
├─────────────────────────────────────────────────────────────────┤
│ ✓ All active organizations have control_plane_tenant_id        │
│ ✓ Total organizations mapped: 2 / 2                            │
│ ✓ All UUIDs valid format                                       │
│ ✓ Cross-database validation successful                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Matching Strategy (Automated Discovery)

The helper script `generate-tenant-mapping.py` uses a scoring system:

```
┌──────────────────────────────────────────────────────────┐
│ MATCH TYPE              │ SCORE │ AUTO-VERIFY │ EXAMPLE  │
├──────────────────────────────────────────────────────────┤
│ UUID Identity Match     │  100  │     ✓       │ Platform │
│ Exact Slug/Key Match    │   90  │     ✓       │ Ananta   │
│ Case-Insensitive Name   │   70  │     ✗       │ -        │
│ Name Contains Match     │   50  │     ✗       │ -        │
│ + Created within 24hrs  │  +30  │     -       │ -        │
│ + Created within 7 days │  +10  │     -       │ -        │
└──────────────────────────────────────────────────────────┘

Auto-verify: Only matches with score ≥ 90 are automatically verified.
Manual review required for scores < 90.
```

### Our Mappings Scored:

**Mapping 1 (Ananta Platform → Ananta):**
- Slug/Key exact match: 90 points
- Auto-verified: YES
- Method: slug_key_match

**Mapping 2 (Platform Super Admin → Platform Super Admin):**
- UUID identity match: 100 points
- Auto-verified: YES
- Method: uuid_match

---

## Future Organization Handling

When new organizations are created in App Plane:

```
┌────────────────────────────────────────────────────────────┐
│ NEW APP PLANE ORGANIZATION CREATED                         │
└────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────┐
│ Run Helper Script                                          │
│ python generate-tenant-mapping.py                          │
└────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────┐
│ Script queries both databases and suggests mappings        │
│ - Outputs SQL INSERT statements                            │
│ - Includes similarity score and auto-verify flag           │
└────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────┐
│ Manual Review                                              │
│ - Verify suggested mappings are correct                    │
│ - Set verified=TRUE after review                           │
└────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────┐
│ Update Migration 003                                       │
│ - Add new mappings to STEP 2 INSERT statement              │
│ - Re-run migration (with rollback if needed)               │
└────────────────────────────────────────────────────────────┘
```

---

## Data Lineage

```
BEFORE MIGRATION:
┌──────────────────────────┐
│ App Plane Organizations  │
│ control_plane_tenant_id: │
│   - NULL                 │
│   - NULL                 │
└──────────────────────────┘

AFTER MIGRATION 003:
┌──────────────────────────┐      ┌────────────────────────┐
│ App Plane Organizations  │ ───▶ │ Control Plane Tenants  │
│ control_plane_tenant_id: │  FK  │ id:                    │
│   - 468224c2...          │ ───▶ │   - 468224c2...        │
│   - a0000000...          │ ───▶ │   - a0000000...        │
└──────────────────────────┘      └────────────────────────┘

AFTER MIGRATION 004 (Next):
┌──────────────────────────┐      ┌────────────────────────┐
│ Workspaces               │      │ Organizations          │
│ organization_id:         │ ◀─── │ id:                    │
│   - a1111111...          │  FK  │   - a1111111...        │
│   - a0000000...          │      │   - a0000000...        │
└──────────────────────────┘      └────────────────────────┘
        ↓ 1:N                              ↓ FK
┌──────────────────────────┐               │
│ Projects                 │               │
│ workspace_id:            │               │
│   - <default_ws_1>       │               │
│   - <default_ws_2>       │               │
│ organization_id: ────────────────────────┘
└──────────────────────────┘
```

---

## Cross-Reference Table

Quick lookup for mapping between systems:

| App Plane Org UUID | App Org Name | App Slug | Control Plane Tenant UUID | Tenant Name | Tenant Key | Match Method |
|-------------------|--------------|----------|--------------------------|-------------|------------|--------------|
| `a1111111-1111-1111-1111-111111111111` | Ananta Platform | ananta | `468224c2-82a0-6286-57e7-eff8da9982f2` | Ananta | ananta | slug_key_match |
| `a0000000-0000-0000-0000-000000000000` | Platform Super Admin | platform-super-admin | `a0000000-0000-0000-0000-000000000000` | Platform Super Admin | platform | uuid_match |

---

## Files Reference

| File | Purpose | Location |
|------|---------|----------|
| Migration SQL | Backfill organizations.control_plane_tenant_id | `003_phase2_backfill_control_plane_tenant_id.sql` |
| Execution Guide | Step-by-step instructions | `003_EXECUTION_GUIDE.md` |
| Blocker Resolved | Summary of completion | `003_BLOCKER_RESOLVED.md` |
| This File | Visual reference | `003_MAPPING_VISUAL.md` |
| Helper Script | Auto-discovery for future orgs | `../scripts/generate-tenant-mapping.py` |
| Migration Index | Phase 1-3 overview | `PHASE_1_2_3_MIGRATION_INDEX.md` |

---

**Last Updated:** 2025-12-14
**Status:** ✅ BLOCKER RESOLVED - Phase 2 can proceed
