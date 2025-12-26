import { useList, useNavigation } from "@refinedev/core";
import { useState } from "react";
import {
  Plus,
  Eye,
  Building2,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Loader2,
  Pause,
  XCircle,
  AlertTriangle,
  Users,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tenant {
  id: string;
  name: string;
  key: string;
  status: number | "pending" | "provisioning" | "active" | "suspended" | "deprovisioning" | "failed";
  tier: string;
  adminEmail?: string;
  userCount?: number;
  createdAt?: string;
  createdOn?: string; // API returns createdOn
}

// Map numeric status from backend to string status for frontend
const mapNumericStatus = (status: number | string): string => {
  if (typeof status === 'string') return status;
  const statusMap: Record<number, string> = {
    0: 'active',
    1: 'pending', // PENDINGPROVISION
    2: 'provisioning',
    3: 'failed', // PROVISIONFAILED
    4: 'deprovisioning',
    5: 'suspended', // INACTIVE
  };
  return statusMap[status] ?? 'pending';
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  provisioning: { label: "Provisioning", color: "bg-blue-100 text-blue-700", icon: Loader2 },
  active: { label: "Active", color: "bg-green-100 text-green-700", icon: CheckCircle },
  suspended: { label: "Suspended", color: "bg-red-100 text-red-700", icon: Pause },
  deprovisioning: { label: "Deprovisioning", color: "bg-orange-100 text-orange-700", icon: Loader2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: XCircle },
};

const TIER_COLORS: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-700",
  STARTER: "bg-blue-100 text-blue-700",
  PRO: "bg-purple-100 text-purple-700",
  ENTERPRISE: "bg-amber-100 text-amber-700",
};

export function TenantList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const { data, isLoading } = useList<Tenant>({
    resource: "tenants",
    pagination: { pageSize: 100 },
  });
  const { create, show } = useNavigation();

  const tenants = data?.data || [];

  // Filter tenants
  const filteredTenants = tenants.filter((tenant) => {
    const tenantStatus = mapNumericStatus(tenant.status);
    const matchesSearch = searchTerm === "" ||
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || tenantStatus === statusFilter;
    const matchesTier = tierFilter === "all" || tenant.tier === tierFilter;
    return matchesSearch && matchesStatus && matchesTier;
  });

  // Calculate stats
  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => mapNumericStatus(t.status) === "active").length,
    provisioning: tenants.filter((t) => mapNumericStatus(t.status) === "provisioning").length,
    suspended: tenants.filter((t) => mapNumericStatus(t.status) === "suspended").length,
    failed: tenants.filter((t) => mapNumericStatus(t.status) === "failed").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">Manage your platform tenants</p>
        </div>
        <button
          onClick={() => create("tenants")}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Tenant
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Provisioning</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{stats.provisioning}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Pause className="h-4 w-4 text-red-600" />
            <span className="text-sm text-muted-foreground">Suspended</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600">{stats.suspended}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-muted-foreground">Failed</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-orange-600">{stats.failed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="provisioning">Provisioning</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Tiers</option>
            <option value="FREE">Free</option>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || tierFilter !== "all"
                      ? "No tenants match your filters."
                      : "No tenants found. Create your first tenant to get started."}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const tenantStatus = mapNumericStatus(tenant.status);
                  const statusConfig = STATUS_CONFIG[tenantStatus] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const createdDate = tenant.createdOn || tenant.createdAt;

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-muted/50 transition-colors"
                      style={{ cursor: 'pointer' }}
                      onClick={() => show("tenants", tenant.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          show("tenants", tenant.id);
                        }
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            {tenant.adminEmail && (
                              <p className="text-sm text-muted-foreground">{tenant.adminEmail}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-sm bg-muted px-2 py-1 rounded">{tenant.key}</code>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex px-2 py-1 text-xs font-medium rounded-full uppercase",
                            TIER_COLORS[tenant.tier] || "bg-gray-100 text-gray-700"
                          )}
                        >
                          {tenant.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                            statusConfig.color
                          )}
                        >
                          <StatusIcon
                            className={cn(
                              "h-3 w-3",
                              (tenantStatus === "provisioning" || tenantStatus === "deprovisioning") && "animate-spin"
                            )}
                          />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{tenant.userCount ?? "-"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {createdDate ? new Date(createdDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            show("tenants", tenant.id);
                          }}
                          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredTenants.length > 0 && (
          <div className="px-6 py-4 border-t text-sm text-muted-foreground">
            Showing {filteredTenants.length} of {tenants.length} tenants
          </div>
        )}
      </div>
    </div>
  );
}
