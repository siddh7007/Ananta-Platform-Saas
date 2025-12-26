import { useShow, useUpdate, useNotification } from "@refinedev/core";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, X, CreditCard, Settings, Zap, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Switch } from "../../components/ui/switch";

interface PlanLimits {
  maxUsers: number | null;
  maxStorage: number | null; // in GB
  maxProjects: number | null;
  maxApiCalls: number | null; // per month
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  tier: string;
  price: number;
  billingCycle: string;
  features: string[];
  isActive: boolean;
  // Limits
  limits?: PlanLimits;
  // Trial settings
  trialEnabled?: boolean;
  trialDuration?: number;
  trialDurationUnit?: "days" | "weeks" | "months";
  // Stripe integration
  stripePriceId?: string;
  stripeProductId?: string;
}

interface PlanFormData extends Omit<Plan, 'id'> {
  limits: PlanLimits;
}

export function PlanEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { open } = useNotification();
  const { queryResult } = useShow<Plan>({ resource: "plans", id });
  const { mutate, isLoading: isSaving } = useUpdate<Plan>();

  const [formData, setFormData] = useState<PlanFormData | null>(null);
  const [newFeature, setNewFeature] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  const { data, isLoading } = queryResult;

  useEffect(() => {
    if (data?.data) {
      const plan = data.data;
      setFormData({
        name: plan.name,
        description: plan.description || "",
        tier: plan.tier,
        price: typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price,
        billingCycle: plan.billingCycle || "month",
        features: plan.features || [],
        isActive: plan.isActive,
        limits: plan.limits || {
          maxUsers: null,
          maxStorage: null,
          maxProjects: null,
          maxApiCalls: null,
        },
        trialEnabled: plan.trialEnabled || false,
        trialDuration: plan.trialDuration || 14,
        trialDurationUnit: plan.trialDurationUnit || "days",
        stripePriceId: plan.stripePriceId || "",
        stripeProductId: plan.stripeProductId || "",
      });
    }
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !id) return;

    mutate(
      {
        resource: "plans",
        id: id,
        values: formData,
      },
      {
        onSuccess: () => {
          open?.({
            type: "success",
            message: "Plan updated successfully",
          });
          navigate("/plans");
        },
        onError: (error) => {
          open?.({
            type: "error",
            message: error?.message || "Failed to update plan",
          });
        },
      }
    );
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[PlanEdit] Cancel clicked, navigating to /plans");
    navigate("/plans");
  };

  const addFeature = () => {
    if (newFeature.trim() && formData) {
      setFormData({
        ...formData,
        features: [...formData.features, newFeature.trim()],
      });
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    if (formData) {
      setFormData({
        ...formData,
        features: formData.features.filter((_, i) => i !== index),
      });
    }
  };

  const updateLimit = (key: keyof PlanLimits, value: string) => {
    if (!formData) return;
    const numValue = value === "" ? null : parseInt(value, 10);
    setFormData({
      ...formData,
      limits: {
        ...formData.limits,
        [key]: numValue,
      },
    });
  };

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={handleCancel} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Plan</h1>
          <p className="text-muted-foreground">Update plan details and configuration</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="limits" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Limits
            </TabsTrigger>
            <TabsTrigger value="trial" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Trial
            </TabsTrigger>
            <TabsTrigger value="stripe" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Stripe
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="mt-6">
            <div className="max-w-2xl rounded-lg border bg-card p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">Plan Name</label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tier" className="text-sm font-medium">Tier</label>
                  <select
                    id="tier"
                    value={formData.tier}
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="FREE">Free</option>
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe what this plan offers..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="price" className="text-sm font-medium">Price ($)</label>
                  <input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="billingCycle" className="text-sm font-medium">Billing Cycle</label>
                  <select
                    id="billingCycle"
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Features</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                    className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Add a feature"
                  />
                  <button type="button" onClick={addFeature} className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <ul className="space-y-2 mt-2">
                  {formData.features?.map((feature, index) => (
                    <li key={index} className="flex items-center justify-between bg-muted px-3 py-2 rounded-md">
                      <span className="text-sm">{feature}</span>
                      <button type="button" onClick={() => removeFeature(index)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <label htmlFor="isActive" className="text-sm font-medium">Active Status</label>
                  <p className="text-xs text-muted-foreground">Make this plan available for subscription</p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
          </TabsContent>

          {/* Limits Tab */}
          <TabsContent value="limits" className="mt-6">
            <div className="max-w-2xl rounded-lg border bg-card p-6 space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium">Usage Limits & Quotas</h3>
                <p className="text-sm text-muted-foreground">Set limits for this plan. Leave empty for unlimited.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="maxUsers" className="text-sm font-medium">Max Users</label>
                  <input
                    id="maxUsers"
                    type="number"
                    min="0"
                    value={formData.limits.maxUsers ?? ""}
                    onChange={(e) => updateLimit("maxUsers", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">Maximum team members allowed</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="maxStorage" className="text-sm font-medium">Max Storage (GB)</label>
                  <input
                    id="maxStorage"
                    type="number"
                    min="0"
                    value={formData.limits.maxStorage ?? ""}
                    onChange={(e) => updateLimit("maxStorage", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">Storage quota in gigabytes</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="maxProjects" className="text-sm font-medium">Max Projects</label>
                  <input
                    id="maxProjects"
                    type="number"
                    min="0"
                    value={formData.limits.maxProjects ?? ""}
                    onChange={(e) => updateLimit("maxProjects", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">Maximum number of projects</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="maxApiCalls" className="text-sm font-medium">Max API Calls / Month</label>
                  <input
                    id="maxApiCalls"
                    type="number"
                    min="0"
                    value={formData.limits.maxApiCalls ?? ""}
                    onChange={(e) => updateLimit("maxApiCalls", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">Monthly API call quota</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Trial Settings Tab */}
          <TabsContent value="trial" className="mt-6">
            <div className="max-w-2xl rounded-lg border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium">Trial Period</h3>
                  <p className="text-sm text-muted-foreground">Allow users to try this plan before subscribing</p>
                </div>
                <Switch
                  id="trialEnabled"
                  checked={formData.trialEnabled || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, trialEnabled: checked })}
                />
              </div>

              {formData.trialEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <label htmlFor="trialDuration" className="text-sm font-medium">Trial Duration</label>
                    <input
                      id="trialDuration"
                      type="number"
                      min="1"
                      value={formData.trialDuration || 14}
                      onChange={(e) => setFormData({ ...formData, trialDuration: parseInt(e.target.value) || 14 })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="trialDurationUnit" className="text-sm font-medium">Duration Unit</label>
                    <select
                      id="trialDurationUnit"
                      value={formData.trialDurationUnit || "days"}
                      onChange={(e) => setFormData({ ...formData, trialDurationUnit: e.target.value as "days" | "weeks" | "months" })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Stripe Integration Tab */}
          <TabsContent value="stripe" className="mt-6">
            <div className="max-w-2xl rounded-lg border bg-card p-6 space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium">Stripe Integration</h3>
                <p className="text-sm text-muted-foreground">Connect this plan to Stripe for payment processing</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="stripeProductId" className="text-sm font-medium">Stripe Product ID</label>
                  <input
                    id="stripeProductId"
                    type="text"
                    value={formData.stripeProductId || ""}
                    onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="prod_xxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">The Stripe Product ID for this plan</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="stripePriceId" className="text-sm font-medium">Stripe Price ID</label>
                  <input
                    id="stripePriceId"
                    type="text"
                    value={formData.stripePriceId || ""}
                    onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="price_xxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">The Stripe Price ID for recurring billing</p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Create products and prices in your Stripe Dashboard, then copy the IDs here.
                    These IDs are used to create subscriptions and process payments.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 max-w-2xl">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" onClick={handleCancel} className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
