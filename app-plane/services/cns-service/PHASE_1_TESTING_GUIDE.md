# Phase 1 Testing Guide - Scoped BOM Upload

**Date:** 2025-12-14
**Status:** Ready for Testing
**Prerequisites:** CNS service restarted with simplified config

---

## Verification Complete ✅

### Configuration Verification
- ✅ Feature flag: `ENABLE_PROJECT_SCOPE_VALIDATION=True` (enabled by default)
- ✅ CNS service restarted successfully
- ✅ Both endpoints available in OpenAPI schema
- ✅ No deprecation markers on either endpoint

### Available Endpoints

| Endpoint | Type | Auth | Status |
|----------|------|------|--------|
| `POST /api/boms/projects/{project_id}/boms/upload` | Scoped (new) | JWT + `@require_project` | ✅ Active |
| `POST /api/boms/upload` | Legacy | JWT + `@require_role` | ✅ Active |

---

## Test Scenarios

### Scenario 1: Test New Scoped Endpoint (Primary)

**Endpoint:** `POST /api/boms/projects/{project_id}/boms/upload`

**Prerequisites:**
1. Valid JWT token from Keycloak
2. Valid project_id (from database)
3. Valid organization_id that owns the project
4. Sample CSV file

**Test Steps:**

```bash
# 1. Get a valid JWT token (from browser DevTools or Keycloak)
TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlFlUHVIUm5KZlRYTVV4eFZVSjZHQjgyV2lBNGtOZi1WZlhTeS0xd04tWlUifQ..."

# 2. Get project_id from database
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT p.id, p.name, w.organization_id, o.name as org_name
FROM projects p
JOIN workspaces w ON p.workspace_id = w.id
JOIN organizations o ON w.organization_id = o.id
LIMIT 5;"

# Example output:
#                  id                  |      name       |            organization_id            |     org_name
# -------------------------------------+-----------------+---------------------------------------+------------------
# 550e8400-e29b-41d4-a716-446655440000 | Default Project | a1111111-1111-1111-1111-111111111111 | Ananta Platform

# 3. Upload BOM using scoped endpoint
curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_bom.csv" \
  -F "bom_name=Test BOM - Scoped" \
  -F "priority=normal" \
  -F "source=customer" \
  -F "start_enrichment=true"
```

**Expected Result:**
```json
{
  "bom_id": "uuid-here",
  "organization_id": "a1111111-1111-1111-1111-111111111111",
  "component_count": 10,
  "raw_file_s3_key": "raw/a1111111.../uuid_timestamp_sample_bom.csv",
  "parsed_file_s3_key": "parsed/a1111111.../uuid.json",
  "enrichment_started": true,
  "workflow_id": "bom-enrichment-uuid",
  "status": "pending",
  "priority": "normal"
}
```

**Validation:**
```bash
# Check logs for [OK] markers
docker logs app-plane-cns-service --tail 50 | grep -E "\[OK\]|scoped"

# Expected log entries:
# [boms_unified] Scoped upload started by user=... to project=... (org=..., workspace=...)
# [boms_unified] Project {project_id} validated for organization {organization_id}
# [boms_unified] [OK] Created Supabase BOM {bom_id} with X line items (scoped)
# [boms_unified] Completed scoped upload: bom_id=... tenant=... project=... rows=...
```

---

### Scenario 2: Test Legacy Endpoint (Backward Compatibility)

**Endpoint:** `POST /api/boms/upload`

**Test Steps:**

```bash
# Upload BOM using legacy endpoint (client supplies organization_id)
curl -X POST "http://localhost:27200/api/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_bom.csv" \
  -F "organization_id=a1111111-1111-1111-1111-111111111111" \
  -F "project_id=550e8400-e29b-41d4-a716-446655440000" \
  -F "bom_name=Test BOM - Legacy" \
  -F "priority=normal" \
  -F "source=customer" \
  -F "start_enrichment=true"
```

**Expected Result:**
Same response structure as scoped endpoint.

**Validation:**
```bash
# Check logs for legacy upload markers
docker logs app-plane-cns-service --tail 50 | grep -E "upload_bom|legacy"
```

---

### Scenario 3: Test Cross-Tenant Access Denial

**Purpose:** Verify scoped endpoint prevents accessing projects from other organizations

**Test Steps:**

```bash
# 1. Get project_id from Organization A
ORG_A_PROJECT="550e8400-e29b-41d4-a716-446655440000"

# 2. Get JWT token for user in Organization B
TOKEN_ORG_B="eyJhbGci..."  # Token with different org_id claim

# 3. Try to upload to Organization A's project with Organization B's token
curl -X POST "http://localhost:27200/api/boms/projects/$ORG_A_PROJECT/boms/upload" \
  -H "Authorization: Bearer $TOKEN_ORG_B" \
  -F "file=@sample_bom.csv" \
  -F "bom_name=Cross-Tenant Test"
```

**Expected Result:**
```json
{
  "detail": "Project 550e8400-e29b-41d4-a716-446655440000 not found or does not belong to your organization"
}
```

**Status Code:** 404 Not Found

---

### Scenario 4: Test Invalid Project ID

**Purpose:** Verify proper error handling for non-existent projects

**Test Steps:**

```bash
INVALID_PROJECT="00000000-0000-0000-0000-000000000000"

curl -X POST "http://localhost:27200/api/boms/projects/$INVALID_PROJECT/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_bom.csv"
```

**Expected Result:**
```json
{
  "detail": "Project 00000000-0000-0000-0000-000000000000 not found or does not belong to your organization"
}
```

**Status Code:** 404 Not Found

---

### Scenario 5: Test Staff Bypass (Platform Admin)

**Purpose:** Verify staff users can upload to any project

**Prerequisites:**
- JWT token with `is_platform_admin=true` claim or staff role

**Test Steps:**

```bash
# Get staff/admin JWT token
STAFF_TOKEN="eyJhbGci..."  # Token with platform admin privileges

# Upload to any project (even from different organization)
curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -F "file=@sample_bom.csv" \
  -F "bom_name=Staff Upload Test"
```

**Expected Result:**
Upload succeeds regardless of organization ownership.

**Validation:**
```bash
# Check logs for staff bypass markers
docker logs app-plane-cns-service --tail 50 | grep -i "staff"
# Should see: [STAFF_BYPASS] or staff user indicators
```

---

## Database Validation

### Verify BOM Creation

```bash
# Check BOMs table
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    id,
    name,
    organization_id,
    project_id,
    component_count,
    status,
    priority,
    created_at
FROM boms
ORDER BY created_at DESC
LIMIT 5;"
```

**Expected:**
- All BOMs have `project_id` (NOT NULL enforced)
- `organization_id` matches project's workspace's organization
- `status='pending'` initially

### Verify FK Chain

```bash
# Verify the FK chain: bom → project → workspace → organization
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    b.id as bom_id,
    b.name as bom_name,
    b.project_id,
    p.name as project_name,
    w.id as workspace_id,
    w.name as workspace_name,
    o.id as organization_id,
    o.name as organization_name
FROM boms b
JOIN projects p ON b.project_id = p.id
JOIN workspaces w ON p.workspace_id = w.id
JOIN organizations o ON w.organization_id = o.id
ORDER BY b.created_at DESC
LIMIT 5;"
```

**Expected:**
- All joins succeed (no orphaned BOMs)
- `b.organization_id = o.id` (server-derived matches actual FK chain)

---

## Error Scenarios

### 1. Missing JWT Token

```bash
curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -F "file=@sample_bom.csv"
```

**Expected:** HTTP 401 Unauthorized

### 2. Invalid JWT Token

```bash
curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer invalid-token" \
  -F "file=@sample_bom.csv"
```

**Expected:** HTTP 401 Unauthorized

### 3. Invalid UUID Format

```bash
curl -X POST "http://localhost:27200/api/boms/projects/not-a-uuid/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_bom.csv"
```

**Expected:** HTTP 400 Bad Request (UUID validation)

### 4. File Too Large

```bash
# Create 51MB file
dd if=/dev/zero of=large_file.csv bs=1M count=51

curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@large_file.csv"
```

**Expected:**
```json
{
  "detail": "File too large. Maximum supported size is 50MB."
}
```

**Status Code:** HTTP 413 Payload Too Large

### 5. Too Many Rows

```bash
# Create CSV with 10,001 rows
# Upload it
```

**Expected:**
```json
{
  "detail": "Too many rows in file. Maximum supported is 10000 rows."
}
```

**Status Code:** HTTP 400 Bad Request

---

## Performance Testing

### Upload Speed Test

```bash
# Time a normal upload
time curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_bom_100_rows.csv" \
  -F "start_enrichment=false"
```

**Expected:** < 2 seconds for 100 rows (excluding enrichment)

### Concurrent Uploads

```bash
# Launch 5 concurrent uploads
for i in {1..5}; do
  curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@sample_bom.csv" \
    -F "bom_name=Concurrent Test $i" &
done
wait

# Verify all 5 BOMs created
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) FROM boms WHERE name LIKE 'Concurrent Test%';"
```

**Expected:** 5 BOMs created successfully

---

## Idempotency Testing

```bash
# Upload same file twice
FILE_HASH=$(sha256sum sample_bom.csv | cut -d' ' -f1)

# First upload
RESPONSE1=$(curl -s -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_bom.csv" \
  -F "bom_name=Idempotency Test")

BOM_ID1=$(echo $RESPONSE1 | jq -r '.bom_id')

# Second upload (same file)
RESPONSE2=$(curl -s -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_bom.csv" \
  -F "bom_name=Idempotency Test 2")

BOM_ID2=$(echo $RESPONSE2 | jq -r '.bom_id')

# Verify same BOM ID returned
if [ "$BOM_ID1" = "$BOM_ID2" ]; then
  echo "✅ Idempotency check passed: Same BOM ID returned"
else
  echo "❌ Idempotency check failed: Different BOM IDs"
fi
```

**Expected:** Same `bom_id` returned for identical file content

---

## Sample CSV File

Create a test file: `sample_bom.csv`

```csv
manufacturer_part_number,manufacturer,quantity,reference_designator,description
LM358N,Texas Instruments,5,U1,Dual Op Amp
2N3904,Fairchild,10,Q1-Q10,NPN Transistor
1N4148,Diodes Inc,20,D1-D20,Fast Switching Diode
ATMEGA328P-PU,Microchip,1,U2,8-bit MCU
ESP32-WROOM-32,Espressif,1,U3,WiFi Module
AMS1117-3.3,Advanced Monolithic,2,U4-U5,LDO Voltage Regulator
0805-10K,Yageo,50,R1-R50,10K Resistor 0805
0805-100nF,Murata,30,C1-C30,100nF Capacitor 0805
LED-RED-0805,Kingbright,5,LED1-LED5,Red LED 0805
CONN-USB-MICRO-B,Molex,1,J1,USB Micro-B Connector
```

---

## Cleanup After Testing

```bash
# Delete test BOMs
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
DELETE FROM boms WHERE name LIKE 'Test BOM%' OR name LIKE 'Concurrent Test%' OR name LIKE 'Idempotency Test%';"

# Verify deletion
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) as remaining_test_boms FROM boms WHERE name LIKE '%Test%';"
```

---

## Success Criteria

- ✅ New scoped endpoint accepts uploads with valid project_id
- ✅ Server correctly derives organization_id from FK chain
- ✅ Cross-tenant access is denied (404 error)
- ✅ Invalid project_id returns proper error
- ✅ Staff users can bypass scope validation
- ✅ Legacy endpoint still works for backward compatibility
- ✅ All BOMs have project_id (NOT NULL enforced)
- ✅ FK chain validation works (bom → project → workspace → org)
- ✅ Idempotency check prevents duplicate uploads
- ✅ File size and row count limits enforced
- ✅ Concurrent uploads handled correctly
- ✅ Logs show [OK] markers for successful operations

---

## Next Steps After Testing

Once Phase 1 testing is complete:

1. **Phase 2:** Apply scope validation to BOM read endpoints
   - `GET /api/boms/{bom_id}`
   - `GET /api/boms/{bom_id}/components`
   - `GET /api/boms/{bom_id}/line_items`

2. **Phase 3:** Apply scope validation to workspace endpoints
   - `GET /api/workspaces/{workspace_id}`
   - `POST /api/workspaces/{workspace_id}/projects`

3. **Phase 4:** Apply scope validation to project endpoints
   - `GET /api/projects/{project_id}`
   - `PATCH /api/projects/{project_id}`

4. **Frontend Integration:** Update Customer Portal BOM upload to use new scoped endpoint

---

## Troubleshooting

### Issue: "Project not found" error for valid project

**Cause:** JWT token's `org_id` claim doesn't match project's organization

**Fix:**
```bash
# Verify JWT org_id claim
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.org_id'

# Verify project's organization
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT p.id, w.organization_id
FROM projects p
JOIN workspaces w ON p.workspace_id = w.id
WHERE p.id = 'project-id-here';"

# They must match!
```

### Issue: "Unable to determine tenant_id" error

**Cause:** JWT token missing `org_id` claim

**Fix:** Verify Keycloak token includes organization claim

### Issue: Feature flag not taking effect

**Cause:** Service not restarted after config change

**Fix:**
```bash
docker-compose -f app-plane/docker-compose.yml restart cns-service
```

---

**Testing Status:** ⏭️ READY TO BEGIN
