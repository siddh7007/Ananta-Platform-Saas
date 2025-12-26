import {expect} from '@loopback/testlab';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../../models/notification-preference.model';

/**
 * Unit tests for NovuNotificationService business logic
 *
 * Note: These tests focus on the business logic that can be tested
 * without mocking the entire LoopBack infrastructure or Novu SDK.
 */
describe('NovuNotificationService (Unit Tests)', () => {
  describe('NotificationPreference Model', () => {
    describe('getEnabledChannels', () => {
      it('should return empty array when all channels disabled', () => {
        const pref = new NotificationPreference({
          tenantId: 'test-tenant-id',
          category: NotificationCategory.BILLING,
          emailEnabled: false,
          smsEnabled: false,
          pushEnabled: false,
          inAppEnabled: false,
          webhookEnabled: false,
        });
        expect(pref.getEnabledChannels()).to.deepEqual([]);
      });

      it('should return all enabled channels', () => {
        const pref = new NotificationPreference({
          tenantId: 'test-tenant-id',
          category: NotificationCategory.BILLING,
          emailEnabled: true,
          smsEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          webhookEnabled: true,
        });
        const channels = pref.getEnabledChannels();
        expect(channels).to.containDeep([
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.PUSH,
          NotificationChannel.IN_APP,
          NotificationChannel.WEBHOOK,
        ]);
        expect(channels.length).to.equal(5);
      });

      it('should return only email and in_app by default', () => {
        const pref = new NotificationPreference({
          tenantId: 'test-tenant-id',
          category: NotificationCategory.BILLING,
          emailEnabled: true,
          smsEnabled: false,
          pushEnabled: false,
          inAppEnabled: true,
          webhookEnabled: false,
        });
        const channels = pref.getEnabledChannels();
        expect(channels).to.containDeep([
          NotificationChannel.EMAIL,
          NotificationChannel.IN_APP,
        ]);
        expect(channels.length).to.equal(2);
      });
    });

    describe('isChannelEnabled', () => {
      it('should return true for enabled email channel', () => {
        const pref = new NotificationPreference({
          tenantId: 'test-tenant-id',
          category: NotificationCategory.BILLING,
          emailEnabled: true,
        });
        expect(pref.isChannelEnabled(NotificationChannel.EMAIL)).to.be.true();
      });

      it('should return false for disabled SMS channel', () => {
        const pref = new NotificationPreference({
          tenantId: 'test-tenant-id',
          category: NotificationCategory.BILLING,
          smsEnabled: false,
        });
        expect(pref.isChannelEnabled(NotificationChannel.SMS)).to.be.false();
      });

      it('should use defaults when channel property is undefined', () => {
        const pref = new NotificationPreference({
          tenantId: 'test-tenant-id',
          category: NotificationCategory.BILLING,
        });
        // Email and in_app default to true
        expect(pref.isChannelEnabled(NotificationChannel.EMAIL)).to.be.true();
        expect(pref.isChannelEnabled(NotificationChannel.IN_APP)).to.be.true();
        // SMS, push, webhook default to false
        expect(pref.isChannelEnabled(NotificationChannel.SMS)).to.be.false();
        expect(pref.isChannelEnabled(NotificationChannel.PUSH)).to.be.false();
        expect(pref.isChannelEnabled(NotificationChannel.WEBHOOK)).to.be.false();
      });
    });
  });

  describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
    it('should have all notification categories defined', () => {
      const categories = Object.values(NotificationCategory);
      expect(Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).length).to.equal(
        categories.length,
      );
      for (const category of categories) {
        expect(DEFAULT_NOTIFICATION_PREFERENCES).to.have.property(category);
      }
    });

    it('should enable email and in_app by default for all categories', () => {
      for (const category of Object.values(NotificationCategory)) {
        const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
        expect(defaults.emailEnabled).to.be.true();
        expect(defaults.inAppEnabled).to.be.true();
      }
    });

    it('should disable push and webhook by default for all categories', () => {
      for (const category of Object.values(NotificationCategory)) {
        const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
        expect(defaults.pushEnabled).to.be.false();
        expect(defaults.webhookEnabled).to.be.false();
      }
    });

    it('should enable SMS for security category (for MFA)', () => {
      expect(
        DEFAULT_NOTIFICATION_PREFERENCES[NotificationCategory.SECURITY].smsEnabled,
      ).to.be.true();
    });

    it('should disable SMS for non-security categories by default', () => {
      const nonSecurityCategories = Object.values(NotificationCategory).filter(
        c => c !== NotificationCategory.SECURITY,
      );
      for (const category of nonSecurityCategories) {
        expect(DEFAULT_NOTIFICATION_PREFERENCES[category].smsEnabled).to.be.false();
      }
    });
  });

  describe('Workflow to Category Mapping Logic', () => {
    /**
     * Helper function to map workflow IDs to notification categories
     * (mirrors the method in NovuNotificationService)
     */
    function getWorkflowCategory(workflowId: string): NotificationCategory {
      // Billing-related workflows
      if (
        workflowId.includes('payment') ||
        workflowId.includes('invoice') ||
        workflowId.includes('billing')
      ) {
        return NotificationCategory.BILLING;
      }

      // Subscription-related workflows
      if (
        workflowId.includes('subscription') ||
        workflowId.includes('plan') ||
        workflowId.includes('trial')
      ) {
        return NotificationCategory.SUBSCRIPTION;
      }

      // User-related workflows
      if (
        workflowId.includes('user') ||
        workflowId.includes('invitation') ||
        workflowId.includes('welcome')
      ) {
        return NotificationCategory.USER;
      }

      // Security-related workflows
      if (
        workflowId.includes('security') ||
        workflowId.includes('password') ||
        workflowId.includes('login') ||
        workflowId.includes('mfa')
      ) {
        return NotificationCategory.SECURITY;
      }

      // Workflow-related (provisioning, etc.)
      if (
        workflowId.includes('workflow') ||
        workflowId.includes('provisioning') ||
        workflowId.includes('tenant-created')
      ) {
        return NotificationCategory.WORKFLOW;
      }

      // Default to system for unrecognized workflows
      return NotificationCategory.SYSTEM;
    }

    describe('billing category detection', () => {
      it('should map payment-related workflows to BILLING', () => {
        expect(getWorkflowCategory('payment-success')).to.equal(
          NotificationCategory.BILLING,
        );
        expect(getWorkflowCategory('payment-failed')).to.equal(
          NotificationCategory.BILLING,
        );
        expect(getWorkflowCategory('payment-reminder')).to.equal(
          NotificationCategory.BILLING,
        );
      });

      it('should map invoice-related workflows to BILLING', () => {
        expect(getWorkflowCategory('invoice-created')).to.equal(
          NotificationCategory.BILLING,
        );
        expect(getWorkflowCategory('invoice-paid')).to.equal(
          NotificationCategory.BILLING,
        );
        expect(getWorkflowCategory('invoice-overdue')).to.equal(
          NotificationCategory.BILLING,
        );
      });

      it('should map billing-related workflows to BILLING', () => {
        expect(getWorkflowCategory('billing-update')).to.equal(
          NotificationCategory.BILLING,
        );
        expect(getWorkflowCategory('billing-cycle-start')).to.equal(
          NotificationCategory.BILLING,
        );
      });
    });

    describe('subscription category detection', () => {
      it('should map subscription-related workflows to SUBSCRIPTION', () => {
        expect(getWorkflowCategory('subscription-created')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
        expect(getWorkflowCategory('subscription-cancelled')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
        expect(getWorkflowCategory('subscription-renewed')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
      });

      it('should map plan-related workflows to SUBSCRIPTION', () => {
        expect(getWorkflowCategory('plan-changed')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
        expect(getWorkflowCategory('plan-upgraded')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
      });

      it('should map trial-related workflows to SUBSCRIPTION', () => {
        expect(getWorkflowCategory('trial-started')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
        expect(getWorkflowCategory('trial-ending')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
        expect(getWorkflowCategory('trial-expired')).to.equal(
          NotificationCategory.SUBSCRIPTION,
        );
      });
    });

    describe('user category detection', () => {
      it('should map user-related workflows to USER', () => {
        expect(getWorkflowCategory('user-created')).to.equal(
          NotificationCategory.USER,
        );
        expect(getWorkflowCategory('user-updated')).to.equal(
          NotificationCategory.USER,
        );
        expect(getWorkflowCategory('user-deleted')).to.equal(
          NotificationCategory.USER,
        );
      });

      it('should map invitation workflows to USER', () => {
        expect(getWorkflowCategory('invitation-sent')).to.equal(
          NotificationCategory.USER,
        );
        expect(getWorkflowCategory('user-invitation')).to.equal(
          NotificationCategory.USER,
        );
      });

      it('should map welcome workflows to USER', () => {
        expect(getWorkflowCategory('welcome-email')).to.equal(
          NotificationCategory.USER,
        );
        expect(getWorkflowCategory('welcome-notification')).to.equal(
          NotificationCategory.USER,
        );
      });
    });

    describe('security category detection', () => {
      it('should map security-related workflows to SECURITY', () => {
        expect(getWorkflowCategory('security-alert')).to.equal(
          NotificationCategory.SECURITY,
        );
        expect(getWorkflowCategory('security-breach')).to.equal(
          NotificationCategory.SECURITY,
        );
      });

      it('should map password workflows to SECURITY', () => {
        expect(getWorkflowCategory('password-reset')).to.equal(
          NotificationCategory.SECURITY,
        );
        expect(getWorkflowCategory('password-changed')).to.equal(
          NotificationCategory.SECURITY,
        );
      });

      it('should map login workflows to SECURITY', () => {
        expect(getWorkflowCategory('login-alert')).to.equal(
          NotificationCategory.SECURITY,
        );
        expect(getWorkflowCategory('new-login-detected')).to.equal(
          NotificationCategory.SECURITY,
        );
      });

      it('should map MFA workflows to SECURITY', () => {
        expect(getWorkflowCategory('mfa-enabled')).to.equal(
          NotificationCategory.SECURITY,
        );
        expect(getWorkflowCategory('mfa-code')).to.equal(
          NotificationCategory.SECURITY,
        );
      });
    });

    describe('workflow category detection', () => {
      it('should map workflow-related workflows to WORKFLOW', () => {
        expect(getWorkflowCategory('workflow-completed')).to.equal(
          NotificationCategory.WORKFLOW,
        );
        expect(getWorkflowCategory('workflow-failed')).to.equal(
          NotificationCategory.WORKFLOW,
        );
      });

      it('should map provisioning workflows to WORKFLOW', () => {
        expect(getWorkflowCategory('provisioning-started')).to.equal(
          NotificationCategory.WORKFLOW,
        );
        expect(getWorkflowCategory('provisioning-complete')).to.equal(
          NotificationCategory.WORKFLOW,
        );
      });

      it('should map tenant-created workflows to WORKFLOW', () => {
        expect(getWorkflowCategory('tenant-created')).to.equal(
          NotificationCategory.WORKFLOW,
        );
        expect(getWorkflowCategory('tenant-created-notification')).to.equal(
          NotificationCategory.WORKFLOW,
        );
      });
    });

    describe('system category (fallback)', () => {
      it('should map unrecognized workflows to SYSTEM', () => {
        expect(getWorkflowCategory('general-alert')).to.equal(
          NotificationCategory.SYSTEM,
        );
        expect(getWorkflowCategory('system-status')).to.equal(
          NotificationCategory.SYSTEM,
        );
        expect(getWorkflowCategory('foo-bar')).to.equal(
          NotificationCategory.SYSTEM,
        );
      });

      it('should map maintenance workflows to SYSTEM', () => {
        expect(getWorkflowCategory('maintenance-scheduled')).to.equal(
          NotificationCategory.SYSTEM,
        );
      });
    });
  });

  describe('Subscriber ID Generation Logic', () => {
    /**
     * Helper function to generate a subscriber ID for a tenant user
     * (mirrors the method in NovuNotificationService)
     */
    function generateSubscriberId(tenantId: string, email: string): string {
      const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
      return `tenant-${tenantId}-${sanitizedEmail}`;
    }

    it('should generate subscriber ID with tenant prefix', () => {
      const subscriberId = generateSubscriberId(
        'tenant-123',
        'user@example.com',
      );
      expect(subscriberId).to.startWith('tenant-');
    });

    it('should include tenant ID in subscriber ID', () => {
      const subscriberId = generateSubscriberId(
        'tenant-abc-123',
        'user@example.com',
      );
      expect(subscriberId).to.containEql('tenant-abc-123');
    });

    it('should sanitize email special characters', () => {
      const subscriberId = generateSubscriberId(
        'tenant-123',
        'user+test@example.com',
      );
      expect(subscriberId).to.not.containEql('@');
      expect(subscriberId).to.not.containEql('+');
      expect(subscriberId).to.not.containEql('.');
      expect(subscriberId).to.containEql('_');
    });

    it('should produce consistent IDs for same input', () => {
      const id1 = generateSubscriberId('tenant-123', 'user@example.com');
      const id2 = generateSubscriberId('tenant-123', 'user@example.com');
      expect(id1).to.equal(id2);
    });

    it('should produce different IDs for different emails', () => {
      const id1 = generateSubscriberId('tenant-123', 'user1@example.com');
      const id2 = generateSubscriberId('tenant-123', 'user2@example.com');
      expect(id1).to.not.equal(id2);
    });

    it('should produce different IDs for different tenants', () => {
      const id1 = generateSubscriberId('tenant-123', 'user@example.com');
      const id2 = generateSubscriberId('tenant-456', 'user@example.com');
      expect(id1).to.not.equal(id2);
    });
  });

  describe('NotificationChannel Enum', () => {
    it('should have all expected channels', () => {
      expect(NotificationChannel.EMAIL).to.equal('email');
      expect(NotificationChannel.SMS).to.equal('sms');
      expect(NotificationChannel.PUSH).to.equal('push');
      expect(NotificationChannel.IN_APP).to.equal('in_app');
      expect(NotificationChannel.WEBHOOK).to.equal('webhook');
    });

    it('should have exactly 5 channels', () => {
      expect(Object.keys(NotificationChannel).length).to.equal(5);
    });
  });

  describe('NotificationCategory Enum', () => {
    it('should have all expected categories', () => {
      expect(NotificationCategory.BILLING).to.equal('billing');
      expect(NotificationCategory.SUBSCRIPTION).to.equal('subscription');
      expect(NotificationCategory.USER).to.equal('user');
      expect(NotificationCategory.SYSTEM).to.equal('system');
      expect(NotificationCategory.SECURITY).to.equal('security');
      expect(NotificationCategory.WORKFLOW).to.equal('workflow');
    });

    it('should have exactly 6 categories', () => {
      expect(Object.keys(NotificationCategory).length).to.equal(6);
    });
  });
});
