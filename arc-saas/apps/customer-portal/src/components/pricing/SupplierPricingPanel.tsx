/**
 * SupplierPricingPanel Component
 *
 * Comprehensive supplier pricing view for a component:
 * - Multi-supplier comparison
 * - Price break visualization
 * - Stock and lead time display
 * - Real-time pricing refresh
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  DollarSign,
  AlertCircle,
  Loader2,
  Building2,
  TrendingDown,
  Package,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useNotification } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SupplierComparison, SupplierProductData } from '@/types/supplier';
import { formatPrice, formatStock, formatLeadTime, findBestSupplier } from '@/types/supplier';
import { getComponentPricing } from '@/services/supplier.service';
import { SupplierComparisonCard } from './SupplierComparisonCard';
import { PriceBreakChart } from './PriceBreakChart';
import { StockAvailabilityBadge, LeadTimeBadge } from './StockAvailabilityBadge';

interface SupplierPricingPanelProps {
  /** Component MPN */
  mpn: string;
  /** Component manufacturer */
  manufacturer?: string;
  /** Required quantity (for BOM context) */
  requiredQuantity?: number;
  /** Pre-loaded supplier data (skip initial fetch) */
  initialData?: SupplierProductData[];
  /** Callback when pricing is loaded/refreshed */
  onPricingLoaded?: (comparison: SupplierComparison) => void;
  /** Callback when supplier is selected */
  onSelectSupplier?: (supplier: SupplierProductData) => void;
  /** Show in compact mode */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

type LoadingState = 'idle' | 'loading' | 'refreshing' | 'error';

export function SupplierPricingPanel({
  mpn,
  manufacturer,
  requiredQuantity,
  initialData,
  onPricingLoaded,
  onSelectSupplier,
  compact = false,
  className = '',
}: SupplierPricingPanelProps) {
  const { open: notify } = useNotification();
  const [loadingState, setLoadingState] = useState<LoadingState>(
    initialData ? 'idle' : 'loading'
  );
  const [comparison, setComparison] = useState<SupplierComparison | null>(
    initialData
      ? {
          mpn,
          manufacturer: manufacturer ?? '',
          suppliers: initialData,
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProductData | null>(null);

  // Fetch pricing data
  // NOTE: selectedSupplier is intentionally NOT in the dependency array
  // to prevent refetching when supplier selection changes
  const fetchPricing = useCallback(
    async (isRefresh = false) => {
      if (!mpn) return;

      setLoadingState(isRefresh ? 'refreshing' : 'loading');
      setError(null);

      try {
        const data = await getComponentPricing(mpn, manufacturer);
        setComparison(data);
        setLastRefreshed(new Date());
        onPricingLoaded?.(data);

        // Auto-select best supplier only on initial load (not refresh)
        // Use functional update to avoid stale closure
        if (data.suppliers.length > 0 && !isRefresh) {
          setSelectedSupplier((current) => {
            if (current) return current; // Keep existing selection
            return findBestSupplier(data.suppliers, 'price') ?? null;
          });
        }

        if (isRefresh) {
          notify?.({
            type: 'success',
            message: 'Pricing Refreshed',
            description: `Found ${data.suppliers.length} suppliers for ${mpn}`,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch pricing';
        setError(message);
        if (isRefresh) {
          notify?.({
            type: 'error',
            message: 'Refresh Failed',
            description: message,
          });
        }
      } finally {
        setLoadingState('idle');
      }
    },
    [mpn, manufacturer, notify, onPricingLoaded]
  );

  // Initial load
  useEffect(() => {
    if (!initialData) {
      fetchPricing(false);
    }
  }, [fetchPricing, initialData]);

  // Handle refresh
  const handleRefresh = () => {
    fetchPricing(true);
  };

  // Handle supplier selection
  const handleSelectSupplier = (supplier: SupplierProductData) => {
    setSelectedSupplier(supplier);
    onSelectSupplier?.(supplier);
  };

  // Loading skeleton
  if (loadingState === 'loading') {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (loadingState === 'error' || (error && !comparison)) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Failed to load pricing</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!comparison || comparison.suppliers.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <WifiOff className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">No Supplier Data</p>
          <p className="text-sm text-muted-foreground mb-4">
            Unable to find pricing for {mpn}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Search Suppliers
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Best options
  const bestByPrice = findBestSupplier(comparison.suppliers, 'price');
  const totalStock = comparison.total_availability ?? 0;

  // Compact view
  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Pricing</span>
              <Badge variant="outline" className="text-xs">
                {comparison.suppliers.length} suppliers
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loadingState === 'refreshing'}
              className="h-7"
            >
              {loadingState === 'refreshing' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Best Price */}
            <div>
              <p className="text-xs text-muted-foreground">Best Price</p>
              <p className="text-lg font-bold text-green-600">
                {formatPrice(bestByPrice?.unit_price, bestByPrice?.currency)}
              </p>
            </div>

            {/* Total Stock */}
            <div>
              <p className="text-xs text-muted-foreground">Total Stock</p>
              <p className="text-lg font-bold">{formatStock(totalStock)}</p>
            </div>

            {/* Lead Time */}
            <div>
              <p className="text-xs text-muted-foreground">Lead Time</p>
              <p className="text-lg font-bold">
                {formatLeadTime(bestByPrice?.lead_time_days)}
              </p>
            </div>
          </div>

          {requiredQuantity && bestByPrice && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Est. cost ({requiredQuantity.toLocaleString()} units)
                </span>
                <span className="font-bold">
                  {formatPrice(
                    (bestByPrice.unit_price ?? 0) * requiredQuantity,
                    bestByPrice.currency,
                    2
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view with tabs
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Supplier Pricing
            </CardTitle>
            <CardDescription>
              {mpn} {manufacturer && `- ${manufacturer}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wifi className="h-3 w-3" />
                      Live
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Last updated: {lastRefreshed.toLocaleTimeString()}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loadingState === 'refreshing'}
            >
              {loadingState === 'refreshing' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Best Price</p>
            <p className="text-xl font-bold text-green-600">
              {formatPrice(bestByPrice?.unit_price, bestByPrice?.currency)}
            </p>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Suppliers</p>
            <p className="text-xl font-bold text-blue-600">
              {comparison.suppliers.length}
            </p>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Stock</p>
            <p className="text-xl font-bold text-purple-600">
              {formatStock(totalStock)}
            </p>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Best Lead Time</p>
            <p className="text-xl font-bold text-orange-600">
              {formatLeadTime(bestByPrice?.lead_time_days)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Tabs defaultValue="comparison">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="comparison">
              <Building2 className="h-4 w-4 mr-2" />
              Suppliers
            </TabsTrigger>
            <TabsTrigger value="pricebreaks">
              <TrendingDown className="h-4 w-4 mr-2" />
              Price Breaks
            </TabsTrigger>
          </TabsList>

          {/* Supplier Comparison Tab */}
          <TabsContent value="comparison" className="mt-4">
            <SupplierComparisonCard
              suppliers={comparison.suppliers}
              requiredQuantity={requiredQuantity}
              detailed
              onSelectSupplier={handleSelectSupplier}
            />
          </TabsContent>

          {/* Price Breaks Tab */}
          <TabsContent value="pricebreaks" className="mt-4 space-y-4">
            {selectedSupplier ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    Price Breaks - {selectedSupplier.supplier_name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <StockAvailabilityBadge
                      quantity={selectedSupplier.availability}
                      requiredQuantity={requiredQuantity}
                      compact
                    />
                    <LeadTimeBadge days={selectedSupplier.lead_time_days} compact />
                  </div>
                </div>
                <PriceBreakChart
                  priceBreaks={selectedSupplier.price_breaks ?? []}
                  basePrice={selectedSupplier.unit_price}
                  currency={selectedSupplier.currency}
                  showCalculator
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a supplier to view price breaks
              </div>
            )}

            {/* All Suppliers Price Breaks Summary */}
            {comparison.suppliers.length > 1 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">All Suppliers</h4>
                <div className="grid gap-3">
                  {comparison.suppliers.map((supplier, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSupplier?.supplier_name === supplier.supplier_name
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedSupplier(supplier)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{supplier.supplier_name}</Badge>
                          <span className="font-medium">
                            {formatPrice(supplier.unit_price, supplier.currency)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Package className="h-4 w-4" />
                          {formatStock(supplier.availability)}
                          <Clock className="h-4 w-4 ml-2" />
                          {formatLeadTime(supplier.lead_time_days)}
                        </div>
                      </div>
                      {(supplier.price_breaks?.length ?? 0) > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {supplier.price_breaks?.length ?? 0} price breaks available
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Cost Estimate for Required Quantity */}
        {requiredQuantity && bestByPrice && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Estimated cost for {requiredQuantity.toLocaleString()} units
                </p>
                <p className="text-xs text-muted-foreground">
                  Best price from {bestByPrice.supplier_name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {formatPrice(
                    (bestByPrice.unit_price ?? 0) * requiredQuantity,
                    bestByPrice.currency,
                    2
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  @ {formatPrice(bestByPrice.unit_price, bestByPrice.currency, 4)}/unit
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SupplierPricingPanel;
