/**
 * Change Role Dialog
 * CBP-P2-005: Organization Management - Change User Role
 */

import { useState } from 'react';
import { useUpdate } from '@refinedev/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSuccess?: () => void;
}

const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full organization management, user invitations, and settings access',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    value: 'engineer',
    label: 'Engineer',
    description: 'Can create, edit, and manage BOMs and components',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  {
    value: 'analyst',
    label: 'Analyst',
    description: 'Read-only access to view BOMs, reports, and analytics',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  engineer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  analyst: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  analyst: 'Analyst',
};

export function ChangeRoleDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
}: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  // API integration - uncomment when ready
  // const { mutate: updateMember, isLoading } = useUpdate();

  const handleSubmit = async () => {
    if (selectedRole === member.role) {
      onOpenChange(false);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // API call
      // await updateMember(
      //   {
      //     resource: 'team-members',
      //     id: member.id,
      //     values: { role: selectedRole },
      //   },
      //   {
      //     onSuccess: () => {
      //       success('Role updated', `${member.name}'s role has been updated`);
      //       onSuccess?.();
      //     },
      //     onError: (err) => {
      //       setError(err.message || 'Failed to update role');
      //     },
      //   }
      // );

      // Mock success
      await new Promise((resolve) => setTimeout(resolve, 500));
      success('Role updated', `${member.name}'s role has been updated to ${ROLE_LABELS[selectedRole]}`);
      onSuccess?.();
    } catch (err) {
      setError('Failed to update role. Please try again.');
      showError('Error', 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedRole(member.role);
    setError(null);
    onOpenChange(false);
  };

  const hasChanged = selectedRole !== member.role;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" aria-hidden="true" />
            Change Role
          </DialogTitle>
          <DialogDescription>
            Update the role for <strong>{member.name}</strong> ({member.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Role Display */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Current role:</span>
            <Badge className={ROLE_COLORS[member.role]}>
              {ROLE_LABELS[member.role] || member.role}
            </Badge>
            {hasChanged && (
              <>
                <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Badge className={ROLE_COLORS[selectedRole]}>
                  {ROLE_LABELS[selectedRole] || selectedRole}
                </Badge>
              </>
            )}
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label>Select new role</Label>
            <RadioGroup
              value={selectedRole}
              onValueChange={setSelectedRole}
              className="space-y-2"
            >
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  htmlFor={`role-${role.value}`}
                  className={`
                    flex items-start gap-3 p-3 border rounded-lg cursor-pointer
                    transition-colors hover:bg-muted/50
                    ${selectedRole === role.value ? 'border-primary bg-primary/5' : 'border-border'}
                  `}
                >
                  <RadioGroupItem
                    value={role.value}
                    id={`role-${role.value}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.label}</span>
                      <Badge variant="outline" className={role.color}>
                        {role.value}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {role.description}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Warning for downgrade */}
          {hasChanged && selectedRole === 'analyst' && member.role !== 'analyst' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Changing to Analyst role will remove the user's ability to create or modify BOMs and components.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanged || isSubmitting}>
            {isSubmitting && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            )}
            {hasChanged ? 'Update Role' : 'No Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChangeRoleDialog;
