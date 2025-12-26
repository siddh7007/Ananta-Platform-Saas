/**
 * Hook to get the current user's tenant plan ID
 *
 * This hook fetches the subscription for the current user's tenant
 * and returns the planId, which is used for plan-based feature gating
 * in navigation and resource access.
 *
 * @see navigation.ts for plan-based filtering
 * @see platform.config.ts for plan feature definitions
 */

import { useGetIdentity, useCustom } from "@refinedev/core";
import { useMemo } from "react";
import { logger } from "../lib/logger";

export interface TenantPlanInfo {
  /** The plan ID (e.g., 'plan-basic', 'plan-standard', 'plan-premium') */
  planId: string | undefined;
  /** The subscription status */
  status: string | undefined;
  /** Whether the data is loading */
  isLoading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Refetch the subscription data */
  refetch: () => void;
}

interface Identity {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
}

/**
 * Custom hook to get the current user's tenant plan information.
 *
 * Fetches the active subscription for the user's tenant and extracts the planId.
 * This is used by navigation filtering to gate features based on plan tier.
 *
 * @returns TenantPlanInfo object with planId, status, isLoading, error, and refetch
 *
 * @example
 * ```tsx
 * const { planId, isLoading } = useTenantPlan();
 *
 * // Use in navigation filtering
 * const resources = getResourcesForRole(userRole, planId);
 *
 * // Check feature access
 * if (isPlanFeatureEnabled(planId, 'billing')) {
 *   // Show billing feature
 * }
 * ```
 */
export function useTenantPlan(): TenantPlanInfo {
  // Get current user identity to extract tenantId
  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>();

  // Extract tenantId from identity (might be in the JWT or user profile)
  // Note: For admin users, tenantId might not be set (they manage all tenants)
  const tenantId = identity?.tenantId;

  // Fetch active subscription for the tenant
  // Use useCustom to call a custom endpoint or useOne with a filter
  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    refetch,
  } = useCustom<{ data: Subscription[] }>({
    url: "subscriptions",
    method: "get",
    config: {
      query: {
        // Filter by tenant and active status
        ...(tenantId ? { tenantId } : {}),
        status: "active",
        // Limit to 1 result since we only need the active subscription
        limit: 1,
      },
    },
    queryOptions: {
      // Only fetch if we have a tenantId (non-admin users)
      // Admin users without tenantId get undefined planId (full access)
      enabled: !!tenantId,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      refetchOnWindowFocus: false,
    },
  });

  // Extract planId from the subscription response
  const result = useMemo((): TenantPlanInfo => {
    // If user is admin without tenantId, they have full access (no plan restriction)
    if (!tenantId && !identityLoading) {
      logger.debug("[useTenantPlan] No tenantId - admin user with full access");
      // Clear cached planId for admin users (no restriction)
      setCachedPlanId(undefined);
      return {
        planId: undefined, // No plan restriction
        status: undefined,
        isLoading: false,
        error: null,
        refetch,
      };
    }

    // If still loading
    if (identityLoading || subscriptionLoading) {
      return {
        planId: undefined,
        status: undefined,
        isLoading: true,
        error: null,
        refetch,
      };
    }

    // If there was an error
    if (subscriptionError) {
      logger.warn("[useTenantPlan] Failed to fetch subscription", {
        error: subscriptionError,
        tenantId,
      });
      return {
        planId: undefined,
        status: undefined,
        isLoading: false,
        error: subscriptionError as unknown as Error,
        refetch,
      };
    }

    // Extract subscription from response
    const subscriptions = subscriptionData?.data?.data;
    const activeSubscription = Array.isArray(subscriptions) ? subscriptions[0] : null;

    if (!activeSubscription) {
      logger.debug("[useTenantPlan] No active subscription found", { tenantId });
      return {
        planId: undefined,
        status: undefined,
        isLoading: false,
        error: null,
        refetch,
      };
    }

    logger.debug("[useTenantPlan] Found active subscription", {
      planId: activeSubscription.planId,
      status: activeSubscription.status,
      tenantId,
    });

    // Cache the planId for use outside React components
    setCachedPlanId(activeSubscription.planId);

    return {
      planId: activeSubscription.planId,
      status: activeSubscription.status,
      isLoading: false,
      error: null,
      refetch,
    };
  }, [
    tenantId,
    identityLoading,
    subscriptionLoading,
    subscriptionError,
    subscriptionData,
    refetch,
  ]);

  return result;
}

/**
 * Internal cache for plan ID (set by useTenantPlan hook)
 * Note: This is internal implementation detail - use the hook to access planId
 */
let cachedPlanId: string | undefined;

/**
 * Set the cached plan ID (called internally by useTenantPlan)
 * @internal
 */
export function setCachedPlanId(planId: string | undefined): void {
  cachedPlanId = planId;
}

export default useTenantPlan;
