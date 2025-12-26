"""
Webhook Bridge - Handles Control Plane events for App Plane provisioning

This bridge receives webhook events from the ARC SaaS Control Plane and provisions
resources in the App Plane's Supabase database. It supports:
- Tenant provisioning (creates organization, admin user, membership)
- Subscription changes (updates limits)
- User invitations (creates invitation with token)
- Keycloak realm mapping (for SSO)

The schema aligns with Components Platform V2's Supabase structure.
"""

import os
import hmac
import hashlib
import logging
from flask import Flask, request, jsonify
from functools import wraps
import requests
import uuid
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'your-webhook-secret')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'http://localhost:27810')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

# Plan tier to org type mapping
PLAN_ORG_TYPE_MAP = {
    'plan-basic': 'individual',
    'plan-standard': 'team',
    'plan-premium': 'enterprise',
}

# Plan tier to default limits
PLAN_LIMITS = {
    'plan-basic': {'max_users': 5, 'max_components': 10000, 'max_storage_gb': 10},
    'plan-standard': {'max_users': 25, 'max_components': 100000, 'max_storage_gb': 100},
    'plan-premium': {'max_users': None, 'max_components': None, 'max_storage_gb': None},  # Unlimited
}


def verify_webhook_signature(f):
    """Decorator to verify webhook HMAC-SHA256 signature"""
    @wraps(f)
    def decorated(*args, **kwargs):
        signature = request.headers.get('X-Webhook-Signature', '')
        if not signature.startswith('sha256='):
            logger.warning('Invalid signature format received')
            return jsonify({'error': 'Invalid signature format'}), 401

        expected_sig = signature[7:]
        payload = request.get_data()
        computed_sig = hmac.new(
            WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, computed_sig):
            logger.warning('Webhook signature verification failed')
            return jsonify({'error': 'Invalid signature'}), 401

        return f(*args, **kwargs)
    return decorated


def supabase_request(method, path, data=None, params=None):
    """Make authenticated request to Supabase PostgREST API"""
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    url = f'{SUPABASE_URL}/rest/v1/{path}'

    try:
        response = requests.request(
            method,
            url,
            headers=headers,
            json=data,
            params=params
        )
        response.raise_for_status()
        return response.json() if response.content else None
    except requests.RequestException as e:
        logger.error(f'Supabase request failed: {e}')
        raise


def supabase_rpc(function_name, params):
    """Call a Supabase RPC function"""
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
    }
    url = f'{SUPABASE_URL}/rest/v1/rpc/{function_name}'

    try:
        response = requests.post(url, headers=headers, json=params)
        response.raise_for_status()
        return response.json() if response.content else None
    except requests.RequestException as e:
        logger.error(f'Supabase RPC failed: {e}')
        raise


@app.route('/webhooks/tenant-provisioned', methods=['POST'])
@verify_webhook_signature
def handle_tenant_provisioned():
    """
    Handle tenant.provisioned event from Control Plane.

    Creates:
    1. Organization (mapped to Control Plane tenant)
    2. Admin user (from tenant's primary contact)
    3. Organization membership (admin role)
    4. Default project
    """
    data = request.json
    logger.info(f'Received tenant.provisioned event: {data.get("tenantId")}')

    tenant_id = data.get('tenantId')
    tenant_key = data.get('tenantKey')
    tenant_name = data.get('tenantName')
    plan_id = data.get('planId', 'plan-basic')
    admin_user = data.get('adminUser', {})
    limits = data.get('limits', {})
    keycloak_realm = data.get('keycloakRealm')  # From Control Plane Keycloak provisioning

    try:
        # Determine org type based on plan
        org_type = PLAN_ORG_TYPE_MAP.get(plan_id, 'individual')

        # Get default limits for plan
        plan_limits = PLAN_LIMITS.get(plan_id, PLAN_LIMITS['plan-basic'])

        # Create organization
        org_id = str(uuid.uuid4())
        org_data = {
            'id': org_id,
            'arc_saas_tenant_id': tenant_id,
            'name': tenant_name,
            'slug': tenant_key,
            'org_type': org_type,
            'plan_id': plan_id,
            'keycloak_realm': keycloak_realm,
            # Use provided limits or fall back to plan defaults
            'max_users': limits.get('maxUsers') or plan_limits['max_users'],
            'max_components': limits.get('maxComponents') or plan_limits['max_components'],
            'max_storage_gb': limits.get('maxStorageGb') or plan_limits['max_storage_gb'],
            'subscription_status': 'active',
            # Enterprise features if premium plan
            'enterprise_name': tenant_name if org_type == 'enterprise' else None,
            'sso_enabled': org_type == 'enterprise',
        }
        supabase_request('POST', 'organizations', org_data)
        logger.info(f'Created organization: {org_id} ({tenant_key})')

        # Create admin user
        user_id = str(uuid.uuid4())
        user_data = {
            'id': user_id,
            'organization_id': org_id,
            'email': admin_user.get('email', '').lower(),
            'first_name': admin_user.get('firstName'),
            'last_name': admin_user.get('lastName'),
            'role': 'admin',
            'keycloak_user_id': admin_user.get('keycloakUserId'),  # If available
        }
        supabase_request('POST', 'users', user_data)
        logger.info(f'Created admin user: {user_id} ({user_data["email"]})')

        # Create organization membership
        membership_data = {
            'id': str(uuid.uuid4()),
            'organization_id': org_id,
            'user_id': user_id,
            'role': 'admin',
            'is_default': True,
        }
        supabase_request('POST', 'organization_memberships', membership_data)
        logger.info(f'Created membership for user {user_id}')

        # Create default project
        project_id = str(uuid.uuid4())
        project_data = {
            'id': project_id,
            'organization_id': org_id,
            'name': 'Default Project',
            'description': 'Your first project - start adding components here!',
            'created_by': user_id,
        }
        supabase_request('POST', 'projects', project_data)
        logger.info(f'Created default project: {project_id}')

        # Log activity
        activity_data = {
            'organization_id': org_id,
            'user_id': user_id,
            'action': 'organization.provisioned',
            'entity_type': 'organization',
            'entity_id': org_id,
            'details': {
                'source': 'control-plane-webhook',
                'plan_id': plan_id,
                'tenant_id': tenant_id,
            }
        }
        supabase_request('POST', 'activity_logs', activity_data)

        return jsonify({
            'status': 'provisioned',
            'organizationId': org_id,
            'adminUserId': user_id,
            'projectId': project_id,
            'portalUrl': f'https://app.ananta.io/{tenant_key}'
        }), 200

    except Exception as e:
        logger.error(f'Tenant provisioning failed: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/webhooks/subscription-changed', methods=['POST'])
@verify_webhook_signature
def handle_subscription_changed():
    """
    Handle subscription.changed event from Control Plane.

    Updates organization limits and subscription status.
    """
    data = request.json
    logger.info(f'Received subscription.changed event: {data.get("tenantId")}')

    tenant_id = data.get('tenantId')
    new_plan_id = data.get('newPlanId')
    new_limits = data.get('newLimits', {})
    subscription_status = data.get('status', 'active')

    try:
        # Find organization by tenant ID
        result = supabase_request(
            'GET',
            'organizations',
            params={'arc_saas_tenant_id': f'eq.{tenant_id}', 'select': '*'}
        )
        if not result:
            logger.warning(f'Organization not found for tenant: {tenant_id}')
            return jsonify({'error': 'Organization not found'}), 404

        org = result[0]
        org_id = org['id']

        # Determine new org type based on plan
        new_org_type = PLAN_ORG_TYPE_MAP.get(new_plan_id, org.get('org_type', 'individual'))

        # Build update data
        update_data = {
            'subscription_status': subscription_status,
            'org_type': new_org_type,
        }

        if new_plan_id:
            update_data['plan_id'] = new_plan_id
            # Update enterprise features based on plan
            update_data['sso_enabled'] = new_org_type == 'enterprise'

        # Update limits
        if 'maxUsers' in new_limits:
            update_data['max_users'] = new_limits['maxUsers']
        if 'maxComponents' in new_limits:
            update_data['max_components'] = new_limits['maxComponents']
        if 'maxStorageGb' in new_limits:
            update_data['max_storage_gb'] = new_limits['maxStorageGb']

        supabase_request(
            'PATCH',
            'organizations',
            update_data,
            params={'id': f'eq.{org_id}'}
        )
        logger.info(f'Updated organization {org_id} subscription')

        # Log activity
        activity_data = {
            'organization_id': org_id,
            'action': 'subscription.changed',
            'entity_type': 'organization',
            'entity_id': org_id,
            'details': {
                'source': 'control-plane-webhook',
                'new_plan_id': new_plan_id,
                'new_status': subscription_status,
                'new_limits': new_limits,
            }
        }
        supabase_request('POST', 'activity_logs', activity_data)

        return jsonify({
            'status': 'updated',
            'organizationId': org_id,
            'newPlanId': new_plan_id,
        }), 200

    except Exception as e:
        logger.error(f'Subscription update failed: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/webhooks/user-invited', methods=['POST'])
@verify_webhook_signature
def handle_user_invited():
    """
    Handle user.invited event from Control Plane.

    Creates an organization invitation using the shared invitation pattern
    that matches Components V2's Supabase schema.
    """
    data = request.json
    logger.info(f'Received user.invited event: {data.get("tenantId")}')

    tenant_id = data.get('tenantId')
    user_email = data.get('userEmail', '').lower()
    role = data.get('role', 'viewer')
    invited_by_email = data.get('invitedByEmail')
    expires_days = data.get('expiresDays', 7)

    # Map Control Plane roles to App Plane roles
    role_map = {
        'admin': 'admin',
        'member': 'engineer',
        'viewer': 'viewer',
        'owner': 'admin',
    }
    app_role = role_map.get(role, 'viewer')

    try:
        # Find organization by tenant ID
        result = supabase_request(
            'GET',
            'organizations',
            params={'arc_saas_tenant_id': f'eq.{tenant_id}', 'select': '*'}
        )
        if not result:
            logger.warning(f'Organization not found for tenant: {tenant_id}')
            return jsonify({'error': 'Organization not found'}), 404

        org = result[0]
        org_id = org['id']

        # Find inviter user if email provided
        invited_by_id = None
        if invited_by_email:
            inviter_result = supabase_request(
                'GET',
                'users',
                params={
                    'organization_id': f'eq.{org_id}',
                    'email': f'eq.{invited_by_email.lower()}',
                    'select': 'id'
                }
            )
            if inviter_result:
                invited_by_id = inviter_result[0]['id']

        # Use the RPC function to create invitation (enforces limits)
        try:
            invitation_result = supabase_rpc('create_organization_invitation', {
                'p_organization_id': org_id,
                'p_email': user_email,
                'p_role': app_role,
                'p_invited_by': invited_by_id,
                'p_expires_days': expires_days,
            })

            if invitation_result:
                invitation = invitation_result[0] if isinstance(invitation_result, list) else invitation_result
                logger.info(f'Created invitation for {user_email} to org {org_id}')

                return jsonify({
                    'status': 'invited',
                    'invitationId': invitation.get('id'),
                    'token': invitation.get('token'),
                    'expiresAt': invitation.get('expires_at'),
                    'organizationId': org_id,
                }), 200

        except requests.RequestException as rpc_error:
            # Check if it's a member limit error
            error_msg = str(rpc_error)
            if 'member limit' in error_msg.lower():
                logger.warning(f'Organization {org_id} reached member limit')
                return jsonify({
                    'error': 'Organization has reached its member limit',
                    'code': 'MEMBER_LIMIT_REACHED'
                }), 400
            raise

        # Fallback: direct insert if RPC fails
        logger.info('RPC failed, falling back to direct insert')
        import secrets
        token = secrets.token_hex(32)
        expires_at = (datetime.utcnow() + timedelta(days=expires_days)).isoformat()

        invitation_data = {
            'id': str(uuid.uuid4()),
            'organization_id': org_id,
            'email': user_email,
            'role': app_role,
            'token': token,
            'invited_by': invited_by_id,
            'expires_at': expires_at,
        }
        supabase_request('POST', 'organization_invitations', invitation_data)

        return jsonify({
            'status': 'invited',
            'invitationId': invitation_data['id'],
            'token': token,
            'expiresAt': expires_at,
            'organizationId': org_id,
        }), 200

    except Exception as e:
        logger.error(f'User invitation failed: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/webhooks/tenant-deprovisioned', methods=['POST'])
@verify_webhook_signature
def handle_tenant_deprovisioned():
    """
    Handle tenant.deprovisioned event from Control Plane.

    Marks organization as deactivated (soft delete) or fully deletes based on policy.
    """
    data = request.json
    logger.info(f'Received tenant.deprovisioned event: {data.get("tenantId")}')

    tenant_id = data.get('tenantId')
    hard_delete = data.get('hardDelete', False)

    try:
        # Find organization
        result = supabase_request(
            'GET',
            'organizations',
            params={'arc_saas_tenant_id': f'eq.{tenant_id}', 'select': '*'}
        )
        if not result:
            logger.warning(f'Organization not found for tenant: {tenant_id}')
            return jsonify({'error': 'Organization not found'}), 404

        org = result[0]
        org_id = org['id']

        if hard_delete:
            # Hard delete - cascades to all related data
            supabase_request('DELETE', 'organizations', params={'id': f'eq.{org_id}'})
            logger.info(f'Hard deleted organization: {org_id}')
        else:
            # Soft delete - mark as deactivated
            update_data = {
                'subscription_status': 'cancelled',
                'settings': {
                    **org.get('settings', {}),
                    'deactivated_at': datetime.utcnow().isoformat(),
                    'deactivated_reason': data.get('reason', 'control-plane-deprovisioning'),
                }
            }
            supabase_request('PATCH', 'organizations', update_data, params={'id': f'eq.{org_id}'})
            logger.info(f'Soft deleted organization: {org_id}')

        return jsonify({
            'status': 'deprovisioned',
            'organizationId': org_id,
            'hardDelete': hard_delete,
        }), 200

    except Exception as e:
        logger.error(f'Tenant deprovisioning failed: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/webhooks/keycloak-realm-created', methods=['POST'])
@verify_webhook_signature
def handle_keycloak_realm_created():
    """
    Handle keycloak.realm.created event from Control Plane.

    Updates organization with Keycloak realm mapping for SSO.
    """
    data = request.json
    logger.info(f'Received keycloak.realm.created event: {data.get("tenantId")}')

    tenant_id = data.get('tenantId')
    realm_name = data.get('realmName')
    realm_url = data.get('realmUrl')

    try:
        # Find organization
        result = supabase_request(
            'GET',
            'organizations',
            params={'arc_saas_tenant_id': f'eq.{tenant_id}', 'select': '*'}
        )
        if not result:
            return jsonify({'error': 'Organization not found'}), 404

        org = result[0]
        org_id = org['id']

        # Update with Keycloak realm info
        update_data = {
            'keycloak_realm': realm_name,
            'sso_enabled': True,
            'enterprise_settings': {
                **org.get('enterprise_settings', {}),
                'keycloak_realm_url': realm_url,
            }
        }
        supabase_request('PATCH', 'organizations', update_data, params={'id': f'eq.{org_id}'})
        logger.info(f'Updated organization {org_id} with Keycloak realm: {realm_name}')

        return jsonify({
            'status': 'updated',
            'organizationId': org_id,
            'keycloakRealm': realm_name,
        }), 200

    except Exception as e:
        logger.error(f'Keycloak realm update failed: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'webhook-bridge',
        'version': '1.0.0',
    }), 200


@app.route('/ready', methods=['GET'])
def ready():
    """Readiness check - verifies Supabase connectivity"""
    try:
        # Try a simple query to verify DB connection
        supabase_request('GET', 'organizations', params={'limit': '1'})
        return jsonify({'status': 'ready'}), 200
    except Exception as e:
        logger.error(f'Readiness check failed: {e}')
        return jsonify({'status': 'not ready', 'error': str(e)}), 503


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 27600))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
