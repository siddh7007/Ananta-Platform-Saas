/**
 * Email Verification Page (Step 2 of Tenant Onboarding)
 *
 * User arrives here after clicking the verification link in their email.
 * The token is validated and they're redirected to the onboarding page.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { API_URL } from "../../config/api";

type VerificationState = "verifying" | "success" | "error";

interface VerificationResult {
  leadId: string;
  email: string;
  token: string;
}

export function VerifyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerificationState>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setState("error");
      setError("No verification token provided. Please check your email link.");
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/leads/verify?token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || data.message || "Verification failed");
      }

      const data = await response.json();

      // Store the lead token for the onboarding step
      sessionStorage.setItem("leadToken", data.token);
      sessionStorage.setItem("leadId", data.id);
      sessionStorage.setItem("leadEmail", data.email);

      setVerificationData({
        leadId: data.id,
        email: data.email,
        token: data.token,
      });

      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    }
  };

  const handleContinue = () => {
    if (verificationData) {
      navigate(`/register/onboard?id=${verificationData.leadId}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Verifying State */}
        {state === "verifying" && (
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Your Email</h1>
            <p className="text-gray-600">Please wait while we confirm your email address...</p>
          </div>
        )}

        {/* Success State */}
        {state === "success" && (
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-6">
              Great! Your email <strong>{verificationData?.email}</strong> has been verified.
              Now let's set up your tenant.
            </p>
            <button
              onClick={handleContinue}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              Continue to Setup
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <Link
                to="/register"
                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all text-center"
              >
                Try Again
              </Link>
              <Link
                to="/login"
                className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all text-center"
              >
                Back to Login
              </Link>
            </div>
          </div>
        )}

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
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              state === "success" ? "bg-green-600 text-white" : "bg-blue-600 text-white"
            }`}>
              {state === "success" ? <CheckCircle className="w-4 h-4" /> : "2"}
            </div>
            <span className="text-white text-sm">Verify</span>
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

export default VerifyPage;
