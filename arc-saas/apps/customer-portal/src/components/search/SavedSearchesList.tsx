/**
 * Saved Searches List
 * CBP-P2-003: Full management interface for saved searches
 */

import { useState } from 'react';
import { Star, Trash2, Edit2, Play, MoreVertical, Download, Upload } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSavedSearchesStore, type SavedSearch } from '@/stores/saved-searches';
import { type SearchFilters } from '@/hooks/useComponentSearch';
import { formatDistanceToNow, format } from 'date-fns';

interface SavedSearchesListProps {
  onApplySearch: (query: string, filters: SearchFilters) => void;
}

function getFilterCount(filters: SearchFilters): number {
  let count = 0;
  if (filters.categories?.length) count += filters.categories.length;
  if (filters.manufacturers?.length) count += filters.manufacturers.length;
  if (filters.packages?.length) count += filters.packages.length;
  if (filters.lifecycleStatuses?.length) count += filters.lifecycleStatuses.length;
  if (filters.capacitanceRange) count++;
  if (filters.resistanceRange) count++;
  if (filters.voltageRange) count++;
  if (filters.inStockOnly) count++;
  if (filters.qualityScoreMin !== undefined || filters.qualityScoreMax !== undefined) count++;
  if (filters.rohsCompliant) count++;
  if (filters.reachCompliant) count++;
  if (filters.aecQualified) count++;
  return count;
}

export function SavedSearchesList({ onApplySearch }: SavedSearchesListProps) {
  const {
    savedSearches,
    removeSavedSearch,
    renameSavedSearch,
    useSavedSearch,
    exportSavedSearches,
    importSavedSearches,
  } = useSavedSearchesStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleApply = (search: SavedSearch) => {
    const used = useSavedSearch(search.id);
    if (used) {
      onApplySearch(used.query, used.filters);
    }
  };

  const handleStartEdit = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditingName(search.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      renameSavedSearch(editingId, editingName);
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = (id: string) => {
    removeSavedSearch(id);
    setDeleteId(null);
  };

  const handleExport = () => {
    const json = exportSavedSearches();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saved-searches-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const success = importSavedSearches(text);
          if (!success) {
            setImportError('Invalid file format');
          }
        } catch {
          setImportError('Failed to read file');
        }
      }
    };
    input.click();
  };

  const searchToDelete = deleteId
    ? savedSearches.find((s) => s.id === deleteId)
    : null;

  if (savedSearches.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="h-12 w-12 mx-auto text-muted-foreground/50" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-medium">No saved searches</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Save searches from the component search page to quickly access them later
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {savedSearches.length} saved search{savedSearches.length !== 1 ? 'es' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" aria-hidden="true" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-1" aria-hidden="true" />
            Import
          </Button>
        </div>
      </div>

      {/* Import Error */}
      {importError && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {importError}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setImportError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Query</TableHead>
              <TableHead className="text-center">Filters</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="w-[100px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {savedSearches.map((search) => (
              <TableRow key={search.id}>
                <TableCell className="font-medium">
                  {editingId === search.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 w-40"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      {search.name}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm max-w-[200px] truncate">
                  {search.query || (
                    <span className="text-muted-foreground italic">No query</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">
                    {getFilterCount(search.filters)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {search.useCount}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(search.lastUsed), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleApply(search)}
                      aria-label={`Apply search "${search.name}"`}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="More options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEdit(search)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(search.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Search</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{searchToDelete?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SavedSearchesList;
