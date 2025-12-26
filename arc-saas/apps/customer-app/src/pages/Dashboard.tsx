import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  Users,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  Calendar,
  Package,
} from "lucide-react";
import { useTenant } from "../lib/tenant-context";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Types matching tenant-management-service API responses
interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  planName?: string;
  planTier?: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEnd?: string;
  amount?: number;
  currency?: string;
  billingCycle?: string;
}

interface UserActivity {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  occurredAt: string;
}

interface TenantUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

const STATUS_STYLES: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  active: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
  trialing: { icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
  past_due: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50" },
  cancelled: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
  pending: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50" },
};

export default function Dashboard() {
  const { tenant } = useTenant();
  const { user } = useAuth();

  const firstName = user?.name?.split(" ")[0] || "there";

  // Fetch subscription data
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api.get<Subscription[]>("/subscriptions"),
  });

  // Fetch team member count
  const { data: userCount, isLoading: userCountLoading } = useQuery({
    queryKey: ["tenant-users-count"],
    queryFn: () => api.get<{ count: number }>("/tenant-users/count"),
  });

  // Fetch recent activity
  const { data: recentActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["user-activities"],
    queryFn: () => api.get<UserActivity[]>("/user-activities"),
  });

  // Fetch team members for recent display
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: () => api.get<TenantUser[]>("/tenant-users"),
  });

  // Get current subscription (first active one)
  const currentSubscription = subscriptions.find(s => s.status === 'active' || s.status === 'trialing') || subscriptions[0];

  // Format date for display
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const statsLoading = subscriptionsLoading || userCountLoading;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {firstName}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening in {tenant?.name} today.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to="/team">
              <Users className="mr-2 h-4 w-4" />
              Team
            </Link>
          </Button>
          <Button asChild>
            <Link to="/settings">
              <Plus className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Subscription Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : currentSubscription ? (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={STATUS_STYLES[currentSubscription.status]?.color || "text-gray-500"}
                >
                  {currentSubscription.status}
                </Badge>
              </div>
            ) : (
              <div className="text-2xl font-bold">No subscription</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {currentSubscription?.planName || currentSubscription?.planTier || 'Set up billing'}
            </p>
          </CardContent>
        </Card>

        {/* Plan Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold capitalize">
                {currentSubscription?.planTier || currentSubscription?.planName || 'Free'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {currentSubscription?.amount
                ? `$${currentSubscription.amount}/${currentSubscription.billingCycle || 'month'}`
                : 'No billing'}
            </p>
          </CardContent>
        </Card>

        {/* Billing Period Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billing Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-sm font-medium">
                {currentSubscription?.currentPeriodEnd
                  ? `Renews ${formatDate(currentSubscription.currentPeriodEnd)}`
                  : 'N/A'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {currentSubscription?.trialEnd
                ? `Trial ends ${formatDate(currentSubscription.trialEnd)}`
                : 'Current period'}
            </p>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {userCountLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">{userCount?.count || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Users in your organization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Members List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Users in your organization</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/team">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {teamLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24 mt-2" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No team members yet</p>
                <Button asChild className="mt-4">
                  <Link to="/team">
                    <Plus className="mr-2 h-4 w-4" />
                    Invite Team
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {teamMembers.slice(0, 5).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {(member.firstName?.[0] || member.email[0]).toUpperCase()}
                          {(member.lastName?.[0] || '').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {member.role || 'Member'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity
            </CardTitle>
            <CardDescription>Recent activity in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-16 mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No recent activity
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.userEmail || 'User'}</span>{" "}
                        {activity.action}
                        {activity.entityType && (
                          <span className="text-muted-foreground"> {activity.entityType}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.occurredAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-auto py-4 justify-start" asChild>
              <Link to="/team" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Manage Team</div>
                  <div className="text-sm text-muted-foreground">
                    Invite and manage users
                  </div>
                </div>
              </Link>
            </Button>

            <Button variant="outline" className="h-auto py-4 justify-start" asChild>
              <Link to="/billing" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Billing & Plans</div>
                  <div className="text-sm text-muted-foreground">
                    Manage subscription
                  </div>
                </div>
              </Link>
            </Button>

            <Button variant="outline" className="h-auto py-4 justify-start" asChild>
              <Link to="/settings" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Settings</div>
                  <div className="text-sm text-muted-foreground">
                    Configure your account
                  </div>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
