import { useState, useMemo } from "react";
import { useList } from "@refinedev/core";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  CreditCard,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Activity,
  Globe,
  Clock,
  UserPlus,
  UserMinus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsCard {
  title: string;
  value: string;
  description: string;
}

interface PlanDistribution {
  plan: string;
  count: number;
  percentage: number;
  color: string;
}

// Plan prices for MRR calculation
const PLAN_PRICES: Record<string, number> = {
  "plan-basic": 29,
  "plan-standard": 79,
  "plan-premium": 199,
};

const PLAN_COLORS: Record<string, string> = {
  "plan-basic": "bg-blue-400",
  "plan-standard": "bg-purple-400",
  "plan-premium": "bg-amber-400",
};

const PLAN_LABELS: Record<string, string> = {
  "plan-basic": "Basic",
  "plan-standard": "Standard",
  "plan-premium": "Premium",
};

// Simple donut chart component
function DonutChart({ data }: { data: PlanDistribution[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="w-48 h-48 mx-auto flex items-center justify-center text-muted-foreground">
        No data
      </div>
    );
  }

  let cumulativePercentage = 0;

  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        {data.map((item) => {
          const startAngle = (cumulativePercentage / 100) * 360;
          const endAngle = ((cumulativePercentage + item.percentage) / 100) * 360;
          cumulativePercentage += item.percentage;

          const largeArcFlag = item.percentage > 50 ? 1 : 0;
          const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
          const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
          const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
          const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

          return (
            <path
              key={item.plan}
              d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
              className={item.color.replace("bg-", "fill-")}
              strokeWidth="0"
            />
          );
        })}
        <circle cx="50" cy="50" r="25" className="fill-background" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState("6m");

  // Fetch real data from API
  const { data: tenantsData, isLoading: tenantsLoading } = useList({ resource: "tenants" });
  const { data: subscriptionsData, isLoading: subsLoading } = useList({ resource: "subscriptions" });
  const { data: usersData, isLoading: usersLoading } = useList({ resource: "tenant-users" });

  const isLoading = tenantsLoading || subsLoading || usersLoading;

  // Calculate KPIs from real data
  const kpis: AnalyticsCard[] = useMemo(() => {
    const totalTenants = tenantsData?.total || tenantsData?.data?.length || 0;
    const activeUsers = usersData?.total || usersData?.data?.length || 0;

    // Calculate MRR from subscriptions
    const mrr = subscriptionsData?.data
      ?.filter((s: any) => s.status === "active")
      .reduce((total: number, sub: any) => {
        const price = PLAN_PRICES[sub.planId] || 0;
        return total + price;
      }, 0) || 0;

    return [
      {
        title: "Total Tenants",
        value: totalTenants.toLocaleString(),
        description: "Registered organizations",
      },
      {
        title: "Active Users",
        value: activeUsers.toLocaleString(),
        description: "Across all tenants",
      },
      {
        title: "Monthly Revenue",
        value: `$${mrr.toLocaleString()}`,
        description: "From active subscriptions",
      },
      {
        title: "Active Subscriptions",
        value: (subscriptionsData?.data?.filter((s: any) => s.status === "active").length || 0).toLocaleString(),
        description: "Paying customers",
      },
    ];
  }, [tenantsData, subscriptionsData, usersData]);

  // Calculate plan distribution from real data
  const planDistribution: PlanDistribution[] = useMemo(() => {
    if (!subscriptionsData?.data) return [];

    const counts: Record<string, number> = {};
    subscriptionsData.data
      .filter((s: any) => s.status === "active")
      .forEach((sub: any) => {
        counts[sub.planId] = (counts[sub.planId] || 0) + 1;
      });

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return Object.entries(counts).map(([planId, count]) => ({
      plan: PLAN_LABELS[planId] || planId,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      color: PLAN_COLORS[planId] || "bg-gray-400",
    }));
  }, [subscriptionsData]);

  // Get top tenants by user count
  const topTenants = useMemo(() => {
    if (!tenantsData?.data) return [];

    return tenantsData.data
      .slice(0, 5)
      .map((tenant: any) => ({
        name: tenant.name,
        key: tenant.key,
        status: tenant.status,
        plan: tenant.planId ? PLAN_LABELS[tenant.planId] || tenant.planId : "N/A",
      }));
  }, [tenantsData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage Analytics</h1>
          <p className="text-muted-foreground">
            Insights into platform usage and business metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="1m">Last Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
          <button className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.title} className="rounded-lg border bg-card p-6">
              <span className="text-sm font-medium text-muted-foreground">{kpi.title}</span>
              <p className="mt-2 text-3xl font-bold">{kpi.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tenant Growth - Empty State */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Tenant Growth</h3>
              <p className="text-sm text-muted-foreground">
                New vs. churned tenants
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
            <p>Growth data not available.</p>
            <p className="text-sm mt-2">Configure analytics API to track tenant growth over time.</p>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Plan Distribution</h3>
              <p className="text-sm text-muted-foreground">
                Tenants by subscription plan
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : planDistribution.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <PieChart className="h-12 w-12 mb-4 opacity-50" />
              <p>No active subscriptions found.</p>
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <DonutChart data={planDistribution} />
              <div className="flex-1 space-y-3">
                {planDistribution.map((item) => (
                  <div key={item.plan} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-3 w-3 rounded", item.color)} />
                      <span className="text-sm">{item.plan}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{item.count}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Tenants */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recent Tenants</h3>
          </div>
          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : topTenants.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tenants found.</p>
            </div>
          ) : (
            <div className="divide-y">
              {topTenants.map((tenant: any, index: number) => (
                <div
                  key={tenant.key}
                  className="p-4 flex items-center justify-between hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{tenant.key}</span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs",
                            tenant.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          )}
                        >
                          {tenant.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Geographic Distribution - Empty State */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Geographic Distribution</h3>
            </div>
          </div>
          <div className="p-12 text-center text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Geographic data not available.</p>
            <p className="text-sm mt-2">Configure analytics API to track tenant locations.</p>
          </div>
        </div>
      </div>

      {/* Activity Timeline - Empty State */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Recent Activity</h3>
          </div>
        </div>
        <div className="p-12 text-center text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Activity timeline not available.</p>
          <p className="text-sm mt-2">Check the Audit Logs page for system activity tracking.</p>
        </div>
      </div>
    </div>
  );
}
