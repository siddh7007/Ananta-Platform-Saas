/**
 * Comparison Table Component
 * CBP-P2-006: Side-by-side specification comparison with difference highlighting
 */

import { useMemo } from 'react';
import { Check, X, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  lifecycleStatus: string;
  rohsCompliant: boolean;
  reachCompliant: boolean;
  countryOfOrigin?: string;
}

interface ComparisonTableProps {
  components: Component[];
}

const COMPARISON_SECTIONS: ComparisonSection[] = [
  {
    title: 'Basic Information',
    rows: [
      { key: 'category', label: 'Category' },
      { key: 'subcategory', label: 'Subcategory' },
      { key: 'package', label: 'Package' },
      { key: 'mountingType', label: 'Mounting Type' },
    ],
  },
  {
    title: 'Electrical Specifications',
    rows: [
      { key: 'value', label: 'Value' },
      { key: 'tolerance', label: 'Tolerance' },
      { key: 'voltageRating', label: 'Voltage Rating' },
      { key: 'powerRating', label: 'Power Rating' },
      { key: 'temperatureRange', label: 'Temperature Range' },
    ],
  },
  {
    title: 'Availability & Pricing',
    rows: [
      { key: 'stockQuantity', label: 'Stock', format: 'number' as const },
      { key: 'unitPrice', label: 'Unit Price', format: 'currency' as const },
      { key: 'leadTime', label: 'Lead Time' },
      { key: 'moq', label: 'MOQ', format: 'number' as const },
    ],
  },
  {
    title: 'Lifecycle & Compliance',
    rows: [
      { key: 'lifecycleStatus', label: 'Lifecycle Status' },
      { key: 'rohsCompliant', label: 'RoHS Compliant', format: 'boolean' as const },
      { key: 'reachCompliant', label: 'REACH Compliant', format: 'boolean' as const },
      { key: 'countryOfOrigin', label: 'Country of Origin' },
    ],
  },
];

type FormatType = 'boolean' | 'currency' | 'number';

interface ComparisonRow {
  key: string;
  label: string;
  format?: FormatType;
}

interface ComparisonSection {
  title: string;
  rows: ComparisonRow[];
}

function formatValue(value: unknown, format?: FormatType): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <Minus className="h-4 w-4 text-muted-foreground mx-auto" aria-label="Not available" />;
  }

  switch (format) {
    case 'boolean':
      return value ? (
        <Check className="h-4 w-4 text-green-500 mx-auto" aria-label="Yes" />
      ) : (
        <X className="h-4 w-4 text-red-500 mx-auto" aria-label="No" />
      );
    case 'currency':
      return `$${Number(value).toFixed(4)}`;
    case 'number':
      return Number(value).toLocaleString();
    default:
      return String(value);
  }
}

function getLifecycleColor(status: string): string {
  switch (status) {
    case 'Active':
      return 'text-green-600 dark:text-green-400';
    case 'NRND':
      return 'text-amber-600 dark:text-amber-400';
    case 'Obsolete':
    case 'EOL':
      return 'text-red-600 dark:text-red-400';
    default:
      return '';
  }
}

function getStockColor(stock: number): string {
  if (stock === 0) return 'text-red-600 dark:text-red-400';
  if (stock < 1000) return 'text-amber-600 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}

export function ComparisonTable({ components }: ComparisonTableProps) {
  const highlightDifferences = useMemo(() => {
    const differences: Record<string, boolean> = {};

    const allRows = COMPARISON_SECTIONS.flatMap((s) => s.rows);
    allRows.forEach((row) => {
      const values = components.map((c) => c[row.key as keyof Component]);
      const stringValues = values.map((v) => String(v ?? ''));
      const uniqueValues = new Set(stringValues);
      differences[row.key] = uniqueValues.size > 1;
    });

    return differences;
  }, [components]);

  const getCellValue = (component: Component, key: string, format?: FormatType): React.ReactNode => {
    const value = component[key as keyof Component];

    // Special styling for certain fields
    if (key === 'lifecycleStatus') {
      return (
        <span className={cn('font-medium', getLifecycleColor(String(value)))}>
          {String(value)}
        </span>
      );
    }

    if (key === 'stockQuantity') {
      const stock = Number(value);
      return (
        <span className={cn('font-medium', getStockColor(stock))}>
          {stock === 0 ? 'Out of Stock' : stock.toLocaleString()}
        </span>
      );
    }

    return formatValue(value, format);
  };

  return (
    <div className="border rounded-lg overflow-hidden" role="table" aria-label="Component comparison">
      {COMPARISON_SECTIONS.map((section) => (
        <div key={section.title} role="rowgroup">
          <div
            className="bg-muted px-4 py-2 font-semibold text-sm"
            role="row"
          >
            <span role="columnheader">{section.title}</span>
          </div>
          <div className="divide-y">
            {section.rows.map((row) => (
              <div
                key={row.key}
                className={cn(
                  'grid items-center',
                  highlightDifferences[row.key] && 'bg-amber-50 dark:bg-amber-950/20'
                )}
                style={{
                  gridTemplateColumns: `180px repeat(${components.length}, 1fr)`,
                }}
                role="row"
              >
                <div
                  className="px-4 py-3 text-sm font-medium flex items-center gap-1"
                  role="rowheader"
                >
                  {row.label}
                  {highlightDifferences[row.key] && (
                    <AlertTriangle
                      className="h-3 w-3 text-amber-500"
                      aria-label="Values differ"
                    />
                  )}
                </div>
                {components.map((component) => (
                  <div
                    key={component.id}
                    className="px-4 py-3 text-sm text-center border-l"
                    role="cell"
                  >
                    {getCellValue(component, row.key, row.format)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ComparisonTable;
