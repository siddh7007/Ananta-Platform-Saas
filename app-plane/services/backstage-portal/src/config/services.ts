/**
 * Complete Service Configuration - Components Platform V2
 * Integrated Admin Panel: All 35+ services including Supabase stack
 */

export interface ServiceCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  loginUrl?: string;
  autoLogin?: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  proxyUrl?: string;
  healthEndpoint?: string;
  category: 'core' | 'observability' | 'automation' | 'storage' | 'documentation' | 'ai' | 'mcp' | 'customer';
  requiresSSO: boolean;
  color: string;
  credentials?: ServiceCredentials;
  port?: number;
  enabled: boolean;
  notes?: string;
}

// Service credentials from environment
const CREDENTIALS = {
  keycloak: {
    username: 'admin',
    password: 'admin123',
    loginUrl: '/auth/admin',
    autoLogin: true
  },
  directus: {
    username: 'admin@components.local',
    password: 'admin123',
    loginUrl: '/admin/login',
    autoLogin: true
  },
  grafana: {
    username: 'admin',
    password: 'admin123',
    loginUrl: '/login',
    autoLogin: true
  },
  rabbitmq: {
    username: 'admin',
    password: 'admin123_change_in_production',
    loginUrl: '/#/login',
    autoLogin: true
  },
  minio: {
    username: 'minioadmin',
    password: 'minioadmin',
    loginUrl: '/login',
    autoLogin: true
  },
  portainer: {
    username: 'admin',
    password: 'ComponentsPlatform2025!',
    loginUrl: '/#/auth',
    autoLogin: true
  },
  postgres: {
    username: 'postgres',
    password: 'postgres',
    autoLogin: false
  },
  n8n: {
    username: 'admin@components.local',
    password: 'ComponentsPlatform2025!',
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZmJiNzgwYS0wOTk4LTRjZjMtYjJiMy02ZWU4YjMwNTk0ZjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODcxMDk3fQ.dBhDagkHLffGUM0kLXcYngcVaRx1lJE10ZcgGVeqmMA',
    loginUrl: '/signin',
    autoLogin: true
  },
  wikijs: {
    username: 'admin@components.local',
    password: 'admin123',
    loginUrl: '/login',
    autoLogin: true
  },
  supabase: {
    username: 'admin@components.local',
    password: 'supabase-admin-2024',
    loginUrl: '/project/default',
    autoLogin: false
  }
};

const TRAEFIK_BASE_URL = process.env.NEXT_PUBLIC_TRAEFIK_URL || 'http://localhost:27500';

export const services: Service[] = [
  // ============================================================================
  // CORE APPLICATION SERVICES
  // ============================================================================
  {
    id: 'dashboard',
    name: 'Unified Dashboard',
    description: 'Main Control Panel (Next.js)',
    icon: '🎛️',
    url: 'http://localhost:27520',
    proxyUrl: TRAEFIK_BASE_URL,
    healthEndpoint: '/api/health',
    category: 'core',
    requiresSSO: false,
    color: '#a855f7', // purple-500
    port: 27520,
    enabled: true
  },
  {
    id: 'backend',
    name: 'Django Backend',
    description: 'Main Application API',
    icon: '🔧',
    url: 'http://localhost:27200',
    proxyUrl: `${TRAEFIK_BASE_URL}/backend`,
    healthEndpoint: '/health/',
    category: 'core',
    requiresSSO: false,
    color: '#22c55e', // green-500
    port: 27200,
    enabled: true
  },
  {
    id: 'django-admin',
    name: 'Django Admin',
    description: 'Database Admin Interface',
    icon: '⚙️',
    url: 'http://localhost:27200/admin/',
    proxyUrl: `${TRAEFIK_BASE_URL}/backend/admin/`,
    healthEndpoint: '/health/',
    category: 'core',
    requiresSSO: false,
    color: '#10b981', // emerald-600
    credentials: {
      username: 'admin',
      password: 'admin',
      loginUrl: '/admin/login/',
      autoLogin: true
    },
    port: 27200,
    enabled: true
  },
  {
    id: 'frontend',
    name: 'Component Catalog UI',
    description: 'Component Management Interface',
    icon: '📦',
    url: 'http://localhost:27200',
    healthEndpoint: '/health/',
    category: 'core',
    requiresSSO: false,
    color: '#3b82f6', // blue-500
    port: 27200,
    enabled: true
  },

  // ============================================================================
  // CUSTOMER PORTAL & SUPABASE STACK (NEW!)
  // ============================================================================
  {
    id: 'customer-portal',
    name: 'Customer Portal',
    description: 'React Admin Customer Interface',
    icon: '👥',
    url: 'http://localhost:27510',
    proxyUrl: `${TRAEFIK_BASE_URL}/customer-portal`,
    category: 'customer',
    requiresSSO: false,
    color: '#8b5cf6', // violet-500
    port: 27510,
    enabled: true
  },
  {
    id: 'supabase-studio',
    name: 'Supabase Studio',
    description: 'Database Management UI',
    icon: '🗄️',
    url: process.env.NEXT_PUBLIC_SUPABASE_STUDIO_URL || 'http://localhost:27543',
    category: 'customer',
    requiresSSO: false,
    color: '#3ecf8e', // supabase green
    credentials: CREDENTIALS.supabase,
    port: parseInt(process.env.NEXT_PUBLIC_SUPABASE_STUDIO_PORT || '27543'),
    enabled: true
  },
  {
    id: 'supabase-kong',
    name: 'Supabase API Gateway',
    description: 'Kong API Gateway (REST API)',
    icon: '🚪',
    url: 'http://localhost:27540',
    proxyUrl: `${TRAEFIK_BASE_URL}/supabase`,
    healthEndpoint: '/rest/v1/',
    category: 'customer',
    requiresSSO: false,
    color: '#0ea5e9', // cyan-500
    port: 27540,
    enabled: true
  },
  {
    id: 'supabase-db',
    name: 'Supabase PostgreSQL',
    description: 'Customer Data Database',
    icon: '🐘',
    url: `postgresql://localhost:${process.env.NEXT_PUBLIC_SUPABASE_DB_PORT || '27541'}`,
    category: 'customer',
    requiresSSO: false,
    color: '#336791', // postgres blue
    credentials: {
      username: 'postgres',
      password: 'supabase-postgres-secure-2024',
      autoLogin: false
    },
    port: parseInt(process.env.NEXT_PUBLIC_SUPABASE_DB_PORT || '27541'),
    enabled: false  // Database connection string
  },

  // ============================================================================
  // AUTHENTICATION & SECURITY
  // ============================================================================
  {
    id: 'keycloak',
    name: 'Keycloak SSO',
    description: 'Authentication & Identity Management',
    icon: '🔐',
    url: 'http://localhost:8180',
    proxyUrl: `${TRAEFIK_BASE_URL}/keycloak`,
    healthEndpoint: '/health',
    category: 'core',
    requiresSSO: false,
    color: '#dc2626', // red-600
    credentials: CREDENTIALS.keycloak,
    port: 8180,
    enabled: true
  },

  // ============================================================================
  // CONTENT MANAGEMENT
  // ============================================================================
  {
    id: 'directus',
    name: 'Directus CMS',
    description: 'Headless Content Management',
    icon: '📝',
    url: 'http://localhost:27060',
    proxyUrl: `${TRAEFIK_BASE_URL}/directus`,
    healthEndpoint: '/server/health',
    category: 'core',
    requiresSSO: false,
    color: '#a855f7', // purple-500
    credentials: CREDENTIALS.directus,
    port: 27060,
    enabled: true
  },

  // ============================================================================
  // AI & DEVELOPMENT TOOLS
  // ============================================================================
  {
    id: 'code-server',
    name: 'VS Code Server',
    description: 'Browser-based IDE',
    icon: '💻',
    url: 'http://localhost:27800',
    healthEndpoint: '/healthz',
    category: 'ai',
    requiresSSO: false,
    color: '#64748b', // slate-600
    credentials: {
      username: 'admin',
      password: 'admin123',
      loginUrl: '/',
      autoLogin: false
    },
    port: 27800,
    enabled: true,
    notes: 'Gateway route disabled; open the IDE directly on port 27800.'
  },
  {
    id: 'langflow',
    name: 'Langflow',
    description: 'Visual AI Workflow Builder',
    icon: '🤖',
    url: 'http://localhost:27930',
    healthEndpoint: '/api/v1/health',
    category: 'ai',
    requiresSSO: false,
    color: '#9333ea', // purple-600
    port: 27930,
    enabled: true,
    notes: 'Langflow does not support path-based routing; use direct port 27930.'
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    description: 'ChatGPT-like AI Interface',
    icon: '💬',
    url: process.env.NEXT_PUBLIC_OPEN_WEBUI_URL || 'http://localhost:27900',
    category: 'ai',
    requiresSSO: false,
    color: '#7c3aed', // violet-600
    port: parseInt(process.env.NEXT_PUBLIC_OPEN_WEBUI_PORT || '27900'),
    enabled: false
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local LLM Server',
    icon: '🧠',
    url: process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:27260',
    healthEndpoint: '/api/version',
    category: 'ai',
    requiresSSO: false,
    color: '#4f46e5', // indigo-700
    port: parseInt(process.env.NEXT_PUBLIC_OLLAMA_PORT || '27260'),
    enabled: false
  },

  // ============================================================================
  // WORKFLOW AUTOMATION
  // ============================================================================
  {
    id: 'n8n',
    name: 'n8n Workflows',
    description: 'Visual Workflow Automation',
    icon: '🔄',
    url: 'http://localhost:27061',
    proxyUrl: `${TRAEFIK_BASE_URL}/n8n`,
    healthEndpoint: '/healthz',
    category: 'automation',
    requiresSSO: false,
    color: '#ec4899', // pink-500
    credentials: CREDENTIALS.n8n,
    port: 27061,
    enabled: true
  },
  {
    id: 'temporal',
    name: 'Temporal',
    description: 'Durable Workflow Orchestration',
    icon: '⏱️',
    url: 'http://localhost:27021',
    healthEndpoint: '/',
    category: 'automation',
    requiresSSO: false,
    color: '#6366f1', // indigo-500
    port: 27021,
    enabled: true,
    notes: 'Temporal UI cannot be proxied; reach it directly on port 27021.'
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    description: 'Message Queue & Events',
    icon: '🐰',
    url: 'http://localhost:27252',
    healthEndpoint: '/api/health/checks/alarms',
    category: 'automation',
    requiresSSO: false,
    color: '#ea580c', // orange-600
    credentials: CREDENTIALS.rabbitmq,
    port: 27252,
    enabled: true,
    notes: 'Traefik route under review; use management port 27252.'
  },

  // ============================================================================
  // CONTAINER MANAGEMENT
  // ============================================================================
  {
    id: 'portainer',
    name: 'Portainer',
    description: 'Docker Container Management',
    icon: '🐳',
    url: 'http://localhost:27091',
    healthEndpoint: '/api/system/status',
    category: 'automation',
    requiresSSO: false,
    color: '#0891b2', // cyan-600
    credentials: CREDENTIALS.portainer,
    port: 27091,
    enabled: true
  },

  // ============================================================================
  // STORAGE SERVICES
  // ============================================================================
  {
    id: 'minio',
    name: 'MinIO Storage',
    description: 'S3-Compatible Object Storage',
    icon: '☁️',
    url: 'http://localhost:27041',
    proxyUrl: `${TRAEFIK_BASE_URL}/minio`,
    healthEndpoint: '/minio/health/live',
    category: 'storage',
    requiresSSO: false,
    color: '#ef4444', // red-500
    credentials: CREDENTIALS.minio,
    port: 27041,
    enabled: true
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Primary Database',
    icon: '🐘',
    url: 'postgresql://localhost:27010',
    category: 'storage',
    requiresSSO: false,
    color: '#2563eb', // blue-600
    credentials: CREDENTIALS.postgres,
    port: 27010,
    enabled: false
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Cache & Session Store',
    icon: '🔴',
    url: 'redis://localhost:27012',
    category: 'storage',
    requiresSSO: false,
    color: '#dc2626', // red-600
    port: 27012,
    enabled: false
  },
  {
    id: 'meilisearch',
    name: 'MeiliSearch',
    description: 'Fast Search Engine',
    icon: '🔍',
    url: 'http://localhost:27042',
    proxyUrl: `${TRAEFIK_BASE_URL}/meilisearch`,
    healthEndpoint: '/health',
    category: 'storage',
    requiresSSO: false,
    color: '#ca8a04', // yellow-600
    port: 27042,
    enabled: true
  },

  // ============================================================================
  // DOCUMENTATION & TESTING
  // ============================================================================
  {
    id: 'wiki',
    name: 'Wiki.js',
    description: 'Documentation & Knowledge Base',
    icon: '📚',
    url: 'http://localhost:27910',
    proxyUrl: `${TRAEFIK_BASE_URL}/wiki`,
    healthEndpoint: '/healthz',
    category: 'documentation',
    requiresSSO: false,
    color: '#4f46e5', // indigo-600
    credentials: CREDENTIALS.wikijs,
    port: 27910,
    enabled: true
  },
  {
    id: 'allure',
    name: 'Allure Reports',
    description: 'Test Execution Reports',
    icon: '🧪',
    url: 'http://localhost:27920',
    healthEndpoint: '/',
    category: 'documentation',
    requiresSSO: false,
    color: '#ca8a04', // yellow-600
    port: 27920,
    enabled: true,
    notes: 'Reverse proxy currently disabled; open Allure directly on port 27920.'
  },

  // ============================================================================
  // OBSERVABILITY STACK
  // ============================================================================
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Metrics Visualization & Dashboards',
    icon: '📊',
    url: 'http://localhost:27082',
    proxyUrl: `${TRAEFIK_BASE_URL}/grafana`,
    healthEndpoint: '/api/health',
    category: 'observability',
    requiresSSO: false,
    color: '#f97316', // orange-500
    credentials: CREDENTIALS.grafana,
    port: 27082,
    enabled: true
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Metrics Collection & Storage',
    icon: '📈',
    url: 'http://localhost:27080',
    proxyUrl: `${TRAEFIK_BASE_URL}/prometheus`,
    healthEndpoint: '/-/healthy',
    category: 'observability',
    requiresSSO: false,
    color: '#eab308', // yellow-500
    port: 27080,
    enabled: true
  },
  {
    id: 'loki',
    name: 'Loki',
    description: 'Log Aggregation',
    icon: '📝',
    url: 'http://localhost:27081',
    healthEndpoint: '/ready',
    category: 'observability',
    requiresSSO: false,
    color: '#16a34a', // green-600
    port: 27081,
    enabled: true
  },
  {
    id: 'jaeger',
    name: 'Jaeger',
    description: 'Distributed Tracing',
    icon: '🔬',
    url: 'http://localhost:27090',
    proxyUrl: `${TRAEFIK_BASE_URL}/jaeger`,
    healthEndpoint: '/',
    category: 'observability',
    requiresSSO: false,
    color: '#06b6d4', // cyan-500
    port: 27090,
    enabled: true
  },
  {
    id: 'tempo',
    name: 'Tempo',
    description: 'Trace Storage Backend',
    icon: '⚡',
    url: 'http://localhost:27093/status',
    healthEndpoint: '/ready',
    category: 'observability',
    requiresSSO: false,
    color: '#a855f7', // purple-500
    port: 27093,
    enabled: true
  },

  // ============================================================================
  // BROWSER AUTOMATION
  // ============================================================================
  {
    id: 'selenium-hub',
    name: 'Selenium Grid',
    description: 'Browser Automation Hub',
    icon: '🌐',
    url: 'http://localhost:27240',
    healthEndpoint: '/wd/hub/status',
    category: 'automation',
    requiresSSO: false,
    color: '#22c55e', // green-500
    port: 27240,
    enabled: true,
    notes: 'WebSocket stability requires direct access on port 27240.'
  },
  {
    id: 'selenium-chrome',
    name: 'Chrome VNC Viewer',
    description: 'Watch Chrome automation live',
    icon: '👁️',
    url: 'http://localhost:27244',
    category: 'automation',
    requiresSSO: false,
    color: '#60a5fa', // blue-400
    port: 27244,
    enabled: true
  },
  {
    id: 'selenium-firefox',
    name: 'Firefox VNC Viewer',
    description: 'Watch Firefox automation live',
    icon: '🦊',
    url: 'http://localhost:27246',
    category: 'automation',
    requiresSSO: false,
    color: '#fb923c', // orange-400
    port: 27246,
    enabled: true
  },

  // ============================================================================
  // MCP INFRASTRUCTURE
  // ============================================================================
  {
    id: 'mcp-gateway',
    name: 'MCP Gateway',
    description: 'Unified AI Tools API (71 tools)',
    icon: '🚪',
    url: 'http://localhost:27150',
    healthEndpoint: '/health',
    category: 'mcp',
    requiresSSO: false,
    color: '#3b82f6', // blue-500 to purple-500 gradient
    port: 27150,
    enabled: true
  },
  {
    id: 'mcp-metrics',
    name: 'MCP Metrics',
    description: 'Gateway Prometheus Metrics',
    icon: '📊',
    url: 'http://localhost:27150/metrics',
    category: 'mcp',
    requiresSSO: false,
    color: '#eab308', // yellow-500
    port: 27150,
    enabled: true
  }
];

/**
 * Get service by ID
 */
export const getService = (id: string): Service | undefined => {
  return services.find((s) => s.id === id && s.enabled);
};

/**
 * Get services by category
 */
export const getServicesByCategory = (category: Service['category']): Service[] => {
  return services.filter((s) => s.category === category && s.enabled);
};

/**
 * Get all enabled services
 */
export const getEnabledServices = (): Service[] => {
  return services.filter((s) => s.enabled);
};

/**
 * Get service statistics
 */
export const getServiceStats = () => {
  const stats = {
    total: services.filter(s => s.enabled).length,
    byCategory: {} as Record<string, number>
  };

  services.filter(s => s.enabled).forEach(service => {
    stats.byCategory[service.category] = (stats.byCategory[service.category] || 0) + 1;
  });

  return stats;
};

/**
 * Category metadata
 */
export const categoryMetadata = {
  core: { label: 'Core Services', icon: '🏗️', description: 'Essential application services' },
  customer: { label: 'Customer Portal', icon: '👥', description: 'Customer-facing services and Supabase stack' },
  observability: { label: 'Observability', icon: '📊', description: 'Monitoring, logging, and tracing' },
  automation: { label: 'Automation', icon: '⚙️', description: 'Workflows and orchestration' },
  storage: { label: 'Storage', icon: '💾', description: 'Databases and object storage' },
  documentation: { label: 'Documentation', icon: '📖', description: 'Wiki and test reports' },
  ai: { label: 'AI Tools', icon: '🤖', description: 'AI and development tools' },
  mcp: { label: 'MCP Infrastructure', icon: '🔌', description: 'Model Context Protocol services' }
};
