/**
 * App Plane Webhook Bridge Service
 *
 * Receives webhooks from the Control Plane (tenant-management-service)
 * and bootstraps tenant resources in the App Plane (Supabase).
 *
 * CRITICAL: Implements the unified tenant_id = organization_id strategy.
 * When a tenant is provisioned, we create an organization with:
 *   organizations.id = tenantId (from Control Plane)
 *
 * This ensures JWT tenant_id claims work directly for Supabase RLS queries.
 *
 * Webhooks handled:
 * - POST /webhooks/tenant-provisioned  - Creates organization + admin user
 * - POST /webhooks/subscription-changed - Updates organization limits
 * - POST /webhooks/user-invited         - Creates user in App Plane
 * - POST /webhooks/tenant-deprovisioned - Soft/hard deletes organization
 * - POST /webhooks/keycloak-realm-created - Updates organization SSO settings
 *
 * TEMPORAL INTEGRATION:
 * After successful provisioning, sends a signal back to the Temporal workflow
 * to confirm that the App Plane organization has been created.
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, Connection } from '@temporalio/client';

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '27600', 10);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:27540';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Temporal configuration for sending confirmation signals
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const DEFAULT_TEMPORAL_NAMESPACE = 'arc-saas';

// Initialize Supabase client with service key (bypasses RLS)
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Temporal client (lazily initialized)
let temporalClient: Client | null = null;

/**
 * Get or create Temporal client for sending signals
 */
async function getTemporalClient(namespace: string): Promise<Client> {
  // Create new client for the specified namespace
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  return new Client({ connection, namespace });
}

/**
 * Send confirmation signal to Temporal workflow
 */
async function sendProvisioningConfirmation(
  workflowId: string,
  namespace: string,
  payload: {
    organizationId: string;
    adminUserId?: string;
    success: boolean;
    error?: string;
  }
): Promise<void> {
  try {
    const client = await getTemporalClient(namespace);
    const handle = client.workflow.getHandle(workflowId);

    // Signal the workflow with the provisioning result
    await handle.signal('appPlaneProvisioned', payload);

    console.log('[Temporal] Sent appPlaneProvisioned signal', {
      workflowId,
      namespace,
      success: payload.success,
    });
  } catch (err) {
    console.error('[Temporal] Failed to send signal:', err);
    // Don't throw - the webhook should still succeed even if signal fails
    // The workflow has a timeout and will continue anyway
  }
}

// ============================================================================
// Webhook Payload Types (matching Control Plane activities)
// ============================================================================

interface TenantProvisionedPayload {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  planId?: string;
  adminUser: {
    email: string;
    firstName: string;
    lastName: string;
    keycloakUserId?: string;
  };
  limits: {
    maxUsers?: number;
    maxComponents?: number;
    maxStorageGb?: number;
  };
  keycloakRealm?: string;
  // Temporal callback fields (for workflow confirmation)
  workflowId?: string;         // Temporal workflow ID to signal when complete
  temporalNamespace?: string;  // Temporal namespace (defaults to arc-saas)
}

interface SubscriptionChangedPayload {
  tenantId: string;
  tenantKey: string;
  oldPlanId?: string;
  newPlanId: string;
  newLimits: {
    maxUsers?: number;
    maxComponents?: number;
    maxStorageGb?: number;
  };
}

interface UserInvitedPayload {
  tenantId: string;
  tenantKey: string;
  userEmail: string;
  role: string;
  invitedBy?: string;
}

interface TenantDeprovisionedPayload {
  tenantId: string;
  tenantKey: string;
  reason?: string;
  hardDelete?: boolean;
}

interface KeycloakRealmCreatedPayload {
  tenantId: string;
  tenantKey: string;
  realmName: string;
  realmUrl: string;
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifySignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const eventType = req.headers['x-webhook-event'] as string;

  if (!signature) {
    res.status(401).json({ error: 'Missing signature header' });
    return;
  }

  // Compute expected signature
  const body = JSON.stringify(req.body);
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  // Timing-safe comparison
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.error('[Webhook] Invalid signature', { received: signature, expected: expectedSignature });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Optional: Check timestamp to prevent replay attacks (5 minute window)
  if (timestamp) {
    const timestampDate = new Date(timestamp);
    const now = new Date();
    const diff = Math.abs(now.getTime() - timestampDate.getTime());
    if (diff > 5 * 60 * 1000) {
      console.error('[Webhook] Timestamp too old', { timestamp, diff });
      res.status(401).json({ error: 'Timestamp too old' });
      return;
    }
  }

  console.log(`[Webhook] Signature verified for event: ${eventType}`);
  next();
}

// ============================================================================
// Webhook Handlers
// ============================================================================

const app = express();
app.use(express.json());

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'webhook-bridge' });
});

/**
 * Handle tenant provisioned webhook
 *
 * CRITICAL: Creates organization with id = tenantId (unified ID strategy)
 *
 * Uses the SQL functions defined in 002_core_schema_and_rls.sql:
 * - create_tenant_organization(id, name, slug, tier, domains)
 * - provision_user_in_organization(keycloak_user_id, email, full_name, org_id, role)
 *
 * After successful provisioning, sends a Temporal signal back to the workflow
 * to confirm completion (if workflowId is provided in the payload).
 */
app.post('/webhooks/tenant-provisioned', verifySignature, async (req: Request, res: Response) => {
  const payload: TenantProvisionedPayload = req.body;

  console.log('[Webhook] Tenant provisioned', {
    tenantId: payload.tenantId,
    tenantKey: payload.tenantKey,
    tenantName: payload.tenantName,
    adminEmail: payload.adminUser.email,
    workflowId: payload.workflowId,
  });

  let adminUserId: string | undefined;

  try {
    // Determine tier from plan ID
    const tier = payload.planId?.includes('premium') ? 'premium' :
                 payload.planId?.includes('standard') ? 'standard' :
                 payload.planId?.includes('professional') ? 'professional' :
                 payload.planId?.includes('enterprise') ? 'enterprise' :
                 'basic';

    // Step 1: Create organization using SQL function (handles upsert)
    // This ensures id = tenantId (UNIFIED ID STRATEGY)
    const { data: orgResult, error: orgError } = await supabase.rpc('create_tenant_organization', {
      p_organization_id: payload.tenantId,
      p_name: payload.tenantName,
      p_slug: payload.tenantKey,
      p_tier: tier,
      p_domains: [], // Can be populated from payload if needed
    });

    if (orgError) {
      console.error('[Webhook] Failed to create organization:', orgError);

      // Send failure signal to Temporal if workflow ID provided
      if (payload.workflowId) {
        await sendProvisioningConfirmation(
          payload.workflowId,
          payload.temporalNamespace || DEFAULT_TEMPORAL_NAMESPACE,
          {
            organizationId: payload.tenantId,
            success: false,
            error: `Failed to create organization: ${orgError.message}`,
          }
        );
      }

      res.status(500).json({ error: 'Failed to create organization', details: orgError.message });
      return;
    }

    console.log('[Webhook] Organization created/updated', { id: payload.tenantId, name: payload.tenantName });

    // Step 2: Create admin user and membership using SQL function
    const fullName = `${payload.adminUser.firstName} ${payload.adminUser.lastName}`.trim();
    const { data: userResult, error: userError } = await supabase.rpc('provision_user_in_organization', {
      p_keycloak_user_id: payload.adminUser.keycloakUserId || null,
      p_email: payload.adminUser.email,
      p_full_name: fullName || null,
      p_organization_id: payload.tenantId,
      p_role: 'owner', // First user is the owner
    });

    if (userError) {
      console.error('[Webhook] Failed to create admin user:', userError);
      // Don't fail the whole operation - org was created
    } else {
      adminUserId = userResult as string;
      console.log('[Webhook] Admin user created/updated', { id: adminUserId, email: payload.adminUser.email });
    }

    // Step 3: Store organization settings/limits in a separate settings update
    // (The tier is already set, but we can store additional metadata)
    if (payload.limits) {
      const { error: settingsError } = await supabase
        .from('organizations')
        .update({
          settings: {
            max_users: payload.limits.maxUsers || null,
            max_components: payload.limits.maxComponents || null,
            max_storage_gb: payload.limits.maxStorageGb || null,
            keycloak_realm: payload.keycloakRealm || null,
          },
        })
        .eq('id', payload.tenantId);

      if (settingsError) {
        console.warn('[Webhook] Failed to update organization settings:', settingsError);
      }
    }

    // Step 4: Send success confirmation signal to Temporal workflow
    if (payload.workflowId) {
      console.log('[Webhook] Sending confirmation to Temporal workflow', {
        workflowId: payload.workflowId,
        namespace: payload.temporalNamespace || DEFAULT_TEMPORAL_NAMESPACE,
      });

      await sendProvisioningConfirmation(
        payload.workflowId,
        payload.temporalNamespace || DEFAULT_TEMPORAL_NAMESPACE,
        {
          organizationId: payload.tenantId,
          adminUserId,
          success: true,
        }
      );
    }

    res.json({
      success: true,
      organization_id: payload.tenantId,
      admin_user_id: adminUserId,
      message: 'Tenant provisioned successfully',
    });
  } catch (err) {
    console.error('[Webhook] Unexpected error:', err);

    // Send failure signal to Temporal if workflow ID provided
    if (payload.workflowId) {
      await sendProvisioningConfirmation(
        payload.workflowId,
        payload.temporalNamespace || DEFAULT_TEMPORAL_NAMESPACE,
        {
          organizationId: payload.tenantId,
          success: false,
          error: `Unexpected error: ${(err as Error).message}`,
        }
      );
    }

    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

/**
 * Handle subscription changed webhook
 *
 * Updates organization tier and limits based on new plan.
 * Limits are stored in the settings JSONB column.
 */
app.post('/webhooks/subscription-changed', verifySignature, async (req: Request, res: Response) => {
  const payload: SubscriptionChangedPayload = req.body;

  console.log('[Webhook] Subscription changed', {
    tenantId: payload.tenantId,
    oldPlan: payload.oldPlanId,
    newPlan: payload.newPlanId,
  });

  try {
    // Determine tier from plan ID
    const tier = payload.newPlanId?.includes('premium') ? 'premium' :
                 payload.newPlanId?.includes('standard') ? 'standard' :
                 payload.newPlanId?.includes('professional') ? 'professional' :
                 payload.newPlanId?.includes('enterprise') ? 'enterprise' :
                 'basic';

    // Store limits in settings JSONB column
    const { error } = await supabase
      .from('organizations')
      .update({
        tier,
        settings: {
          plan_id: payload.newPlanId,
          max_users: payload.newLimits.maxUsers || null,
          max_components: payload.newLimits.maxComponents || null,
          max_storage_gb: payload.newLimits.maxStorageGb || null,
        },
      })
      .eq('id', payload.tenantId);

    if (error) {
      console.error('[Webhook] Failed to update organization:', error);
      res.status(500).json({ error: 'Failed to update organization', details: error.message });
      return;
    }

    console.log('[Webhook] Organization subscription updated', { tenantId: payload.tenantId, tier });

    res.json({
      success: true,
      message: 'Subscription updated successfully',
    });
  } catch (err) {
    console.error('[Webhook] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

/**
 * Handle user invited webhook
 *
 * Creates an invitation record in the App Plane.
 * Uses organization_invitations table to track pending invitations.
 */
app.post('/webhooks/user-invited', verifySignature, async (req: Request, res: Response) => {
  const payload: UserInvitedPayload = req.body;

  console.log('[Webhook] User invited', {
    tenantId: payload.tenantId,
    email: payload.userEmail,
    role: payload.role,
  });

  try {
    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from('organization_invitations')
      .upsert({
        organization_id: payload.tenantId,
        email: payload.userEmail,
        role: payload.role,
        token: invitationToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }, {
        onConflict: 'organization_id,email',
      })
      .select()
      .single();

    if (invitationError) {
      console.error('[Webhook] Failed to create invitation:', invitationError);
      res.status(500).json({ error: 'Failed to create invitation', details: invitationError.message });
      return;
    }

    console.log('[Webhook] Invitation created', {
      invitationId: invitation?.id,
      email: payload.userEmail,
    });

    res.json({
      success: true,
      invitation_id: invitation?.id,
      message: 'User invitation recorded',
    });
  } catch (err) {
    console.error('[Webhook] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

/**
 * Handle tenant deprovisioned webhook
 *
 * Soft-delete or hard-delete organization and related data.
 * Uses the actual schema tables: organizations, users, organization_memberships, organization_invitations.
 */
app.post('/webhooks/tenant-deprovisioned', verifySignature, async (req: Request, res: Response) => {
  const payload: TenantDeprovisionedPayload = req.body;

  console.log('[Webhook] Tenant deprovisioned', {
    tenantId: payload.tenantId,
    reason: payload.reason,
    hardDelete: payload.hardDelete,
  });

  try {
    if (payload.hardDelete) {
      // Hard delete: Remove all data
      // Order matters due to foreign keys
      // First delete invitations (no FK dependencies on other tables)
      await supabase.from('organization_invitations').delete().eq('organization_id', payload.tenantId);

      // Get user IDs in this organization
      const { data: memberships } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', payload.tenantId);

      const userIds = memberships?.map(m => m.user_id) || [];

      // Delete memberships
      await supabase.from('organization_memberships').delete().eq('organization_id', payload.tenantId);

      // Delete users who only belonged to this organization
      // (Users might belong to multiple orgs, so only delete if they have no other memberships)
      for (const userId of userIds) {
        const { count } = await supabase
          .from('organization_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (count === 0) {
          await supabase.from('users').delete().eq('id', userId);
        }
      }

      // Finally delete the organization
      await supabase.from('organizations').delete().eq('id', payload.tenantId);

      console.log('[Webhook] Organization hard-deleted', { tenantId: payload.tenantId });
    } else {
      // Soft delete: Mark as deprovisioned using deleted_at
      // First get current settings to preserve them
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', payload.tenantId)
        .single();

      const currentSettings = org?.settings || {};

      await supabase
        .from('organizations')
        .update({
          status: 'deprovisioned',
          deleted_at: new Date().toISOString(),
          settings: {
            ...currentSettings,
            deprovision_reason: payload.reason || null,
          },
        })
        .eq('id', payload.tenantId);

      console.log('[Webhook] Organization soft-deleted', { tenantId: payload.tenantId });
    }

    res.json({
      success: true,
      message: payload.hardDelete ? 'Tenant hard-deleted' : 'Tenant soft-deleted',
    });
  } catch (err) {
    console.error('[Webhook] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

/**
 * Handle Keycloak realm created webhook
 *
 * Updates organization settings with SSO realm information.
 * SSO settings are stored in the settings JSONB column.
 */
app.post('/webhooks/keycloak-realm-created', verifySignature, async (req: Request, res: Response) => {
  const payload: KeycloakRealmCreatedPayload = req.body;

  console.log('[Webhook] Keycloak realm created', {
    tenantId: payload.tenantId,
    realmName: payload.realmName,
  });

  try {
    // First get current settings to merge
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', payload.tenantId)
      .single();

    const currentSettings = org?.settings || {};

    // Update with merged settings
    const { error } = await supabase
      .from('organizations')
      .update({
        settings: {
          ...currentSettings,
          keycloak_realm: payload.realmName,
          keycloak_realm_url: payload.realmUrl,
          sso_enabled: true,
        },
      })
      .eq('id', payload.tenantId);

    if (error) {
      console.error('[Webhook] Failed to update organization SSO settings:', error);
      res.status(500).json({ error: 'Failed to update organization', details: error.message });
      return;
    }

    console.log('[Webhook] Organization SSO settings updated', { tenantId: payload.tenantId, realmName: payload.realmName });

    res.json({
      success: true,
      message: 'Keycloak realm recorded',
    });
  } catch (err) {
    console.error('[Webhook] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// ============================================================================
// Server Startup
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  App Plane Webhook Bridge Service                                            ║
║  Listening on port ${PORT}                                                      ║
║                                                                              ║
║  Endpoints:                                                                  ║
║    GET  /health                           - Health check                     ║
║    POST /webhooks/tenant-provisioned      - Creates organization + user      ║
║    POST /webhooks/subscription-changed    - Updates limits                   ║
║    POST /webhooks/user-invited            - Creates invited user             ║
║    POST /webhooks/tenant-deprovisioned    - Soft/hard delete                 ║
║    POST /webhooks/keycloak-realm-created  - SSO settings                     ║
║                                                                              ║
║  Unified ID Strategy: organization.id = tenant.id (Control Plane)            ║
║                                                                              ║
║  Temporal Integration:                                                       ║
║    Address: ${TEMPORAL_ADDRESS.padEnd(20)}                                   ║
║    Sends 'appPlaneProvisioned' signal back to workflow on completion         ║
╚══════════════════════════════════════════════════════════════════════════════╝
  `);
});
