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
  healthEndpoint?: string;
  category: 'core' | 'observability' | 'automation' | 'storage' | 'documentation' | 'ai' | 'mcp';
  requiresSSO: boolean;
  color: string;
  credentials?: ServiceCredentials;
  port?: number;
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
    loginUrl: '/signin',
    autoLogin: true
  }
};

export const services: Service[] = [
  // ============================================================================
  // CORE APPLICATION SERVICES
  // ============================================================================
  {
    id: 'dashboard',
    name: 'Unified Dashboard',
    description: 'Main Control Panel (You are here)',
    icon: '🎛️',
    url: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:27130',
    healthEndpoint: '/api/health',
    category: 'core',
    requiresSSO: true,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    port: 27130,
    enabled: true
  },
  {
    id: 'backend',
    name: 'Django Backend',
    description: 'Main Application API',
    icon: '🔧',
    url: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:27120',
    healthEndpoint: '/health/',
    category: 'core',
    requiresSSO: false,
    color: 'bg-green-500',
    port: 27120,
    enabled: true
  },
  {
    id: 'django-admin',
    name: 'Django Admin',
    description: 'Database Admin Interface',
    icon: '⚙️',
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:27120'}/admin/`,
    category: 'core',
    requiresSSO: false,
    color: 'bg-emerald-600',
    credentials: {
      username: 'admin',
      password: 'admin',
      loginUrl: '/admin/login/',
      autoLogin: true
    },
    port: 27120,
    enabled: true
  },
  {
    id: 'frontend',
    name: 'Component Catalog UI',
    description: 'Component Management Interface',
    icon: '📦',
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:27200',
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
    icon: '🔐',
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
    icon: '📝',
    url: process.env.NEXT_PUBLIC_DIRECTUS_URL || 'http://localhost:27014',
    healthEndpoint: '/server/health',
    category: 'core',
    requiresSSO: false,
    color: 'bg-purple-500',
    credentials: CREDENTIALS.directus,
    port: 27014,
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
    url: process.env.NEXT_PUBLIC_CODE_SERVER_URL || 'http://localhost:27140',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-slate-600',
    port: 27140,
    enabled: true
  },
  {
    id: 'langflow',
    name: 'Langflow',
    description: 'Visual AI Workflow Builder',
    icon: '🤖',
    url: process.env.NEXT_PUBLIC_LANGFLOW_URL || 'http://localhost:27060',
    healthEndpoint: '/api/v1/health',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-purple-600',
    port: 27060,
    enabled: true
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    description: 'ChatGPT-like AI Interface',
    icon: '💬',
    url: process.env.NEXT_PUBLIC_OPEN_WEBUI_URL || 'http://localhost:27070',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-violet-600',
    port: 27070,
    enabled: true
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local LLM Server',
    icon: '🧠',
    url: process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434',
    healthEndpoint: '/api/version',
    category: 'ai',
    requiresSSO: false,
    color: 'bg-indigo-700',
    port: 11434,
    enabled: true
  },

  // ============================================================================
  // WORKFLOW AUTOMATION
  // ============================================================================
  {
    id: 'n8n',
    name: 'n8n Workflows',
    description: 'Visual Workflow Automation',
    icon: '🔄',
    url: process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:27020',
    healthEndpoint: '/healthz',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-pink-500',
    credentials: CREDENTIALS.n8n,
    port: 27020,
    enabled: true
  },
  {
    id: 'temporal',
    name: 'Temporal',
    description: 'Durable Workflow Orchestration',
    icon: '⏱️',
    url: process.env.NEXT_PUBLIC_TEMPORAL_URL || 'http://localhost:27050',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-indigo-500',
    port: 27050,
    enabled: true
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    description: 'Message Queue & Events',
    icon: '🐰',
    url: process.env.NEXT_PUBLIC_RABBITMQ_URL || 'http://localhost:27030',
    healthEndpoint: '/api/health/checks/alarms',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-orange-600',
    credentials: CREDENTIALS.rabbitmq,
    port: 27030,
    enabled: true
  },

  // ============================================================================
  // CONTAINER MANAGEMENT
  // ============================================================================
  {
    id: 'portainer',
    name: 'Portainer',
    description: 'Docker Container Management',
    icon: '🐳',
    url: process.env.NEXT_PUBLIC_PORTAINER_URL || 'http://localhost:27040',
    healthEndpoint: '/api/system/status',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-cyan-600',
    credentials: CREDENTIALS.portainer,
    port: 27040,
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
    url: process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:27013',
    healthEndpoint: '/minio/health/live',
    category: 'storage',
    requiresSSO: false,
    color: 'bg-red-500',
    credentials: CREDENTIALS.minio,
    port: 27013,
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
    color: 'bg-blue-600',
    credentials: CREDENTIALS.postgres,
    port: 27010,
    enabled: true
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Cache & Session Store',
    icon: '🔴',
    url: 'redis://localhost:27012',
    category: 'storage',
    requiresSSO: false,
    color: 'bg-red-600',
    port: 27012,
    enabled: true
  },
  {
    id: 'meilisearch',
    name: 'MeiliSearch',
    description: 'Fast Search Engine',
    icon: '🔍',
    url: process.env.NEXT_PUBLIC_MEILISEARCH_URL || 'http://localhost:27018',
    healthEndpoint: '/health',
    category: 'storage',
    requiresSSO: false,
    color: 'bg-yellow-600',
    port: 27018,
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
    url: process.env.NEXT_PUBLIC_WIKI_URL || 'http://localhost:27045',
    healthEndpoint: '/healthz',
    category: 'documentation',
    requiresSSO: true,
    color: 'bg-indigo-600',
    port: 27045,
    enabled: true
  },
  {
    id: 'allure',
    name: 'Allure Reports',
    description: 'Test Execution Reports',
    icon: '🧪',
    url: process.env.NEXT_PUBLIC_ALLURE_URL || 'http://localhost:27110',
    category: 'documentation',
    requiresSSO: false,
    color: 'bg-yellow-600',
    port: 27110,
    enabled: true
  },

  // ============================================================================
  // OBSERVABILITY STACK
  // ============================================================================
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Metrics Visualization & Dashboards',
    icon: '📊',
    url: process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:27081',
    healthEndpoint: '/api/health',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-orange-500',
    credentials: CREDENTIALS.grafana,
    port: 27081,
    enabled: true
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Metrics Collection & Storage',
    icon: '📈',
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
    icon: '📝',
    url: process.env.NEXT_PUBLIC_LOKI_URL || 'http://localhost:27082',
    healthEndpoint: '/ready',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-green-600',
    port: 27082,
    enabled: true
  },
  {
    id: 'jaeger',
    name: 'Jaeger',
    description: 'Distributed Tracing',
    icon: '🔬',
    url: process.env.NEXT_PUBLIC_JAEGER_URL || 'http://localhost:27090',
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
    icon: '⚡',
    url: process.env.NEXT_PUBLIC_TEMPO_URL || 'http://localhost:27093',
    category: 'observability',
    requiresSSO: false,
    color: 'bg-purple-500',
    port: 27093,
    enabled: true
  },

  // ============================================================================
  // BROWSER AUTOMATION
  // ============================================================================
  {
    id: 'selenium-grid',
    name: 'Selenium Grid',
    description: 'Browser Automation Hub',
    icon: '🌐',
    url: process.env.NEXT_PUBLIC_SELENIUM_URL || 'http://localhost:27240',
    healthEndpoint: '/wd/hub/status',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-green-500',
    port: 27240,
    enabled: true
  },
  {
    id: 'selenium-vnc-chrome',
    name: 'Chrome VNC Viewer',
    description: 'Watch Chrome automation live',
    icon: '👁️',
    url: 'http://localhost:27244',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-blue-400',
    port: 27244,
    enabled: true
  },
  {
    id: 'selenium-vnc-firefox',
    name: 'Firefox VNC Viewer',
    description: 'Watch Firefox automation live',
    icon: '🦊',
    url: 'http://localhost:27246',
    category: 'automation',
    requiresSSO: false,
    color: 'bg-orange-400',
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
    color: 'bg-gradient-to-r from-blue-500 to-purple-500',
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
    color: 'bg-yellow-500',
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
  const stats = {
    total: services.filter(s => s.enabled).length,
    byCategory: {} as Record<string, number>
  };

  services.filter(s => s.enabled).forEach(service => {
    stats.byCategory[service.category] = (stats.byCategory[service.category] || 0) + 1;
  });

  return stats;
};
