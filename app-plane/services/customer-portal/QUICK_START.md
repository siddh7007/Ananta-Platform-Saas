# Smart Column Mapping - Quick Start Guide

## 5-Minute Integration

### 1. Install Dependencies (1 min)

```bash
npm install @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-dialog lucide-react
```

### 2. Replace Component (2 min)

**Before:**
```tsx
import { BOMColumnMapper } from './BOMColumnMapper';

<BOMColumnMapper
  headers={headers}
  onMapping={handleMapping}
/>
```

**After:**
```tsx
import { SmartColumnMapper } from '@/components/bom';

<SmartColumnMapper
  headers={headers}
  sampleRows={sampleRows.slice(0, 5)}  // First 5 rows for analysis
  tenantId={user.tenantId}
  currentUserId={user.id}
  onConfirm={(mappings) => {
    // mappings = { 'Part Number': 'manufacturer_part_number', ... }
    console.log('Final mappings:', mappings);
  }}
  onCancel={() => router.back()}
/>
```

### 3. Test (2 min)

```bash
# Run the app
npm run dev

# Upload a BOM with columns like:
# Part Number, Qty, Manufacturer, Description

# Verify:
# ✓ Auto-suggestions appear
# ✓ Confidence badges show green
# ✓ Accept All button works
# ✓ Can save as template
```

## Common Use Cases

### Use Case 1: Replace Existing Mapper

```tsx
// Old code
<BOMColumnMapper
  headers={csvHeaders}
  onMapping={(mappings) => processMappings(mappings)}
/>

// New code
<SmartColumnMapper
  headers={csvHeaders}
  sampleRows={csvData.slice(0, 10)}
  tenantId={session.tenantId}
  currentUserId={session.userId}
  onConfirm={(mappings) => {
    // Convert format if needed
    const converted = Object.entries(mappings).map(([source, target]) => ({
      source,
      target,
    }));
    processMappings(converted);
  }}
/>
```

### Use Case 2: Standalone Template Manager

```tsx
import { MappingTemplateManager } from '@/components/bom';

function SettingsPage() {
  return (
    <MappingTemplateManager
      tenantId={user.tenantId}
      currentUserId={user.id}
      onApply={(templateId) => {
        toast.success('Template applied');
      }}
    />
  );
}
```

### Use Case 3: Programmatic Analysis

```tsx
import { analyzeColumns } from '@/services/column-mapping.service';

async function analyzeCSV(headers: string[], data: any[]) {
  const result = await analyzeColumns({
    headers,
    sampleRows: data.slice(0, 5),
    tenantId: 'tenant-123',
  });

  console.log('Suggestions:', result.suggestions);
  console.log('Matched template:', result.matchedTemplate);

  return result;
}
```

## Props Reference

### SmartColumnMapper Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `headers` | `string[]` | ✓ | Column headers from uploaded file |
| `sampleRows` | `Record<string, unknown>[]` | ✓ | Sample data rows (5-10 recommended) |
| `tenantId` | `string` | ✓ | Current tenant ID |
| `currentUserId` | `string` | ✓ | Current user ID |
| `onConfirm` | `(mappings: Record<string, string>) => void` | ✓ | Callback with final mappings |
| `onCancel` | `() => void` | - | Optional cancel callback |
| `className` | `string` | - | Optional CSS class |

### MappingTemplateManager Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tenantId` | `string` | ✓ | Current tenant ID |
| `currentUserId` | `string` | ✓ | Current user ID |
| `onApply` | `(templateId: string) => void` | ✓ | Template application callback |
| `className` | `string` | - | Optional CSS class |

## Data Format Examples

### Sample Rows Format

```typescript
const sampleRows = [
  {
    'Part Number': 'ABC-123',
    'Qty': '10',
    'Manufacturer': 'Acme Corp',
    'Description': 'Resistor 10k Ohm',
  },
  {
    'Part Number': 'DEF-456',
    'Qty': '20',
    'Manufacturer': 'XYZ Inc',
    'Description': 'Capacitor 100uF',
  },
];
```

### Mapping Output Format

```typescript
const mappings = {
  'Part Number': 'manufacturer_part_number',
  'Qty': 'quantity',
  'Manufacturer': 'manufacturer',
  'Description': 'description',
  'Unknown Column': 'ignore',
};
```

## Target Field Options

```typescript
const TARGET_FIELDS = [
  'ignore',                     // Ignore this column
  'manufacturer_part_number',   // Part Number (MPN)
  'manufacturer',               // Manufacturer name
  'quantity',                   // Quantity
  'reference_designator',       // Reference designator (R1, C2, etc)
  'description',                // Description
];
```

## Pattern Matching Examples

| Column Name | Detected As | Confidence | Reason |
|-------------|-------------|------------|--------|
| Part Number | manufacturer_part_number | 100% | Exact match |
| MPN | manufacturer_part_number | 100% | Exact match |
| Qty | quantity | 100% | Exact match |
| Manufacturer | manufacturer | 100% | Exact match |
| Mfr Part No | manufacturer_part_number | 90% | Fuzzy match |
| Ref Des | reference_designator | 100% | Exact match |
| Random Column | ignore | 0% | No match |

## Troubleshooting

### Issue: No suggestions appear

**Solution:**
```typescript
// Check that sampleRows is not empty
if (sampleRows.length === 0) {
  console.error('Need sample data for analysis');
}

// Verify headers match sampleRows keys
console.log('Headers:', headers);
console.log('Sample keys:', Object.keys(sampleRows[0]));
```

### Issue: Low confidence scores

**Cause:** Column names don't match known patterns

**Solution:**
1. Check pattern list in `column-mapping.service.ts`
2. Add custom patterns if needed
3. Or manually override suggestions

### Issue: Template not saving

**Cause:** Backend API not implemented yet

**Solution:** Service currently uses mock data. Implement backend endpoints (see README).

## Performance Tips

### 1. Limit Sample Rows
```typescript
// Good: 5-10 rows
<SmartColumnMapper sampleRows={data.slice(0, 5)} />

// Bad: All rows (slow for large files)
<SmartColumnMapper sampleRows={data} />
```

### 2. Memoize Data
```typescript
const sampleData = useMemo(
  () => csvData.slice(0, 5),
  [csvData]
);

<SmartColumnMapper sampleRows={sampleData} />
```

### 3. Debounce Search
```typescript
// Already implemented in MappingTemplateManager
// Search is debounced 300ms
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Replace component
3. ✅ Test with sample data
4. 📋 Implement backend API (see README)
5. 📋 Add custom patterns if needed
6. 📋 Gather user feedback
7. 📋 Train ML model (Phase 2)

## Resources

- **Full Documentation**: `SMART_COLUMN_MAPPING_README.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Type Definitions**: `src/types/column-mapping.ts`
- **Service Code**: `src/services/column-mapping.service.ts`
- **Component Code**: `src/components/bom/SmartColumnMapper.tsx`

## Support

Questions? Contact:
- Slack: #customer-portal-dev
- Email: engineering@ananta.com
