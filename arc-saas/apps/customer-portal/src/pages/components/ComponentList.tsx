/**
 * My Components Page - Workspace BOM Components Browser
 *
 * Displays components from BOMs uploaded by the workspace user.
 * Shows all components by default in browse mode (no search required).
 * Components can be filtered by Project and BOM.
 *
 * This is NOT the global Component Vault search - use /components/search for that.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigation, useList } from '@refinedev/core';
import {
  Grid,
  List,
  Layers,
  FolderKanban,
  FileText,
  Package,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  DollarSign,
  Clock,
  Truck,
  Shield,
  Activity,
  Database,
  Box,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useProjects } from '@/hooks/useProjects';
import { cnsApi } from '@/lib/axios';
import type { Bom, BomLineItem } from '@/types/bom';
import type { Component, LifecycleStatus } from '@/types/component';
import { LIFECYCLE_CONFIG, getLifecycleColor, getComplianceStatus } from '@/types/component';

// ============================================
// Helper Components (from ProjectComponentList)
// ============================================

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

interface ComponentRowProps {
  component: BomLineItem;
  isExpanded: boolean;
  onToggle: () => void;
  viewMode: 'list' | 'grid';
}

// Component row/card with expandable details
function ComponentRow({ component, isExpanded, onToggle, viewMode }: ComponentRowProps) {
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

  const imageUrl = componentData?.image_url;
  const datasheetUrl = componentData?.datasheet_url;
  const lifecycleStatus = componentData?.lifecycle_status;

  // Grid view card
  if (viewMode === 'grid') {
    return (
      <div
        className={cn(
          'border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow bg-card',
          isExpanded && 'ring-2 ring-primary'
        )}
        onClick={onToggle}
      >
        {/* Image */}
        <div className="w-full h-32 rounded border bg-muted/30 flex items-center justify-center mb-3 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={component.mpn}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <Package className={cn('h-10 w-10 text-muted-foreground', imageUrl && 'hidden')} />
        </div>

        {/* MPN and Manufacturer */}
        <div className="mb-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-primary truncate">{component.mpn}</span>
            <span
              onClick={copyMpn}
              className="p-1 hover:bg-muted rounded"
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
            {component.manufacturer || componentData?.manufacturer || 'Unknown'}
          </p>
        </div>

        {/* Quick info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Qty: {component.quantity || 1}</span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              getLifecycleColor(lifecycleStatus)
            )}
          >
            {lifecycleStatus
              ? LIFECYCLE_CONFIG[lifecycleStatus]?.label || lifecycleStatus
              : 'Unknown'}
          </span>
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          {datasheetUrl && (
            <a
              href={datasheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
              title="Datasheet"
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
              title="Image"
            >
              <ImageIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // List view row
  return (
    <div className="border-b last:border-b-0">
      {/* Main Row */}
      <div
        className={cn(
          'flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors',
          isExpanded && 'bg-muted/30'
        )}
        onClick={onToggle}
      >
        {/* Expand/Collapse */}
        <span className="p-1 hover:bg-muted rounded">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </span>

        {/* Thumbnail */}
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

      {/* Expanded Details */}
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
                    <p className="text-xs">No image</p>
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

            {/* Compliance */}
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

// ============================================
// Main Component
// ============================================

export function ComponentListPage() {
  const { push } = useNavigation();
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspaceContext();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  // Project and BOM filter states - 'all' is default
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedBomId, setSelectedBomId] = useState<string>('all');

  // Component data from BOM line items
  const [lineItems, setLineItems] = useState<BomLineItem[]>([]);
  const [isLoadingLineItems, setIsLoadingLineItems] = useState(false);
  const [lineItemsError, setLineItemsError] = useState<string | null>(null);

  // Fetch projects for current workspace
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const projects = projectsData?.data || [];

  // Fetch BOMs based on selected project
  // Note: Include selectedProjectId in queryOptions.queryKey to force refetch when project changes
  const { data: bomsData, isLoading: bomsLoading, refetch: refetchBoms } = useList<Bom>({
    resource: 'boms',
    filters: selectedProjectId !== 'all'
      ? [{ field: 'project_id', operator: 'eq' as const, value: selectedProjectId }]
      : [],
    pagination: { current: 1, pageSize: 100 },
    meta: { dataProviderName: 'cns' },
    queryOptions: {
      enabled: !!currentWorkspace,
      // Include selectedProjectId in queryKey to force refetch when project filter changes
      queryKey: ['boms', 'list', currentWorkspace?.id, selectedProjectId],
    },
  });
  const boms = bomsData?.data || [];

  // Debug logging for filter changes
  useEffect(() => {
    console.log('[ComponentList] Filter state changed:', {
      selectedProjectId,
      selectedBomId,
      bomsCount: boms.length,
      lineItemsCount: lineItems.length,
    });
  }, [selectedProjectId, selectedBomId, boms.length, lineItems.length]);

  // Fetch line items from BOMs
  const fetchLineItems = useCallback(async (bomList: Bom[]) => {
    // Filter to selected BOM if one is selected
    const bomsToFetch = selectedBomId !== 'all'
      ? bomList.filter(b => b.id === selectedBomId)
      : bomList;

    if (!bomsToFetch.length) {
      setLineItems([]);
      return;
    }

    setIsLoadingLineItems(true);
    setLineItemsError(null);

    try {
      // Fetch line items from each BOM in parallel
      const results = await Promise.allSettled(
        bomsToFetch.map((bom) =>
          cnsApi.get<{ data: BomLineItem[] } | BomLineItem[]>(`/boms/${bom.id}/line_items`)
        )
      );

      const allLineItems: BomLineItem[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const data = result.value.data;
          // Handle multiple response formats
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
      console.error('[ComponentList] Failed to fetch line items:', error);
      setLineItemsError('Failed to load components');
    } finally {
      setIsLoadingLineItems(false);
    }
  }, [selectedBomId]);

  // Trigger line item fetch when BOMs data changes or BOM filter changes
  // Use JSON.stringify of bom IDs to detect array content changes
  const bomIds = boms.map(b => b.id).join(',');
  useEffect(() => {
    console.log('[ComponentList] Triggering fetchLineItems - boms:', boms.length, 'bomFilter:', selectedBomId);
    if (boms.length > 0) {
      fetchLineItems(boms);
    } else {
      // Clear line items if no BOMs
      setLineItems([]);
    }
  }, [bomIds, selectedBomId, fetchLineItems, boms]);

  // Deduplicated and filtered components
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

    let result = Array.from(seen.values());

    // Apply search filter (client-side)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const componentData = item.componentData as Component | undefined;
        return (
          item.mpn.toLowerCase().includes(query) ||
          (item.manufacturer || '').toLowerCase().includes(query) ||
          (componentData?.manufacturer || '').toLowerCase().includes(query) ||
          (componentData?.category || '').toLowerCase().includes(query) ||
          (item.description || '').toLowerCase().includes(query) ||
          (componentData?.description || '').toLowerCase().includes(query)
        );
      });
    }

    return result;
  }, [lineItems, searchQuery]);

  const loading = workspaceLoading || projectsLoading || bomsLoading || isLoadingLineItems;

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

  const handleRefresh = useCallback(() => {
    refetchBoms();
  }, [refetchBoms]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">My Components</h1>
              {!workspaceLoading && currentWorkspace && (
                <div className="flex items-center gap-2 mt-1">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Workspace: <span className="font-medium text-foreground">{currentWorkspace.name}</span>
                  </span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Project Filter */}
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedProjectId}
                onValueChange={(v) => {
                  setSelectedProjectId(v);
                  setSelectedBomId('all'); // Reset BOM when project changes
                }}
              >
                <SelectTrigger className="w-[180px]" aria-label="Filter by project">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsLoading ? (
                    <SelectItem value="_loading" disabled>Loading...</SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* BOM Filter */}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedBomId}
                onValueChange={(v) => {
                  setSelectedBomId(v);
                }}
              >
                <SelectTrigger className="w-[200px]" aria-label="Filter by BOM">
                  <SelectValue placeholder="All BOMs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All BOMs</SelectItem>
                  {bomsLoading ? (
                    <SelectItem value="_loading" disabled>Loading...</SelectItem>
                  ) : boms.length === 0 ? (
                    <SelectItem value="_empty" disabled>No BOMs found</SelectItem>
                  ) : (
                    boms.map((bom) => (
                      <SelectItem key={bom.id} value={bom.id}>
                        {bom.name || bom.fileName || `BOM ${bom.id.slice(0, 8)}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Search (client-side filter) */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by MPN, manufacturer, category..."
                className="pl-10"
                aria-label="Filter components"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Toggle
                pressed={viewMode === 'list'}
                onPressedChange={() => setViewMode('list')}
                aria-label="List view"
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={viewMode === 'grid'}
                onPressedChange={() => setViewMode('grid')}
                aria-label="Grid view"
                className="h-8 w-8 p-0"
              >
                <Grid className="h-4 w-4" />
              </Toggle>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {loading ? (
                  'Loading components...'
                ) : (
                  <>
                    <span className="font-medium">{components.length.toLocaleString()}</span> component{components.length !== 1 ? 's' : ''} from your BOMs
                  </>
                )}
              </p>
              {!loading && (
                <Badge variant="outline" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  From {boms.length} BOM{boms.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {!loading && components.length > 0 && viewMode === 'list' && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            )}
          </div>

          {/* Components Display */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Loading components...</p>
            </div>
          ) : lineItemsError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-destructive">{lineItemsError}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          ) : components.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No Components Found</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                {searchQuery
                  ? 'No components match your search. Try a different search term.'
                  : 'Upload a BOM to see components here. Components from your BOMs will appear in this list.'}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => push('/boms/upload')}
                >
                  Upload BOM
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {components.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  isExpanded={expandedComponents.has(component.id)}
                  onToggle={() => toggleComponent(component.id)}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg bg-card divide-y">
              {components.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  isExpanded={expandedComponents.has(component.id)}
                  onToggle={() => toggleComponent(component.id)}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ComponentListPage;
