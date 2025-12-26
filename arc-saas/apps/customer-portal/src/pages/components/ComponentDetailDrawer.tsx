/**
 * Component Detail Drawer
 *
 * Slide-out drawer showing full component details including:
 * - Basic info (MPN, manufacturer, category)
 * - Lifecycle & compliance status
 * - Specifications/parameters
 * - Pricing information
 * - Alternates
 * - Resources (datasheet, images)
 */

import { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  FileText,
  Image,
  RefreshCw,
  Copy,
  Check,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Component, LifecycleStatus, AlternateComponent } from '@/types/component';
import { LIFECYCLE_CONFIG, getLifecycleColor, getComplianceStatus } from '@/types/component';
import { getAlternates } from '@/services/component.service';
import { SupplierPricingPanel } from '@/components/pricing';

interface ComponentDetailDrawerProps {
  component: Component | null;
  open: boolean;
  onClose: () => void;
  onSelectAlternate?: (component: Component) => void;
}

export function ComponentDetailDrawer({
  component,
  open,
  onClose,
  onSelectAlternate,
}: ComponentDetailDrawerProps) {
  const [alternates, setAlternates] = useState<AlternateComponent[]>([]);
  const [loadingAlternates, setLoadingAlternates] = useState(false);
  const [copiedMpn, setCopiedMpn] = useState(false);
  const [showSupplierPricing, setShowSupplierPricing] = useState(false);

  // Load alternates when component changes
  useEffect(() => {
    if (component && open) {
      loadAlternates();
    }
  }, [component?.id, open]);

  const loadAlternates = async () => {
    if (!component) return;
    setLoadingAlternates(true);
    try {
      const alts = await getAlternates(component.mpn, component.manufacturer);
      setAlternates(alts);
    } catch (error) {
      console.error('Failed to load alternates:', error);
      setAlternates([]);
    } finally {
      setLoadingAlternates(false);
    }
  };

  const copyMpn = async () => {
    if (!component) return;
    try {
      await navigator.clipboard.writeText(component.mpn);
      setCopiedMpn(true);
      setTimeout(() => setCopiedMpn(false), 2000);
    } catch (error) {
      console.error('Failed to copy MPN:', error);
    }
  };

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-xl bg-background shadow-xl z-50',
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Component Details</h2>
            {component && (
              <p className="text-sm text-muted-foreground">
                {component.mpn} • {component.manufacturer}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-64px)] p-4 space-y-6">
          {!component ? (
            <div className="p-8 text-center text-muted-foreground">
              No component selected
            </div>
          ) : (
            <>
              {/* Basic Information */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Basic Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">MPN</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{component.mpn}</span>
                      <button
                        onClick={copyMpn}
                        className="p-1 hover:bg-muted rounded"
                        title="Copy MPN"
                      >
                        {copiedMpn ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Manufacturer</span>
                    <span className="font-medium">{component.manufacturer}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Category</span>
                    <span>{component.category || '-'}</span>
                  </div>
                  {component.subcategory && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Subcategory</span>
                      <span>{component.subcategory}</span>
                    </div>
                  )}
                  {component.quality_score !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Quality Score</span>
                      <span
                        className={cn(
                          'text-sm px-2 py-0.5 rounded-full',
                          component.quality_score >= 80
                            ? 'bg-green-100 text-green-700'
                            : component.quality_score >= 60
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {component.quality_score}/100
                      </span>
                    </div>
                  )}
                  {component.description && (
                    <div className="pt-2">
                      <span className="text-sm text-muted-foreground block mb-1">Description</span>
                      <p className="text-sm">{component.description}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Lifecycle & Compliance */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Lifecycle & Compliance
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Lifecycle Status</span>
                    <div className="flex items-center gap-2">
                      {getLifecycleIcon(component.lifecycle_status)}
                      <span
                        className={cn(
                          'text-sm px-2 py-0.5 rounded-full',
                          getLifecycleColor(component.lifecycle_status)
                        )}
                      >
                        {component.lifecycle_status
                          ? LIFECYCLE_CONFIG[component.lifecycle_status]?.label
                          : 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">RoHS</span>
                    <ComplianceBadge value={component.rohs_compliant} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">REACH</span>
                    <ComplianceBadge value={component.reach_compliant} />
                  </div>
                  {component.halogen_free !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Halogen Free</span>
                      <ComplianceBadge value={component.halogen_free} />
                    </div>
                  )}
                  {component.aec_qualified !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AEC-Q Qualified</span>
                      <ComplianceBadge value={component.aec_qualified} />
                    </div>
                  )}
                  {component.eccn_code && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">ECCN</span>
                      <span className="text-sm">{component.eccn_code}</span>
                    </div>
                  )}
                  {component.enrichment_source && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Data Source</span>
                      <span className="text-sm">{component.enrichment_source}</span>
                    </div>
                  )}
                  {component.updated_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Updated</span>
                      <span className="text-sm">{formatDate(component.updated_at)}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Package Information */}
              {(component.package || component.product_family || component.product_series) && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Package Information
                  </h3>
                  <div className="space-y-3">
                    {component.package && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Package</span>
                        <span>{component.package}</span>
                      </div>
                    )}
                    {component.product_family && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Product Family</span>
                        <span>{component.product_family}</span>
                      </div>
                    )}
                    {component.product_series && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Product Series</span>
                        <span>{component.product_series}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Specifications */}
              {component.specifications && Object.keys(component.specifications).length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Specifications
                  </h3>
                  <div className="border rounded-md divide-y">
                    {Object.entries(component.specifications).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-muted-foreground">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                        <span className="text-sm font-medium">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Pricing & Availability */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Pricing & Availability
                  </h3>
                  <button
                    onClick={() => setShowSupplierPricing(!showSupplierPricing)}
                    className={cn(
                      'flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
                      showSupplierPricing
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    <DollarSign className="h-3 w-3" />
                    {showSupplierPricing ? 'Basic View' : 'Compare Suppliers'}
                  </button>
                </div>

                {showSupplierPricing ? (
                  <SupplierPricingPanel
                    mpn={component.mpn}
                    manufacturer={component.manufacturer}
                    compact
                  />
                ) : (
                  <div className="space-y-3">
                    {component.unit_price !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Unit Price</span>
                        <span className="font-medium">
                          {component.currency || '$'}{component.unit_price.toFixed(4)}
                        </span>
                      </div>
                    )}
                    {component.moq !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">MOQ</span>
                        <span>{Number(component.moq).toLocaleString()}</span>
                      </div>
                    )}
                    {component.lead_time_days != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Lead Time</span>
                        <span>{component.lead_time_days} days</span>
                      </div>
                    )}
                    {component.stock_status && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Stock Status</span>
                        <span className={cn(
                          'text-sm px-2 py-0.5 rounded-full',
                          component.stock_status.toLowerCase().includes('in stock')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        )}>
                          {component.stock_status}
                        </span>
                      </div>
                    )}
                    {component.price_breaks && component.price_breaks.length > 0 && (
                      <div className="pt-2">
                        <span className="text-sm text-muted-foreground block mb-2">Price Breaks</span>
                        <div className="border rounded-md divide-y">
                          {component.price_breaks.map((pb, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2">
                              <span className="text-sm">{pb.quantity.toLocaleString()}+</span>
                              <span className="text-sm font-medium">
                                {pb.currency || component.currency || '$'}{pb.price.toFixed(4)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {component.api_source && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-sm text-muted-foreground">Data From</span>
                        <span className="text-sm capitalize">{component.api_source}</span>
                      </div>
                    )}
                    {/* CTA to show supplier comparison */}
                    <button
                      onClick={() => setShowSupplierPricing(true)}
                      className="w-full mt-3 py-2 text-sm text-center border border-dashed rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <DollarSign className="h-4 w-4 inline mr-1" />
                      Compare prices across suppliers
                    </button>
                  </div>
                )}
              </section>

              {/* Alternates */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Alternates
                  </h3>
                  {loadingAlternates && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {alternates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {loadingAlternates ? 'Loading alternates...' : 'No alternates found'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {alternates.map((alt, idx) => (
                      <AlternateCard
                        key={idx}
                        alternate={alt}
                        onSelect={onSelectAlternate}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Resources */}
              {(component.datasheet_url || component.image_url) && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Resources
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {component.datasheet_url && (
                      <a
                        href={component.datasheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted text-sm"
                      >
                        <FileText className="h-4 w-4" />
                        Datasheet
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {component.image_url && (
                      <a
                        href={component.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted text-sm"
                      >
                        <Image className="h-4 w-4" />
                        Product Image
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Compliance badge component - handles boolean (from DB) and string (legacy)
function ComplianceBadge({ value }: { value?: boolean | string | null }) {
  const status = getComplianceStatus(value);

  return (
    <div className="flex items-center gap-1">
      {status.compliant === true && <CheckCircle className="h-4 w-4 text-green-600" />}
      {status.compliant === false && <XCircle className="h-4 w-4 text-red-600" />}
      {status.compliant === null && <HelpCircle className="h-4 w-4 text-gray-400" />}
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

// Alternate card component
function AlternateCard({
  alternate,
  onSelect: _onSelect,
}: {
  alternate: AlternateComponent;
  onSelect?: (component: Component) => void;
}) {
  // Note: onSelect is available for future "select alternate" functionality
  const matchTypeColors: Record<string, string> = {
    exact: 'bg-green-100 text-green-700',
    functional: 'bg-blue-100 text-blue-700',
    form_fit: 'bg-yellow-100 text-yellow-700',
    suggested: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="border rounded-md p-3 flex items-center justify-between">
      <div>
        <div className="font-medium">{alternate.mpn}</div>
        <div className="text-sm text-muted-foreground">{alternate.manufacturer}</div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            matchTypeColors[alternate.matchType] || 'bg-gray-100 text-gray-700'
          )}
        >
          {alternate.matchType.replace('_', ' ')}
        </span>
        <span className="text-sm text-muted-foreground">{alternate.matchScore}%</span>
      </div>
    </div>
  );
}
