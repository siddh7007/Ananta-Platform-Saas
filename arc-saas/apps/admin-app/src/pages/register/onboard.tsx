/**
 * Tenant Onboarding Page (Step 3 of Tenant Registration)
 *
 * After email verification, user sets up their tenant details.
 * This triggers the tenant + user provisioning workflow.
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Building2, Globe, Key, Loader2, CheckCircle, AlertCircle, Rocket } from "lucide-react";
import { API_URL, CUSTOMER_APP_URL } from "../../config/api";

// Use centralized API configuration
const API_BASE_URL = API_URL;

interface FormData {
  name: string;
  key: string;
  domains: string[];
}

export function OnboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"form" | "provisioning" | "success" | "error">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadToken, setLeadToken] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");

  const [formData, setFormData] = useState<FormData>({
    name: "",
    key: "",
    domains: [],
  });
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    // Get lead info from URL or session storage
    const id = searchParams.get("id") || sessionStorage.getItem("leadId");
    const token = sessionStorage.getItem("leadToken");
    const email = sessionStorage.getItem("leadEmail");

    // Get return URL from query params, session storage, or local storage (fallback for new tab)
    // Priority: URL param > sessionStorage > localStorage
    const returnUrlParam = searchParams.get("return_url")
      || sessionStorage.getItem("returnUrl")
      || localStorage.getItem("arc_saas_return_url");
    if (returnUrlParam) {
      const decodedUrl = decodeURIComponent(returnUrlParam);
      setReturnUrl(decodedUrl);
      // Sync to sessionStorage for consistency
      sessionStorage.setItem("returnUrl", returnUrlParam);
    }

    if (!id || !token) {
      setStep("error");
      setError("Session expired. Please start the registration process again.");
      return;
    }

    setLeadId(id);
    setLeadToken(token);
    setLeadEmail(email);

    // Pre-populate domain from email
    if (email) {
      const domain = email.split("@")[1];
      if (domain) {
        setFormData(prev => ({
          ...prev,
          domains: [domain],
        }));
        setDomainInput(domain);
      }
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "key") {
      // Sanitize key: lowercase, alphanumeric and hyphens only
      const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      setFormData(prev => ({ ...prev, key: sanitized }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomainInput(e.target.value);
  };

  const addDomain = () => {
    const domain = domainInput.trim().toLowerCase();
    if (domain && !formData.domains.includes(domain)) {
      setFormData(prev => ({
        ...prev,
        domains: [...prev.domains, domain],
      }));
    }
    setDomainInput("");
  };

  const removeDomain = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      domains: prev.domains.filter(d => d !== domain),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addDomain();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.domains.length === 0) {
      setError("Please add at least one domain for your organization.");
      return;
    }

    if (!formData.key) {
      setError("Please provide a unique tenant key.");
      return;
    }

    setIsLoading(true);
    setStep("provisioning");

    try {
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lead-Token": leadToken || "",
        },
        body: JSON.stringify({
          name: formData.name,
          key: formData.key,
          domains: formData.domains,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || data.message || "Tenant creation failed");
      }

      // Clear session storage (keep returnUrl for success page)
      sessionStorage.removeItem("leadToken");
      sessionStorage.removeItem("leadId");
      sessionStorage.removeItem("leadEmail");

      setStep("success");
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Failed to create tenant. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Provisioning animation
  if (step === "provisioning") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mx-auto mb-6">
            <Rocket className="w-10 h-10 text-blue-600 animate-bounce" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setting Up Your Workspace</h1>
          <p className="text-gray-600 mb-6">
            We're creating your tenant and provisioning your admin account...
          </p>

          {/* Progress Steps */}
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-700">Creating tenant record</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-sm text-gray-700">Provisioning infrastructure...</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
              <span className="text-sm text-gray-400">Creating admin user</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
              <span className="text-sm text-gray-400">Sending welcome email</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (step === "success") {
    // Determine the login URL - use return URL if provided, otherwise CUSTOMER_APP_URL
    // If returnUrl is a full path (contains /invitations, etc.), use it directly
    // Otherwise, append /login to the base URL
    let loginUrl = `${CUSTOMER_APP_URL}/login`;
    let portalName = "your dashboard";

    if (returnUrl) {
      try {
        const url = new URL(returnUrl);
        // If return URL has a specific path (like /invitations/xyz), redirect there
        // Otherwise, redirect to /login on that origin
        if (url.pathname && url.pathname !== '/' && url.pathname !== '/landing') {
          loginUrl = returnUrl;
        } else {
          loginUrl = `${url.origin}/login`;
        }
        portalName = "Customer Portal";
      } catch {
        // If URL parsing fails, use as-is
        loginUrl = returnUrl.includes('/login') ? returnUrl : `${returnUrl}/login`;
        portalName = "Customer Portal";
      }
    }

    // Clean up return URL from storage after success (both session and local)
    const handleGoToLogin = () => {
      sessionStorage.removeItem("returnUrl");
      localStorage.removeItem("arc_saas_return_url");
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're All Set!</h1>
          <p className="text-gray-600 mb-6">
            Your organization <strong>{formData.name || formData.key}</strong> has been created successfully.
            Check your email for login credentials.
          </p>

          <div className="p-4 bg-blue-50 rounded-lg mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Check your email for login credentials</li>
              <li>• Sign in to {portalName} to access your workspace</li>
              <li>• Invite team members and start managing your BOMs</li>
            </ul>
          </div>

          <a
            href={loginUrl}
            onClick={handleGoToLogin}
            className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all text-center"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Error state
  if (step === "error" && !leadId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Expired</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/register"
            className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all text-center"
          >
            Start Over
          </Link>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Your Workspace</h1>
          <p className="text-gray-400">Configure your tenant settings to get started</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-2xl p-8">
          {error && (
            <div className="flex items-center gap-2 p-4 mb-6 rounded-lg bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Acme Corporation"
                />
              </div>
            </div>

            {/* Tenant Key */}
            <div>
              <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-1">
                Tenant Key *
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="key"
                  name="key"
                  type="text"
                  required
                  value={formData.key}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="acme-corp"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Unique identifier for your tenant. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            {/* Domains */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allowed Email Domains *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={domainInput}
                    onChange={handleDomainChange}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="company.com"
                  />
                </div>
                <button
                  type="button"
                  onClick={addDomain}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Only users with these email domains can join your organization.
              </p>

              {/* Domain Tags */}
              {formData.domains.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.domains.map(domain => (
                    <span
                      key={domain}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {domain}
                      <button
                        type="button"
                        onClick={() => removeDomain(domain)}
                        className="ml-1 hover:text-blue-900"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || formData.domains.length === 0}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Workspace...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Create Workspace
                </>
              )}
            </button>
          </form>
        </div>

        {/* Steps Indicator */}
        <div className="mt-8 flex justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-gray-400 text-sm">Register</span>
          </div>
          <div className="w-8 h-px bg-gray-600 self-center"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-gray-400 text-sm">Verify</span>
          </div>
          <div className="w-8 h-px bg-gray-600 self-center"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">3</div>
            <span className="text-white text-sm">Setup</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardPage;
