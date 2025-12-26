# Column Mapping Templates Feature

## Overview

The Column Mapping Templates feature allows users to save, manage, and reuse column mapping configurations during BOM uploads. This significantly improves the user experience by eliminating the need to manually map columns for every BOM upload when using consistent file formats.

## Architecture

### Storage Strategy

The implementation uses a **dual storage approach** for maximum reliability:

1. **Primary Storage**: CNS API endpoints (`/column-mapping-templates`)
2. **Fallback Storage**: Browser localStorage (per organization)

This ensures the feature works even when:
- The backend API is not yet implemented
- Network connectivity is intermittent
- The backend is being developed in parallel

### Data Flow

```
User Action → React Hook → Service Layer → API (or localStorage fallback) → State Update
```

## Components

### 1. ColumnMappingTemplateSelector

**Location**: `src/components/bom/ColumnMappingTemplateSelector.tsx`

The main dropdown component for selecting and managing templates.

**Features**:
- Dropdown list of all saved templates
- Shows default template with star badge
- Displays last used timestamp
- Quick access to "Save current mapping" action
- Link to template management dialog

**Props**:
```typescript
interface ColumnMappingTemplateSelectorProps {
  currentMapping: BomColumnMapping;
  onMappingChange: (mapping: BomColumnMapping) => void;
  className?: string;
}
```

**Usage**:
```tsx
<ColumnMappingTemplateSelector
  currentMapping={mapping}
  onMappingChange={(newMapping) =>
    dispatch({ type: 'SET_MAPPING', mapping: newMapping })
  }
/>
```

### 2. SaveTemplateDialog

**Location**: `src/components/bom/SaveTemplateDialog.tsx`

Dialog for saving the current column mapping as a reusable template.

**Features**:
- Auto-generated template name with timestamp
- Preview of current mapping
- Option to set as default template
- Shows which fields are mapped
- Validation of template name

**Props**:
```typescript
interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMapping: BomColumnMapping;
  defaultTemplate?: ColumnMappingTemplate;
}
```

### 3. ManageTemplatesDialog

**Location**: `src/components/bom/ManageTemplatesDialog.tsx`

Dialog for viewing, editing, and deleting saved templates.

**Features**:
- List all templates with metadata
- Inline rename functionality
- Set/unset default template
- Delete with confirmation
- Shows last used date
- Display mapped field count
- Badge list of mapped columns

**Props**:
```typescript
interface ManageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

## Hooks

### 1. useColumnMappingTemplates

**Location**: `src/hooks/useColumnMappingTemplates.ts`

Main hook for fetching all templates for the current organization.

**Returns**:
```typescript
{
  templates: ColumnMappingTemplate[];
  defaultTemplate?: ColumnMappingTemplate;
  isLoading: boolean;
  error: Error | null;
}
```

**Features**:
- Auto-sorted (default first, then by last used, then by name)
- Cached for 5 minutes
- Refetches on window focus

### 2. useSaveTemplate

Mutation hook for saving a new template.

**Usage**:
```typescript
const saveTemplate = useSaveTemplate();

await saveTemplate.mutateAsync({
  name: 'Standard BOM Format',
  mappings: currentMapping,
});
```

### 3. useUpdateTemplate

Mutation hook for updating an existing template.

**Usage**:
```typescript
const updateTemplate = useUpdateTemplate();

await updateTemplate.mutateAsync({
  id: templateId,
  data: { name: 'Updated Name' },
});
```

### 4. useDeleteTemplate

Mutation hook for deleting a template.

**Usage**:
```typescript
const deleteTemplate = useDeleteTemplate();
await deleteTemplate.mutateAsync(templateId);
```

### 5. useSetDefaultTemplate

Mutation hook for setting a template as the default.

**Usage**:
```typescript
const setDefault = useSetDefaultTemplate();
await setDefault.mutateAsync(templateId);
```

### 6. useApplyTemplate

Callback hook for applying a template to the current mapping.

**Usage**:
```typescript
const applyTemplate = useApplyTemplate();
const mapping = await applyTemplate(templateId);
if (mapping) {
  onMappingChange(mapping);
}
```

### 7. useAutoLoadTemplate

Hook for automatically loading the default template when the component mounts.

**Usage**:
```typescript
useAutoLoadTemplate((templateMapping) => {
  if (currentStep === 'preview_data' && mapping.mpn === '') {
    dispatch({ type: 'SET_MAPPING', mapping: templateMapping });
  }
});
```

## Service Layer

### columnMappingService

**Location**: `src/services/column-mapping.service.ts`

Service layer for all template operations.

**Methods**:

| Method | Description |
|--------|-------------|
| `getTemplates(orgId)` | Fetch all templates for organization |
| `getTemplate(orgId, id)` | Fetch single template |
| `saveTemplate(orgId, name, mappings)` | Create new template |
| `updateTemplate(orgId, id, data)` | Update existing template |
| `deleteTemplate(orgId, id)` | Delete template |
| `setDefault(orgId, id)` | Set template as default |
| `markAsUsed(orgId, id)` | Update last used timestamp |
| `templateToMapping(template)` | Convert template to BomColumnMapping |

**API Endpoints** (when backend is implemented):

```
GET    /column-mapping-templates?organization_id={id}
GET    /column-mapping-templates/{id}
POST   /column-mapping-templates
PATCH  /column-mapping-templates/{id}
DELETE /column-mapping-templates/{id}
POST   /column-mapping-templates/{id}/set-default
POST   /column-mapping-templates/{id}/mark-used
```

## Data Models

### ColumnMappingTemplate

```typescript
interface ColumnMappingTemplate {
  id: string;
  organizationId: string;
  name: string;
  mappings: Record<string, string>;  // field -> column name
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
  lastUsedAt?: Date;
}
```

### BomColumnMapping

```typescript
interface BomColumnMapping {
  mpn: string;                    // Required
  manufacturer?: string;
  quantity?: string;
  description?: string;
  referenceDesignator?: string;
  designator?: string;
  footprint?: string;
}
```

## Integration with BomUpload

The Column Mapping Templates feature is integrated into the BOM upload flow at **Step 3: Map Columns**.

### Changes to BomUpload.tsx

1. **Imports**:
```typescript
import { useAutoLoadTemplate } from '@/hooks/useColumnMappingTemplates';
import { ColumnMappingTemplateSelector } from '@/components/bom/ColumnMappingTemplateSelector';
```

2. **Auto-load default template**:
```typescript
useAutoLoadTemplate((templateMapping) => {
  if (currentStep === 'preview_data' && mapping.mpn === '') {
    dispatch({ type: 'SET_MAPPING', mapping: templateMapping });
  }
});
```

3. **Template selector in UI**:
```tsx
<ColumnMappingTemplateSelector
  currentMapping={mapping}
  onMappingChange={(newMapping) =>
    dispatch({ type: 'SET_MAPPING', mapping: newMapping })
  }
/>
```

## User Workflows

### Saving a Template

1. User uploads a BOM file
2. User maps columns manually or uses auto-detection
3. User clicks "Save current mapping" from template dropdown
4. Dialog opens with preview of mappings
5. User enters template name
6. Optionally sets as default
7. User clicks "Save Template"
8. Template is saved to API and localStorage
9. Success toast notification shown

### Using a Template

1. User uploads a BOM file
2. User navigates to "Map Columns" step
3. If default template exists, it auto-loads
4. User can select different template from dropdown
5. Columns are automatically mapped based on template
6. User can make manual adjustments if needed
7. Template is marked as "last used"

### Managing Templates

1. User clicks "Manage templates" from dropdown
2. Dialog shows all saved templates
3. User can:
   - Rename templates (inline editing)
   - Set/unset default template
   - Delete templates (with confirmation)
   - View template metadata (created, last used, field count)

## localStorage Schema

Templates are stored per organization:

**Key**: `cbp:column-templates:{organizationId}`

**Value**:
```json
[
  {
    "id": "tmpl_1234567890_abc123",
    "organization_id": "org-uuid",
    "name": "Standard BOM Format",
    "mappings": {
      "mpn": "Part Number",
      "manufacturer": "Mfr",
      "quantity": "Qty"
    },
    "created_at": "2025-12-15T10:00:00Z",
    "updated_at": "2025-12-15T10:00:00Z",
    "is_default": true,
    "last_used_at": "2025-12-15T14:30:00Z"
  }
]
```

## Backend API Contract

When implementing the backend API, use this contract:

### GET /column-mapping-templates

**Query Params**:
- `organization_id` (required): UUID of organization

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "organization_id": "org-uuid",
      "name": "Template Name",
      "mappings": { "mpn": "Part Number" },
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601",
      "is_default": false,
      "last_used_at": "ISO-8601"
    }
  ]
}
```

### POST /column-mapping-templates

**Request Body**:
```json
{
  "organization_id": "org-uuid",
  "name": "Template Name",
  "mappings": { "mpn": "Part Number" },
  "is_default": false
}
```

**Response**: Single template object

### PATCH /column-mapping-templates/{id}

**Request Body** (partial):
```json
{
  "name": "Updated Name",
  "mappings": { "mpn": "MPN" },
  "is_default": true
}
```

**Response**: Updated template object

### DELETE /column-mapping-templates/{id}

**Response**: 204 No Content

### POST /column-mapping-templates/{id}/set-default

Sets the template as default and clears default flag from other templates.

**Response**: 200 OK

### POST /column-mapping-templates/{id}/mark-used

Updates the `last_used_at` timestamp.

**Response**: 200 OK

## Testing Checklist

- [ ] Save template with valid mapping
- [ ] Save template and set as default
- [ ] Load template from dropdown
- [ ] Auto-load default template on mount
- [ ] Rename template
- [ ] Set/unset default template
- [ ] Delete template with confirmation
- [ ] Template persistence in localStorage
- [ ] API fallback when backend unavailable
- [ ] Multi-organization isolation
- [ ] Empty state when no templates
- [ ] Template sorting (default, last used, name)
- [ ] Last used timestamp updates
- [ ] Mapped field count display
- [ ] Toast notifications for all actions

## Future Enhancements

1. **Template Sharing**: Allow sharing templates across organizations
2. **Import/Export**: Export templates as JSON for backup/transfer
3. **Template Categories**: Group templates by BOM type (PCB, mechanical, etc.)
4. **Smart Suggestions**: ML-based column detection improvements
5. **Template Versioning**: Track template changes over time
6. **Bulk Operations**: Import multiple templates at once
7. **Template Analytics**: Track which templates are most used
8. **Collaborative Templates**: Team-wide template management

## Troubleshooting

### Template not auto-loading

**Cause**: Default template check happens on mount, may miss state updates

**Solution**: Check that `useAutoLoadTemplate` is called at component level, not inside conditionals

### Templates not persisting

**Cause**: localStorage quota exceeded or disabled

**Solution**: Service layer gracefully handles localStorage failures and falls back to memory

### API fails but localStorage works

**Expected behavior**: The dual storage approach is designed for this. Templates will still work via localStorage.

### Multiple default templates

**Solution**: `setDefault` should clear all other defaults. Check backend implementation enforces this constraint.

## Performance Considerations

- **Query Caching**: Templates are cached for 5 minutes to reduce API calls
- **Optimistic Updates**: UI updates immediately while API call is in progress
- **Lazy Loading**: Template dialogs only load when opened
- **Pagination**: Not implemented yet, but should be added when template count > 50

## Accessibility

- All dialogs are keyboard navigable
- Focus management on dialog open/close
- ARIA labels on all interactive elements
- Screen reader announcements for template selection
- High contrast support
- Keyboard shortcuts (Escape to close dialogs, Enter to save)

## Browser Compatibility

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- localStorage support required (fallback to API-only if unavailable)
- No IE11 support
