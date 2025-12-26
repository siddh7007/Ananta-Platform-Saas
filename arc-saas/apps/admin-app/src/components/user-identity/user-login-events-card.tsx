import { useState, useEffect } from 'react';
import {
  History,
  LogIn,
  LogOut,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  MapPin,
  Monitor,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { http } from '@/lib/http-client';
import { cn } from '@/lib/utils';

interface LoginEvent {
  time: number;
  type: string;
  realmId: string;
  clientId: string;
  userId: string;
  sessionId: string;
  ipAddress: string;
  details: Record<string, string>;
}

interface LoginEventsResponse {
  events: LoginEvent[];
  count: number;
}

interface UserLoginEventsCardProps {
  userId: string;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function getEventTypeInfo(type: string): { icon: typeof LogIn; color: string; label: string } {
  switch (type.toUpperCase()) {
    case 'LOGIN':
      return { icon: LogIn, color: 'text-green-600 bg-green-100', label: 'Login Success' };
    case 'LOGIN_ERROR':
      return { icon: XCircle, color: 'text-red-600 bg-red-100', label: 'Login Failed' };
    case 'LOGOUT':
      return { icon: LogOut, color: 'text-blue-600 bg-blue-100', label: 'Logout' };
    case 'REGISTER':
      return { icon: LogIn, color: 'text-purple-600 bg-purple-100', label: 'Registration' };
    case 'UPDATE_PASSWORD':
      return { icon: History, color: 'text-orange-600 bg-orange-100', label: 'Password Changed' };
    case 'RESET_PASSWORD':
      return { icon: History, color: 'text-yellow-600 bg-yellow-100', label: 'Password Reset' };
    case 'UPDATE_TOTP':
      return { icon: History, color: 'text-cyan-600 bg-cyan-100', label: 'MFA Updated' };
    case 'REMOVE_TOTP':
      return { icon: XCircle, color: 'text-amber-600 bg-amber-100', label: 'MFA Removed' };
    default:
      return { icon: History, color: 'text-gray-600 bg-gray-100', label: type.replace(/_/g, ' ') };
  }
}

export function UserLoginEventsCard({ userId }: UserLoginEventsCardProps) {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(20);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await http.get<LoginEventsResponse>(
        `/users/${userId}/identity/login-events?maxResults=${maxResults}`
      );
      setEvents(response.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load login events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [userId, maxResults]);

  const handleLoadMore = () => {
    setMaxResults(prev => prev + 20);
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Login History
          {!isLoading && events.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              (Last {events.length} events)
            </span>
          )}
        </h2>
        <button
          onClick={fetchEvents}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
          title="Refresh events"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>
      <div className="p-6">
        {isLoading && events.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchEvents}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No login events found.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => {
              const eventInfo = getEventTypeInfo(event.type);
              const Icon = eventInfo.icon;
              const eventKey = `${event.time}-${index}`;
              const isExpanded = expandedEvent === eventKey;

              return (
                <div
                  key={eventKey}
                  className="rounded-lg border bg-muted/30 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedEvent(isExpanded ? null : eventKey)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex gap-3 items-center">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", eventInfo.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {eventInfo.label}
                          {event.type === 'LOGIN_ERROR' && event.details?.error && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                              {event.details.error}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span>{formatTimestamp(event.time)}</span>
                          {event.ipAddress && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.ipAddress}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t bg-muted/50">
                      <div className="grid grid-cols-2 gap-4 text-sm pt-3">
                        <div>
                          <label className="text-muted-foreground">Event Type</label>
                          <p className="font-mono text-xs bg-background px-2 py-1 rounded mt-1">
                            {event.type}
                          </p>
                        </div>
                        <div>
                          <label className="text-muted-foreground">Client</label>
                          <p className="font-mono text-xs bg-background px-2 py-1 rounded mt-1">
                            {event.clientId || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <label className="text-muted-foreground">Session ID</label>
                          <p className="font-mono text-xs bg-background px-2 py-1 rounded mt-1 truncate">
                            {event.sessionId || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <label className="text-muted-foreground">Timestamp</label>
                          <p className="font-mono text-xs bg-background px-2 py-1 rounded mt-1">
                            {new Date(event.time).toISOString()}
                          </p>
                        </div>
                        {Object.keys(event.details || {}).length > 0 && (
                          <div className="col-span-2">
                            <label className="text-muted-foreground">Details</label>
                            <pre className="font-mono text-xs bg-background px-2 py-1 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load More Button */}
            {events.length >= maxResults && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load more events'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
