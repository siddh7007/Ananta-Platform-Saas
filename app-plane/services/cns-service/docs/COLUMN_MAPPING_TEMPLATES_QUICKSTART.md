# Column Mapping Templates API - Quick Start

## Quick Reference

### Base URL
```
http://localhost:27200/api/organizations/{org_id}/column-templates
```

### Authentication
All endpoints require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer {your-jwt-token}
```

## Common Scenarios

### 1. Load Templates on Page Load

```typescript
// Fetch all templates for the organization
const response = await fetch(
  `/api/organizations/${organizationId}/column-templates`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const data = await response.json();
// data.templates - array of templates
// data.defaultTemplateId - ID of default template (or null)
```

### 2. Create a New Template

```typescript
const template = {
  name: "Standard BOM Format",
  description: "For Mouser exports",
  mappings: {
    mpn: "Part Number",
    manufacturer: "Manufacturer",
    description: "Description",
    quantity: "Qty"
  },
  isDefault: false
};

const response = await fetch(
  `/api/organizations/${organizationId}/column-templates`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(template)
  }
);

const newTemplate = await response.json();
// newTemplate.id - use this to reference the template
```

### 3. Set a Template as Default

```typescript
await fetch(
  `/api/organizations/${organizationId}/column-templates/${templateId}/set-default`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

### 4. Update Template Mappings

```typescript
const updates = {
  mappings: {
    mpn: "Updated Part #",
    manufacturer: "Updated Mfr"
  }
};

await fetch(
  `/api/organizations/${organizationId}/column-templates/${templateId}`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  }
);
```

### 5. Delete a Template

```typescript
await fetch(
  `/api/organizations/${organizationId}/column-templates/${templateId}`,
  {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

## Testing with cURL

```bash
# Set your variables
export TOKEN="your-jwt-token"
export ORG_ID="a1111111-1111-1111-1111-111111111111"
export API_URL="http://localhost:27200"

# List templates
curl "${API_URL}/api/organizations/${ORG_ID}/column-templates" \
  -H "Authorization: Bearer ${TOKEN}"

# Create template
curl -X POST "${API_URL}/api/organizations/${ORG_ID}/column-templates" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard BOM",
    "mappings": {
      "mpn": "Part Number",
      "manufacturer": "Manufacturer"
    },
    "isDefault": true
  }'

# Update template (replace TEMPLATE_ID)
curl -X PUT "${API_URL}/api/organizations/${ORG_ID}/column-templates/TEMPLATE_ID" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description"
  }'

# Set as default
curl -X POST "${API_URL}/api/organizations/${ORG_ID}/column-templates/TEMPLATE_ID/set-default" \
  -H "Authorization: Bearer ${TOKEN}"

# Delete template
curl -X DELETE "${API_URL}/api/organizations/${ORG_ID}/column-templates/TEMPLATE_ID" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Response Formats

### Template Object
```json
{
  "id": "uuid",
  "name": "Template Name",
  "description": "Optional description",
  "mappings": {
    "mpn": "Part Number",
    "manufacturer": "Manufacturer",
    "description": "Description",
    "quantity": "Qty"
  },
  "isDefault": true,
  "createdAt": "2025-12-16T10:00:00Z",
  "updatedAt": "2025-12-16T10:00:00Z"
}
```

### List Response
```json
{
  "templates": [
    { /* template object */ },
    { /* template object */ }
  ],
  "defaultTemplateId": "uuid-of-default-template"
}
```

## Error Responses

### 403 Forbidden
```json
{
  "detail": "Requires engineer role or higher to create templates"
}
```

### 404 Not Found
```json
{
  "detail": "Template not found"
}
```

### 409 Conflict
```json
{
  "detail": "Template with name 'Standard BOM' already exists"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "mappings"],
      "msg": "Mappings cannot be empty",
      "type": "value_error"
    }
  ]
}
```

## Integration Checklist

- [ ] Update `useColumnMappingTemplates` hook to call API endpoints
- [ ] Add loading states for async operations
- [ ] Handle API errors and display to user
- [ ] Auto-load default template on BOM upload page
- [ ] Show template selector in upload wizard
- [ ] Add "Save as template" button after mapping
- [ ] Add template management page (list/edit/delete)
- [ ] Migrate existing localStorage templates to API (one-time)

## Common Mappings

Standard BOM fields that can be mapped:
- `mpn` - Manufacturer Part Number
- `manufacturer` - Manufacturer name
- `description` - Component description
- `quantity` - Quantity needed
- `reference_designators` - Reference designators (comma-separated)
- `package` - Package type (e.g., "0603", "SOIC-8")
- `value` - Component value (e.g., "10kΩ", "100nF")
- `tolerance` - Tolerance (e.g., "1%", "5%")
- `voltage_rating` - Voltage rating
- `power_rating` - Power rating

## OpenAPI Documentation

View interactive API docs at:
- Swagger UI: http://localhost:27200/docs#/Column%20Mapping%20Templates
- ReDoc: http://localhost:27200/redoc

## Support

- **Migration file**: `migrations/008_column_mapping_templates.sql`
- **API implementation**: `app/api/column_mapping_templates.py`
- **Full documentation**: `docs/COLUMN_MAPPING_TEMPLATES_API.md`
- **Service logs**: `docker logs app-plane-cns-service`
