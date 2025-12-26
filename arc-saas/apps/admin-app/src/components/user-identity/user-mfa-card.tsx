import { useState, useEffect } from 'react';
import {
  Shield,
  Smartphone,
  Key,
  Fingerprint,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { http } from '@/lib/http-client';
import { cn } from '@/lib/utils';

interface MfaCredential {
  id: string;
  type: string;
  userLabel: string;
  createdDate: number;
  credentialData: string;
}

interface MfaStatusResponse {
  enabled: boolean;
  configuredMethods: string[];
  credentials: MfaCredential[];
}

interface UserMfaCardProps {
  userId: string;
  onMfaChanged?: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

function getCredentialIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'otp':
    case 'totp':
      return Smartphone;
    case 'webauthn':
    case 'webauthn-passwordless':
      return Fingerprint;
    case 'password':
      return Key;
    default:
      return Shield;
  }
}

function getCredentialTypeName(type: string): string {
  switch (type.toLowerCase()) {
    case 'otp':
    case 'totp':
      return 'Authenticator App (TOTP)';
    case 'webauthn':
      return 'Security Key (WebAuthn)';
    case 'webauthn-passwordless':
      return 'Passwordless Security Key';
    case 'password':
      return 'Password';
    default:
      return type;
  }
}

export function UserMfaCard({ userId, onMfaChanged }: UserMfaCardProps) {
  const [mfaStatus, setMfaStatus] = useState<MfaStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingCredential, setRemovingCredential] = useState<string | null>(null);

  const fetchMfaStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await http.get<MfaStatusResponse>(
        `/users/${userId}/identity/mfa`
      );
      setMfaStatus(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MFA status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMfaStatus();
  }, [userId]);

  const handleRemoveCredential = async (credentialId: string, label: string) => {
    if (!confirm(`Are you sure you want to remove the MFA credential "${label}"? The user will need to set up MFA again.`)) {
      return;
    }

    setRemovingCredential(credentialId);
    try {
      await http.delete(`/users/${userId}/identity/mfa/credentials/${credentialId}`);
      // Refresh MFA status
      await fetchMfaStatus();
      onMfaChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove credential');
    } finally {
      setRemovingCredential(null);
    }
  };

  // Filter out password from MFA methods (it's not really MFA)
  const mfaCredentials = mfaStatus?.credentials.filter(c => c.type.toLowerCase() !== 'password') || [];

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Multi-Factor Authentication
        </h2>
        <button
          onClick={fetchMfaStatus}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
          title="Refresh MFA status"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchMfaStatus}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* MFA Status Banner */}
            <div
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg",
                mfaStatus?.enabled
                  ? "bg-green-50 text-green-800"
                  : "bg-yellow-50 text-yellow-800"
              )}
            >
              {mfaStatus?.enabled ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">MFA Enabled</div>
                    <div className="text-sm opacity-80">
                      {mfaCredentials.length} method{mfaCredentials.length !== 1 ? 's' : ''} configured
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="font-medium">MFA Not Enabled</div>
                    <div className="text-sm opacity-80">
                      User has not set up multi-factor authentication
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Configured Methods */}
            {mfaCredentials.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Configured Methods
                </h3>
                <div className="space-y-3">
                  {mfaCredentials.map((credential) => {
                    const Icon = getCredentialIcon(credential.type);
                    return (
                      <div
                        key={credential.id}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {credential.userLabel || getCredentialTypeName(credential.type)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {getCredentialTypeName(credential.type)} |
                              Added: {formatDate(credential.createdDate)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveCredential(credential.id, credential.userLabel || credential.type)}
                          disabled={removingCredential === credential.id}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-md disabled:opacity-50"
                          title="Remove credential"
                        >
                          {removingCredential === credential.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No MFA Configured Message */}
            {!mfaStatus?.enabled && mfaCredentials.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  The user can configure MFA methods in their account security settings.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
