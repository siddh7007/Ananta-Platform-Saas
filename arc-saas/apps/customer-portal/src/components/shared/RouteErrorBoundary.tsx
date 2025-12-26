import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, Home, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  /** Route name for context (e.g., "Billing", "Team", "Components") */
  routeName?: string;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Show back button */
  showBackButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Route-specific error boundary with actionable recovery options
 * Use this to wrap route components for better error isolation
 */
export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error with context
    console.error(`[RouteErrorBoundary:${this.props.routeName || 'Unknown'}]`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // TODO: Send to error tracking service (Sentry, etc.)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  private handleGoBack = () => {
    window.history.back();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleContactSupport = () => {
    const subject = encodeURIComponent(`Error in ${this.props.routeName || 'Customer Portal'}`);
    const body = encodeURIComponent(
      `I encountered an error:\n\n${this.state.error?.message || 'Unknown error'}\n\nPlease help!`
    );
    window.location.href = `mailto:support@ananta.io?subject=${subject}&body=${body}`;
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { routeName = 'this page', showBackButton = true } = this.props;

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-lg border-destructive/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                Error loading {routeName}
              </CardTitle>
              <CardDescription>
                Something went wrong while loading this page. You can try again or navigate elsewhere.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {this.state.error && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Technical details
                  </summary>
                  <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs">
                    <code>{this.state.error.message}</code>
                    {this.state.error.stack && (
                      <>
                        {'\n\n'}
                        <span className="text-muted-foreground">
                          {this.state.error.stack.split('\n').slice(1, 5).join('\n')}
                        </span>
                      </>
                    )}
                  </pre>
                </details>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap justify-center gap-2">
              <Button onClick={this.handleRetry} variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>

              {showBackButton && (
                <Button onClick={this.handleGoBack} variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              )}

              <Button onClick={this.handleGoHome} variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Button>

              <Button onClick={this.handleContactSupport} variant="ghost" size="sm">
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with RouteErrorBoundary
 */
export function withRouteErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  routeName: string
) {
  return function WithRouteErrorBoundary(props: P) {
    return (
      <RouteErrorBoundary routeName={routeName}>
        <WrappedComponent {...props} />
      </RouteErrorBoundary>
    );
  };
}
