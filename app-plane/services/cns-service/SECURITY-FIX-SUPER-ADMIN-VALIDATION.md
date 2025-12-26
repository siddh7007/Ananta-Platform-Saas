# Security Fix: Super Admin Scope Validation

## Vulnerability Summary

**CVE**: Internal - Super Admin Resource Existence Bypass
**Severity**: MEDIUM
**Status**: FIXED
**Date**: 2025-12-18

### Description

The CNS service's `validate_full_scope_chain()` function in `app/core/scope_validators.py` had a vulnerability where super admin users (with `tenant_id=None`) could bypass resource existence checks. This allowed passing non-existent UUIDs that would pass validation but cause `NoneType` errors (500 Internal Server Error) downstream when code attempted to fetch the resource.

### Attack Vector

1. Super admin authenticates with `tenant_id=None`
2. Requests resource with non-existent UUID (e.g., `99999999-9999-9999-9999-999999999999`)
3. Validation passes with `valid=True` (no existence check)
4. Downstream code tries to fetch resource: `bom = get_bom(bom_id)`
5. Returns `None`, causing `NoneType` errors when accessing attributes
6. Results in 500 Internal Server Error instead of proper 403/404 response

### Example Exploit

```python
# Request as super admin
GET /api/boms/99999999-9999-9999-9999-999999999999?organization_id=valid-org-id
Headers:
  Authorization: Bearer {super_admin_token}

# OLD BEHAVIOR (vulnerable):
# - Validation passes (tenant_id=None bypass)
# - get_bom() returns None
# - Code tries: bom.name -> AttributeError: 'NoneType' object has no attribute 'name'
# - Response: 500 Internal Server Error

# NEW BEHAVIOR (fixed):
# - Validation checks BOM exists
# - Returns: 403 Forbidden with error "BOM not found: 99999999-9999-9999-9999-999999999999"
```

## Fix Implementation

### Changed File

`e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\app\core\scope_validators.py`

### Changes Made (Lines 470-559)

**Before (Vulnerable)**:
```python
if tenant_id is None:
    logger.warning("[SECURITY] Super admin scope bypass...")
    validation_result["valid"] = True
    validation_result["workspace_valid"] = True  # No FK check!
    validation_result["project_valid"] = True    # No FK check!
    validation_result["bom_valid"] = True        # No FK check!
    return validation_result
```

**After (Secure)**:
```python
if tenant_id is None:
    # Determine resource type for logging
    if bom_id:
        resource_type = "bom"
        resource_id = bom_id
    elif project_id:
        resource_type = "project"
        resource_id = project_id
    elif workspace_id:
        resource_type = "workspace"
        resource_id = workspace_id
    else:
        resource_type = "tenant_only"
        resource_id = "N/A"

    logger.warning(
        f"[SECURITY] Super admin scope bypass: "
        f"resource_type={resource_type} resource_id={resource_id} "
        f"operation=checking_resource_existence"
    )

    # SECURITY FIX: Verify resources actually exist (prevent 500 errors)
    try:
        # Check BOM exists
        if bom_id:
            query = text("SELECT EXISTS(SELECT 1 FROM boms WHERE id = :bom_id)")
            result = db.execute(query, {"bom_id": bom_id}).scalar()
            if not result:
                errors.append(f"BOM not found: {bom_id}")
                validation_result["valid"] = False
                validation_result["bom_valid"] = False
                logger.warning(
                    f"[SECURITY] Super admin attempted access to non-existent BOM: {bom_id}"
                )
                return validation_result
            validation_result["bom_valid"] = True

        # Check Project exists
        if project_id:
            query = text("SELECT EXISTS(SELECT 1 FROM projects WHERE id = :project_id)")
            result = db.execute(query, {"project_id": project_id}).scalar()
            if not result:
                errors.append(f"Project not found: {project_id}")
                validation_result["valid"] = False
                validation_result["project_valid"] = False
                logger.warning(
                    f"[SECURITY] Super admin attempted access to non-existent Project: {project_id}"
                )
                return validation_result
            validation_result["project_valid"] = True

        # Check Workspace exists
        if workspace_id:
            query = text("SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = :workspace_id)")
            result = db.execute(query, {"workspace_id": workspace_id}).scalar()
            if not result:
                errors.append(f"Workspace not found: {workspace_id}")
                validation_result["valid"] = False
                validation_result["workspace_valid"] = False
                logger.warning(
                    f"[SECURITY] Super admin attempted access to non-existent Workspace: {workspace_id}"
                )
                return validation_result
            validation_result["workspace_valid"] = True

    except Exception as e:
        logger.error(
            f"Error validating super admin resource existence: {e}",
            exc_info=True,
            extra={
                "bom_id": bom_id,
                "project_id": project_id,
                "workspace_id": workspace_id,
                "error_type": type(e).__name__
            }
        )
        errors.append(f"Database error during super admin validation: {type(e).__name__}")
        validation_result["valid"] = False
        return validation_result

    # All resources exist, super admin has access
    validation_result["valid"] = True
    logger.info(
        f"[SECURITY] Super admin scope validation passed: "
        f"resource_type={resource_type} resource_id={resource_id} "
        f"operation=full_access_granted"
    )
    return validation_result
```

### Key Improvements

1. **Resource Existence Checks**: Uses efficient `EXISTS()` queries to verify resources exist
2. **Specific Error Messages**: Returns clear error messages indicating which resource was not found
3. **Proper HTTP Status**: Returns 403 Forbidden instead of 500 Internal Server Error
4. **Security Logging**: Logs super admin attempts to access non-existent resources
5. **Performance**: Uses `EXISTS()` instead of full object fetches (faster)
6. **Error Handling**: Comprehensive try/catch with detailed logging

## Security Impact

### Before Fix

| Scenario | Behavior | HTTP Status |
|----------|----------|-------------|
| Super admin + valid BOM ID | Access granted | 200 OK |
| Super admin + invalid BOM ID | Validation passes, downstream NoneType error | 500 Internal Server Error |
| Regular user + invalid BOM ID | Validation fails | 403 Forbidden |

### After Fix

| Scenario | Behavior | HTTP Status |
|----------|----------|-------------|
| Super admin + valid BOM ID | Access granted | 200 OK |
| Super admin + invalid BOM ID | Validation fails with "BOM not found" | 403 Forbidden |
| Regular user + invalid BOM ID | Validation fails | 403 Forbidden |

## Testing

### Manual Testing

```bash
# 1. Get super admin token
curl -X POST http://localhost:8180/realms/ananta/protocol/openid-connect/token \
  -d "client_id=cns-service" \
  -d "grant_type=password" \
  -d "username=super_admin@ananta.com" \
  -d "password=admin123"

# 2. Test with non-existent BOM ID
curl -X GET "http://localhost:27200/api/boms/99999999-9999-9999-9999-999999999999?organization_id=valid-org-id" \
  -H "Authorization: Bearer {super_admin_token}"

# Expected: 403 Forbidden with error "BOM not found: 99999999-9999-9999-9999-999999999999"
# (NOT 500 Internal Server Error)
```

### Automated Testing

Run the test suite:

```bash
cd app-plane/services/cns-service
python test_super_admin_validation.py
```

Test coverage:
- Super admin accessing non-existent BOM
- Super admin accessing non-existent Project
- Super admin accessing non-existent Workspace
- Super admin accessing existing resource (should still work)

## Rollout Plan

1. **Code Review**: Senior backend developer approval required
2. **Testing**: Run automated test suite + manual verification
3. **Deployment**: Deploy to staging environment first
4. **Monitoring**: Watch for `[SECURITY] Super admin attempted access to non-existent` logs
5. **Production**: Deploy after 24 hours of stable staging operation

## Monitoring

### Log Markers

Watch for these log patterns in production:

```
# Normal super admin access (allowed)
[SECURITY] Super admin scope validation passed: resource_type=bom resource_id={uuid} operation=full_access_granted

# Attempted access to non-existent resource (blocked)
[SECURITY] Super admin attempted access to non-existent BOM: {uuid}
[SECURITY] Super admin attempted access to non-existent Project: {uuid}
[SECURITY] Super admin attempted access to non-existent Workspace: {uuid}
```

### Alerts

Set up alerts for:
- High frequency of "non-existent" warnings (potential attack/misconfiguration)
- Database errors during super admin validation (infrastructure issue)

## Backwards Compatibility

**Impact**: NONE

- Super admin users accessing VALID resources: No change
- Super admin users accessing INVALID resources: Now get proper 403 instead of 500
- Regular users: No change

## Related Issues

- **Bug**: Undefined `resource_type` variable on line 474 (also fixed in this PR)
- **Enhancement**: Super admin access logging improved

## Credits

- **Discovered by**: Security audit / Code review
- **Fixed by**: Backend Developer Agent
- **Reviewed by**: [Pending]
- **Tested by**: Automated test suite

## References

- OWASP Top 10: A01:2021 - Broken Access Control
- CWE-285: Improper Authorization
- File: `app/core/scope_validators.py`
- Test: `test_super_admin_validation.py`
