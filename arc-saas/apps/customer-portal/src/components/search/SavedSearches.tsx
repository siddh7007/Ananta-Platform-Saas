/**
 * SavedSearches Component (Ported from legacy CBP)
 *
 * Save/load component search queries with filter state.
 * Stores searches in localStorage with name and description.
 *
 * Features:
 * - Save current search with filters
 * - Load saved searches
 * - Edit saved search metadata
 * - Delete saved searches
 * - Validation and security (XSS prevention, max searches)
 */

import { useState, useEffect } from 'react';
import { Bookmark, BookmarkPlus, Search, Edit, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Using a simple textarea instead of Radix UI Textarea component
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks';

/** Maximum length for search name */
const MAX_NAME_LENGTH = 50;

/** Maximum number of saved searches to prevent localStorage bloat */
const MAX_SAVED_SEARCHES = 50;

/** Component filter state (adjust based on your actual filter structure) */
export interface ComponentFilterState {
  suppliers: string[];
  lifecycleStatuses: string[];
  complianceFlags: string[];
  priceRange: [number, number];
  riskLevels: string[];
  [key: string]: unknown; // Allow additional filter fields
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: string;
  searchType: string;
  filters: ComponentFilterState;
  createdAt: string;
}

interface SavedSearchesProps {
  currentQuery: string;
  currentSearchType: string;
  currentFilters: ComponentFilterState;
  onLoadSearch: (search: SavedSearch) => void;
}

const STORAGE_KEY = 'component_saved_searches';

/**
 * Validates a SavedSearch object has required fields with correct types.
 * Protects against localStorage injection attacks.
 */
function isValidSavedSearch(obj: unknown): obj is SavedSearch {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.query === 'string' &&
    typeof s.searchType === 'string' &&
    typeof s.createdAt === 'string' &&
    s.filters !== null &&
    typeof s.filters === 'object'
  );
}

/**
 * Sanitize string for safe display - removes potential XSS vectors
 */
function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function SavedSearches({
  currentQuery,
  currentSearchType,
  currentFilters,
  onLoadSearch,
}: SavedSearchesProps) {
  const { toast } = useToast();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');

  // Load saved searches from localStorage with validation
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          throw new Error('Saved searches must be an array');
        }
        // Validate each search object to prevent injection attacks
        const validSearches = parsed.filter(isValidSavedSearch);
        if (validSearches.length !== parsed.length) {
          console.warn(`Filtered out ${parsed.length - validSearches.length} invalid saved searches`);
        }
        setSearches(validSearches);
      } catch (e) {
        console.error('Failed to parse saved searches', e);
        // Clear corrupted data
        localStorage.removeItem(STORAGE_KEY);
        toast({
          title: 'Saved searches were corrupted',
          description: 'Saved searches have been cleared.',
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  // Save to localStorage when searches change
  const persistSearches = (updatedSearches: SavedSearch[], successMessage?: string): boolean => {
    setSearches(updatedSearches);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSearches));
      if (successMessage) {
        toast({
          title: 'Success',
          description: successMessage,
        });
      }
      return true;
    } catch (e) {
      // Handle quota exceeded or other localStorage errors
      console.error('Failed to save searches to localStorage:', e);
      toast({
        title: 'Failed to save',
        description: 'Storage quota exceeded',
        variant: 'destructive',
      });
      return false;
    }
  };

  const handleSave = () => {
    if (!searchName.trim() || searchName.length > MAX_NAME_LENGTH) return;

    // Check max saved searches limit
    if (searches.length >= MAX_SAVED_SEARCHES) {
      toast({
        title: 'Maximum saved searches reached',
        description: `You can save up to ${MAX_SAVED_SEARCHES} searches. Delete some to add more.`,
        variant: 'destructive',
      });
      return;
    }

    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name: searchName.trim(),
      description: searchDescription.trim() || undefined,
      query: currentQuery,
      searchType: currentSearchType,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    const success = persistSearches([newSearch, ...searches], `Search "${searchName.trim()}" saved`);
    if (success) {
      setSaveDialogOpen(false);
      setSearchName('');
      setSearchDescription('');
    }
  };

  const handleEdit = (search: SavedSearch) => {
    setEditingSearch(search);
    setSearchName(search.name);
    setSearchDescription(search.description || '');
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!editingSearch || !searchName.trim() || searchName.length > MAX_NAME_LENGTH) return;

    const updatedSearches = searches.map((s) =>
      s.id === editingSearch.id
        ? { ...s, name: searchName.trim(), description: searchDescription.trim() || undefined }
        : s
    );

    persistSearches(updatedSearches, `Search "${searchName.trim()}" updated`);
    setEditDialogOpen(false);
    setEditingSearch(null);
    setSearchName('');
    setSearchDescription('');
  };

  const handleDelete = (id: string) => {
    const search = searches.find((s) => s.id === id);
    persistSearches(
      searches.filter((s) => s.id !== id),
      search ? `Search "${search.name}" deleted` : 'Search deleted'
    );
  };

  // Format relative timestamp with validation
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);

    // Validate date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Handle negative diff (future dates from clock skew)
    if (diff < 0) return 'Just now';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFilterSummary = (filters: ComponentFilterState) => {
    const parts: string[] = [];
    if (filters.suppliers?.length) parts.push(`${filters.suppliers.length} suppliers`);
    if (filters.lifecycleStatuses?.length) parts.push(`${filters.lifecycleStatuses.length} lifecycle`);
    if (filters.complianceFlags?.length) parts.push(`${filters.complianceFlags.length} compliance`);
    if (filters.riskLevels?.length) parts.push(`${filters.riskLevels.length} risk`);
    return parts.length ? parts.join(', ') : 'No filters';
  };

  const canSave = currentQuery.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Save Current Search Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSaveDialogOpen(true)}
        disabled={!canSave}
        className="w-full gap-2"
      >
        <BookmarkPlus className="h-4 w-4" />
        Save Current Search
      </Button>

      {/* Saved Searches List */}
      {searches.length > 0 ? (
        <div className="space-y-2">
          {searches.map((search) => (
            <div
              key={search.id}
              className="group flex items-start gap-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onLoadSearch(search)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onLoadSearch(search);
                }
              }}
            >
              <Bookmark className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{search.name}</div>
                {search.description && (
                  <div className="text-xs text-muted-foreground truncate" title={search.description}>
                    {sanitizeString(search.description)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  "{sanitizeString(search.query)}" ({search.searchType})
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {getFilterSummary(search.filters)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(search.createdAt)}
                  </span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Actions for {search.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(search)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(search.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">No saved searches yet</p>
          <p className="text-xs mt-1">Search for components, then save your search for quick access</p>
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
            <DialogDescription>
              Save your current search query and filters for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Search Name</Label>
              <Input
                id="search-name"
                placeholder="e.g., Active MCUs under $5"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                maxLength={MAX_NAME_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                {searchName.length}/{MAX_NAME_LENGTH} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-desc">Description (optional)</Label>
              <textarea
                id="search-desc"
                placeholder="Brief description of this search"
                value={searchDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSearchDescription(e.target.value)}
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-xs font-medium mb-2">Search Preview:</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">Query: "{currentQuery}"</Badge>
                <Badge variant="secondary">Type: {currentSearchType}</Badge>
                <Badge variant="outline">{getFilterSummary(currentFilters)}</Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!searchName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Search</DialogTitle>
            <DialogDescription>
              Update the name and description of your saved search
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Search Name</Label>
              <Input
                id="edit-name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                maxLength={MAX_NAME_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                {searchName.length}/{MAX_NAME_LENGTH} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description (optional)</Label>
              <textarea
                id="edit-desc"
                value={searchDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSearchDescription(e.target.value)}
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingSearch(null);
                setSearchName('');
                setSearchDescription('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={!searchName.trim()}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SavedSearches;
