/**
 * DashboardErrorBoundary Component
 * Catches and handles runtime errors in the dashboard
 * @module components/dashboard
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface DashboardErrorBoundaryProps {
  children: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Custom fallback component */
  fallback?: ReactNode;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary for the Portfolio Dashboard
 * Catches runtime errors and displays a recovery UI
 *
 * @example
 * ```tsx
 * <DashboardErrorBoundary onError={(error) => logError(error)}>
 *   <PortfolioDashboard tenantId="org-123" />
 * </DashboardErrorBoundary>
 * ```
 */
export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error for monitoring
    console.error('[DashboardErrorBoundary] Error caught:', error);
    console.error('[DashboardErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div
          className="min-h-screen bg-gray-50 flex items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
            {/* Error Icon */}
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" aria-hidden="true" />
            </div>

            {/* Error Message */}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Something Went Wrong
            </h2>
            <p className="text-gray-600 mb-4">
              The dashboard encountered an unexpected error. This has been logged and we&apos;re
              working on a fix.
            </p>

            {/* Error Details (Development only) */}
            {import.meta.env.DEV && error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Technical Details
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto max-h-40">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                aria-label="Try loading the dashboard again"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center px-6 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                aria-label="Reload the entire page"
              >
                Refresh Page
              </button>
            </div>

            {/* Support Link */}
            <p className="mt-6 text-sm text-gray-500">
              If this problem persists,{' '}
              <a
                href="/support"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                contact support
              </a>
              .
            </p>
          </div>
        </div>
      );
    }

    return children;
  }

  static displayName = 'DashboardErrorBoundary';
}

export default DashboardErrorBoundary;
