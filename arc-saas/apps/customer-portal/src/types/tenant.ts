/**
 * Tenant types for the customer portal
 */

export interface Tenant {
  id: string;
  name: string;
  key: string;
  status: TenantStatus;
  planId?: string;
  planName?: string;
  createdOn?: string;
  domains?: string[];
}

export type TenantStatus = 'active' | 'pending' | 'suspended' | 'provisioning';

export interface TenantMember {
  id: string;
  userId: string;
  tenantId: string;
  roleKey: string;
  email: string;
  name?: string;
  status: 'active' | 'pending' | 'suspended';
  joinedAt?: string;
}

export interface TenantInvitation {
  id: string;
  email: string;
  roleKey: string;
  tenantId: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: string;
  createdAt: string;
}
