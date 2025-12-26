import { useCreate, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { ArrowLeft, Plus, X, Info, DollarSign, Clock, Gauge, CreditCard } from "lucide-react";

interface PlanLimits {
  maxUsers: number;
  maxStorage: number;
  maxProjects: number;
  maxApiCalls: number;
  [key: string]: number;
}

interface PlanFormData {
  name: string;
  description: string;
  tier: string;
  price: number;
  billingCycleId: string;
  currencyId: string;
  features: string[];
  limits: PlanLimits;
  trialEnabled: boolean;
  trialDuration: number;
  trialDurationUnit: string;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  stripePriceId: string;
  stripeProductId: string;
}

const DEFAULT_LIMITS: PlanLimits = {
  maxUsers: 5,
  maxStorage: 10,
  maxProjects: 10,
  maxApiCalls: 10000,
};

export function PlanCreate() {
  const { list } = useNavigation();
  const { mutate, isLoading } = useCreate();

  const [formData, setFormData] = useState<PlanFormData>({
    name: "",
    description: "",
    tier: "free",
    price: 0,
    billingCycleId: "",
    currencyId: "",
    features: [],
    limits: { ...DEFAULT_LIMITS },
    trialEnabled: false,
    trialDuration: 14,
    trialDurationUnit: "day",
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    stripePriceId: "",
    stripeProductId: "",
  });

  const [newFeature, setNewFeature] = useState("");
  const [activeTab, setActiveTab] = useState<"basic" | "limits" | "trial" | "stripe">("basic");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      {
        resource: "plans",
        values: formData,
      },
      {
        onSuccess: () => {
          list("plans");
        },
      }
    );
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData((d) => ({
        ...d,
        features: [...d.features, newFeature.trim()],
      }));
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFormData((d) => ({
      ...d,
      features: d.features.filter((_, i) => i !== index),
    }));
  };

  const updateLimit = (key: keyof PlanLimits, value: number) => {
    setFormData((d) => ({
      ...d,
      limits: { ...d.limits, [key]: value },
    }));
  };

  const tabs = [
    { id: "basic", label: "Basic Info", icon: Info },
    { id: "limits", label: "Limits & Quotas", icon: Gauge },
    { id: "trial", label: "Trial Settings", icon: Clock },
    { id: "stripe", label: "Stripe Integration", icon: CreditCard },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => list("plans")} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Plan</h1>
          <p className="text-muted-foreground">Add a new subscription plan</p>
        </div>
      </div>

      <div className="max-w-3xl">
        {/* Tabs */}
        <div className="flex border-b mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Plan Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">Plan Name *</label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Starter Plan"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tier" className="text-sm font-medium">Tier *</label>
                  <select
                    id="tier"
                    value={formData.tier}
                    onChange={(e) => setFormData((d) => ({ ...d, tier: e.target.value }))}
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
                  value={formData.description}
                  onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe what's included in this plan..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label htmlFor="price" className="text-sm font-medium">Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData((d) => ({ ...d, price: parseFloat(e.target.value) || 0 }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="billingCycle" className="text-sm font-medium">Billing Cycle *</label>
                  <select
                    id="billingCycle"
                    value={formData.billingCycleId}
                    onChange={(e) => setFormData((d) => ({ ...d, billingCycleId: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select cycle</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="sortOrder" className="text-sm font-medium">Sort Order</label>
                  <input
                    id="sortOrder"
                    type="number"
                    min="0"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData((d) => ({ ...d, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Features</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                    className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Add a feature (e.g., Unlimited projects)"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {formData.features.length > 0 && (
                  <ul className="space-y-2 mt-2">
                    {formData.features.map((feature, index) => (
                      <li key={index} className="flex items-center justify-between bg-muted px-3 py-2 rounded-md">
                        <span className="text-sm">{feature}</span>
                        <button type="button" onClick={() => removeFeature(index)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((d) => ({ ...d, isActive: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <label htmlFor="isActive" className="text-sm">Active</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="isPublic"
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData((d) => ({ ...d, isPublic: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <label htmlFor="isPublic" className="text-sm">Public (visible on pricing page)</label>
                </div>
              </div>
            </div>
          )}

          {/* Limits & Quotas Tab */}
          {activeTab === "limits" && (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Resource Limits
              </h3>
              <p className="text-sm text-muted-foreground">
                Set resource limits and quotas for this plan. Use -1 for unlimited.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="maxUsers" className="text-sm font-medium">Max Users</label>
                  <input
                    id="maxUsers"
                    type="number"
                    min="-1"
                    value={formData.limits.maxUsers}
                    onChange={(e) => updateLimit("maxUsers", parseInt(e.target.value) || 0)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Maximum team members allowed</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="maxStorage" className="text-sm font-medium">Max Storage (GB)</label>
                  <input
                    id="maxStorage"
                    type="number"
                    min="-1"
                    value={formData.limits.maxStorage}
                    onChange={(e) => updateLimit("maxStorage", parseInt(e.target.value) || 0)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Storage space in gigabytes</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="maxProjects" className="text-sm font-medium">Max Projects</label>
                  <input
                    id="maxProjects"
                    type="number"
                    min="-1"
                    value={formData.limits.maxProjects}
                    onChange={(e) => updateLimit("maxProjects", parseInt(e.target.value) || 0)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Maximum projects/workspaces</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="maxApiCalls" className="text-sm font-medium">API Calls/Month</label>
                  <input
                    id="maxApiCalls"
                    type="number"
                    min="-1"
                    value={formData.limits.maxApiCalls}
                    onChange={(e) => updateLimit("maxApiCalls", parseInt(e.target.value) || 0)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Monthly API call limit</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Tip:</strong> Set a value of -1 to indicate unlimited access for that resource.
                </p>
              </div>
            </div>
          )}

          {/* Trial Settings Tab */}
          {activeTab === "trial" && (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Trial Period Settings
              </h3>

              <div className="flex items-center gap-2">
                <input
                  id="trialEnabled"
                  type="checkbox"
                  checked={formData.trialEnabled}
                  onChange={(e) => setFormData((d) => ({ ...d, trialEnabled: e.target.checked }))}
                  className="rounded border-input h-5 w-5"
                />
                <label htmlFor="trialEnabled" className="text-sm font-medium">Enable free trial for this plan</label>
              </div>

              {formData.trialEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <label htmlFor="trialDuration" className="text-sm font-medium">Trial Duration</label>
                    <input
                      id="trialDuration"
                      type="number"
                      min="1"
                      value={formData.trialDuration}
                      onChange={(e) => setFormData((d) => ({ ...d, trialDuration: parseInt(e.target.value) || 1 }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="trialDurationUnit" className="text-sm font-medium">Duration Unit</label>
                    <select
                      id="trialDurationUnit"
                      value={formData.trialDurationUnit}
                      onChange={(e) => setFormData((d) => ({ ...d, trialDurationUnit: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="day">Days</option>
                      <option value="week">Weeks</option>
                      <option value="month">Months</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.trialEnabled && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Users will get <strong>{formData.trialDuration} {formData.trialDurationUnit}(s)</strong> of free access before being charged.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stripe Integration Tab */}
          {activeTab === "stripe" && (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Stripe Integration
              </h3>
              <p className="text-sm text-muted-foreground">
                Connect this plan to Stripe for automatic billing. Create the product and price in Stripe first.
              </p>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label htmlFor="stripeProductId" className="text-sm font-medium">Stripe Product ID</label>
                  <input
                    id="stripeProductId"
                    type="text"
                    value={formData.stripeProductId}
                    onChange={(e) => setFormData((d) => ({ ...d, stripeProductId: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="prod_xxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">The product ID from your Stripe dashboard</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="stripePriceId" className="text-sm font-medium">Stripe Price ID</label>
                  <input
                    id="stripePriceId"
                    type="text"
                    value={formData.stripePriceId}
                    onChange={(e) => setFormData((d) => ({ ...d, stripePriceId: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="price_xxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">The price ID for recurring billing</p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 border rounded-lg p-4 mt-4">
                <h4 className="text-sm font-medium mb-2">How to get Stripe IDs:</h4>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Go to your Stripe Dashboard Products page</li>
                  <li>Create a new product with a recurring price</li>
                  <li>Copy the Product ID (starts with prod_)</li>
                  <li>Copy the Price ID (starts with price_)</li>
                </ol>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Plan"}
            </button>
            <button
              type="button"
              onClick={() => list("plans")}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
