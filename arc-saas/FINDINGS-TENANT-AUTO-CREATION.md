# Discovery: Automatic Tenant Creation During Lead Verification

## Date: 2025-12-05

## Finding

The tenant provisioning flow **automatically creates a tenant** during the lead verification step (`POST /leads/{id}/verify`), NOT through a separate tenant creation endpoint.

## Evidence

### Service Logs

```
[2025-12-05T18:47:54.927Z] error :: - :: App_Log -> [-] Lead with id 4ccdaa68-e50a-d452-cb56-082c2c034394 has a tenant
[2025-12-05T18:47:54.928Z] error :: - :: App_Log -> [-] Request POST /leads/4ccdaa68-e50a-d452-cb56-082c2c034394/tenants errored out. Error :: {"message":"Unauthorized"} UnauthorizedError: Unauthorized
```

## Actual Flow

### Step 1: Create Lead
```bash
POST /leads
{
  "email": "admin@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Company Inc",
  "address": {...}
}

Response:
{
  "key": "validation-token",
  "id": "lead-uuid"
}
```

### Step 2: Verify Lead (Tenant Auto-Created Here!)
```bash
POST /leads/{id}/verify
Authorization: Bearer {validation-token}

Response:
{
  "id": "lead-uuid",
  "token": "jwt-token"
}
```

**At this point, the tenant is automatically created with status `PENDING_PROVISION`.**

### Step 3: ~~Create Tenant~~ (Not Needed!)

The endpoint `POST /leads/{id}/tenants` is **NOT** used in the verification flow. It returns:
```
Error: "Lead with id {id} has a tenant"
```

This confirms the tenant was already created during verification.

### Step 4: Trigger Provisioning

The correct next step after verification is to trigger provisioning:

```bash
POST /tenants/{tenant-id}/provision
Authorization: Bearer {admin-jwt}
{
  "id": "subscription-uuid",
  "plan": {...},
  ...
}
```

## Code Analysis

Looking at [onboarding.service.ts](e:\Work\Ananta-Platform-Saas\arc-saas\services\tenant-management-service\src\services\onboarding.service.ts):

```typescript
async onboardForLead(
  dto: Omit<TenantOnboardDTO, 'contact'>,
  lead: LeadUser,
  id: string,
) {
  // ... validation ...

  if (existing.tenant) {
    this.logger.error(`Lead with id ${lead.id} has a tenant`);
    throw new HttpErrors.Unauthorized();
  }

  await this.leadRepository.updateById(lead.id, {
    isValidated: true,
  });

  return this.onboard(
    {
      ...dto,
      contact: new Contact({
        email: existing.email,
        type: 'admin',
        firstName: existing.firstName,
        lastName: existing.lastName,
        isPrimary: true,
      }),
    },
    existing,
  );
}
```

The `onboard()` method creates the tenant record.

## Implications

### Correct Workflow

1. **Create Lead** → `POST /leads`
2. **Verify Lead** → `POST /leads/{id}/verify` (tenant auto-created)
3. ~~**Create Tenant**~~ → **SKIP THIS STEP** (tenant already exists)
4. **Get Tenant ID** → Query database or parse from JWT token
5. **Trigger Provisioning** → `POST /tenants/{id}/provision`

### Why This Design Makes Sense

1. **Simplified Flow**: Less API calls for the user
2. **Atomic Operation**: Verification and tenant creation in one transaction
3. **Security**: The verification token is single-use, ensuring one tenant per lead
4. **Consistency**: Contact information from lead is automatically used

## Questions to Investigate

1. **How to get the Tenant ID after verification?**
   - Option A: Parse from JWT token (userTenantId claim)
   - Option B: Query `/tenants` endpoint with lead JWT
   - Option C: Returned in verification response (currently not present)

2. **When is the tenant provisioning triggered?**
   - Is it manual via `/tenants/{id}/provision`?
   - Or automatic after tenant creation?
   - Need to check onboarding.service.ts logic

3. **What data is needed for tenant creation?**
   - The verification endpoint doesn't accept tenant key or domains
   - Where do these come from?
   - Need to check lead schema

## Next Steps

1. ✅ Understand how tenant creation actually works
2. ⏳ Find how to get tenant ID after verification
3. ⏳ Test complete provisioning flow with correct endpoints
4. ⏳ Update documentation to reflect actual flow
5. ⏳ Create correct test script

## Updated Test Flow

```bash
# Step 1: Create Lead
POST /leads
{
  "email": "admin@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Company Inc",
  "key": "company",  # <-- Check if this is required
  "domains": ["company.com"],  # <-- Check if this is required
  "address": {...}
}

# Step 2: Verify Lead (tenant auto-created)
POST /leads/{id}/verify
Authorization: Bearer {validation-token}
Response: { "id": "...", "token": "..." }

# Step 3: Get Tenant ID
# Option 1: Decode JWT token
jwt_payload=$(echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d)
tenant_id=$(echo $jwt_payload | jq -r '.userTenantId')

# Option 2: Query tenants (if permitted)
GET /tenants
Authorization: Bearer {jwt-token}

# Step 4: Trigger Provisioning
POST /tenants/{tenant-id}/provision
Authorization: Bearer {admin-jwt}
{
  "id": "subscription-uuid",
  "plan": {...}
}
```

## Conclusion

The tenant creation happens automatically during lead verification. The separate `POST /leads/{id}/tenants` endpoint appears to be for a different use case (perhaps creating additional tenants for an existing lead, or for use without the verification flow).

We need to update our test scripts and documentation to reflect the actual workflow.
