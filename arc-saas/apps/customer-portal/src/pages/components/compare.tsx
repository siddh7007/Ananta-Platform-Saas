/**
 * Component Comparison Page
 * CBP-P2-006: Advanced Component Comparison
 *
 * Side-by-side comparison tool for up to 4 components,
 * highlighting differences in specs, pricing, and availability.
 */

import { useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { X, Plus, ArrowLeftRight, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toastSuccess } from '@/hooks/useToast';
import { ComparisonTable } from './components/ComparisonTable';
import { ComponentSelector } from './components/ComponentSelector';
import { EmptyCompareState } from './components/EmptyCompareState';

const MAX_COMPARE = 4;

// Mock component data for development
interface Component {
  id: string;
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  subcategory: string;
  package: string;
  mountingType: string;
  value?: string;
  tolerance?: string;
  voltageRating?: string;
  powerRating?: string;
  temperatureRange?: string;
  stockQuantity: number;
  unitPrice: number;
  leadTime?: string;
  moq: number;
  lifecycleStatus: 'Active' | 'NRND' | 'Obsolete' | 'EOL';
  rohsCompliant: boolean;
  reachCompliant: boolean;
  countryOfOrigin?: string;
}

// Mock fetch function
async function fetchComponent(id: string): Promise<Component> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const mockComponents: Record<string, Component> = {
    'comp-1': {
      id: 'comp-1',
      mpn: 'RC0805JR-0710KL',
      manufacturer: 'Yageo',
      description: '10K Ohm 5% 1/8W 0805 Thick Film Resistor',
      category: 'Resistors',
      subcategory: 'Chip Resistors',
      package: '0805',
      mountingType: 'SMD',
      value: '10K',
      tolerance: '5%',
      voltageRating: '150V',
      powerRating: '0.125W',
      temperatureRange: '-55C to +155C',
      stockQuantity: 50000,
      unitPrice: 0.0023,
      leadTime: '4 weeks',
      moq: 5000,
      lifecycleStatus: 'Active',
      rohsCompliant: true,
      reachCompliant: true,
      countryOfOrigin: 'Taiwan',
    },
    'comp-2': {
      id: 'comp-2',
      mpn: 'CRCW080510K0FKEA',
      manufacturer: 'Vishay',
      description: '10K Ohm 1% 1/8W 0805 Thick Film Resistor',
      category: 'Resistors',
      subcategory: 'Chip Resistors',
      package: '0805',
      mountingType: 'SMD',
      value: '10K',
      tolerance: '1%',
      voltageRating: '150V',
      powerRating: '0.125W',
      temperatureRange: '-55C to +155C',
      stockQuantity: 35000,
      unitPrice: 0.0045,
      leadTime: '6 weeks',
      moq: 2500,
      lifecycleStatus: 'Active',
      rohsCompliant: true,
      reachCompliant: true,
      countryOfOrigin: 'China',
    },
    'comp-3': {
      id: 'comp-3',
      mpn: 'ERJ-6ENF1002V',
      manufacturer: 'Panasonic',
      description: '10K Ohm 1% 1/10W 0805 Thick Film Resistor',
      category: 'Resistors',
      subcategory: 'Chip Resistors',
      package: '0805',
      mountingType: 'SMD',
      value: '10K',
      tolerance: '1%',
      voltageRating: '150V',
      powerRating: '0.1W',
      temperatureRange: '-55C to +125C',
      stockQuantity: 0,
      unitPrice: 0.0038,
      leadTime: '12 weeks',
      moq: 5000,
      lifecycleStatus: 'NRND',
      rohsCompliant: true,
      reachCompliant: true,
      countryOfOrigin: 'Japan',
    },
    'comp-4': {
      id: 'comp-4',
      mpn: 'RMCF0805JT10K0',
      manufacturer: 'Stackpole',
      description: '10K Ohm 5% 1/8W 0805 Thick Film Resistor',
      category: 'Resistors',
      subcategory: 'Chip Resistors',
      package: '0805',
      mountingType: 'SMD',
      value: '10K',
      tolerance: '5%',
      voltageRating: '200V',
      powerRating: '0.125W',
      temperatureRange: '-55C to +155C',
      stockQuantity: 100000,
      unitPrice: 0.0019,
      leadTime: '2 weeks',
      moq: 10000,
      lifecycleStatus: 'Active',
      rohsCompliant: true,
      reachCompliant: true,
      countryOfOrigin: 'USA',
    },
  };

  const component = mockComponents[id];
  if (!component) {
    throw new Error(`Component ${id} not found`);
  }
  return component;
}

function LifecycleStatus({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    NRND: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Obsolete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    EOL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Badge className={colors[status] || colors.Active}>
      {status}
    </Badge>
  );
}

function StockIndicator({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <Badge variant="outline" className="text-red-600 border-red-300">
        Out of Stock
      </Badge>
    );
  }
  if (stock < 1000) {
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-300">
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-green-600 border-green-300">
      In Stock
    </Badge>
  );
}

export function ComponentComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const componentIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const componentQueries = useQueries({
    queries: componentIds.map((id) => ({
      queryKey: ['component', id],
      queryFn: () => fetchComponent(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const components = componentQueries
    .map((q) => q.data)
    .filter(Boolean) as Component[];

  const isLoading = componentQueries.some((q) => q.isLoading);

  const addComponent = (id: string) => {
    if (componentIds.length >= MAX_COMPARE) return;
    if (componentIds.includes(id)) return;
    setSearchParams({ ids: [...componentIds, id].join(',') });
  };

  const removeComponent = (id: string) => {
    const newIds = componentIds.filter((i) => i !== id);
    if (newIds.length > 0) {
      setSearchParams({ ids: newIds.join(',') });
    } else {
      setSearchParams({});
    }
  };

  const handleShare = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard not available');
      }
      await navigator.clipboard.writeText(window.location.href);
      toastSuccess('Link copied', 'Comparison URL copied to clipboard');
    } catch (error) {
      console.warn('Failed to copy URL:', error);
    }
  };

  const handleExport = () => {
    // Generate CSV of comparison data
    const headers = ['Property', ...components.map((c) => c.mpn)];
    const rows = [
      ['Manufacturer', ...components.map((c) => c.manufacturer)],
      ['Category', ...components.map((c) => c.category)],
      ['Package', ...components.map((c) => c.package)],
      ['Value', ...components.map((c) => c.value || '-')],
      ['Tolerance', ...components.map((c) => c.tolerance || '-')],
      ['Stock', ...components.map((c) => c.stockQuantity.toString())],
      ['Unit Price', ...components.map((c) => `$${c.unitPrice.toFixed(4)}`)],
      ['Lifecycle', ...components.map((c) => c.lifecycleStatus)],
    ];

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'component-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess('Export complete', 'Comparison exported to CSV');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
            Compare Components
          </h1>
          <p className="text-muted-foreground">
            Compare up to {MAX_COMPARE} components side by side
          </p>
        </div>

        <div className="flex items-center gap-2">
          {components.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" aria-hidden="true" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Export
              </Button>
            </>
          )}
          {componentIds.length < MAX_COMPARE && (
            <ComponentSelector
              excludeIds={componentIds}
              onSelect={addComponent}
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Add Component
                </Button>
              }
            />
          )}
        </div>
      </div>

      {componentIds.length === 0 ? (
        <EmptyCompareState onAddComponent={addComponent} />
      ) : (
        <>
          {/* Component Headers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading
              ? componentIds.map((id) => (
                  <Card key={id}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))
              : components.map((component) => (
                  <Card key={component.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono font-semibold">{component.mpn}</p>
                          <p className="text-sm text-muted-foreground">
                            {component.manufacturer}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 -mr-2 -mt-1"
                          onClick={() => removeComponent(component.id)}
                          aria-label={`Remove ${component.mpn} from comparison`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm line-clamp-2 mb-2">{component.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <LifecycleStatus status={component.lifecycleStatus} />
                        <StockIndicator stock={component.stockQuantity} />
                      </div>
                    </CardContent>
                  </Card>
                ))}

            {/* Empty slots */}
            {Array.from({ length: MAX_COMPARE - Math.max(components.length, componentIds.length) }).map((_, i) => (
              <Card key={`empty-${i}`} className="border-dashed">
                <CardContent className="flex items-center justify-center h-[140px]">
                  <ComponentSelector
                    excludeIds={componentIds}
                    onSelect={addComponent}
                    trigger={
                      <Button variant="ghost" className="text-muted-foreground">
                        <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                        Add component
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison Table */}
          {!isLoading && components.length > 0 && (
            <ComparisonTable components={components} />
          )}
        </>
      )}
    </div>
  );
}

export default ComponentComparePage;
