import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { useTenant } from "../lib/tenant-context";
import { isKeycloakConfigured, getAuthMode } from "../lib/keycloak-config";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { AlertCircle, Loader2, LogIn, Mail, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login, loginWithKeycloak, isLoading } = useAuth();
  const { tenant } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showLocalLogin, setShowLocalLogin] = useState(false);

  const authMode = getAuthMode();
  const keycloakConfigured = isKeycloakConfigured();

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleKeycloakLogin = () => {
    loginWithKeycloak();
  };

  // Determine what to show based on auth mode
  const showKeycloakButton =
    authMode === "keycloak" || (authMode === "both" && keycloakConfigured);
  const showLocalForm =
    authMode === "local" || (authMode === "both" && showLocalLogin);
  const showToggle = authMode === "both" && keycloakConfigured;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {tenant?.name || "Welcome"}
          </CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Keycloak Login Button */}
          {showKeycloakButton && !showLocalForm && (
            <div className="space-y-4">
              <Button
                type="button"
                onClick={handleKeycloakLogin}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 mr-2" />
                    Sign in with SSO
                  </>
                )}
              </Button>

              {showToggle && (
                <>
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

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowLocalLogin(true)}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Sign in with Email
                  </Button>
                </>
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a
                      href="/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </div>
          )}

          <div className="text-center space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Create one
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              Secure login powered by{" "}
              {keycloakConfigured ? (
                <span className="font-medium">Keycloak</span>
              ) : (
                <span className="font-medium">{tenant?.name || "ARC SaaS"}</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
