import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { env } from '@/config/env';

/**
 * Login page - redirects to Keycloak for authentication
 */
export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary" />
          <h1 className="mt-4 text-2xl font-bold">{env.app.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your workspace
          </p>
        </div>

        <button
          onClick={handleLogin}
          className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign in with SSO
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Secure authentication
            </span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Authentication powered by Keycloak OIDC
        </p>
      </div>
    </div>
  );
}
