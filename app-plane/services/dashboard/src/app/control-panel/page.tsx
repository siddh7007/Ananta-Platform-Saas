'use client';

/**
 * Control Panel - Container Management Dashboard
 *
 * Provides real-time container management with:
 * - Service list with status
 * - Start/Stop/Restart/Kill actions
 * - Real-time CPU and memory stats
 * - Container logs viewer
 * - Auto-refresh every 5 seconds
 */

import { useEffect, useState } from 'react';

interface ContainerStats {
  cpu_percent: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  memory_percent: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
}

interface Container {
  Name: string;
  Service: string;
  State: string;
  Status: string;
  stats?: ContainerStats;
}

interface ContainerStatusResponse {
  containers: Container[];
  total: number;
  timestamp: string;
}

interface ActionRequest {
  service: string;
  action: string;
}

export default function ControlPanel() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<{ [key: string]: string | null }>({});
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Skip Keycloak authentication for Control Panel
  // Control Panel has open access - auth happens at proxy level if needed

  // Fetch container status
  const fetchContainers = async () => {
    try {
      // Docker API has AllowAny permission, no auth needed
      const response = await fetch('http://localhost:27200/api/docker/status');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ContainerStatusResponse = await response.json();
      setContainers(data.containers);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch containers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch container logs
  const fetchLogs = async (service: string) => {
    try {
      const response = await fetch(`http://localhost:27200/api/docker/logs?service=${service}&tail=100`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setLogs(data.logs);
    } catch (err: any) {
      console.error('Failed to fetch logs:', err);
      setLogs(`Error fetching logs: ${err.message}`);
    }
  };

  // Perform container action
  const performAction = async (service: string, action: string) => {
    const actionKey = `${service}-${action}`;
    setActionLoading(prev => ({ ...prev, [actionKey]: action }));

    try {
      const method = action === 'kill' ? 'DELETE' : 'POST';
      const response = await fetch(`http://localhost:27200/api/docker/${action}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ service }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      showNotification(data.message, 'success');

      // Refresh container list after action
      setTimeout(fetchContainers, 2000);
    } catch (err: any) {
      showNotification(`Failed to ${action} ${service}: ${err.message}`, 'error');
      console.error(`Failed to ${action} ${service}:`, err);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: null }));
    }
  };

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Auto-refresh every 5 seconds (only when authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      fetchContainers();
      const interval = setInterval(fetchContainers, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Auto-refresh logs when service selected
  useEffect(() => {
    if (selectedService) {
      fetchLogs(selectedService);
      const interval = setInterval(() => fetchLogs(selectedService), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedService]);

  // Filter containers by search query
  const filteredContainers = containers.filter(container =>
    container.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    container.Service?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const runningCount = containers.filter(c => c.State === 'running').length;
  const stoppedCount = containers.filter(c => c.State !== 'running').length;
  const totalCPU = containers.reduce((sum, c) => sum + (c.stats?.cpu_percent || 0), 0);
  const totalMemory = containers.reduce((sum, c) => sum + (c.stats?.memory_usage_mb || 0), 0);

  if (authLoading || (loading && isAuthenticated)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">
            {authLoading ? 'Authenticating...' : 'Loading Control Panel...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access the Control Panel</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Container Control Panel</h1>
        <p className="text-gray-600 mt-1">Manage and monitor all Docker containers in real-time</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-6 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notification.message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          Error: {error}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Services</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{containers.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Running</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{runningCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Stopped</div>
          <div className="text-3xl font-bold text-red-600 mt-1">{stoppedCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total CPU</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{totalCPU.toFixed(1)}%</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search containers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Container List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CPU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Memory
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredContainers.map((container) => {
              const serviceName = container.Service || container.Name.replace('components-v2-', '');
              const isRunning = container.State === 'running';

              return (
                <tr key={container.Name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{serviceName}</div>
                        <div className="text-sm text-gray-500">{container.Name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      isRunning
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {container.State}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {container.stats ? `${container.stats.cpu_percent.toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {container.stats ? (
                      <div>
                        <div>{container.stats.memory_usage_mb.toFixed(0)} MB</div>
                        <div className="text-xs text-gray-400">
                          {container.stats.memory_percent.toFixed(1)}% of {container.stats.memory_limit_mb.toFixed(0)} MB
                        </div>
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {isRunning ? (
                      <>
                        <button
                          onClick={() => performAction(serviceName, 'stop')}
                          disabled={!!actionLoading[`${serviceName}-stop`]}
                          className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                        >
                          {actionLoading[`${serviceName}-stop`] ? 'Stopping...' : 'Stop'}
                        </button>
                        <button
                          onClick={() => performAction(serviceName, 'restart')}
                          disabled={!!actionLoading[`${serviceName}-restart`]}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        >
                          {actionLoading[`${serviceName}-restart`] ? 'Restarting...' : 'Restart'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Force kill ${serviceName}? This will terminate the container immediately.`)) {
                              performAction(serviceName, 'kill');
                            }
                          }}
                          disabled={!!actionLoading[`${serviceName}-kill`]}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {actionLoading[`${serviceName}-kill`] ? 'Killing...' : 'Kill'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => performAction(serviceName, 'start')}
                        disabled={!!actionLoading[`${serviceName}-start`]}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                      >
                        {actionLoading[`${serviceName}-start`] ? 'Starting...' : 'Start'}
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedService(serviceName)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Logs
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Log Viewer Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Logs: {selectedService}</h3>
              <button
                onClick={() => setSelectedService(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{logs}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
