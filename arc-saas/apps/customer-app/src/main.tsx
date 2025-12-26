import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import App from "./App";
import { TenantProvider, useTenant } from "./lib/tenant-context";
import { createOidcConfig, isKeycloakConfigured } from "./lib/keycloak-config";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * OIDC Provider wrapper that uses tenant-specific Keycloak realm
 */
function OidcWrapper({ children }: { children: React.ReactNode }) {
  const { tenant, isLoading } = useTenant();

  // Wait for tenant to load
  if (isLoading || !tenant) {
    return <>{children}</>;
  }

  // If Keycloak is not configured, skip OIDC provider
  if (!isKeycloakConfigured()) {
    return <>{children}</>;
  }

  // Create OIDC config for this tenant's realm
  const oidcConfig = createOidcConfig(tenant.tenantKey);

  return <OidcProvider {...oidcConfig}>{children}</OidcProvider>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TenantProvider>
          <OidcWrapper>
            <App />
          </OidcWrapper>
        </TenantProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
