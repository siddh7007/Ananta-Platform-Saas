/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Prevents entire app from crashing due to component errors.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
            p: 4,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 4,
              maxWidth: 500,
              textAlign: 'center',
              border: '1px solid',
              borderColor: 'error.light',
              borderRadius: 2,
            }}
          >
            <ErrorIcon color="error" sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              An unexpected error occurred. Please try refreshing the page.
            </Typography>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
                <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {this.state.error.message}
                </Typography>
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="outlined" onClick={this.reset} startIcon={<RefreshIcon />}>
                Try Again
              </Button>
              <Button variant="contained" onClick={this.handleReload} startIcon={<RefreshIcon />}>
                Reload Page
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * Module-level error boundary for wrapping feature modules
 */
export interface ModuleErrorBoundaryProps {
  children: ReactNode;
  moduleName: string;
}

export const ModuleErrorBoundary: React.FC<ModuleErrorBoundaryProps> = ({
  children,
  moduleName,
}) => {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error(`[${moduleName}] Module error:`, error, errorInfo);
    // Could send to error tracking service here
  };

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={
        <Box sx={{ p: 4 }}>
          <Alert severity="error">
            <Typography variant="subtitle2">
              Error loading {moduleName}
            </Typography>
            <Typography variant="body2">
              Please refresh the page or contact support if the problem persists.
            </Typography>
          </Alert>
        </Box>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
