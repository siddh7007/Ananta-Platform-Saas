/**
 * Team and invitation types for the customer portal
 * Aligned with tenant-management-service API contracts
 */

import type { AppRole } from '@/config/auth';

/**
 * Team member status
 */
export type MemberStatus = 'active' | 'pending' | 'suspended';

/**
 * Invitation status
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

/**
 * Team member in a tenant
 */
export interface TeamMember {
  id: string;
  userId: string;
  tenantId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  roleKey: AppRole;
  status: MemberStatus;
  joinedAt?: string;
  lastActiveAt?: string;
}

/**
 * Invitation to join a tenant
 */
export interface Invitation {
  id: string;
  email: string;
  roleKey: AppRole;
  tenantId: string;
  invitedBy: string;
  invitedByName?: string;
  status: InvitationStatus;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Role definition
 */
export interface Role {
  key: AppRole;
  name: string;
  description?: string;
  level: number;
  permissions: string[];
}

/**
 * Request to invite a new member
 */
export interface InviteMemberRequest {
  email: string;
  roleKey: AppRole;
  tenantId: string;  // Required by backend (tenant_id = organization_id)
  message?: string;
}

/**
 * Request to update member role
 */
export interface UpdateMemberRoleRequest {
  userId: string;
  roleKey: AppRole;
}

/**
 * Activity log entry (UserActivity from Control Plane)
 */
export interface ActivityLogEntry {
  id: string;
  action: string; // e.g., 'user.created', 'user.login', 'user.role_changed'
  entityType?: string; // 'user', 'tenant', 'subscription', etc.
  entityId?: string;
  metadata?: Record<string, unknown>; // Changed fields, additional context
  ipAddress?: string;
  userAgent?: string;
  occurredAt: string; // Timestamp
  userId: string; // User who performed the action
  tenantId: string;
  // Relations (may be included if requested)
  user?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Legacy compatibility type (deprecated - use ActivityLogEntry)
 * @deprecated Use ActivityLogEntry instead
 */
export interface UserActivity extends ActivityLogEntry {
  userName?: string;
  createdAt: string; // Alias for occurredAt
}

// ============================================
// Display Configuration
// ============================================

/**
 * Member status display configuration
 */
export const MEMBER_STATUS_CONFIG: Record<
  MemberStatus,
  { label: string; color: string; description: string }
> = {
  active: {
    label: 'Active',
    color: 'green',
    description: 'Member is active and can access the workspace',
  },
  pending: {
    label: 'Pending',
    color: 'yellow',
    description: 'Member setup is pending',
  },
  suspended: {
    label: 'Suspended',
    color: 'red',
    description: 'Member access has been suspended',
  },
};

/**
 * Invitation status display configuration
 */
export const INVITATION_STATUS_CONFIG: Record<
  InvitationStatus,
  { label: string; color: string; description: string }
> = {
  pending: {
    label: 'Pending',
    color: 'yellow',
    description: 'Invitation is awaiting acceptance',
  },
  accepted: {
    label: 'Accepted',
    color: 'green',
    description: 'Invitation has been accepted',
  },
  expired: {
    label: 'Expired',
    color: 'gray',
    description: 'Invitation has expired',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'red',
    description: 'Invitation was cancelled',
  },
};

/**
 * Role display configuration (aligned with 5-level hierarchy)
 */
export const ROLE_CONFIG: Record<
  AppRole,
  { label: string; color: string; description: string; level: number }
> = {
  analyst: {
    label: 'Analyst',
    color: 'gray',
    description: 'Read-only access to data and reports',
    level: 1,
  },
  engineer: {
    label: 'Engineer',
    color: 'blue',
    description: 'Can manage BOMs and components',
    level: 2,
  },
  admin: {
    label: 'Admin',
    color: 'purple',
    description: 'Can manage team and organization settings',
    level: 3,
  },
  owner: {
    label: 'Owner',
    color: 'amber',
    description: 'Full control including billing and deletion',
    level: 4,
  },
  super_admin: {
    label: 'Super Admin',
    color: 'red',
    description: 'Platform-wide administrative access',
    level: 5,
  },
};

/**
 * Roles available for invitation (excludes super_admin)
 */
export const INVITABLE_ROLES: AppRole[] = ['analyst', 'engineer', 'admin', 'owner'];

// ============================================
// Helper Functions
// ============================================

/**
 * Get member status badge color class
 */
export function getMemberStatusColor(status: MemberStatus): string {
  const config = MEMBER_STATUS_CONFIG[status];
  switch (config?.color) {
    case 'green':
      return 'bg-green-100 text-green-700';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get invitation status badge color class
 */
export function getInvitationStatusColor(status: InvitationStatus): string {
  const config = INVITATION_STATUS_CONFIG[status];
  switch (config?.color) {
    case 'green':
      return 'bg-green-100 text-green-700';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get role badge color class
 */
export function getRoleColor(role: AppRole): string {
  const config = ROLE_CONFIG[role];
  switch (config?.color) {
    case 'blue':
      return 'bg-blue-100 text-blue-700';
    case 'purple':
      return 'bg-purple-100 text-purple-700';
    case 'amber':
      return 'bg-amber-100 text-amber-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get role label for display
 */
export function getRoleLabel(role: AppRole): string {
  return ROLE_CONFIG[role]?.label || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: AppRole): string {
  return ROLE_CONFIG[role]?.description || '';
}

/**
 * Check if invitation is expired
 */
export function isInvitationExpired(invitation: Invitation): boolean {
  if (invitation.status === 'expired') return true;
  return new Date(invitation.expiresAt) < new Date();
}

/**
 * Get time until invitation expires (human readable)
 */
export function getExpirationText(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} left`;
  }
  return 'Expiring soon';
}

/**
 * Format join date
 */
export function formatJoinDate(dateString?: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format last active date (relative)
 */
export function formatLastActive(dateString?: string): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get initials from name or email
 */
export function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if user can manage another user's role
 * (can only manage users with lower role level)
 */
export function canManageRole(managerRole: AppRole, targetRole: AppRole): boolean {
  const managerLevel = ROLE_CONFIG[managerRole]?.level || 0;
  const targetLevel = ROLE_CONFIG[targetRole]?.level || 0;
  return managerLevel > targetLevel;
}

/**
 * Get roles that a user can assign (lower than their own)
 */
export function getAssignableRoles(userRole: AppRole): AppRole[] {
  const userLevel = ROLE_CONFIG[userRole]?.level || 0;
  return INVITABLE_ROLES.filter((role) => {
    const roleLevel = ROLE_CONFIG[role]?.level || 0;
    return roleLevel < userLevel;
  });
}
