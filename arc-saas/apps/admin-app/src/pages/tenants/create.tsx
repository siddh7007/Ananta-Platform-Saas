import { useCreate, useNavigation, useList, useCustomMutation, useNotification } from "@refinedev/core";
import { useState, useMemo } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  tier: string;
  price: number;
}

interface CreatedTenant {
  id: string;
  name: string;
  key: string;
}

export function TenantCreate() {
  const { list, show } = useNavigation();
  const { mutate, isLoading } = useCreate<CreatedTenant>();
  const { mutate: provisionMutate, isLoading: isProvisioning } = useCustomMutation();
  const { data: plansData } = useList<Plan>({ resource: "plans" });

  const { open: openNotification } = useNotification();

  const [formData, setFormData] = useState({
    name: "",
    key: "",
    adminEmail: "",
    planId: "",
  });

  // Validate tenant key: must start with lowercase letter, 2-10 chars, lowercase alphanumeric only
  const keyValidation = useMemo(() => {
    const key = formData.key;
    if (!key) return { valid: true, message: "" }; // Empty is handled by required

    const pattern = /^[a-z][a-z0-9]{1,9}$/;
    if (!pattern.test(key)) {
      if (!/^[a-z]/.test(key)) {
        return { valid: false, message: "Must start with a lowercase letter (a-z)" };
      }
      if (key.length < 2) {
        return { valid: false, message: "Must be at least 2 characters" };
      }
      if (!/^[a-z0-9]+$/.test(key)) {
        return { valid: false, message: "Only lowercase letters and numbers allowed" };
      }
      return { valid: false, message: "Invalid format" };
    }
    return { valid: true, message: "" };
  }, [formData.key]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation before API call
    if (!keyValidation.valid) {
      openNotification?.({
        type: "error",
        message: "Validation Error",
        description: keyValidation.message || "Please fix the tenant key format",
      });
      return;
    }

    mutate(
      {
        resource: "tenants",
        values: formData,
      },
      {
        onError: (error: any) => {
          // Extract validation error details from API response
          let errorMessage = "Failed to create tenant";
          if (error?.response?.data?.error?.details?.length) {
            const details = error.response.data.error.details;
            errorMessage = details.map((d: any) => d.message).join(", ");
          } else if (error?.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
          } else if (error?.message) {
            errorMessage = error.message;
          }

          openNotification?.({
            type: "error",
            message: "Creation Failed",
            description: errorMessage,
          });
        },
        onSuccess: (data) => {
          // Auto-provision the tenant after creation
          const tenantId = data?.data?.id;
          if (tenantId) {
            // Generate a complete SubscriptionDTO for the provision endpoint
            const subscriptionId = crypto.randomUUID();
            const startDate = new Date().toISOString();
            const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now

            provisionMutate(
              {
                url: `/tenants/${tenantId}/provision`,
                method: "post",
                values: {
                  id: subscriptionId,
                  subscriberId: tenantId,
                  startDate: startDate,
                  endDate: endDate,
                  status: 1, // Active subscription
                  planId: formData.planId,
                  invoiceId: `inv-${subscriptionId.slice(0, 8)}`,
                },
              },
              {
                onSuccess: () => {
                  // Navigate to tenant detail page to see provisioning progress
                  show("tenants", tenantId);
                },
                onError: () => {
                  // Even if provisioning fails, navigate to tenant detail
                  show("tenants", tenantId);
                },
              }
            );
          } else {
            list("tenants");
          }
        },
      }
    );
  };

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => list("tenants")}
          className="p-2 rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Tenant</h1>
          <p className="text-muted-foreground">
            Add a new tenant to your platform
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Tenant Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData((d) => ({
                    ...d,
                    name,
                    key: d.key || generateKey(name),
                  }));
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Acme Corporation"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="key" className="text-sm font-medium">
                Tenant Key
              </label>
              <input
                id="key"
                type="text"
                value={formData.key}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, key: e.target.value.toLowerCase() }))
                }
                className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
                  formData.key && !keyValidation.valid
                    ? "border-red-500 focus:ring-red-500"
                    : "border-input focus:ring-ring"
                }`}
                placeholder="acmecorp"
                pattern="^[a-z][a-z0-9]{1,9}$"
                maxLength={10}
                required
              />
              {formData.key && !keyValidation.valid ? (
                <div className="flex items-center gap-1.5 text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <p className="text-xs">{keyValidation.message}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Must start with a letter. 2-10 chars, lowercase letters and numbers only.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="adminEmail" className="text-sm font-medium">
                Admin Email
              </label>
              <input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, adminEmail: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="admin@acme.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="planId" className="text-sm font-medium">
                Subscription Plan
              </label>
              <select
                id="planId"
                value={formData.planId}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, planId: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Select a plan</option>
                {plansData?.data?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - ${plan.price}/month
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading || isProvisioning || (formData.key.length > 0 && !keyValidation.valid)}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : isProvisioning ? "Provisioning..." : "Create & Provision Tenant"}
            </button>
            <button
              type="button"
              onClick={() => list("tenants")}
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
