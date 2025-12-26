import { ShieldX, ArrowLeft, Home, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

interface PermissionDeniedProps {
  /** The resource the user tried to access */
  resource?: string;
  /** Required role for access */
  requiredRole?: string;
  /** User's current role */
  currentRole?: string;
  /** Optional custom message */
  message?: string;
}

/**
 * Permission Denied page shown when user lacks required role/permission.
 * Provides clear messaging about what's needed and how to proceed.
 */
export function PermissionDenied({
  resource,
  requiredRole,
  currentRole,
  message,
}: PermissionDeniedProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayRole = currentRole || user?.role || 'unknown';
  const displayResource = resource || 'this resource';

  return (
    <div className="flex items-center justify-center min-h-[600px] p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription className="text-base">
            You don't have permission to access {displayResource}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {message ? (
            <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
              {message}
            </div>
          ) : (
            <div className="rounded-md bg-muted p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your current role:</span>
                <span className="font-medium capitalize">{displayRole}</span>
              </div>
              {requiredRole && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Required role:</span>
                  <span className="font-medium capitalize">{requiredRole} or higher</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">What you can do:</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">1.</span>
                <span>Contact your organization administrator to request access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">2.</span>
                <span>Return to a page you have access to</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">3.</span>
                <span>If you believe this is an error, contact support</span>
              </li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="w-full"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => window.location.href = 'mailto:support@ananta.io?subject=Permission%20Request'}
          >
            <Mail className="mr-2 h-4 w-4" />
            Contact Support
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default PermissionDenied;
