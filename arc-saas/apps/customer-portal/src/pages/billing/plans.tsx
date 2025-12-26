/**
 * Plan Selection Page
 *
 * Displays available plans for upgrade/downgrade.
 * Owner can select a plan and proceed to Stripe Checkout.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Crown, Loader2, AlertCircle, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPlans,
  getCurrentSubscription,
  openPlanCheckout,
  StripePortalError,
} from '@/services/billing.service';
import type { Plan, Subscription } from '@/types/subscription';
import {
  formatCurrency,
  formatInterval,
  getPlanTierColor,
  PLAN_TIER_CONFIG,
} from '@/types/subscription';
import { cn } from '@/lib/utils';

export default function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  const isOwner = user?.role === 'owner' || user?.role === 'super_admin';

  // Load plans and current subscription
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [plansData, subscriptionData] = await Promise.all([
          getPlans(),
          getCurrentSubscription().catch(() => null),
        ]);

        setPlans(plansData);
        setCurrentSubscription(subscriptionData);
      } catch (err) {
        console.error('Failed to load plans:', err);
        setError('Failed to load available plans');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter plans by billing interval
  const filteredPlans = plans.filter((plan) => plan.interval === billingInterval);

  // Sort plans by price
  const sortedPlans = [...filteredPlans].sort((a, b) => a.price - b.price);

  const handleSelectPlan = async (planId: string) => {
    if (!isOwner) {
      setError('Only the organization owner can change plans');
      return;
    }

    if (planId === currentSubscription?.planId) {
      setError('You are already on this plan');
      return;
    }

    setSelectedPlanId(planId);
    setIsProcessing(true);
    setError(null);

    try {
      const result = await openPlanCheckout(planId);

      if (result.success && result.url) {
        window.location.href = result.url;
        return;
      }
      if (!result.success && result.error) {
        throw result.error;
      }
      throw new Error('Missing checkout URL');
    } catch (err) {
      console.error('Failed to open checkout:', err);

      if (err instanceof StripePortalError) {
        setError(err.message);
      } else {
        setError('Failed to process plan change. Please try again.');
      }

      setSelectedPlanId(null);
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    navigate('/billing');
  };

  const getPlanButtonText = (plan: Plan) => {
    if (!currentSubscription) {
      return 'Get Started';
    }

    if (plan.id === currentSubscription.planId) {
      return 'Current Plan';
    }

    const currentPlan = plans.find((p) => p.id === currentSubscription.planId);
    if (currentPlan && plan.price > currentPlan.price) {
      return 'Upgrade';
    }

    return 'Downgrade';
  };

  const isPlanCurrent = (planId: string) => planId === currentSubscription?.planId;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Back to billing"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Select the plan that best fits your team's needs
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Non-owner warning */}
      {!isOwner && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-700">
            Only the organization owner can change plans. Contact your admin to upgrade.
          </p>
        </div>
      )}

      {/* Billing interval toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setBillingInterval('month')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              billingInterval === 'month'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('year')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              billingInterval === 'year'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Yearly
            <span className="ml-2 text-xs text-green-600 font-semibold">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      {sortedPlans.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No plans available</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedPlans.map((plan) => {
            const isCurrent = isPlanCurrent(plan.id);
            const isSelected = selectedPlanId === plan.id;

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative bg-card border rounded-xl p-6 flex flex-col transition-all',
                  plan.isPopular && 'border-primary shadow-lg ring-2 ring-primary/20',
                  isCurrent && 'border-green-500 bg-green-50/50',
                  !isCurrent && !plan.isPopular && 'hover:border-primary/50'
                )}
              >
                {/* Popular badge */}
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                      <Zap className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                      <Check className="h-3 w-3" />
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        getPlanTierColor(plan.tier)
                      )}
                    >
                      {PLAN_TIER_CONFIG[plan.tier]?.label || plan.tier}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                </div>

                {/* Pricing */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {formatCurrency(plan.price, plan.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      /{formatInterval(plan.interval)}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex-1 mb-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Limits */}
                <div className="mb-6 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Includes:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-semibold">{plan.limits.maxBoms.toLocaleString()}</span>{' '}
                      BOMs
                    </div>
                    <div>
                      <span className="font-semibold">{plan.limits.maxUsers.toLocaleString()}</span>{' '}
                      Users
                    </div>
                    <div>
                      <span className="font-semibold">
                        {plan.limits.maxComponentLookups.toLocaleString()}
                      </span>{' '}
                      Lookups
                    </div>
                    <div>
                      <span className="font-semibold">
                        {plan.limits.maxApiCalls.toLocaleString()}
                      </span>{' '}
                      API calls
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent || !isOwner || isProcessing}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                    isCurrent
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : plan.isPopular
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
                        : 'bg-muted hover:bg-muted/80 disabled:opacity-50'
                  )}
                >
                  {isSelected && isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrent ? (
                    <>
                      <Check className="h-4 w-4" />
                      Current Plan
                    </>
                  ) : (
                    getPlanButtonText(plan)
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Enterprise CTA */}
      <div className="mt-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-8 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <Crown className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Need a custom solution?</h3>
              <p className="text-slate-300">
                Enterprise plans include dedicated support, custom limits, and SLA guarantees.
              </p>
            </div>
          </div>
          <button
            onClick={() => window.open('mailto:sales@example.com', '_blank')}
            className="px-6 py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
}
