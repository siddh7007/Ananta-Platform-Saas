import { useList, useNavigation } from "@refinedev/core";
import { Plus, Pencil, Check, Users, Database, Zap, CreditCard } from "lucide-react";

interface PlanLimits {
  maxUsers: number | null;
  maxStorage: number | null;
  maxProjects: number | null;
  maxApiCalls: number | null;
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  tier: string;
  price: number;
  billingCycleId?: string;
  billingCycle?: string;
  features: string[];
  isActive: boolean;
  limits?: PlanLimits;
  trialEnabled?: boolean;
  trialDuration?: number;
  trialDurationUnit?: string;
  stripePriceId?: string;
  stripeProductId?: string;
}

function formatLimit(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unlimited";
  return value.toLocaleString();
}

function getTierColor(tier: string): string {
  switch (tier.toUpperCase()) {
    case "FREE":
      return "bg-gray-100 text-gray-700";
    case "BASIC":
      return "bg-blue-100 text-blue-700";
    case "STANDARD":
      return "bg-purple-100 text-purple-700";
    case "PREMIUM":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function PlanList() {
  const { data, isLoading } = useList<Plan>({ resource: "plans" });
  const { create, edit } = useNavigation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-muted-foreground">
            Manage subscription plans and pricing
          </p>
        </div>
        <button
          onClick={() => create("plans")}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Plan
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/2 mb-4" />
              <div className="h-10 bg-muted rounded w-3/4 mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-4/6" />
              </div>
            </div>
          ))
        ) : data?.data?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No plans found. Create your first plan to get started.
          </div>
        ) : (
          data?.data?.map((plan) => (
            <div
              key={plan.id}
              className="rounded-lg border bg-card p-6 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full uppercase ${getTierColor(plan.tier)}`}>
                  {plan.tier}
                </span>
                <div className="flex items-center gap-2">
                  {plan.trialEnabled && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {plan.trialDuration} {plan.trialDurationUnit} trial
                    </span>
                  )}
                  {plan.isActive ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Plan Name & Description */}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              {plan.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {plan.description}
                </p>
              )}

              {/* Pricing */}
              <div className="mt-4 mb-4">
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/{plan.billingCycleId || plan.billingCycle || "month"}</span>
              </div>

              {/* Limits Summary */}
              {plan.limits && (
                <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span>{formatLimit(plan.limits.maxUsers)} users</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span>{formatLimit(plan.limits.maxStorage)} GB</span>
                  </div>
                </div>
              )}

              {/* Features */}
              <ul className="space-y-2 flex-1">
                {plan.features?.slice(0, 5).map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="line-clamp-1">{feature}</span>
                  </li>
                ))}
                {plan.features?.length > 5 && (
                  <li className="text-sm text-muted-foreground pl-6">
                    +{plan.features.length - 5} more features
                  </li>
                )}
              </ul>

              {/* Stripe Status */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    <span className="text-muted-foreground">Stripe:</span>
                  </div>
                  {plan.stripePriceId ? (
                    <span className="text-green-600">Connected</span>
                  ) : (
                    <span className="text-amber-600">Not configured</span>
                  )}
                </div>
              </div>

              {/* Edit Button */}
              <button
                onClick={() => edit("plans", plan.id)}
                className="mt-4 w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Plan
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
