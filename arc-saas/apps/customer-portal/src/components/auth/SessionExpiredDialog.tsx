import { useCallback, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SessionExpiredDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog shown when token refresh fails or session expires.
 * Provides UX for re-authentication instead of silent redirect.
 */
export function SessionExpiredDialog({ open, onClose }: SessionExpiredDialogProps) {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Auto-redirect countdown
  useEffect(() => {
    if (!open) {
      setCountdown(30);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  const handleLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      await login();
    } catch (error) {
      console.error('Failed to initiate login:', error);
      setIsLoading(false);
    }
  }, [login]);

  const handleContinueOffline = useCallback(() => {
    // Close dialog and allow user to view cached/local data
    onClose();
  }, [onClose]);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            Session Expired
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Your session has expired. Please sign in again to continue.
            </p>
            <p className="text-sm text-muted-foreground">
              You will be automatically redirected in {countdown} seconds.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleContinueOffline}
            className="w-full sm:w-auto"
          >
            Continue Offline
          </Button>
          <AlertDialogAction asChild>
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In Now
                </>
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SessionExpiredDialog;
