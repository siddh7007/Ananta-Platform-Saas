/**
 * Organization types for the customer portal
 * Aligned with tenant-management-service API contracts
 */

/**
 * Address for organization billing/shipping
 */
export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Organization (tenant) details
 */
export interface Organization {
  id: string;
  name: string;
  key: string; // Max 10 chars, alphanumeric
  slug?: string;
  domains?: string[];
  address?: Address;
  billingEmail?: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  size?: OrganizationSize;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Organization size categories
 */
export type OrganizationSize =
  | '1-10'
  | '11-50'
  | '51-200'
  | '201-500'
  | '501-1000'
  | '1000+';

/**
 * Organization status
 */
export type OrganizationStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'pending';

/**
 * Payload for updating organization settings
 */
export interface OrganizationUpdatePayload {
  name?: string;
  domains?: string[];
  address?: Address;
  billingEmail?: string;
  website?: string;
  industry?: string;
  size?: OrganizationSize;
}

/**
 * Organization settings (preferences)
 */
export interface OrganizationSettings {
  defaultCurrency?: string;
  timezone?: string;
  dateFormat?: string;
  language?: string;
  notifications?: NotificationSettings;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  emailDigest?: 'daily' | 'weekly' | 'never';
  bomAlerts?: boolean;
  usageAlerts?: boolean;
  billingAlerts?: boolean;
  securityAlerts?: boolean;
}

/**
 * Organization status display configuration
 */
export const ORG_STATUS_CONFIG: Record<
  OrganizationStatus,
  { label: string; color: string; description: string }
> = {
  active: {
    label: 'Active',
    color: 'green',
    description: 'Organization is active',
  },
  inactive: {
    label: 'Inactive',
    color: 'gray',
    description: 'Organization is inactive',
  },
  suspended: {
    label: 'Suspended',
    color: 'red',
    description: 'Organization has been suspended',
  },
  pending: {
    label: 'Pending',
    color: 'yellow',
    description: 'Organization setup is pending',
  },
};

/**
 * Get organization status badge color
 */
export function getOrgStatusColor(status: OrganizationStatus): string {
  const config = ORG_STATUS_CONFIG[status];
  switch (config?.color) {
    case 'green':
      return 'bg-green-100 text-green-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-700';
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Format address as single line
 */
export function formatAddress(address?: Address): string {
  if (!address) return '';
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Validate domain format
 */
export function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

/**
 * Organization size display labels
 */
export const ORG_SIZE_LABELS: Record<OrganizationSize, string> = {
  '1-10': '1-10 employees',
  '11-50': '11-50 employees',
  '51-200': '51-200 employees',
  '201-500': '201-500 employees',
  '501-1000': '501-1000 employees',
  '1000+': '1000+ employees',
};
