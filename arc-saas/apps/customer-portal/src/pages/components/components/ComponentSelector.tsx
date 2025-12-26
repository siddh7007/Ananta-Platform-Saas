/**
 * Component Selector Dialog
 * CBP-P2-006: Search and select components to add to comparison
 */

import { useState, useCallback, useEffect } from 'react';
import { Search, Package, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/useDebounce';
import { componentLogger } from '@/lib/logger';

interface Component {
  id: string;
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  stockQuantity: number;
}

interface ComponentSelectorProps {
  excludeIds: string[];
  onSelect: (id: string) => void;
  trigger: React.ReactNode;
}

// Mock search results for development
const MOCK_COMPONENTS: Component[] = [
  {
    id: 'comp-1',
    mpn: 'RC0805JR-0710KL',
    manufacturer: 'Yageo',
    description: '10K Ohm 5% 1/8W 0805 Thick Film Resistor',
    category: 'Resistors',
    stockQuantity: 50000,
  },
  {
    id: 'comp-2',
    mpn: 'CRCW080510K0FKEA',
    manufacturer: 'Vishay',
    description: '10K Ohm 1% 1/8W 0805 Thick Film Resistor',
    category: 'Resistors',
    stockQuantity: 35000,
  },
  {
    id: 'comp-3',
    mpn: 'ERJ-6ENF1002V',
    manufacturer: 'Panasonic',
    description: '10K Ohm 1% 1/10W 0805 Thick Film Resistor',
    category: 'Resistors',
    stockQuantity: 0,
  },
  {
    id: 'comp-4',
    mpn: 'RMCF0805JT10K0',
    manufacturer: 'Stackpole',
    description: '10K Ohm 5% 1/8W 0805 Thick Film Resistor',
    category: 'Resistors',
    stockQuantity: 100000,
  },
  {
    id: 'comp-5',
    mpn: 'GRM21BR71H104KA01L',
    manufacturer: 'Murata',
    description: '0.1uF 50V X7R 0805 Ceramic Capacitor',
    category: 'Capacitors',
    stockQuantity: 75000,
  },
  {
    id: 'comp-6',
    mpn: 'CC0805KRX7R9BB104',
    manufacturer: 'Yageo',
    description: '0.1uF 50V X7R 0805 Ceramic Capacitor',
    category: 'Capacitors',
    stockQuantity: 45000,
  },
];

async function searchComponents(query: string): Promise<Component[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (!query.trim()) {
    return MOCK_COMPONENTS;
  }

  const lowerQuery = query.toLowerCase();
  return MOCK_COMPONENTS.filter(
    (c) =>
      c.mpn.toLowerCase().includes(lowerQuery) ||
      c.manufacturer.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery)
  );
}

export function ComponentSelector({
  excludeIds,
  onSelect,
  trigger,
}: ComponentSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Component[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  const doSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const components = await searchComponents(searchQuery);
      setResults(components);
    } catch (error) {
      componentLogger.error('Component search failed', error, { query: searchQuery });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search when query changes or dialog opens
  useEffect(() => {
    if (open) {
      doSearch(debouncedQuery);
    }
  }, [open, debouncedQuery, doSearch]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedId(null);
      doSearch('');
    }
  };

  const handleSelect = (component: Component) => {
    setSelectedId(component.id);
    onSelect(component.id);
    setOpen(false);
  };

  const availableResults = results.filter((c) => !excludeIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" aria-hidden="true" />
            Select Component
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by MPN, manufacturer, or description..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
              aria-label="Search components"
            />
          </div>

          {/* Results */}
          <ScrollArea className="h-[300px] pr-4">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ))}
              </div>
            ) : availableResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No components found</p>
                {excludeIds.length > 0 && (
                  <p className="text-sm mt-1">
                    {results.length - availableResults.length} component(s) already in comparison
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {availableResults.map((component) => (
                  <button
                    key={component.id}
                    onClick={() => handleSelect(component)}
                    className={`
                      w-full text-left p-3 border rounded-lg transition-colors
                      hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary
                      ${selectedId === component.id ? 'border-primary bg-primary/5' : 'border-border'}
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono font-medium">{component.mpn}</p>
                        <p className="text-sm text-muted-foreground">
                          {component.manufacturer}
                        </p>
                      </div>
                      {selectedId === component.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm mt-1 line-clamp-1">{component.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {component.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          component.stockQuantity > 0
                            ? 'text-green-600 border-green-300'
                            : 'text-red-600 border-red-300'
                        }`}
                      >
                        {component.stockQuantity > 0
                          ? `${component.stockQuantity.toLocaleString()} in stock`
                          : 'Out of stock'}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
            <span>
              {availableResults.length} component{availableResults.length !== 1 ? 's' : ''} available
            </span>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ComponentSelector;
