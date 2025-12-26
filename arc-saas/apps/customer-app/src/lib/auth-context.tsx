import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth as useOidcAuth } from "react-oidc-context";
import { logger } from "./logger";
import { useTenant } from "./tenant-context";
import { isKeycloakConfigured, getAuthMode } from "./keycloak-config";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
  loginWithKeycloak: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "arc_customer_token";
const USER_KEY = "arc_customer_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const oidcAuth = useOidcAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const keycloakEnabled = isKeycloakConfigured() && getAuthMode() !== "local";

  // Handle OIDC authentication state changes
  useEffect(() => {
    if (keycloakEnabled && oidcAuth.isAuthenticated && oidcAuth.user) {
      // User authenticated via Keycloak
      const profile = oidcAuth.user.profile;
      const oidcUser: User = {
        id: profile.sub || "",
        email: profile.email || "",
        name: profile.name || profile.preferred_username || profile.email || "",
        role: "user",
      };

      // Store the access token for API calls
      if (oidcAuth.user.access_token) {
        localStorage.setItem(TOKEN_KEY, oidcAuth.user.access_token);
      }
      localStorage.setItem(USER_KEY, JSON.stringify(oidcUser));
      setUser(oidcUser);
      setIsLoading(false);

      logger.info("Keycloak auth successful", {
        userId: oidcUser.id,
        email: oidcUser.email,
      });
    }
  }, [keycloakEnabled, oidcAuth.isAuthenticated, oidcAuth.user]);

  // Check local auth on mount (when not using Keycloak)
  useEffect(() => {
    const checkAuth = async () => {
      // If using Keycloak, let OIDC handle authentication entirely
      if (keycloakEnabled) {
        if (oidcAuth.isLoading) {
          return; // Still loading OIDC state
        }
        // If OIDC is done loading but not authenticated, we're done
        if (!oidcAuth.isAuthenticated) {
          setIsLoading(false);
        }
        return;
      }

      // Local auth mode (non-Keycloak)
      const token = localStorage.getItem(TOKEN_KEY);
      const userJson = localStorage.getItem(USER_KEY);

      if (!token || !userJson) {
        setIsLoading(false);
        return;
      }

      try {
        // For local auth, restore user from localStorage
        // (No /api/auth/me endpoint exists - user is stored locally)
        const userData = JSON.parse(userJson);
        setUser(userData);
        logger.info("Auth restored from local storage", { userId: userData.id });
      } catch (error) {
        logger.error("Auth check failed", { error });
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [keycloakEnabled, oidcAuth.isLoading, oidcAuth.isAuthenticated]);

  // Redirect to Keycloak login
  const loginWithKeycloak = () => {
    if (keycloakEnabled) {
      oidcAuth.signinRedirect();
    }
  };

  // Local email/password login
  const login = async (email?: string, password?: string): Promise<void> => {
    // If no credentials provided and Keycloak is enabled, redirect to Keycloak
    if (!email && !password && keycloakEnabled) {
      loginWithKeycloak();
      return;
    }

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    logger.info("Login attempt", { email, tenant: tenant?.key });

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, tenantKey: tenant?.key }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.warn("Login failed", { email, error: error.message });
      throw new Error(error.message || "Login failed");
    }

    const { accessToken, user: userData } = await response.json();

    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);

    logger.info("Login successful", {
      userId: userData.id,
      email: userData.email,
    });
    navigate("/dashboard");
  };

  const logout = async (): Promise<void> => {
    logger.info("Logging out", { userId: user?.id });

    // Clear local storage first
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);

    // If using Keycloak, also logout from Keycloak
    if (keycloakEnabled && oidcAuth.isAuthenticated) {
      try {
        await oidcAuth.removeUser();
        await oidcAuth.signoutRedirect();
      } catch (error) {
        logger.warn("Keycloak logout failed", { error });
        navigate("/login");
      }
      return;
    }

    // Otherwise, call local logout API
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      logger.warn("Logout API call failed", { error });
    }

    navigate("/login");
  };

  const getToken = (): string | null => {
    // Prefer OIDC token if available
    if (keycloakEnabled && oidcAuth.user?.access_token) {
      return oidcAuth.user.access_token;
    }
    return localStorage.getItem(TOKEN_KEY);
  };

  // Determine loading state
  const combinedIsLoading = isLoading || (keycloakEnabled && oidcAuth.isLoading);
  const combinedIsAuthenticated =
    !!user || (keycloakEnabled && oidcAuth.isAuthenticated);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: combinedIsLoading,
        isAuthenticated: combinedIsAuthenticated,
        login,
        logout,
        getToken,
        loginWithKeycloak,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Protected route component
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
