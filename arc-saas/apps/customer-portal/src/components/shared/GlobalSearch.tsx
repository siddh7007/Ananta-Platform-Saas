/**
 * Global Search Component
 * Site-wide search for BOMs and Components with keyboard shortcut (Cmd/Ctrl+K)
 *
 * Features:
 * - Ctrl+K on Windows (doesn't conflict with browser find which is Ctrl+F)
 * - Cmd+K on Mac
 * - Tenant-scoped search with X-Tenant-Id header
 * - Debounced queries with request cancellation
 * - Full keyboard navigation with focus trap
 * - ARIA compliant (role, aria-modal, aria-label, live regions)
 * - Cache keyed by tenant + query
 */

import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Cpu, Loader2, ArrowRight, Command } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTenantId } from '@/contexts/TenantContext';
import { cnsApi } from '@/lib/axios';

interface SearchResult {
  id: string;
  type: 'bom' | 'component';
  title: string;
  subtitle?: string;
  status?: string;
}

interface GlobalSearchProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

// Simple in-memory cache with tenant isolation
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

function getCacheKey(tenantId: string | null, query: string): string {
  return `${tenantId || 'no-tenant'}:${query.toLowerCase().trim()}`;
}

function getCachedResults(tenantId: string | null, query: string): SearchResult[] | null {
  const key = getCacheKey(tenantId, query);
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }
  return null;
}

function setCachedResults(tenantId: string | null, query: string, results: SearchResult[]): void {
  const key = getCacheKey(tenantId, query);
  searchCache.set(key, { results, timestamp: Date.now() });

  // Limit cache size (LRU-style eviction)
  if (searchCache.size > 100) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
}

/**
 * Global search dialog with keyboard shortcut
 */
export function GlobalSearch({ open: controlledOpen, onOpenChange }: GlobalSearchProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const navigate = useNavigate();
  const tenantId = useTenantId();

  // Generate unique IDs for ARIA relationships
  const dialogTitleId = useId();
  const dialogDescId = useId();
  const listboxId = useId();

  // Use controlled or internal state
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Keyboard shortcut listener (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K on Windows/Linux, Cmd+K on Mac
      // This doesn't conflict with Ctrl+F (browser find)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        // Store current focus to restore on close
        previousFocusRef.current = document.activeElement as HTMLElement;
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setAnnouncement('');
      // Focus input after dialog animation
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      // Restore focus when dialog closes
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Debounced search with cancellation
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setAnnouncement('');
      return;
    }

    // Check cache first
    const cached = getCachedResults(tenantId, query);
    if (cached) {
      setResults(cached);
      setSelectedIndex(0);
      setAnnouncement(`${cached.length} results found`);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults = await performSearch(query, tenantId, abortController.signal);

        // Don't update if aborted
        if (abortController.signal.aborted) return;

        setResults(searchResults);
        setCachedResults(tenantId, query, searchResults);
        setSelectedIndex(0);
        setAnnouncement(
          searchResults.length === 0
            ? `No results found for ${query}`
            : `${searchResults.length} results found`
        );
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Search error:', error);
        setResults([]);
        setAnnouncement('Search failed');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [query, tenantId]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => {
            const next = Math.min(i + 1, results.length - 1);
            if (results[next]) {
              setAnnouncement(`${results[next].title}, ${results[next].type}`);
            }
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => {
            const prev = Math.max(i - 1, 0);
            if (results[prev]) {
              setAnnouncement(`${results[prev].title}, ${results[prev].type}`);
            }
            return prev;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'Tab':
          // Trap focus within dialog
          e.preventDefault();
          inputRef.current?.focus();
          break;
      }
    },
    [results, selectedIndex, setOpen]
  );

  // Navigate to selected result
  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    if (result.type === 'bom') {
      navigate(`/boms/${result.id}`);
    } else {
      navigate(`/components?id=${result.id}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl p-0"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescId}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (previousFocusRef.current) {
            previousFocusRef.current.focus();
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle id={dialogTitleId}>Search</DialogTitle>
          <DialogDescription id={dialogDescId}>
            Search for BOMs and components across your organization
          </DialogDescription>
        </DialogHeader>

        {/* Live region for screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </div>

        {/* Search input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search BOMs and components..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Search query"
            aria-controls={listboxId}
            aria-activedescendant={
              results.length > 0 ? `search-result-${selectedIndex}` : undefined
            }
            role="combobox"
            aria-expanded={results.length > 0}
            aria-haspopup="listbox"
            aria-autocomplete="list"
          />
          {isLoading && (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {query.length < 2 && !results.length && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p>Type at least 2 characters to search</p>
              <p className="mt-2 flex items-center justify-center gap-1 text-xs">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                  <Command className="inline h-3 w-3" aria-hidden="true" />K
                </kbd>
                <span>to open search anytime</span>
              </p>
            </div>
          )}

          {query.length >= 2 && !isLoading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          )}

          {results.length > 0 && (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              className="py-2"
            >
              {results.map((result, index) => (
                <li
                  key={`${result.type}-${result.id}`}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <button
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    )}
                    tabIndex={-1}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        result.type === 'bom'
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                          : 'bg-green-100 text-green-600 dark:bg-green-900/30'
                      )}
                      aria-hidden="true"
                    >
                      {result.type === 'bom' ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <Cpu className="h-5 w-5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{result.title}</span>
                        {result.status && (
                          <Badge variant="outline" className="text-xs">
                            {result.status}
                          </Badge>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="truncate text-sm text-muted-foreground">
                          {result.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <ArrowRight
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-opacity',
                        index === selectedIndex ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div
            className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground"
            aria-hidden="true"
          >
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">↓</kbd>
              <span>to navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">↵</kbd>
              <span>to select</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">esc</kbd>
              <span>to close</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Perform search across BOMs and components
 */
async function performSearch(
  query: string,
  tenantId: string | null,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const headers: Record<string, string> = {};

  // Always include tenant header for proper scoping
  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }

  try {
    // Search BOMs
    const bomResponse = await cnsApi.get('/boms', {
      params: {
        filter: JSON.stringify({
          where: {
            or: [
              { name: { like: `%${query}%` } },
              { description: { like: `%${query}%` } },
            ],
          },
          limit: 5,
        }),
      },
      headers,
      signal,
    });

    const boms = Array.isArray(bomResponse.data)
      ? bomResponse.data
      : bomResponse.data?.data || [];

    boms.forEach((bom: { id: string; name: string; description?: string; status?: string }) => {
      results.push({
        id: bom.id,
        type: 'bom',
        title: bom.name,
        subtitle: bom.description,
        status: bom.status,
      });
    });
  } catch (error) {
    // Re-throw abort errors to handle them upstream
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('BOM search error:', error);
  }

  try {
    // Search components
    const componentResponse = await cnsApi.get('/components/search', {
      params: {
        q: query,
        limit: 5,
      },
      headers,
      signal,
    });

    const components = Array.isArray(componentResponse.data)
      ? componentResponse.data
      : componentResponse.data?.data || [];

    components.forEach(
      (comp: {
        id: string;
        mpn: string;
        manufacturer?: string;
        lifecycle_status?: string;
      }) => {
        results.push({
          id: comp.id,
          type: 'component',
          title: comp.mpn,
          subtitle: comp.manufacturer,
          status: comp.lifecycle_status,
        });
      }
    );
  } catch (error) {
    // Re-throw abort errors to handle them upstream
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Component search error:', error);
  }

  return results;
}

/**
 * Search trigger button for navbar
 */
export function GlobalSearchTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted',
        className
      )}
      aria-label="Open search (Ctrl+K)"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Search...</span>
      <kbd
        className="ml-2 hidden rounded border bg-background px-1.5 py-0.5 font-mono text-xs sm:inline-block"
        aria-hidden="true"
      >
        <Command className="inline h-3 w-3" />K
      </kbd>
    </button>
  );
}
