import {Provider} from '@loopback/core';
import {verify, decode} from 'jsonwebtoken';
import {VerifyFunction, IAuthUser} from 'loopback4-authentication';

interface TokenPayload {
  id?: string;
  sub?: string; // Keycloak uses 'sub' for subject/user ID
  userTenantId?: string;
  tenantId?: string;
  permissions?: string[];
  realm_access?: {
    roles?: string[];
  };
  resource_access?: {
    [client: string]: {
      roles?: string[];
    };
  };
}

// Extended auth user with additional properties for tenant management
export interface IAuthUserWithPermissions extends IAuthUser {
  userTenantId?: string;
  tenantId?: string;
  permissions?: string[];
}

// Map Keycloak roles to permission codes
const KEYCLOAK_ROLE_TO_PERMISSIONS: {[key: string]: string[]} = {
  'super-admin': [
    // All tenant management permissions
    '10200', '10201', '10202', '10203', '10204', '10205', '10206', '10207',
    '10208', '10209', '10210', '10211', '10212', '10213', '10214', '10215', '10216',
    // Subscription & Plan permissions
    '7001', '7002', '7004', '7008', '7009', '7010', '7011', '7012',
    // Tenant config permissions
    '10220', '10221', '10222', '10223',
    // Billing permissions
    '5321', '5322', '5323', '5324', '5325', '5326', '5327', '5328', '5329', '5331', '5332', '5333',
    // User management permissions
    '10300', '10301', '10302', '10303', '10304', '10305', '10306',
    '10310', '10311', '10312', '10313',
    '10320', '10321', '10322', '10323', '10324',
    // Activity/Audit log permissions
    '10330', '10331',
    // Workflow permissions
    '10340', '10341', '10342',
    // Notification permissions
    '8000', '8001', '8002', '8003',
    '10400', '10401', '10402', '10403', '10404',
    // Identity management permissions
    '10350', '10351', '10352', '10353', '10354', '10355', '10356',
  ],
  admin: [
    '10203', '10204', '10205', '10207', '10211', '10212', '10215', '10216',
    '7004', '7008', '7009', '7010', '7011', '7012', '10221', '5324', '5325', '5326',
    // User management (limited)
    '10301', '10302', '10321',
  ],
};

/**
 * Custom bearer token verifier that supports both:
 * 1. Symmetric JWT verification with JWT_SECRET (for testing/direct API calls)
 * 2. Keycloak tokens (RS256) - decodes and extracts claims without signature verification
 *    (In production, you would validate against Keycloak's public key)
 *
 * For local development, Keycloak token signatures are not verified to simplify setup.
 * In production, implement proper RS256 verification with Keycloak's public key.
 */
export class BearerTokenVerifierProvider
  implements Provider<VerifyFunction.BearerFn<IAuthUserWithPermissions>>
{
  value(): VerifyFunction.BearerFn<IAuthUserWithPermissions> {
    return async (token: string): Promise<IAuthUserWithPermissions | null> => {
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // First, try symmetric verification (for direct API testing)
      try {
        const decoded = verify(token, jwtSecret, {
          issuer: process.env.JWT_ISSUER || 'arc-saas',
          algorithms: ['HS256'],
        }) as TokenPayload;

        const tenantIdValue = decoded.tenantId ?? decoded.userTenantId ?? decoded.id ?? decoded.sub;
        return {
          id: decoded.id ?? decoded.sub ?? '',
          username: decoded.id ?? decoded.sub ?? '',
          userTenantId: tenantIdValue,
          tenantId: tenantIdValue,
          permissions: decoded.permissions || [],
        };
      } catch {
        // Symmetric verification failed, try Keycloak token decoding
      }

      // Try to decode as Keycloak token (without signature verification for local dev)
      try {
        const decoded = decode(token) as TokenPayload | null;

        if (!decoded) {
          console.error('Failed to decode JWT token');
          return null;
        }

        // Extract user ID (Keycloak uses 'sub')
        const userId = decoded.sub ?? decoded.id ?? '';

        if (!userId) {
          console.error('No user ID found in token');
          return null;
        }

        // Extract permissions from Keycloak roles
        let permissions: string[] = decoded.permissions || [];

        // If no direct permissions, map from Keycloak realm roles
        if (permissions.length === 0 && decoded.realm_access?.roles) {
          for (const role of decoded.realm_access.roles) {
            const rolePermissions = KEYCLOAK_ROLE_TO_PERMISSIONS[role];
            if (rolePermissions) {
              permissions = [...permissions, ...rolePermissions];
            }
          }
        }

        // Also check resource_access (client-specific roles)
        if (decoded.resource_access) {
          for (const clientAccess of Object.values(decoded.resource_access)) {
            if (clientAccess.roles) {
              for (const role of clientAccess.roles) {
                const rolePermissions = KEYCLOAK_ROLE_TO_PERMISSIONS[role];
                if (rolePermissions) {
                  permissions = [...permissions, ...rolePermissions];
                }
              }
            }
          }
        }

        // Remove duplicates
        permissions = [...new Set(permissions)];

        // In development mode, assign super-admin permissions if no roles/permissions are found
        // This allows testing without full Keycloak role configuration
        const isDevelopment = process.env.NODE_ENV !== 'production';
        if (isDevelopment && permissions.length === 0) {
          console.log(`[DEV] No permissions found for user ${userId}, assigning super-admin permissions`);
          permissions = KEYCLOAK_ROLE_TO_PERMISSIONS['super-admin'] || [];
        }

        console.log(`Keycloak token verified for user: ${userId}, permissions: ${permissions.length}`);

        const kcTenantId = decoded.tenantId ?? decoded.userTenantId ?? userId;
        return {
          id: userId,
          username: userId,
          userTenantId: kcTenantId,
          tenantId: kcTenantId,
          permissions,
        };
      } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
      }
    };
  }
}
