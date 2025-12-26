import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BomInfo {
  id: string;
  name: string;
  lineItemCount?: number;
  createdAt?: string;
}

interface DeleteBomDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** BOM to delete */
  bom: BomInfo | null;
  /** Callback when deletion is confirmed */
  onConfirm: (bomId: string) => Promise<void>;
  /** Whether deletion is in progress */
  isDeleting?: boolean;
}

/**
 * Confirmation dialog for BOM deletion with type-to-confirm safeguard.
 * Requires typing the BOM name to prevent accidental deletions.
 */
export function DeleteBomDialog({
  open,
  onOpenChange,
  bom,
  onConfirm,
  isDeleting = false,
}: DeleteBomDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isConfirmEnabled = bom && confirmText === bom.name;

  const handleConfirm = async () => {
    if (!bom || !isConfirmEnabled) return;

    try {
      setError(null);
      await onConfirm(bom.id);
      setConfirmText('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete BOM');
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    setError(null);
    onOpenChange(false);
  };

  if (!bom) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <AlertDialogTitle className="text-center">Delete BOM</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Are you sure you want to delete this Bill of Materials? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 space-y-4">
          {/* BOM Details */}
          <div className="rounded-md bg-muted p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{bom.name}</span>
            </div>
            {bom.lineItemCount !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Line Items:</span>
                <span className="font-medium">{bom.lineItemCount}</span>
              </div>
            )}
            {bom.createdAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium">
                  {new Date(bom.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirm-name" className="text-sm">
              Type <span className="font-semibold text-red-600">"{bom.name}"</span> to confirm:
            </Label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Enter BOM name to confirm"
              className={confirmText && !isConfirmEnabled ? 'border-red-300' : ''}
              disabled={isDeleting}
              autoComplete="off"
            />
            {confirmText && !isConfirmEnabled && (
              <p className="text-xs text-red-500">
                Name doesn't match. Please type exactly: {bom.name}
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleCancel} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete BOM
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteBomDialog;
