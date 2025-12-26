/**
 * Invite User Dialog
 * CBP-P2-005: Organization Management - Invite New Team Members
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useCreate } from '@refinedev/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface InviteFormData {
  email: string;
  role: string;
  message?: string;
}

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full organization management access' },
  { value: 'engineer', label: 'Engineer', description: 'Can manage BOMs and components' },
  { value: 'analyst', label: 'Analyst', description: 'Read-only access to data and reports' },
];

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const { success, error: showError } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({
    defaultValues: {
      email: '',
      role: 'engineer',
      message: '',
    },
  });

  // API integration - uncomment when ready
  // const { mutate: createInvitation, isLoading } = useCreate();

  // Mock loading state
  const isLoading = false;

  const onSubmit = async (data: InviteFormData) => {
    setError(null);

    try {
      // API call
      // await createInvitation(
      //   { resource: 'invitations', values: data },
      //   {
      //     onSuccess: () => {
      //       success('Invitation sent', `Invitation sent to ${data.email}`);
      //       reset();
      //       onSuccess?.();
      //     },
      //     onError: (err) => {
      //       setError(err.message || 'Failed to send invitation');
      //     },
      //   }
      // );

      // Mock success
      await new Promise((resolve) => setTimeout(resolve, 500));
      success('Invitation sent', `Invitation sent to ${data.email}`);
      reset();
      onSuccess?.();
    } catch (err) {
      setError('Failed to send invitation. Please try again.');
      showError('Error', 'Failed to send invitation');
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" aria-hidden="true" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a new member to your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Controller
              name="role"
              control={control}
              rules={{ required: 'Role is required' }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="invite-role" aria-describedby="role-description">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span>{role.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {role.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p id="role-description" className="text-xs text-muted-foreground">
              The role determines what the member can access and modify.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-message">
              Personal Message <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="invite-message"
              placeholder="Add a personal note to the invitation..."
              {...register('message')}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {(isSubmitting || isLoading) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InviteUserDialog;
