/**
 * Example: BomList with Swipeable Rows
 *
 * This is a reference implementation showing how to integrate
 * SwipeableBomRow into the existing BomList component.
 *
 * Key integration points:
 * 1. Wrap each BOM card/row with SwipeableBomRow
 * 2. Pass appropriate callbacks based on user permissions
 * 3. Handle share, edit, delete actions
 * 4. Maintain responsive design for desktop/mobile
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useList, useDelete } from '@refinedev/core';
import { Share2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole, AppRole } from '@/config/auth';
import { SwipeableBomRow } from './SwipeableBomRow';
import { DeleteBomDialog, type BomInfo } from './DeleteBomDialog';
import { useToast } from '@/hooks/useToast';
import { StatusBadge } from '@/components/ui/status-badge';
import { getBomStatusType, getBomStatusLabel } from '@/lib/bom-status';
import type { Bom } from '@/types/bom';

/**
 * BOM Card Content Component
 * This is the content that gets wrapped by SwipeableBomRow
 */
function BomCard({ bom, onClick }: { bom: Bom; onClick?: () => void }) {
  const enrichmentProgress = Math.round((bom.enrichedCount / bom.lineCount) * 100);

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 bg-card cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* BOM Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate">{bom.name}</h3>
        {bom.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {bom.description}
          </p>
        )}
      </div>

      {/* Status & Metrics */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs text-muted-foreground">
            {bom.lineCount} lines
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={enrichmentProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  'h-full transition-all',
                  enrichmentProgress === 100
                    ? 'bg-green-500'
                    : enrichmentProgress > 50
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                )}
                style={{ width: `${enrichmentProgress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right">
              {enrichmentProgress}%
            </span>
          </div>
        </div>

        <StatusBadge
          status={getBomStatusType(bom.status)}
          customLabel={getBomStatusLabel(bom.status)}
          size="sm"
        />
      </div>
    </div>
  );
}

/**
 * BomList with Swipeable Rows
 * Mobile-optimized list with swipe-to-reveal actions
 */
export function BomListWithSwipe() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bomToDelete, setBomToDelete] = useState<BomInfo | null>(null);

  // Permission checks
  const canEdit = hasMinimumRole((user?.role as AppRole) || 'analyst', 'engineer');
  const canDelete = hasMinimumRole((user?.role as AppRole) || 'analyst', 'admin');
  const canShare = true; // All users can share

  // Fetch BOMs
  const { data, isLoading, isError, refetch } = useList<Bom>({
    resource: 'boms',
    sorters: [{ field: 'createdAt', order: 'desc' }],
    pagination: { current: 1, pageSize: 20 },
    meta: {
      dataProviderName: 'cns',
    },
  });

  const { mutateAsync: deleteBomAsync, isLoading: isDeleting } = useDelete();

  const boms = data?.data || [];

  // Action Handlers

  const handleViewBom = useCallback((bom: Bom) => {
    navigate(`/boms/${bom.id}`);
  }, [navigate]);

  const handleEditBom = useCallback((bom: Bom) => {
    if (!canEdit) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to edit BOMs.',
      });
      return;
    }
    navigate(`/boms/${bom.id}/edit`);
  }, [navigate, canEdit, toast]);

  const handleShareBom = useCallback((bom: Bom) => {
    // Share via Web Share API (if available)
    if (navigator.share) {
      navigator.share({
        title: bom.name,
        text: `Check out this BOM: ${bom.name}`,
        url: `${window.location.origin}/boms/${bom.id}`,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      });
    } else {
      // Fallback: Copy link to clipboard
      const url = `${window.location.origin}/boms/${bom.id}`;
      navigator.clipboard.writeText(url).then(() => {
        toast({
          title: 'Link Copied',
          description: 'BOM link copied to clipboard.',
        });
      }).catch(() => {
        toast({
          variant: 'destructive',
          title: 'Share Failed',
          description: 'Could not copy link to clipboard.',
        });
      });
    }
  }, [toast]);

  const handleDeleteBomClick = useCallback((bom: Bom) => {
    if (!canDelete) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to delete BOMs.',
      });
      return;
    }

    setBomToDelete({
      id: bom.id,
      name: bom.name,
      lineItemCount: bom.lineCount,
      createdAt: bom.createdAt,
    });
    setDeleteDialogOpen(true);
  }, [canDelete, toast]);

  const handleDeleteConfirm = useCallback(async (bomId: string) => {
    try {
      await deleteBomAsync({
        resource: 'boms',
        id: bomId,
        meta: { dataProviderName: 'cns' },
      });

      toast({
        title: 'BOM Deleted',
        description: 'The BOM has been successfully deleted.',
      });

      await refetch();
    } catch (error) {
      throw error; // Let DeleteBomDialog handle error display
    }
  }, [deleteBomAsync, refetch, toast]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium">Failed to load BOMs</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          There was an error loading your BOMs. Please try again.
        </p>
      </div>
    );
  }

  // Empty state
  if (boms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Share2 className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No BOMs found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your first BOM to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {/* Instructions for mobile users */}
        <div className="lg:hidden mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Swipe left on any BOM to reveal actions
          </p>
        </div>

        {/* BOM List with Swipeable Rows */}
        <div className="divide-y border rounded-lg overflow-hidden">
          {boms.map((bom) => (
            <SwipeableBomRow
              key={bom.id}
              bom={bom}
              onShare={canShare ? handleShareBom : undefined}
              onEdit={canEdit ? handleEditBom : undefined}
              onDelete={canDelete ? handleDeleteBomClick : undefined}
              showShare={canShare}
              showEdit={canEdit}
              showDelete={canDelete}
              className="hover:bg-accent/30 transition-colors"
            >
              <BomCard bom={bom} onClick={() => handleViewBom(bom)} />
            </SwipeableBomRow>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteBomDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        bom={bomToDelete}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
}

export default BomListWithSwipe;
