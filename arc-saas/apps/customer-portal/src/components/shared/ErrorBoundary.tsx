import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
}

/**
 * Detect if error is caused by chunk loading failure
 * Common patterns:
 * - "Loading chunk X failed"
 * - "Failed to fetch dynamically imported module"
 * - Network errors during dynamic imports
 */
function isChunkLoadError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('loading chunk') ||
    message.includes('failed to fetch') ||
    message.includes('dynamically imported module') ||
    message.includes('importing a module script failed') ||
    error.name === 'ChunkLoadError'
  );
}

/**
 * Error boundary component to catch and handle React errors
 * Enhanced with chunk loading failure detection and recovery
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isChunkError: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const isChunkError = isChunkLoadError(error);
    return {
      hasError: true,
      error,
      isChunkError,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    console.error('ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      isChunkError: this.state.isChunkError,
      componentStack: errorInfo.componentStack,
    });

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    });
  };

  private handleReload = () => {
    // Force full page reload to fetch fresh chunks
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, isChunkError } = this.state;

      // Special handling for chunk loading errors
      if (isChunkError) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-md rounded-lg border border-warning/20 bg-card p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
                  <WifiOff className="h-8 w-8 text-warning" />
                </div>
              </div>
              <h2 className="mb-2 text-center text-xl font-semibold">
                Update Available
              </h2>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                A new version of the application is available. Please reload the page to continue.
              </p>
              <div className="space-y-2">
                <button
                  onClick={this.handleReload}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </button>
                <button
                  onClick={this.handleRetry}
                  className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        );
      }

      // General error handling
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="mb-2 text-center text-xl font-semibold text-destructive">
              Something went wrong
            </h2>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              An unexpected error occurred. Please try again or contact support if the problem
              persists.
            </p>
            {error && (
              <details className="mb-4 group">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                  {error.message}
                </pre>
              </details>
            )}
            <div className="space-y-2">
              <button
                onClick={this.handleRetry}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
