/**
 * SSE Debug Panel
 *
 * Developer-only component for debugging SSE connections.
 * Shows connection status, recent events, and allows manual testing.
 *
 * Usage:
 * ```tsx
 * import { SSEDebugPanel } from '@/components/debug/SSEDebugPanel';
 *
 * // In your component
 * {import.meta.env.DEV && <SSEDebugPanel bomId={bomId} />}
 * ```
 */

import { useState, useEffect } from 'react';
import { useEnrichmentSSE } from '@/hooks/useEnrichmentSSE';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, X, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SSEDebugPanelProps {
  bomId: string;
}

interface EventLog {
  timestamp: Date;
  type: string;
  data: unknown;
}

export function SSEDebugPanel({ bomId }: SSEDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [eventLog, setEventLog] = useState<EventLog[]>([]);
  const [manualConnect, setManualConnect] = useState(false);

  const {
    progress,
    progressPercent,
    isComplete,
    isFailed,
    error,
    isProcessing,
    connectionStatus,
    connect,
    disconnect,
    retry,
  } = useEnrichmentSSE(bomId, {
    autoConnect: manualConnect,
    onProgress: (state) => {
      setEventLog((prev) => [
        { timestamp: new Date(), type: 'progress', data: state },
        ...prev.slice(0, 99), // Keep last 100 events
      ]);
    },
    onComplete: (event) => {
      setEventLog((prev) => [
        { timestamp: new Date(), type: 'completed', data: event },
        ...prev.slice(0, 99),
      ]);
    },
    onError: (err) => {
      setEventLog((prev) => [
        { timestamp: new Date(), type: 'error', data: { error: err } },
        ...prev.slice(0, 99),
      ]);
    },
  });

  // Log connection status changes
  useEffect(() => {
    setEventLog((prev) => [
      { timestamp: new Date(), type: 'status', data: { connectionStatus } },
      ...prev.slice(0, 99),
    ]);
  }, [connectionStatus]);

  if (!import.meta.env.DEV && !isExpanded) {
    return null; // Hide in production unless manually expanded
  }

  const getStatusColor = (status: typeof connectionStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      {!isExpanded ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="shadow-lg"
        >
          SSE Debug
          <Badge className={`ml-2 ${getStatusColor(connectionStatus)}`}>
            {connectionStatus}
          </Badge>
        </Button>
      ) : (
        <Card className="shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                SSE Debug Panel
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge className={getStatusColor(connectionStatus)}>
                {connectionStatus === 'connected' && <CheckCircle className="h-3 w-3 mr-1" />}
                {connectionStatus === 'connecting' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {connectionStatus === 'error' && <XCircle className="h-3 w-3 mr-1" />}
                {connectionStatus}
              </Badge>
            </div>

            {/* BOM ID */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">BOM ID:</span>
              <code className="px-2 py-0.5 bg-muted rounded text-[10px]">
                {bomId.substring(0, 8)}...
              </code>
            </div>

            {/* Progress */}
            {progress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>Enriched: {progress.enriched_items}</span>
                  <span>Total: {progress.total_items}</span>
                </div>
                {progress.current_item && (
                  <div className="text-[10px] text-muted-foreground truncate">
                    Current: {progress.current_item.mpn}
                  </div>
                )}
              </div>
            )}

            {/* Status Flags */}
            <div className="flex gap-2">
              {isProcessing && (
                <Badge variant="outline" className="text-[10px]">
                  Processing
                </Badge>
              )}
              {isComplete && (
                <Badge variant="outline" className="text-[10px] bg-green-50">
                  Complete
                </Badge>
              )}
              {isFailed && (
                <Badge variant="outline" className="text-[10px] bg-red-50">
                  Failed
                </Badge>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-2 bg-red-50 text-red-700 rounded text-[10px]">
                {error}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {connectionStatus === 'disconnected' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManualConnect(true);
                    connect();
                  }}
                  className="flex-1 h-7"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Connect
                </Button>
              )}
              {connectionStatus === 'connected' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManualConnect(false);
                    disconnect();
                  }}
                  className="flex-1 h-7"
                >
                  Disconnect
                </Button>
              )}
              {connectionStatus === 'error' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retry}
                  className="flex-1 h-7"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEventLog([])}
                className="h-7"
              >
                Clear Log
              </Button>
            </div>

            {/* Event Log */}
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">
                Event Log ({eventLog.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 bg-muted/30 rounded p-2">
                {eventLog.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    No events yet
                  </div>
                ) : (
                  eventLog.map((event, i) => (
                    <div
                      key={i}
                      className="text-[10px] font-mono border-l-2 border-muted pl-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            event.type === 'error'
                              ? 'bg-red-50'
                              : event.type === 'completed'
                              ? 'bg-green-50'
                              : ''
                          }`}
                        >
                          {event.type}
                        </Badge>
                        <span className="text-muted-foreground">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="mt-1 text-[9px] text-muted-foreground overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)
                          .split('\n')
                          .slice(0, 3)
                          .join('\n')}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Environment Info */}
            <div className="pt-2 border-t text-[10px] text-muted-foreground space-y-1">
              <div className="font-medium">Configuration</div>
              <div>API: {import.meta.env.VITE_CNS_API_URL}</div>
              <div>Mode: {import.meta.env.MODE}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SSEDebugPanel;
