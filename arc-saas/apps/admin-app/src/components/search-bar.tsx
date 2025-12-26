import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Building2, CreditCard, FileText, Workflow, Command, Loader2 } from 'lucide-react';
import { useDebounce } from '../hooks/use-debounce';
import { http } from '../lib/http-client';
import { logger } from '../lib/logger';

export interface SearchResult {
  id: string;
  type: 'tenant' | 'plan' | 'subscription' | 'workflow';
  title: string;
  subtitle?: string;
  path: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  tenant: <Building2 className="w-4 h-4" />,
  plan: <CreditCard className="w-4 h-4" />,
  subscription: <FileText className="w-4 h-4" />,
  workflow: <Workflow className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  tenant: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  plan: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
  subscription: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
  workflow: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
};

// Quick navigation items (always shown when no query)
const quickLinks: SearchResult[] = [
  { id: 'nav-tenants', type: 'tenant', title: 'Tenants', subtitle: 'Manage all tenants', path: '/tenants' },
  { id: 'nav-plans', type: 'plan', title: 'Plans', subtitle: 'Manage subscription plans', path: '/plans' },
  { id: 'nav-subscriptions', type: 'subscription', title: 'Subscriptions', subtitle: 'View subscriptions', path: '/subscriptions' },
  { id: 'nav-workflows', type: 'workflow', title: 'Workflows', subtitle: 'Monitor workflows', path: '/workflows' },
];

interface SearchBarProps {
  /** Placeholder text */
  placeholder?: string;
  /** Callback when search is performed */
  onSearch?: (query: string) => void;
  /** Custom search results (overrides built-in search) */
  results?: SearchResult[];
  /** Debounce delay in ms (default: 300) */
  debounceDelay?: number;
}

/**
 * Global search bar with keyboard navigation, quick links, and API search.
 * Can be opened with Cmd+K / Ctrl+K.
 */
export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  results,
  debounceDelay = 300,
}: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounce the search query for API calls
  const debouncedQuery = useDebounce(query.trim(), debounceDelay);

  // Fetch search results from API
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setApiResults([]);
      return;
    }

    const controller = new AbortController();

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        // Search multiple resources in parallel with abort signal
        const [tenantsRes, plansRes] = await Promise.allSettled([
          http.get<{ data: Array<{ id: string; name: string; key?: string; status?: string }> }>(
            `/tenants?search=${encodeURIComponent(debouncedQuery)}&limit=5`,
            { signal: controller.signal }
          ),
          http.get<{ data: Array<{ id: string; name: string; tier?: string }> }>(
            `/plans?search=${encodeURIComponent(debouncedQuery)}&limit=5`,
            { signal: controller.signal }
          ),
        ]);

        const newResults: SearchResult[] = [];

        // Process tenant results
        if (tenantsRes.status === 'fulfilled' && tenantsRes.value?.data) {
          const tenants = Array.isArray(tenantsRes.value.data)
            ? tenantsRes.value.data
            : tenantsRes.value.data;
          tenants.forEach((tenant) => {
            newResults.push({
              id: `tenant-${tenant.id}`,
              type: 'tenant',
              title: tenant.name,
              subtitle: tenant.key || tenant.status || 'Tenant',
              path: `/tenants/${tenant.id}`,
            });
          });
        }

        // Process plan results
        if (plansRes.status === 'fulfilled' && plansRes.value?.data) {
          const plans = Array.isArray(plansRes.value.data)
            ? plansRes.value.data
            : plansRes.value.data;
          plans.forEach((plan) => {
            newResults.push({
              id: `plan-${plan.id}`,
              type: 'plan',
              title: plan.name,
              subtitle: plan.tier || 'Plan',
              path: `/plans/${plan.id}/edit`,
            });
          });
        }

        setApiResults(newResults);
      } catch (error) {
        logger.error('Search failed', { error });
        setApiResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  // Combine API results with filtered quick links
  const filteredResults = useMemo(() => {
    if (!query.trim()) {
      return quickLinks;
    }

    // If we have custom results, use those
    if (results) {
      return results.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Filter quick links that match
    const matchingQuickLinks = quickLinks.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(query.toLowerCase())
    );

    // Combine with API results (API results first)
    return [...apiResults, ...matchingQuickLinks];
  }, [query, results, apiResults]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.path);
      handleClose();
    },
    [navigate, handleClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredResults[selectedIndex]) {
            handleSelect(filteredResults[selectedIndex]);
          }
          break;
        case 'Escape':
          handleClose();
          break;
      }
    },
    [filteredResults, selectedIndex, handleSelect, handleClose]
  );

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          handleOpen();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleOpen, handleClose]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full max-w-xs"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">{placeholder}</span>
        <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative min-h-screen flex items-start justify-center pt-[15vh] px-4">
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <Search className="w-5 h-5 text-gray-400" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search tenants, plans..."
                  className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-[50vh] overflow-y-auto">
                {isLoading && query.trim().length >= 2 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Searching...
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {query.trim().length < 2
                      ? 'Type at least 2 characters to search'
                      : `No results found for "${query}"`}
                  </div>
                ) : (
                  <div className="py-2">
                    {!query && (
                      <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Quick Links
                      </div>
                    )}
                    {query && apiResults.length > 0 && (
                      <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Search Results
                      </div>
                    )}
                    {filteredResults.map((result, index) => (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          index === selectedIndex
                            ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${typeColors[result.type]}`}>
                          {typeIcons[result.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {result.title}
                          </div>
                          {result.subtitle && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 capitalize">
                          {result.type}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
                  <span>to navigate</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
                  <span>to select</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">esc</kbd>
                  <span>to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SearchBar;
