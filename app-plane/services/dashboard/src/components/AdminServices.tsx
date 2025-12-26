'use client';

/**
 * Admin Services Panel
 *
 * Displays all admin UIs with health status and quick access
 */

import { useEffect, useState } from 'react';

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'checking' | 'unknown';
  responseTime?: number;
  message?: string;
}

interface AdminService {
  name: string;
  description: string;
  url: string;
  route?: string;
  externalPort?: number;
  directUrl?: string;
  directPort?: number;
  internalPort?: number;
  category: 'admin' | 'customer' | 'infrastructure' | 'observability' | 'automation';
  healthEndpoint?: string;
  icon: string;
}

const ADMIN_SERVICES: AdminService[] = [
  // Admin Tools (Staff Only - Keycloak SSO)
  {
    name: 'Django Admin',
    description: 'System data management and configuration',
    url: 'http://localhost:27500/backend/admin/',
    route: '/backend/',
    externalPort: 27500,
    directUrl: 'http://localhost:27200/admin/',
    directPort: 27200,
    internalPort: 8000,
    category: 'admin',
    healthEndpoint: 'http://localhost:27200/health',
    icon: 'DJ',
  },
  {
    name: 'Portainer',
    description: 'Docker container management UI',
    url: 'http://localhost:27500/portainer/',
    route: '/portainer/',
    externalPort: 27500,
    directUrl: 'http://localhost:27091',
    directPort: 27091,
    internalPort: 9000,
    category: 'admin',
    healthEndpoint: 'http://localhost:27091/api/status',
    icon: 'PT',
  },
  {
    name: 'Directus',
    description: 'Headless CMS for content management',
    url: 'http://localhost:27500/directus/',
    route: '/directus/',
    externalPort: 27500,
    directUrl: 'http://localhost:27060',
    directPort: 27060,
    internalPort: 8055,
    category: 'admin',
    healthEndpoint: 'http://localhost:27060/server/health',
    icon: 'DX',
  },
  {
    name: 'n8n',
    description: 'Workflow automation platform',
    url: 'http://localhost:27500/n8n/',
    route: '/n8n/',
    externalPort: 27500,
    directUrl: 'http://localhost:27061',
    directPort: 27061,
    internalPort: 5678,
    category: 'admin',
    healthEndpoint: 'http://localhost:27061/healthz',
    icon: 'N8',
  },
  {
    name: 'Keycloak Admin',
    description: 'Identity and access management',
    url: 'http://localhost:27500/keycloak/admin/',
    route: '/keycloak/',
    externalPort: 27500,
    directUrl: 'http://localhost:8180/admin',
    directPort: 8180,
    internalPort: 8080,
    category: 'admin',
    healthEndpoint: 'http://localhost:8180/health',
    icon: 'KC',
  },

  // Customer-Facing (Supabase Auth)
  {
    name: 'Supabase Studio',
    description: 'Database and auth management UI',
    url: 'http://localhost:27703',
    directPort: 27703,
    directUrl: 'http://localhost:27703',
    category: 'customer',
    healthEndpoint: 'http://localhost:27703/api/profile',
    icon: 'SB',
  },
  {
    name: 'React Admin',
    description: 'Customer self-service data portal',
    url: 'http://localhost:27500/control-panel',
    route: '/control-panel',
    externalPort: 27500,
    category: 'customer',
    icon: 'RA',
  },

  // Observability Stack
  {
    name: 'Grafana',
    description: 'Metrics dashboards and visualization',
    url: 'http://localhost:27500/grafana/',
    route: '/grafana/',
    externalPort: 27500,
    directUrl: 'http://localhost:27082',
    directPort: 27082,
    internalPort: 3000,
    category: 'observability',
    healthEndpoint: 'http://localhost:27082/api/health',
    icon: 'GF',
  },
  {
    name: 'Prometheus',
    description: 'Metrics collection and storage',
    url: 'http://localhost:27500/prometheus/',
    route: '/prometheus/',
    externalPort: 27500,
    directUrl: 'http://localhost:27080',
    directPort: 27080,
    internalPort: 9090,
    category: 'observability',
    healthEndpoint: 'http://localhost:27080/-/healthy',
    icon: 'PM',
  },
  {
    name: 'Jaeger',
    description: 'Distributed tracing UI',
    url: 'http://localhost:27500/jaeger/',
    route: '/jaeger/',
    externalPort: 27500,
    directUrl: 'http://localhost:27083',
    directPort: 27083,
    internalPort: 16686,
    category: 'observability',
    icon: 'JG',
  },
  {
    name: 'Loki',
    description: 'Log aggregation system',
    url: 'http://localhost:27500/loki/',
    route: '/loki/',
    externalPort: 27500,
    directUrl: 'http://localhost:27081',
    directPort: 27081,
    internalPort: 3100,
    category: 'observability',
    healthEndpoint: 'http://localhost:27081/ready',
    icon: 'LK',
  },

  // Infrastructure
  {
    name: 'MinIO Console',
    description: 'Object storage management',
    url: 'http://localhost:27500/minio/',
    route: '/minio/',
    externalPort: 27500,
    directUrl: 'http://localhost:27041',
    directPort: 27041,
    internalPort: 9001,
    category: 'infrastructure',
    healthEndpoint: 'http://localhost:27040/minio/health/live',
    icon: 'MN',
  },
  {
    name: 'Temporal UI',
    description: 'Workflow execution monitoring',
    url: 'http://localhost:27500/temporal/',
    route: '/temporal/',
    externalPort: 27500,
    directUrl: 'http://localhost:27021',
    directPort: 27021,
    internalPort: 8080,
    category: 'infrastructure',
    icon: 'TP',
  },
  {
    name: 'Workflow Monitor',
    description: 'Mapping gaps and workflow admin events',
    url: 'http://localhost:27500/admin/workflows',
    route: '/admin/workflows',
    externalPort: 27500,
    category: 'admin',
    icon: 'WF',
  },
  {
    name: 'Allure Reports',
    description: 'Test execution reports',
    url: 'http://localhost:27500/allure/',
    route: '/allure/',
    externalPort: 27500,
    directPort: 27920,
    directUrl: 'http://localhost:27920',
    internalPort: 5050,
    category: 'infrastructure',
    healthEndpoint: 'http://localhost:27920/status',
    icon: 'AL',
  },
  {
    name: 'Langflow',
    description: 'AI flow builder',
    url: 'http://localhost:27500/langflow/',
    route: '/langflow/',
    externalPort: 27500,
    directPort: 27930,
    directUrl: 'http://localhost:27930',
    internalPort: 7860,
    category: 'infrastructure',
    icon: 'LF',
  },
  {
    name: 'Tempo',
    description: 'Trace storage backend',
    url: 'http://localhost:27500/tempo/',
    route: '/tempo/',
    externalPort: 27500,
    directPort: 27093,
    directUrl: 'http://localhost:27093',
    internalPort: 3200,
    category: 'observability',
    icon: 'TP',
  },
  {
    name: 'Selenium Hub',
    description: 'Selenium Grid control plane',
    url: 'http://localhost:27500/selenium/hub',
    route: '/selenium/hub',
    externalPort: 27500,
    directPort: 27240,
    directUrl: 'http://localhost:27240',
    internalPort: 4444,
    category: 'automation',
    healthEndpoint: 'http://localhost:27240/wd/hub/status',
    icon: 'SH',
  },
  {
    name: 'Selenium Chrome',
    description: 'Chrome noVNC session for UI testing',
    url: 'http://localhost:27500/selenium/chrome/',
    route: '/selenium/chrome/',
    externalPort: 27500,
    directPort: 27244,
    directUrl: 'http://localhost:27244',
    internalPort: 7900,
    category: 'automation',
    icon: 'SC',
  },
  {
    name: 'Selenium Firefox',
    description: 'Firefox noVNC session for UI testing',
    url: 'http://localhost:27500/selenium/firefox/',
    route: '/selenium/firefox/',
    externalPort: 27500,
    directPort: 27246,
    directUrl: 'http://localhost:27246',
    internalPort: 7900,
    category: 'automation',
    icon: 'SF',
  },
];

export function AdminServices() {
  const [healthStatus, setHealthStatus] = useState<{ [key: string]: ServiceHealth }>({});
  const [filter, setFilter] = useState<string>('all');
  const [mappingGapsCount, setMappingGapsCount] = useState<number | null>(null);

  useEffect(() => {
    checkAllHealth();
    const interval = setInterval(checkAllHealth, 30000); // Check every 30s
    fetchMappingGaps();
    return () => clearInterval(interval);
  }, []);

  const checkAllHealth = async () => {
    const newHealth: { [key: string]: ServiceHealth } = {};

    for (const service of ADMIN_SERVICES) {
      if (!service.healthEndpoint) {
        newHealth[service.name] = { status: 'unknown' };
        continue;
      }

      newHealth[service.name] = { status: 'checking' };
      setHealthStatus(prev => ({ ...prev, [service.name]: { status: 'checking' } }));

      try {
        const startTime = Date.now();
        const response = await fetch(service.healthEndpoint, {
          method: 'GET',
          mode: 'no-cors', // Allow cross-origin for health checks
          signal: AbortSignal.timeout(5000),
        });

        const responseTime = Date.now() - startTime;

        // For no-cors mode, we can't read the response, but if it doesn't error, service is up
        newHealth[service.name] = {
          status: 'healthy',
          responseTime,
        };
      } catch (error: any) {
        newHealth[service.name] = {
          status: 'unhealthy',
          message: error.message,
        };
      }
    }

    setHealthStatus(newHealth);
  };

  const fetchMappingGaps = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_CNS_API_URL || 'http://localhost:27800/api'}/admin/mapping-gaps`);
      if (!res.ok) return;
      const json = await res.json();
      setMappingGapsCount(json.rows_count || 0);
    } catch (err) {
      // ignore failures for now
    }
  };

  const getStatusColor = (status: ServiceHealth['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'unhealthy':
        return 'bg-red-500';
      case 'checking':
        return 'bg-yellow-500 animate-pulse';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: ServiceHealth['status']) => {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'unhealthy':
        return 'Unhealthy';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const filteredServices = ADMIN_SERVICES.filter(service => {
    if (filter === 'all') return true;
    return service.category === filter;
  });

  const getCategoryCount = (category: string) => {
    if (category === 'all') return ADMIN_SERVICES.length;
    return ADMIN_SERVICES.filter(s => s.category === category).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Services</h2>
          <p className="text-gray-600 mt-1">Quick access to all platform admin UIs</p>
        </div>
        <button
          onClick={checkAllHealth}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Health
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        {['all', 'admin', 'customer', 'observability', 'infrastructure'].map(category => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              filter === category
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {category} ({getCategoryCount(category)})
          </button>
        ))}
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(service => {
          const health = healthStatus[service.name] || { status: 'unknown' };

          return (
            <div
              key={service.name}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{service.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{service.name}</h3>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {service.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(health.status)}`} />
                  <span className="text-xs text-gray-600">{getStatusText(health.status)}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4">{service.description}</p>

              {/* Details */}
              <div className="space-y-2 mb-4 text-sm">
                {service.route && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Traefik Route:</span>
                    <span className="font-mono text-gray-900">{service.route}</span>
                  </div>
                )}
                {service.externalPort && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Traefik Port:</span>
                    <span className="font-mono text-gray-900">{service.externalPort}</span>
                  </div>
                )}
                {service.directUrl && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Direct URL:</span>
                    <a
                      href={service.directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {service.directUrl}
                    </a>
                  </div>
                )}
                {service.directPort && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Direct Port:</span>
                    <span className="font-mono text-gray-900">{service.directPort}</span>
                  </div>
                )}
                {service.internalPort && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Container Port:</span>
                    <span className="font-mono text-gray-900">{service.internalPort}</span>
                  </div>
                )}
                {health.responseTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Response:</span>
                    <span className="font-mono text-gray-900">{health.responseTime}ms</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open {service.name}
              </a>
              {service.name === 'Workflow Monitor' && mappingGapsCount && mappingGapsCount > 0 && (
                <div className="mt-2 text-xs text-red-600">{mappingGapsCount} mapping gaps detected</div>
              )}

              {/* Error Message */}
              {health.status === 'unhealthy' && health.message && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                  {health.message}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Authentication Info</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            <strong>Admin Tools:</strong> Use Keycloak SSO (staff credentials)
          </p>
          <p>
            <strong>Customer Portal:</strong> Use Supabase Auth (customer credentials)
          </p>
          <p>
            <strong>Observability:</strong> Direct access (no auth required)
          </p>
        </div>
      </div>
    </div>
  );
}
