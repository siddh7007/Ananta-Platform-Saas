import { useShow, useNavigation, useUpdate, useList } from "@refinedev/core";
import { useParams } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  DollarSign,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ban,
  RefreshCw,
  TrendingUp,
  Receipt,
  Settings,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Subscription {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantKey: string;
  planId: string;
  planName: string;
  planTier: "free" | "basic" | "standard" | "premium" | "FREE" | "BASIC" | "STANDARD" | "PREMIUM";
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused" | "expired";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  amount: number;
  currency: string;
  billingCycle: "monthly" | "yearly";
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  cancelReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "void";
  dueDate: string;
  paidAt?: string;
  createdAt: string;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  price: number;
  billingCycle: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700", icon: CheckCircle },
  trialing: { label: "Trialing", color: "bg-blue-100 text-blue-700", icon: Clock },
  past_due: { label: "Past Due", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
  paused: { label: "Paused", color: "bg-gray-100 text-gray-700", icon: Ban },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-600", icon: XCircle },
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-500",
};

export function SubscriptionShow() {
  const { id } = useParams();
  const { list, show: showResource } = useNavigation();
  const { queryResult } = useShow<Subscription>({ resource: "subscriptions", id });
  const { data, isLoading, refetch } = queryResult;
  const subscription = data?.data;

  const { mutate: updateSubscription, isLoading: isUpdating } = useUpdate();

  // Fetch invoices for this subscription
  const { data: invoicesData } = useList<Invoice>({
    resource: "invoices",
    filters: [{ field: "subscriptionId", operator: "eq", value: id }],
    pagination: { pageSize: 10 },
  });

  // Fetch available plans for upgrade/downgrade
  const { data: plansData } = useList<Plan>({ resource: "plans" });

  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const invoices = invoicesData?.data || [];
  const plans = plansData?.data || [];

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handlePause = () => {
    if (confirm("Are you sure you want to pause this subscription?")) {
      updateSubscription(
        { resource: "subscriptions", id: id!, values: { status: "paused" } },
        { onSuccess: () => refetch() }
      );
    }
  };

  const handleResume = () => {
    updateSubscription(
      { resource: "subscriptions", id: id!, values: { status: "active" } },
      { onSuccess: () => refetch() }
    );
  };

  const handleCancel = () => {
    const reason = prompt("Please provide a reason for cancellation (optional):");
    if (confirm("Are you sure you want to cancel this subscription? The tenant will lose access at the end of the billing period.")) {
      updateSubscription(
        {
          resource: "subscriptions",
          id: id!,
          values: { cancelAtPeriodEnd: true, cancelReason: reason || undefined },
        },
        { onSuccess: () => refetch() }
      );
    }
  };

  const handleChangePlan = () => {
    if (!selectedPlanId) return;
    updateSubscription(
      { resource: "subscriptions", id: id!, values: { planId: selectedPlanId } },
      {
        onSuccess: () => {
          refetch();
          setShowChangePlanModal(false);
        },
      }
    );
  };

  const handleCancelPendingCancellation = () => {
    updateSubscription(
      { resource: "subscriptions", id: id!, values: { cancelAtPeriodEnd: false } },
      { onSuccess: () => refetch() }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center py-12 text-muted-foreground">Subscription not found</div>
    );
  }

  const statusConfig = STATUS_CONFIG[subscription.status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;
  const daysRemaining = getDaysRemaining(subscription.currentPeriodEnd);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => list("subscriptions")} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{subscription.tenantName}</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                statusConfig.color
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </span>
          </div>
          <p className="text-muted-foreground">
            Subscription ID: {subscription.id}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => showResource("tenants", subscription.tenantId)}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Building className="mr-2 h-4 w-4" />
            View Tenant
          </button>
        </div>
      </div>

      {/* Alert for pending cancellation */}
      {subscription.cancelAtPeriodEnd && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Subscription Scheduled for Cancellation</p>
                <p className="text-sm text-yellow-700">
                  This subscription will be cancelled on{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                  {subscription.cancelReason && ` Reason: ${subscription.cancelReason}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancelPendingCancellation}
              className="inline-flex items-center justify-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
            >
              Keep Subscription
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Subscription Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan & Billing Info */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Subscription Details</h2>
            </div>
            <div className="p-6 grid gap-6 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="font-medium">{subscription.planName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{subscription.planTier} tier</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {formatCurrency(subscription.amount, subscription.currency)}
                    <span className="text-muted-foreground text-sm">
                      /{subscription.billingCycle === "yearly" ? "year" : "month"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Period</p>
                  <p className="font-medium">
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()} -{" "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                  {subscription.status === "active" && (
                    <p className="text-xs text-muted-foreground">
                      {daysRemaining > 0 ? `${daysRemaining} days remaining` : "Renews today"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(subscription.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trial Info (if applicable) */}
          {subscription.trialEnd && (
            <div className="rounded-lg border bg-card">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Trial Information</h2>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Trial Period</p>
                    <p className="font-medium">
                      {subscription.trialStart
                        ? new Date(subscription.trialStart).toLocaleDateString()
                        : "N/A"}{" "}
                      - {new Date(subscription.trialEnd).toLocaleDateString()}
                    </p>
                  </div>
                  {subscription.status === "trialing" && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {getDaysRemaining(subscription.trialEnd)}
                      </p>
                      <p className="text-sm text-muted-foreground">days left</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Billing History */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Billing History</h2>
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        No invoices yet
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm">{invoice.invoiceNumber}</span>
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize",
                              INVOICE_STATUS_COLORS[invoice.status]
                            )}
                          >
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Actions & Quick Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Actions</h2>
            </div>
            <div className="p-6 space-y-3">
              {subscription.status === "active" && (
                <>
                  <button
                    onClick={() => setShowChangePlanModal(true)}
                    className="w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Change Plan
                  </button>
                  <button
                    onClick={handlePause}
                    disabled={isUpdating}
                    className="w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Pause Subscription
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isUpdating}
                    className="w-full inline-flex items-center justify-center rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Subscription
                  </button>
                </>
              )}
              {subscription.status === "paused" && (
                <button
                  onClick={handleResume}
                  disabled={isUpdating}
                  className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resume Subscription
                </button>
              )}
              {subscription.status === "past_due" && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    This subscription has overdue payments. Contact the tenant to resolve.
                  </p>
                </div>
              )}
              {(subscription.status === "cancelled" || subscription.status === "expired") && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-muted-foreground">
                    This subscription is no longer active.
                    {subscription.canceledAt && (
                      <> Cancelled on {new Date(subscription.canceledAt).toLocaleDateString()}.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Revenue Summary */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Revenue Summary</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Monthly Value</span>
                <span className="font-medium">
                  {formatCurrency(
                    subscription.billingCycle === "yearly"
                      ? subscription.amount / 12
                      : subscription.amount,
                    subscription.currency
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Annual Value</span>
                <span className="font-medium">
                  {formatCurrency(
                    subscription.billingCycle === "yearly"
                      ? subscription.amount
                      : subscription.amount * 12,
                    subscription.currency
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-muted-foreground">Total Invoiced</span>
                <span className="font-bold text-lg">
                  {formatCurrency(
                    invoices
                      .filter((i) => i.status === "paid")
                      .reduce((sum, i) => sum + i.amount, 0),
                    subscription.currency
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          {subscription.metadata && Object.keys(subscription.metadata).length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Metadata</h2>
              </div>
              <div className="p-6">
                <dl className="space-y-2">
                  {Object.entries(subscription.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-mono text-sm">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowChangePlanModal(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-background rounded-lg shadow-xl">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Change Subscription Plan</h2>
                <p className="text-sm text-muted-foreground">
                  Select a new plan for this subscription
                </p>
              </div>
              <div className="p-6 space-y-4">
                {plans.map((plan) => {
                  const isCurrentPlan = plan.id === subscription.planId;
                  const isUpgrade = plan.price > subscription.amount;
                  return (
                    <label
                      key={plan.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors",
                        selectedPlanId === plan.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50",
                        isCurrentPlan && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="plan"
                          value={plan.id}
                          checked={selectedPlanId === plan.id}
                          onChange={() => setSelectedPlanId(plan.id)}
                          disabled={isCurrentPlan}
                          className="h-4 w-4"
                        />
                        <div>
                          <p className="font-medium">
                            {plan.name}
                            {isCurrentPlan && (
                              <span className="ml-2 text-xs text-muted-foreground">(Current)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">{plan.tier}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(plan.price)}</p>
                        {!isCurrentPlan && (
                          <p className="text-xs flex items-center gap-1">
                            {isUpgrade ? (
                              <>
                                <ArrowUpCircle className="h-3 w-3 text-green-600" />
                                <span className="text-green-600">Upgrade</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownCircle className="h-3 w-3 text-yellow-600" />
                                <span className="text-yellow-600">Downgrade</span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowChangePlanModal(false)}
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePlan}
                  disabled={!selectedPlanId || isUpdating}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {isUpdating ? "Updating..." : "Change Plan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
