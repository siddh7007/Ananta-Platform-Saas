/**
 * Complete Service Configuration - Components Platform V2
 * All 30+ microservices with health monitoring and credentials
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
  route?: string;
  healthEndpoint?: string;
  category: 'core' | 'observability' | 'automation' | 'storage' | 'documentation' | 'ai' | 'mcp';
  requiresSSO: boolean;
  color: string;
  credentials?: ServiceCredentials;
  port?: number;
  externalPort?: number;
  directPort?: number;
  internalPort?: number;
  directUrl?: string;
  enabled: boolean;
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
  }
};

const RAW_SERVICES: Service[] = [
  // ============================================================================
  // CORE APPLICATION SERVICES
  // ============================================================================
  {
    id: 'dashboard',
    name: 'Unified Dashboard',
    description: 'Main Control Panel (You are here)',
    icon: 'UD',
    url: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:27500',
    healthEndpoint: '/api/health',
    category: 'core',
    requiresSSO: false,  // Changed to false for /services page access
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    port: 27500,
    enabled: true
  },
  {
    id: 'backend',
    name: 'Django Backend',
    description: 'Main Application API',
    icon: 'BE',
    url: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:27500/backend',
    healthEndpoint: '/health/',
    category: 'core',
    requiresSSO: false,
    color: 'bg-green-500',
    port: 27200,
    enabled: true
  },
  {
    id: 'django-admin',
    name: 'Django Admin',
    description: 'Database Admin Interface',
    icon: 'DA',
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:27500/backend'}/admin/`,
    healthEndpoint: '/health/',
    category: 'core',
    requiresSSO: false,
    color: 'bg-emerald-600',
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
    icon: 'CC',
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:27500/backend',
    healthEndpoint: '/health/',
    category: 'core',
    requiresSSO: false,
    color: 'bg-blue-500',
    port: 27200,
    enabled: true
  },

  // ============================================================================
  // AUTHENTICATION & SECURITY
  // ============================================================================
  {
    id: 'keycloak',
    name: 'Keycloak SSO',
    description: 'Authentication & Identity Management',
    icon: 'KC',
    url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8180',
    healthEndpoint: '/health',
    category: 'core',
    requiresSSO: false,
    color: 'bg-red-600',
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
    icon: 'DX',
    url: process.env.NEXT_PUBLIC_DIRECTUS_URL || 'http://localhost:27060',
    healthEndpoint: '/server/health',
    category: 'core',
    requiresSSO: false,
    color: 'bg-purple-500',
    credentials: CREDENTIALS.directus,
    port: 27060,
    enabled: true
  },

  // ============================================================================
  // CNS (Component Normalization Service)
  // ============================================================================
  {
    id: 'cns-dashboard',
    name: 'CNS Dashboard',
    description: 'Component Normalization & Enrichment',
    icon: 'CN',
    url: process.env.NEXT_PUBLIC_CNS_DASHBOARD_URL || 'http://localhost:27810',
    healthEndpoint: '/',
    category: 'core',
    requiresSSO: false,
    color: 'bg-teal-500',
    port: 27810,
    enabled: true
  },
  {
    id: 'cns-api',
    name: 'CNS API',
    description: 'Component Normalization REST API',
    icon: 'CA',
    url: process.env.NEXT_PUBLIC_CNS_API_URL || 'http://localhost:27800',
    healthEndpoint: '/health',
    category: 'core',
    requiresSSO: false,
    color: 'bg-teal-600',
    port: 27800,
    enabled: true
  },
  {
    id: 'customer-portal',
    name: 'Customer Portal',
    description: 'BOM Upload & Enrichment Portal',
    icon: 'CP',
    url: process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL || 'http://localhost:27510',
    healthEndpoint: '/',
    category: 'core',
    requiresSSO: false,
    color: 'bg-blue-600',
    port: 27510,
    enabled: true
  },

  // ============================================================================
  // AI & DEVELOPMENT TOOLS
  // ============================================================================
  {
    id: 'code-server',
    name: 'VS Code Server',
    description: 'Browser-based IDE with password auth',
    icon: 'VS',
    url: process.env.NEXT_PUBLIC_CODE_SERVER_URL || 'http://localhost:27801',
    healthEndpoint: '/healthz',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-slate-600',
    credentials: {
      username: 'admin',
      password: 'admin123',
      loginUrl: '/',
      autoLogin: false
    },
    port: 27801,
    enabled: true
  },
  {
    id: 'langflow',
    name: 'Langflow',
    description: 'Visual AI Workflow Builder',
    icon: 'LF',
    url: process.env.NEXT_PUBLIC_LANGFLOW_URL || 'http://localhost:27500/langflow/',
    route: '/langflow/',
    externalPort: 27500,
    directUrl: 'http://localhost:27930',
    directPort: 27930,
    internalPort: 7860,
    healthEndpoint: '/api/v1/health',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-purple-600',
    port: 27930,
    enabled: true
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    description: 'ChatGPT-like AI Interface',
    icon: 'OW',
    url: process.env.NEXT_PUBLIC_OPEN_WEBUI_URL || 'http://localhost:27700',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-violet-600',
    port: 27700,
    enabled: false  // Currently exited
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local LLM Server',
    icon: 'OL',
    url: process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:27710',
    healthEndpoint: '/api/version',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-indigo-700',
    port: 27710,
    enabled: false  // Currently exited
  },

  // ============================================================================
  // WORKFLOW AUTOMATION
  // ============================================================================
  {
    id: 'n8n',
    name: 'n8n Workflows',
    description: 'Visual Workflow Automation',
    icon: 'N8',
    url: process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:27061',
    healthEndpoint: '/healthz',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-pink-500',
    credentials: CREDENTIALS.n8n,
    port: 27061,
    enabled: true
  },
  {
    id: 'temporal',
    name: 'Temporal',
    description: 'Durable Workflow Orchestration',
    icon: 'TP',
    url: process.env.NEXT_PUBLIC_TEMPORAL_URL || 'http://localhost:27021',
    healthEndpoint: '/',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-indigo-500',
    port: 27021,
    enabled: true
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    description: 'Message Queue & Events',
    icon: 'RM',
    url: process.env.NEXT_PUBLIC_RABBITMQ_URL || 'http://localhost:27252',
    healthEndpoint: '/api/health/checks/alarms',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-orange-600',
    credentials: CREDENTIALS.rabbitmq,
    port: 27252,
    enabled: true
  },

  // ============================================================================
  // CONTAINER MANAGEMENT
  // ============================================================================
  {
    id: 'portainer',
    name: 'Portainer',
    description: 'Docker Container Management',
    icon: 'PT',
    url: process.env.NEXT_PUBLIC_PORTAINER_URL || 'http://localhost:27500/portainer/',
    route: '/portainer/',
    externalPort: 27500,
    directUrl: 'http://localhost:27091',
    directPort: 27091,
    internalPort: 9000,
    healthEndpoint: '/api/system/status',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-cyan-600',
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
    icon: 'MN',
    url: process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:27041',
    healthEndpoint: '/minio/health/live',
    category: 'storage',
    requiresSSO: false,
    color: 'bg-red-500',
    credentials: CREDENTIALS.minio,
    port: 27041,
    enabled: true
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Primary Database',
    icon: 'PG',
    url: 'postgresql://localhost:27010',
    category: 'storage',
    requiresSSO: false,
    color: 'bg-blue-600',
    credentials: CREDENTIALS.postgres,
    port: 27010,
    enabled: false  // Database connection string, not a web URL
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Cache & Session Store',
    icon: 'RD',
    url: 'redis://localhost:27012',
    category: 'storage',
    requiresSSO: false,
    color: 'bg-red-600',
    port: 27012,
    enabled: false  // Database connection string, not a web URL
  },
  {
    id: 'meilisearch',
    name: 'MeiliSearch',
    description: 'Fast Search Engine',
    icon: 'MS',
    url: process.env.NEXT_PUBLIC_MEILISEARCH_URL || 'http://localhost:27042',
    healthEndpoint: '/health',
    category: 'storage',
    requiresSSO: false,
    color: 'bg-yellow-600',
    port: 27042,
    enabled: true
  },

  // ============================================================================
  // DOCUMENTATION & TESTING
  // ============================================================================
  {
    id: 'wiki',
    name: 'Wiki.js',
    description: 'Documentation & Knowledge Base (MCP: 13 tools)',
    icon: 'WK',
    url: process.env.NEXT_PUBLIC_WIKI_URL || 'http://localhost:27910',
    healthEndpoint: '/healthz',
    category: 'documentation',
    requiresSSO: false,
    color: 'bg-indigo-600',
    credentials: CREDENTIALS.wikijs,
    port: 27910,
    enabled: true
  },
  {
    id: 'allure',
    name: 'Allure Reports',
    description: 'Test Execution Reports',
    icon: 'AL',
    url: process.env.NEXT_PUBLIC_ALLURE_URL || 'http://localhost:27500/allure/',
    route: '/allure/',
    externalPort: 27500,
    directUrl: 'http://localhost:27920',
    directPort: 27920,
    internalPort: 5050,
    healthEndpoint: '/',
    category: 'documentation',
    requiresSSO: false,
    color: 'bg-yellow-600',
    port: 27920,
    enabled: true
  },

  // ============================================================================
  // OBSERVABILITY STACK
  // ============================================================================
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Metrics Visualization & Dashboards',
    icon: 'GF',
    url: process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:27082',
    healthEndpoint: '/api/health',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-orange-500',
    credentials: CREDENTIALS.grafana,
    port: 27082,
    enabled: true
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Metrics Collection & Storage',
    icon: 'PM',
    url: process.env.NEXT_PUBLIC_PROMETHEUS_URL || 'http://localhost:27080',
    healthEndpoint: '/-/healthy',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-yellow-500',
    port: 27080,
    enabled: true
  },
  {
    id: 'loki',
    name: 'Loki',
    description: 'Log Aggregation',
    icon: 'LK',
    url: process.env.NEXT_PUBLIC_LOKI_URL || 'http://localhost:27081',
    healthEndpoint: '/ready',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-green-600',
    port: 27081,
    enabled: true
  },
  {
    id: 'jaeger',
    name: 'Jaeger',
    description: 'Distributed Tracing',
    icon: 'JG',
    url: process.env.NEXT_PUBLIC_JAEGER_URL || 'http://localhost:27090',
    healthEndpoint: '/',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-cyan-500',
    port: 27090,
    enabled: true
  },
  {
    id: 'tempo',
    name: 'Tempo',
    description: 'Trace Storage Backend',
    icon: 'TE',
    url: process.env.NEXT_PUBLIC_TEMPO_URL || 'http://localhost:27500/tempo/',
    route: '/tempo/',
    externalPort: 27500,
    directUrl: 'http://localhost:27093',
    directPort: 27093,
    internalPort: 3200,
    healthEndpoint: '/status',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-purple-500',
    port: 27093,
    enabled: true
  },
  {
    id: 'promtail',
    name: 'Promtail',
    description: 'Log shipper forwarding to Loki',
    icon: 'PL',
    url: 'http://localhost:27500/promtail/',
    route: '/promtail/',
    externalPort: 27500,
    directUrl: 'http://promtail:9080',
    directPort: 9080,
    internalPort: 9080,
    healthEndpoint: '/ready',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-slate-600',
    port: 27090,
    enabled: true
  },

  // ============================================================================
  // BROWSER AUTOMATION
  // ============================================================================
  {
    id: 'selenium-hub',
    name: 'Selenium Grid',
    description: 'Browser Automation Hub',
    icon: 'SG',
    url: process.env.NEXT_PUBLIC_SELENIUM_URL || 'http://localhost:27500/selenium/hub',
    route: '/selenium/hub',
    externalPort: 27500,
    directUrl: 'http://localhost:27240',
    healthEndpoint: '/wd/hub/status',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-green-500',
    port: 27240,
    internalPort: 4444,
    enabled: true
  },
  {
    id: 'selenium-chrome',
    name: 'Chrome VNC Viewer',
    description: 'Watch Chrome automation live',
    icon: 'CH',
    url: 'http://localhost:27500/selenium/chrome/',
    route: '/selenium/chrome/',
    externalPort: 27500,
    directUrl: 'http://localhost:27244',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-blue-400',
    port: 27244,
    internalPort: 7900,
    enabled: true
  },
  {
    id: 'selenium-firefox',
    name: 'Firefox VNC Viewer',
    description: 'Watch Firefox automation live',
    icon: 'FX',
    url: 'http://localhost:27500/selenium/firefox/',
    route: '/selenium/firefox/',
    externalPort: 27500,
    directUrl: 'http://localhost:27246',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-orange-400',
    port: 27246,
    internalPort: 7900,
    enabled: true
  },

  // ============================================================================
  // MCP INFRASTRUCTURE
  // ============================================================================
  {
    id: 'mcp-gateway',
    name: 'MCP Gateway',
    description: 'Unified AI Tools API (71 tools)',
    icon: 'MG',
    url: 'http://localhost:27500/mcp',
    route: '/mcp/',
    externalPort: 27500,
    directUrl: 'http://localhost:27150',
    healthEndpoint: '/health',
    category: 'mcp',
    requiresSSO: false,
    color: 'bg-gradient-to-r from-blue-500 to-purple-500',
    port: 27150,
    enabled: true
  },
  {
    id: 'mcp-metrics',
    name: 'MCP Metrics',
    description: 'Gateway Prometheus Metrics',
    icon: 'MM',
    url: 'http://localhost:27150/metrics',
    category: 'mcp',
    requiresSSO: false,
    color: 'bg-yellow-500',
    port: 27150,
    enabled: true
  }
];

const decorateService = (service: Service): Service => {
  const normalized: Service = { ...service };

  const targetUrl = normalized.url;

  if (typeof targetUrl === 'string' && !targetUrl.includes('${')) {
    try {
      const parsedUrl = new URL(targetUrl);
      const isLocalhost = parsedUrl.hostname === 'localhost';
      const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');

      if (isLocalhost && port === '27500') {
        if (!normalized.externalPort) {
          normalized.externalPort = 27500;
        }

        if (!normalized.route) {
          const path = parsedUrl.pathname || '/';
          normalized.route = path.endsWith('/') ? path : `${path}/`;
        }
      }
    } catch {
      // Ignore parse errors for non-URL strings (e.g. env placeholders)
    }
  }

  if (normalized.port !== undefined && normalized.directPort === undefined) {
    normalized.directPort = normalized.port;
  }

  if (!normalized.directUrl && normalized.directPort !== undefined) {
    normalized.directUrl = `http://localhost:${normalized.directPort}`;
  }

  return normalized;
};

const cloneService = (service: Service): Service => ({
  ...service,
  credentials: service.credentials ? { ...service.credentials } : undefined,
});

const DECORATED_SERVICES: Service[] = RAW_SERVICES.map(decorateService);

export const services: Service[] = DECORATED_SERVICES.map(cloneService);

/**
 * Get service by ID
 */
export const getService = (id: string): Service | undefined => {
  const service = DECORATED_SERVICES.find((s) => s.id === id && s.enabled);
  return service ? cloneService(service) : undefined;
};

/**
 * Get services by category
 */
export const getServicesByCategory = (category: Service['category']): Service[] => {
  return DECORATED_SERVICES
    .filter((s) => s.category === category && s.enabled)
    .map(cloneService);
};

/**
 * Get all enabled services
 */
export const getEnabledServices = (): Service[] => {
  return DECORATED_SERVICES.filter((s) => s.enabled).map(cloneService);
};

/**
 * Check service health with timeout
 */
export const checkServiceHealth = async (service: Service): Promise<boolean> => {
  if (!service.healthEndpoint || !service.url.startsWith('http')) {
    return true; // Assume healthy if no health endpoint or not HTTP
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${service.url}${service.healthEndpoint}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache'
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error(`Health check failed for ${service.name}:`, error);
    return false;
  }
};

/**
 * Open service with auto-login support
 */
export const openService = (service: Service, token?: string): void => {
  if (service.credentials?.autoLogin && service.credentials.username && service.credentials.password) {
    // Open service with auto-login attempt
    openServiceWithAutoLogin(service);
  } else if (service.requiresSSO && token) {
    // For SSO-enabled services, pass the token
    window.open(`${service.url}?access_token=${token}`, '_blank');
  } else {
    // For services without auto-login, just open the URL
    window.open(service.url, '_blank');
  }
};

/**
 * Open service and attempt auto-login
 */
const openServiceWithAutoLogin = (service: Service): void => {
  const newWindow = window.open(service.url, '_blank');

  if (newWindow && service.credentials) {
    // Store credentials for the popup to use
    const credentials = {
      username: service.credentials.username,
      password: service.credentials.password,
      loginUrl: service.credentials.loginUrl
    };

    // Use localStorage to pass credentials (temporary)
    const key = `auto-login-${service.id}`;
    localStorage.setItem(key, JSON.stringify(credentials));

    // Clean up after 10 seconds
    setTimeout(() => localStorage.removeItem(key), 10000);
  }
};

/**
 * Get service statistics
 */
export const getServiceStats = () => {
  const enabled = DECORATED_SERVICES.filter((s) => s.enabled);
  const stats = {
    total: enabled.length,
    byCategory: {} as Record<string, number>
  };

  enabled.forEach((service) => {
    stats.byCategory[service.category] = (stats.byCategory[service.category] || 0) + 1;
  });

  return stats;
};



