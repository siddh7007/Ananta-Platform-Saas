# VirtualizedTable Quick Start Guide

## When to Use

Use VirtualizedTable when:
- Table has 50+ rows
- Performance issues with scrolling
- DOM nodes causing memory issues
- Need to display 100-1000+ items

## Basic Usage

```typescript
import { VirtualizedTable, VirtualizedTableColumn } from '@/components/shared';

// 1. Define your data type
interface MyItem {
  id: string;
  name: string;
  status: string;
}

// 2. Define columns
const columns: VirtualizedTableColumn<MyItem>[] = [
  {
    id: 'name',
    label: 'Name',
    width: 200,
    render: (item) => <Typography>{item.name}</Typography>,
  },
  {
    id: 'status',
    label: 'Status',
    align: 'center',
    render: (item) => <Chip label={item.status} />,
  },
];

// 3. Use in component
function MyComponent() {
  const [items, setItems] = useState<MyItem[]>([]);

  return (
    <VirtualizedTable
      items={items}
      columns={columns}
      getRowKey={(item) => item.id}
    />
  );
}
```

## Common Patterns

### With Selection

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const columns = [
  {
    id: 'checkbox',
    label: '',
    width: 48,
    padding: 'checkbox' as const,
    render: (item) => (
      <Checkbox
        checked={selectedIds.has(item.id)}
        onChange={(e) => {
          const newSet = new Set(selectedIds);
          e.target.checked ? newSet.add(item.id) : newSet.delete(item.id);
          setSelectedIds(newSet);
        }}
      />
    ),
  },
  // ... other columns
];

<VirtualizedTable
  items={items}
  columns={columns}
  getRowKey={(item) => item.id}
  selectedIds={selectedIds}
/>
```

### With Row Click

```typescript
const handleRowClick = (item: MyItem, event: React.MouseEvent) => {
  console.log('Clicked:', item);
  // Navigate or show detail
};

<VirtualizedTable
  items={items}
  columns={columns}
  getRowKey={(item) => item.id}
  onRowClick={handleRowClick}
/>
```

### With Actions

```typescript
const columns = [
  // ... data columns
  {
    id: 'actions',
    label: 'Actions',
    width: 120,
    align: 'center' as const,
    render: (item) => (
      <Stack direction="row" spacing={0.5}>
        <IconButton size="small" onClick={() => handleEdit(item.id)}>
          <EditIcon />
        </IconButton>
        <IconButton size="small" onClick={() => handleDelete(item.id)}>
          <DeleteIcon />
        </IconButton>
      </Stack>
    ),
  },
];
```

### With Loading State

```typescript
const [loading, setLoading] = useState(true);

<VirtualizedTable
  items={items}
  columns={columns}
  getRowKey={(item) => item.id}
  loading={loading}
/>
```

### Custom Configuration

```typescript
<VirtualizedTable
  items={items}
  columns={columns}
  getRowKey={(item) => item.id}
  rowHeight={60}           // Taller rows
  maxHeight={800}          // Larger viewport
  overscan={15}            // More buffer rows
  virtualizationThreshold={25}  // Activate earlier
  emptyMessage="No data available"
  aria-label="My data table"
/>
```

## Column Configuration

### Basic Column

```typescript
{
  id: 'field_name',
  label: 'Display Name',
  render: (item) => item.field_name,
}
```

### Aligned Column

```typescript
{
  id: 'count',
  label: 'Count',
  align: 'center',  // 'left' | 'center' | 'right'
  render: (item) => item.count,
}
```

### Fixed Width Column

```typescript
{
  id: 'id',
  label: 'ID',
  width: 100,  // pixels
  render: (item) => item.id,
}
```

### Checkbox Column

```typescript
{
  id: 'select',
  label: '',
  width: 48,
  padding: 'checkbox',
  render: (item) => <Checkbox checked={selected} />,
}
```

### Complex Cell

```typescript
{
  id: 'user',
  label: 'User',
  width: 200,
  render: (item) => (
    <Box>
      <Typography variant="body2" fontWeight={600}>
        {item.userName}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {item.userEmail}
      </Typography>
    </Box>
  ),
}
```

## Performance Tips

1. **Memoize columns**: Define columns outside component or use `useMemo`
   ```typescript
   const columns = useMemo(() => [
     { id: 'name', label: 'Name', render: ... },
   ], []);
   ```

2. **Optimize render functions**: Avoid creating objects/arrays in render
   ```typescript
   // BAD
   render: (item) => <Box sx={{ color: 'red' }}>{item.name}</Box>

   // GOOD
   const nameStyle = { color: 'red' };
   render: (item) => <Box sx={nameStyle}>{item.name}</Box>
   ```

3. **Use correct row height**: Set `rowHeight` to match actual rendered height
   ```typescript
   rowHeight={52}  // Standard MUI table row
   rowHeight={72}  // With extra padding
   rowHeight={100} // Multi-line content
   ```

4. **Adjust overscan**: More overscan = smoother scrolling but more rendering
   ```typescript
   overscan={5}   // Minimal (fast render, may show blanks)
   overscan={10}  // Default (good balance)
   overscan={20}  // Aggressive (very smooth, more memory)
   ```

## Migration from Standard Table

### Before (Standard MUI Table)

```typescript
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Name</TableCell>
        <TableCell>Status</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell>{item.name}</TableCell>
          <TableCell>{item.status}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

### After (VirtualizedTable)

```typescript
const columns: VirtualizedTableColumn<MyItem>[] = [
  {
    id: 'name',
    label: 'Name',
    render: (item) => item.name,
  },
  {
    id: 'status',
    label: 'Status',
    render: (item) => item.status,
  },
];

<VirtualizedTable
  items={items}
  columns={columns}
  getRowKey={(item) => item.id}
/>
```

## Troubleshooting

### Issue: Rows are cut off

**Solution**: Increase `rowHeight` to match actual rendered height
```typescript
<VirtualizedTable rowHeight={72} ... />
```

### Issue: Scrolling feels jumpy

**Solution**: Increase `overscan` for more buffer rows
```typescript
<VirtualizedTable overscan={15} ... />
```

### Issue: Not virtualizing (still rendering all rows)

**Cause**: Item count below threshold (default 50)

**Solution**: Lower threshold or ensure data has 50+ items
```typescript
<VirtualizedTable virtualizationThreshold={25} ... />
```

### Issue: Sticky header not working

**Cause**: CSS conflict

**Solution**: VirtualizedTable uses `stickyHeader` on MUI Table - should work automatically

### Issue: Selection not working

**Cause**: `selectedIds` prop not passed or `Set` not updated correctly

**Solution**: Ensure you pass a `Set<string>` and update it immutably
```typescript
const [selectedIds, setSelectedIds] = useState(new Set<string>());

// Update like this:
const newSet = new Set(selectedIds);
newSet.add(id);
setSelectedIds(newSet);
```

## Examples in Codebase

### QualityQueue

**Location**: `src/quality/QualityQueue.tsx`

**Features**:
- 10-column layout
- Checkbox selection
- Action buttons
- Keyboard shortcuts
- Pagination

**Reference**: Best example of full-featured virtualized table

## API Reference

See `VIRTUALIZATION_README.md` for complete API documentation.

## Need Help?

1. Check `VirtualizedTable.tsx` JSDoc comments
2. Review `QualityQueue.tsx` for working example
3. Read `VIRTUALIZATION_README.md` for detailed docs
4. Compare `QualityQueue.original.tsx` vs `QualityQueue.tsx` for migration example
