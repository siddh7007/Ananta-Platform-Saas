/**
 * MemberCard Component
 *
 * Displays a team member with avatar, role badge, and action buttons.
 * Actions are role-gated (admin+ can edit roles, owner+ can remove).
 * Supports bulk selection mode for batch operations.
 */

import { useState } from 'react';
import {
  MoreVertical,
  UserCog,
  UserMinus,
  Shield,
  Clock,
  Mail,
  Check,
} from 'lucide-react';
import type { AppRole } from '@/config/auth';
import { hasMinimumRole } from '@/config/auth';
import type { TeamMember } from '@/types/team';
import {
  getRoleColor,
  getRoleLabel,
  getMemberStatusColor,
  MEMBER_STATUS_CONFIG,
  getInitials,
  formatJoinDate,
  formatLastActive,
  canManageRole,
} from '@/types/team';
import { cn } from '@/lib/utils';

interface MemberCardProps {
  member: TeamMember;
  currentUserRole: AppRole;
  currentUserId?: string;
  onChangeRole?: (member: TeamMember) => void;
  onRemove?: (member: TeamMember) => void;
  /** Bulk selection mode */
  selectionMode?: boolean;
  /** Whether this member is selected */
  isSelected?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (member: TeamMember, selected: boolean) => void;
}

export function MemberCard({
  member,
  currentUserRole,
  currentUserId,
  onChangeRole,
  onRemove,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}: MemberCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isCurrentUser = currentUserId === member.userId;
  const isAdmin = hasMinimumRole(currentUserRole, 'admin');
  const isOwner = hasMinimumRole(currentUserRole, 'owner');
  const canEditRole = isAdmin && canManageRole(currentUserRole, member.roleKey) && !isCurrentUser;
  const canRemove = isOwner && !isCurrentUser && member.roleKey !== 'owner';
  const canSelect = !isCurrentUser && member.roleKey !== 'owner';

  const statusConfig = MEMBER_STATUS_CONFIG[member.status];

  const handleCardClick = () => {
    if (selectionMode && canSelect) {
      onSelectionChange?.(member, !isSelected);
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-shadow',
        selectionMode && canSelect && 'cursor-pointer',
        selectionMode && isSelected && 'ring-2 ring-primary border-primary',
        !selectionMode && 'hover:shadow-sm'
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox (selection mode) */}
        {selectionMode && (
          <div className="flex-shrink-0 pt-1">
            <div
              className={cn(
                'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
                !canSelect && 'opacity-30 cursor-not-allowed',
                isSelected
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted-foreground'
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
            </div>
          </div>
        )}

        {/* Avatar */}
        <div className="flex-shrink-0">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name || member.email}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium">
              {getInitials(member.name, member.email)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">
              {member.name || member.email.split('@')[0]}
            </h3>
            {isCurrentUser && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
            <Mail className="h-3 w-3" />
            <span className="truncate">{member.email}</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            {/* Role Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                getRoleColor(member.roleKey)
              )}
            >
              <Shield className="h-3 w-3" />
              {getRoleLabel(member.roleKey)}
            </span>

            {/* Status Badge */}
            {member.status !== 'active' && statusConfig && (
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  getMemberStatusColor(member.status)
                )}
                title={statusConfig.description}
              >
                {statusConfig.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {member.joinedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Joined {formatJoinDate(member.joinedAt)}
              </span>
            )}
            {member.lastActiveAt && (
              <span>Active {formatLastActive(member.lastActiveAt)}</span>
            )}
          </div>
        </div>

        {/* Actions Menu (hidden in selection mode) */}
        {!selectionMode && (canEditRole || canRemove) && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-md hover:bg-muted"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-md border bg-popover shadow-lg">
                  {canEditRole && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onChangeRole?.(member);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left"
                    >
                      <UserCog className="h-4 w-4" />
                      Change Role
                    </button>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onRemove?.(member);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left text-red-600"
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove Member
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberCard;
