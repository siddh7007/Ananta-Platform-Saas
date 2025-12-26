import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, CreditCard, Settings, LogOut } from 'lucide-react';
import { TenantConfig } from '../lib/tenant-context';
import { useAuth } from '../lib/auth-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotificationInbox } from '@/components/NotificationInbox';

interface MainLayoutProps {
  tenant: TenantConfig;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function MainLayout({ tenant }: MainLayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  const handleLogout = () => {
    logout();
  };

  // Generate subscriber ID for Novu notifications
  // Format: tenant-{tenantKey}-user-{userId}
  const subscriberId = user?.id
    ? `tenant-${tenant.key}-user-${user.id}`
    : `tenant-${tenant.key}-anonymous`;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b">
          {tenant.theme?.logo ? (
            <img src={tenant.theme.logo} alt={tenant.name} className="h-8" />
          ) : (
            <span className="text-xl font-bold">{tenant.name}</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-64">
        {/* Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-4">
            {/* Novu Notification Inbox */}
            <NotificationInbox
              subscriberId={subscriberId}
              subscriberEmail={user?.email}
              subscriberFirstName={user?.name?.split(' ')[0]}
              subscriberLastName={user?.name?.split(' ').slice(1).join(' ')}
            />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">{userInitials}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
