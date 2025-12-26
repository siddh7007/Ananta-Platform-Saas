/**
 * Type definitions for Microservices Dashboard
 */

export type ServiceStatus = 'running' | 'degraded' | 'stopped' | 'error';
export type Environment = 'dev' | 'staging' | 'prod';
export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Service {
  id: string;
  name: string;
  displayName: string;
  status: ServiceStatus;
  version: string;
  environment: Environment;
  port: number;
  endpoint: string;
  dockerContainer: string;

  // Health metrics
  uptime: number; // percentage
  responseTime: number; // ms
  lastHealthCheck: Date;
  cpuUsage: number; // percentage
  memoryUsage: number; // MB

  // API metrics
  totalRequests: number;
  requestsLastHour: number;
  successRate: number; // percentage
  errorRate: number; // percentage
  activeConnections: number;
  queuedRequests: number;

  // Deployment info
  lastDeployment: Date;
  deployedBy: string;

  // Dependencies
  dependencies: string[]; // service IDs
  dependents: string[]; // service IDs that depend on this
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface ServiceMetrics {
  serviceId: string;
  requestRate: MetricDataPoint[];
  errorRate: MetricDataPoint[];
  responseTime: MetricDataPoint[];
  cpuUsage: MetricDataPoint[];
  memoryUsage: MetricDataPoint[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  serviceId: string;
  serviceName: string;
  severity: LogSeverity;
  message: string;
  details?: Record<string, any>;
  traceId?: string;
}

export interface Alert {
  id: string;
  timestamp: Date;
  serviceId: string;
  serviceName: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  healthScore: number; // 0-100
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  downServices: number;
  lastUpdate: Date;
}

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  avgResponseTime: number;
  requestCount: number;
  errorRate: number;
}
