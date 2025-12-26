import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import App from './App';
import { ThemeColorSync } from '@/components/ThemeColorSync';
import { AccessibilityChecker } from '@/components/debug/AccessibilityChecker';
import '@/styles/globals.css';
// touch-targets and transitions styles are in globals.css to avoid @layer issues

// Initialize OpenTelemetry tracing before React renders
// This ensures all fetch/XHR requests are instrumented from the start
import { initTelemetry } from '@/lib/telemetry';
initTelemetry();

// Initialize CSP violation reporter (VULN-002 FIXED)
// This captures CSP violations and reports them for security monitoring
import { setupCSPReporter } from '@/lib/security/csp-reporter';
setupCSPReporter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark', 'mid-light', 'mid-dark']}
      storageKey="cbp-theme"
    >
      <ThemeColorSync />
      <AccessibilityChecker />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
