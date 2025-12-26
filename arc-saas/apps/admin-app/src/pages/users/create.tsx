import { useCreate, useNavigation, useList } from "@refinedev/core";
import { useState } from "react";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";

// Available roles that can be assigned
const AVAILABLE_ROLES = [
  { key: "super-admin", label: "Super Admin", description: "Full system access" },
  { key: "admin", label: "Admin", description: "Administrative access" },
  { key: "manager", label: "Manager", description: "Team management access" },
  { key: "member", label: "Member", description: "Standard user access" },
  { key: "viewer", label: "Viewer", description: "Read-only access" },
];

interface Tenant {
  id: string;
  name: string;
  key: string;
}

export function UserCreate() {
  const { list, show } = useNavigation();
  const { mutate: createUser, isLoading: isCreating } = useCreate();

  // Fetch available tenants
  const { data: tenantsData } = useList<Tenant>({
    resource: "tenants",
    pagination: { pageSize: 100 },
  });
  const tenants = tenantsData?.data || [];

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    username: "",
    tenantId: "",
    role: "member",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.tenantId) {
      newErrors.tenantId = "Please select a tenant";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    createUser(
      {
        resource: "users",
        values: {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username || formData.email.split("@")[0],
          tenantId: formData.tenantId,
          status: 1, // Active
          roleKey: formData.role, // BUG-003 FIX: Include role in user creation
        },
      },
      {
        onSuccess: (data) => {
          // Navigate to the newly created user
          if (data.data?.id) { show("users", data.data.id); } else { list("users"); }
        },
        onError: () => {
          setErrors({ submit: "Failed to create user. Please try again." });
        },
      }
    );
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => list("users")}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create User</h1>
          <p className="text-muted-foreground">
            Add a new user to the platform
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${
                    errors.firstName ? "border-destructive" : "border-input"
                  }`}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${
                    errors.lastName ? "border-destructive" : "border-input"
                  }`}
                  placeholder="Doe"
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${
                    errors.email ? "border-destructive" : "border-input"
                  }`}
                  placeholder="john.doe@example.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="johndoe (optional)"
                />
                <p className="text-xs text-muted-foreground">
                  If not provided, will be derived from email
                </p>
              </div>
            </div>
          </div>

          {/* Tenant & Role */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Tenant & Role</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tenant <span className="text-destructive">*</span>
                </label>
                <select
                  name="tenantId"
                  value={formData.tenantId}
                  onChange={handleChange}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${
                    errors.tenantId ? "border-destructive" : "border-input"
                  }`}
                >
                  <option value="">Select a tenant...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.key})
                    </option>
                  ))}
                </select>
                {errors.tenantId && (
                  <p className="text-xs text-destructive">{errors.tenantId}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {AVAILABLE_ROLES.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  This role will be assigned to the user upon creation
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{errors.submit}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => list("users")}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
