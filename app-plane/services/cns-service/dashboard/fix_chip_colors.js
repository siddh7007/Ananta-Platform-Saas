/**
 * Fix Chip Color Props
 *
 * This script fixes potential undefined/invalid color props on MUI Chip components.
 * The error "palette[t.color] is undefined" occurs when Chip receives an invalid color.
 *
 * Patterns to fix:
 * 1. color={someVar} where someVar could be undefined - add fallback || 'default'
 * 2. color={obj.color} where obj.color could be undefined - add fallback || 'default'
 * 3. color={fn()} where fn might not return a valid color - ensure fn has fallback
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Files that need specific fixes
const fixes = {
  // ComponentSearchTab.tsx - ensure getStatusConfig handles undefined status
  'customer/components/ComponentSearchTab.tsx': [
    {
      // Fix getStatusConfig to handle undefined/null status
      find: /function getStatusConfig\(status: string\) \{/,
      replace: `function getStatusConfig(status: string | undefined | null) {`
    },
    {
      // Fix the fallback to ensure it always returns a valid config
      find: /return configs\[status as keyof typeof configs\] \|\| configs\.pending;/,
      replace: `return (status && configs[status as keyof typeof configs]) || configs.pending;`
    },
    {
      // Fix getQualityChipColor to handle undefined
      find: /function getQualityChipColor\(score: number\)/,
      replace: `function getQualityChipColor(score: number | undefined | null)`
    },
    {
      // Add undefined check in getQualityChipColor
      find: /if \(score >= 95\) return 'success';/,
      replace: `if (score === undefined || score === null) return 'default';\n  if (score >= 95) return 'success';`
    }
  ],

  // FileArtifactsView.tsx - chips without color prop default to undefined
  'analytics/FileArtifactsView.tsx': [
    {
      find: /chips\.push\(\{ label: metadata\.source \}\);/,
      replace: `chips.push({ label: metadata.source, color: 'default' });`
    },
    {
      find: /chips\.push\(\{ label: metadata\.organization_id\.slice\(0, 8\) \}\);/,
      replace: `chips.push({ label: metadata.organization_id.slice(0, 8), color: 'default' });`
    }
  ],

  // Add fallbacks to any color={config.color} patterns
  'bulk/BulkUploadDetail.tsx': [
    {
      find: /color=\{config\.color\}/g,
      replace: `color={config.color || 'default'}`
    }
  ],

  'bom/workflow/QueueItemCard.tsx': [
    {
      find: /color=\{config\.color\}/g,
      replace: `color={config.color || 'default'}`
    }
  ],

  'customer/CustomerEnrichment.tsx': [
    {
      find: /color=\{cfg\.color\}/g,
      replace: `color={cfg.color || 'default'}`
    }
  ],

  'customer/CustomerCatalog.tsx': [
    {
      find: /color=\{cfg\.color\}/g,
      replace: `color={cfg.color || 'default'}`
    }
  ],

  'customer/CustomerBOMs.tsx': [
    {
      find: /color=\{cfg\.color\}/g,
      replace: `color={cfg.color || 'default'}`
    }
  ],

  'components/ComponentSearch.tsx': [
    {
      find: /color=\{config\.color\}/g,
      replace: `color={config.color || 'default'}`
    }
  ],

  'components/ComponentSearchEnhanced.tsx': [
    {
      find: /color=\{config\.color\}/g,
      replace: `color={config.color || 'default'}`
    }
  ],

  'logs/ActivityLog.tsx': [
    {
      find: /color=\{chipConfig\.color\}/g,
      replace: `color={chipConfig.color || 'default'}`
    }
  ],

  'enrichment/EnrichmentProgressMonitor.tsx': [
    {
      find: /color=\{connectionStatus\.color\}/g,
      replace: `color={connectionStatus.color || 'default'}`
    },
    {
      find: /color=\{enrichmentStatus\.color\}/g,
      replace: `color={enrichmentStatus.color || 'default'}`
    }
  ],

  'components/enrichment-detail/pipeline/PipelineStep.tsx': [
    {
      find: /color=\{getStatusColor\(\)\}/g,
      replace: `color={getStatusColor() || 'default'}`
    }
  ],

  'components/enrichment-detail/ComponentEnrichmentDetail.tsx': [
    {
      find: /color=\{getRoutingColor\(component\.routing\)\}/g,
      replace: `color={getRoutingColor(component.routing) || 'default'}`
    }
  ],

  'bom/BOMJobDetail.tsx': [
    {
      find: /color=\{getStatusColor\(status\.status\)\}/g,
      replace: `color={getStatusColor(status.status) || 'default'}`
    },
    {
      find: /color=\{getRoutingColor\(item\.routing\)\}/g,
      replace: `color={getRoutingColor(item.routing) || 'default'}`
    }
  ],

  'bom/BOMJobList.tsx': [
    {
      find: /color=\{getStatusColor\(job\.status\)\}/g,
      replace: `color={getStatusColor(job.status) || 'default'}`
    }
  ],

  'bom/AdminBOMManager.tsx': [
    {
      find: /color=\{getStatusColor\(job\.status\)\}/g,
      replace: `color={getStatusColor(job.status) || 'default'}`
    }
  ],

  'enrichment/EnrichmentJobRow.tsx': [
    {
      find: /color=\{getSourceChipColor\(enrichment\.source\)\}/g,
      replace: `color={getSourceChipColor(enrichment.source) || 'default'}`
    }
  ],

  'components/ComponentCard.tsx': [
    {
      find: /color=\{statusConfig\.color\}/g,
      replace: `color={statusConfig.color || 'default'}`
    }
  ],

  'components/ComponentDetailPage.tsx': [
    {
      find: /color=\{getLifecycleColor\(component\.lifecycle\)\}/g,
      replace: `color={getLifecycleColor(component.lifecycle) || 'default'}`
    }
  ],

  'components/shared/ConnectionStatusBadge.tsx': [
    {
      find: /color=\{color\}/g,
      replace: `color={color || 'default'}`
    }
  ],

  'bulk/BulkUploadsList.tsx': [
    {
      find: /color=\{buttonColor\}/g,
      replace: `color={buttonColor || 'default'}`
    }
  ],

  'audit/AuditTrailViewer.tsx': [
    {
      find: /<Chip label=\{location\} color=\{color\}/g,
      replace: `<Chip label={location} color={color || 'default'}`
    },
    {
      find: /color=\{color\}\n/g,
      replace: `color={color || 'default'}\n`
    }
  ]
};

function processFile(relPath) {
  const fullPath = path.join(srcDir, relPath);

  if (!fs.existsSync(fullPath)) {
    console.log('File not found:', relPath);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  const fileFixs = fixes[relPath];
  if (!fileFixs) return;

  for (const fix of fileFixs) {
    if (fix.find.test ? fix.find.test(content) : content.includes(fix.find)) {
      content = content.replace(fix.find, fix.replace);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Fixed:', relPath);
  }
}

// Process all files
for (const relPath of Object.keys(fixes)) {
  processFile(relPath);
}

console.log('Done!');
