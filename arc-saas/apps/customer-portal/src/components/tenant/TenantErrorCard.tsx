import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface TenantErrorCardProps {
  error: string;
  onRetry?: () => void;
  onLogout?: () => void;
  isRetrying?: boolean;
}

/**
 * Error card shown when tenant context fails to load.
 * Provides retry and logout options for graceful error handling.
 */
export function TenantErrorCard({ error, onRetry, onLogout, isRetrying = false }: TenantErrorCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>Unable to Load Workspace</CardTitle>
          <CardDescription>
            We couldn't load your organization's workspace. This might be a temporary issue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Error details:</p>
            <p className="mt-1 text-red-600">{error}</p>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Possible causes:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Your organization may have been removed</li>
              <li>Your access may have been revoked</li>
              <li>Network connectivity issues</li>
              <li>Service temporarily unavailable</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </>
              )}
            </Button>
          )}
          {onLogout && (
            <Button
              variant="outline"
              onClick={onLogout}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default TenantErrorCard;
