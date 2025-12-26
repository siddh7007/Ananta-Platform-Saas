import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";
import { useTenant } from "./lib/tenant-context";
import { AuthProvider, RequireAuth } from "./lib/auth-context";
import { isKeycloakConfigured } from "./lib/keycloak-config";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Team from "./pages/Team";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import AcceptInvite from "./pages/AcceptInvite";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import LoadingScreen from "./components/LoadingScreen";
import ErrorScreen from "./components/ErrorScreen";

/**
 * Callback handler for OIDC redirect
 */
function CallbackPage() {
  const oidcAuth = useOidcAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!oidcAuth.isLoading && oidcAuth.isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [oidcAuth.isLoading, oidcAuth.isAuthenticated, navigate]);

  return <LoadingScreen />;
}

function App() {
  const { tenant, isLoading, error } = useTenant();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !tenant) {
    return <ErrorScreen error={error?.message || "Failed to load tenant"} />;
  }

  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {/* OIDC Callback Route */}
        {isKeycloakConfigured() && (
          <Route path="/callback" element={<CallbackPage />} />
        )}

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <MainLayout tenant={tenant} />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="team" element={<Team />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
