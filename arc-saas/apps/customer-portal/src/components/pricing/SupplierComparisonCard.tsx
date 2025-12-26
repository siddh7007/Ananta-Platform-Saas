/**
 * SupplierComparisonCard Component
 *
 * Side-by-side comparison of pricing from multiple suppliers:
 * - Price comparison table
 * - Stock availability
 * - Lead times
 * - Best option recommendation
 */

import { useMemo } from 'react';
import {
  Building2,
  Crown,
  ExternalLink,
  TrendingDown,
  Package,
  Check,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SupplierProductData } from '@/types/supplier';
import {
  getSupplierConfig,
  formatPrice,
  formatStock,
  formatLeadTime,
  findBestSupplier,
  findBestSupplierForQuantity,
} from '@/types/supplier';
import { StockAvailabilityBadge } from './StockAvailabilityBadge';
import { PriceBreaksInline } from './PriceBreakChart';

interface SupplierComparisonCardProps {
  /** Supplier data to compare */
  suppliers: SupplierProductData[];
  /** Required quantity (for stock comparison) */
  requiredQuantity?: number;
  /** Component MPN (for display) */
  mpn?: string;
  /** Component manufacturer */
  manufacturer?: string;
  /** Show detailed view */
  detailed?: boolean;
  /** Callback when supplier is selected */
  onSelectSupplier?: (supplier: SupplierProductData) => void;
  /** Additional class names */
  className?: string;
}

export function SupplierComparisonCard({
  suppliers,
  requiredQuantity,
  mpn,
  manufacturer,
  detailed = false,
  onSelectSupplier,
  className = '',
}: SupplierComparisonCardProps) {
  // Find best supplier by different criteria
  const bestByPrice = useMemo(
    () => findBestSupplier(suppliers, 'price'),
    [suppliers]
  );
  const bestByLeadTime = useMemo(
    () => findBestSupplier(suppliers, 'lead_time'),
    [suppliers]
  );

  // Check for mixed currencies - warn if suppliers have different currencies
  const currencyInfo = useMemo(() => {
    const pricedSuppliers = suppliers.filter(
      (s) => s.unit_price !== undefined && s.unit_price !== null
    );
    if (pricedSuppliers.length === 0) return { currencies: [], hasMixedCurrencies: false };

    const currencies = [...new Set(pricedSuppliers.map((s) => s.currency ?? 'USD'))];
    return {
      currencies,
      hasMixedCurrencies: currencies.length > 1,
      primaryCurrency: currencies[0],
    };
  }, [suppliers]);

  // Calculate price range with currency from first priced supplier
  // Note: If mixed currencies, range comparison is not meaningful
  const priceRange = useMemo(() => {
    const pricedSuppliers = suppliers.filter(
      (s) => s.unit_price !== undefined && s.unit_price !== null
    );

    if (pricedSuppliers.length === 0) return null;

    // If mixed currencies, only show range for primary currency
    const suppliersToCompare = currencyInfo.hasMixedCurrencies
      ? pricedSuppliers.filter((s) => (s.currency ?? 'USD') === currencyInfo.primaryCurrency)
      : pricedSuppliers;

    if (suppliersToCompare.length === 0) return null;

    const prices = suppliersToCompare.map((s) => s.unit_price as number);
    const minPrice = Math.min(...prices);
    const minPriceSupplier = suppliersToCompare.find((s) => s.unit_price === minPrice);

    return {
      min: minPrice,
      max: Math.max(...prices),
      spread: Math.max(...prices) - minPrice,
      spreadPercent:
        minPrice > 0
          ? Math.round(((Math.max(...prices) - minPrice) / minPrice) * 100)
          : 0,
      currency: minPriceSupplier?.currency ?? 'USD',
    };
  }, [suppliers, currencyInfo]);

  // Find best supplier considering required quantity, stock, and currency
  // Uses the currency-aware findBestSupplierForQuantity utility
  const bestOptionForQuantity = useMemo(() => {
    if (!requiredQuantity) return null;

    // Use the primary currency from the price range calculation for consistency
    const preferredCurrency = currencyInfo.primaryCurrency ?? 'USD';
    return findBestSupplierForQuantity(suppliers, requiredQuantity, preferredCurrency);
  }, [suppliers, requiredQuantity, currencyInfo.primaryCurrency]);

  // Total available stock
  const totalStock = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.availability ?? 0), 0),
    [suppliers]
  );

  if (!suppliers || suppliers.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No supplier data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Supplier Comparison
            </CardTitle>
            {mpn && (
              <CardDescription>
                {mpn} {manufacturer && `- ${manufacturer}`}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{suppliers.length} suppliers</Badge>
            {totalStock > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Package className="h-3 w-3 mr-1" />
                {formatStock(totalStock)} total
              </Badge>
            )}
          </div>
        </div>

        {/* Mixed Currency Warning */}
        {currencyInfo.hasMixedCurrencies && (
          <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">
            <AlertCircle className="h-4 w-4" />
            <span>
              Mixed currencies: {currencyInfo.currencies.join(', ')} - prices not directly comparable
            </span>
          </div>
        )}

        {/* Price Range Summary */}
        {priceRange && priceRange.spread > 0 && !currencyInfo.hasMixedCurrencies && (
          <div className="flex items-center gap-2 mt-2 text-sm">
            <TrendingDown className="h-4 w-4 text-green-600" />
            <span>
              Price range: {formatPrice(priceRange.min, priceRange.currency)} -{' '}
              {formatPrice(priceRange.max, priceRange.currency)}
            </span>
            <span className="text-muted-foreground">
              ({priceRange.spreadPercent}% spread)
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              {detailed && <TableHead>Price Breaks</TableHead>}
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Lead Time</TableHead>
              {onSelectSupplier && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier, idx) => {
              const config = getSupplierConfig(supplier.supplier_name);
              const isBestPrice =
                bestByPrice?.supplier_name === supplier.supplier_name;
              const isBestLeadTime =
                bestByLeadTime?.supplier_name === supplier.supplier_name;
              const meetsQty =
                requiredQuantity && supplier.availability
                  ? supplier.availability >= requiredQuantity
                  : null;

              return (
                <TableRow
                  key={idx}
                  className={isBestPrice ? 'bg-green-50/50' : ''}
                >
                  {/* Supplier */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${config.bgColor} ${config.color} ${config.borderColor}`}
                      >
                        {config.shortName}
                      </Badge>
                      <div>
                        <div className="font-medium flex items-center gap-1">
                          {config.displayName}
                          {isBestPrice && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Crown className="h-3 w-3 text-yellow-500" />
                                </TooltipTrigger>
                                <TooltipContent>Best Price</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {supplier.supplier_sku && (
                          <div className="text-xs text-muted-foreground">
                            SKU: {supplier.supplier_sku}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Unit Price */}
                  <TableCell className="text-right">
                    <div
                      className={`font-bold ${
                        isBestPrice ? 'text-green-600' : ''
                      }`}
                    >
                      {formatPrice(supplier.unit_price, supplier.currency)}
                    </div>
                    {supplier.moq && supplier.moq > 1 && (
                      <div className="text-xs text-muted-foreground">
                        MOQ: {supplier.moq.toLocaleString()}
                      </div>
                    )}
                  </TableCell>

                  {/* Price Breaks (detailed view) */}
                  {detailed && (
                    <TableCell>
                      <PriceBreaksInline
                        priceBreaks={supplier.price_breaks ?? []}
                        currency={supplier.currency}
                      />
                    </TableCell>
                  )}

                  {/* Stock */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <StockAvailabilityBadge
                        quantity={supplier.availability}
                        requiredQuantity={requiredQuantity}
                        compact
                      />
                      {meetsQty !== null && (
                        <span
                          className={`text-xs ${
                            meetsQty ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {meetsQty ? (
                            <Check className="h-3 w-3 inline" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Lead Time */}
                  <TableCell className="text-center">
                    <div
                      className={`text-sm ${
                        isBestLeadTime ? 'text-green-600 font-medium' : ''
                      }`}
                    >
                      {formatLeadTime(supplier.lead_time_days)}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  {onSelectSupplier && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {supplier.supplier_url && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() =>
                                    window.open(supplier.supplier_url, '_blank')
                                  }
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View on supplier site</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => onSelectSupplier(supplier)}
                        >
                          Select
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Best Option Summary - prioritize quantity-aware best if available */}
        {(bestOptionForQuantity || bestByPrice) && (
          <div className="p-3 border-t bg-green-50/50">
            {/* Show quantity-aware recommendation if available */}
            {requiredQuantity && bestOptionForQuantity ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">
                    Best for {requiredQuantity.toLocaleString()} units:{' '}
                    {getSupplierConfig(bestOptionForQuantity.supplier_name).displayName}
                  </span>
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                    <Check className="h-3 w-3 mr-1" />
                    In Stock
                  </Badge>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-green-600">
                    {formatPrice(bestOptionForQuantity.unit_price, bestOptionForQuantity.currency)}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({formatStock(bestOptionForQuantity.availability)} available)
                  </span>
                </div>
              </div>
            ) : requiredQuantity && !bestOptionForQuantity ? (
              // No supplier can fulfill the required quantity
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    No single supplier has {requiredQuantity.toLocaleString()} units in stock
                  </span>
                </div>
                {bestByPrice && (
                  <div className="text-sm text-muted-foreground">
                    Best price: {formatPrice(bestByPrice.unit_price, bestByPrice.currency)}
                  </div>
                )}
              </div>
            ) : bestByPrice ? (
              // Fallback to best price when no quantity specified
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">
                    Best Price: {getSupplierConfig(bestByPrice.supplier_name).displayName}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-green-600">
                    {formatPrice(bestByPrice.unit_price, bestByPrice.currency)}
                  </span>
                  {bestByPrice.availability && bestByPrice.availability > 0 && (
                    <span className="text-muted-foreground ml-2">
                      ({formatStock(bestByPrice.availability)} in stock)
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact supplier comparison for inline display
 */
export function SupplierComparisonInline({
  suppliers,
  currency = 'USD',
}: {
  suppliers: SupplierProductData[];
  currency?: string;
}) {
  if (!suppliers || suppliers.length === 0) {
    return <span className="text-muted-foreground">No suppliers</span>;
  }

  const best = findBestSupplier(suppliers, 'price');
  const prices = suppliers
    .filter((s) => s.unit_price)
    .map((s) => s.unit_price as number);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <span className="font-medium">
              {formatPrice(best?.unit_price, currency)}
            </span>
            {prices.length > 1 && (
              <Badge variant="outline" className="text-xs">
                {suppliers.length} suppliers
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            {suppliers.map((s, idx) => (
              <div key={idx} className="flex justify-between gap-4 text-sm">
                <span>{getSupplierConfig(s.supplier_name).displayName}</span>
                <span className="font-medium">
                  {formatPrice(s.unit_price, s.currency)}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SupplierComparisonCard;
