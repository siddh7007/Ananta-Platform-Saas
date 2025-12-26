/**
 * CSP Violation Reporter
 * CBP-P1-004: CSP Security Headers
 */

interface CSPViolation {
  documentURI: string;
  blockedURI: string;
  violatedDirective: string;
  originalPolicy: string;
  disposition: string;
  timestamp: number;
}

export function setupCSPReporter(): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    const violation: CSPViolation = {
      documentURI: event.documentURI,
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      disposition: event.disposition,
      timestamp: Date.now(),
    };

    if (import.meta.env.DEV) {
      console.warn('[CSP Violation]', violation);
    }

    // Production: send to error tracking
    if (!import.meta.env.DEV && import.meta.env.VITE_CSP_REPORT_URL) {
      fetch(import.meta.env.VITE_CSP_REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'csp-report': violation }),
      }).catch(() => {});
    }
  });
}
