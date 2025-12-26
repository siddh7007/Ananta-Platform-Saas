/**
 * PriceBreakChart Component
 *
 * Visualizes quantity-based price breaks with:
 * - Bar chart showing price per unit at each break
 * - Savings percentage indicators
 * - Interactive quantity input to calculate costs
 */

import { useState, useMemo } from 'react';
import { BarChart3, TrendingDown, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PriceBreak } from '@/types/supplier';
import {
  calculateExtendedPriceBreaks,
  findBestPriceBreak,
  formatPrice,
} from '@/types/supplier';

interface PriceBreakChartProps {
  priceBreaks: PriceBreak[];
  basePrice?: number;
  currency?: string;
  showCalculator?: boolean;
  compact?: boolean;
  className?: string;
}

export function PriceBreakChart({
  priceBreaks,
  basePrice,
  currency = 'USD',
  showCalculator = true,
  compact = false,
  className = '',
}: PriceBreakChartProps) {
  const [calculatorQty, setCalculatorQty] = useState<number>(1);

  // Calculate extended price breaks with savings
  const extendedBreaks = useMemo(
    () => calculateExtendedPriceBreaks(priceBreaks, basePrice),
    [priceBreaks, basePrice]
  );

  // Find the maximum price for bar scaling
  const maxPrice = useMemo(() => {
    if (extendedBreaks.length === 0) return 1;
    return Math.max(...extendedBreaks.map((pb) => pb.unitPrice));
  }, [extendedBreaks]);

  // Calculate cost at calculator quantity
  const calculatorResult = useMemo(() => {
    const bestBreak = findBestPriceBreak(priceBreaks, calculatorQty);
    const unitPrice = bestBreak?.price ?? basePrice ?? 0;
    const totalCost = unitPrice * calculatorQty;
    const baseTotal = (basePrice ?? extendedBreaks[0]?.price ?? 0) * calculatorQty;
    const savings = baseTotal > 0 ? baseTotal - totalCost : 0;

    return {
      unitPrice,
      totalCost,
      savings,
      savingsPercent:
        baseTotal > 0 ? Math.round((savings / baseTotal) * 100) : 0,
      breakUsed: bestBreak,
    };
  }, [calculatorQty, priceBreaks, basePrice, extendedBreaks]);

  if (!priceBreaks || priceBreaks.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No price breaks available
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BarChart3 className="h-3 w-3" />
          <span>Price Breaks ({extendedBreaks.length})</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {extendedBreaks.slice(0, 4).map((pb, idx) => (
            <TooltipProvider key={idx}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs">
                    {pb.quantity}+: {formatPrice(pb.price, currency, 4)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Order {pb.quantity}+ units: {formatPrice(pb.price, currency, 4)}/unit
                  </p>
                  {pb.savingsPercent && pb.savingsPercent > 0 && (
                    <p className="text-green-600">Save {pb.savingsPercent}%</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {extendedBreaks.length > 4 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{extendedBreaks.length - 4} more
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Price Breaks
        </CardTitle>
        <CardDescription>
          Unit price decreases with larger quantities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Bar Chart with Interactive Tooltips */}
        <div className="space-y-2" role="img" aria-label="Price breaks bar chart">
          {extendedBreaks.map((pb, idx) => {
            const barWidth = (pb.unitPrice / maxPrice) * 100;
            const minPrice = Math.min(...extendedBreaks.map((p) => p.unitPrice));
            const isLowest = pb.unitPrice === minPrice;
            const totalCostExample = pb.price * pb.quantity;

            return (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-2 cursor-pointer group"
                      role="graphics-symbol"
                      aria-label={`${pb.quantity}+ units at ${formatPrice(pb.price, currency, 4)} each${pb.savingsPercent ? `, save ${pb.savingsPercent}%` : ''}`}
                    >
                      {/* Quantity label */}
                      <div className="w-16 text-right text-sm font-medium group-hover:text-primary transition-colors">
                        {pb.quantity >= 1000
                          ? `${(pb.quantity / 1000).toFixed(0)}K`
                          : pb.quantity}
                        +
                      </div>

                      {/* Bar with hover effect */}
                      <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden relative">
                        <div
                          className={`h-full transition-all group-hover:opacity-80 ${
                            isLowest ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-2">
                          <span className="text-xs font-medium text-white drop-shadow">
                            {formatPrice(pb.price, currency, 4)}
                          </span>
                        </div>
                      </div>

                      {/* Savings badge */}
                      {pb.savingsPercent && pb.savingsPercent > 0 ? (
                        <Badge
                          variant="outline"
                          className="w-16 justify-center text-green-600 border-green-200 bg-green-50"
                        >
                          <TrendingDown className="h-3 w-3 mr-1" />
                          {pb.savingsPercent}%
                        </Badge>
                      ) : (
                        <div className="w-16" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-2">
                      <div className="font-semibold border-b pb-1">
                        {pb.quantity.toLocaleString()}+ Units
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Unit Price:</span>
                        <span className="font-medium">{formatPrice(pb.price, currency, 4)}</span>

                        <span className="text-muted-foreground">Min Order:</span>
                        <span>{formatPrice(totalCostExample, currency, 2)}</span>

                        {pb.savingsPercent && pb.savingsPercent > 0 && (
                          <>
                            <span className="text-muted-foreground">Savings:</span>
                            <span className="text-green-600 font-medium">{pb.savingsPercent}% off</span>
                          </>
                        )}
                      </div>
                      {isLowest && (
                        <div className="text-xs text-green-600 font-medium pt-1 border-t">
                          Best price per unit
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Price Calculator */}
        {showCalculator && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Price Calculator</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="calc-qty" className="text-xs">
                  Quantity
                </Label>
                <Input
                  id="calc-qty"
                  type="number"
                  min={1}
                  value={calculatorQty}
                  onChange={(e) =>
                    setCalculatorQty(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Unit Price</Label>
                <div className="h-8 flex items-center">
                  <span className="text-lg font-bold">
                    {formatPrice(calculatorResult.unitPrice, currency, 4)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Cost</span>
                <span className="text-xl font-bold">
                  {formatPrice(calculatorResult.totalCost, currency, 2)}
                </span>
              </div>

              {calculatorResult.savings > 0 && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-green-600">Savings</span>
                  <span className="text-sm font-medium text-green-600">
                    {formatPrice(calculatorResult.savings, currency, 2)} (
                    {calculatorResult.savingsPercent}%)
                  </span>
                </div>
              )}

              {calculatorResult.breakUsed && (
                <div className="text-xs text-muted-foreground mt-2">
                  Using {calculatorResult.breakUsed.quantity}+ price break
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline price breaks display (for table cells)
 */
export function PriceBreaksInline({
  priceBreaks,
  currency = 'USD',
  maxDisplay = 3,
}: {
  priceBreaks: PriceBreak[];
  currency?: string;
  maxDisplay?: number;
}) {
  if (!priceBreaks || priceBreaks.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const sorted = [...priceBreaks].sort((a, b) => a.quantity - b.quantity);
  const displayed = sorted.slice(0, maxDisplay);
  const remaining = sorted.length - maxDisplay;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-wrap gap-1 cursor-help">
            {displayed.map((pb, idx) => (
              <span key={idx} className="text-xs">
                {pb.quantity}+:{formatPrice(pb.price, currency, 3)}
                {idx < displayed.length - 1 && ', '}
              </span>
            ))}
            {remaining > 0 && (
              <span className="text-xs text-muted-foreground">
                +{remaining}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium mb-2">All Price Breaks</p>
            {sorted.map((pb, idx) => (
              <div key={idx} className="flex justify-between gap-4 text-sm">
                <span>{pb.quantity.toLocaleString()}+ units</span>
                <span className="font-medium">
                  {formatPrice(pb.price, currency, 4)}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PriceBreakChart;
