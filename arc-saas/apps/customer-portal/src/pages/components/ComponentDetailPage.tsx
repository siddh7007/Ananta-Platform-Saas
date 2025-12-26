/**
 * Component Detail Page
 * CBP-P2-003: Full-page responsive component detail view for customers
 *
 * DYNAMIC FIELD RENDERING:
 * - All fields are populated from component metadata
 * - Null/undefined values are automatically skipped (not rendered)
 * - Extra/unknown fields from API are shown in "Additional Data" section
 * - Field configuration in @/config/component-fields.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Printer,
  Package,
  Tag,
  Building2,
  Layers,
  ShieldCheck,
  Clock,
  DollarSign,
  BarChart3,
  Cpu,
  Info,
  Database,
  Truck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { getComponent, getAlternates, getMyComponent } from '@/services/component.service';
import { SupplierPricingPanel } from '@/components/pricing';
import type { Component, AlternateComponent, LifecycleStatus } from '@/types/component';
import { LIFECYCLE_CONFIG, getLifecycleColor, getComplianceStatus } from '@/types/component';
import { useOrganizationId, useTenant } from '@/contexts/TenantContext';
import {
  getFieldValue,
  hasValue,
  formatFieldValue,
  getDisplayableFields,
  getExtraFields,
  formatKeyLabel,
  type FieldMeta,
  type FieldSection,
  SECTION_CONFIG,
} from '@/config/component-fields';

// Section definitions for navigation
const SECTIONS = [
  { id: 'hero', label: 'Overview', icon: <Info className="h-3.5 w-3.5" /> },
  { id: 'specifications', label: 'Specs', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'compliance', label: 'Compliance', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'pricing', label: 'Pricing', icon: <DollarSign className="h-3.5 w-3.5" /> },
  { id: 'suppliers', label: 'Suppliers', icon: <Truck className="h-3.5 w-3.5" /> },
  { id: 'alternates', label: 'Alternates', icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { id: 'resources', label: 'Resources', icon: <FileText className="h-3.5 w-3.5" /> },
] as const;

// Icon mapping for dynamic rendering
const ICON_MAP: Record<string, React.ReactNode> = {
  Package: <Package className="h-3.5 w-3.5" />,
  Building2: <Building2 className="h-3.5 w-3.5" />,
  Clock: <Clock className="h-3.5 w-3.5" />,
  Tag: <Tag className="h-4 w-4" />,
  Layers: <Layers className="h-4 w-4" />,
  ShieldCheck: <ShieldCheck className="h-4 w-4" />,
  DollarSign: <DollarSign className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  Database: <Database className="h-4 w-4" />,
};

/**
 * Main Component Detail Page
 */
export function ComponentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const organizationId = useOrganizationId();
  const { isLoading: tenantLoading } = useTenant();
  const [copiedMpn, setCopiedMpn] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [showRawData, setShowRawData] = useState(false);
  const source = searchParams.get('source');
  const isMyComponents = source === 'my-components';

  // Fetch component data
  const {
    data: component,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['component', id, source, organizationId],
    queryFn: async () => {
      console.log('[ComponentDetail] Fetching component:', { id, source, organizationId });
      try {
        let result: Component;
        if (isMyComponents) {
          if (!organizationId) {
            throw new Error('Organization context is required to load BOM components.');
          }
          result = await getMyComponent(id!, organizationId);
        } else {
          result = await getComponent(id!);
        }
        console.log('[ComponentDetail] Loaded component:', result);
        return result;
      } catch (err) {
        console.error('[ComponentDetail] Failed to load component:', err);
        throw err;
      }
    },
    enabled: !!id && (!isMyComponents || !!organizationId),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch alternates
  const {
    data: alternates = [],
    isLoading: loadingAlternates,
  } = useQuery({
    queryKey: ['component-alternates', component?.mpn, component?.manufacturer],
    queryFn: () => getAlternates(component!.mpn, component?.manufacturer),
    enabled: !!component?.mpn,
    staleTime: 10 * 60 * 1000,
  });

  // Intersection observer for active section tracking
  useEffect(() => {
    if (!component) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -50% 0px',
        threshold: 0,
      }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [component]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/components/search');
    }
  }, [navigate]);

  const copyMpn = useCallback(async () => {
    if (!component) return;
    try {
      await navigator.clipboard.writeText(component.mpn);
      setCopiedMpn(true);
      setTimeout(() => setCopiedMpn(false), 2000);
    } catch (error) {
      console.error('Failed to copy MPN:', error);
    }
  }, [component]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Loading state
  if (isLoading || (isMyComponents && tenantLoading)) {
    return <ComponentDetailSkeleton />;
  }

  // Error state
  if (error || !component) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Component Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {error ? `Failed to load component: ${(error as Error).message}` : 'The requested component could not be found.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleBack}>
                Go Back
              </Button>
              <Button onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b print:static print:border-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={handleBack} className="print:hidden h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold truncate">{component.mpn}</h1>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 print:hidden"
                        onClick={copyMpn}
                      >
                        {copiedMpn ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copiedMpn ? 'Copied!' : 'Copy MPN'}</TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {component.manufacturer}
                  {component.category && ` • ${component.category}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 print:hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrint}>
                    <Printer className="h-4 w-4" />
                    <span className="sr-only">Print</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Print</TooltipContent>
              </Tooltip>
              {component.datasheet_url && (
                <a href={component.datasheet_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-8">
                    <FileText className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline text-xs">Datasheet</span>
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Section Navigation */}
          <div className="mt-2 -mx-1 print:hidden">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-1.5 px-1 pb-2">
                {SECTIONS.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      'border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      activeSection === id
                        ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                        : 'bg-background text-muted-foreground border-border'
                    )}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Section */}
        <section id="hero">
          <HeroSection component={component} />
        </section>

        {/* Dynamic Specifications Section */}
        <section id="specifications">
          <DynamicFieldSection
            component={component}
            section="specifications"
            title="Specifications"
            icon={<Layers className="h-4 w-4" />}
            showSpecs
          />
        </section>

        {/* Dynamic Compliance Section */}
        <section id="compliance">
          <DynamicFieldSection
            component={component}
            section="compliance"
            title="Compliance & Lifecycle"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
        </section>

        {/* Dynamic Pricing Section */}
        <section id="pricing">
          <DynamicPricingSection component={component} />
        </section>

        {/* Supplier Comparison */}
        <section id="suppliers">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Supplier Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SupplierPricingPanel mpn={component.mpn} manufacturer={component.manufacturer} />
            </CardContent>
          </Card>
        </section>

        {/* Alternates */}
        <section id="alternates">
          <AlternatesSection alternates={alternates} loading={loadingAlternates} />
        </section>

        {/* Resources */}
        <section id="resources">
          {(component.datasheet_url || component.image_url) && (
            <ResourcesSection
              datasheetUrl={component.datasheet_url}
              imageUrl={component.image_url}
            />
          )}
        </section>

        {/* Extra/Unknown Fields */}
        <ExtraFieldsSection component={component} />

        {/* Raw Data Debug (Collapsible) */}
        <Collapsible open={showRawData} onOpenChange={setShowRawData}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Raw Component Data
                  </CardTitle>
                  {showRawData ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                  {JSON.stringify(component, null, 2)}
                </pre>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </main>
    </div>
  );
}

// ============================================================================
// Dynamic Field Rendering Components
// ============================================================================

/**
 * Hero Section - Component Image + Basic Info + Dynamic Quick Stats
 */
function HeroSection({ component }: { component: Component }) {
  const overviewFields = getDisplayableFields(component, 'overview');

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Component Image */}
          <div className="md:col-span-3">
            <div className="w-full aspect-square max-w-[200px] mx-auto md:mx-0 flex items-center justify-center bg-muted/50 rounded-lg overflow-hidden border">
              {component.image_url ? (
                <img
                  src={component.image_url}
                  alt={component.mpn}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={cn('flex flex-col items-center text-muted-foreground', component.image_url && 'hidden')}>
                <Cpu className="h-16 w-16 mb-2" />
                <span className="text-xs">No Image</span>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="md:col-span-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {component.manufacturer || 'Unknown Manufacturer'}
            </div>
            <h2 className="text-2xl font-bold mb-2">{component.mpn}</h2>
            {component.description && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {component.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {component.category && (
                <Badge variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {component.category}
                </Badge>
              )}
              {component.subcategory && (
                <Badge variant="outline" className="text-xs">
                  {component.subcategory}
                </Badge>
              )}
              {component.package && (
                <Badge variant="outline" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  {component.package}
                </Badge>
              )}
            </div>
          </div>

          {/* Dynamic Quick Stats Panel */}
          <div className="md:col-span-4">
            <Card className="border bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick Stats
                </div>

                {overviewFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stats available</p>
                ) : (
                  overviewFields.map(({ meta, value }) => (
                    <DynamicFieldRow
                      key={meta.key}
                      meta={meta}
                      value={value}
                      component={component}
                      variant="stat"
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dynamic Field Section - Renders fields for a given section
 */
function DynamicFieldSection({
  component,
  section,
  title,
  icon,
  showSpecs = false,
}: {
  component: Component;
  section: FieldSection;
  title: string;
  icon: React.ReactNode;
  showSpecs?: boolean;
}) {
  const fields = getDisplayableFields(component, section);

  // Also show specifications object if showSpecs is true
  const specs = showSpecs && component.specifications ? Object.entries(component.specifications) : [];
  const extractedSpecs = showSpecs && component.extracted_specs ? Object.entries(component.extracted_specs) : [];

  if (fields.length === 0 && specs.length === 0 && extractedSpecs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Render configured fields */}
        {fields.map(({ meta, value }) => (
          <DynamicFieldRow
            key={meta.key}
            meta={meta}
            value={value}
            component={component}
          />
        ))}

        {/* Render specifications object */}
        {specs.length > 0 && (
          <>
            {fields.length > 0 && <Separator className="my-4" />}
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Technical Specifications
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {specs.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{formatKeyLabel(key)}</span>
                  <span className="text-sm font-medium text-right max-w-[60%] truncate">
                    {formatSpecValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Render extracted specs */}
        {extractedSpecs.length > 0 && (
          <>
            {(fields.length > 0 || specs.length > 0) && <Separator className="my-4" />}
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Extracted Specifications
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {extractedSpecs.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{formatKeyLabel(key)}</span>
                  <span className="text-sm font-medium text-right max-w-[60%] truncate">
                    {formatSpecValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Dynamic Pricing Section - Special handling for price breaks
 */
function DynamicPricingSection({ component }: { component: Component }) {
  const fields = getDisplayableFields(component, 'pricing');
  const priceBreaks = component.price_breaks;

  if (fields.length === 0 && (!priceBreaks || priceBreaks.length === 0)) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing & Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pricing information available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Pricing & Availability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Key metrics */}
          <div className="space-y-3">
            {fields.map(({ meta, value }) => (
              <DynamicFieldRow
                key={`pricing-${meta.key}`}
                meta={meta}
                value={value}
                component={component}
              />
            ))}
          </div>

          {/* Right: Price breaks */}
          {priceBreaks && priceBreaks.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground block mb-2">Price Breaks</span>
              <div className="border rounded-md divide-y">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                  <span>Quantity</span>
                  <span>Unit Price</span>
                </div>
                {priceBreaks.map((pb, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm">
                      {hasValue(pb.quantity) ? Number(pb.quantity).toLocaleString() : '—'}+
                    </span>
                    <span className="text-sm font-medium">
                      {pb.currency || component.currency || '$'}
                      {hasValue(pb.price) ? Number(pb.price).toFixed(4) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dynamic Field Row - Renders a single field with proper formatting
 */
function DynamicFieldRow({
  meta,
  value,
  component,
  variant = 'default',
}: {
  meta: FieldMeta;
  value: unknown;
  component: Component;
  variant?: 'default' | 'stat';
}) {
  const icon = meta.icon ? ICON_MAP[meta.icon] : null;

  // Special rendering for different field types
  switch (meta.type) {
    case 'lifecycle':
      return (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{meta.label}</span>
          <LifecycleBadge status={value as LifecycleStatus | undefined} />
        </div>
      );

    case 'risk':
      return (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{meta.label}</span>
          <RiskBadge level={value as 'low' | 'medium' | 'high' | 'critical'} />
        </div>
      );

    case 'compliance':
      return <ComplianceItem label={meta.label} value={value as boolean | string | null} />;

    case 'percentage':
      // Quality score with progress bar
      if (meta.key === 'quality_score' && variant === 'stat') {
        const score = Number(value) || 0;
        return (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{meta.label}</span>
              <span
                className={cn(
                  'text-sm font-bold',
                  score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
                )}
              >
                {score.toFixed(0)}/100
              </span>
            </div>
            <Progress
              value={score}
              className={cn(
                'h-2',
                score >= 80
                  ? '[&>div]:bg-green-500'
                  : score >= 60
                    ? '[&>div]:bg-yellow-500'
                    : '[&>div]:bg-red-500'
              )}
            />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            {icon}
            {meta.label}
          </span>
          <span className="text-sm font-medium">{formatFieldValue(value, meta, component)}/100</span>
        </div>
      );

    case 'currency':
      if (variant === 'stat') {
        return (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">{meta.label}</span>
            <span className="text-lg font-bold text-primary">
              {formatFieldValue(value, meta, component)}
            </span>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{meta.label}</span>
          <span className="text-lg font-semibold">{formatFieldValue(value, meta, component)}</span>
        </div>
      );

    case 'badge':
      const isInStock = String(value).toLowerCase().includes('in stock');
      return (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{meta.label}</span>
          <Badge
            variant={isInStock ? 'default' : 'secondary'}
            className={cn(
              'text-xs',
              isInStock ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''
            )}
          >
            {String(value)}
          </Badge>
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            {icon}
            {meta.label}
          </span>
          <span className="text-sm font-medium">{formatFieldValue(value, meta, component)}</span>
        </div>
      );
  }
}

/**
 * Extra Fields Section - Shows fields not in the standard config
 */
function ExtraFieldsSection({ component }: { component: Component }) {
  const extraFields = getExtraFields(component);

  if (extraFields.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" />
          Additional Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
          {extraFields.map(({ key, value }) => (
            <div key={key} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{formatKeyLabel(key)}</span>
              <span className="text-sm font-medium text-right max-w-[60%] truncate">
                {formatSpecValue(value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function LifecycleBadge({ status }: { status?: LifecycleStatus }) {
  const config = status ? LIFECYCLE_CONFIG[status] : null;
  const icon = getLifecycleIcon(status);

  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className={cn('text-sm px-2 py-0.5 rounded-full', getLifecycleColor(status))}>
        {config?.label ?? 'Unknown'}
      </span>
    </div>
  );
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' | 'critical' }) {
  const config = {
    low: { bg: 'bg-green-100 text-green-700', label: 'Low' },
    medium: { bg: 'bg-yellow-100 text-yellow-700', label: 'Medium' },
    high: { bg: 'bg-orange-100 text-orange-700', label: 'High' },
    critical: { bg: 'bg-red-100 text-red-700', label: 'Critical' },
  };

  const { bg, label } = config[level] || config.medium;
  return <span className={cn('text-sm px-2 py-0.5 rounded-full', bg)}>{label}</span>;
}

function ComplianceItem({ label, value }: { label: string; value?: boolean | string | null }) {
  const status = getComplianceStatus(value);

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
      {status.compliant === true && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
      {status.compliant === false && <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
      {status.compliant === null && <HelpCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            'text-sm font-medium truncate',
            status.compliant === true && 'text-green-700',
            status.compliant === false && 'text-red-700',
            status.compliant === null && 'text-muted-foreground'
          )}
        >
          {status.label}
        </div>
      </div>
    </div>
  );
}

function AlternatesSection({
  alternates,
  loading,
}: {
  alternates: AlternateComponent[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Alternates
          </CardTitle>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading alternates...</div>
        ) : alternates.length === 0 ? (
          <div className="text-sm text-muted-foreground">No alternates found</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {alternates.map((alt, idx) => (
              <AlternateCard key={idx} alternate={alt} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlternateCard({ alternate }: { alternate: AlternateComponent }) {
  const matchTypeColors: Record<string, string> = {
    exact: 'bg-green-100 text-green-700',
    functional: 'bg-blue-100 text-blue-700',
    form_fit: 'bg-yellow-100 text-yellow-700',
    suggested: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="flex-shrink-0 w-48 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
      <div className="font-medium truncate">{alternate.mpn}</div>
      <div className="text-sm text-muted-foreground truncate mb-2">{alternate.manufacturer}</div>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            matchTypeColors[alternate.matchType] || 'bg-gray-100 text-gray-700'
          )}
        >
          {alternate.matchType.replace('_', ' ')}
        </span>
        <span className="text-sm font-medium text-muted-foreground">{alternate.matchScore}%</span>
      </div>
    </div>
  );
}

function ResourcesSection({
  datasheetUrl,
  imageUrl,
}: {
  datasheetUrl?: string;
  imageUrl?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Resources
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {datasheetUrl && (
            <a
              href={datasheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 border rounded-lg hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-sm font-medium">Datasheet</div>
                <div className="text-xs text-muted-foreground">View PDF</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 ml-2 text-muted-foreground" />
            </a>
          )}
          {imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 border rounded-lg hover:bg-muted transition-colors"
            >
              <ImageIcon className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-medium">Product Image</div>
                <div className="text-xs text-muted-foreground">View Image</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 ml-2 text-muted-foreground" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ComponentDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}

export default ComponentDetailPage;
