/**
 * RoleDropdown Component
 *
 * Reusable role selector with role descriptions.
 * Only shows roles the current user can assign.
 */

import { useState } from 'react';
import { ChevronDown, Shield, Check } from 'lucide-react';
import type { AppRole } from '@/config/auth';
import {
  ROLE_CONFIG,
  getRoleColor,
  getRoleLabel,
  getAssignableRoles,
  INVITABLE_ROLES,
} from '@/types/team';
import { cn } from '@/lib/utils';

interface RoleDropdownProps {
  value: AppRole;
  onChange: (role: AppRole) => void;
  currentUserRole: AppRole;
  disabled?: boolean;
  showAllRoles?: boolean; // If true, shows all invitable roles regardless of user level
  className?: string;
}

export function RoleDropdown({
  value,
  onChange,
  currentUserRole,
  disabled = false,
  showAllRoles = false,
  className,
}: RoleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const availableRoles = showAllRoles
    ? INVITABLE_ROLES
    : getAssignableRoles(currentUserRole);

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-2 w-full px-3 py-2 border rounded-md bg-background text-left',
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              getRoleColor(value)
            )}
          >
            <Shield className="h-3 w-3" />
            {getRoleLabel(value)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 border rounded-md bg-popover shadow-lg max-h-64 overflow-auto">
            {availableRoles.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No roles available to assign
              </div>
            ) : (
              availableRoles.map((role) => {
                const config = ROLE_CONFIG[role];
                const isSelected = role === value;

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      onChange(role);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex items-start gap-3 w-full px-3 py-2 text-left hover:bg-muted',
                      isSelected && 'bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-0.5',
                        getRoleColor(role)
                      )}
                    >
                      <Shield className="h-3 w-3" />
                      {config.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {config.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary mt-0.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default RoleDropdown;
