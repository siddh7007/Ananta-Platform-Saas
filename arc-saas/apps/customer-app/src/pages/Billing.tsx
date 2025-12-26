/**
 * Billing Page
 *
 * Shows subscription info, plans, and invoices using the tenant-management-service API.
 */

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import { useTenant } from "../lib/tenant-context";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  planName?: string;
  planTier?: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialStart?: string;
  trialEnd?: string;
  amount?: number;
  currency?: string;
  billingCycle?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  cancelReason?: string;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  description?: string;
  price: number;
  billingCycle: string;
  features?: string[];
  limits?: {
    users?: number;
    storage?: number;
    apiCalls?: number;
  };
  isPopular?: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber?: string;
  tenantId: string;
  subscriptionId?: string;
  amount: number;
  currency?: string;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
  active: { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2 },
  trialing: { color: "text-blue-600", bg: "bg-blue-50", icon: Clock },
  past_due: { color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle },
  cancelled: { color: "text-red-600", bg: "bg-red-50", icon: AlertCircle },
  pending: { color: "text-gray-600", bg: "bg-gray-50", icon: Clock },
  paid: { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2 },
  unpaid: { color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle },
};

export default function Billing() {
  const { tenant } = useTenant();

  // Fetch subscription
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api.get<Subscription[]>("/subscriptions"),
  });

  // Fetch available plans (public endpoint)
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/plans"),
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<Invoice[]>("/invoices"),
  });

  // Get current subscription
  const currentSubscription = subscriptions.find(
    (s) => s.status === "active" || s.status === "trialing"
  ) || subscriptions[0];

  // Get current plan details
  const currentPlan = plans.find((p) => p.id === currentSubscription?.planId);

  // Format date
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  // Format currency
  const formatCurrency = (amount: number | undefined, currency = "USD") => {
    if (amount === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing for {tenant?.name}
        </p>
      </div>

      {/* Current Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Subscription
          </CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptionsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : currentSubscription ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold capitalize">
                      {currentPlan?.name || currentSubscription.planTier || currentSubscription.planId}
                    </h3>
                    <Badge
                      variant="outline"
                      className={STATUS_STYLES[currentSubscription.status]?.color || "text-gray-600"}
                    >
                      {currentSubscription.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {currentSubscription.amount
                      ? `${formatCurrency(currentSubscription.amount, currentSubscription.currency)} / ${currentSubscription.billingCycle || "month"}`
                      : "Contact for pricing"}
                  </p>
                </div>
                <Button variant="outline">
                  Change Plan
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Period</p>
                  <p className="font-medium">
                    {formatDate(currentSubscription.currentPeriodStart)} -{" "}
                    {formatDate(currentSubscription.currentPeriodEnd)}
                  </p>
                </div>
                {currentSubscription.trialEnd && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Trial Ends</p>
                    <p className="font-medium">{formatDate(currentSubscription.trialEnd)}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Next Billing</p>
                  <p className="font-medium">
                    {currentSubscription.cancelAtPeriodEnd
                      ? "Cancels at period end"
                      : formatDate(currentSubscription.currentPeriodEnd)}
                  </p>
                </div>
              </div>

              {currentSubscription.cancelAtPeriodEnd && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-medium">Subscription scheduled to cancel</p>
                  </div>
                  <p className="mt-1 text-sm text-amber-700">
                    Your subscription will end on {formatDate(currentSubscription.currentPeriodEnd)}.
                    {currentSubscription.cancelReason && ` Reason: ${currentSubscription.cancelReason}`}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Active Subscription</h3>
              <p className="text-muted-foreground mb-4">
                Choose a plan to get started with your subscription.
              </p>
              <Button>View Plans</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Choose the plan that best fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-8 w-32 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No plans available</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrentPlan = currentSubscription?.planId === plan.id;
                return (
                  <Card
                    key={plan.id}
                    className={`relative ${isCurrentPlan ? "border-primary" : ""} ${plan.isPopular ? "ring-2 ring-primary" : ""}`}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary">Most Popular</Badge>
                      </div>
                    )}
                    <CardContent className="p-6 pt-8">
                      <div className="mb-4">
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        <div className="mt-2">
                          <span className="text-3xl font-bold">
                            {formatCurrency(plan.price)}
                          </span>
                          <span className="text-muted-foreground">/{plan.billingCycle}</span>
                        </div>
                      </div>

                      {plan.description && (
                        <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                      )}

                      {plan.features && plan.features.length > 0 && (
                        <ul className="space-y-2 mb-6">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}

                      {plan.limits && (
                        <div className="text-xs text-muted-foreground space-y-1 mb-4">
                          {plan.limits.users && <p>{plan.limits.users} users</p>}
                          {plan.limits.storage && <p>{plan.limits.storage}GB storage</p>}
                          {plan.limits.apiCalls && (
                            <p>{plan.limits.apiCalls.toLocaleString()} API calls</p>
                          )}
                        </div>
                      )}

                      <Button
                        className="w-full"
                        variant={isCurrentPlan ? "outline" : "default"}
                        disabled={isCurrentPlan}
                      >
                        {isCurrentPlan ? "Current Plan" : "Select Plan"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>Your past invoices and payment history</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div>
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24 mt-2" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No invoices yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const statusStyle = STATUS_STYLES[invoice.status] || STATUS_STYLES.pending;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}
                      </TableCell>
                      <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                      <TableCell>
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyle.color}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
