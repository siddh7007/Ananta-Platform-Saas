import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  User,
  Building,
  Bell,
  Shield,
  CreditCard,
  Key,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  Globe,
  Palette,
} from 'lucide-react';
import { api } from '../lib/api';
import { useTenant } from '../lib/tenant-context';
import { useAuth } from '../lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

interface TenantSettings {
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  timezone: string;
  currency: string;
  website?: string;
  logo?: string;
  primaryColor?: string;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  weeklyDigest: boolean;
  securityAlerts: boolean;
  billingAlerts: boolean;
  teamUpdates: boolean;
}

interface SubscriptionInfo {
  planName: string;
  planTier: string;
  status: string;
  currentPeriodEnd: string;
  amount: number;
  currency: string;
  billingCycle: string;
}

interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (\u20ac)' },
  { value: 'GBP', label: 'British Pound (\u00a3)' },
  { value: 'INR', label: 'Indian Rupee (\u20b9)' },
  { value: 'JPY', label: 'Japanese Yen (\u00a5)' },
  { value: 'AUD', label: 'Australian Dollar (A$)' },
  { value: 'CAD', label: 'Canadian Dollar (C$)' },
];

export default function Settings() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<UserProfile>('/users/me'),
  });

  // Fetch tenant settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<TenantSettings>('/settings'),
  });

  // Fetch notification preferences
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get<NotificationPreferences>('/users/me/notification-preferences'),
  });

  // Fetch subscription info
  const { data: subscription } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => api.get<SubscriptionInfo>('/subscriptions/current'),
  });

  // State for forms
  const [profileForm, setProfileForm] = useState<UserProfile | null>(null);
  const [settingsForm, setSettingsForm] = useState<TenantSettings | null>(null);
  const [notificationsForm, setNotificationsForm] = useState<NotificationPreferences | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordChange>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Initialize forms when data loads
  useEffect(() => {
    if (profile && !profileForm) setProfileForm(profile);
  }, [profile, profileForm]);

  useEffect(() => {
    if (settings && !settingsForm) setSettingsForm(settings);
  }, [settings, settingsForm]);

  useEffect(() => {
    if (notifications && !notificationsForm) setNotificationsForm(notifications);
  }, [notifications, notificationsForm]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: UserProfile) => api.put('/users/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      showSuccess('Profile updated successfully');
    },
    onError: (error: Error) => showError(error.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: TenantSettings) => api.put('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      showSuccess('Settings updated successfully');
    },
    onError: (error: Error) => showError(error.message),
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: (data: NotificationPreferences) => api.put('/users/me/notification-preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      showSuccess('Notification preferences updated');
    },
    onError: (error: Error) => showError(error.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordChange) => api.post('/auth/change-password', data),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showSuccess('Password changed successfully');
    },
    onError: (error: Error) => showError(error.message),
  });

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm) updateProfileMutation.mutate(profileForm);
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsForm) updateSettingsMutation.mutate(settingsForm);
  };

  const handleNotificationsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (notificationsForm) updateNotificationsMutation.mutate(notificationsForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }
    changePasswordMutation.mutate(passwordForm);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const isLoading = profileLoading || settingsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your {tenant?.name} account and preferences
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{errorMessage}</span>
        </div>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Company</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <form onSubmit={handleProfileSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {profileForm?.firstName?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <Button variant="outline" type="button">
                      Change Avatar
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG or GIF. Max 2MB.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileForm?.firstName || ''}
                      onChange={(e) =>
                        setProfileForm((p) => (p ? { ...p, firstName: e.target.value } : null))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileForm?.lastName || ''}
                      onChange={(e) =>
                        setProfileForm((p) => (p ? { ...p, lastName: e.target.value } : null))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={profileForm?.email || ''}
                      onChange={(e) =>
                        setProfileForm((p) => (p ? { ...p, email: e.target.value } : null))
                      }
                    />
                    <Badge variant="outline" className="shrink-0">
                      <Mail className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileForm?.phone || ''}
                    onChange={(e) =>
                      setProfileForm((p) => (p ? { ...p, phone: e.target.value } : null))
                    }
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company">
          <form onSubmit={handleSettingsSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Manage your organization's details and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={settingsForm?.companyName || ''}
                    onChange={(e) =>
                      setSettingsForm((s) => (s ? { ...s, companyName: e.target.value } : null))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="website"
                      type="url"
                      value={settingsForm?.website || ''}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, website: e.target.value } : null))
                      }
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={settingsForm?.address || ''}
                    onChange={(e) =>
                      setSettingsForm((s) => (s ? { ...s, address: e.target.value } : null))
                    }
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={settingsForm?.contactEmail || ''}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, contactEmail: e.target.value } : null))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      value={settingsForm?.contactPhone || ''}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, contactPhone: e.target.value } : null))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Regional & Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={settingsForm?.timezone || ''}
                      onValueChange={(value) =>
                        setSettingsForm((s) => (s ? { ...s, timezone: value } : null))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={settingsForm?.currency || ''}
                      onValueChange={(value) =>
                        setSettingsForm((s) => (s ? { ...s, currency: value } : null))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateSettingsMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Company Settings'}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <form onSubmit={handleNotificationsSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose how and when you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {notificationsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications via email
                        </p>
                      </div>
                      <Switch
                        checked={notificationsForm?.emailNotifications ?? true}
                        onCheckedChange={(checked) =>
                          setNotificationsForm((n) =>
                            n ? { ...n, emailNotifications: checked } : null
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium">In-App Notifications</p>
                        <p className="text-sm text-muted-foreground">
                          Show notifications in the app
                        </p>
                      </div>
                      <Switch
                        checked={notificationsForm?.inAppNotifications ?? true}
                        onCheckedChange={(checked) =>
                          setNotificationsForm((n) =>
                            n ? { ...n, inAppNotifications: checked } : null
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium">Weekly Digest</p>
                        <p className="text-sm text-muted-foreground">
                          Receive a weekly summary of activity
                        </p>
                      </div>
                      <Switch
                        checked={notificationsForm?.weeklyDigest ?? false}
                        onCheckedChange={(checked) =>
                          setNotificationsForm((n) =>
                            n ? { ...n, weeklyDigest: checked } : null
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium">Security Alerts</p>
                        <p className="text-sm text-muted-foreground">
                          Get notified about security-related events
                        </p>
                      </div>
                      <Switch
                        checked={notificationsForm?.securityAlerts ?? true}
                        onCheckedChange={(checked) =>
                          setNotificationsForm((n) =>
                            n ? { ...n, securityAlerts: checked } : null
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium">Billing Alerts</p>
                        <p className="text-sm text-muted-foreground">
                          Notifications about payments and invoices
                        </p>
                      </div>
                      <Switch
                        checked={notificationsForm?.billingAlerts ?? true}
                        onCheckedChange={(checked) =>
                          setNotificationsForm((n) =>
                            n ? { ...n, billingAlerts: checked } : null
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">Team Updates</p>
                        <p className="text-sm text-muted-foreground">
                          When team members join or leave
                        </p>
                      </div>
                      <Switch
                        checked={notificationsForm?.teamUpdates ?? true}
                        onCheckedChange={(checked) =>
                          setNotificationsForm((n) =>
                            n ? { ...n, teamUpdates: checked } : null
                          )
                        }
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateNotificationsMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateNotificationsMutation.isPending ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                        }
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Must be at least 8 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <Button type="submit" disabled={changePasswordMutation.isPending}>
                    <Key className="mr-2 h-4 w-4" />
                    {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      Two-factor authentication is not enabled
                    </p>
                  </div>
                  <Button variant="outline">Enable 2FA</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button variant="destructive">Delete Account</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <div className="space-y-6">
            {subscription ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Current Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold">{subscription.planName}</h3>
                          <Badge
                            variant={subscription.status === 'active' ? 'default' : 'secondary'}
                          >
                            {subscription.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground capitalize">{subscription.planTier} tier</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {formatCurrency(subscription.amount, subscription.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          per {subscription.billingCycle === 'yearly' ? 'year' : 'month'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Your plan renews on{' '}
                        <strong>
                          {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                        </strong>
                      </p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline">Change Plan</Button>
                      <Button variant="outline">Manage Billing</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-14 rounded bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">VISA</span>
                        </div>
                        <div>
                          <p className="font-medium">**** **** **** 4242</p>
                          <p className="text-sm text-muted-foreground">Expires 12/25</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Update
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
                  <p className="text-muted-foreground mb-4">
                    You are currently on the free plan
                  </p>
                  <Button>Upgrade Now</Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">
                  No billing history available
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
