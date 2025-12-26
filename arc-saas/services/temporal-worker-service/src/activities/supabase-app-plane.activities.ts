/**
 * Supabase App Plane Activities
 *
 * Activities for directly provisioning tenant resources in the App Plane (Supabase).
 * This eliminates the need for a separate webhook-bridge service by handling
 * Supabase operations directly within the Temporal workflow.
 *
 * CRITICAL: Implements the unified tenant_id = organization_id strategy.
 * When a tenant is provisioned, we create an organization with:
 *   organizations.id = tenantId (from Control Plane)
 *
 * This ensures JWT tenant_id claims work directly for Supabase RLS queries.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ApplicationFailure } from '@temporalio/activity';
import { createLogger } from '../utils/logger';

const logger = createLogger('supabase-app-plane-activities');

// Configuration - read at activity execution time (NOT workflow time)
const getSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:27540';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

  if (!supabaseServiceKey) {
    logger.warn('SUPABASE_SERVICE_KEY not set - using empty key (will fail in production)');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// ============================================================================
// Input/Output Types
// ============================================================================

export interface ProvisionAppPlaneOrganizationInput {
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
}

export interface ProvisionAppPlaneOrganizationResult {
  organizationId: string;
  adminUserId?: string;
  created: boolean;
}

export interface UpdateAppPlaneSubscriptionInput {
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

export interface UpdateAppPlaneSubscriptionResult {
  success: boolean;
  organizationId: string;
}

export interface CreateAppPlaneUserInput {
  tenantId: string;
  tenantKey: string;
  userEmail: string;
  firstName?: string;
  lastName?: string;
  keycloakUserId?: string;
  role: string;
  invitedBy?: string;
}

export interface CreateAppPlaneUserResult {
  userId: string;
  created: boolean;
}

export interface DeprovisionAppPlaneOrganizationInput {
  tenantId: string;
  tenantKey: string;
  reason?: string;
  hardDelete?: boolean;
}

export interface DeprovisionAppPlaneOrganizationResult {
  success: boolean;
  hardDeleted: boolean;
}

export interface UpdateAppPlaneSsoInput {
  tenantId: string;
  tenantKey: string;
  realmName: string;
  realmUrl: string;
}

export interface UpdateAppPlaneSsoResult {
  success: boolean;
}

export interface UpdateAppPlaneUserRoleInput {
  tenantId: string;
  userEmail: string;
  newRole: string;
  previousRole?: string;
}

export interface UpdateAppPlaneUserRoleResult {
  userId: string;
  success: boolean;
}

export interface RevokeAppPlaneUserRoleInput {
  tenantId: string;
  userEmail: string;
  role: string;
}

export interface RevokeAppPlaneUserRoleResult {
  userId: string;
  deactivated: boolean;
}

// ============================================================================
// Activities
// ============================================================================

/**
 * Provision organization in App Plane (Supabase)
 *
 * CRITICAL: Creates organization with id = tenantId (unified ID strategy)
 * This is the main activity called during tenant provisioning.
 */
export async function provisionAppPlaneOrganization(
  input: ProvisionAppPlaneOrganizationInput
): Promise<ProvisionAppPlaneOrganizationResult> {
  logger.info('Provisioning App Plane organization', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    tenantName: input.tenantName,
    adminEmail: input.adminUser.email,
  });

  const supabase = getSupabaseClient();

  try {
    // Step 1: Create organization with id = tenantId (UNIFIED ID STRATEGY)
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .upsert({
        id: input.tenantId, // CRITICAL: Use Control Plane tenant ID as organization ID
        key: input.tenantKey,
        name: input.tenantName,
        plan_id: input.planId || null,
        max_users: input.limits.maxUsers || null,
        max_components: input.limits.maxComponents || null,
        max_storage_gb: input.limits.maxStorageGb || null,
        keycloak_realm: input.keycloakRealm || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (orgError) {
      logger.error('Failed to create organization in Supabase', {
        error: orgError.message,
        tenantId: input.tenantId,
      });
      throw ApplicationFailure.nonRetryable(
        `Failed to create organization: ${orgError.message}`,
        'SupabaseOrganizationError'
      );
    }

    logger.info('Organization created/updated in Supabase', {
      id: org.id,
      name: org.name,
    });

    let adminUserId: string | undefined;

    // Step 2: Create admin user
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        email: input.adminUser.email,
        first_name: input.adminUser.firstName,
        last_name: input.adminUser.lastName,
        organization_id: input.tenantId, // Link to organization (same as tenant ID)
        keycloak_user_id: input.adminUser.keycloakUserId || null,
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      })
      .select()
      .single();

    if (userError) {
      logger.warn('Failed to create admin user in Supabase (non-fatal)', {
        error: userError.message,
        email: input.adminUser.email,
      });
      // Don't fail the whole operation - org was created
    } else {
      adminUserId = user.id;
      logger.info('Admin user created/updated in Supabase', {
        id: user.id,
        email: user.email,
      });

      // Step 3: Create organization membership
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .upsert({
          user_id: user.id,
          organization_id: input.tenantId,
          role: 'admin',
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,organization_id',
        });

      if (membershipError) {
        logger.warn('Failed to create membership in Supabase (non-fatal)', {
          error: membershipError.message,
        });
      }
    }

    logger.info('App Plane organization provisioned successfully', {
      organizationId: input.tenantId,
      adminUserId,
    });

    return {
      organizationId: input.tenantId,
      adminUserId,
      created: true,
    };

  } catch (error) {
    if (error instanceof ApplicationFailure) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error provisioning App Plane organization', {
      error: errorMessage,
      tenantId: input.tenantId,
    });

    throw new Error(`Failed to provision App Plane organization: ${errorMessage}`);
  }
}

/**
 * Update subscription/limits in App Plane
 *
 * Called when a tenant upgrades/downgrades their plan.
 */
export async function updateAppPlaneSubscription(
  input: UpdateAppPlaneSubscriptionInput
): Promise<UpdateAppPlaneSubscriptionResult> {
  logger.info('Updating App Plane subscription', {
    tenantId: input.tenantId,
    oldPlanId: input.oldPlanId,
    newPlanId: input.newPlanId,
  });

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        plan_id: input.newPlanId,
        max_users: input.newLimits.maxUsers || null,
        max_components: input.newLimits.maxComponents || null,
        max_storage_gb: input.newLimits.maxStorageGb || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.tenantId);

    if (error) {
      logger.error('Failed to update organization in Supabase', {
        error: error.message,
        tenantId: input.tenantId,
      });
      throw new Error(`Failed to update organization: ${error.message}`);
    }

    logger.info('App Plane subscription updated successfully', {
      tenantId: input.tenantId,
    });

    return {
      success: true,
      organizationId: input.tenantId,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating App Plane subscription', {
      error: errorMessage,
      tenantId: input.tenantId,
    });
    throw error;
  }
}

/**
 * Create user in App Plane
 *
 * Called when a user is invited to a tenant.
 */
export async function createAppPlaneUser(
  input: CreateAppPlaneUserInput
): Promise<CreateAppPlaneUserResult> {
  logger.info('Creating App Plane user', {
    tenantId: input.tenantId,
    email: input.userEmail,
    role: input.role,
  });

  const supabase = getSupabaseClient();

  try {
    // Create user with 'invited' status
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        email: input.userEmail,
        first_name: input.firstName || null,
        last_name: input.lastName || null,
        organization_id: input.tenantId,
        keycloak_user_id: input.keycloakUserId || null,
        role: input.role,
        status: 'invited',
        invited_by: input.invitedBy || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      })
      .select()
      .single();

    if (userError) {
      logger.error('Failed to create user in Supabase', {
        error: userError.message,
        email: input.userEmail,
      });
      throw new Error(`Failed to create user: ${userError.message}`);
    }

    // Create membership record
    if (user) {
      await supabase
        .from('organization_memberships')
        .upsert({
          user_id: user.id,
          organization_id: input.tenantId,
          role: input.role,
          status: 'invited',
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,organization_id',
        });
    }

    logger.info('App Plane user created successfully', {
      userId: user?.id,
      email: input.userEmail,
    });

    return {
      userId: user?.id || '',
      created: true,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating App Plane user', {
      error: errorMessage,
      email: input.userEmail,
    });
    throw error;
  }
}

/**
 * Deprovision organization in App Plane
 *
 * Called when a tenant is deprovisioned. Supports soft-delete and hard-delete.
 */
export async function deprovisionAppPlaneOrganization(
  input: DeprovisionAppPlaneOrganizationInput
): Promise<DeprovisionAppPlaneOrganizationResult> {
  logger.info('Deprovisioning App Plane organization', {
    tenantId: input.tenantId,
    reason: input.reason,
    hardDelete: input.hardDelete,
  });

  const supabase = getSupabaseClient();

  try {
    if (input.hardDelete) {
      // Hard delete: Remove all data (order matters due to foreign keys)
      await supabase.from('organization_memberships').delete().eq('organization_id', input.tenantId);
      await supabase.from('users').delete().eq('organization_id', input.tenantId);
      // Add other tenant-specific tables here as needed
      // await supabase.from('boms').delete().eq('organization_id', input.tenantId);
      // await supabase.from('projects').delete().eq('organization_id', input.tenantId);
      await supabase.from('organizations').delete().eq('id', input.tenantId);

      logger.info('App Plane organization hard-deleted', { tenantId: input.tenantId });
    } else {
      // Soft delete: Mark as inactive
      await supabase
        .from('organizations')
        .update({
          status: 'inactive',
          deprovisioned_at: new Date().toISOString(),
          deprovision_reason: input.reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.tenantId);

      logger.info('App Plane organization soft-deleted', { tenantId: input.tenantId });
    }

    return {
      success: true,
      hardDeleted: input.hardDelete || false,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deprovisioning App Plane organization', {
      error: errorMessage,
      tenantId: input.tenantId,
    });
    throw error;
  }
}

/**
 * Update SSO settings in App Plane
 *
 * Called when a Keycloak realm is created for a tenant.
 */
export async function updateAppPlaneSso(
  input: UpdateAppPlaneSsoInput
): Promise<UpdateAppPlaneSsoResult> {
  logger.info('Updating App Plane SSO settings', {
    tenantId: input.tenantId,
    realmName: input.realmName,
  });

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        keycloak_realm: input.realmName,
        keycloak_realm_url: input.realmUrl,
        sso_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.tenantId);

    if (error) {
      logger.error('Failed to update SSO settings in Supabase', {
        error: error.message,
        tenantId: input.tenantId,
      });
      throw new Error(`Failed to update SSO settings: ${error.message}`);
    }

    logger.info('App Plane SSO settings updated successfully', {
      tenantId: input.tenantId,
    });

    return {
      success: true,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating App Plane SSO settings', {
      error: errorMessage,
      tenantId: input.tenantId,
    });
    throw error;
  }
}

/**
 * Update user role in App Plane
 *
 * Called when a user's role is changed in Control Plane.
 * Updates both the users table and organization_memberships.
 */
export async function updateAppPlaneUserRole(
  input: UpdateAppPlaneUserRoleInput
): Promise<UpdateAppPlaneUserRoleResult> {
  logger.info('Updating App Plane user role', {
    tenantId: input.tenantId,
    email: input.userEmail,
    newRole: input.newRole,
    previousRole: input.previousRole,
  });

  const supabase = getSupabaseClient();

  try {
    // Find the user by email and organization
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('email', input.userEmail)
      .eq('organization_id', input.tenantId)
      .single();

    if (findError || !user) {
      logger.error('User not found in App Plane', {
        email: input.userEmail,
        tenantId: input.tenantId,
        error: findError?.message,
      });
      throw new Error(`User not found: ${input.userEmail}`);
    }

    // Update user's role in users table
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        role: input.newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateUserError) {
      logger.error('Failed to update user role', {
        error: updateUserError.message,
        userId: user.id,
      });
      throw new Error(`Failed to update user role: ${updateUserError.message}`);
    }

    // Update organization membership role
    const { error: updateMembershipError } = await supabase
      .from('organization_memberships')
      .update({
        role: input.newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('organization_id', input.tenantId);

    if (updateMembershipError) {
      logger.warn('Failed to update membership role (non-fatal)', {
        error: updateMembershipError.message,
        userId: user.id,
      });
    }

    logger.info('App Plane user role updated successfully', {
      userId: user.id,
      email: input.userEmail,
      newRole: input.newRole,
    });

    return {
      userId: user.id,
      success: true,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating App Plane user role', {
      error: errorMessage,
      email: input.userEmail,
    });
    throw error;
  }
}

/**
 * Revoke user role in App Plane
 *
 * Called when a user is removed from a tenant or their access is revoked.
 * Deactivates the user but doesn't hard-delete (for audit trail).
 */
export async function revokeAppPlaneUserRole(
  input: RevokeAppPlaneUserRoleInput
): Promise<RevokeAppPlaneUserRoleResult> {
  logger.info('Revoking App Plane user role', {
    tenantId: input.tenantId,
    email: input.userEmail,
    role: input.role,
  });

  const supabase = getSupabaseClient();

  try {
    // Find the user by email and organization
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('email', input.userEmail)
      .eq('organization_id', input.tenantId)
      .single();

    if (findError || !user) {
      logger.warn('User not found in App Plane (may already be removed)', {
        email: input.userEmail,
        tenantId: input.tenantId,
      });
      return {
        userId: '',
        deactivated: false,
      };
    }

    // Deactivate user (soft-delete)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        status: 'deactivated',
        deactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to deactivate user', {
        error: updateError.message,
        userId: user.id,
      });
      throw new Error(`Failed to deactivate user: ${updateError.message}`);
    }

    // Deactivate organization membership
    const { error: membershipError } = await supabase
      .from('organization_memberships')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('organization_id', input.tenantId);

    if (membershipError) {
      logger.warn('Failed to revoke membership (non-fatal)', {
        error: membershipError.message,
        userId: user.id,
      });
    }

    logger.info('App Plane user role revoked successfully', {
      userId: user.id,
      email: input.userEmail,
    });

    return {
      userId: user.id,
      deactivated: true,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error revoking App Plane user role', {
      error: errorMessage,
      email: input.userEmail,
    });
    throw error;
  }
}
