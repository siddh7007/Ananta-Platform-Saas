import { useLogin } from "@refinedev/core";
import { useAuth } from "react-oidc-context";
import { useState } from "react";
import { AlertCircle, Loader2, LogIn, Mail, ShieldCheck } from "lucide-react";
import { getAuthMode, isKeycloakConfigured } from "../lib/keycloak-config";

export function LoginPage() {
  const { mutate: login, isLoading: isLocalLoading } = useLogin();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showLocalLogin, setShowLocalLogin] = useState(false);

  const authMode = getAuthMode();
  const keycloakConfigured = isKeycloakConfigured();

  const handleLocalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    login(
      { email, password },
      {
        onError: (error) => {
          setError(error.message || "Invalid credentials");
        },
      }
    );
  };

  const handleKeycloakLogin = () => {
    auth.signinRedirect();
  };

  const isLoading = isLocalLoading || auth.isLoading;

  // Determine what to show based on auth mode
  const showKeycloakButton =
    authMode === "keycloak" || (authMode === "both" && keycloakConfigured);
  const showLocalForm =
    authMode === "local" || (authMode === "both" && showLocalLogin);
  const showToggle = authMode === "both" && keycloakConfigured;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Ananta SaaS</h1>
          <p className="text-muted-foreground mt-2">Admin Portal</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 text-center">
            Sign in to your account
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Keycloak Login Button */}
          {showKeycloakButton && !showLocalForm && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleKeycloakLogin}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {auth.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    Continue with Keycloak
                  </>
                )}
              </button>

              {showToggle && (
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>
              )}

              {showToggle && (
                <button
                  type="button"
                  onClick={() => setShowLocalLogin(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Sign in with Email
                </button>
              )}
            </div>
          )}

          {/* Local Login Form */}
          {showLocalForm && (
            <div className="space-y-4">
              {showToggle && (
                <button
                  type="button"
                  onClick={() => setShowLocalLogin(false)}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to login options
                </button>
              )}

              <form onSubmit={handleLocalSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    placeholder="admin@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium">
                      Password
                    </label>
                    <a
                      href="/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLocalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Secure login powered by{" "}
            {keycloakConfigured ? (
              <span className="font-medium">Keycloak</span>
            ) : (
              <span className="font-medium">Ananta SaaS</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            For support, contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}
