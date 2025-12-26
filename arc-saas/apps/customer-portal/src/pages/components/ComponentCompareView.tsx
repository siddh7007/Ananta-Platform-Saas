/**
 * Component Compare View
 *
 * Side-by-side comparison of 2-4 components showing:
 * - Basic info (MPN, manufacturer, category)
 * - Lifecycle & compliance status
 * - Specifications comparison
 * - Pricing comparison
 * - Visual diff highlighting for differences
 *
 * Accessibility:
 * - Proper table semantics with headers
 * - Keyboard-accessible checkboxes with aria-checked
 * - Focus management for add/remove actions
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  X,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Component, LifecycleStatus } from '@/types/component';
import { LIFECYCLE_CONFIG, getLifecycleColor, getComplianceStatus } from '@/types/component';
import { getComponentsById, searchComponents } from '@/services/component.service';
import { formatPrice } from '@/types/supplier';

const MAX_COMPARE = 4;
const MIN_COMPARE = 2;

interface CompareSection {
  key: string;
  label: string;
  getValue: (c: Component) => React.ReactNode;
  compareType?: 'exact' | 'numeric' | 'boolean';
}

/**
 * Normalize a value for comparison
 * - Treats null, undefined, empty string as equivalent
 * - Normalizes objects by sorting keys deterministically
 * - Handles numeric strings vs numbers
 */
function normalizeValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '__EMPTY__';
  if (typeof val === 'number') return `__NUM__${val}`;
  if (typeof val === 'boolean') return `__BOOL__${val}`;
  if (typeof val === 'object') {
    // Sort keys deterministically for objects/arrays
    return JSON.stringify(val, Object.keys(val as object).sort());
  }
  return String(val).trim().toLowerCase();
}

export function ComponentCompareView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Refs for focus management
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Component IDs from URL - dedupe and enforce max
  const componentIds = useMemo(() => {
    const ids = searchParams.get('ids');
    if (!ids) return [];
    // Dedupe and limit to MAX_COMPARE
    const uniqueIds = [...new Set(ids.split(',').filter(Boolean))];
    return uniqueIds.slice(0, MAX_COMPARE);
  }, [searchParams]);

  // State
  const [components, setComponents] = useState<(Component | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Component[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [copiedMpn, setCopiedMpn] = useState<string | null>(null);
  // Default to Show All when fewer than MIN_COMPARE components
  const [showDifferences, setShowDifferences] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  // Compute whether we can meaningfully show differences
  const canShowDifferences = useMemo(() => {
    const validComponents = components.filter((c): c is Component => c !== null);
    return validComponents.length >= MIN_COMPARE;
  }, [components]);

  // Load components when IDs change
  useEffect(() => {
    if (componentIds.length > 0) {
      loadComponents(componentIds);
    } else {
      setComponents([]);
      setFailedIds([]);
    }
  }, [componentIds]);

  // Reset showDifferences to false when we have fewer than MIN_COMPARE
  useEffect(() => {
    if (!canShowDifferences && showDifferences) {
      setShowDifferences(false);
    }
  }, [canShowDifferences, showDifferences]);

  // Load components by IDs using the improved service
  const loadComponents = async (ids: string[]) => {
    setLoading(true);
    setError(null);
    setFailedIds([]);

    try {
      const { components: results, failedIds: failed } = await getComponentsById(ids);

      // Map results back to original order, preserving nulls for failed IDs
      const orderedResults = ids.map((id) =>
        results.find((c) => c.id === id) ?? null
      );

      setComponents(orderedResults);
      setFailedIds(failed);

      // Show warning if some components failed to load
      if (failed.length > 0) {
        console.warn(`Failed to load ${failed.length} component(s):`, failed);
      }
    } catch (err) {
      setError('Failed to load components. Please try again.');
      console.error('Failed to load components:', err);
    } finally {
      setLoading(false);
    }
  };

  // Search for components to add
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const result = await searchComponents({
        query: searchQuery,
        limit: 10,
      });
      // Filter out already-added components
      const filtered = result.data.filter(
        (c) => !componentIds.includes(c.id)
      );
      setSearchResults(filtered);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, componentIds]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showAddSearch && searchQuery.trim()) {
        handleSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddSearch, handleSearch]);

  // Check if we're at max capacity
  const isAtMaxCapacity = componentIds.length >= MAX_COMPARE;

  // Add component to comparison
  const addComponent = (component: Component) => {
    if (isAtMaxCapacity) {
      // Show limit message
      setLimitMessage(`Maximum ${MAX_COMPARE} components can be compared at once`);
      setTimeout(() => setLimitMessage(null), 3000);
      return;
    }

    // Prevent duplicates
    if (componentIds.includes(component.id)) {
      return;
    }

    const newIds = [...componentIds, component.id];
    setSearchParams({ ids: newIds.join(',') });
    setShowAddSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);

    // Return focus to add button after closing search
    setTimeout(() => addButtonRef.current?.focus(), 0);
  };

  // Remove component from comparison
  const removeComponent = (id: string) => {
    const newIds = componentIds.filter((cid) => cid !== id);
    if (newIds.length > 0) {
      setSearchParams({ ids: newIds.join(',') });
    } else {
      setSearchParams({});
    }
    // Clear limit message since we have room now
    setLimitMessage(null);
  };

  // Handle opening the add search panel
  const openAddSearch = () => {
    if (isAtMaxCapacity) {
      setLimitMessage(`Maximum ${MAX_COMPARE} components can be compared at once`);
      setTimeout(() => setLimitMessage(null), 3000);
      return;
    }
    setShowAddSearch(true);
    // Focus the search input when opening
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  // Handle closing the add search panel
  const closeAddSearch = () => {
    setShowAddSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    // Return focus to add button
    setTimeout(() => addButtonRef.current?.focus(), 0);
  };

  // Copy MPN to clipboard
  const copyMpn = async (mpn: string) => {
    try {
      await navigator.clipboard.writeText(mpn);
      setCopiedMpn(mpn);
      setTimeout(() => setCopiedMpn(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get lifecycle icon
  const getLifecycleIcon = (status?: LifecycleStatus) => {
    if (!status) return <HelpCircle className="h-4 w-4 text-gray-400" />;
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'nrnd':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'obsolete':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'preview':
        return <AlertTriangle className="h-4 w-4 text-blue-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Check if values differ across components using normalized comparison
  const valuesDiffer = useCallback(
    (getValue: (c: Component) => unknown): boolean => {
      const validComponents = components.filter((c): c is Component => c !== null);
      if (validComponents.length < MIN_COMPARE) return false;
      const values = validComponents.map(getValue);
      const firstNormalized = normalizeValue(values[0]);
      return values.some((v) => normalizeValue(v) !== firstNormalized);
    },
    [components]
  );

  // Comparison sections
  const basicInfoSections: CompareSection[] = [
    {
      key: 'mpn',
      label: 'MPN',
      getValue: (c) => (
        <div className="flex items-center gap-1">
          <span className="font-medium">{c.mpn}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyMpn(c.mpn);
            }}
            className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copiedMpn === c.mpn ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
      ),
      compareType: 'exact',
    },
    {
      key: 'manufacturer',
      label: 'Manufacturer',
      getValue: (c) => c.manufacturer,
      compareType: 'exact',
    },
    {
      key: 'category',
      label: 'Category',
      getValue: (c) => c.category || '-',
      compareType: 'exact',
    },
    {
      key: 'subcategory',
      label: 'Subcategory',
      getValue: (c) => c.subcategory || '-',
      compareType: 'exact',
    },
    {
      key: 'description',
      label: 'Description',
      getValue: (c) => (
        <span className="text-sm line-clamp-2">{c.description || '-'}</span>
      ),
    },
    {
      key: 'package',
      label: 'Package',
      getValue: (c) => c.package || '-',
      compareType: 'exact',
    },
  ];

  const lifecycleSections: CompareSection[] = [
    {
      key: 'lifecycle_status',
      label: 'Lifecycle',
      getValue: (c) => (
        <div className="flex items-center gap-2">
          {getLifecycleIcon(c.lifecycle_status)}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              getLifecycleColor(c.lifecycle_status)
            )}
          >
            {c.lifecycle_status
              ? LIFECYCLE_CONFIG[c.lifecycle_status]?.label
              : 'Unknown'}
          </span>
        </div>
      ),
      compareType: 'exact',
    },
    {
      key: 'rohs_compliant',
      label: 'RoHS',
      getValue: (c) => <ComplianceBadge value={c.rohs_compliant} />,
      compareType: 'boolean',
    },
    {
      key: 'reach_compliant',
      label: 'REACH',
      getValue: (c) => <ComplianceBadge value={c.reach_compliant} />,
      compareType: 'boolean',
    },
    {
      key: 'halogen_free',
      label: 'Halogen Free',
      getValue: (c) => <ComplianceBadge value={c.halogen_free} />,
      compareType: 'boolean',
    },
    {
      key: 'aec_qualified',
      label: 'AEC-Q',
      getValue: (c) => <ComplianceBadge value={c.aec_qualified} />,
      compareType: 'boolean',
    },
  ];

  const pricingSections: CompareSection[] = [
    {
      key: 'unit_price',
      label: 'Unit Price',
      getValue: (c) =>
        c.unit_price !== undefined ? (
          <span className="font-medium text-green-700">
            {formatPrice(c.unit_price, c.currency)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      compareType: 'numeric',
    },
    {
      key: 'moq',
      label: 'MOQ',
      getValue: (c) =>
        c.moq != null ? Number(c.moq).toLocaleString() : '-',
      compareType: 'numeric',
    },
    {
      key: 'lead_time_days',
      label: 'Lead Time',
      getValue: (c) =>
        c.lead_time_days != null ? `${c.lead_time_days} days` : '-',
      compareType: 'numeric',
    },
    {
      key: 'stock_status',
      label: 'Stock',
      getValue: (c) =>
        c.stock_status ? (
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              c.stock_status.toLowerCase().includes('in stock')
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            )}
          >
            {c.stock_status}
          </span>
        ) : (
          '-'
        ),
      compareType: 'exact',
    },
  ];

  const qualitySections: CompareSection[] = [
    {
      key: 'quality_score',
      label: 'Quality Score',
      getValue: (c) =>
        c.quality_score !== undefined ? (
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              c.quality_score >= 80
                ? 'bg-green-100 text-green-700'
                : c.quality_score >= 60
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
            )}
          >
            {c.quality_score}/100
          </span>
        ) : (
          '-'
        ),
      compareType: 'numeric',
    },
    {
      key: 'enrichment_source',
      label: 'Data Source',
      getValue: (c) => c.enrichment_source || c.api_source || '-',
      compareType: 'exact',
    },
  ];

  // Get all unique specification keys across all components (sorted deterministically)
  const specificationKeys = useMemo(() => {
    const keys = new Set<string>();
    components.forEach((c) => {
      if (c?.specifications && typeof c.specifications === 'object') {
        Object.keys(c.specifications).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [components]);

  // Render comparison table with proper accessibility
  const renderComparisonTable = (
    title: string,
    sections: CompareSection[]
  ) => {
    const validComponents = components.filter((c): c is Component => c !== null);
    if (validComponents.length === 0) return null;

    // Filter sections based on showDifferences toggle (only when we have enough to compare)
    const visibleSections = showDifferences && canShowDifferences
      ? sections.filter((s) => {
          const rawGetValue = (c: Component) => {
            // Extract raw value for comparison
            const node = s.getValue(c);
            if (typeof node === 'string' || typeof node === 'number') return node;
            // For complex nodes, try to get the underlying value from the component
            return (c as unknown as Record<string, unknown>)[s.key];
          };
          return valuesDiffer(rawGetValue);
        })
      : sections;

    // If filtering and no differences, show message
    if (showDifferences && canShowDifferences && visibleSections.length === 0) {
      return (
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-sm text-muted-foreground text-center py-4">
              No differences in this section
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mb-4">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium" id={`compare-${title.replace(/\s+/g, '-').toLowerCase()}`}>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table
              className="w-full"
              role="grid"
              aria-labelledby={`compare-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <thead className="sr-only">
                <tr>
                  <th scope="col">Attribute</th>
                  {validComponents.map((c) => (
                    <th key={c.id} scope="col">{c.mpn}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleSections.map((section) => {
                  const rawGetValue = (c: Component) =>
                    (c as unknown as Record<string, unknown>)[section.key];
                  const differs = valuesDiffer(rawGetValue);

                  return (
                    <tr
                      key={section.key}
                      className={cn(
                        'border-b last:border-0',
                        differs && 'bg-amber-50/50'
                      )}
                    >
                      <th
                        scope="row"
                        className="p-3 text-sm text-muted-foreground whitespace-nowrap w-32 text-left font-normal"
                      >
                        {section.label}
                        {differs && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex ml-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden="true" />
                                  <span className="sr-only">Values differ</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Values differ</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </th>
                      {validComponents.map((component) => (
                        <td
                          key={component.id}
                          className="p-3 text-sm group"
                          style={{
                            minWidth: `${100 / validComponents.length}%`,
                          }}
                          headers={component.mpn}
                        >
                          {section.getValue(component)}
                        </td>
                      ))}
                      {/* Empty cells for missing slots */}
                      {Array.from({
                        length: MAX_COMPARE - validComponents.length,
                      }).map((_, i) => (
                        <td
                          key={`empty-${i}`}
                          className="p-3 text-sm"
                          style={{
                            minWidth: `${100 / MAX_COMPARE}%`,
                          }}
                          aria-hidden="true"
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render specifications comparison with proper accessibility
  const renderSpecificationsTable = () => {
    const validComponents = components.filter((c): c is Component => c !== null);
    if (validComponents.length === 0 || specificationKeys.length === 0)
      return null;

    // Filter specs based on showDifferences toggle (only when we have enough to compare)
    const visibleKeys = showDifferences && canShowDifferences
      ? specificationKeys.filter((key) => {
          const values = validComponents.map(
            (c) => c.specifications?.[key]
          );
          const firstNormalized = normalizeValue(values[0]);
          return values.some((v) => normalizeValue(v) !== firstNormalized);
        })
      : specificationKeys;

    if (showDifferences && canShowDifferences && visibleKeys.length === 0) {
      return (
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Specifications</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-sm text-muted-foreground text-center py-4">
              No differences in specifications
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mb-4">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium" id="compare-specifications">
            Specifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" role="grid" aria-labelledby="compare-specifications">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Specification</th>
                  {validComponents.map((c) => (
                    <th key={c.id} scope="col">{c.mpn}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleKeys.map((key) => {
                  const values = validComponents.map(
                    (c) => c.specifications?.[key]
                  );
                  const firstNormalized = normalizeValue(values[0]);
                  const differs = values.some(
                    (v) => normalizeValue(v) !== firstNormalized
                  );

                  return (
                    <tr
                      key={key}
                      className={cn(
                        'border-b last:border-0',
                        differs && 'bg-amber-50/50'
                      )}
                    >
                      <th
                        scope="row"
                        className="p-3 text-sm text-muted-foreground whitespace-nowrap w-32 text-left font-normal"
                      >
                        {key
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                        {differs && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex ml-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden="true" />
                                  <span className="sr-only">Values differ</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Values differ</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </th>
                      {validComponents.map((component) => (
                        <td
                          key={component.id}
                          className="p-3 text-sm"
                          style={{
                            minWidth: `${100 / validComponents.length}%`,
                          }}
                          headers={component.mpn}
                        >
                          {component.specifications?.[key] !== undefined
                            ? typeof component.specifications[key] === 'object'
                              ? JSON.stringify(component.specifications[key], Object.keys(component.specifications[key] as object).sort())
                              : String(component.specifications[key])
                            : '-'}
                        </td>
                      ))}
                      {Array.from({
                        length: MAX_COMPARE - validComponents.length,
                      }).map((_, i) => (
                        <td
                          key={`empty-${i}`}
                          className="p-3 text-sm"
                          style={{
                            minWidth: `${100 / MAX_COMPARE}%`,
                          }}
                          aria-hidden="true"
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const validComponents = components.filter((c): c is Component => c !== null);

  // Navigate back preserving any filter params that came with us
  const handleBackToList = () => {
    // Preserve any search/filter state that was passed
    const backUrl = location.state?.from || '/components';
    navigate(backUrl);
  };

  return (
    <div className="space-y-6">
      {/* Limit Message Toast */}
      {limitMessage && (
        <div
          role="alert"
          className="fixed top-4 right-4 z-50 bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-md shadow-lg flex items-center gap-2"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
          {limitMessage}
        </div>
      )}

      {/* Failed IDs Warning */}
      {failedIds.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <span className="text-sm text-amber-800">
              {failedIds.length} component{failedIds.length !== 1 ? 's' : ''} could not be loaded
            </span>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Catalog
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Compare Components</h1>
            <p className="text-sm text-muted-foreground">
              Side-by-side comparison of {validComponents.length} component
              {validComponents.length !== 1 ? 's' : ''}
              {validComponents.length < MIN_COMPARE && ' (add more to compare)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showDifferences ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowDifferences(!showDifferences)}
                  disabled={!canShowDifferences}
                  aria-pressed={showDifferences}
                >
                  {showDifferences ? 'Showing Differences' : 'Show Differences'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!canShowDifferences
                  ? 'Add at least 2 components to compare differences'
                  : showDifferences
                    ? 'Click to show all attributes'
                    : 'Click to show only attributes that differ'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {componentIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadComponents(componentIds)}
              disabled={loading}
              aria-label="Refresh component data"
            >
              <RefreshCw
                className={cn('h-4 w-4 mr-2', loading && 'animate-spin')}
                aria-hidden="true"
              />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Component Headers */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${MAX_COMPARE}, minmax(0, 1fr))` }}>
        {validComponents.map((component) => (
          <Card key={component.id} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0"
              onClick={() => removeComponent(component.id)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardContent className="p-4">
              <div className="pr-6">
                <h3 className="font-semibold text-primary">{component.mpn}</h3>
                <p className="text-sm text-muted-foreground">
                  {component.manufacturer}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getLifecycleIcon(component.lifecycle_status)}
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      getLifecycleColor(component.lifecycle_status)
                    )}
                  >
                    {component.lifecycle_status
                      ? LIFECYCLE_CONFIG[component.lifecycle_status]?.label
                      : 'Unknown'}
                  </span>
                </div>
                {component.datasheet_url && (
                  <a
                    href={component.datasheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Datasheet
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Component Slot */}
        {!isAtMaxCapacity && (
          <Card
            className={cn(
              'border-dashed transition-colors',
              showAddSearch ? 'ring-2 ring-primary' : 'cursor-pointer hover:bg-muted/50'
            )}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px]">
              <Button
                ref={addButtonRef}
                variant="ghost"
                onClick={openAddSearch}
                className="flex flex-col items-center gap-2 h-auto py-4"
                aria-label={`Add component to compare (${MAX_COMPARE - validComponents.length} slots remaining)`}
              >
                <Plus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">
                  Add Component
                </span>
                <span className="text-xs text-muted-foreground">
                  ({MAX_COMPARE - validComponents.length} remaining)
                </span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Max capacity notice when at limit */}
        {isAtMaxCapacity && (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px]">
              <Info className="h-6 w-6 text-muted-foreground mb-2" aria-hidden="true" />
              <span className="text-sm text-muted-foreground text-center">
                Maximum {MAX_COMPARE} components reached
              </span>
              <span className="text-xs text-muted-foreground">
                Remove one to add another
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Component Search Panel */}
      {showAddSearch && (
        <Card className="border-primary">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium" id="add-component-title">
              Add Component to Compare
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={closeAddSearch}
              aria-label="Close search panel"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by MPN or manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-labelledby="add-component-title"
                aria-describedby={searchError ? 'search-error' : undefined}
              />
              {searching && (
                <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" aria-hidden="true" />
              )}
            </div>

            {/* Search error */}
            {searchError && (
              <div id="search-error" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700" role="alert">
                {searchError}
              </div>
            )}

            {searchResults.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto" role="listbox" aria-label="Search results">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    role="option"
                    aria-selected="false"
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors w-full text-left"
                    onClick={() => addComponent(result)}
                  >
                    <div>
                      <div className="font-medium">{result.mpn}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.manufacturer}
                        {result.category && ` • ${result.category}`}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() && !searching && !searchError ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No components found matching "{searchQuery}"
              </p>
            ) : !searchQuery.trim() ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Start typing to search components
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6 text-center">
            <XCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => loadComponents(componentIds)}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && validComponents.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Components Selected</h3>
            <p className="text-muted-foreground mb-4">
              Add at least 2 components to start comparing
            </p>
            <Button onClick={() => setShowAddSearch(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Comparison Tables */}
      {!loading && !error && validComponents.length >= 1 && (
        <div className="space-y-4">
          {validComponents.length < 2 && (
            <Card className="bg-amber-50/50 border-amber-200">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-5 w-5 inline mr-2 text-amber-600" />
                <span className="text-sm text-amber-700">
                  Add at least one more component to see a comparison
                </span>
              </CardContent>
            </Card>
          )}

          {renderComparisonTable('Basic Information', basicInfoSections)}
          {renderComparisonTable('Lifecycle & Compliance', lifecycleSections)}
          {renderComparisonTable('Pricing & Availability', pricingSections)}
          {renderComparisonTable('Quality & Data', qualitySections)}
          {specificationKeys.length > 0 && renderSpecificationsTable()}
        </div>
      )}

      {/* Clear All Button */}
      {validComponents.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setSearchParams({})}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Components
          </Button>
        </div>
      )}
    </div>
  );
}

// Compliance badge component
function ComplianceBadge({ value }: { value?: boolean | string | null }) {
  const status = getComplianceStatus(value);

  return (
    <div className="flex items-center gap-1">
      {status.compliant === true && (
        <CheckCircle className="h-4 w-4 text-green-600" />
      )}
      {status.compliant === false && (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
      {status.compliant === null && (
        <HelpCircle className="h-4 w-4 text-gray-400" />
      )}
      <span
        className={cn(
          'text-sm',
          status.compliant === true && 'text-green-700',
          status.compliant === false && 'text-red-700',
          status.compliant === null && 'text-muted-foreground'
        )}
      >
        {status.label}
      </span>
    </div>
  );
}

export default ComponentCompareView;
