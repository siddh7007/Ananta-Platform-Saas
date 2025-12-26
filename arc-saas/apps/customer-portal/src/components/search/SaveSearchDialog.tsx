/**
 * Save Search Dialog
 * CBP-P2-003: Save current search with custom name
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bookmark } from 'lucide-react';
import { useSavedSearchesStore } from '@/stores/saved-searches';
import { type SearchFilters } from '@/hooks/useComponentSearch';

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  filters: SearchFilters;
  onSaved?: () => void;
}

function getFilterSummary(filters: SearchFilters): string {
  const parts: string[] = [];

  if (filters.categories?.length) {
    parts.push(`${filters.categories.length} categories`);
  }
  if (filters.manufacturers?.length) {
    parts.push(`${filters.manufacturers.length} manufacturers`);
  }
  if (filters.packages?.length) {
    parts.push(`${filters.packages.length} packages`);
  }
  if (filters.capacitanceRange) {
    parts.push('capacitance range');
  }
  if (filters.resistanceRange) {
    parts.push('resistance range');
  }
  if (filters.voltageRange) {
    parts.push('voltage range');
  }
  if (filters.inStockOnly) {
    parts.push('in stock only');
  }
  if (filters.lifecycleStatuses?.length) {
    parts.push(`lifecycle: ${filters.lifecycleStatuses.join(', ')}`);
  }
  if (filters.qualityScoreMin !== undefined) {
    parts.push(`quality ${filters.qualityScoreMin}%+`);
  }
  if (filters.rohsCompliant) {
    parts.push('RoHS');
  }
  if (filters.reachCompliant) {
    parts.push('REACH');
  }
  if (filters.aecQualified) {
    parts.push('AEC-Q');
  }

  return parts.join(', ') || 'No filters';
}

export function SaveSearchDialog({
  open,
  onOpenChange,
  query,
  filters,
  onSaved,
}: SaveSearchDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { addSavedSearch, savedSearches } = useSavedSearchesStore();

  const handleSave = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please enter a name for this search');
      return;
    }

    // Check for duplicate names
    if (savedSearches.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('A saved search with this name already exists');
      return;
    }

    addSavedSearch(trimmedName, query, filters);
    setName('');
    setError(null);
    onOpenChange(false);
    onSaved?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const filterSummary = getFilterSummary(filters);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" aria-hidden="true" />
            Save Search
          </DialogTitle>
          <DialogDescription>
            Save this search to quickly access it later
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 0603 Capacitors in Stock"
              autoFocus
              aria-describedby={error ? 'name-error' : undefined}
            />
            {error && (
              <p id="name-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          {/* Search Query */}
          <div className="space-y-2">
            <Label>Search Query</Label>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-mono">
                {query || <span className="text-muted-foreground">(no query)</span>}
              </p>
            </div>
          </div>

          {/* Active Filters */}
          <div className="space-y-2">
            <Label>Active Filters</Label>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm text-muted-foreground">{filterSummary}</p>

              {/* Show selected values */}
              <div className="flex flex-wrap gap-1 mt-2">
                {filters.categories?.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}
                  </Badge>
                ))}
                {filters.manufacturers?.map((mfr) => (
                  <Badge key={mfr} variant="outline" className="text-xs">
                    {mfr}
                  </Badge>
                ))}
                {filters.packages?.map((pkg) => (
                  <Badge key={pkg} variant="secondary" className="text-xs font-mono">
                    {pkg}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save Search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveSearchDialog;
