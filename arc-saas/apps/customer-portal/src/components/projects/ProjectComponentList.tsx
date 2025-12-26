/**
 * Project Component List
 *
 * Collapsible component list showing components from project BOMs.
 * Displays component images, datasheets, and full metadata.
 * Located above Settings in project detail view.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useList } from '@refinedev/core';
import {
  ChevronDown,
  ChevronRight,
  Package,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check,
  Loader2,
  Box,
  RefreshCw,
  DollarSign,
  Clock,
  Truck,
  Shield,
  Activity,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Component, LifecycleStatus } from '@/types/component';
import { LIFECYCLE_CONFIG, getLifecycleColor, getComplianceStatus } from '@/types/component';
import type { Bom, BomLineItem } from '@/types/bom';
import { cnsApi } from '@/lib/axios';

interface ProjectComponentListProps {
  projectId: string;
  defaultOpen?: boolean;
}

interface ComponentRowProps {
  component: BomLineItem;
  isExpanded: boolean;
  onToggle: () => void;
}

// Get lifecycle icon based on status
function getLifecycleIcon(status?: LifecycleStatus) {
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
}

// Compliance badge component
function ComplianceBadge({ value, label }: { value?: boolean | string | null; label: string }) {
  const status = getComplianceStatus(value);

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {status.compliant === true && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
      {status.compliant === false && <XCircle className="h-3.5 w-3.5 text-red-600" />}
      {status.compliant === null && <HelpCircle className="h-3.5 w-3.5 text-gray-400" />}
      <span
        className={cn(
          'text-xs',
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

// Component row with expandable details
function ComponentRow({ component, isExpanded, onToggle }: ComponentRowProps) {
  const [copiedMpn, setCopiedMpn] = useState(false);
  const componentData = component.componentData as Component | undefined;

  const copyMpn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(component.mpn);
      setCopiedMpn(true);
      setTimeout(() => setCopiedMpn(false), 2000);
    } catch (error) {
      console.error('Failed to copy MPN:', error);
    }
  };

  // Get the image URL from component data
  const imageUrl = componentData?.image_url;
  const datasheetUrl = componentData?.datasheet_url;
  const lifecycleStatus = componentData?.lifecycle_status;

  return (
    <div className="border-b last:border-b-0">
      {/* Main Row - Clickable Header */}
      <div
        className={cn(
          'flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors',
          isExpanded && 'bg-muted/30'
        )}
        onClick={onToggle}
      >
        {/* Expand/Collapse Icon */}
        <span
          className="p-1 hover:bg-muted rounded"
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </span>

        {/* Component Image Thumbnail */}
        <div className="w-12 h-12 rounded border bg-muted/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={component.mpn}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <Package className={cn('h-6 w-6 text-muted-foreground', imageUrl && 'hidden')} />
        </div>

        {/* MPN and Manufacturer */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary truncate">{component.mpn}</span>
            <span
              onClick={copyMpn}
              className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy MPN"
            >
              {copiedMpn ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {component.manufacturer || componentData?.manufacturer || 'Unknown Manufacturer'}
          </p>
        </div>

        {/* Quantity */}
        <div className="text-right">
          <span className="text-sm text-muted-foreground">Qty</span>
          <p className="font-medium">{component.quantity || 1}</p>
        </div>

        {/* Lifecycle Status */}
        <div className="flex items-center gap-1.5">
          {getLifecycleIcon(lifecycleStatus)}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              getLifecycleColor(lifecycleStatus)
            )}
          >
            {lifecycleStatus
              ? LIFECYCLE_CONFIG[lifecycleStatus]?.label
              : 'Unknown'}
          </span>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2">
          {datasheetUrl && (
            <a
              href={datasheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
              title="View Datasheet"
            >
              <FileText className="h-4 w-4" />
            </a>
          )}
          {imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
              title="View Product Image"
            >
              <ImageIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <div className="px-4 py-4 bg-muted/20 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Component Image (Large) */}
            <div className="md:row-span-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Product Image
              </h4>
              <div className="aspect-square max-w-[200px] rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full flex items-center justify-center hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={imageUrl}
                      alt={component.mpn}
                      className="max-w-full max-h-full object-contain"
                    />
                  </a>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-xs">No image available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Basic Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Basic Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MPN</span>
                  <span className="font-medium">{component.mpn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manufacturer</span>
                  <span>{component.manufacturer || componentData?.manufacturer || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span>{componentData?.category || '-'}</span>
                </div>
                {componentData?.subcategory && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subcategory</span>
                    <span>{componentData.subcategory}</span>
                  </div>
                )}
                {componentData?.package && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package</span>
                    <span>{componentData.package}</span>
                  </div>
                )}
                {componentData?.quality_score !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Quality Score</span>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        componentData.quality_score >= 80
                          ? 'bg-green-100 text-green-700'
                          : componentData.quality_score >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {componentData.quality_score}/100
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Lifecycle & Risk */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  Lifecycle & Risk
                </div>
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Lifecycle Status</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      getLifecycleColor(componentData?.lifecycle_status)
                    )}
                  >
                    {componentData?.lifecycle_status
                      ? LIFECYCLE_CONFIG[componentData.lifecycle_status as LifecycleStatus]?.label || componentData.lifecycle_status
                      : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Risk Level</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      componentData?.risk_level === 'low' && 'bg-green-100 text-green-700',
                      componentData?.risk_level === 'medium' && 'bg-yellow-100 text-yellow-700',
                      componentData?.risk_level === 'high' && 'bg-orange-100 text-orange-700',
                      componentData?.risk_level === 'critical' && 'bg-red-100 text-red-700',
                      !componentData?.risk_level && 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {componentData?.risk_level
                      ? componentData.risk_level.charAt(0).toUpperCase() + componentData.risk_level.slice(1)
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Compliance Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4" />
                  Compliance
                </div>
              </h4>
              <div className="space-y-2">
                <ComplianceBadge value={componentData?.rohs_compliant} label="RoHS" />
                <ComplianceBadge value={componentData?.reach_compliant} label="REACH" />
                {componentData?.halogen_free !== undefined && (
                  <ComplianceBadge value={componentData.halogen_free} label="Halogen Free" />
                )}
                {componentData?.aec_qualified !== undefined && (
                  <ComplianceBadge value={componentData.aec_qualified} label="AEC-Q" />
                )}
                {componentData?.eccn_code && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">ECCN:</span>
                    <span>{componentData.eccn_code}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing & Availability */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  Pricing & Availability
                </div>
              </h4>
              <div className="space-y-2 text-sm">
                {componentData?.unit_price !== undefined && componentData?.unit_price !== null ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit Price</span>
                    <span className="font-medium">
                      {componentData.currency || 'USD'} {componentData.unit_price.toFixed(4)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit Price</span>
                    <span className="text-gray-400">Not available</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MOQ</span>
                  <span>{componentData?.moq ?? '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Lead Time
                  </span>
                  <span>
                    {componentData?.lead_time_days
                      ? `${componentData.lead_time_days} days`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Stock Status
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs',
                      componentData?.stock_status === 'in_stock' && 'bg-green-100 text-green-700',
                      componentData?.stock_status === 'low_stock' && 'bg-yellow-100 text-yellow-700',
                      componentData?.stock_status === 'out_of_stock' && 'bg-red-100 text-red-700',
                      componentData?.stock_status === 'on_order' && 'bg-blue-100 text-blue-700',
                      !componentData?.stock_status && 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {componentData?.stock_status
                      ? componentData.stock_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {(component.description || componentData?.description) && (
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Description
                </h4>
                <p className="text-sm">
                  {component.description || componentData?.description}
                </p>
              </div>
            )}

            {/* Specifications */}
            {componentData?.specifications && Object.keys(componentData.specifications).length > 0 && (
              <div className="md:col-span-2 lg:col-span-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Specifications
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(componentData.specifications).slice(0, 12).map(([key, value]) => (
                    <div key={key} className="text-sm bg-muted/30 rounded px-2 py-1">
                      <span className="text-muted-foreground">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}:
                      </span>{' '}
                      <span className="font-medium">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            <div className="md:col-span-2 lg:col-span-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Resources
              </h4>
              <div className="flex flex-wrap gap-2">
                {datasheetUrl && (
                  <a
                    href={datasheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    Datasheet
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {imageUrl && (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted text-sm"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Product Image
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {componentData?.product_family && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md text-sm">
                    <Box className="h-4 w-4" />
                    Family: {componentData.product_family}
                  </div>
                )}
                {componentData?.product_series && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md text-sm">
                    <Box className="h-4 w-4" />
                    Series: {componentData.product_series}
                  </div>
                )}
                {componentData?.enrichment_source && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md text-sm">
                    <Database className="h-4 w-4" />
                    Source: {componentData.enrichment_source.charAt(0).toUpperCase() + componentData.enrichment_source.slice(1)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectComponentList({ projectId, defaultOpen = false }: ProjectComponentListProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [lineItems, setLineItems] = useState<BomLineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // Fetch BOMs for this project
  const {
    data: bomsData,
    isLoading: bomsLoading,
  } = useList<Bom>({
    resource: 'boms',
    pagination: { current: 1, pageSize: 50 },
    meta: {
      dataProviderName: 'cns',
      queryParams: {
        project_id: projectId,
      },
    },
    queryOptions: {
      enabled: !!projectId && isOpen,
    },
  });

  // Fetch line items from all project BOMs
  const fetchLineItems = useCallback(async (boms: Bom[]) => {
    if (!boms.length) {
      setLineItems([]);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      // Fetch line items from each BOM in parallel
      const results = await Promise.allSettled(
        boms.map((bom) =>
          cnsApi.get<{ data: BomLineItem[] } | BomLineItem[]>(`/boms/${bom.id}/line_items`)
        )
      );

      const allLineItems: BomLineItem[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const data = result.value.data;
          // Handle multiple response formats:
          // - Direct array: [...]
          // - Wrapped with 'data': { data: [...] }
          // - Wrapped with 'items': { items: [...] } (CNS API format)
          let items: BomLineItem[] = [];
          if (Array.isArray(data)) {
            items = data;
          } else if (data && typeof data === 'object') {
            const responseObj = data as Record<string, unknown>;
            if (Array.isArray(responseObj.items)) {
              items = responseObj.items as BomLineItem[];
            } else if (Array.isArray(responseObj.data)) {
              items = responseObj.data as BomLineItem[];
            }
          }
          allLineItems.push(...items);
        }
      }

      setLineItems(allLineItems);
    } catch (error) {
      console.error('[ProjectComponentList] Failed to fetch line items:', error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger line item fetch when BOMs data changes
  useEffect(() => {
    if (bomsData?.data && isOpen) {
      fetchLineItems(bomsData.data);
    }
  }, [bomsData?.data, isOpen, fetchLineItems]);

  const refetch = useCallback(() => {
    if (bomsData?.data) {
      fetchLineItems(bomsData.data);
    }
  }, [bomsData?.data, fetchLineItems]);

  const components = useMemo(() => {
    if (!lineItems.length) return [];
    // Deduplicate by MPN + manufacturer
    const seen = new Map<string, BomLineItem>();
    for (const item of lineItems) {
      const key = `${item.mpn}-${item.manufacturer || 'unknown'}`;
      if (!seen.has(key)) {
        seen.set(key, { ...item });
      } else {
        // Sum quantities for duplicates
        const existing = seen.get(key)!;
        existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
      }
    }
    return Array.from(seen.values());
  }, [lineItems]);

  const loading = bomsLoading || isLoading;

  const toggleComponent = (id: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedComponents(new Set(components.map((c) => c.id)));
  };

  const collapseAll = () => {
    setExpandedComponents(new Set());
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Header - Collapsible Toggle */}
      <span
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
          <Package className="h-5 w-5 text-primary" />
          <div className="text-left">
            <h3 className="font-semibold">Project Components</h3>
            <p className="text-sm text-muted-foreground">
              {loading
                ? 'Loading components...'
                : `${components.length} unique component${components.length !== 1 ? 's' : ''} across all BOMs`}
            </p>
          </div>
        </div>
        {isOpen && components.length > 0 && (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              onClick={expandAll}
              className="text-xs px-2 py-1 rounded hover:bg-muted"
            >
              Expand All
            </span>
            <span
              onClick={collapseAll}
              className="text-xs px-2 py-1 rounded hover:bg-muted"
            >
              Collapse All
            </span>
            <span
              onClick={() => refetch()}
              className="p-1 hover:bg-muted rounded"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </span>
          </div>
        )}
      </span>

      {/* Content */}
      {isOpen && (
        <div className="border-t">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Loading components...</p>
            </div>
          ) : isError ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
              <p className="text-destructive">Failed to load components</p>
              <span
                onClick={() => refetch()}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Try again
              </span>
            </div>
          ) : components.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
              <h4 className="font-medium text-muted-foreground">No Components Found</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a BOM to this project to see components here.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {components.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  isExpanded={expandedComponents.has(component.id)}
                  onToggle={() => toggleComponent(component.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectComponentList;
