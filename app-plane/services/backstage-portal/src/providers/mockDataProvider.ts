import { DataProvider } from 'react-admin';
import { services } from '../config/services';

/**
 * Mock Data Provider for Demo/Testing
 *
 * Returns fake data to allow UI testing without Supabase backend
 * Supports: components, boms, alerts, containers, platform-services
 */

// Sample data
const mockComponents = [
  {
    id: 1,
    manufacturer_part_number: 'CAP-001',
    manufacturer: 'Murata',
    category: 'Capacitors',
    description: '10uF Ceramic Capacitor',
    risk_level: 'GREEN',
    lifecycle_status: 'ACTIVE',
    rohs_compliant: 'COMPLIANT',
    unit_price: 0.15,
    stock_quantity: 1000,
    moq: 100,
  },
  {
    id: 2,
    manufacturer_part_number: 'RES-001',
    manufacturer: 'Yageo',
    category: 'Resistors',
    description: '10K Ohm Resistor',
    risk_level: 'YELLOW',
    lifecycle_status: 'NRND',
    rohs_compliant: 'COMPLIANT',
    unit_price: 0.05,
    stock_quantity: 500,
    moq: 1000,
  },
  {
    id: 3,
    manufacturer_part_number: 'IC-001',
    manufacturer: 'Texas Instruments',
    category: 'ICs',
    description: 'Microcontroller',
    risk_level: 'ORANGE',
    lifecycle_status: 'EOL',
    rohs_compliant: 'COMPLIANT',
    unit_price: 5.00,
    stock_quantity: 50,
    moq: 25,
  },
  {
    id: 4,
    manufacturer_part_number: 'CONN-001',
    manufacturer: 'Molex',
    category: 'Connectors',
    description: 'USB Connector',
    risk_level: 'RED',
    lifecycle_status: 'OBSOLETE',
    rohs_compliant: 'NON_COMPLIANT',
    unit_price: 2.50,
    stock_quantity: 0,
    moq: 100,
  },
];

const mockBOMs = [
  {
    id: 1,
    name: 'Production Board v1.0',
    version: '1.0',
    description: 'Main production board',
    grade: 'B',
    status: 'COMPLETED',
    component_count: 25,
    total_cost: 125.50,
    high_risk_count: 2,
    medium_risk_count: 5,
    low_risk_count: 18,
  },
  {
    id: 2,
    name: 'Test Board v1.0',
    version: '1.0',
    description: 'Testing board',
    grade: 'C',
    status: 'ANALYZING',
    component_count: 10,
    total_cost: 45.00,
    high_risk_count: 5,
    medium_risk_count: 3,
    low_risk_count: 2,
  },
];

const mockAlerts = [
  {
    id: 1,
    component_id: 3,
    severity: 'HIGH',
    alert_type: 'LIFECYCLE',
    title: 'Component Entering EOL',
    message: 'IC-001 has been marked as End of Life. Consider finding alternatives.',
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    component_id: 4,
    severity: 'CRITICAL',
    alert_type: 'RISK',
    title: 'Component Obsolete',
    message: 'CONN-001 is obsolete and no longer available from manufacturer.',
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    component_id: 2,
    severity: 'MEDIUM',
    alert_type: 'LIFECYCLE',
    title: 'Component NRND',
    message: 'RES-001 is Not Recommended for New Designs.',
    is_read: true,
    created_at: new Date().toISOString(),
  },
];

// Mock Docker containers
const mockContainers = [
  {
    id: '1',
    Name: 'components-v2-backend',
    Service: 'backend',
    State: 'running',
    Status: 'Up 2 hours',
    Id: 'abc123',
    stats: {
      cpu_percent: 12.5,
      memory_usage_mb: 512,
      memory_limit_mb: 2048,
      memory_percent: 25.0,
      network_rx_bytes: 104857600, // 100 MB
      network_tx_bytes: 52428800,  // 50 MB
    }
  },
  {
    id: '2',
    Name: 'components-v2-dashboard',
    Service: 'dashboard',
    State: 'running',
    Status: 'Up 2 hours (healthy)',
    Id: 'def456',
    stats: {
      cpu_percent: 5.2,
      memory_usage_mb: 256,
      memory_limit_mb: 512,
      memory_percent: 50.0,
      network_rx_bytes: 52428800,
      network_tx_bytes: 26214400,
    }
  },
  {
    id: '3',
    Name: 'components-v2-grafana',
    Service: 'grafana',
    State: 'running',
    Status: 'Up 2 hours (healthy)',
    Id: 'ghi789',
    stats: {
      cpu_percent: 8.7,
      memory_usage_mb: 384,
      memory_limit_mb: 1024,
      memory_percent: 37.5,
      network_rx_bytes: 31457280,
      network_tx_bytes: 15728640,
    }
  },
  {
    id: '4',
    Name: 'components-v2-postgres',
    Service: 'postgres',
    State: 'running',
    Status: 'Up 2 hours',
    Id: 'jkl012',
    stats: {
      cpu_percent: 3.1,
      memory_usage_mb: 768,
      memory_limit_mb: 2048,
      memory_percent: 37.5,
      network_rx_bytes: 10485760,
      network_tx_bytes: 5242880,
    }
  },
  {
    id: '5',
    Name: 'components-v2-redis',
    Service: 'redis',
    State: 'exited',
    Status: 'Exited (0) 30 minutes ago',
    Id: 'mno345',
  },
];

// Platform services - use actual service configuration
const mockPlatformServices = services.filter(s => s.enabled).map((s, index) => ({
  ...s,
  id: s.id
}));

export const mockDataProvider: DataProvider = {
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const { filter } = params;

    let data: any[] = [];
    if (resource === 'components') data = [...mockComponents];
    else if (resource === 'boms') data = [...mockBOMs];
    else if (resource === 'alerts') data = [...mockAlerts];
    else if (resource === 'containers') data = [...mockContainers];
    else if (resource === 'platform-services') data = [...mockPlatformServices];

    // Apply filters
    if (filter && Object.keys(filter).length > 0) {
      data = data.filter(item => {
        return Object.entries(filter).every(([key, value]) => {
          if (key === 'q') {
            // Search across multiple fields
            const searchStr = String(value).toLowerCase();
            return Object.values(item).some(v =>
              String(v).toLowerCase().includes(searchStr)
            );
          }
          return item[key] === value;
        });
      });
    }

    return {
      data,
      total: data.length,
    };
  },

  getOne: async (resource, params) => {
    let data: any[] = [];
    if (resource === 'components') data = mockComponents;
    else if (resource === 'boms') data = mockBOMs;
    else if (resource === 'alerts') data = mockAlerts;
    else if (resource === 'containers') data = mockContainers;
    else if (resource === 'platform-services') data = mockPlatformServices;

    const item = data.find(d => String(d.id) === String(params.id));
    if (!item) throw new Error('Not found');
    return { data: item };
  },

  getMany: async (resource, params) => {
    let data: any[] = [];
    if (resource === 'components') data = mockComponents;
    else if (resource === 'boms') data = mockBOMs;
    else if (resource === 'alerts') data = mockAlerts;
    else if (resource === 'containers') data = mockContainers;
    else if (resource === 'platform-services') data = mockPlatformServices;

    return { data: data.filter(d => params.ids.includes(d.id)) };
  },

  getManyReference: async (resource, params) => {
    return { data: [], total: 0 };
  },

  create: async (resource, params) => {
    // Cast to any to satisfy generic DataProvider typings
    return { data: { ...params.data, id: Math.random() } } as any;
  },

  update: async (resource, params) => {
    return { data: params.data } as any;
  },

  updateMany: async (resource, params) => {
    return { data: params.ids };
  },

  delete: async (resource, params) => {
    return { data: params.previousData };
  },

  deleteMany: async (resource, params) => {
    return { data: params.ids };
  },
};
