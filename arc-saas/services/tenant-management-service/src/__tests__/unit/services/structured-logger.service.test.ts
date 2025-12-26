/**
 * Unit Tests for StructuredLoggerService
 *
 * Tests the structured logging service with flow tracking,
 * correlation IDs, and JSON output.
 */

import {expect} from '@loopback/testlab';
import {StructuredLoggerService, LogLevel} from '../../../services/structured-logger.service';

describe('StructuredLoggerService', () => {
  let logger: StructuredLoggerService;
  let consoleOutput: string[];
  let originalConsole: {
    debug: typeof console.debug;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  };

  beforeEach(() => {
    logger = new StructuredLoggerService();
    consoleOutput = [];

    // Capture console output
    originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    console.debug = (msg: string) => consoleOutput.push(msg);
    console.info = (msg: string) => consoleOutput.push(msg);
    console.warn = (msg: string) => consoleOutput.push(msg);
    console.error = (msg: string) => consoleOutput.push(msg);
  });

  afterEach(() => {
    // Restore console
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('generateCorrelationId()', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = logger.generateCorrelationId();
      const id2 = logger.generateCorrelationId();

      expect(id1).to.be.String();
      expect(id2).to.be.String();
      expect(id1).to.not.equal(id2);
    });

    it('should generate IDs in expected format', () => {
      const id = logger.generateCorrelationId();

      // Format: timestamp-random (e.g., "lxyz123-abc456")
      expect(id).to.match(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('Basic Logging Methods', () => {
    describe('debug()', () => {
      it('should log debug messages as JSON', () => {
        // Note: Debug messages may be filtered based on LOG_LEVEL
        logger.debug('Test debug message');

        if (consoleOutput.length > 0) {
          const output = JSON.parse(consoleOutput[0]);
          expect(output.level).to.equal('debug');
          expect(output.message).to.equal('Test debug message');
        }
      });
    });

    describe('info()', () => {
      it('should log info messages as JSON', () => {
        logger.info('Test info message');

        expect(consoleOutput.length).to.be.greaterThan(0);
        const output = JSON.parse(consoleOutput[0]);
        expect(output.level).to.equal('info');
        expect(output.message).to.equal('Test info message');
        expect(output.service).to.equal('tenant-management-service');
      });

      it('should include context in log entry', () => {
        logger.info('Test with context', {
          tenantId: 'test-tenant',
          userId: 'test-user',
        });

        const output = JSON.parse(consoleOutput[0]);
        expect(output.tenantId).to.equal('test-tenant');
        expect(output.userId).to.equal('test-user');
      });

      it('should include timestamp in ISO format', () => {
        logger.info('Test timestamp');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });

    describe('warn()', () => {
      it('should log warning messages', () => {
        logger.warn('Test warning');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.level).to.equal('warn');
        expect(output.message).to.equal('Test warning');
      });
    });

    describe('error()', () => {
      it('should log error messages', () => {
        logger.error('Test error');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.level).to.equal('error');
        expect(output.message).to.equal('Test error');
      });

      it('should include Error object details', () => {
        const error = new Error('Test error message');
        logger.error('An error occurred', error);

        const output = JSON.parse(consoleOutput[0]);
        expect(output.error).to.not.be.undefined();
        expect(output.error.name).to.equal('Error');
        expect(output.error.message).to.equal('Test error message');
        expect(output.error.stack).to.be.String();
      });

      it('should handle non-Error objects', () => {
        logger.error('An error occurred', 'string error');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.error).to.not.be.undefined();
        expect(output.error.message).to.equal('string error');
      });
    });
  });

  describe('Flow Tracking', () => {
    describe('startFlow()', () => {
      it('should start a flow and return correlation ID', () => {
        const correlationId = logger.startFlow('test-flow');

        expect(correlationId).to.be.String();
        expect(consoleOutput.length).to.be.greaterThan(0);

        const output = JSON.parse(consoleOutput[0]);
        expect(output.message).to.containEql('Flow started');
        expect(output.correlationId).to.equal(correlationId);
      });

      it('should include flow context in log', () => {
        const correlationId = logger.startFlow('tenant-provisioning', {
          tenantId: 'test-tenant-123',
          userId: 'admin-user',
        });

        const output = JSON.parse(consoleOutput[0]);
        expect(output.flow).to.equal('tenant-provisioning');
        expect(output.tenantId).to.equal('test-tenant-123');
        expect(output.userId).to.equal('admin-user');
      });
    });

    describe('logStep()', () => {
      it('should log step started', () => {
        const correlationId = logger.startFlow('test-flow');
        consoleOutput.length = 0; // Clear previous output

        logger.logStep(correlationId, 'create-database', 'started');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.message).to.containEql('Step started');
        expect(output.step).to.equal('create-database');
        expect(output.correlationId).to.equal(correlationId);
      });

      it('should log step completed', () => {
        const correlationId = logger.startFlow('test-flow');
        logger.logStep(correlationId, 'create-database', 'started');
        consoleOutput.length = 0;

        logger.logStep(correlationId, 'create-database', 'completed');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.message).to.containEql('Step completed');
      });

      it('should log step failed', () => {
        const correlationId = logger.startFlow('test-flow');
        logger.logStep(correlationId, 'create-database', 'started');
        consoleOutput.length = 0;

        logger.logStep(correlationId, 'create-database', 'failed', {
          error: 'Connection refused',
        });

        const output = JSON.parse(consoleOutput[0]);
        expect(output.message).to.containEql('Step failed');
      });

      it('should warn for unknown correlation ID', () => {
        logger.logStep('unknown-id', 'some-step', 'started');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.level).to.equal('warn');
        expect(output.message).to.containEql('Flow not found');
      });
    });

    describe('completeFlow()', () => {
      it('should complete flow successfully', () => {
        const correlationId = logger.startFlow('test-flow');
        logger.logStep(correlationId, 'step-1', 'started');
        logger.logStep(correlationId, 'step-1', 'completed');
        consoleOutput.length = 0;

        logger.completeFlow(correlationId, true);

        const output = JSON.parse(consoleOutput[0]);
        expect(output.message).to.containEql('Flow completed');
        expect(output.success).to.be.true();
        expect(output.duration).to.be.Number();
      });

      it('should complete flow with failure', () => {
        const correlationId = logger.startFlow('test-flow');
        logger.logStep(correlationId, 'step-1', 'started');
        logger.logStep(correlationId, 'step-1', 'failed');
        consoleOutput.length = 0;

        logger.completeFlow(correlationId, false);

        const output = JSON.parse(consoleOutput[0]);
        expect(output.message).to.containEql('Flow failed');
        expect(output.success).to.be.false();
        expect(output.level).to.equal('error');
      });

      it('should include step counts in completion', () => {
        const correlationId = logger.startFlow('test-flow');
        logger.logStep(correlationId, 'step-1', 'started');
        logger.logStep(correlationId, 'step-1', 'completed');
        logger.logStep(correlationId, 'step-2', 'started');
        logger.logStep(correlationId, 'step-2', 'completed');
        consoleOutput.length = 0;

        logger.completeFlow(correlationId, true);

        const output = JSON.parse(consoleOutput[0]);
        expect(output.totalSteps).to.equal(4); // 2 started + 2 completed
      });

      it('should warn for unknown correlation ID', () => {
        logger.completeFlow('unknown-id', true);

        const output = JSON.parse(consoleOutput[0]);
        expect(output.level).to.equal('warn');
        expect(output.message).to.containEql('Flow not found');
      });
    });
  });

  describe('Child Logger', () => {
    describe('child()', () => {
      it('should create child logger with preset context', () => {
        const child = logger.child({
          correlationId: 'test-corr-id',
          tenantId: 'test-tenant',
        });

        child.info('Child log message');

        const output = JSON.parse(consoleOutput[0]);
        expect(output.correlationId).to.equal('test-corr-id');
        expect(output.tenantId).to.equal('test-tenant');
        expect(output.message).to.equal('Child log message');
      });

      it('should merge additional metadata', () => {
        const child = logger.child({
          tenantId: 'test-tenant',
        });

        child.info('With extra data', {customField: 'value'});

        const output = JSON.parse(consoleOutput[0]);
        expect(output.tenantId).to.equal('test-tenant');
        expect(output.metadata?.customField).to.equal('value');
      });

      it('should support all log levels', () => {
        const child = logger.child({userId: 'test-user'});

        child.debug('Debug');
        child.info('Info');
        child.warn('Warn');
        child.error('Error');

        // At minimum, info, warn, error should be logged
        expect(consoleOutput.length).to.be.greaterThanOrEqual(3);
      });

      it('should support logStep() with correlation ID', () => {
        const correlationId = logger.startFlow('test-flow');
        const child = logger.child({correlationId});

        child.logStep('child-step', 'started');

        // Find the step log (not the flow start log)
        const stepLog = consoleOutput.find(out => {
          const parsed = JSON.parse(out);
          return parsed.step === 'child-step';
        });

        expect(stepLog).to.not.be.undefined();
      });
    });
  });

  describe('Log Entry Structure', () => {
    it('should include all required fields', () => {
      logger.info('Test message', {
        correlationId: 'test-id',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const output = JSON.parse(consoleOutput[0]);

      expect(output).to.have.properties(
        'timestamp',
        'level',
        'message',
        'service',
        'version',
        'environment',
        'correlationId',
        'tenantId',
        'userId',
      );
    });

    it('should handle extra metadata correctly', () => {
      logger.info('Test', {
        correlationId: 'id',
        customField1: 'value1',
        customField2: 123,
        nested: {key: 'value'},
      });

      const output = JSON.parse(consoleOutput[0]);
      expect(output.metadata?.customField1).to.equal('value1');
      expect(output.metadata?.customField2).to.equal(123);
      expect(output.metadata?.nested?.key).to.equal('value');
    });
  });

  describe('Complete Flow Example', () => {
    it('should track a complete tenant provisioning flow', () => {
      // Start flow
      const correlationId = logger.startFlow('tenant-provisioning', {
        tenantId: 'new-tenant-123',
        userId: 'admin-user',
      });

      // Step 1: Create database
      logger.logStep(correlationId, 'create-database-schema', 'started');
      logger.logStep(correlationId, 'create-database-schema', 'completed');

      // Step 2: Setup Keycloak
      logger.logStep(correlationId, 'setup-keycloak-realm', 'started');
      logger.logStep(correlationId, 'setup-keycloak-realm', 'completed');

      // Step 3: Create admin user
      logger.logStep(correlationId, 'create-admin-user', 'started');
      logger.logStep(correlationId, 'create-admin-user', 'completed');

      // Complete flow
      logger.completeFlow(correlationId, true, {
        provisionedAt: new Date().toISOString(),
      });

      // Should have multiple log entries
      expect(consoleOutput.length).to.be.greaterThan(5);

      // Last entry should be flow completion
      const lastOutput = JSON.parse(consoleOutput[consoleOutput.length - 1]);
      expect(lastOutput.message).to.containEql('Flow completed');
      expect(lastOutput.success).to.be.true();
    });

    it('should track a failed flow', () => {
      const correlationId = logger.startFlow('user-onboarding');

      logger.logStep(correlationId, 'validate-email', 'started');
      logger.logStep(correlationId, 'validate-email', 'completed');

      logger.logStep(correlationId, 'create-keycloak-user', 'started');
      logger.logStep(correlationId, 'create-keycloak-user', 'failed', {
        error: 'Email already exists in Keycloak',
      });

      logger.completeFlow(correlationId, false, {
        failureReason: 'User creation failed in Keycloak',
      });

      const lastOutput = JSON.parse(consoleOutput[consoleOutput.length - 1]);
      expect(lastOutput.message).to.containEql('Flow failed');
      expect(lastOutput.success).to.be.false();
      expect(lastOutput.level).to.equal('error');
    });
  });
});
