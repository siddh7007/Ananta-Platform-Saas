/**
 * Bulk Actions Toolbar
 * CBP-P2-004: Bulk Line Item Operations
 */

import { useState } from 'react';
import { X, Edit, Zap, Download, Trash2, MoreHorizontal, Copy, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { BulkEditDialog } from './BulkEditDialog';
import { useToast } from '@/hooks/useToast';

interface BulkActionsToolbarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onBulkEnrich: (ids: string[]) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkExport: (ids: string[]) => void;
  onBulkDuplicate?: (ids: string[]) => Promise<void>;
  onBulkTag?: (ids: string[], tags: string[]) => Promise<void>;
}

export function BulkActionsToolbar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onBulkEnrich,
  onBulkDelete,
  onBulkExport,
  onBulkDuplicate,
  onBulkTag,
}: BulkActionsToolbarProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { success, error } = useToast();

  // Don't render if nothing selected
  if (selectedCount === 0) return null;

  const handleBulkEnrich = async () => {
    setIsProcessing(true);
    try {
      await onBulkEnrich(selectedIds);
      success('Enrichment started', `Processing ${selectedCount} items`);
      onClearSelection();
    } catch (e) {
      error('Enrichment failed', 'Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      await onBulkDelete(selectedIds);
      success('Items deleted', `Removed ${selectedCount} items`);
      onClearSelection();
    } catch (e) {
      error('Delete failed', 'Please try again');
    } finally {
      setIsProcessing(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleBulkDuplicate = async () => {
    if (!onBulkDuplicate) return;
    setIsProcessing(true);
    try {
      await onBulkDuplicate(selectedIds);
      success('Items duplicated', `Created ${selectedCount} copies`);
      onClearSelection();
    } catch (e) {
      error('Duplication failed', 'Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div
        className="sticky top-0 z-20 bg-primary text-primary-foreground px-4 py-2 flex items-center gap-4 rounded-t-lg shadow-md"
        role="toolbar"
        aria-label="Bulk actions"
      >
        {/* Clear Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-primary-foreground hover:bg-primary-foreground/10"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4 mr-1" aria-hidden="true" />
          Clear
        </Button>

        {/* Selection Count */}
        <span className="text-sm font-medium" aria-live="polite">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="flex-1" />

        {/* Primary Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
            disabled={isProcessing}
          >
            <Edit className="h-4 w-4 mr-1" aria-hidden="true" />
            Edit
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleBulkEnrich}
            disabled={isProcessing}
          >
            <Zap className="h-4 w-4 mr-1" aria-hidden="true" />
            Enrich
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onBulkExport(selectedIds)}
            disabled={isProcessing}
          >
            <Download className="h-4 w-4 mr-1" aria-hidden="true" />
            Export
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" disabled={isProcessing}>
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onBulkDuplicate && (
                <DropdownMenuItem onClick={handleBulkDuplicate}>
                  <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                  Duplicate selected
                </DropdownMenuItem>
              )}
              {onBulkTag && (
                <DropdownMenuItem>
                  <Tag className="h-4 w-4 mr-2" aria-hidden="true" />
                  Add tags
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                Delete selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        selectedIds={selectedIds}
        onSuccess={onClearSelection}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} items?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. These items will be permanently removed
              from this BOM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Deleting...' : `Delete ${selectedCount} items`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default BulkActionsToolbar;
