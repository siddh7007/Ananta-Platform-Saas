#!/bin/bash

# Fix unused imports in pipeline components
sed -i '/^import.*List.*from/d' src/components/enrichment-detail/pipeline/AIEnhancementStep.tsx
sed -i '/^import.*ListItem.*from/d' src/components/enrichment-detail/pipeline/AIEnhancementStep.tsx  
sed -i '/^import.*ListItemText.*from/d' src/components/enrichment-detail/pipeline/AIEnhancementStep.tsx
sed -i '/^import.*Divider.*from/d' src/components/enrichment-detail/pipeline/AIEnhancementStep.tsx

# Fix unused Button import
sed -i '/^import.*Button.*from/d' src/quality/QualityQueue.tsx

# Fix unused AttachMoneyIcon
sed -i '/^import.*AttachMoneyIcon.*from/d' src/config/EnrichmentConfig.tsx

echo "TypeScript errors fixed"
