/**
 * Lead Registration Page (Step 1 of Tenant Onboarding)
 *
 * This is a PUBLIC page where new companies register their interest.
 * After submission, an email is sent for verification.
 */

import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Mail, User, MapPin, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { API_URL } from "../../config/api";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  address?: {
    country: string;
    state: string;
    city: string;
    address: string;
    zip: string;
  };
}

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"form" | "success">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);

  // Store return URL in BOTH session and local storage for resilience
  // sessionStorage: faster access within same tab
  // localStorage: survives new tab (e.g., email verification opened in new tab)
  useEffect(() => {
    const returnUrl = searchParams.get("return_url");
    if (returnUrl) {
      sessionStorage.setItem("returnUrl", returnUrl);
      localStorage.setItem("arc_saas_return_url", returnUrl);
    }
  }, [searchParams]);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    companyName: "",
    address: {
      country: "",
      state: "",
      city: "",
      address: "",
      zip: "",
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name.startsWith("address.")) {
      const addressField = name.split(".")[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address!,
          [addressField]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload: Record<string, unknown> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        companyName: formData.companyName,
      };

      // Only include address if country is provided
      if (showAddress && formData.address?.country) {
        payload.address = formData.address;
      }

      const response = await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || data.message || "Registration failed");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email!</h1>
          <p className="text-gray-600 mb-6">
            We've sent a verification link to <strong>{formData.email}</strong>.
            Please click the link to continue setting up your account.
          </p>
          <p className="text-sm text-gray-500">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              onClick={() => setStep("form")}
              className="text-blue-600 hover:underline"
            >
              try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Start Your Journey</h1>
          <p className="text-gray-400">Register your company to get started with our platform</p>
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
            {/* Personal Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <User className="w-4 h-4" />
                <span>Personal Information</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Work Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@company.com"
                  />
                </div>
              </div>
            </div>

            {/* Company Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Building2 className="w-4 h-4" />
                <span>Company Information</span>
              </div>

              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Acme Inc."
                />
              </div>
            </div>

            {/* Optional Address */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowAddress(!showAddress)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <MapPin className="w-4 h-4" />
                {showAddress ? "Hide Address (Optional)" : "Add Address (Optional)"}
              </button>

              {showAddress && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                        Country
                      </label>
                      <input
                        id="country"
                        name="address.country"
                        type="text"
                        value={formData.address?.country || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="United States"
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                        State/Province
                      </label>
                      <input
                        id="state"
                        name="address.state"
                        type="text"
                        value={formData.address?.state || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="California"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        id="city"
                        name="address.city"
                        type="text"
                        value={formData.address?.city || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="San Francisco"
                      />
                    </div>
                    <div>
                      <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code
                      </label>
                      <input
                        id="zip"
                        name="address.zip"
                        type="text"
                        value={formData.address?.zip || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="94102"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      id="address"
                      name="address.address"
                      type="text"
                      value={formData.address?.address || ""}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="123 Main St"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register Your Company"
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>

        {/* Steps Indicator */}
        <div className="mt-8 flex justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">1</div>
            <span className="text-white text-sm">Register</span>
          </div>
          <div className="w-8 h-px bg-gray-600 self-center"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-600 text-gray-400 flex items-center justify-center text-sm font-medium">2</div>
            <span className="text-gray-400 text-sm">Verify</span>
          </div>
          <div className="w-8 h-px bg-gray-600 self-center"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-600 text-gray-400 flex items-center justify-center text-sm font-medium">3</div>
            <span className="text-gray-400 text-sm">Setup</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
