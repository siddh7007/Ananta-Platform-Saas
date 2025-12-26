/**
 * Subscription Card Component
 *
 * Displays current subscription status with role-based action buttons.
 * - All users: View plan name, status, period
 * - Owner only: "Manage Billing" and "Change Plan" buttons
 */

import { CreditCard, Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Subscription } from '@/types/subscription';
import type { AppRole } from '@/config/auth';
import { hasMinimumRole } from '@/config/auth';
import {
  SUBSCRIPTION_STATUS_CONFIG,
  PLAN_TIER_CONFIG,
  getSubscriptionStatusColor,
  getPlanTierColor,
  formatCurrency,
  formatInterval,
} from '@/types/subscription';

export interface SubscriptionCardProps {
  subscription: Subscription | null;
  userRole: AppRole;
  isLoading?: boolean;
  onManageBilling?: () => void;
  onChangePlan?: () => void;
}

export function SubscriptionCard({
  subscription,
  userRole,
  isLoading = false,
  onManageBilling,
  onChangePlan,
}: SubscriptionCardProps) {
  const isOwner = hasMinimumRole(userRole, 'owner');

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // No subscription state
  if (!subscription) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span>No active subscription</span>
        </div>
        {isOwner && onChangePlan && (
          <button
            onClick={onChangePlan}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Choose a Plan
          </button>
        )}
      </div>
    );
  }

  const statusConfig = SUBSCRIPTION_STATUS_CONFIG[subscription.status];
  const plan = subscription.plan;
  const tierConfig = plan?.tier ? PLAN_TIER_CONFIG[plan.tier] : null;

  // Format dates
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {plan?.name || 'Current Plan'}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {tierConfig && (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      getPlanTierColor(plan!.tier)
                    )}
                  >
                    {tierConfig.label}
                  </span>
                )}
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    getSubscriptionStatusColor(subscription.status)
                  )}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* Price */}
          {plan && (
            <div className="text-right">
              <div className="text-2xl font-bold">
                {formatCurrency(plan.price, plan.currency)}
              </div>
              <div className="text-sm text-muted-foreground">
                per {formatInterval(plan.interval)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-6 space-y-4">
        {/* Status message */}
        {statusConfig.description && subscription.status !== 'active' && (
          <div
            className={cn(
              'p-3 rounded-md text-sm',
              subscription.status === 'past_due'
                ? 'bg-red-50 text-red-700'
                : subscription.status === 'trialing'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-yellow-50 text-yellow-700'
            )}
          >
            {statusConfig.description}
          </div>
        )}

        {/* Billing period */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            Current period: {formatDate(subscription.currentPeriodStart)} -{' '}
            {formatDate(subscription.currentPeriodEnd)}
          </span>
        </div>

        {/* Trial info */}
        {subscription.trialEnd && subscription.status === 'trialing' && (
          <div className="text-sm text-blue-600">
            Trial ends: {formatDate(subscription.trialEnd)}
          </div>
        )}

        {/* Cancellation info */}
        {subscription.cancelAt && (
          <div className="text-sm text-red-600">
            Cancels on: {formatDate(subscription.cancelAt)}
          </div>
        )}

        {/* Features preview */}
        {plan?.features && plan.features.length > 0 && (
          <div className="pt-2">
            <div className="text-sm font-medium mb-2">Plan includes:</div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {plan.features.slice(0, 3).map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {feature}
                </li>
              ))}
              {plan.features.length > 3 && (
                <li className="text-primary text-xs">
                  +{plan.features.length - 3} more features
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Actions - Owner only */}
      {isOwner && (onManageBilling || onChangePlan) && (
        <div className="px-6 pb-6 pt-2 flex gap-3">
          {onManageBilling && (
            <button
              onClick={onManageBilling}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              Manage Billing
            </button>
          )}
          {onChangePlan && (
            <button
              onClick={onChangePlan}
              className="px-4 py-2 border rounded-md hover:bg-muted text-sm font-medium"
            >
              Change Plan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SubscriptionCard;
