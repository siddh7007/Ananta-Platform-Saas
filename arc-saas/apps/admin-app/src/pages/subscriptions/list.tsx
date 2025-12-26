import { useList, useNavigation, useUpdate } from "@refinedev/core";
import { useState } from "react";
import {
  Eye,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  Ban,
  TrendingUp,
  DollarSign,
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
  trialEnd?: string;
  amount: number;
  currency: string;
  billingCycle: "monthly" | "yearly";
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700", icon: CheckCircle },
  trialing: { label: "Trialing", color: "bg-blue-100 text-blue-700", icon: Clock },
  past_due: { label: "Past Due", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
  paused: { label: "Paused", color: "bg-gray-100 text-gray-700", icon: Ban },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-600", icon: XCircle },
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  basic: "bg-blue-100 text-blue-700",
  standard: "bg-purple-100 text-purple-700",
  premium: "bg-amber-100 text-amber-700",
  FREE: "bg-gray-100 text-gray-700",
  BASIC: "bg-blue-100 text-blue-700",
  STANDARD: "bg-purple-100 text-purple-700",
  PREMIUM: "bg-amber-100 text-amber-700",
};

export function SubscriptionList() {
  const { data, isLoading, refetch } = useList<Subscription>({
    resource: "subscriptions",
    pagination: { pageSize: 50 },
  });
  const { show } = useNavigation();
  const { mutate: updateSubscription } = useUpdate();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const subscriptions = data?.data || [];

  // Filter subscriptions
  const filteredSubscriptions = statusFilter === "all"
    ? subscriptions
    : subscriptions.filter((s) => s.status === statusFilter);

  // Calculate stats
  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === "active").length,
    trialing: subscriptions.filter((s) => s.status === "trialing").length,
    pastDue: subscriptions.filter((s) => s.status === "past_due").length,
    mrr: subscriptions
      .filter((s) => s.status === "active")
      .reduce((acc, s) => {
        const monthlyAmount = s.billingCycle === "yearly" ? s.amount / 12 : s.amount;
        return acc + monthlyAmount;
      }, 0),
  };

  const handlePauseSubscription = (id: string) => {
    if (confirm("Are you sure you want to pause this subscription?")) {
      updateSubscription({
        resource: "subscriptions",
        id,
        values: { status: "paused" },
      });
    }
    setActionMenuOpen(null);
  };

  const handleResumeSubscription = (id: string) => {
    updateSubscription({
      resource: "subscriptions",
      id,
      values: { status: "active" },
    });
    setActionMenuOpen(null);
  };

  const handleCancelSubscription = (id: string) => {
    if (confirm("Are you sure you want to cancel this subscription? The tenant will lose access at the end of the billing period.")) {
      updateSubscription({
        resource: "subscriptions",
        id,
        values: { cancelAtPeriodEnd: true },
      });
    }
    setActionMenuOpen(null);
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage tenant subscriptions and billing
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Subscriptions</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">Trialing</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{stats.trialing}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm text-muted-foreground">Past Due</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-yellow-600">{stats.pastDue}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Monthly Revenue</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(stats.mrr)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Filter by status:</span>
        <div className="flex gap-2">
          {["all", "active", "trialing", "past_due", "cancelled", "paused"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1 text-sm rounded-full border transition-colors",
                statusFilter === status
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              )}
            >
              {status === "all" ? "All" : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Period End
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((subscription) => {
                  const statusConfig = STATUS_CONFIG[subscription.status] || STATUS_CONFIG.active;
                  const StatusIcon = statusConfig.icon;
                  const daysRemaining = getDaysRemaining(subscription.currentPeriodEnd);
                  const isEnding = subscription.cancelAtPeriodEnd;

                  return (
                    <tr key={subscription.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-medium">{subscription.tenantName}</span>
                          <p className="text-xs text-muted-foreground">{subscription.tenantKey}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                            PLAN_COLORS[subscription.planTier] || "bg-gray-100 text-gray-700"
                          )}
                        >
                          {subscription.planName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {formatCurrency(subscription.amount, subscription.currency)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            /{subscription.billingCycle === "yearly" ? "yr" : "mo"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full w-fit",
                              statusConfig.color
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </span>
                          {isEnding && (
                            <span className="text-xs text-destructive">Cancels at period end</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">
                            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                          </span>
                          {subscription.status === "trialing" && subscription.trialEnd && (
                            <span className="text-xs text-blue-600">
                              Trial: {getDaysRemaining(subscription.trialEnd)} days left
                            </span>
                          )}
                          {subscription.status === "active" && daysRemaining <= 7 && (
                            <span className="text-xs text-yellow-600">
                              Renews in {daysRemaining} days
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => show("subscriptions", subscription.id)}
                            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActionMenuOpen(
                                  actionMenuOpen === subscription.id ? null : subscription.id
                                )
                              }
                              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {actionMenuOpen === subscription.id && (
                              <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover shadow-lg z-10">
                                <div className="py-1">
                                  {subscription.status === "active" && (
                                    <>
                                      <button
                                        onClick={() => handlePauseSubscription(subscription.id)}
                                        className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                                      >
                                        <Ban className="mr-2 h-4 w-4" />
                                        Pause Subscription
                                      </button>
                                      <button
                                        onClick={() => handleCancelSubscription(subscription.id)}
                                        className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted text-destructive"
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancel Subscription
                                      </button>
                                    </>
                                  )}
                                  {subscription.status === "paused" && (
                                    <button
                                      onClick={() => handleResumeSubscription(subscription.id)}
                                      className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Resume Subscription
                                    </button>
                                  )}
                                  {subscription.status === "past_due" && (
                                    <button
                                      onClick={() => show("subscriptions", subscription.id)}
                                      className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                                    >
                                      <AlertTriangle className="mr-2 h-4 w-4" />
                                      Resolve Payment Issue
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      {filteredSubscriptions.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions
          </span>
          <span>
            Total MRR: <strong className="text-foreground">{formatCurrency(stats.mrr)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
