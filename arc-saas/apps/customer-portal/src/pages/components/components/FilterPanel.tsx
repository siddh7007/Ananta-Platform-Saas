/**
 * Filter Panel Component
 * CBP-P2-002: Comprehensive filters for Component Vault Search
 */

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Leaf,
  Car,
  Flame,
  Package,
  DollarSign,
  Truck,
  Database,
  Star,
  AlertOctagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SearchFilters, type SearchFacets } from '@/hooks/useComponentSearch';

// ============================================================================
// Constants
// ============================================================================

const LIFECYCLE_OPTIONS = [
  { value: 'active', label: 'Active', icon: CheckCircle, color: 'text-green-600' },
  { value: 'nrnd', label: 'NRND', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'obsolete', label: 'Obsolete', icon: XCircle, color: 'text-red-600' },
  { value: 'eol', label: 'EOL', icon: XCircle, color: 'text-red-500' },
  { value: 'unknown', label: 'Unknown', icon: Clock, color: 'text-gray-500' },
] as const;

const ENRICHMENT_STATUS_OPTIONS = [
  { value: 'production', label: 'Production Ready', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'staging', label: 'Staging', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
] as const;

const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'medium', label: 'Medium Risk', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'high', label: 'High Risk', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'critical', label: 'Critical Risk', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
] as const;

const DATA_SOURCE_OPTIONS = [
  { value: 'mouser', label: 'Mouser' },
  { value: 'digikey', label: 'DigiKey' },
  { value: 'element14', label: 'Element14' },
  { value: 'newark', label: 'Newark' },
  { value: 'octopart', label: 'Octopart' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'avnet', label: 'Avnet' },
] as const;

const COMMON_PACKAGES = [
  '0201', '0402', '0603', '0805', '1206', '1210', '2512',
  'SOT-23', 'SOT-223', 'SOT-363',
  'SOIC-8', 'SOIC-14', 'SOIC-16',
  'QFN-16', 'QFN-24', 'QFN-32', 'QFN-48',
  'QFP-32', 'QFP-44', 'QFP-64', 'QFP-100',
  'LQFP-32', 'LQFP-48', 'LQFP-64', 'LQFP-100',
  'BGA-256', 'BGA-324',
  'TO-92', 'TO-220', 'TO-252', 'TO-263',
];

// ============================================================================
// Component
// ============================================================================

interface FilterPanelProps {
  facets: SearchFacets;
  filters: SearchFilters;
  onChange: (key: string, value: unknown) => void;
  onClear: () => void;
}

export function FilterPanel({ facets, filters, onChange, onClear }: FilterPanelProps) {
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'sortBy' || key === 'sortOrder') return false;
    if (value === undefined || value === null || value === false) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;

  const filteredManufacturers = facets.manufacturers?.filter(
    (m) =>
      !manufacturerSearch ||
      m.label.toLowerCase().includes(manufacturerSearch.toLowerCase())
  );

  const filteredCategories = facets.categories?.filter(
    (c) =>
      !categorySearch ||
      c.label.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Component Vault Filters</h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all ({activeFilterCount})
          </Button>
        )}
      </div>

      <Accordion
        type="multiple"
        defaultValue={['lifecycle', 'quality', 'compliance', 'supply']}
        className="w-full"
      >
        {/* ================================================================
            LIFECYCLE & QUALITY SECTION
        ================================================================ */}
        <AccordionItem value="lifecycle">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Lifecycle Status
              {filters.lifecycleStatuses && filters.lifecycleStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {filters.lifecycleStatuses.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {LIFECYCLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-2"
                >
                  <Checkbox
                    checked={filters.lifecycleStatuses?.includes(opt.value) ?? false}
                    onCheckedChange={(checked) => {
                      const current = filters.lifecycleStatuses ?? [];
                      onChange(
                        'lifecycleStatuses',
                        checked
                          ? [...current, opt.value]
                          : current.filter((v) => v !== opt.value)
                      );
                    }}
                  />
                  <opt.icon className={cn('h-4 w-4', opt.color)} />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Quality Score */}
        <AccordionItem value="quality">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Quality Score
              {(filters.qualityScoreMin !== undefined || filters.qualityScoreMax !== undefined) && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {filters.qualityScoreMin ?? 0}-{filters.qualityScoreMax ?? 100}%
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 px-1">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{filters.qualityScoreMin ?? 0}%</span>
                <span>{filters.qualityScoreMax ?? 100}%</span>
              </div>
              <Slider
                value={[filters.qualityScoreMin ?? 0, filters.qualityScoreMax ?? 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={([min, max]) => {
                  onChange('qualityScoreMin', min > 0 ? min : undefined);
                  onChange('qualityScoreMax', max < 100 ? max : undefined);
                }}
                className="w-full"
              />
              <div className="flex gap-2">
                {[70, 80, 90, 95].map((score) => (
                  <Button
                    key={score}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => onChange('qualityScoreMin', score)}
                  >
                    {score}%+
                  </Button>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Enrichment Status */}
        <AccordionItem value="enrichment">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Enrichment Status
              {filters.enrichmentStatus && filters.enrichmentStatus.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {filters.enrichmentStatus.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {ENRICHMENT_STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'text-xs',
                    filters.enrichmentStatus?.includes(opt.value) && opt.color
                  )}
                  onClick={() => {
                    const current = filters.enrichmentStatus ?? [];
                    onChange(
                      'enrichmentStatus',
                      current.includes(opt.value)
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value]
                    );
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================
            COMPLIANCE SECTION
        ================================================================ */}
        <AccordionItem value="compliance">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Compliance & Certifications
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {/* RoHS */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-green-600" />
                  <Label htmlFor="rohs" className="text-sm cursor-pointer">
                    RoHS Compliant
                  </Label>
                </div>
                <Switch
                  id="rohs"
                  checked={filters.rohsCompliant ?? false}
                  onCheckedChange={(v) => onChange('rohsCompliant', v || undefined)}
                />
              </div>

              {/* REACH */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-blue-600" />
                  <Label htmlFor="reach" className="text-sm cursor-pointer">
                    REACH Compliant
                  </Label>
                </div>
                <Switch
                  id="reach"
                  checked={filters.reachCompliant ?? false}
                  onCheckedChange={(v) => onChange('reachCompliant', v || undefined)}
                />
              </div>

              {/* AEC-Q Qualified */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-purple-600" />
                  <Label htmlFor="aec" className="text-sm cursor-pointer">
                    AEC-Q Qualified (Automotive)
                  </Label>
                </div>
                <Switch
                  id="aec"
                  checked={filters.aecQualified ?? false}
                  onCheckedChange={(v) => onChange('aecQualified', v || undefined)}
                />
              </div>

              {/* Halogen-Free */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-600" />
                  <Label htmlFor="halogen" className="text-sm cursor-pointer">
                    Halogen-Free
                  </Label>
                </div>
                <Switch
                  id="halogen"
                  checked={filters.halogenFree ?? false}
                  onCheckedChange={(v) => onChange('halogenFree', v || undefined)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================
            SUPPLY CHAIN SECTION
        ================================================================ */}
        <AccordionItem value="supply">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Supply Chain
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {/* In Stock Only */}
              <div className="flex items-center justify-between">
                <Label htmlFor="instock" className="text-sm cursor-pointer">
                  In Stock Only
                </Label>
                <Switch
                  id="instock"
                  checked={filters.inStockOnly ?? false}
                  onCheckedChange={(v) => onChange('inStockOnly', v || undefined)}
                />
              </div>

              <Separator />

              {/* Lead Time */}
              <div className="space-y-2">
                <Label className="text-sm">Max Lead Time</Label>
                <div className="flex flex-wrap gap-2">
                  {[7, 14, 30, 60, 90].map((days) => (
                    <Button
                      key={days}
                      variant={filters.leadTimeDaysMax === days ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        onChange('leadTimeDaysMax', filters.leadTimeDaysMax === days ? undefined : days)
                      }
                    >
                      {days <= 7 ? `${days}d` : `${days / 7}w`}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Price Range */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Price Range (USD)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin ?? ''}
                    onChange={(e) =>
                      onChange('priceMin', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-24"
                    min={0}
                    step={0.01}
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax ?? ''}
                    onChange={(e) =>
                      onChange('priceMax', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-24"
                    min={0}
                    step={0.01}
                  />
                </div>
              </div>

              <Separator />

              {/* MOQ */}
              <div className="space-y-2">
                <Label className="text-sm">Max MOQ (Minimum Order Qty)</Label>
                <div className="flex flex-wrap gap-2">
                  {[1, 10, 100, 1000, 5000].map((qty) => (
                    <Button
                      key={qty}
                      variant={filters.moqMax === qty ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        onChange('moqMax', filters.moqMax === qty ? undefined : qty)
                      }
                    >
                      ≤{qty >= 1000 ? `${qty / 1000}k` : qty}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================
            RISK SECTION
        ================================================================ */}
        <AccordionItem value="risk">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4" />
              Risk Level
              {filters.riskLevels && filters.riskLevels.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {filters.riskLevels.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {/* Enable Risk Data */}
              <div className="flex items-center justify-between pb-2">
                <Label htmlFor="includerisk" className="text-sm cursor-pointer">
                  Include Risk Analysis
                </Label>
                <Switch
                  id="includerisk"
                  checked={filters.includeRisk ?? false}
                  onCheckedChange={(v) => onChange('includeRisk', v || undefined)}
                />
              </div>

              {filters.includeRisk && (
                <div className="flex flex-wrap gap-2">
                  {RISK_LEVEL_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant="outline"
                      size="sm"
                      className={cn(
                        'text-xs',
                        filters.riskLevels?.includes(opt.value) && opt.color
                      )}
                      onClick={() => {
                        const current = filters.riskLevels ?? [];
                        onChange(
                          'riskLevels',
                          current.includes(opt.value)
                            ? current.filter((v) => v !== opt.value)
                            : [...current, opt.value]
                        );
                      }}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================
            DATA SOURCES SECTION
        ================================================================ */}
        <AccordionItem value="datasources">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Sources (Suppliers)
              {filters.dataSources && filters.dataSources.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {filters.dataSources.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {DATA_SOURCE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-2"
                >
                  <Checkbox
                    checked={filters.dataSources?.includes(opt.value) ?? false}
                    onCheckedChange={(checked) => {
                      const current = filters.dataSources ?? [];
                      onChange(
                        'dataSources',
                        checked
                          ? [...current, opt.value]
                          : current.filter((v) => v !== opt.value)
                      );
                    }}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================
            CATEGORY SECTION
        ================================================================ */}
        <AccordionItem value="category">
          <AccordionTrigger className="text-sm font-medium">
            Category
            {filters.categories && filters.categories.length > 0 && (
              <Badge variant="secondary" className="ml-auto mr-2">
                {filters.categories.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <Input
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className="mb-2"
              aria-label="Filter categories"
            />
            <ScrollArea className="h-48">
              <div className="space-y-2 pr-4">
                {filteredCategories?.map((cat) => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1"
                  >
                    <Checkbox
                      checked={filters.categories?.includes(cat.value) ?? false}
                      onCheckedChange={(checked) => {
                        const current = filters.categories ?? [];
                        onChange(
                          'categories',
                          checked
                            ? [...current, cat.value]
                            : current.filter((c) => c !== cat.value)
                        );
                      }}
                    />
                    <span className="text-sm flex-1 truncate">{cat.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {cat.count.toLocaleString()}
                    </span>
                  </label>
                ))}
                {(!filteredCategories || filteredCategories.length === 0) && (
                  <p className="text-sm text-muted-foreground py-2">
                    {categorySearch ? 'No categories found' : 'Search to see categories'}
                  </p>
                )}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================
            MANUFACTURER SECTION
        ================================================================ */}
        <AccordionItem value="manufacturer">
          <AccordionTrigger className="text-sm font-medium">
            Manufacturer
            {filters.manufacturers && filters.manufacturers.length > 0 && (
              <Badge variant="secondary" className="ml-auto mr-2">
                {filters.manufacturers.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <Input
              placeholder="Search manufacturers..."
              value={manufacturerSearch}
              onChange={(e) => setManufacturerSearch(e.target.value)}
              className="mb-2"
              aria-label="Filter manufacturers"
            />
            <ScrollArea className="h-48">
              <div className="space-y-2 pr-4">
                {filteredManufacturers?.map((mfr) => (
                  <label
                    key={mfr.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1"
                  >
                    <Checkbox
                      checked={filters.manufacturers?.includes(mfr.value) ?? false}
                      onCheckedChange={(checked) => {
                        const current = filters.manufacturers ?? [];
                        onChange(
                          'manufacturers',
                          checked
                            ? [...current, mfr.value]
                            : current.filter((m) => m !== mfr.value)
                        );
                      }}
                    />
                    <span className="text-sm flex-1 truncate">{mfr.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {mfr.count.toLocaleString()}
                    </span>
                  </label>
                ))}
                {(!filteredManufacturers || filteredManufacturers.length === 0) && (
                  <p className="text-sm text-muted-foreground py-2">
                    {manufacturerSearch ? 'No manufacturers found' : 'Search to see manufacturers'}
                  </p>
                )}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================
            PACKAGE/FOOTPRINT SECTION
        ================================================================ */}
        <AccordionItem value="package">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Package/Footprint
              {filters.packages && filters.packages.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-2">
                  {filters.packages.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-64">
              <div className="flex flex-wrap gap-2 pr-4">
                {COMMON_PACKAGES.map((pkg) => (
                  <Button
                    key={pkg}
                    variant={filters.packages?.includes(pkg) ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const current = filters.packages ?? [];
                      onChange(
                        'packages',
                        current.includes(pkg)
                          ? current.filter((p) => p !== pkg)
                          : [...current, pkg]
                      );
                    }}
                    aria-pressed={filters.packages?.includes(pkg) ?? false}
                  >
                    {pkg}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default FilterPanel;
