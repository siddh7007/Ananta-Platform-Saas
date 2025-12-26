import { useList } from "@refinedev/core";
import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Receipt,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RevenueMetrics {
  mrr: number;
  arr: number;
  mrrGrowth: number;
  churnRate: number;
  avgRevenuePerUser: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  pastDueSubscriptions: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantName: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "void" | "refunded";
  dueDate: string;
  paidAt?: string;
  createdAt: string;
}

interface RevenueByPlan {
  planName: string;
  planTier: string;
  count: number;
  revenue: number;
  percentage: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  subscriptions: number;
}

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  paid: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: XCircle },
  void: { label: "Void", color: "bg-gray-100 text-gray-500", icon: XCircle },
  refunded: { label: "Refunded", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
};

export function BillingDashboard() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [invoiceFilter, setInvoiceFilter] = useState<string>("all");

  // Fetch metrics
  const { data: metricsData, isLoading: metricsLoading } = useList<RevenueMetrics>({
    resource: "billing/metrics",
    pagination: { pageSize: 1 },
  });

  // Fetch recent invoices
  const { data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = useList<Invoice>({
    resource: "invoices",
    pagination: { pageSize: 20 },
    sorters: [{ field: "createdAt", order: "desc" }],
  });

  // Fetch revenue by plan
  const { data: revenueByPlanData } = useList<RevenueByPlan>({
    resource: "billing/revenue-by-plan",
  });

  // Fetch monthly revenue for chart
  const { data: monthlyRevenueData } = useList<MonthlyRevenue>({
    resource: "billing/monthly-revenue",
    filters: [{ field: "range", operator: "eq", value: dateRange }],
  });

  const metrics = metricsData?.data?.[0] || {
    mrr: 0,
    arr: 0,
    mrrGrowth: 0,
    churnRate: 0,
    avgRevenuePerUser: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    pastDueSubscriptions: 0,
  };

  const invoices = invoicesData?.data || [];
  const revenueByPlan = revenueByPlanData?.data || [];
  const monthlyRevenue = monthlyRevenueData?.data || [];

  // Filter invoices
  const filteredInvoices = invoiceFilter === "all"
    ? invoices
    : invoices.filter((i) => i.status === invoiceFilter);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  // Calculate max revenue for chart scaling
  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing Dashboard</h1>
          <p className="text-muted-foreground">
            Revenue metrics, invoices, and financial analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            <Download className="mr-2 h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">MRR</span>
            </div>
            {metrics.mrrGrowth !== 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-medium",
                  metrics.mrrGrowth > 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {metrics.mrrGrowth > 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {formatPercentage(metrics.mrrGrowth)}
              </span>
            )}
          </div>
          <p className="mt-3 text-3xl font-bold">{formatCurrency(metrics.mrr)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ARR: {formatCurrency(metrics.arr)}
          </p>
        </div>

        {/* Active Subscriptions */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Active Subscriptions</span>
          </div>
          <p className="mt-3 text-3xl font-bold">{metrics.activeSubscriptions}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {metrics.trialSubscriptions} in trial
          </p>
        </div>

        {/* ARPU */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Avg Revenue/User</span>
          </div>
          <p className="mt-3 text-3xl font-bold">{formatCurrency(metrics.avgRevenuePerUser)}</p>
          <p className="mt-1 text-sm text-muted-foreground">per month</p>
        </div>

        {/* Churn Rate */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Churn Rate</span>
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold">{metrics.churnRate.toFixed(1)}%</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {metrics.pastDueSubscriptions} past due
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-lg border bg-card">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Revenue Trend</h2>
            </div>
          </div>
          <div className="p-6">
            {monthlyRevenue.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            ) : (
              <div className="h-64 flex items-end gap-2">
                {monthlyRevenue.map((month, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-primary/20 rounded-t-md transition-all hover:bg-primary/30 relative group"
                      style={{
                        height: `${(month.revenue / maxMonthlyRevenue) * 100}%`,
                        minHeight: "8px",
                      }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatCurrency(month.revenue)}
                      </div>
                      <div className="absolute inset-0 bg-primary rounded-t-md" style={{ height: "100%" }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{month.month}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Revenue by Plan */}
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Revenue by Plan</h2>
          </div>
          <div className="p-6 space-y-4">
            {revenueByPlan.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              revenueByPlan.map((plan) => (
                <div key={plan.planName}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium">{plan.planName}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({plan.count} subscriptions)
                      </span>
                    </div>
                    <span className="font-medium">{formatCurrency(plan.revenue)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${plan.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {metrics.pastDueSubscriptions > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Payment Issues Detected</p>
              <p className="text-sm text-yellow-700">
                {metrics.pastDueSubscriptions} subscription(s) have overdue payments. Review and
                follow up with affected tenants.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Invoices</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value)}
                className="rounded-md border px-3 py-1 text-sm"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <button
              onClick={() => refetchInvoices()}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Paid
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoicesLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => {
                  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status] || INVOICE_STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const isOverdue = invoice.status === "pending" && new Date(invoice.dueDate) < new Date();

                  return (
                    <tr key={invoice.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-medium">{invoice.invoiceNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium">{invoice.tenantName}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                            isOverdue ? "bg-red-100 text-red-700" : statusConfig.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {isOverdue ? "Overdue" : statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {invoice.paidAt
                          ? new Date(invoice.paidAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredInvoices.length > 0 && (
          <div className="p-4 border-t text-center">
            <button className="text-sm text-primary hover:underline">
              View All Invoices
            </button>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Revenue (All Time)</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0))}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Pending Invoices</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600">
            {formatCurrency(invoices.filter((i) => i.status === "pending").reduce((sum, i) => sum + i.amount, 0))}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Failed Payments</p>
          <p className="text-2xl font-bold mt-1 text-red-600">
            {formatCurrency(invoices.filter((i) => i.status === "failed").reduce((sum, i) => sum + i.amount, 0))}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Refunded</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">
            {formatCurrency(invoices.filter((i) => i.status === "refunded").reduce((sum, i) => sum + i.amount, 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
