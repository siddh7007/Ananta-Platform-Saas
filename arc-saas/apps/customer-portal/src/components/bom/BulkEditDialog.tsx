/**
 * Bulk Edit Dialog
 * CBP-P2-004: Bulk Line Item Operations
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useUpdateMany } from '@refinedev/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface BulkEditFormValues {
  updateQuantity: boolean;
  quantity?: number;
  updateFootprint: boolean;
  footprint?: string;
  updateNotes: boolean;
  notes?: string;
  updateDnp: boolean;
  dnp?: boolean;
  updatePriority: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkEditDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const { success, error: showError } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { isDirty },
  } = useForm<BulkEditFormValues>({
    defaultValues: {
      updateQuantity: false,
      updateFootprint: false,
      updateNotes: false,
      updateDnp: false,
      updatePriority: false,
    },
  });

  const { mutate: updateMany, isLoading } = useUpdateMany();

  const watchedFields = watch();

  // Check if any field is being updated
  const hasUpdates =
    (watchedFields.updateQuantity && watchedFields.quantity !== undefined) ||
    (watchedFields.updateFootprint && watchedFields.footprint) ||
    watchedFields.updateNotes ||
    watchedFields.updateDnp ||
    (watchedFields.updatePriority && watchedFields.priority);

  const onSubmit = (data: BulkEditFormValues) => {
    setError(null);
    const updates: Record<string, unknown> = {};

    if (data.updateQuantity && data.quantity !== undefined) {
      if (data.quantity < 1) {
        setError('Quantity must be at least 1');
        return;
      }
      updates.quantity = data.quantity;
    }

    if (data.updateFootprint && data.footprint) {
      updates.footprint = data.footprint.trim();
    }

    if (data.updateNotes) {
      updates.notes = data.notes?.trim() || '';
    }

    if (data.updateDnp) {
      updates.dnp = data.dnp;
    }

    if (data.updatePriority && data.priority) {
      updates.priority = data.priority;
    }

    if (Object.keys(updates).length === 0) {
      setError('Please select at least one field to update');
      return;
    }

    updateMany(
      {
        resource: 'bom-line-items',
        ids: selectedIds,
        values: updates,
      },
      {
        onSuccess: () => {
          success('Items updated', `Updated ${selectedIds.length} items`);
          reset();
          onOpenChange(false);
          onSuccess();
        },
        onError: (err) => {
          showError('Update failed', 'Please try again');
          setError(err.message || 'An error occurred');
        },
      }
    );
  };

  const handleClose = () => {
    reset();
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {selectedIds.length} Items</DialogTitle>
          <DialogDescription>
            Select fields to update. Only checked fields will be modified.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Quantity Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updateQuantity"
              {...register('updateQuantity')}
              className="mt-3"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="quantity" className="text-sm font-medium">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                disabled={!watchedFields.updateQuantity}
                placeholder="Enter quantity"
                {...register('quantity', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Set the same quantity for all selected items
              </p>
            </div>
          </div>

          {/* Footprint Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updateFootprint"
              {...register('updateFootprint')}
              className="mt-3"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="footprint" className="text-sm font-medium">
                Footprint / Package
              </Label>
              <Input
                id="footprint"
                disabled={!watchedFields.updateFootprint}
                placeholder="e.g., 0603, SOIC-8"
                {...register('footprint')}
              />
            </div>
          </div>

          {/* Notes Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updateNotes"
              {...register('updateNotes')}
              className="mt-3"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notes
              </Label>
              <Textarea
                id="notes"
                disabled={!watchedFields.updateNotes}
                placeholder="Add notes to selected items (leave empty to clear)"
                rows={2}
                {...register('notes')}
              />
            </div>
          </div>

          {/* DNP Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updateDnp"
              {...register('updateDnp')}
              className="mt-3"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="dnp" className="text-sm font-medium">
                Do Not Populate (DNP)
              </Label>
              <div className="flex items-center gap-2 pt-1">
                <Controller
                  name="dnp"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="dnp"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!watchedFields.updateDnp}
                    />
                  )}
                />
                <Label htmlFor="dnp" className="text-sm font-normal">
                  Mark as DNP
                </Label>
              </div>
            </div>
          </div>

          {/* Priority Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updatePriority"
              {...register('updatePriority')}
              className="mt-3"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="priority" className="text-sm font-medium">
                Priority
              </Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!watchedFields.updatePriority}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !hasUpdates}>
              {isLoading
                ? 'Updating...'
                : `Update ${selectedIds.length} Item${selectedIds.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default BulkEditDialog;
