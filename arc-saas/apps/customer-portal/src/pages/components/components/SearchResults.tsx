/**
 * Search Results Component
 * CBP-P2-002: Component search results display (list and grid views)
 * Enhanced with Component Vault enriched data display
 */

import { useState, useCallback, memo } from 'react';

/**
 * URL Sanitization Utility
 * Security: Prevents XSS attacks by validating URL protocols
 * Only allows safe protocols: http://, https://, and data:image/
 * Blocks dangerous protocols: javascript:, vbscript:, data:text/html, etc.
 *
 * @param url - The URL string to sanitize
 * @returns Sanitized URL string or empty string if invalid
 */
function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';

  const trimmed = url.trim();
  const lowerCased = trimmed.toLowerCase();

  // Allow only safe protocols
  if (lowerCased.startsWith('https://') || lowerCased.startsWith('http://')) {
    return trimmed;
  }

  // Allow data URLs for images only (not text/html or other dangerous types)
  if (lowerCased.startsWith('data:image/')) {
    return trimmed;
  }

  // Block everything else (javascript:, vbscript:, data:text/html, file:, etc.)
  console.warn('[Security] Blocked potentially malicious URL:', url.substring(0, 50));
  return '';
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ExternalLink,
  GitCompare,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Star,
  Database,
  Shield,
  AlertOctagon,
  Leaf,
  FileText,
  Image as ImageIcon,
  Package,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ComponentResult } from '@/hooks/useComponentSearch';

interface SearchResultsProps {
  results: ComponentResult[];
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  onCompare: (ids: string[]) => void;
  onViewDetails?: (component: ComponentResult) => void;
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const LIFECYCLE_CONFIG = {
  active: { label: 'Active', icon: CheckCircle, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  nrnd: { label: 'NRND', icon: AlertTriangle, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  obsolete: { label: 'Obsolete', icon: XCircle, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
  eol: { label: 'EOL', icon: XCircle, color: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
  unknown: { label: 'Unknown', icon: Clock, color: 'text-gray-600 bg-gray-100 dark:bg-gray-800/30' },
};

const ENRICHMENT_STATUS_CONFIG = {
  production: { label: 'Production', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  staging: { label: 'Staging', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const RISK_LEVEL_CONFIG = {
  low: { label: 'Low', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  medium: { label: 'Medium', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  unknown: { label: 'N/A', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800/30' },
};

function formatPrice(min?: number, max?: number): string {
  // Handle all undefined/null cases
  if (min === undefined && max === undefined) return '—';
  if (min === null && max === null) return '—';

  // If only min is defined
  if (min !== undefined && min !== null && (max === undefined || max === null)) {
    return `$${min.toFixed(2)}`;
  }

  // If only max is defined
  if ((min === undefined || min === null) && max !== undefined && max !== null) {
    return `$${max.toFixed(2)}`;
  }

  // Both defined
  if (min === max) {
    return `$${min!.toFixed(2)}`;
  }
  return `$${min!.toFixed(2)} - $${max!.toFixed(2)}`;
}

function formatLeadTime(days?: number | null): string {
  if (days === undefined || days === null) return '';
  if (days <= 7) return `${days}d`;
  return `${Math.ceil(days / 7)}w`;
}

function getQualityScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
}

function getQualityScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

// Quality Score Badge Component
function QualityScoreBadge({ score }: { score: number }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-1 cursor-default">
          <Star className={cn('h-3.5 w-3.5', getQualityScoreColor(score))} />
          <span className={cn('text-xs font-medium tabular-nums', getQualityScoreColor(score))}>
            {score}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p className="font-medium">Quality Score: {score}%</p>
          <p className="text-muted-foreground">{getQualityScoreLabel(score)}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Risk Level Badge Component
function RiskBadge({ risk }: { risk: ComponentResult['risk'] }) {
  if (!risk) return <span className="text-xs text-muted-foreground">—</span>;

  const config = RISK_LEVEL_CONFIG[risk.risk_level] || RISK_LEVEL_CONFIG.unknown;

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium cursor-default', config.bgColor, config.color)}>
          <AlertOctagon className="h-3 w-3" />
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-medium">Risk Score: {risk.total_risk_score?.toFixed(1) ?? 'N/A'}</p>
          {risk.lifecycle_risk !== undefined && (
            <p>Lifecycle: {risk.lifecycle_risk.toFixed(1)}</p>
          )}
          {risk.supply_chain_risk !== undefined && (
            <p>Supply Chain: {risk.supply_chain_risk.toFixed(1)}</p>
          )}
          {risk.compliance_risk !== undefined && (
            <p>Compliance: {risk.compliance_risk.toFixed(1)}</p>
          )}
          {risk.cached && <p className="text-muted-foreground italic">Cached data</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Data Sources Component
function DataSourcesBadges({ sources }: { sources: string[] }) {
  if (!sources || sources.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  const displayCount = 2;
  const visibleSources = sources.slice(0, displayCount);
  const hiddenCount = sources.length - displayCount;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleSources.map((source) => (
        <Badge key={source} variant="outline" className="text-[10px] px-1.5 py-0 h-5 capitalize">
          {source}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger>
            <span className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0 h-5 cursor-default">
              +{hiddenCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{sources.slice(displayCount).join(', ')}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// Compliance Icons Component
function ComplianceIcons({ component }: { component: ComponentResult }) {
  const hasCompliance = component.rohsCompliant || component.reachCompliant || component.aecQualified;
  if (!hasCompliance) return null;

  return (
    <div className="flex items-center gap-1">
      {component.rohsCompliant && (
        <Tooltip>
          <TooltipTrigger>
            <Leaf className="h-3.5 w-3.5 text-green-600" />
          </TooltipTrigger>
          <TooltipContent>RoHS Compliant</TooltipContent>
        </Tooltip>
      )}
      {component.reachCompliant && (
        <Tooltip>
          <TooltipTrigger>
            <Shield className="h-3.5 w-3.5 text-blue-600" />
          </TooltipTrigger>
          <TooltipContent>REACH Compliant</TooltipContent>
        </Tooltip>
      )}
      {component.aecQualified && (
        <Tooltip>
          <TooltipTrigger>
            <CheckCircle className="h-3.5 w-3.5 text-purple-600" />
          </TooltipTrigger>
          <TooltipContent>AEC-Q Qualified (Automotive)</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// List View Row Component
const ResultListRow = memo(function ResultListRow({
  component,
  isSelected,
  onToggleSelect,
  onViewDetails,
}: {
  component: ComponentResult;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewDetails: (id: string) => void;
}) {
  const lifecycle = LIFECYCLE_CONFIG[component.lifecycle] || LIFECYCLE_CONFIG.unknown;
  const enrichment = ENRICHMENT_STATUS_CONFIG[component.enrichmentStatus] || ENRICHMENT_STATUS_CONFIG.pending;

  return (
    <TableRow
      className={cn(
        'cursor-pointer transition-colors focus:ring-2 focus:ring-primary focus:outline-none',
        isSelected && 'bg-muted/50'
      )}
      onClick={() => onViewDetails(component.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails(component.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${component.mpn}`}
    >
      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(component.id)}
          aria-label={`Select ${component.mpn}`}
        />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="font-mono">{component.mpn}</span>
          <ComplianceIcons component={component} />
          {component.datasheetUrl && sanitizeUrl(component.datasheetUrl) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={sanitizeUrl(component.datasheetUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  <FileText className="h-3.5 w-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>View Datasheet</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{component.manufacturer}</span>
          {component.package && (
            <Badge variant="secondary" className="font-mono text-[10px] px-1 py-0">
              {component.package}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[250px]">
        <Tooltip>
          <TooltipTrigger>
            <span className="line-clamp-2 text-sm text-left cursor-default">{component.description}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-md">
            {component.description}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        {component.category ? (
          <Badge variant="outline" className="text-xs">
            {component.category}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              lifecycle.color
            )}
          >
            <lifecycle.icon className="h-3 w-3" aria-hidden="true" />
            {lifecycle.label}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <QualityScoreBadge score={component.qualityScore} />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('text-[10px]', enrichment.color)}>
          {enrichment.label}
        </Badge>
      </TableCell>
      <TableCell>
        <DataSourcesBadges sources={component.dataSources} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant={component.inStock ? 'default' : 'secondary'} className="text-xs">
            {component.inStock ? 'In Stock' : 'Out of Stock'}
          </Badge>
          {component.leadTime != null && component.leadTime !== undefined && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Truck className="h-2.5 w-2.5" />
              {formatLeadTime(component.leadTime)}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {formatPrice(component.minPrice, component.maxPrice)}
      </TableCell>
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger>
            <a
              href={`https://octopart.com/search?q=${encodeURIComponent(component.mpn)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Search ${component.mpn} on Octopart`}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent>View on Octopart</TooltipContent>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

// Grid View Card Component
const ResultGridCard = memo(function ResultGridCard({
  component,
  isSelected,
  onToggleSelect,
  onViewDetails,
}: {
  component: ComponentResult;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewDetails: (id: string) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const lifecycle = LIFECYCLE_CONFIG[component.lifecycle] || LIFECYCLE_CONFIG.unknown;
  const enrichment = ENRICHMENT_STATUS_CONFIG[component.enrichmentStatus] || ENRICHMENT_STATUS_CONFIG.pending;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md focus:ring-2 focus:ring-primary focus:outline-none',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onViewDetails(component.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails(component.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${component.mpn}`}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          {/* Component Image or Placeholder */}
          <div className="flex-shrink-0 w-16 h-16 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
            {component.imageUrl && sanitizeUrl(component.imageUrl) && !imageError ? (
              <img
                src={sanitizeUrl(component.imageUrl)}
                alt={component.mpn}
                className="w-full h-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
                <span className="text-[8px] mt-0.5">No Image</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-mono font-medium truncate">{component.mpn}</p>
              <ComplianceIcons component={component} />
            </div>
            <p className="text-xs text-muted-foreground truncate">{component.manufacturer}</p>
            <div className="flex items-center gap-2 mt-1">
              <QualityScoreBadge score={component.qualityScore} />
              {component.datasheetUrl && sanitizeUrl(component.datasheetUrl) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={sanitizeUrl(component.datasheetUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <FileText className="h-3 w-3" />
                      PDF
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>View Datasheet</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(component.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${component.mpn}`}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {component.description}
        </p>

        <div className="flex flex-wrap gap-1">
          {component.category ? (
            <Badge variant="outline" className="text-xs">
              {component.category}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {component.package && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="font-mono text-xs">
                  <Package className="h-2.5 w-2.5 mr-1" />
                  {component.package}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Package Type</TooltipContent>
            </Tooltip>
          )}
          <Badge variant="outline" className={cn('text-[10px]', enrichment.color)}>
            {enrichment.label}
          </Badge>
        </div>

        {/* Data Sources */}
        <div className="flex items-center gap-1">
          <Database className="h-3 w-3 text-muted-foreground" />
          <DataSourcesBadges sources={component.dataSources} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                lifecycle.color
              )}
            >
              <lifecycle.icon className="h-3 w-3" aria-hidden="true" />
              {lifecycle.label}
            </span>
            <Badge variant={component.inStock ? 'default' : 'secondary'} className="text-[10px]">
              {component.inStock ? 'In Stock' : 'Out of Stock'}
            </Badge>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {formatPrice(component.minPrice, component.maxPrice)}
          </span>
        </div>

        {/* Lead Time & Risk Row */}
        <div className="flex items-center justify-between">
          {/* Lead Time */}
          {component.leadTime != null && component.leadTime !== undefined && (
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Truck className="h-3 w-3" />
                  {formatLeadTime(component.leadTime)}
                </span>
              </TooltipTrigger>
              <TooltipContent>Lead Time: {component.leadTime} days</TooltipContent>
            </Tooltip>
          )}
          {/* Risk indicator (if available) */}
          {component.risk && <RiskBadge risk={component.risk} />}
        </div>
      </CardContent>
    </Card>
  );
});

export function SearchResults({
  results,
  isLoading,
  viewMode,
  onCompare,
  onViewDetails,
  page,
  totalCount,
  pageSize,
  onPageChange,
}: SearchResultsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Find component by ID and call the callback
  const handleViewDetails = useCallback(
    (id: string) => {
      const component = results.find((c) => c.id === id);
      if (component && onViewDetails) {
        onViewDetails(component);
      }
    },
    [results, onViewDetails]
  );

  const handleCompareSelected = useCallback(() => {
    if (selectedIds.size >= 2) {
      onCompare(Array.from(selectedIds));
    }
  }, [selectedIds, onCompare]);

  const totalPages = Math.ceil(totalCount / pageSize);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {viewMode === 'list' ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium">No components found</p>
        <p className="text-muted-foreground mt-1">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </Button>
            <Button
              size="sm"
              onClick={handleCompareSelected}
              disabled={selectedIds.size < 2}
            >
              <GitCompare className="h-4 w-4 mr-1" />
              Compare ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {viewMode === 'list' ? (
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead>MPN / Manufacturer</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Quality
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Sources
                  </div>
                </TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((component) => (
                <ResultListRow
                  key={component.id}
                  component={component}
                  isSelected={selectedIds.has(component.id)}
                  onToggleSelect={handleToggleSelect}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((component) => (
            <ResultGridCard
              key={component.id}
              component={component}
              isSelected={selectedIds.has(component.id)}
              onToggleSelect={handleToggleSelect}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default SearchResults;
