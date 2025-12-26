/**
 * Tenant-related types
 */

import {
  TenantTier,
  TenantStatus,
  Contact,
  Address,
  ResourceData,
  TenantConfig,
} from './common.types';

export interface Tenant {
  id: string;
  key: string;
  name: string;
  status: TenantStatus;
  tier: TenantTier;
  domains: string[];
  contacts: Contact[];
  address?: Address;
  resources?: ResourceData[];
  config?: TenantConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantWithSubscription extends Tenant {
  subscription: {
    id: string;
    planId: string;
    tier: TenantTier;
    startDate: string;
    endDate: string;
    status: number;
  };
}

export interface TenantStatusUpdate {
  tenantId: string;
  status: TenantStatus;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface TenantResourceCreate {
  tenantId: string;
  resources: ResourceData[];
}
