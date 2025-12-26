# Accessibility Changes - Quick Reference

## Common Icon aria-labels Used

| Icon Component | aria-label | Tooltip Title |
|----------------|------------|---------------|
| VisibilityIcon | "View details" | View Details |
| RefreshIcon | "Refresh" / "Re-enrich" / "Refresh line items" | Refresh / Re-Enrich / Refresh line items |
| EditIcon | "Edit" | Edit |
| DeleteIcon | "Delete" / "Delete enrichment" / "Delete upload" | Delete / Delete Enrichment / Delete |
| PlayArrowIcon | "Start enrichment" / "Resume enrichment" | Start / Resume |
| PauseIcon | "Pause enrichment" | Pause |
| StopIcon | "Stop enrichment" | Stop |
| LinkIcon | "View linked component" | View Linked Component |
| OpenInNewIcon | "Open BOM" / "Open BOM components" | Open BOM / Open BOM Components |
| DownloadIcon | "Download raw BOM" | Download Raw BOM |
| CheckCircleIcon (CheckIcon) | "Approve to production" | Approve to Production |
| CancelIcon | "Reject and remove" | Reject & Remove |
| InfoIcon | "View component details" | View Component Details |
| CopyIcon | "Copy line ID" | Copy Line ID |
| ExpandMoreIcon | "Expand filters" / "Collapse filters" | (dynamic) |
| KeyboardArrowUpIcon / DownIcon | "Collapse line items" / "View line items" | Collapse / View Line Items |
| PendingIcon | "View audit events" | View Audit Events |

## Pattern Examples

### IconButton with Tooltip
```tsx
<Tooltip title="View Details">
  <IconButton
    aria-label="View details"
    size="small"
    color="info"
    onClick={handleClick}
  >
    <VisibilityIcon fontSize="small" />
  </IconButton>
</Tooltip>
```

### Checkbox with Context
```tsx
<Checkbox
  checked={isSelected}
  onChange={(e) => onSelect(item.id, e.target.checked)}
  inputProps={{ "aria-label": `Select ${item.mpn}` }}
/>
```

### Status Chip
```tsx
<Chip
  label={config.label}
  color={config.color}
  size="small"
  role="status"
  aria-label={`Status: ${config.label}`}
/>
```

### Table with Label
```tsx
<Table aria-label="BOM line items table">
  <TableHead>
    <TableRow>
      <TableCell>Column Header</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {/* ... */}
  </TableBody>
</Table>
```

### Dialog with Labels
```tsx
<Dialog
  open={open}
  onClose={handleClose}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <DialogTitle id="dialog-title">
    Confirm Action
  </DialogTitle>
  <DialogContent>
    <DialogContentText id="dialog-description">
      Are you sure you want to proceed?
    </DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleConfirm} variant="contained">
      Confirm
    </Button>
  </DialogActions>
</Dialog>
```

### Dynamic aria-label
```tsx
<IconButton
  aria-label={isExpanded ? "Collapse line items" : "View line items"}
  onClick={toggleExpand}
>
  {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
</IconButton>
```

## File-Specific Changes

### BOMLineItems.tsx
```tsx
// Before
<IconButton size="small" color="info" onClick={...}>
  <VisibilityIcon fontSize="small" />
</IconButton>

// After
<IconButton
  aria-label="View details"
  size="small"
  color="info"
  onClick={...}
>
  <VisibilityIcon fontSize="small" />
</IconButton>
```

### QualityQueueRow.tsx
```tsx
// Before
<Checkbox
  checked={isSelected}
  onChange={(e) => onSelect(item.id, e.target.checked)}
/>

// After
<Checkbox
  checked={isSelected}
  onChange={(e) => onSelect(item.id, e.target.checked)}
  inputProps={{ "aria-label": `Select ${item.mpn}` }}
/>
```

### EnrichmentJobRow.tsx
```tsx
// Import Added
import { Pending as PendingIcon } from '@mui/icons-material';

// Before
<IconButton size="small" onClick={() => onToggleExpand(enrichment.bom_id)}>
  {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
</IconButton>

// After
<IconButton 
  size="small" 
  onClick={() => onToggleExpand(enrichment.bom_id)}
  aria-label={isExpanded ? "Collapse line items" : "View line items"}
>
  {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
</IconButton>
```

### BulkUploadsList.tsx
```tsx
// Dialog Before
<Dialog open={deleteDialog.open} onClose={...}>
  <DialogTitle>Delete Enrichment Job?</DialogTitle>
  <DialogContent>
    <DialogContentText>
      This will...
    </DialogContentText>
  </DialogContent>
</Dialog>

// Dialog After
<Dialog 
  open={deleteDialog.open} 
  onClose={...}
  aria-labelledby="delete-dialog-title"
  aria-describedby="delete-dialog-description"
>
  <DialogTitle id="delete-dialog-title">
    Delete Enrichment Job?
  </DialogTitle>
  <DialogContent>
    <DialogContentText>
      <span id="delete-dialog-description">
        This will...
      </span>
    </DialogContentText>
  </DialogContent>
</Dialog>
```

## Validation Checklist

When adding new interactive elements:

- [ ] IconButton has aria-label matching Tooltip title
- [ ] aria-label uses sentence case (e.g., "View details" not "View Details")
- [ ] Checkbox has contextual aria-label with item identifier
- [ ] Table has descriptive aria-label
- [ ] Dialog has aria-labelledby pointing to DialogTitle id
- [ ] Dialog has aria-describedby pointing to content id (if applicable)
- [ ] Status indicators have role="status"
- [ ] Collapsible sections have dynamic aria-label reflecting state
- [ ] All aria-labels are descriptive and actionable

## Tools for Testing

### Browser Extensions
- **axe DevTools** (Chrome/Firefox/Edge)
- **WAVE** (Chrome/Firefox)
- **Lighthouse** (Chrome DevTools - Accessibility audit)

### Screen Readers
- **NVDA** (Windows) - https://www.nvaccess.org/
- **JAWS** (Windows) - https://www.freedomscientific.com/products/software/jaws/
- **VoiceOver** (macOS) - Built-in (Cmd+F5)
- **Narrator** (Windows) - Built-in (Win+Ctrl+Enter)

### Command Line
```bash
# Install axe-core CLI
npm install -g @axe-core/cli

# Run automated audit
axe http://localhost:27250

# Save results
axe http://localhost:27250 --save results.json

# Check specific page
axe http://localhost:27250/bom-line-items --save bom-results.json
```

## Resources

- **WCAG Quick Reference:** https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices:** https://www.w3.org/WAI/ARIA/apg/
- **Material-UI Accessibility:** https://mui.com/material-ui/guides/accessibility/
- **React Admin Accessibility:** https://marmelab.com/react-admin/Accessibility.html
- **WebAIM:** https://webaim.org/

---

**Last Updated:** 2025-12-19
