import { useList, useCustom } from "@refinedev/core";
import { Building2, CreditCard, Receipt, GitBranch, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { getPlanPriceMap } from "@/config/platform.config";

export function Dashboard() {
  const { data: tenantsData, isLoading: tenantsLoading } = useList({ resource: "tenants" });
  const { data: subscriptionsData, isLoading: subsLoading } = useList({ resource: "subscriptions" });
  const { data: workflowsData, isLoading: workflowsLoading } = useList({ resource: "workflows" });

  // Calculate monthly revenue from active subscriptions
  // Call getPlanPriceMap() inside useMemo to respect any runtime config changes
  const monthlyRevenue = useMemo(() => {
    if (!subscriptionsData?.data) return 0;
    const planPrices = getPlanPriceMap();
    return subscriptionsData.data
      .filter((s: any) => s.status === "active")
      .reduce((total: number, sub: any) => {
        const price = planPrices[sub.planId] || 0;
        return total + price;
      }, 0);
  }, [subscriptionsData]);

  // Count stats
  const totalTenants = tenantsData?.total || tenantsData?.data?.length || 0;
  const activeSubscriptions = subscriptionsData?.data?.filter((s: any) => s.status === "active").length || 0;
  const runningWorkflows = workflowsData?.data?.filter((w: any) => w.status === "running" || w.status === "RUNNING").length || 0;

  const stats = [
    {
      name: "Total Tenants",
      value: totalTenants,
      description: "Registered organizations",
      icon: Building2,
      loading: tenantsLoading,
    },
    {
      name: "Active Subscriptions",
      value: activeSubscriptions,
      description: "Paying customers",
      icon: Receipt,
      loading: subsLoading,
    },
    {
      name: "Monthly Revenue",
      value: `$${monthlyRevenue.toLocaleString()}`,
      description: "From active plans",
      icon: CreditCard,
      loading: subsLoading,
    },
    {
      name: "Running Workflows",
      value: runningWorkflows,
      description: "Active processes",
      icon: GitBranch,
      loading: workflowsLoading,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your SaaS platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </span>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              {stat.loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <>
                  <span className="text-2xl font-bold">{stat.value}</span>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Tenants */}
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Recent Tenants</h2>
          </div>
          <div className="p-6">
            {tenantsData?.data?.slice(0, 5).map((tenant: any) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-sm text-muted-foreground">{tenant.key}</p>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    tenant.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  )}
                >
                  {tenant.status}
                </span>
              </div>
            )) || (
              <p className="text-muted-foreground text-center py-8">
                No tenants found
              </p>
            )}
          </div>
        </div>

        {/* Recent Workflows */}
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Recent Workflows</h2>
          </div>
          <div className="p-6">
            {workflowsData?.data?.slice(0, 5).map((workflow: any) => (
              <div
                key={workflow.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">{workflow.workflowType}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(workflow.startTime).toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    workflow.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : workflow.status === "running"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {workflow.status}
                </span>
              </div>
            )) || (
              <p className="text-muted-foreground text-center py-8">
                No workflows found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
