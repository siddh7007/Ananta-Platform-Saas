import { useState, useEffect } from 'react';
import {
  Monitor,
  Smartphone,
  Globe,
  Clock,
  MapPin,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { http } from '@/lib/http-client';
import { cn } from '@/lib/utils';

interface UserSession {
  id: string;
  username: string;
  userId: string;
  ipAddress: string;
  start: number;
  lastAccess: number;
  clients: Record<string, string>;
}

interface SessionsResponse {
  sessions: UserSession[];
  count: number;
}

interface UserSessionsCardProps {
  userId: string;
  onSessionTerminated?: () => void;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(start: number): string {
  const duration = Date.now() - start;
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getDeviceIcon(clients: Record<string, string>) {
  const clientNames = Object.values(clients).map(c => c.toLowerCase());
  const isMobile = clientNames.some(c =>
    c.includes('mobile') || c.includes('android') || c.includes('ios')
  );
  return isMobile ? Smartphone : Monitor;
}

export function UserSessionsCard({ userId, onSessionTerminated }: UserSessionsCardProps) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);

  const fetchSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await http.get<SessionsResponse>(
        `/users/${userId}/identity/sessions`
      );
      setSessions(response.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this session? The user will be logged out.')) {
      return;
    }

    setTerminatingSession(sessionId);
    try {
      await http.delete(`/users/${userId}/identity/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      onSessionTerminated?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to terminate session');
    } finally {
      setTerminatingSession(null);
    }
  };

  const handleTerminateAll = async () => {
    if (!confirm('Are you sure you want to terminate ALL sessions? The user will be logged out from all devices.')) {
      return;
    }

    setIsTerminatingAll(true);
    try {
      await http.post(`/users/${userId}/identity/sessions/terminate-all`);
      setSessions([]);
      onSessionTerminated?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to terminate sessions');
    } finally {
      setIsTerminatingAll(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Active Sessions
          {!isLoading && (
            <span className="text-sm font-normal text-muted-foreground">
              ({sessions.length})
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={fetchSessions}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
            title="Refresh sessions"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
          {sessions.length > 0 && (
            <button
              onClick={handleTerminateAll}
              disabled={isTerminatingAll || isLoading}
              className="inline-flex items-center justify-center rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {isTerminatingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Terminating...
                </>
              ) : (
                'Logout All'
              )}
            </button>
          )}
        </div>
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
              onClick={fetchSessions}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No active sessions found.
          </p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.clients);
              return (
                <div
                  key={session.id}
                  className="flex items-start justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DeviceIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {Object.values(session.clients).join(', ') || 'Unknown Client'}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.ipAddress}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Active for {formatDuration(session.start)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Started: {formatTimestamp(session.start)} |
                        Last activity: {formatTimestamp(session.lastAccess)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTerminateSession(session.id)}
                    disabled={terminatingSession === session.id}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-md disabled:opacity-50"
                    title="Terminate session"
                  >
                    {terminatingSession === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
