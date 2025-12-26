/**
 * Docker Data Provider for React Admin
 *
 * Fetches real-time container data from Django backend API
 * Handles: containers, platform-services, health monitoring
 */

import { DataProvider } from 'react-admin';
import { services } from '../config/services';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:27200';

/**
 * Transform Django container data to React Admin format
 */
const transformContainer = (container: any) => ({
  id: container.Id || container.name || Math.random().toString(),
  Name: container.Name || container.name,
  Service: container.Service || extractServiceName(container.Name || container.name),
  State: container.State || container.state,
  Status: container.Status || container.status,
  Id: container.Id || container.id || '',
  Health: container.health || 'none',
  Healthy: container.healthy || false,
  Running: container.running !== undefined ? container.running : container.State === 'running',
  RestartCount: container.restart_count || 0,
  StartedAt: container.started_at || '',
  // Stats (if available)
  stats: container.stats || {
    cpu_percent: 0,
    memory_usage_mb: 0,
    memory_limit_mb: 0,
    memory_percent: 0,
    network_rx_bytes: 0,
    network_tx_bytes: 0,
  },
});

/**
 * Extract service name from container name
 */
const extractServiceName = (containerName: string): string => {
  // Format: components-v2-{service}
  const parts = containerName.split('-');
  return parts.length >= 3 ? parts.slice(2).join('-') : containerName;
};

/**
 * Fetch container list from Django API
 */
const fetchContainers = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/docker/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.containers || []).map(transformContainer);
  } catch (error) {
    console.error('Failed to fetch containers:', error);
    throw error;
  }
};

/**
 * Fetch health summary from Django API
 */
export const fetchHealthSummary = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/docker/health-summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch health summary:', error);
    throw error;
  }
};

/**
 * Perform container action (start, stop, restart, kill)
 */
export const performContainerAction = async (containerId: string, action: string) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/docker/containers/${containerId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to ${action} container:`, error);
    throw error;
  }
};

/**
 * Get container logs
 */
export const getContainerLogs = async (containerId: string, lines: number = 100) => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/docker/containers/${containerId}/logs?lines=${lines}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.logs || '';
  } catch (error) {
    console.error('Failed to fetch container logs:', error);
    throw error;
  }
};

/**
 * Docker Data Provider for React Admin
 *
 * Handles containers resource with real-time data from Django backend
 */
export const dockerDataProvider: DataProvider = {
  getList: async (resource, params) => {
    if (resource === 'containers') {
      const containers = await fetchContainers();
      const { filter } = params;

      // Apply filters
      let filteredContainers = containers;
      if (filter && Object.keys(filter).length > 0) {
        filteredContainers = containers.filter(container => {
          return Object.entries(filter).every(([key, value]) => {
            if (key === 'q') {
              // Search across multiple fields
              const searchStr = String(value).toLowerCase();
              return (
                container.Name?.toLowerCase().includes(searchStr) ||
                container.Service?.toLowerCase().includes(searchStr) ||
                container.State?.toLowerCase().includes(searchStr)
              );
            }
            if (key === 'State') {
              return container.State === value;
            }
            if (key === 'Service') {
              return container.Service === value;
            }
            return container[key] === value;
          });
        });
      }

      return {
        data: filteredContainers,
        total: filteredContainers.length,
      };
    }

    if (resource === 'platform-services') {
      // Use static service configuration
      const { filter = {} } = params;

      const normalizeEnabled = (value: any) => {
        if (value === undefined || value === null || value === '') {
          return undefined;
        }
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          return value === 'true';
        }
        return value;
      };

      const normalizedEnabled = normalizeEnabled(filter.enabled);

      let platformServices = [...services];

      if (normalizedEnabled === undefined) {
        platformServices = platformServices.filter(s => s.enabled);
      } else {
        platformServices = platformServices.filter(s => s.enabled === normalizedEnabled);
      }

      if (filter.category) {
        platformServices = platformServices.filter(s => s.category === filter.category);
      }

      if (filter.q) {
        const search = String(filter.q).toLowerCase();
        platformServices = platformServices.filter(s => {
          const haystack = [
            s.name,
            s.description,
            s.id,
            s.url,
            s.proxyUrl,
            s.notes
          ].filter(Boolean) as string[];
          return haystack.some(value => value.toLowerCase().includes(search));
        });
      }

      const data = platformServices.map(s => ({
        ...s,
        id: s.id,
      }));
      return {
        data,
        total: data.length,
      };
    }

    // Fallback for unsupported resources
    return { data: [], total: 0 };
  },

  getOne: async (resource, params) => {
    if (resource === 'containers') {
      const containers = await fetchContainers();
      const container = containers.find(c => c.id === params.id || c.Id === params.id);
      if (!container) throw new Error('Container not found');
      return { data: container };
    }

    if (resource === 'platform-services') {
      const service = services.find(s => s.id === params.id);
      if (!service) throw new Error('Service not found');
      return { data: { ...service, id: service.id } };
    }

    throw new Error('Resource not found');
  },

  getMany: async (resource, params) => {
    if (resource === 'containers') {
      const containers = await fetchContainers();
      return {
        data: containers.filter(c => params.ids.includes(c.id) || params.ids.includes(c.Id)),
      };
    }

    if (resource === 'platform-services') {
      return {
        data: services.filter(s => params.ids.includes(s.id)).map(s => ({ ...s, id: s.id })),
      };
    }

    return { data: [] };
  },

  getManyReference: async (resource, params) => {
    return { data: [], total: 0 };
  },

  create: async (resource, params) => {
    throw new Error('Create not supported for this resource');
  },

  update: async (resource, params) => {
    if (resource === 'containers') {
      // Handle container actions via update
      const { action } = params.data;
      if (action) {
        await performContainerAction(params.id, action);
        const containers = await fetchContainers();
        const container = containers.find(c => c.id === params.id || c.Id === params.id);
        return { data: container || params.previousData };
      }
    }
    return { data: params.data };
  },

  updateMany: async (resource, params) => {
    return { data: params.ids };
  },

  delete: async (resource, params) => {
    throw new Error('Delete not supported for this resource');
  },

  deleteMany: async (resource, params) => {
    throw new Error('Delete not supported for this resource');
  },
};
