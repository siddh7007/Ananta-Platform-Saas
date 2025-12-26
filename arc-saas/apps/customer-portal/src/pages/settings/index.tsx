/**
 * Settings Page - Main Hub
 *
 * Consolidated settings page with tabs for:
 * - Profile (user info from auth)
 * - Notifications (preferences)
 * - Organization (admin/owner only)
 * - Theme (appearance)
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole } from '@/config/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Bell, Building2, Palette, Save, Bookmark, Sun, Moon, SunMedium, CloudMoon, Monitor, Settings2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks';
import { PageSkeleton, TableSkeleton } from '@/components/shared/ListSkeletons';
import OrganizationSettingsPage from './organization';
import { SavedSearches, type SavedSearch, type ComponentFilterState } from '@/components/search';
import { cn } from '@/lib/utils';
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from '@/services/organization.service';
import type { NotificationSettings, OrganizationSettings } from '@/types/organization';

// Theme options matching ThemeSelector component
const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun, description: 'Bright and clear', color: 'bg-white' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes', color: 'bg-gray-900' },
  { value: 'mid-light', label: 'Soft Light', icon: SunMedium, description: 'Reduced contrast', color: 'bg-gray-100' },
  { value: 'mid-dark', label: 'Soft Dark', icon: CloudMoon, description: 'Gentle darkness', color: 'bg-gray-700' },
  { value: 'system', label: 'System', icon: Monitor, description: 'Match OS setting', color: 'bg-gradient-to-r from-white to-gray-900' },
] as const;

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isAdmin = hasMinimumRole(user?.role, 'admin');
  const queryClient = useQueryClient();

  // User profile state (read-only from auth)
  const [name] = useState(user?.name || '');
  const [email] = useState(user?.email || '');

  // Notification preferences (persisted to localStorage)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailDigest: 'daily',
    bomAlerts: true,
    usageAlerts: true,
    billingAlerts: true,
    securityAlerts: true,
  });

  // User preferences (persisted to localStorage)
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [defaultPageSize, setDefaultPageSize] = useState('20');

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load user preferences from localStorage on mount (fallback for non-admins)
  useEffect(() => {
    try {
      const storedNotifPrefs = localStorage.getItem('cbp-notification-prefs');
      if (storedNotifPrefs) {
        const parsed = JSON.parse(storedNotifPrefs);
        setNotificationSettings((prev) => ({ ...prev, ...parsed }));
      }

      const storedUserPrefs = localStorage.getItem('cbp-user-prefs');
      if (storedUserPrefs) {
        const parsed = JSON.parse(storedUserPrefs);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.timezone) setTimezone(parsed.timezone);
        if (parsed.dateFormat) setDateFormat(parsed.dateFormat);
        if (parsed.defaultPageSize) setDefaultPageSize(parsed.defaultPageSize);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  const { data: orgSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['organization', 'settings'],
    queryFn: getOrganizationSettings,
  });

  useEffect(() => {
    if (!orgSettings) return;
    if (orgSettings.language) setLanguage(orgSettings.language);
    if (orgSettings.timezone) setTimezone(orgSettings.timezone);
    if (orgSettings.dateFormat) setDateFormat(orgSettings.dateFormat);
    if (orgSettings.notifications) {
      setNotificationSettings((prev) => ({
        ...prev,
        ...orgSettings.notifications,
      }));
    }
  }, [orgSettings]);

  // Current search state (for saved searches - empty placeholders since this is settings, not search page)
  const [currentSearchQuery] = useState('');
  const [currentSearchType] = useState('component');
  const [currentFilters] = useState<ComponentFilterState>({
    suppliers: [],
    lifecycleStatuses: [],
    complianceFlags: [],
    priceRange: [0, 10000],
    riskLevels: [],
  });

  // Handler for loading a saved search (navigates to components page)
  const handleLoadSearch = (search: SavedSearch) => {
    // Build URL with search params
    const params = new URLSearchParams();
    params.set('q', search.query);
    params.set('type', search.searchType);
    if (search.filters.suppliers?.length) {
      params.set('suppliers', search.filters.suppliers.join(','));
    }
    if (search.filters.lifecycleStatuses?.length) {
      params.set('lifecycle', search.filters.lifecycleStatuses.join(','));
    }
    if (search.filters.riskLevels?.length) {
      params.set('risk', search.filters.riskLevels.join(','));
    }
    // Navigate to components page with filters
    window.location.href = `/components?${params.toString()}`;
  };

  const updateSettingsMutation = useMutation({
    mutationFn: (payload: Partial<OrganizationSettings>) => updateOrganizationSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'settings'] });
    },
  });

  const handleSaveNotifications = () => {
    // Non-admin users save to localStorage only (API requires admin role)
    if (!isAdmin) {
      localStorage.setItem('cbp-notification-prefs', JSON.stringify(notificationSettings));
      toast({
        title: 'Preferences saved',
        description: 'Notification preferences saved locally.',
      });
      return;
    }

    updateSettingsMutation.mutate(
      { notifications: notificationSettings },
      {
        onSuccess: () => {
          toast({
            title: 'Preferences saved',
            description: 'Notification preferences updated.',
          });
        },
        onError: (error: unknown) => {
          // Fallback to localStorage on API error
          localStorage.setItem('cbp-notification-prefs', JSON.stringify(notificationSettings));
          toast({
            title: 'Saved locally',
            description: 'Could not sync to server, preferences saved locally.',
          });
        },
      }
    );
  };

  const handleSaveUserPreferences = () => {
    const prefs = { language, timezone, dateFormat, defaultPageSize };

    // Non-admin users save to localStorage only (API requires admin role)
    if (!isAdmin) {
      localStorage.setItem('cbp-user-prefs', JSON.stringify(prefs));
      toast({
        title: 'Preferences saved',
        description: 'Your preferences have been saved locally.',
      });
      return;
    }

    updateSettingsMutation.mutate(
      { language, timezone, dateFormat },
      {
        onSuccess: () => {
          toast({
            title: 'Preferences saved',
            description: 'Your preferences have been updated.',
          });
        },
        onError: (error: unknown) => {
          // Fallback to localStorage on API error
          localStorage.setItem('cbp-user-prefs', JSON.stringify(prefs));
          toast({
            title: 'Saved locally',
            description: 'Could not sync to server, preferences saved locally.',
          });
        },
      }
    );
  };

  // Theme is automatically persisted by next-themes, just show toast for UX
  const handleThemeSelect = (newTheme: string) => {
    setTheme(newTheme);
    const themeLabel = THEME_OPTIONS.find(t => t.value === newTheme)?.label || newTheme;
    toast({
      title: 'Theme updated',
      description: `Theme set to ${themeLabel}.`,
    });
  };

  if (authLoading || settingsLoading) {
    return (
      <PageSkeleton>
        <TableSkeleton rows={3} columns={2} />
      </PageSkeleton>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className={`grid w-full lg:w-auto lg:inline-grid ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'}`}>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="saved-searches" className="gap-2">
            <Bookmark className="h-4 w-4" />
            Saved Searches
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your profile information is managed by your identity provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Name is provided by your authentication provider
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed here. Contact your administrator.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={user?.role || 'N/A'}
                  disabled
                  className="bg-muted capitalize"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose which notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-bom">BOM Enrichment Complete</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when BOM enrichment finishes
                  </p>
                </div>
                <Switch
                  id="notify-bom"
                  checked={notificationSettings.bomAlerts ?? true}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({ ...prev, bomAlerts: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-alerts">Usage & Component Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for lifecycle and usage changes
                  </p>
                </div>
                <Switch
                  id="notify-alerts"
                  checked={notificationSettings.usageAlerts ?? true}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({ ...prev, usageAlerts: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-team">Security & Invitations</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about team invitations and security events
                  </p>
                </div>
                <Switch
                  id="notify-team"
                  checked={notificationSettings.securityAlerts ?? true}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({ ...prev, securityAlerts: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-billing">Billing Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications about invoices and billing events
                  </p>
                </div>
                <Switch
                  id="notify-billing"
                  checked={notificationSettings.billingAlerts ?? true}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({ ...prev, billingAlerts: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-digest">Daily Email Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a daily summary of activity (disable to stop digests)
                  </p>
                </div>
                <Switch
                  id="notify-digest"
                  checked={(notificationSettings.emailDigest ?? 'daily') !== 'never'}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      emailDigest: checked ? prev.emailDigest ?? 'daily' : 'never',
                    }))
                  }
                />
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveNotifications} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saved Searches Tab */}
        <TabsContent value="saved-searches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Searches</CardTitle>
              <CardDescription>
                Manage your saved component searches for quick access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SavedSearches
                currentQuery={currentSearchQuery}
                currentSearchType={currentSearchType}
                currentFilters={currentFilters}
                onLoadSearch={handleLoadSearch}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Language & Region
              </CardTitle>
              <CardDescription>
                Configure your language, timezone, and display preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (US)</SelectItem>
                      <SelectItem value="en-gb">English (UK)</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="fr">Francais</SelectItem>
                      <SelectItem value="es">Espanol</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="zh">Chinese (Simplified)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Display language for the application
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                      <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan (JST)</SelectItem>
                      <SelectItem value="Asia/Shanghai">China (CST)</SelectItem>
                      <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                      <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Times will be displayed in this timezone
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger id="dateFormat">
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (UK/EU)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                      <SelectItem value="DD.MM.YYYY">DD.MM.YYYY (German)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Format for displaying dates throughout the app
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pageSize">Default Page Size</Label>
                  <Select value={defaultPageSize} onValueChange={setDefaultPageSize}>
                    <SelectTrigger id="pageSize">
                      <SelectValue placeholder="Select page size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 items per page</SelectItem>
                      <SelectItem value="20">20 items per page</SelectItem>
                      <SelectItem value="50">50 items per page</SelectItem>
                      <SelectItem value="100">100 items per page</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default number of items shown in lists
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveUserPreferences} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme Preferences</CardTitle>
              <CardDescription>
                Customize the appearance of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Color Theme</Label>
                {!mounted ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-24 rounded-lg border-2 bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {THEME_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = theme === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => handleThemeSelect(option.value)}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all duration-200',
                            isSelected
                              ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          )}
                        >
                          <div className={cn('h-10 w-10 rounded-full border shadow-sm', option.color)} />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground text-center">{option.description}</span>
                          {isSelected && (
                            <span className="text-xs text-primary font-medium">Active</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {mounted && theme === 'system' && resolvedTheme && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Currently using <span className="font-medium capitalize">{resolvedTheme}</span> based on your system preference.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab (admin/owner only) */}
        {isAdmin && (
          <TabsContent value="organization">
            <OrganizationSettingsPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
