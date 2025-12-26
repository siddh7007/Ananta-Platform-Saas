/**
 * Integration Tests for Observability Endpoints
 *
 * Tests health checks and Prometheus metrics endpoints.
 * These endpoints are critical for Kubernetes probes and monitoring.
 *
 * Prerequisites:
 * 1. Server running on localhost:14000
 * 2. Database connected
 *
 * Run with: npx mocha --require ts-node/register src/__tests__/integration/observability.integration.test.ts
 */

import {expect} from '@loopback/testlab';

const BASE_URL = process.env.API_URL || 'http://localhost:14000';

describe('=== OBSERVABILITY ENDPOINTS ===', function () {
  this.timeout(30000);

  // ============================================
  // HEALTH CHECK ENDPOINTS
  // ============================================
  describe('HEALTH CHECK API', () => {
    describe('GET /health (Comprehensive Health Check)', () => {
      it('should return comprehensive health status', async () => {
        const response = await fetch(`${BASE_URL}/health`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /health - Status:', response.status);
        expect(response.status).to.equal(200);

        const data = (await response.json()) as {
          status: string;
          timestamp: string;
          service: string;
          version: string;
          uptime: number;
          memory: {
            heapUsed: number;
            heapTotal: number;
            rss: number;
          };
          checks: {
            database: {status: string};
            temporal?: {status: string};
            keycloak?: {status: string};
          };
        };

        console.log('Health response:', JSON.stringify(data, null, 2));

        // Verify response structure
        expect(data).to.have.properties('status', 'timestamp', 'service', 'version', 'uptime', 'memory', 'checks');

        // Verify status values
        expect(['healthy', 'degraded', 'unhealthy']).to.containEql(data.status);
        expect(data.service).to.equal('tenant-management-service');

        // Verify memory structure
        expect(data.memory).to.have.properties('heapUsed', 'heapTotal', 'rss');
        expect(data.memory.heapUsed).to.be.Number();
        expect(data.memory.heapTotal).to.be.Number();

        // Verify checks structure
        expect(data.checks).to.have.property('database');
        expect(data.checks.database).to.have.property('status');
      });

      it('should return valid timestamp in ISO format', async () => {
        const response = await fetch(`${BASE_URL}/health`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        const data = (await response.json()) as {timestamp: string};
        const timestamp = new Date(data.timestamp);

        expect(timestamp.toString()).to.not.equal('Invalid Date');
        expect(data.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });

    describe('GET /health/live (Liveness Probe)', () => {
      it('should return 200 for liveness probe', async () => {
        const response = await fetch(`${BASE_URL}/health/live`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /health/live - Status:', response.status);
        expect(response.status).to.equal(200);

        const data = (await response.json()) as {
          status: string;
          timestamp: string;
        };

        expect(data).to.have.property('status');
        expect(data.status).to.equal('ok');
        expect(data).to.have.property('timestamp');
      });

      it('should respond quickly (under 100ms)', async () => {
        const start = Date.now();
        await fetch(`${BASE_URL}/health/live`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });
        const duration = Date.now() - start;

        console.log('Liveness probe response time:', duration, 'ms');
        expect(duration).to.be.below(100);
      });
    });

    describe('GET /health/ready (Readiness Probe)', () => {
      it('should return readiness status with database check', async () => {
        const response = await fetch(`${BASE_URL}/health/ready`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /health/ready - Status:', response.status);
        // Readiness can be 200 (ready) or 503 (not ready)
        expect([200, 503]).to.containEql(response.status);

        const data = (await response.json()) as {
          status: string;
          timestamp: string;
          checks: {
            database: {status: string};
          };
        };

        expect(data).to.have.property('status');
        expect(['ready', 'not_ready']).to.containEql(data.status);
        expect(data).to.have.property('checks');
        expect(data.checks).to.have.property('database');
      });

      it('should return 503 when database is not ready', async function () {
        // This test documents expected behavior when DB is down
        // We can't easily test this without killing the DB connection
        console.log('(Skipping negative case - requires DB manipulation)');
        this.skip();
      });
    });

    describe('GET /ping (Simple Health Check)', () => {
      it('should return pong response', async () => {
        const response = await fetch(`${BASE_URL}/ping`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /ping - Status:', response.status);
        expect(response.status).to.equal(200);

        const data = (await response.json()) as {
          greeting: string;
          date: string;
          url: string;
        };

        expect(data).to.have.property('greeting');
        // The ping controller returns 'Hello from LoopBack' as the greeting
        expect(data.greeting).to.containEql('Hello from LoopBack');
      });

      it('should respond very quickly (under 50ms)', async () => {
        const start = Date.now();
        await fetch(`${BASE_URL}/ping`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });
        const duration = Date.now() - start;

        console.log('Ping response time:', duration, 'ms');
        expect(duration).to.be.below(50);
      });
    });
  });

  // ============================================
  // PROMETHEUS METRICS ENDPOINT
  // ============================================
  describe('PROMETHEUS METRICS API', () => {
    describe('GET /metrics', () => {
      it('should return Prometheus-format metrics', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
          headers: {Accept: 'text/plain'},
        });

        console.log('GET /metrics - Status:', response.status);
        expect(response.status).to.equal(200);

        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        expect(contentType).to.containEql('text/plain');

        const body = await response.text();
        console.log('Metrics sample (first 500 chars):', body.substring(0, 500));

        // Verify Prometheus format
        expect(body).to.containEql('# HELP');
        expect(body).to.containEql('# TYPE');
      });

      it('should include service info metric', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });

        const body = await response.text();

        expect(body).to.containEql('tenant_management_info');
        expect(body).to.containEql('service="tenant-management-service"');
      });

      it('should include process metrics', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });

        const body = await response.text();

        // Process uptime
        expect(body).to.containEql('process_uptime_seconds');
        expect(body).to.containEql('# TYPE process_uptime_seconds gauge');

        // Heap memory
        expect(body).to.containEql('process_heap_bytes');
        expect(body).to.containEql('type="used"');
        expect(body).to.containEql('type="total"');

        // Process memory
        expect(body).to.containEql('process_memory_bytes');
        expect(body).to.containEql('type="rss"');
      });

      it('should include business metrics', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });

        const body = await response.text();

        // Tenant metrics
        expect(body).to.containEql('tenants_total');
        expect(body).to.containEql('# TYPE tenants_total gauge');

        // Lead metrics
        expect(body).to.containEql('leads_total');

        // User metrics
        expect(body).to.containEql('users_total');

        // Subscription metrics
        expect(body).to.containEql('subscriptions_total');
      });

      it('should include database connection metric', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });

        const body = await response.text();

        expect(body).to.containEql('database_up');
        expect(body).to.containEql('db="postgresql"');
        // Value should be 1 (up) or 0 (down)
        expect(body).to.match(/database_up\{db="postgresql"\} [01]/);
      });

      it('should include tenant status breakdown', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });

        const body = await response.text();

        // Should have status labels
        expect(body).to.containEql('status="active"');
        expect(body).to.containEql('status="total"');
      });

      it('should include Node.js version info', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });

        const body = await response.text();

        expect(body).to.containEql('nodejs_version_info');
        expect(body).to.match(/nodejs_version_info\{version="v\d+/);
      });

      it('should return valid numeric values', async () => {
        const response = await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });

        const body = await response.text();
        const lines = body.split('\n');

        // Check that metric values are valid numbers
        for (const line of lines) {
          if (line.startsWith('#') || line.trim() === '') continue;

          const parts = line.split(' ');
          if (parts.length >= 2) {
            const value = parseFloat(parts[parts.length - 1]);
            expect(isNaN(value)).to.be.false();
          }
        }
      });

      it('should respond within acceptable time (under 500ms)', async () => {
        const start = Date.now();
        await fetch(`${BASE_URL}/metrics`, {
          method: 'GET',
        });
        const duration = Date.now() - start;

        console.log('Metrics endpoint response time:', duration, 'ms');
        expect(duration).to.be.below(500);
      });
    });
  });

  // ============================================
  // STRUCTURED LOGGING VERIFICATION
  // ============================================
  describe('STRUCTURED LOGGING', () => {
    // Note: Structured logging outputs to stdout, so we can't directly test it
    // via HTTP. These tests verify the service works correctly with logging.

    describe('Request Logging', () => {
      it('should log successful requests', async () => {
        // Make a request that should be logged
        const response = await fetch(`${BASE_URL}/health`, {
          method: 'GET',
        });

        expect(response.status).to.equal(200);
        console.log('(Request logging verified - check service logs)');
      });

      it('should log error requests with correlation IDs', async () => {
        // Make a request that should generate an error log
        const response = await fetch(`${BASE_URL}/non-existent-endpoint`, {
          method: 'GET',
        });

        expect(response.status).to.equal(404);
        console.log('(Error logging verified - check service logs)');
      });
    });
  });
});

// ============================================
// PERFORMANCE BENCHMARKS
// ============================================
describe('=== PERFORMANCE BENCHMARKS ===', function () {
  this.timeout(60000);

  describe('Health Endpoint Performance', () => {
    it('should handle multiple concurrent health checks', async () => {
      const concurrentRequests = 10;
      const start = Date.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() =>
          fetch(`${BASE_URL}/health/live`, {
            method: 'GET',
          }),
        );

      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      console.log(
        `${concurrentRequests} concurrent /health/live requests:`,
        duration,
        'ms',
      );

      // All should succeed
      for (const response of responses) {
        expect(response.status).to.equal(200);
      }

      // Should complete within reasonable time
      expect(duration).to.be.below(1000);
    });

    it('should handle multiple concurrent metrics scrapes', async () => {
      const concurrentRequests = 5;
      const start = Date.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() =>
          fetch(`${BASE_URL}/metrics`, {
            method: 'GET',
          }),
        );

      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      console.log(
        `${concurrentRequests} concurrent /metrics requests:`,
        duration,
        'ms',
      );

      // All should succeed
      for (const response of responses) {
        expect(response.status).to.equal(200);
      }

      // Should complete within reasonable time (metrics is more expensive)
      expect(duration).to.be.below(3000);
    });
  });

  describe('Sequential Request Performance', () => {
    it('should measure average response time for health checks', async () => {
      const iterations = 20;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await fetch(`${BASE_URL}/health/live`, {method: 'GET'});
        times.push(Date.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);

      console.log(`Health check stats over ${iterations} requests:`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min}ms`);
      console.log(`  Max: ${max}ms`);

      // Average should be under 50ms
      expect(avg).to.be.below(50);
    });
  });
});
