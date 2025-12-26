/**
 * Custom Hook for Microservices Data
 *
 * Handles data fetching, mock data generation, and auto-refresh logic
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Service,
  ServiceMetrics,
  LogEntry,
  Alert,
  SystemHealth,
  ServiceStatus,
  LogSeverity,
  AlertSeverity,
} from '../types';

// Mock service definitions for your Components Platform V2
const SERVICE_DEFINITIONS = [
  {
    id: 'traefik',
    name: 'traefik',
    displayName: 'Traefik',
    port: 27500,
    endpoint: 'http://localhost:27500',
    dockerContainer: 'components-v2-traefik',
    dependencies: [],
  },
  {
    id: 'backend',
    name: 'backend',
    displayName: 'Django Backend',
    port: 27200,
    endpoint: 'http://localhost:27500/backend',
    dockerContainer: 'components-v2-backend',
    dependencies: ['postgres', 'redis'],
  },
  {
    id: 'cns-service',
    name: 'cns-service',
    displayName: 'CNS Service',
    port: 27800,
    endpoint: 'http://localhost:27800',
    dockerContainer: 'components-v2-cns-service',
    dependencies: ['postgres', 'temporal', 'redis'],
  },
  {
    id: 'dashboard',
    name: 'dashboard',
    displayName: 'Main Dashboard',
    port: 27300,
    endpoint: 'http://localhost:27500/',
    dockerContainer: 'components-v2-dashboard',
    dependencies: ['backend', 'keycloak'],
  },
  {
    id: 'keycloak',
    name: 'keycloak',
    displayName: 'Keycloak SSO',
    port: 27210,
    endpoint: 'http://localhost:27500/keycloak',
    dockerContainer: 'components-v2-keycloak',
    dependencies: ['postgres-keycloak'],
  },
  {
    id: 'n8n',
    name: 'n8n',
    displayName: 'n8n Automation',
    port: 27600,
    endpoint: 'http://localhost:27500/n8n',
    dockerContainer: 'components-v2-n8n',
    dependencies: ['postgres'],
  },
  {
    id: 'postgres',
    name: 'postgres',
    displayName: 'PostgreSQL',
    port: 5432,
    endpoint: 'postgresql://localhost:5432',
    dockerContainer: 'components-v2-postgres',
    dependencies: [],
  },
  {
    id: 'redis',
    name: 'redis',
    displayName: 'Redis Cache',
    port: 6379,
    endpoint: 'redis://localhost:6379',
    dockerContainer: 'components-v2-redis',
    dependencies: [],
  },
  {
    id: 'temporal',
    name: 'temporal',
    displayName: 'Temporal Workflow',
    port: 7233,
    endpoint: 'http://localhost:7233',
    dockerContainer: 'components-v2-temporal',
    dependencies: ['postgres'],
  },
  {
    id: 'grafana',
    name: 'grafana',
    displayName: 'Grafana',
    port: 27900,
    endpoint: 'http://localhost:27500/grafana',
    dockerContainer: 'components-v2-grafana',
    dependencies: ['prometheus'],
  },
  {
    id: 'prometheus',
    name: 'prometheus',
    displayName: 'Prometheus',
    port: 9090,
    endpoint: 'http://localhost:9090',
    dockerContainer: 'components-v2-prometheus',
    dependencies: [],
  },
  {
    id: 'jaeger',
    name: 'jaeger',
    displayName: 'Jaeger Tracing',
    port: 16686,
    endpoint: 'http://localhost:27500/jaeger',
    dockerContainer: 'components-v2-jaeger',
    dependencies: [],
  },
];

const generateMockService = (definition: typeof SERVICE_DEFINITIONS[0]): Service => {
  const statuses: ServiceStatus[] = ['running', 'running', 'running', 'degraded', 'error'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const baseUptime = status === 'running' ? 95 + Math.random() * 5 :
                     status === 'degraded' ? 85 + Math.random() * 10 :
                     Math.random() * 80;

  return {
    ...definition,
    status,
    version: `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
    environment: definition.port < 10000 ? 'dev' : 'prod',
    uptime: baseUptime,
    responseTime: Math.floor(Math.random() * 300) + 50,
    lastHealthCheck: new Date(Date.now() - Math.random() * 60000),
    cpuUsage: Math.random() * 80 + 10,
    memoryUsage: Math.random() * 1500 + 200,
    totalRequests: Math.floor(Math.random() * 1000000) + 10000,
    requestsLastHour: Math.floor(Math.random() * 5000) + 100,
    successRate: 92 + Math.random() * 7,
    errorRate: Math.random() * 5,
    activeConnections: Math.floor(Math.random() * 50),
    queuedRequests: Math.floor(Math.random() * 10),
    lastDeployment: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    deployedBy: 'DevOps Team',
    dependents: SERVICE_DEFINITIONS
      .filter(s => s.dependencies.includes(definition.id))
      .map(s => s.id),
  };
};

const generateMockLogs = (services: Service[], count: number = 50): LogEntry[] => {
  const severities: LogSeverity[] = ['debug', 'info', 'info', 'warning', 'error'];
  const messages = [
    'Request processed successfully',
    'Database query executed',
    'Cache hit for key',
    'API rate limit warning',
    'Connection timeout',
    'Authentication successful',
    'Configuration loaded',
    'Health check passed',
    'Error handling request',
    'Service started successfully',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `log-${i}`,
    timestamp: new Date(Date.now() - i * 10000 - Math.random() * 10000),
    serviceId: services[Math.floor(Math.random() * services.length)].id,
    serviceName: services[Math.floor(Math.random() * services.length)].displayName,
    severity: severities[Math.floor(Math.random() * severities.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    traceId: Math.random() < 0.5 ? `trace-${Math.random().toString(36).substr(2, 16)}` : undefined,
    details: Math.random() < 0.3 ? {
      requestId: Math.random().toString(36).substr(2, 9),
      duration: Math.floor(Math.random() * 1000),
      method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
    } : undefined,
  })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const generateMockAlerts = (services: Service[]): Alert[] => {
  const alerts: Alert[] = [];
  const severities: AlertSeverity[] = ['info', 'warning', 'error', 'critical'];
  const titles = [
    'High CPU Usage',
    'Memory Threshold Exceeded',
    'Service Unreachable',
    'High Error Rate',
    'Disk Space Low',
    'Slow Response Time',
  ];

  services.forEach(service => {
    if (service.status === 'error' || service.cpuUsage > 80 || service.successRate < 95) {
      alerts.push({
        id: `alert-${service.id}-${Date.now()}`,
        timestamp: new Date(Date.now() - Math.random() * 3600000),
        serviceId: service.id,
        serviceName: service.displayName,
        severity: service.status === 'error' ? 'critical' :
                 service.cpuUsage > 80 ? 'error' : 'warning',
        title: titles[Math.floor(Math.random() * titles.length)],
        message: `${service.displayName} is experiencing issues. ${
          service.status === 'error' ? 'Service is not responding.' :
          service.cpuUsage > 80 ? `CPU usage at ${service.cpuUsage.toFixed(1)}%` :
          `Success rate dropped to ${service.successRate.toFixed(1)}%`
        }`,
        acknowledged: Math.random() < 0.3,
        acknowledgedBy: Math.random() < 0.3 ? 'admin@example.com' : undefined,
        acknowledgedAt: Math.random() < 0.3 ? new Date(Date.now() - Math.random() * 1800000) : undefined,
      });
    }
  });

  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

interface UseMicroservicesDataReturn {
  services: Service[];
  metrics: any;
  logs: LogEntry[];
  alerts: Alert[];
  systemHealth: SystemHealth;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export const useMicroservicesData = (
  autoRefresh: boolean = true,
  refreshInterval: number = 10
): UseMicroservicesDataReturn => {
  const [services, setServices] = useState<Service[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In production, these would be API calls
      // For now, we generate mock data
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

      const mockServices = SERVICE_DEFINITIONS.map(generateMockService);
      const mockLogs = generateMockLogs(mockServices);
      const mockAlerts = generateMockAlerts(mockServices);

      setServices(mockServices);
      setLogs(mockLogs);
      setAlerts(mockAlerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Calculate system health
  const systemHealth: SystemHealth = {
    status: services.filter(s => s.status === 'error').length > 0 ? 'critical' :
            services.filter(s => s.status === 'degraded').length > 0 ? 'degraded' :
            'healthy',
    healthScore: Math.round(
      (services.filter(s => s.status === 'running').length / services.length) * 100
    ),
    totalServices: services.length,
    healthyServices: services.filter(s => s.status === 'running').length,
    degradedServices: services.filter(s => s.status === 'degraded').length,
    downServices: services.filter(s => s.status === 'error' || s.status === 'stopped').length,
    lastUpdate: new Date(),
  };

  // Mock metrics data
  const metrics = {
    requestRate: Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 60000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: Math.floor(Math.random() * 1000) + 200,
    })),
    errorRate: Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 60000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: Math.floor(Math.random() * 50) + 5,
    })),
  };

  return {
    services,
    metrics,
    logs,
    alerts,
    systemHealth,
    loading,
    error,
    refreshData,
  };
};
