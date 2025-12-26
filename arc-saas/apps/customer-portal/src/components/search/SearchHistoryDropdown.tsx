/**
 * Search History Dropdown
 * CBP-P2-003: Quick access to saved and recent searches
 */

import { Clock, Star, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSavedSearchesStore, type SavedSearch, type SearchHistoryItem } from '@/stores/saved-searches';
import { type SearchFilters } from '@/hooks/useComponentSearch';
import { formatDistanceToNow } from 'date-fns';

interface SearchHistoryDropdownProps {
  onSelect: (query: string, filters: SearchFilters) => void;
}

function formatRelativeTime(timestamp: string): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

function truncateQuery(query: string, maxLength: number = 30): string {
  if (query.length <= maxLength) return query;
  return `${query.substring(0, maxLength)}...`;
}

export function SearchHistoryDropdown({ onSelect }: SearchHistoryDropdownProps) {
  const {
    savedSearches,
    searchHistory,
    useSavedSearch,
    removeFromHistory,
    clearHistory,
  } = useSavedSearchesStore();

  const handleSavedSearchClick = (search: SavedSearch) => {
    const used = useSavedSearch(search.id);
    if (used) {
      onSelect(used.query, used.filters);
    }
  };

  const handleHistoryClick = (item: SearchHistoryItem) => {
    onSelect(item.query, item.filters);
  };

  const topSavedSearches = [...savedSearches]
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, 5);

  const recentHistory = searchHistory.slice(0, 10);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label="Search history and saved searches"
        >
          <Clock className="h-4 w-4" />
          {(savedSearches.length > 0 || searchHistory.length > 0) && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <ScrollArea className="max-h-[400px]">
          {/* Saved Searches Section */}
          {savedSearches.length > 0 && (
            <>
              <DropdownMenuLabel className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
                Saved Searches
              </DropdownMenuLabel>
              {topSavedSearches.map((search) => (
                <DropdownMenuItem
                  key={search.id}
                  onClick={() => handleSavedSearchClick(search)}
                  className="flex flex-col items-start gap-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium truncate flex-1">
                      {search.name}
                    </span>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {search.useCount} uses
                    </Badge>
                  </div>
                  {search.query && (
                    <span className="text-xs text-muted-foreground font-mono truncate w-full">
                      {truncateQuery(search.query)}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
              {savedSearches.length > 5 && (
                <DropdownMenuItem
                  onClick={() => {
                    // Navigate to saved searches management
                    window.location.href = '/settings/saved-searches';
                  }}
                  className="text-primary text-sm"
                >
                  View all {savedSearches.length} saved searches
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Recent Searches Section */}
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Recent Searches
            </span>
            {searchHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  clearHistory();
                }}
              >
                Clear
              </Button>
            )}
          </DropdownMenuLabel>

          {recentHistory.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No recent searches
            </div>
          ) : (
            recentHistory.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex items-start gap-2 cursor-pointer group"
              >
                <div
                  className="flex-1 min-w-0"
                  onClick={() => handleHistoryClick(item)}
                >
                  <p className="truncate">
                    {item.query || (
                      <span className="text-muted-foreground italic">
                        (filters only)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.resultCount.toLocaleString()} results{' '}
                    <span className="mx-1">&middot;</span>
                    {formatRelativeTime(item.timestamp)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromHistory(item.id);
                  }}
                  aria-label="Remove from history"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SearchHistoryDropdown;
