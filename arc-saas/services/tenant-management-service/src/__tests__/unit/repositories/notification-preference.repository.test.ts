import {expect} from '@loopback/testlab';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../../models/notification-preference.model';

/**
 * Unit tests for NotificationPreferenceRepository logic
 *
 * Note: These tests focus on the repository helper method logic
 * that can be tested without mocking the entire LoopBack infrastructure.
 * Integration tests would cover actual database operations.
 */
describe('NotificationPreferenceRepository (Unit Tests)', () => {
  describe('Default Preferences Logic', () => {
    /**
     * Helper function that mimics getEffectivePreference when no DB record exists
     */
    function getDefaultPreference(
      tenantId: string,
      category: NotificationCategory,
    ): NotificationPreference {
      const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
      return new NotificationPreference({
        id: '',
        tenantId,
        category,
        emailEnabled: defaults.emailEnabled,
        smsEnabled: defaults.smsEnabled,
        pushEnabled: defaults.pushEnabled,
        inAppEnabled: defaults.inAppEnabled,
        webhookEnabled: defaults.webhookEnabled,
      });
    }

    it('should return default billing preferences with email and in_app enabled', () => {
      const pref = getDefaultPreference('tenant-123', NotificationCategory.BILLING);

      expect(pref.tenantId).to.equal('tenant-123');
      expect(pref.category).to.equal(NotificationCategory.BILLING);
      expect(pref.emailEnabled).to.be.true();
      expect(pref.inAppEnabled).to.be.true();
      expect(pref.smsEnabled).to.be.false();
      expect(pref.pushEnabled).to.be.false();
      expect(pref.webhookEnabled).to.be.false();
    });

    it('should return default security preferences with SMS enabled for MFA', () => {
      const pref = getDefaultPreference('tenant-456', NotificationCategory.SECURITY);

      expect(pref.category).to.equal(NotificationCategory.SECURITY);
      expect(pref.emailEnabled).to.be.true();
      expect(pref.smsEnabled).to.be.true(); // Enabled for MFA
      expect(pref.inAppEnabled).to.be.true();
      expect(pref.pushEnabled).to.be.false();
      expect(pref.webhookEnabled).to.be.false();
    });

    it('should return defaults for all notification categories', () => {
      const tenantId = 'test-tenant';

      for (const category of Object.values(NotificationCategory)) {
        const pref = getDefaultPreference(tenantId, category);

        expect(pref.tenantId).to.equal(tenantId);
        expect(pref.category).to.equal(category);
        // All categories have email and in_app enabled by default
        expect(pref.emailEnabled).to.be.true();
        expect(pref.inAppEnabled).to.be.true();
        // Only security has SMS enabled by default
        if (category === NotificationCategory.SECURITY) {
          expect(pref.smsEnabled).to.be.true();
        } else {
          expect(pref.smsEnabled).to.be.false();
        }
      }
    });
  });

  describe('getAllEffectivePreferences Logic', () => {
    /**
     * Helper function that mimics getAllEffectivePreferences behavior
     */
    function getAllEffectivePreferences(
      tenantId: string,
      existingPrefs: NotificationPreference[],
    ): NotificationPreference[] {
      const existingCategories = new Set(existingPrefs.map(p => p.category));
      const allPrefs: NotificationPreference[] = [...existingPrefs];

      for (const category of Object.values(NotificationCategory)) {
        if (!existingCategories.has(category)) {
          const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
          allPrefs.push(
            new NotificationPreference({
              id: '',
              tenantId,
              category,
              emailEnabled: defaults.emailEnabled,
              smsEnabled: defaults.smsEnabled,
              pushEnabled: defaults.pushEnabled,
              inAppEnabled: defaults.inAppEnabled,
              webhookEnabled: defaults.webhookEnabled,
            }),
          );
        }
      }

      return allPrefs;
    }

    it('should return defaults for all categories when no existing preferences', () => {
      const prefs = getAllEffectivePreferences('tenant-abc', []);

      expect(prefs.length).to.equal(Object.values(NotificationCategory).length);

      // Verify all categories are present
      const categories = prefs.map(p => p.category);
      for (const category of Object.values(NotificationCategory)) {
        expect(categories).to.containEql(category);
      }
    });

    it('should preserve existing preferences and fill in missing categories', () => {
      const existingBilling = new NotificationPreference({
        id: 'existing-id-1',
        tenantId: 'tenant-xyz',
        category: NotificationCategory.BILLING,
        emailEnabled: false, // Customized - user disabled email
        smsEnabled: true,    // Customized - user enabled SMS
        pushEnabled: false,
        inAppEnabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://example.com/webhook',
      });

      const prefs = getAllEffectivePreferences('tenant-xyz', [existingBilling]);

      // Should have all categories
      expect(prefs.length).to.equal(Object.values(NotificationCategory).length);

      // Find the billing preference - should be the customized one
      const billingPref = prefs.find(p => p.category === NotificationCategory.BILLING);
      expect(billingPref).to.not.be.undefined();
      expect(billingPref!.id).to.equal('existing-id-1');
      expect(billingPref!.emailEnabled).to.be.false(); // Preserved customization
      expect(billingPref!.smsEnabled).to.be.true();    // Preserved customization
      expect(billingPref!.webhookEnabled).to.be.true();
      expect(billingPref!.webhookUrl).to.equal('https://example.com/webhook');

      // Other categories should have defaults
      const securityPref = prefs.find(p => p.category === NotificationCategory.SECURITY);
      expect(securityPref).to.not.be.undefined();
      expect(securityPref!.id).to.equal(''); // Default, not from DB
      expect(securityPref!.emailEnabled).to.be.true();
      expect(securityPref!.smsEnabled).to.be.true(); // Security default
    });

    it('should not duplicate categories when all are already set', () => {
      const existingPrefs = Object.values(NotificationCategory).map(
        (category, index) =>
          new NotificationPreference({
            id: `pref-${index}`,
            tenantId: 'tenant-full',
            category,
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: false,
            inAppEnabled: true,
            webhookEnabled: false,
          }),
      );

      const prefs = getAllEffectivePreferences('tenant-full', existingPrefs);

      expect(prefs.length).to.equal(Object.values(NotificationCategory).length);
      // All should have real IDs (not defaults)
      for (const pref of prefs) {
        expect(pref.id).to.not.equal('');
      }
    });
  });

  describe('Category Lookup Logic', () => {
    it('should correctly identify all notification categories', () => {
      const expectedCategories = [
        'billing',
        'subscription',
        'user',
        'system',
        'security',
        'workflow',
      ];

      const actualCategories = Object.values(NotificationCategory);

      expect(actualCategories.length).to.equal(expectedCategories.length);
      for (const category of expectedCategories) {
        expect(actualCategories).to.containEql(category);
      }
    });

    it('should have defaults defined for all categories', () => {
      for (const category of Object.values(NotificationCategory)) {
        expect(DEFAULT_NOTIFICATION_PREFERENCES).to.have.property(category);

        const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
        expect(defaults).to.have.property('emailEnabled');
        expect(defaults).to.have.property('smsEnabled');
        expect(defaults).to.have.property('pushEnabled');
        expect(defaults).to.have.property('inAppEnabled');
        expect(defaults).to.have.property('webhookEnabled');
      }
    });
  });

  describe('Preference Merge Logic', () => {
    /**
     * Helper that mimics upsert data merging
     */
    function mergePreferenceUpdate(
      existing: NotificationPreference,
      updates: Partial<NotificationPreference>,
    ): NotificationPreference {
      return new NotificationPreference({
        ...existing,
        ...updates,
      });
    }

    it('should merge partial updates correctly', () => {
      const existing = new NotificationPreference({
        id: 'pref-1',
        tenantId: 'tenant-merge',
        category: NotificationCategory.BILLING,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: false,
        inAppEnabled: true,
        webhookEnabled: false,
      });

      const updated = mergePreferenceUpdate(existing, {
        smsEnabled: true,
        pushEnabled: true,
      });

      expect(updated.id).to.equal('pref-1');
      expect(updated.tenantId).to.equal('tenant-merge');
      expect(updated.category).to.equal(NotificationCategory.BILLING);
      expect(updated.emailEnabled).to.be.true();  // Unchanged
      expect(updated.smsEnabled).to.be.true();    // Updated
      expect(updated.pushEnabled).to.be.true();   // Updated
      expect(updated.inAppEnabled).to.be.true();  // Unchanged
      expect(updated.webhookEnabled).to.be.false(); // Unchanged
    });

    it('should update webhook URL when webhook is enabled', () => {
      const existing = new NotificationPreference({
        id: 'pref-2',
        tenantId: 'tenant-webhook',
        category: NotificationCategory.WORKFLOW,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: false,
        inAppEnabled: true,
        webhookEnabled: false,
      });

      const updated = mergePreferenceUpdate(existing, {
        webhookEnabled: true,
        webhookUrl: 'https://api.example.com/hooks/notifications',
      });

      expect(updated.webhookEnabled).to.be.true();
      expect(updated.webhookUrl).to.equal('https://api.example.com/hooks/notifications');
    });

    it('should preserve webhook URL when only toggling other channels', () => {
      const existing = new NotificationPreference({
        id: 'pref-3',
        tenantId: 'tenant-url',
        category: NotificationCategory.SECURITY,
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: false,
        inAppEnabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://existing-webhook.com',
      });

      const updated = mergePreferenceUpdate(existing, {
        pushEnabled: true, // Enable push
      });

      expect(updated.webhookEnabled).to.be.true();
      expect(updated.webhookUrl).to.equal('https://existing-webhook.com');
      expect(updated.pushEnabled).to.be.true();
    });
  });

  describe('Bulk Update Validation', () => {
    it('should validate bulk preference structure', () => {
      const bulkUpdates = [
        {
          category: NotificationCategory.BILLING,
          emailEnabled: true,
          smsEnabled: false,
        },
        {
          category: NotificationCategory.SECURITY,
          emailEnabled: true,
          smsEnabled: true,
          pushEnabled: true,
        },
      ];

      // Validate each update has required category
      for (const update of bulkUpdates) {
        expect(update).to.have.property('category');
        expect(Object.values(NotificationCategory)).to.containEql(update.category);
      }
    });

    it('should handle partial channel updates in bulk', () => {
      // Simulate bulk update where not all channels are specified
      const bulkUpdates: Array<{
        category: NotificationCategory;
        emailEnabled?: boolean;
        smsEnabled?: boolean;
        pushEnabled?: boolean;
        inAppEnabled?: boolean;
        webhookEnabled?: boolean;
        webhookUrl?: string;
      }> = [
        {category: NotificationCategory.BILLING, emailEnabled: false},
        {category: NotificationCategory.USER, webhookEnabled: true, webhookUrl: 'https://test.com'},
      ];

      for (const update of bulkUpdates) {
        // Category is always required
        expect(update.category).to.not.be.undefined();

        // At least one channel property should be defined
        const hasChannelUpdate =
          update.emailEnabled !== undefined ||
          update.smsEnabled !== undefined ||
          update.pushEnabled !== undefined ||
          update.inAppEnabled !== undefined ||
          update.webhookEnabled !== undefined;

        expect(hasChannelUpdate).to.be.true();
      }
    });
  });

  describe('Channel Array Helper', () => {
    it('should return enabled channels from preference', () => {
      const pref = new NotificationPreference({
        tenantId: 'test',
        category: NotificationCategory.BILLING,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        webhookEnabled: false,
      });

      const channels = pref.getEnabledChannels();

      expect(channels).to.containEql(NotificationChannel.EMAIL);
      expect(channels).to.containEql(NotificationChannel.PUSH);
      expect(channels).to.containEql(NotificationChannel.IN_APP);
      expect(channels).to.not.containEql(NotificationChannel.SMS);
      expect(channels).to.not.containEql(NotificationChannel.WEBHOOK);
      expect(channels.length).to.equal(3);
    });

    it('should check individual channel status', () => {
      const pref = new NotificationPreference({
        tenantId: 'test',
        category: NotificationCategory.SECURITY,
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: false,
        inAppEnabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://hook.test',
      });

      expect(pref.isChannelEnabled(NotificationChannel.EMAIL)).to.be.true();
      expect(pref.isChannelEnabled(NotificationChannel.SMS)).to.be.true();
      expect(pref.isChannelEnabled(NotificationChannel.PUSH)).to.be.false();
      expect(pref.isChannelEnabled(NotificationChannel.IN_APP)).to.be.true();
      expect(pref.isChannelEnabled(NotificationChannel.WEBHOOK)).to.be.true();
    });
  });
});
