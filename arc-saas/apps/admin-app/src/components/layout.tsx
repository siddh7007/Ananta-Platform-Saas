import { Link, useLocation } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  GitBranch,
  Settings,
  LogOut,
  Users,
  Mail,
  Shield,
  FileText,
  BarChart3,
  Activity,
  Gauge,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationInbox } from "./NotificationInbox";
import { SearchBar } from "./search-bar";
import { Breadcrumb } from "./breadcrumb";
import { SessionTimeout } from "./session-timeout";
import { ThemeSelector } from "./theme";
import { useConfig } from "../hooks/use-config";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  children?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tenants", href: "/tenants", icon: Building2 },
  { name: "Users", href: "/users", icon: Users },
  { name: "Invitations", href: "/invitations", icon: Mail },
  { name: "Plans", href: "/plans", icon: CreditCard },
  { name: "Subscriptions", href: "/subscriptions", icon: Receipt },
  {
    name: "Billing",
    href: "/billing",
    icon: BarChart3,
    children: [
      { name: "Overview", href: "/billing" },
      { name: "Invoices", href: "/billing/invoices" },
      { name: "Payment Methods", href: "/billing/payment-methods" },
    ],
  },
  { name: "Usage", href: "/usage", icon: Gauge },
  { name: "Workflows", href: "/workflows", icon: GitBranch },
  { name: "Roles", href: "/roles", icon: Shield },
  { name: "Audit Logs", href: "/audit-logs", icon: FileText },
  {
    name: "Notifications",
    href: "/notifications",
    icon: Bell,
    children: [
      { name: "Templates", href: "/notifications" },
      { name: "History", href: "/notifications/history" },
      { name: "Preferences", href: "/notifications/preferences" },
      { name: "Analytics", href: "/notifications/analytics" },
    ],
  },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  {
    name: "Monitoring",
    href: "/monitoring",
    icon: Activity,
    children: [
      { name: "Health", href: "/monitoring/health" },
      { name: "Metrics", href: "/monitoring/metrics" },
      { name: "Analytics", href: "/monitoring/analytics" },
    ],
  },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const auth = useAuth();
  const { config } = useConfig();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  // Get user info from OIDC
  const user = auth.user?.profile;
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "A";

  // Generate subscriber ID for Novu notifications
  // Use 'admin' as the subscriberId for the admin user
  const subscriberId = "admin";

  const handleLogout = async () => {
    await auth.removeUser();
    await auth.signoutRedirect();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b">
          <span className="text-xl font-bold">Ananta SaaS</span>
          <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
            Admin
          </span>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {navigation.map((item) => (
            <div key={item.name}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
              {/* Sub-navigation items */}
              {item.children && isActive(item.href) && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      to={child.href}
                      className={cn(
                        "block px-3 py-1.5 rounded-md text-sm transition-colors",
                        location.pathname === child.href
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Settings at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t space-y-1">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-64">
        {/* Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-6">
          <SearchBar placeholder="Search (Cmd+K)" />
          <div className="flex items-center gap-4">
            {/* Theme Selector */}
            <ThemeSelector />
            {/* Novu Notification Inbox */}
            <NotificationInbox
              subscriberId={subscriberId}
              subscriberEmail={user?.email}
            />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">{userInitials}</span>
              </div>
              <span className="text-sm font-medium">{user?.name || "Admin"}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="px-6 pt-4">
          <Breadcrumb />
        </div>
        <main id="main-content" className="p-6">{children}</main>

        {/* Session Timeout */}
        <SessionTimeout enabled={config.sessionTimeoutEnabled} />
      </div>
    </div>
  );
}
