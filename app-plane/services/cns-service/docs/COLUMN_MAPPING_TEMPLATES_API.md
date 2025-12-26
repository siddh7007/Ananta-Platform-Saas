# Column Mapping Templates API

## Overview

The Column Mapping Templates API provides organization-scoped template management for BOM upload column mappings. This replaces the previous localStorage-based approach with persistent, shared templates.

## Features

- **Organization-Scoped**: Templates are shared across all users in an organization
- **Persistent**: Templates sync across devices and browsers
- **Default Template**: Each organization can set one template as default
- **Role-Based Access**: Engineers and above can create/update/delete templates
- **Automatic Deduplication**: Unique constraint on (organization_id, name)

## Database Schema

```sql
CREATE TABLE column_mapping_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mappings JSONB NOT NULL,  -- {"mpn": "Part Number", "manufacturer": "Mfg", ...}
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_org_template_name UNIQUE(organization_id, name)
);
```

### Automatic Default Enforcement

A database trigger ensures only one template per organization can be marked as default:

```sql
CREATE TRIGGER trg_ensure_single_default_template
    BEFORE INSERT OR UPDATE ON column_mapping_templates
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_template();
```

When setting `is_default = TRUE`, the trigger automatically sets `is_default = FALSE` for all other templates in the same organization.

## API Endpoints

### 1. List Templates

**GET** `/api/organizations/{org_id}/column-templates`

Returns all column mapping templates for the organization.

**Authorization**: Requires valid JWT token with organization membership

**Response**:
```json
{
  "templates": [
    {
      "id": "template-uuid-1",
      "name": "Default BOM",
      "description": "Standard BOM format",
      "mappings": {
        "mpn": "Part Number",
        "manufacturer": "Manufacturer",
        "description": "Description",
        "quantity": "Qty"
      },
      "isDefault": true,
      "createdAt": "2025-12-16T10:00:00Z",
      "updatedAt": "2025-12-16T10:00:00Z"
    },
    {
      "id": "template-uuid-2",
      "name": "Alternative Format",
      "description": "Used for supplier BOMs",
      "mappings": {
        "mpn": "MPN",
        "manufacturer": "Mfg",
        "description": "Desc"
      },
      "isDefault": false,
      "createdAt": "2025-12-16T11:00:00Z",
      "updatedAt": "2025-12-16T11:00:00Z"
    }
  ],
  "defaultTemplateId": "template-uuid-1"
}
```

### 2. Create Template

**POST** `/api/organizations/{org_id}/column-templates`

Creates a new column mapping template.

**Authorization**: Requires `engineer` role or higher

**Request Body**:
```json
{
  "name": "Default BOM",
  "description": "Standard BOM format (optional)",
  "mappings": {
    "mpn": "Part Number",
    "manufacturer": "Manufacturer",
    "description": "Description",
    "quantity": "Qty",
    "reference_designators": "Ref Des"
  },
  "isDefault": false
}
```

**Response** (201 Created):
```json
{
  "id": "template-uuid-1",
  "name": "Default BOM",
  "description": "Standard BOM format",
  "mappings": {
    "mpn": "Part Number",
    "manufacturer": "Manufacturer",
    "description": "Description",
    "quantity": "Qty",
    "reference_designators": "Ref Des"
  },
  "isDefault": false,
  "createdAt": "2025-12-16T10:00:00Z",
  "updatedAt": "2025-12-16T10:00:00Z"
}
```

**Error Responses**:
- `409 Conflict`: Template with name already exists
- `403 Forbidden`: User lacks engineer role
- `422 Validation Error`: Invalid request body

### 3. Update Template

**PUT** `/api/organizations/{org_id}/column-templates/{template_id}`

Updates an existing template. All fields are optional.

**Authorization**: Requires `engineer` role or higher

**Request Body** (all fields optional):
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "mappings": {
    "mpn": "Part #",
    "manufacturer": "Mfr"
  },
  "isDefault": true
}
```

**Response** (200 OK):
```json
{
  "id": "template-uuid-1",
  "name": "Updated Name",
  "description": "Updated description",
  "mappings": {
    "mpn": "Part #",
    "manufacturer": "Mfr"
  },
  "isDefault": true,
  "createdAt": "2025-12-16T10:00:00Z",
  "updatedAt": "2025-12-16T12:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Template doesn't exist
- `409 Conflict`: Name already used by another template
- `403 Forbidden`: User lacks engineer role

### 4. Delete Template

**DELETE** `/api/organizations/{org_id}/column-templates/{template_id}`

Deletes a template.

**Authorization**: Requires `engineer` role or higher

**Response** (204 No Content): Empty body

**Error Responses**:
- `404 Not Found`: Template doesn't exist
- `403 Forbidden`: User lacks engineer role

### 5. Set Default Template

**POST** `/api/organizations/{org_id}/column-templates/{template_id}/set-default`

Sets a template as the organization's default. Automatically unsets any existing default.

**Authorization**: Requires `engineer` role or higher

**Response** (200 OK):
```json
{
  "id": "template-uuid-1",
  "name": "Default BOM",
  "description": "Standard BOM format",
  "mappings": {
    "mpn": "Part Number",
    "manufacturer": "Manufacturer"
  },
  "isDefault": true,
  "createdAt": "2025-12-16T10:00:00Z",
  "updatedAt": "2025-12-16T12:30:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Template doesn't exist
- `403 Forbidden`: User lacks engineer role

## Role-Based Access Control

| Role | List | Create | Update | Delete | Set Default |
|------|------|--------|--------|--------|-------------|
| `analyst` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `engineer` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |

## Frontend Integration

The CBP frontend already has the UI components ready:
- `ColumnMappingTemplateSelector` component
- `useColumnMappingTemplates` hook

Update the hook to call these API endpoints instead of using localStorage:

```typescript
// Old (localStorage)
const templates = JSON.parse(localStorage.getItem('templates') || '[]');

// New (API)
const { data } = await fetch(`/api/organizations/${orgId}/column-templates`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const templates = data.templates;
```

## Example Usage

### Create a Template

```bash
# Set your JWT token
TOKEN="your-jwt-token"
ORG_ID="a1111111-1111-1111-1111-111111111111"

# Create template
curl -X POST "http://localhost:27200/api/organizations/${ORG_ID}/column-templates" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard BOM",
    "description": "Default BOM format for Mouser exports",
    "mappings": {
      "mpn": "Mouser No",
      "manufacturer": "Manufacturer",
      "description": "Description",
      "quantity": "Qty"
    },
    "isDefault": true
  }'
```

### List All Templates

```bash
curl "http://localhost:27200/api/organizations/${ORG_ID}/column-templates" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Update Template

```bash
TEMPLATE_ID="template-uuid"

curl -X PUT "http://localhost:27200/api/organizations/${ORG_ID}/column-templates/${TEMPLATE_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "isDefault": true
  }'
```

### Delete Template

```bash
curl -X DELETE "http://localhost:27200/api/organizations/${ORG_ID}/column-templates/${TEMPLATE_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Set Default

```bash
curl -X POST "http://localhost:27200/api/organizations/${ORG_ID}/column-templates/${TEMPLATE_ID}/set-default" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Migration Path

### For Frontend Developers

1. **No Breaking Changes**: The existing `useColumnMappingTemplates` hook interface remains the same
2. **Update Implementation**: Replace localStorage calls with API calls
3. **Add Loading States**: Handle async API requests
4. **Error Handling**: Display API errors to users

### Sample Hook Update

```typescript
// Before
export function useColumnMappingTemplates() {
  const [templates, setTemplates] = useState(() => {
    const stored = localStorage.getItem('columnMappingTemplates');
    return stored ? JSON.parse(stored) : [];
  });

  const saveTemplate = (template) => {
    const updated = [...templates, template];
    setTemplates(updated);
    localStorage.setItem('columnMappingTemplates', JSON.stringify(updated));
  };

  return { templates, saveTemplate };
}

// After
export function useColumnMappingTemplates() {
  const { organizationId } = useOrganizationId();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [organizationId]);

  const fetchTemplates = async () => {
    setLoading(true);
    const response = await fetch(
      `/api/organizations/${organizationId}/column-templates`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    );
    const data = await response.json();
    setTemplates(data.templates);
    setLoading(false);
  };

  const saveTemplate = async (template) => {
    const response = await fetch(
      `/api/organizations/${organizationId}/column-templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(template)
      }
    );
    await fetchTemplates(); // Refresh list
  };

  return { templates, saveTemplate, loading };
}
```

## Testing

### Database Verification

```bash
# Check table exists
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'column_mapping_templates'
ORDER BY ordinal_position;"

# Check triggers exist
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT tgname, tgtype FROM pg_trigger
WHERE tgrelid = 'column_mapping_templates'::regclass;"
```

### API Health Check

```bash
# Verify endpoints are registered
curl -s http://localhost:27200/openapi.json | \
  python -c "import json, sys; paths = [p for p in json.load(sys.stdin)['paths'] if 'column-template' in p]; print('\n'.join(paths))"
```

## Files Created

| File | Purpose |
|------|---------|
| `migrations/008_column_mapping_templates.sql` | Database migration |
| `app/api/column_mapping_templates.py` | API endpoint implementation |
| `docs/COLUMN_MAPPING_TEMPLATES_API.md` | This documentation |

## Files Modified

| File | Changes |
|------|---------|
| `app/api/__init__.py` | Added column_mapping_templates router import and registration |

## Next Steps

1. **Frontend Integration**: Update `useColumnMappingTemplates` hook to call API endpoints
2. **Default Loading**: Automatically load default template when user starts BOM upload
3. **Template Sharing**: Add UI to share templates between users (already works automatically)
4. **Template Versioning**: Consider adding version history for templates (future enhancement)
5. **Import/Export**: Add ability to export templates as JSON and import them (future enhancement)

## Support

For questions or issues:
- Check CNS service logs: `docker logs app-plane-cns-service`
- Verify database state: Query `column_mapping_templates` table
- Check OpenAPI docs: http://localhost:27200/docs#/Column%20Mapping%20Templates
