#!/bin/bash
# Fix BOMLineItems.tsx accessibility

FILE="BOMLineItems.tsx"

# Add aria-label to first IconButton (View Details)
sed -i '92,101s/<IconButton$/<IconButton\n          aria-label="View details"/' "$FILE"

# Add aria-label to second IconButton (Re-Enrich)
sed -i '104,116s/<IconButton$/<IconButton\n          aria-label="Re-enrich"/' "$FILE"

# Add aria-label to third IconButton (View Linked Component)
sed -i '119,129s/<IconButton$/<IconButton\n          aria-label="View linked component"/' "$FILE"

# Add aria-label to DatagridConfigurable table
sed -i 's/<DatagridConfigurable$/<DatagridConfigurable\n      aria-label="BOM line items table"/' "$FILE"

# Add role and aria-label to EnrichmentStatusBadge Chip
sed -i '70,79s/<Chip$/<Chip\n      role="status"\n      aria-label={`Status: ${config.label}`}/' "$FILE"

echo "BOMLineItems.tsx accessibility fixes applied"
