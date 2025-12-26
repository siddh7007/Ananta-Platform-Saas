import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAlertPreferences, useUpdateAlertPreferences } from '@/hooks/useAlerts';
import { Skeleton } from '@/components/ui/skeleton';
import type { AlertType, AlertPreferences } from '@/types/alert';

interface AlertPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const alertTypeOptions: { value: AlertType; label: string; description: string }[] = [
  { value: 'LIFECYCLE', label: 'Lifecycle Changes', description: 'EOL, NRND, and obsolescence notifications' },
  { value: 'RISK', label: 'Risk Alerts', description: 'Component risk score changes' },
  { value: 'PRICE', label: 'Price Changes', description: 'Significant price fluctuations' },
  { value: 'AVAILABILITY', label: 'Availability', description: 'Stock level and lead time changes' },
  { value: 'COMPLIANCE', label: 'Compliance', description: 'Regulatory and compliance updates' },
  { value: 'PCN', label: 'PCN Notifications', description: 'Product Change Notifications' },
  { value: 'SUPPLY_CHAIN', label: 'Supply Chain', description: 'Supply chain disruptions' },
];

const emailFrequencyOptions = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Digest' },
  { value: 'never', label: 'Never (In-app only)' },
];

export function AlertPreferencesDialog({ open, onOpenChange }: AlertPreferencesDialogProps) {
  const { data: preferences, isLoading } = useAlertPreferences();
  const updatePreferences = useUpdateAlertPreferences();

  const [formData, setFormData] = useState<Partial<AlertPreferences>>({
    alert_types: [],
    email_frequency: 'daily',
    threshold_risk_score: 70,
    threshold_price_change: 10,
    threshold_lead_time: 14,
    notification_channels: {
      email: true,
      in_app: true,
      slack: false,
    },
  });

  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);

  const handleTypeToggle = (type: AlertType, checked: boolean) => {
    const currentTypes = formData.alert_types || [];
    const newTypes = checked
      ? [...currentTypes, type]
      : currentTypes.filter((t) => t !== type);

    setFormData({ ...formData, alert_types: newTypes });
  };

  const handleSave = async () => {
    await updatePreferences.mutateAsync(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alert Preferences</DialogTitle>
          <DialogDescription>
            Configure which alerts you want to receive and how you want to be notified.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Alert Types */}
            <div className="space-y-3">
              <Label className="text-base">Alert Types</Label>
              <p className="text-sm text-muted-foreground">
                Select which types of alerts you want to receive.
              </p>
              <div className="space-y-3">
                {alertTypeOptions.map((option) => (
                  <div key={option.value} className="flex items-start space-x-3">
                    <Checkbox
                      id={option.value}
                      checked={formData.alert_types?.includes(option.value)}
                      onCheckedChange={(checked) =>
                        handleTypeToggle(option.value, checked as boolean)
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={option.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Frequency */}
            <div className="space-y-3">
              <Label htmlFor="email-frequency" className="text-base">
                Email Frequency
              </Label>
              <Select
                value={formData.email_frequency}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    email_frequency: value as AlertPreferences['email_frequency'],
                  })
                }
              >
                <SelectTrigger id="email-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {emailFrequencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Thresholds */}
            <div className="space-y-4">
              <Label className="text-base">Alert Thresholds</Label>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-threshold">Risk Score Threshold</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="risk-threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.threshold_risk_score}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          threshold_risk_score: Number(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      Alert when risk score exceeds this value
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price-threshold">Price Change Threshold (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="price-threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.threshold_price_change}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          threshold_price_change: Number(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      Alert when price changes by more than this percentage
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadtime-threshold">Lead Time Threshold (days)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="leadtime-threshold"
                      type="number"
                      min="0"
                      value={formData.threshold_lead_time}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          threshold_lead_time: Number(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      Alert when lead time exceeds this many days
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Channels */}
            <div className="space-y-3">
              <Label className="text-base">Notification Channels</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="channel-email"
                    checked={formData.notification_channels?.email}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        notification_channels: {
                          ...formData.notification_channels!,
                          email: checked as boolean,
                        },
                      })
                    }
                  />
                  <label
                    htmlFor="channel-email"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Email notifications
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="channel-in-app"
                    checked={formData.notification_channels?.in_app}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        notification_channels: {
                          ...formData.notification_channels!,
                          in_app: checked as boolean,
                        },
                      })
                    }
                  />
                  <label
                    htmlFor="channel-in-app"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    In-app notifications
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updatePreferences.isPending}>
            {updatePreferences.isPending ? 'Saving...' : 'Save Preferences'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
