"""
Components Platform V2 - Database Middleware API
Orchestrates queries between Components V2 Postgres and Supabase
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import logging
import jwt
import requests
from datetime import datetime, timedelta
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
import random
import json

# Event bus for audit logging (login/logout events)
try:
    import sys
    sys.path.insert(0, "/app/shared")
    from shared.event_bus import EventPublisher
    EVENT_BUS_AVAILABLE = True
except ImportError:
    EVENT_BUS_AVAILABLE = False
    EventPublisher = None

app = Flask(__name__)

# Configure CORS with restricted origins
# In production, set ALLOWED_ORIGINS environment variable to specific origins
allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:*,http://127.0.0.1:*').split(',')
CORS(app, origins=allowed_origins, supports_credentials=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Log CORS configuration at startup
logger.info(f"CORS allowed origins: {allowed_origins}")

# Database configurations
COMPONENTS_DB_CONFIG = {
    'host': os.getenv('COMPONENTS_DB_HOST', 'components-v2-postgres'),
    'port': os.getenv('COMPONENTS_DB_PORT', '5432'),
    'database': os.getenv('COMPONENTS_DB_NAME', 'components_v2'),
    'user': os.getenv('COMPONENTS_DB_USER', 'postgres'),
    'password': os.getenv('COMPONENTS_DB_PASSWORD', 'postgres')
}

SUPABASE_DB_CONFIG = {
    'host': os.getenv('SUPABASE_DB_HOST', 'components-v2-supabase-db'),
    'port': os.getenv('SUPABASE_DB_PORT', '5432'),
    'database': os.getenv('SUPABASE_DB_NAME', 'supabase'),
    'user': os.getenv('SUPABASE_DB_USER', 'postgres'),
    'password': os.getenv('SUPABASE_DB_PASSWORD', 'supabase-postgres-secure-2024')
}

# Supabase configuration for Auth API
SUPABASE_URL = os.getenv('SUPABASE_URL', 'http://components-v2-supabase-kong:8000')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')
SUPABASE_PASSWORD_SALT = os.getenv('SUPABASE_PASSWORD_SALT', 'components-platform-sso')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')

# Auth0 Platform Organization ID
PLATFORM_ORG_ID = 'org_oNtVXvVrzXz1ubua'  # Ananta Component Platform
PLATFORM_ORG_UUID = 'a0000000-0000-0000-0000-000000000000'  # Special UUID for platform admins

# Auth0 Management API Configuration
AUTH0_DOMAIN = os.getenv('AUTH0_DOMAIN', '')
AUTH0_MGMT_CLIENT_ID = os.getenv('AUTH0_MGMT_CLIENT_ID', '')
AUTH0_MGMT_CLIENT_SECRET = os.getenv('AUTH0_MGMT_CLIENT_SECRET', '')
AUTH0_MGMT_AUDIENCE = f'https://{AUTH0_DOMAIN}/api/v2/' if AUTH0_DOMAIN else ''

# Cache for Auth0 Management API token
_auth0_mgmt_token_cache = {
    'token': None,
    'expires_at': None
}


def send_onboarding_email(to_email: str, user_name: str, plan: str, trial_end_iso: str, org_name: str = None):
    """
    Send a simple onboarding email using SMTP if email env is configured.

    Required env vars:
      EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
    """
    try:
        email_host = os.getenv('EMAIL_HOST')
        email_port = int(os.getenv('EMAIL_PORT', '587'))
        email_user = os.getenv('EMAIL_USER')
        email_pass = os.getenv('EMAIL_PASS')
        email_from = os.getenv('EMAIL_FROM') or email_user

        # Only proceed if SMTP is configured
        if not (email_host and email_user and email_pass and email_from):
            logger.info('[EMAIL] SMTP not configured; skipping onboarding email')
            return

        subject = 'Welcome to Components Platform'
        org_line = f" for {org_name}" if org_name else ''
        body = (
            f"Hi {user_name or to_email},\n\n"
            f"Welcome to Components Platform{org_line}! Your account is ready.\n\n"
            f"Current plan: {plan.title()} (trial).\n"
            f"Your free trial ends on: {trial_end_iso}.\n\n"
            f"Next steps:\n"
            f" - Upload a BOM to see enrichment in action.\n"
            f" - Invite your teammates from Organization Settings.\n"
            f" - Explore results and export enriched data.\n\n"
            f"Questions? Reply to this email and we’ll help you get set up.\n\n"
            f"— Components Platform Team"
        )

        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = formataddr(('Components Platform', email_from))
        msg['To'] = to_email

        with smtplib.SMTP(email_host, email_port, timeout=10) as server:
            server.starttls()
            server.login(email_user, email_pass)
            server.sendmail(email_from, [to_email], msg.as_string())
        logger.info(f"[EMAIL] Onboarding email sent to {to_email}")
    except Exception as e:
        logger.warning(f"[EMAIL] Failed to send onboarding email to {to_email}: {e}")

def get_components_db():
    """Get connection to Components V2 Postgres (READ-ONLY)"""
    return psycopg2.connect(**COMPONENTS_DB_CONFIG, cursor_factory=RealDictCursor)

def get_supabase_db():
    """Get connection to Supabase (READ-WRITE)"""
    return psycopg2.connect(**SUPABASE_DB_CONFIG, cursor_factory=RealDictCursor)

def set_session_variables(cursor, user_id, organization_id, user_role):
    """
    Set PostgreSQL session variables for RLS policies.

    These session variables are used by RLS helper functions:
    - current_user_id() -> app.user_id
    - current_user_organization_id() -> app.organization_id
    - is_super_admin() -> app.user_role

    Must be called before any queries that rely on RLS policies.
    """
    try:
        if user_id:
            cursor.execute("SET LOCAL app.user_id = %s", (str(user_id),))
        if organization_id:
            cursor.execute("SET LOCAL app.organization_id = %s", (str(organization_id),))
        if user_role:
            cursor.execute("SET LOCAL app.user_role = %s", (user_role,))
        logger.debug(f"[RLS] Set session vars: user_id={user_id}, org_id={organization_id}, role={user_role}")
    except Exception as e:
        logger.error(f"[RLS] Failed to set session variables: {e}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint - tests both database connections"""
    try:
        # Test Components V2 Postgres
        with get_components_db() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')

        # Test Supabase
        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')

        return jsonify({
            'status': 'ok',
            'databases': {
                'components_v2_postgres': 'connected',
                'supabase': 'connected'
            }
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/components/<mpn>', methods=['GET'])
def get_component_by_mpn(mpn):
    """Get component details from central database by MPN"""
    try:
        with get_components_db() as conn:
            with conn.cursor() as cur:
                # Get component
                cur.execute("""
                    SELECT * FROM components
                    WHERE manufacturer_part_number = %s
                """, (mpn,))
                component = cur.fetchone()

                if not component:
                    return jsonify({'error': 'Component not found', 'mpn': mpn}), 404

                # Get manufacturer
                cur.execute("SELECT * FROM manufacturers WHERE id = %s", (component['manufacturer_id'],))
                manufacturer = cur.fetchone()

                # Get category
                cur.execute("SELECT * FROM categories WHERE id = %s", (component['category_id'],))
                category = cur.fetchone()

                # Get SKUs
                cur.execute("SELECT * FROM skus WHERE component_id = %s", (component['id'],))
                skus = cur.fetchall()

                return jsonify({
                    'component': dict(component),
                    'manufacturer': dict(manufacturer) if manufacturer else None,
                    'category': dict(category) if category else None,
                    'skus': [dict(sku) for sku in skus],
                    'source': 'components_v2_postgres'
                }), 200
    except Exception as e:
        logger.error(f"Error fetching component {mpn}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/components/search', methods=['GET'])
def search_components():
    """Search components in central database"""
    query = request.args.get('q', '')

    # Safely parse limit and enforce an upper bound to
    # prevent accidental large scans under heavy load.
    limit = request.args.get('limit', 20, type=int)
    if not isinstance(limit, int) or limit <= 0:
        limit = 20
    # Cap at 500 to avoid unbounded result sets
    if limit > 500:
        limit = 500

    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400

    try:
        with get_components_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT c.*, m.name as manufacturer_name
                    FROM components c
                    LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
                    WHERE c.manufacturer_part_number ILIKE %s
                       OR c.description ILIKE %s
                    LIMIT %s
                """, (f'%{query}%', f'%{query}%', limit))
                components = cur.fetchall()

                return jsonify({
                    'query': query,
                    'count': len(components),
                    'components': [dict(c) for c in components],
                    'source': 'components_v2_postgres'
                }), 200
    except Exception as e:
        logger.error(f"Error searching components: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/customer-boms/<org_id>', methods=['GET'])
def get_customer_boms(org_id):
    """Get customer BOMs from Supabase"""
    try:
        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT b.*, p.name as project_name
                    FROM boms b
                    JOIN projects p ON b.project_id = p.id
                    WHERE p.organization_id = %s
                """, (org_id,))
                boms = cur.fetchall()

                return jsonify({
                    'organization_id': org_id,
                    'count': len(boms),
                    'boms': [dict(b) for b in boms],
                    'source': 'supabase'
                }), 200
    except Exception as e:
        logger.error(f"Error fetching BOMs for org {org_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/enrich-bom', methods=['POST'])
def enrich_bom():
    """Enrich BOM line items with data from central database"""
    data = request.json
    bom_id = data.get('bom_id')

    if not bom_id:
        return jsonify({'error': 'bom_id is required'}), 400

    try:
        enriched_items = []

        # Get BOM line items from Supabase
        with get_supabase_db() as supabase_conn:
            with supabase_conn.cursor() as cur:
                cur.execute("""
                    SELECT * FROM bom_line_items
                    WHERE bom_id = %s
                """, (bom_id,))
                line_items = cur.fetchall()

        # Enrich each line item with data from central DB.
        # Reuse connections instead of opening a new Supabase
        # connection per item to avoid connection churn.
        with get_components_db() as components_conn, get_supabase_db() as supabase_conn:
            with components_conn.cursor() as comp_cur, supabase_conn.cursor() as update_cur:
                for item in line_items:
                    comp_cur.execute(
                        """
                        SELECT * FROM components
                        WHERE manufacturer_part_number = %s
                        """,
                        (item['mpn'],),
                    )
                    component = comp_cur.fetchone()

                    if component:
                        update_cur.execute(
                            """
                            UPDATE bom_line_items
                            SET matched_component_id = %s,
                                lifecycle_status = %s,
                                description = %s,
                                updated_at = NOW()
                            WHERE id = %s
                            """,
                            (
                                component['id'],
                                component.get('lifecycle_status'),
                                component.get('description'),
                                item['id'],
                            ),
                        )

                        enriched_items.append(
                            {
                                'line_item_id': item['id'],
                                'mpn': item['mpn'],
                                'status': 'enriched',
                                'component_id': component['id'],
                            }
                        )
                    else:
                        enriched_items.append(
                            {
                                'line_item_id': item['id'],
                                'mpn': item['mpn'],
                                'status': 'not_found',
                            }
                        )

                # Persist all updates in a single transaction
                supabase_conn.commit()

        # Update BOM status
        with get_supabase_db() as supabase_conn:
            with supabase_conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE boms
                    SET status = 'ENRICHED', updated_at = NOW()
                    WHERE id = %s
                    """,
                    (bom_id,),
                )
                supabase_conn.commit()

        enriched_count = sum(1 for item in enriched_items if item['status'] == 'enriched')
        not_found_count = sum(1 for item in enriched_items if item['status'] == 'not_found')

        return jsonify({
            'bom_id': bom_id,
            'total_items': len(line_items),
            'enriched_count': enriched_count,
            'not_found_count': not_found_count,
            'items': enriched_items
        }), 200

    except Exception as e:
        logger.error(f"Error enriching BOM {bom_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/auth/create-supabase-session', methods=['POST'])
def create_supabase_session():
    """
    DEPRECATED (Migration 080): This endpoint is no longer needed.

    With Auth0-only authentication (migration 080), the database RLS functions
    now read directly from Auth0 JWT claims. No Supabase session is required.

    The frontend should pass the Auth0 access token directly to the API,
    and RLS functions will:
    - Look up org_id from JWT → organizations.auth0_org_id
    - Read role from JWT roles array

    This endpoint is kept for backwards compatibility during transition.
    It will be removed in a future release.

    LEGACY DOCUMENTATION:
    ---------------------
    Create a Supabase Auth session for an Auth0 user.

    This enables dual authentication:
    - Auth0 for social login (Google/Microsoft)
    - Supabase Auth for RLS policies

    Flow:
    1. Check if user is in Platform Organization (Auth0)
    2. If platform admin: Create with super_admin role
    3. If customer: Verify exists in Supabase and sync
    4. Generate Supabase session token
    5. Return session to frontend
    """
    # DEPRECATION WARNING
    logger.warning("[DEPRECATED] /auth/create-supabase-session endpoint is deprecated. Use direct Auth0 JWT instead.")
    data = request.json
    email = data.get('email')
    user_id = data.get('user_id')  # From Supabase users table (can be None for platform admins)
    auth0_org_id = data.get('org_id')  # Auth0 organization ID
    auth0_roles = data.get('roles', [])  # Auth0 roles
    full_name = data.get('full_name', email)

    # DEBUG: Log received request data
    logger.info(f"[AUTH DEBUG] Received create-supabase-session request: email={email}, user_id={user_id}, auth0_org_id={auth0_org_id}, auth0_roles={auth0_roles}, PLATFORM_ORG_ID={PLATFORM_ORG_ID}")

    if not email:
        return jsonify({'error': 'email is required'}), 400

    # EXPLICIT USER TYPE DETECTION
    # Security Model:
    # 1. Platform Admin/Super Admin → INVITE-ONLY (must be in Auth0 Platform Org)
    # 2. Customer → SELF-SIGNUP (anyone can register via social login)
    # 3. Unauthorized → REJECT

    is_platform_admin = False
    user_type = "UNKNOWN"
    is_invite_only = False

    if auth0_org_id == PLATFORM_ORG_ID:
        # ✅ PLATFORM ADMIN (INVITE-ONLY)
        # User is in Platform Organization - they were explicitly invited
        is_platform_admin = True
        is_invite_only = True

        if 'super_admin' in auth0_roles or 'Super Admin' in auth0_roles or 'platform:super_admin' in auth0_roles:
            user_type = "PLATFORM_SUPER_ADMIN"
        elif 'admin' in auth0_roles or 'Admin' in auth0_roles or 'platform:admin' in auth0_roles:
            user_type = "PLATFORM_ADMIN"
        else:
            user_type = "PLATFORM_MEMBER"  # In platform org but no admin role

        logger.info(f"[SECURITY] 🔒 INVITE-ONLY access granted: {user_type}")

    elif auth0_org_id is None or auth0_org_id == '':
        # ✅ CUSTOMER (SELF-SIGNUP ALLOWED)
        # User is NOT in any organization - authenticated via social login
        # Anyone can become a customer (self-service registration)

        # 🔒 SECURITY CHECK: Prevent platform admins from logging in via customer portal
        # Platform admins MUST use /admin-login to get org_id in their token
        # NOTE: This check is optional - if is_platform_admin column doesn't exist, skip it
        try:
            with get_supabase_db() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT email
                        FROM users
                        WHERE email = %s
                        LIMIT 1
                    """, (email,))
                    platform_admin_check = cur.fetchone()

                    # If is_platform_admin column exists in future, uncomment this check:
                    # if platform_admin_check and platform_admin_check.get('is_platform_admin'):
                    #     logger.warning(f"[SECURITY] ⛔ REJECTED: Platform admin {email} attempted customer login without org_id")
                    #     return jsonify({
                    #         'error': 'Platform admin accounts must use the admin login portal',
                    #         'message': 'Please access the platform via /admin-login',
                    #         'admin_login_url': '/admin-login'
                    #     }), 403
        except Exception as e:
            # Column doesn't exist yet, skip the check
            logger.debug(f"[SECURITY] Platform admin check skipped (column not found): {e}")

        user_type = "CUSTOMER"
        is_platform_admin = False
        is_invite_only = False

        logger.info(f"[SECURITY] 🌐 SELF-SIGNUP access: {user_type}")

    else:
        # ✅ ENTERPRISE CUSTOMER (INVITE-ONLY for that org)
        # User is in ANOTHER organization (enterprise customer in future)
        user_type = f"ENTERPRISE_CUSTOMER_ORG_{auth0_org_id}"
        is_platform_admin = False
        is_invite_only = True  # Enterprise customers are also invite-only

        logger.info(f"[SECURITY] 🏢 ENTERPRISE access: {user_type}")

    logger.info(f"[AUTH DEBUG] ✅ USER TYPE IDENTIFIED: {user_type}")
    logger.info(f"[AUTH DEBUG] is_platform_admin={is_platform_admin}, is_invite_only={is_invite_only}, auth0_org_id={auth0_org_id}")

    try:
        new_user_created = False
        subscription_info = None
        if is_platform_admin:
            # Platform Admin Path: Create/update user with platform organization
            logger.info(f"✅ {user_type} detected: {email}")

            # Determine role from Auth0 roles
            platform_role = 'admin'  # Default
            if auth0_roles:
                if 'super_admin' in auth0_roles or 'Super Admin' in auth0_roles:
                    platform_role = 'super_admin'
                elif 'admin' in auth0_roles or 'Admin' in auth0_roles:
                    platform_role = 'admin'

            # Create or update user in Supabase with platform org UUID
            with get_supabase_db() as conn:
                with conn.cursor() as cur:
                    # Check if user already exists
                    cur.execute("SELECT id, organization_id FROM users WHERE email = %s LIMIT 1", (email,))
                    existing_user = cur.fetchone()

                    if existing_user:
                        # Update existing user
                        cur.execute("""
                            UPDATE users
                            SET organization_id = %s,
                                role = %s,
                                is_active = true,
                                full_name = %s,
                                updated_at = NOW()
                            WHERE email = %s
                            RETURNING id, email, organization_id, role, full_name
                        """, (PLATFORM_ORG_UUID, platform_role, full_name, email))
                        user = cur.fetchone()
                        logger.info(f"Updated platform admin user: {email}")
                    else:
                        # Create new platform admin user
                        cur.execute("""
                            INSERT INTO users (email, organization_id, role, is_active, full_name, created_at, updated_at)
                            VALUES (%s, %s, %s, true, %s, NOW(), NOW())
                            RETURNING id, email, organization_id, role, full_name
                        """, (email, PLATFORM_ORG_UUID, platform_role, full_name))
                        user = cur.fetchone()
                        logger.info(f"Created platform admin user: {email}")
                        new_user_created = True

                    # Ensure organization membership exists for RLS policies
                    cur.execute("""
                        INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
                        VALUES (%s, %s, %s, NOW(), NOW())
                        ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
                    """, (user['id'], PLATFORM_ORG_UUID, platform_role))

                    conn.commit()
        elif user_type.startswith("ENTERPRISE_CUSTOMER"):
            # ============================================================
            # ENTERPRISE CUSTOMER PATH
            # ============================================================
            # User is in an Auth0 organization (not platform org)
            # Look up Supabase organization by auth0_org_id
            # Enterprise orgs must be pre-created with matching auth0_org_id
            logger.info(f"✅ {user_type} detected: {email}")
            logger.info(f"[ENTERPRISE] Looking up organization by auth0_org_id: {auth0_org_id}")

            with get_supabase_db() as conn:
                with conn.cursor() as cur:
                    # Step 1: Look up organization by auth0_org_id
                    cur.execute("""
                        SELECT id, name, org_type, enterprise_name, max_users
                        FROM organizations
                        WHERE auth0_org_id = %s
                        LIMIT 1
                    """, (auth0_org_id,))
                    enterprise_org = cur.fetchone()

                    if not enterprise_org:
                        # Enterprise org not found - must be pre-created by admin
                        logger.error(f"[ENTERPRISE] Organization not found for auth0_org_id: {auth0_org_id}")
                        return jsonify({
                            'error': 'Enterprise organization not configured',
                            'message': 'Your organization has not been set up in the system. Please contact your administrator.',
                            'auth0_org_id': auth0_org_id
                        }), 403

                    org_id = enterprise_org['id']
                    org_name = enterprise_org['name'] or enterprise_org['enterprise_name']
                    logger.info(f"[ENTERPRISE] Found organization: {org_name} (id={org_id})")

                    # Step 2: Check max_users limit if set
                    max_users = enterprise_org.get('max_users')
                    if max_users:
                        cur.execute("""
                            SELECT COUNT(*) as user_count
                            FROM organization_memberships
                            WHERE organization_id = %s
                        """, (org_id,))
                        current_count = cur.fetchone()['user_count']
                        if current_count >= max_users:
                            logger.warning(f"[ENTERPRISE] Organization {org_name} has reached max users: {current_count}/{max_users}")
                            return jsonify({
                                'error': 'Organization user limit reached',
                                'message': f'Your organization has reached its maximum user limit ({max_users}). Please contact your administrator.',
                                'current_users': current_count,
                                'max_users': max_users
                            }), 403

                    # Step 3: Check if user already exists
                    cur.execute("""
                        SELECT u.id, u.email, u.organization_id, u.full_name, u.is_active,
                               om.role as membership_role
                        FROM users u
                        LEFT JOIN organization_memberships om ON u.id = om.user_id AND om.organization_id = %s
                        WHERE u.email = %s
                        LIMIT 1
                    """, (org_id, email))
                    user = cur.fetchone()

                    # Determine role from Auth0 roles (enterprise-specific)
                    enterprise_role = 'member'  # Default for enterprise users
                    if auth0_roles:
                        if 'admin' in auth0_roles or 'Admin' in auth0_roles or 'org:admin' in auth0_roles:
                            enterprise_role = 'admin'
                        elif 'owner' in auth0_roles or 'Owner' in auth0_roles or 'org:owner' in auth0_roles:
                            enterprise_role = 'owner'

                    if not user:
                        # First-time enterprise user - create user with enterprise org
                        logger.info(f"[ENTERPRISE] First-time user: {email}, adding to org {org_name}")

                        cur.execute("""
                            INSERT INTO users (email, organization_id, is_active, full_name, created_at, updated_at)
                            VALUES (%s, %s, true, %s, NOW(), NOW())
                            RETURNING id, email, organization_id, full_name
                        """, (email, org_id, full_name))
                        user = cur.fetchone()

                        # Create organization membership
                        cur.execute("""
                            INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
                            VALUES (%s, %s, %s, NOW(), NOW())
                        """, (user['id'], org_id, enterprise_role))

                        logger.info(f"[ENTERPRISE] Created user with role {enterprise_role}: {email}")
                        new_user_created = True

                        # Publish signup event for enterprise users
                        try:
                            from shared.event_bus import EventPublisher
                            EventPublisher.user_signup(
                                user_id=str(user['id']),
                                email=email,
                                organization_id=str(org_id),
                                role=enterprise_role,
                                plan='enterprise',
                                status='active',
                                full_name=full_name,
                            )
                            logger.info(f"[ENTERPRISE] Published user_signup event for: {email}")
                        except Exception as e:
                            logger.warning(f"[ENTERPRISE] Failed to publish signup event: {e}")
                        conn.commit()
                    else:
                        # Existing user - update if needed
                        user_org_id = user.get('organization_id')

                        if str(user_org_id) != str(org_id):
                            # User exists but in different org - this shouldn't happen for enterprise
                            logger.warning(f"[ENTERPRISE] User {email} exists in different org: {user_org_id} vs {org_id}")
                            # Update user's organization
                            cur.execute("""
                                UPDATE users SET organization_id = %s, updated_at = NOW()
                                WHERE email = %s
                            """, (org_id, email))

                        # Ensure membership exists with correct role
                        cur.execute("""
                            INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
                            VALUES (%s, %s, %s, NOW(), NOW())
                            ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
                        """, (user['id'], org_id, enterprise_role))

                        # Update full_name if changed
                        if full_name and user.get('full_name') != full_name:
                            cur.execute("""
                                UPDATE users SET full_name = %s, updated_at = NOW()
                                WHERE email = %s
                            """, (full_name, email))
                            logger.info(f"[ENTERPRISE] Updated full_name for: {email}")

                        conn.commit()
                        logger.info(f"[ENTERPRISE] Updated existing user: {email}")

                    # Step 4: Get subscription info for enterprise org
                    cur.execute("""
                        SELECT s.status, sp.slug as plan, s.trial_end, s.current_period_end
                        FROM subscriptions s
                        JOIN subscription_plans sp ON s.plan_id = sp.id
                        WHERE s.organization_id = %s
                        ORDER BY s.created_at DESC
                        LIMIT 1
                    """, (org_id,))
                    sub = cur.fetchone()
                    if sub:
                        subscription_info = {
                            'plan': sub['plan'],
                            'status': sub['status'],
                            'trial_end': sub['trial_end'].isoformat() if sub.get('trial_end') else None,
                            'current_period_end': sub['current_period_end'].isoformat() if sub.get('current_period_end') else None
                        }
                    else:
                        # Enterprise orgs should have subscription, but fallback to enterprise plan
                        subscription_info = {
                            'plan': 'enterprise',
                            'status': 'active'
                        }

        else:
            # ============================================================
            # INDIVIDUAL CUSTOMER PATH (SELF-SIGNUP)
            # ============================================================
            # User logged in via social login without Auth0 org
            # Create new individual organization for them
            logger.info(f"✅ {user_type} detected: {email}")

            with get_supabase_db() as conn:
                with conn.cursor() as cur:
                    # Query by email (not by user_id which is Auth0 sub)
                    cur.execute("""
                        SELECT u.id, u.email, u.organization_id, u.full_name, u.is_active,
                               om.role as membership_role
                        FROM users u
                        LEFT JOIN organization_memberships om ON u.id = om.user_id
                        WHERE u.email = %s
                        LIMIT 1
                    """, (email,))
                    user = cur.fetchone()

                    if not user:
                        # First-time customer login - create organization AND user
                        logger.info(f"First-time customer: {email}, creating organization and user")

                        # Extract first name for organization name
                        first_name = full_name.split()[0] if full_name and ' ' in full_name else full_name or email.split('@')[0]
                        org_name = f"{first_name}'s Org"

                        # Create organization for the customer (individual plan)
                        cur.execute("""
                            INSERT INTO organizations (name, org_type, is_suspended, created_at, updated_at)
                            VALUES (%s, 'individual', false, NOW(), NOW())
                            RETURNING id, name
                        """, (org_name,))
                        org = cur.fetchone()
                        org_id = org['id']
                        logger.info(f"Created organization: {org_name}, org_id={org_id}, type=individual")

                        # Create user with the new organization
                        # Note: role is stored in organization_memberships, not users table
                        cur.execute("""
                            INSERT INTO users (email, organization_id, is_active, full_name, created_at, updated_at)
                            VALUES (%s, %s, true, %s, NOW(), NOW())
                            RETURNING id, email, organization_id, full_name
                        """, (email, org_id, full_name))
                        user = cur.fetchone()

                        # Create organization membership with owner role
                        cur.execute("""
                            INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
                            VALUES (%s, %s, 'owner', NOW(), NOW())
                        """, (user['id'], org_id))

                        # Create subscription with 14-day Professional trial
                        # New users start with free plan in trialing status to experience Pro features
                        cur.execute("""
                            INSERT INTO subscriptions (
                                organization_id,
                                plan_id,
                                status,
                                trial_start,
                                trial_end,
                                current_period_start,
                                current_period_end,
                                created_at,
                                updated_at
                            )
                            SELECT
                                %s,
                                sp.id,
                                'trialing',
                                NOW(),
                                NOW() + INTERVAL '14 days',
                                NOW(),
                                NOW() + INTERVAL '14 days',
                                NOW(),
                                NOW()
                            FROM subscription_plans sp
                            WHERE sp.slug = 'free'
                            RETURNING id
                        """, (org_id,))
                        subscription = cur.fetchone()
                        from datetime import datetime as _dt, timedelta as _td
                        trial_end_iso = (_dt.utcnow() + _td(days=14)).isoformat()
                        subscription_info = {
                            'plan': 'free',
                            'status': 'trialing',
                            'trial_end': trial_end_iso,
                        }
                        logger.info(f"Created subscription for org {org_id}: trial ends in 14 days")

                        logger.info(f"Created customer user with organization: {email}, user_id={user['id']}, org_id={org_id}")
                        new_user_created = True
                        conn.commit()
                    else:
                        # Existing customer - update full_name if changed, and last login time
                        if full_name and user.get('full_name') != full_name:
                            cur.execute("""
                                UPDATE users SET full_name = %s, updated_at = NOW()
                                WHERE email = %s
                            """, (full_name, email))
                            conn.commit()
                            logger.info(f"Updated full_name for: {email}")

                        # Query subscription info for existing users
                        user_org_id = user.get('organization_id')
                        if user_org_id:
                            cur.execute("""
                                SELECT s.status, sp.slug as plan, s.trial_end, s.current_period_end
                                FROM subscriptions s
                                JOIN subscription_plans sp ON s.plan_id = sp.id
                                WHERE s.organization_id = %s
                                ORDER BY s.created_at DESC
                                LIMIT 1
                            """, (user_org_id,))
                            sub = cur.fetchone()
                            if sub:
                                subscription_info = {
                                    'plan': sub['plan'],
                                    'status': sub['status'],
                                    'trial_end': sub['trial_end'].isoformat() if sub.get('trial_end') else None,
                                    'current_period_end': sub['current_period_end'].isoformat() if sub.get('current_period_end') else None
                                }
                                logger.info(f"[AUTH] Retrieved subscription for existing user {email}: {subscription_info['plan']} ({subscription_info['status']})")

        # Call Supabase Auth API to create/get auth user and generate session
        # Use admin endpoint with service role key
        logger.info(f"[AUTH DEBUG] Starting Supabase auth user creation/lookup for: {email}")
        logger.info(f"[AUTH DEBUG] User data from DB: {user}")

        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json'
        }

        # Generate a deterministic password for the Supabase auth user so repeated
        # middleware calls don't race each other. Hashing keeps it opaque.
        password_source = f"{email.lower()}|{str(user['id'])}|{SUPABASE_PASSWORD_SALT}"
        temp_password = hashlib.sha256(password_source.encode('utf-8')).hexdigest()
        logger.info(f"[PASSWORD DEBUG] Generated password hash for {email}: {temp_password[:16]}... (truncated)")

        # Try to create user in Supabase Auth (admin endpoint)
        auth_create_url = f'{SUPABASE_URL}/auth/v1/admin/users'
        auth_payload = {
            'email': email,
            'password': temp_password,
            'email_confirm': True,  # Auto-confirm email
            'user_metadata': {
                'organization_id': str(user['organization_id']),
                'role': user.get('membership_role') or user.get('role'),
                'full_name': user.get('full_name'),
                'auth0_linked': True
            }
        }

        # Check if user already exists in auth.users
        auth_list_url = f'{SUPABASE_URL}/auth/v1/admin/users?email={email}'
        list_response = requests.get(auth_list_url, headers=headers, timeout=10)

        def extract_user_id(payload, target_email=None):
            """
            Supabase admin APIs sometimes wrap the user object differently:
            - GET /admin/users returns {"users": [{...}]}
            - POST /admin/users returns {"user": {...}}
            Account for both response shapes.

            IMPORTANT: If target_email is provided, only return the user ID if the
            email matches. This prevents the bug where the email filter doesn't work
            and we incorrectly use/update another user's account.
            """
            if not payload:
                return None

            def check_email_match(user_obj):
                """Return user ID only if email matches (or no target specified)"""
                if not user_obj or not isinstance(user_obj, dict):
                    return None
                user_id = user_obj.get('id')
                user_email = user_obj.get('email', '').lower()

                # If no target email, return the ID (for POST /admin/users responses)
                if target_email is None:
                    return user_id

                # For GET /admin/users, verify email matches
                if user_email == target_email.lower():
                    return user_id
                else:
                    logger.warning(f"[AUTH] Email mismatch: looking for '{target_email}' but found '{user_email}' - will create new user")
                    return None

            if isinstance(payload, dict):
                if 'user' in payload and isinstance(payload['user'], dict):
                    return check_email_match(payload['user'])
                if 'users' in payload and isinstance(payload['users'], list):
                    # Check ALL users in the list for matching email
                    for user_obj in payload['users']:
                        user_id = check_email_match(user_obj)
                        if user_id:
                            return user_id
                    return None
                return check_email_match(payload)

            if isinstance(payload, list) and payload:
                for item in payload:
                    if isinstance(item, dict):
                        user_id = check_email_match(item) or check_email_match(item.get('user'))
                        if user_id:
                            return user_id

            return None

        auth_user_id = None
        if list_response.status_code == 200:
            users_payload = list_response.json()
            # Pass target email to verify the returned user actually matches
            auth_user_id = extract_user_id(users_payload, target_email=email)

            if auth_user_id:
                logger.info(f"Auth user already exists: {email}, updating password")
                # User exists - update their password so we can sign in with the new temp_password
                update_url = f'{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}'
                update_payload = {
                    'password': temp_password,
                    'email_confirm': True,
                    'user_metadata': {
                        'organization_id': str(user['organization_id']),
                        'role': user.get('membership_role') or user.get('role'),
                        'full_name': user.get('full_name'),
                        'auth0_linked': True
                    }
                }
                update_response = requests.put(update_url, json=update_payload, headers=headers, timeout=10)
                if update_response.status_code not in [200, 201]:
                    logger.error(f"Failed to update auth user password: {update_response.text}")
                    return jsonify({'error': 'Failed to update Supabase auth user', 'details': update_response.text}), 500
                logger.info(f"Updated password for auth user: {email}")
                logger.info(f"[PASSWORD DEBUG] Update response status: {update_response.status_code}, body: {update_response.text[:200]}")
                # Give Supabase Auth a moment to commit the password change
                import time
                time.sleep(0.3)  # 300ms delay
            else:
                # No existing user found - create one
                create_response = requests.post(auth_create_url, json=auth_payload, headers=headers, timeout=10)
                if create_response.status_code in [200, 201]:
                    auth_user_id = extract_user_id(create_response.json())
                    if auth_user_id:
                        logger.info(f"Created new auth user: {email}")
                else:
                    logger.error(f"Failed to create auth user: {create_response.text}")
                    return jsonify({'error': 'Failed to create Supabase auth user', 'details': create_response.text}), 500
        elif list_response.status_code == 404:
            # Treat 404 as "not found" and try to create the user
            create_response = requests.post(auth_create_url, json=auth_payload, headers=headers, timeout=10)
            if create_response.status_code in [200, 201]:
                auth_user_id = extract_user_id(create_response.json())
                if auth_user_id:
                    logger.info(f"Created new auth user (after 404 lookup): {email}")
            else:
                logger.error(f"Failed to create auth user: {create_response.text}")
                return jsonify({'error': 'Failed to create Supabase auth user', 'details': create_response.text}), 500
        else:
            logger.error(f"Failed to look up auth user (status {list_response.status_code}): {list_response.text}")

        if not auth_user_id:
            return jsonify({'error': 'Could not get or create auth user ID'}), 500

        # Generate session tokens using Admin API
        # Supabase Admin API can generate tokens directly for a user (bypasses password auth)
        # This is the recommended approach for SSO/social login integrations
        token_url = f'{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}/factors'
        token_headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json'
        }

        # First verify the user exists and is confirmed
        verify_url = f'{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}'
        verify_response = requests.get(verify_url, headers=token_headers, timeout=10)

        if verify_response.status_code != 200:
            logger.error(f"Failed to verify auth user: {verify_response.text}")
            return jsonify({'error': 'Failed to verify auth user', 'details': verify_response.text}), 500

        # Generate access token directly using Admin API (bypasses password auth)
        # This is the recommended approach for SSO/social login integrations
        logger.info(f"Generating access token for {email} using Admin API (auth_user_id: {auth_user_id})")

        # Use Admin API to generate an access token directly for the user
        import jwt as pyjwt
        from datetime import datetime, timedelta

        # Get user details from Supabase Auth
        user_details_response = requests.get(
            f'{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}',
            headers=token_headers,
            timeout=10
        )

        if user_details_response.status_code != 200:
            logger.error(f"Failed to get user details: {user_details_response.text}")
            return jsonify({'error': 'Failed to get user details', 'details': user_details_response.text}), 500

        auth_user = user_details_response.json()

        # Generate JWT tokens manually using the service role key
        # This is what Supabase does internally for password-based auth
        now = datetime.utcnow()
        exp = now + timedelta(hours=1)  # 1 hour expiry

        # Access token payload - add organization_id to user_metadata for RLS
        user_metadata = auth_user.get('user_metadata', {}).copy()
        user_metadata['organization_id'] = str(user['organization_id'])  # Add org ID for RLS
        user_metadata['user_id'] = str(user['id'])  # Add user ID for RLS
        user_metadata['role'] = user.get('membership_role') or user.get('role')

        access_payload = {
            'aud': 'authenticated',
            'exp': int(exp.timestamp()),
            'sub': auth_user['id'],
            'email': auth_user['email'],
            'phone': '',
            'app_metadata': {
                'provider': 'auth0',
                'providers': ['auth0']
            },
            'user_metadata': user_metadata,  # Now includes organization_id!
            'role': 'authenticated',
            'aal': 'aal1',
            'amr': [{'method': 'oauth', 'timestamp': int(now.timestamp())}],
            'session_id': auth_user['id']
        }

        # Get JWT secret from environment (should match Supabase JWT secret)
        import os
        jwt_secret = os.getenv('SUPABASE_JWT_SECRET', 'local-dev-secret-123456789012345678901234567890')

        # Generate access token
        access_token = pyjwt.encode(access_payload, jwt_secret, algorithm='HS256')

        # Refresh token can be the same for simplicity in dev
        refresh_token = pyjwt.encode({**access_payload, 'exp': int((now + timedelta(days=30)).timestamp())}, jwt_secret, algorithm='HS256')

        logger.info(f"Generated Supabase session for: {email}")

        # Fire user signup event + send onboarding email for first-time users
        if new_user_created and EVENT_BUS_AVAILABLE and EventPublisher:
            try:
                EventPublisher.user_signup(
                    user_id=str(user['id']),
                    email=email,
                    organization_id=str(user['organization_id']),
                    role=user.get('membership_role') or user.get('role') or 'owner',
                    plan=(subscription_info or {}).get('plan', 'free'),
                    status=(subscription_info or {}).get('status', 'trialing'),
                    trial_end=(subscription_info or {}).get('trial_end'),
                    full_name=user.get('full_name') or full_name,
                )
            except Exception as pub_err:
                logger.warning(f"[EVENT] Failed to publish user_signup: {pub_err}")

        # Attempt to send onboarding email (optional, requires SMTP env)
        if new_user_created and subscription_info:
            try:
                send_onboarding_email(
                    to_email=email,
                    user_name=user.get('full_name') or email,
                    plan=subscription_info['plan'],
                    trial_end_iso=subscription_info['trial_end'],
                    org_name=None,
                )
            except Exception as e:
                logger.warning(f"[EMAIL] Onboarding email error: {e}")

        # Publish login event for audit logging
        if EVENT_BUS_AVAILABLE and EventPublisher:
            try:
                ip_address = request.remote_addr or request.headers.get('X-Forwarded-For', 'unknown')
                user_agent = request.headers.get('User-Agent', 'unknown')
                EventPublisher.user_login(
                    user_id=str(user['id']),
                    email=email,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                logger.info(f"[AUDIT] Published login event for: {email}")
            except Exception as audit_err:
                logger.warning(f"[AUDIT] Failed to publish login event: {audit_err}")


        response_body = {
            'success': True,
            'session': {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'expires_in': 3600,
                'token_type': 'bearer'
            },
            'user': {
                'id': str(user['id']),
                'email': user['email'],
                'organization_id': str(user['organization_id']),
                'role': user.get('membership_role') or user.get('role'),
                'is_platform_admin': is_platform_admin,
                'user_type': user_type,  # EXPLICIT: PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, CUSTOMER, etc.
                'is_invite_only': is_invite_only  # True = Invite-only (admin), False = Self-signup (customer)
            }
        }

        if subscription_info:
            response_body['subscription'] = subscription_info

        return jsonify(response_body), 200

    except Exception as e:
        logger.error(f"Error creating Supabase session: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/auth/get-user-claims', methods=['GET'])
def get_user_claims():
    """
    Get user's organization_id and role for Auth0 Action custom claims.

    This lightweight endpoint is called by the Auth0 Post-Login Action
    to retrieve user data that will be added to the JWT as custom claims.

    Query Parameters:
        email: User's email address (required)
        auth0_user_id: Auth0 user ID (optional, for better lookup)

    Returns:
        JSON: {
            "organization_id": "uuid",
            "role": "admin|engineer|analyst|etc"
        }

    Error Responses:
        400: Missing email parameter
        404: User not found in database
        500: Database error
    """
    try:
        # Get parameters
        email = request.args.get('email')
        auth0_user_id = request.args.get('auth0_user_id')

        if not email:
            return jsonify({'error': 'email parameter is required'}), 400

        logger.info(f"[GET_USER_CLAIMS] Request for user: {email} (auth0_id={auth0_user_id})")

        # Query Supabase database for user's organization and role
        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                # Try to find user by auth0_user_id first (more reliable)
                if auth0_user_id:
                    cur.execute("""
                        SELECT
                            u.organization_id,
                            om.role
                        FROM users u
                        LEFT JOIN organization_memberships om ON om.user_id = u.id
                        WHERE u.auth0_user_id = %s
                        LIMIT 1
                    """, (auth0_user_id,))
                    user_data = cur.fetchone()

                # Fallback to email lookup
                if not auth0_user_id or not user_data:
                    cur.execute("""
                        SELECT
                            u.organization_id,
                            om.role
                        FROM users u
                        LEFT JOIN organization_memberships om ON om.user_id = u.id
                        WHERE u.email = %s
                        LIMIT 1
                    """, (email,))
                    user_data = cur.fetchone()

                if not user_data:
                    logger.warning(f"[GET_USER_CLAIMS] User not found: {email}")
                    return jsonify({
                        'error': 'User not found',
                        'message': 'User does not exist in database'
                    }), 404

                organization_id = str(user_data['organization_id']) if user_data['organization_id'] else None
                role = user_data['role'] if user_data['role'] else 'user'

                if not organization_id:
                    logger.warning(f"[GET_USER_CLAIMS] User {email} has no organization_id")
                    return jsonify({
                        'error': 'User has no organization',
                        'message': 'User account is not properly configured'
                    }), 404

                logger.info(f"[GET_USER_CLAIMS] Success: {email} -> org_id={organization_id}, role={role}")

                return jsonify({
                    'organization_id': organization_id,
                    'role': role
                }), 200

    except Exception as e:
        logger.error(f"[GET_USER_CLAIMS] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

def validate_jwt_secret():
    """
    Validate JWT secret at startup to prevent security vulnerabilities
    """
    jwt_secret = os.getenv('SUPABASE_JWT_SECRET', '')
    weak_default = 'local-dev-secret-123456789012345678901234567890'

    # Check if secret is set
    if not jwt_secret:
        logger.error("❌ SECURITY: SUPABASE_JWT_SECRET environment variable is not set!")
        logger.error("   Set SUPABASE_JWT_SECRET to a secure random string (minimum 32 characters)")
        return False

    # Check for weak default secret
    if jwt_secret == weak_default:
        is_production = os.getenv('FLASK_ENV', 'development') == 'production'
        if is_production:
            logger.error("❌ SECURITY: Using default JWT secret in production!")
            logger.error("   Generate a strong secret: openssl rand -hex 32")
            return False
        else:
            logger.warning("⚠️  SECURITY: Using default JWT secret (OK for development only)")

    # Check minimum length (HS256 requires at least 32 bytes = 64 hex chars)
    if len(jwt_secret) < 32:
        logger.error(f"❌ SECURITY: JWT secret too short ({len(jwt_secret)} chars, minimum 32)")
        logger.error("   Generate a secure secret: openssl rand -hex 32")
        return False

    logger.info(f"✅ JWT secret validated ({len(jwt_secret)} chars)")
    return True

@app.route('/api/data/<resource>', methods=['GET'])
def get_list(resource):
    """
    Get list of resources with pagination, sorting, and filtering.
    Enforces RLS via session variables.
    """
    try:
        # Get user email from session (stored after Auth0 login)
        user_email = request.headers.get('X-User-Email') or request.cookies.get('user_email')

        if not user_email:
            return jsonify({'error': 'Unauthorized - missing user email'}), 401

        # Parse query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('perPage', 25))
        sort_field = request.args.get('sortField', 'created_at')
        sort_order = request.args.get('sortOrder', 'DESC')

        # Parse filter JSON
        filter_str = request.args.get('filter', '{}')
        filters = json.loads(filter_str) if filter_str else {}

        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                # Get user context and set session variables
                cur.execute("""
                    SELECT u.id as user_id, u.organization_id, u.role,
                           om.role as membership_role
                    FROM users u
                    LEFT JOIN organization_memberships om ON u.id = om.user_id
                    WHERE u.email = %s
                    LIMIT 1
                """, (user_email,))
                user = cur.fetchone()

                if not user:
                    return jsonify({'error': 'User not found'}), 403

                # Set session variables for RLS
                set_session_variables(cur, user['user_id'], user['organization_id'],
                                    user.get('membership_role') or user.get('role'))

                # Build WHERE clause from filters
                where_clauses = []
                params = []
                for key, value in filters.items():
                    if value is not None and value != '':
                        where_clauses.append(f"{key} = %s")
                        params.append(value)

                where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

                # Get total count
                count_query = f"SELECT COUNT(*) FROM {resource} {where_sql}"
                cur.execute(count_query, params)
                total = cur.fetchone()['count']

                # Get paginated data
                offset = (page - 1) * per_page
                data_query = f"""
                    SELECT * FROM {resource}
                    {where_sql}
                    ORDER BY {sort_field} {sort_order}
                    LIMIT %s OFFSET %s
                """
                cur.execute(data_query, params + [per_page, offset])
                data = cur.fetchall()

                return jsonify({
                    'data': data,
                    'total': total
                }), 200

    except Exception as e:
        logger.error(f"Error in get_list: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/<resource>/<id>', methods=['GET'])
def get_one(resource, id):
    """Get single resource by ID"""
    try:
        user_email = request.headers.get('X-User-Email') or request.cookies.get('user_email')
        if not user_email:
            return jsonify({'error': 'Unauthorized'}), 401

        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                # Set user context
                cur.execute("""
                    SELECT u.id as user_id, u.organization_id, u.role,
                           om.role as membership_role
                    FROM users u
                    LEFT JOIN organization_memberships om ON u.id = om.user_id
                    WHERE u.email = %s
                """, (user_email,))
                user = cur.fetchone()

                if not user:
                    return jsonify({'error': 'User not found'}), 403

                set_session_variables(cur, user['user_id'], user['organization_id'],
                                    user.get('membership_role') or user.get('role'))

                # Query resource
                cur.execute(f"SELECT * FROM {resource} WHERE id = %s", (id,))
                data = cur.fetchone()

                if not data:
                    return jsonify({'error': 'Not found'}), 404

                return jsonify({'data': data}), 200

    except Exception as e:
        logger.error(f"Error in get_one: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/<resource>', methods=['POST'])
def create(resource):
    """Create new resource"""
    try:
        user_email = request.headers.get('X-User-Email') or request.cookies.get('user_email')
        if not user_email:
            return jsonify({'error': 'Unauthorized'}), 401

        payload = request.json

        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                # Set user context
                cur.execute("""
                    SELECT u.id as user_id, u.organization_id, u.role,
                           om.role as membership_role
                    FROM users u
                    LEFT JOIN organization_memberships om ON u.id = om.user_id
                    WHERE u.email = %s
                """, (user_email,))
                user = cur.fetchone()

                if not user:
                    return jsonify({'error': 'User not found'}), 403

                set_session_variables(cur, user['user_id'], user['organization_id'],
                                    user.get('membership_role') or user.get('role'))

                # Build INSERT query
                columns = list(payload.keys())
                values = list(payload.values())
                placeholders = ', '.join(['%s'] * len(values))

                insert_query = f"""
                    INSERT INTO {resource} ({', '.join(columns)})
                    VALUES ({placeholders})
                    RETURNING *
                """

                cur.execute(insert_query, values)
                data = cur.fetchone()
                conn.commit()

                return jsonify({'data': data}), 201

    except Exception as e:
        logger.error(f"Error in create: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/<resource>/<id>', methods=['PUT', 'PATCH'])
def update(resource, id):
    """Update resource"""
    try:
        user_email = request.headers.get('X-User-Email') or request.cookies.get('user_email')
        if not user_email:
            return jsonify({'error': 'Unauthorized'}), 401

        payload = request.json

        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                # Set user context
                cur.execute("""
                    SELECT u.id as user_id, u.organization_id, u.role,
                           om.role as membership_role
                    FROM users u
                    LEFT JOIN organization_memberships om ON u.id = om.user_id
                    WHERE u.email = %s
                """, (user_email,))
                user = cur.fetchone()

                if not user:
                    return jsonify({'error': 'User not found'}), 403

                set_session_variables(cur, user['user_id'], user['organization_id'],
                                    user.get('membership_role') or user.get('role'))

                # Build UPDATE query
                set_clauses = [f"{key} = %s" for key in payload.keys()]
                values = list(payload.values()) + [id]

                update_query = f"""
                    UPDATE {resource}
                    SET {', '.join(set_clauses)}
                    WHERE id = %s
                    RETURNING *
                """

                cur.execute(update_query, values)
                data = cur.fetchone()

                if not data:
                    return jsonify({'error': 'Not found or unauthorized'}), 404

                conn.commit()

                return jsonify({'data': data}), 200

    except Exception as e:
        logger.error(f"Error in update: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/<resource>/<id>', methods=['DELETE'])
def delete(resource, id):
    """Delete resource"""
    try:
        user_email = request.headers.get('X-User-Email') or request.cookies.get('user_email')
        if not user_email:
            return jsonify({'error': 'Unauthorized'}), 401

        with get_supabase_db() as conn:
            with conn.cursor() as cur:
                # Set user context
                cur.execute("""
                    SELECT u.id as user_id, u.organization_id, u.role,
                           om.role as membership_role
                    FROM users u
                    LEFT JOIN organization_memberships om ON u.id = om.user_id
                    WHERE u.email = %s
                """, (user_email,))
                user = cur.fetchone()

                if not user:
                    return jsonify({'error': 'User not found'}), 403

                set_session_variables(cur, user['user_id'], user['organization_id'],
                                    user.get('membership_role') or user.get('role'))

                # Delete resource
                cur.execute(f"DELETE FROM {resource} WHERE id = %s RETURNING *", (id,))
                data = cur.fetchone()

                if not data:
                    return jsonify({'error': 'Not found or unauthorized'}), 404

                conn.commit()

                return jsonify({'data': data}), 200

    except Exception as e:
        logger.error(f"Error in delete: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/organizations/create', methods=['POST'])
def create_organization():
    """
    Create a new organization for a user

    Request body:
    {
        "name": "Organization Name",
        "slug": "organization-slug",
        "user_email": "user@example.com"
    }
    """
    try:
        data = request.json
        org_name = data.get('name')
        org_slug = data.get('slug')
        user_email = data.get('user_email')

        if not org_name or not org_slug or not user_email:
            return jsonify({'error': 'Missing required fields: name, slug, user_email'}), 400

        # Validate slug format (lowercase, alphanumeric with hyphens)
        import re
        if not re.match(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$', org_slug):
            return jsonify({'error': 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.'}), 400

        if len(org_slug) < 3:
            return jsonify({'error': 'Slug must be at least 3 characters long'}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Check if slug is already taken
        cur.execute("SELECT id FROM organizations WHERE slug = %s", (org_slug,))
        existing_org = cur.fetchone()

        if existing_org:
            return jsonify({
                'error': 'Slug already taken',
                'suggestion': f"{org_slug}-{random.randint(100, 999)}"
            }), 409

        # Get user
        cur.execute("SELECT id, organization_id FROM users WHERE email = %s", (user_email,))
        user = cur.fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user['organization_id']:
            return jsonify({'error': 'User already has an organization'}), 400

        # Create organization
        import uuid
        new_org_id = str(uuid.uuid4())

        cur.execute("""
            INSERT INTO organizations (id, name, slug, created_at, updated_at)
            VALUES (%s, %s, %s, NOW(), NOW())
            RETURNING id, name, slug
        """, (new_org_id, org_name, org_slug))
        org = cur.fetchone()

        # Update user's organization_id
        cur.execute("""
            UPDATE users
            SET organization_id = %s, updated_at = NOW()
            WHERE id = %s
        """, (new_org_id, user['id']))

        # Create organization membership
        cur.execute("""
            INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
            VALUES (%s, %s, 'admin', NOW(), NOW())
            ON CONFLICT (user_id, organization_id) DO NOTHING
        """, (user['id'], new_org_id))

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Created organization: {org_name} (slug: {org_slug}) for user: {user_email}")

        return jsonify({
            'success': True,
            'organization': {
                'id': org['id'],
                'name': org['name'],
                'slug': org['slug']
            }
        }), 201

    except Exception as e:
        logger.error(f"Error creating organization: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/organizations/check-slug', methods=['GET'])
def check_slug_availability():
    """
    Check if an organization slug is available

    Query params:
    - slug: The slug to check
    """
    try:
        slug = request.args.get('slug')

        if not slug:
            return jsonify({'error': 'Missing slug parameter'}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("SELECT id FROM organizations WHERE slug = %s", (slug,))
        existing_org = cur.fetchone()

        cur.close()
        conn.close()

        return jsonify({
            'available': existing_org is None,
            'suggestion': f"{slug}-{random.randint(100, 999)}" if existing_org else None
        }), 200

    except Exception as e:
        logger.error(f"Error checking slug availability: {e}")
        return jsonify({'error': str(e)}), 500

def get_auth0_management_token():
    """
    Get Auth0 Management API token using client credentials grant.
    Tokens are cached until they expire.
    """
    global _auth0_mgmt_token_cache

    # Check if we have a valid cached token
    if _auth0_mgmt_token_cache['token'] and _auth0_mgmt_token_cache['expires_at']:
        if datetime.utcnow().timestamp() < _auth0_mgmt_token_cache['expires_at'] - 60:  # 60s buffer
            return _auth0_mgmt_token_cache['token']

    if not AUTH0_DOMAIN or not AUTH0_MGMT_CLIENT_ID or not AUTH0_MGMT_CLIENT_SECRET:
        logger.error("[Auth0 Mgmt] Missing Auth0 Management API configuration")
        return None

    try:
        token_url = f'https://{AUTH0_DOMAIN}/oauth/token'
        payload = {
            'grant_type': 'client_credentials',
            'client_id': AUTH0_MGMT_CLIENT_ID,
            'client_secret': AUTH0_MGMT_CLIENT_SECRET,
            'audience': AUTH0_MGMT_AUDIENCE
        }

        response = requests.post(token_url, json=payload, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to get token: {response.text}")
            return None

        token_data = response.json()
        access_token = token_data.get('access_token')
        expires_in = token_data.get('expires_in', 86400)

        # Cache the token
        _auth0_mgmt_token_cache['token'] = access_token
        _auth0_mgmt_token_cache['expires_at'] = datetime.utcnow().timestamp() + expires_in

        logger.info("[Auth0 Mgmt] Successfully obtained management token")
        return access_token

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error getting token: {e}")
        return None


def validate_auth0_user_token(auth_header):
    """
    Validate Auth0 user access token from Authorization header.
    Returns user info if valid, None otherwise.
    """
    if not auth_header or not auth_header.startswith('Bearer '):
        logger.warning("[Auth0] Missing or invalid Authorization header")
        return None

    token = auth_header.split(' ')[1]
    logger.info(f"[Auth0] Validating token (first 50 chars): {token[:50]}...")

    try:
        # Use PyJWKClient for modern PyJWT (2.x+)
        jwks_url = f'https://{AUTH0_DOMAIN}/.well-known/jwks.json'
        logger.info(f"[Auth0] Using JWKS from: {jwks_url}")

        jwks_client = jwt.PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        logger.info(f"[Auth0] Got signing key with kid: {signing_key.key_id}")

        # Verify and decode the token
        audience = os.getenv('AUTH0_AUDIENCE', f'https://{AUTH0_DOMAIN}/api/v2/')
        issuer = f'https://{AUTH0_DOMAIN}/'
        logger.info(f"[Auth0] Validating with audience: {audience}, issuer: {issuer}")

        # First decode without verification to see the actual claims (for debugging)
        try:
            unverified_payload = jwt.decode(token, options={"verify_signature": False})
            token_aud = unverified_payload.get('aud')
            token_iss = unverified_payload.get('iss')
            logger.info(f"[Auth0] Token claims - aud: {token_aud}, iss: {token_iss}, sub: {unverified_payload.get('sub')}")
        except Exception as decode_err:
            logger.warning(f"[Auth0] Failed to decode token without verification: {decode_err}")

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            audience=audience,
            issuer=issuer
        )

        logger.info(f"[Auth0] ✅ Token validated successfully for user: {payload.get('sub')}")
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("[Auth0] Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"[Auth0] Invalid token: {e}")
        return None
    except Exception as e:
        logger.error(f"[Auth0] Error validating token: {e}", exc_info=True)
        return None


@app.route('/api/auth0/user/profile', methods=['GET'])
def get_auth0_user_profile():
    """
    Get current user's Auth0 profile.

    Requires: Authorization header with Auth0 access token.

    Returns:
        JSON: User profile from Auth0
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        # Get the user ID from the token
        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        # Get management token
        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Fetch user profile from Auth0
        user_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }

        response = requests.get(user_url, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to get user profile: {response.text}")
            return jsonify({'error': 'Failed to get user profile'}), 500

        user_data = response.json()

        # Return relevant profile fields
        return jsonify({
            'user_id': user_data.get('user_id'),
            'email': user_data.get('email'),
            'name': user_data.get('name'),
            'nickname': user_data.get('nickname'),
            'picture': user_data.get('picture'),
            'email_verified': user_data.get('email_verified'),
            'created_at': user_data.get('created_at'),
            'updated_at': user_data.get('updated_at'),
            'user_metadata': user_data.get('user_metadata', {})
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error getting user profile: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth0/user/profile', methods=['PATCH'])
def update_auth0_user_profile():
    """
    Update current user's Auth0 profile.

    Requires: Authorization header with Auth0 access token.

    Request body:
    {
        "name": "New Name",
        "nickname": "new_nickname",
        "user_metadata": {
            "phone": "123-456-7890",
            "preferences": { ... }
        }
    }

    Note: Email changes require additional verification and are not supported via this endpoint.

    Returns:
        JSON: Updated user profile
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        # Get the user ID from the token
        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        # Get update data
        update_data = request.json
        if not update_data:
            return jsonify({'error': 'No update data provided'}), 400

        # Whitelist allowed fields for update
        allowed_fields = ['name', 'nickname', 'user_metadata']
        filtered_update = {k: v for k, v in update_data.items() if k in allowed_fields}

        if not filtered_update:
            return jsonify({'error': 'No valid fields to update'}), 400

        # Get management token
        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Update user profile in Auth0
        user_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }

        response = requests.patch(user_url, json=filtered_update, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to update user profile: {response.text}")
            error_details = response.json() if response.text else {}
            return jsonify({
                'error': 'Failed to update user profile',
                'details': error_details.get('message', response.text)
            }), 500

        updated_user = response.json()

        # Also update user in Supabase users table if name changed
        if 'name' in filtered_update:
            try:
                with get_supabase_db() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            UPDATE users SET full_name = %s, updated_at = NOW()
                            WHERE auth0_user_id = %s OR email = %s
                        """, (filtered_update['name'], user_id, updated_user.get('email')))
                        conn.commit()
                        logger.info(f"[Auth0 Mgmt] Also updated user name in Supabase: {user_id}")
            except Exception as e:
                logger.warning(f"[Auth0 Mgmt] Failed to sync name to Supabase: {e}")

        logger.info(f"[Auth0 Mgmt] Successfully updated profile for user: {user_id}")

        return jsonify({
            'success': True,
            'user_id': updated_user.get('user_id'),
            'email': updated_user.get('email'),
            'name': updated_user.get('name'),
            'nickname': updated_user.get('nickname'),
            'picture': updated_user.get('picture'),
            'user_metadata': updated_user.get('user_metadata', {})
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error updating user profile: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth0/user/password', methods=['POST'])
def request_password_change():
    """
    Request a password change email for the current user.

    Requires: Authorization header with Auth0 access token.

    This sends a password reset email to the user's registered email address.
    The user must click the link in the email to set a new password.

    Returns:
        JSON: Success message
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        # Get the user's email from the token
        email = user_claims.get('email')
        if not email:
            return jsonify({'error': 'Invalid token - missing email'}), 401

        # Send password reset email via Auth0
        reset_url = f'https://{AUTH0_DOMAIN}/dbconnections/change_password'
        client_id = os.getenv('AUTH0_CLIENT_ID', AUTH0_MGMT_CLIENT_ID)

        payload = {
            'client_id': client_id,
            'email': email,
            'connection': 'Username-Password-Authentication'  # Default Auth0 database connection
        }

        response = requests.post(reset_url, json=payload, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0] Failed to send password reset: {response.text}")
            return jsonify({'error': 'Failed to send password reset email'}), 500

        logger.info(f"[Auth0] Password reset email sent to: {email}")

        return jsonify({
            'success': True,
            'message': 'Password reset email sent. Please check your inbox.'
        }), 200

    except Exception as e:
        logger.error(f"[Auth0] Error requesting password change: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth0/user/logs', methods=['GET'])
def get_auth0_user_logs():
    """
    Get login history/sessions for the current user.

    Requires: Authorization header with Auth0 access token.
    Note: M2M app needs 'read:logs' scope in Auth0.

    Query params:
        - page (int): Page number (default 0)
        - per_page (int): Results per page (default 10, max 50)

    Returns:
        JSON: List of login events
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Pagination
        page = request.args.get('page', 0, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 50)

        # Fetch user logs from Auth0 (login events)
        logs_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}/logs'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }
        params = {
            'page': page,
            'per_page': per_page,
            'sort': 'date:-1'  # Most recent first
        }

        response = requests.get(logs_url, headers=headers, params=params, timeout=10)

        if response.status_code == 403:
            return jsonify({
                'error': 'Insufficient permissions',
                'details': 'M2M app needs read:logs scope. Add it in Auth0 Dashboard.'
            }), 403

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to get user logs: {response.text}")
            return jsonify({'error': 'Failed to get login history'}), 500

        logs = response.json()

        # Format logs for frontend
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                'id': log.get('_id'),
                'date': log.get('date'),
                'type': log.get('type'),
                'type_description': log.get('description', get_log_type_description(log.get('type'))),
                'ip': log.get('ip'),
                'user_agent': log.get('user_agent'),
                'location': {
                    'city': log.get('location_info', {}).get('city_name'),
                    'country': log.get('location_info', {}).get('country_name'),
                },
                'client_name': log.get('client_name'),
                'connection': log.get('connection'),
            })

        return jsonify({
            'logs': formatted_logs,
            'page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error getting user logs: {e}")
        return jsonify({'error': str(e)}), 500


def get_log_type_description(log_type):
    """Map Auth0 log type codes to human-readable descriptions."""
    descriptions = {
        's': 'Successful login',
        'ss': 'Successful signup',
        'f': 'Failed login',
        'fu': 'Failed login (invalid email/username)',
        'fp': 'Failed login (wrong password)',
        'fc': 'Failed by connector',
        'fco': 'Failed by CORS',
        'con': 'Connector online',
        'coff': 'Connector offline',
        'slo': 'Successful logout',
        'flo': 'Failed logout',
        'sd': 'Successful delegation',
        'fd': 'Failed delegation',
        'sdu': 'Successful user deletion',
        'fdu': 'Failed user deletion',
        'sce': 'Successful change email',
        'fce': 'Failed change email',
        'scp': 'Successful change password',
        'fcp': 'Failed change password',
        'scpr': 'Successful change password request',
        'fcpr': 'Failed change password request',
        'sv': 'Successful verification email',
        'fv': 'Failed verification email',
        'gd_unenroll': 'MFA unenrollment',
        'gd_enrollment_complete': 'MFA enrollment complete',
        'limit_wc': 'Blocked account',
        'limit_mu': 'Blocked IP address',
    }
    return descriptions.get(log_type, log_type or 'Unknown event')


@app.route('/api/auth0/user/identities', methods=['GET'])
def get_auth0_user_identities():
    """
    Get linked social accounts for the current user.

    Requires: Authorization header with Auth0 access token.

    Returns:
        JSON: List of linked identities (Google, Microsoft, etc.)
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Fetch user to get identities
        user_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }

        response = requests.get(user_url, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to get user identities: {response.text}")
            return jsonify({'error': 'Failed to get linked accounts'}), 500

        user_data = response.json()
        identities = user_data.get('identities', [])

        # Format identities for frontend
        formatted_identities = []
        for identity in identities:
            formatted_identities.append({
                'provider': identity.get('provider'),
                'user_id': identity.get('user_id'),
                'connection': identity.get('connection'),
                'is_social': identity.get('isSocial', False),
                'profile_data': identity.get('profileData', {}),
            })

        return jsonify({
            'identities': formatted_identities,
            'primary_user_id': user_id
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error getting user identities: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth0/user/identities/<provider>/<identity_user_id>', methods=['DELETE'])
def unlink_auth0_identity(provider, identity_user_id):
    """
    Unlink a social account from the current user.

    Requires: Authorization header with Auth0 access token.

    Path params:
        - provider: The identity provider (google-oauth2, windowslive, etc.)
        - identity_user_id: The user ID at the provider

    Returns:
        JSON: Updated list of identities
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Unlink identity
        unlink_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}/identities/{provider}/{identity_user_id}'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }

        response = requests.delete(unlink_url, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to unlink identity: {response.text}")
            return jsonify({'error': 'Failed to unlink account'}), 500

        logger.info(f"[Auth0 Mgmt] Unlinked {provider} identity from user: {user_id}")

        # Return updated identities
        updated_identities = response.json()
        return jsonify({
            'success': True,
            'identities': updated_identities
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error unlinking identity: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth0/user/mfa', methods=['GET'])
def get_auth0_user_mfa():
    """
    Get MFA enrollments for the current user.

    Requires: Authorization header with Auth0 access token.
    Note: M2M app needs 'read:users' scope (already granted).

    Returns:
        JSON: List of MFA enrollments (authenticator apps, SMS, etc.)
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Fetch MFA enrollments
        mfa_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}/enrollments'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }

        response = requests.get(mfa_url, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to get MFA enrollments: {response.text}")
            return jsonify({'error': 'Failed to get MFA status'}), 500

        enrollments = response.json()

        # Format enrollments for frontend
        formatted_enrollments = []
        for enrollment in enrollments:
            formatted_enrollments.append({
                'id': enrollment.get('id'),
                'type': enrollment.get('type'),  # e.g., 'totp', 'sms', 'webauthn-roaming'
                'name': enrollment.get('name'),
                'phone_number': enrollment.get('phone_number'),  # For SMS
                'enrolled_at': enrollment.get('enrolled_at'),
                'last_auth': enrollment.get('last_auth'),
            })

        return jsonify({
            'enrollments': formatted_enrollments,
            'mfa_enabled': len(formatted_enrollments) > 0
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error getting MFA enrollments: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth0/user/mfa/<enrollment_id>', methods=['DELETE'])
def delete_auth0_mfa_enrollment(enrollment_id):
    """
    Remove an MFA enrollment from the current user.

    Requires: Authorization header with Auth0 access token.
    Note: M2M app needs 'update:users' scope (already granted).

    Path params:
        - enrollment_id: The MFA enrollment ID to remove

    Returns:
        JSON: Success status
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Delete MFA enrollment
        delete_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}/authenticators/{enrollment_id}'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }

        response = requests.delete(delete_url, headers=headers, timeout=10)

        if response.status_code not in [200, 204]:
            logger.error(f"[Auth0 Mgmt] Failed to delete MFA enrollment: {response.text}")
            return jsonify({'error': 'Failed to remove MFA device'}), 500

        logger.info(f"[Auth0 Mgmt] Deleted MFA enrollment {enrollment_id} for user: {user_id}")

        return jsonify({
            'success': True,
            'message': 'MFA device removed successfully'
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error deleting MFA enrollment: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth0/user/metadata', methods=['PATCH'])
def update_auth0_user_metadata():
    """
    Update user_metadata for the current user (theme, notifications, preferences).

    Requires: Authorization header with Auth0 access token.

    Request body:
    {
        "theme": "dark",
        "notifications": {
            "email_digest": true,
            "bom_complete": true,
            "alerts": true
        },
        "integrations": {
            "slack": false,
            "teams": false
        }
    }

    Returns:
        JSON: Updated user_metadata
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        user_id = user_claims.get('sub')
        if not user_id:
            return jsonify({'error': 'Invalid token - missing user ID'}), 401

        metadata = request.json
        if not metadata:
            return jsonify({'error': 'No metadata provided'}), 400

        mgmt_token = get_auth0_management_token()
        if not mgmt_token:
            return jsonify({'error': 'Auth0 Management API not configured'}), 500

        # Update user_metadata in Auth0
        user_url = f'https://{AUTH0_DOMAIN}/api/v2/users/{user_id}'
        headers = {
            'Authorization': f'Bearer {mgmt_token}',
            'Content-Type': 'application/json'
        }

        response = requests.patch(user_url, json={'user_metadata': metadata}, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(f"[Auth0 Mgmt] Failed to update user_metadata: {response.text}")
            return jsonify({'error': 'Failed to update preferences'}), 500

        updated_user = response.json()
        logger.info(f"[Auth0 Mgmt] Updated user_metadata for user: {user_id}")

        return jsonify({
            'success': True,
            'user_metadata': updated_user.get('user_metadata', {})
        }), 200

    except Exception as e:
        logger.error(f"[Auth0 Mgmt] Error updating user_metadata: {e}")
        return jsonify({'error': str(e)}), 500




@app.route('/auth/logout', methods=['POST'])
def logout_user():
    """
    Log out the current user and publish logout event for audit trail.

    Requires: Authorization header with Auth0 access token.

    Returns:
        JSON: Success status
    """
    try:
        auth_header = request.headers.get('Authorization')
        user_claims = validate_auth0_user_token(auth_header)

        if not user_claims:
            return jsonify({'error': 'Unauthorized - invalid token'}), 401

        user_id = user_claims.get('sub')
        email = user_claims.get('email')

        # Publish logout event for audit logging
        if EVENT_BUS_AVAILABLE and EventPublisher:
            try:
                EventPublisher.user_logout(
                    user_id=user_id or 'unknown',
                    email=email or 'unknown'
                )
                logger.info(f"[AUDIT] Published logout event for: {email}")
            except Exception as audit_err:
                logger.warning(f"[AUDIT] Failed to publish logout event: {audit_err}")

        logger.info(f"User logged out: {email}")

        return jsonify({
            'success': True,
            'message': 'Logged out successfully'
        }), 200

    except Exception as e:
        logger.error(f"Error during logout: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Validate JWT secret before starting server
    if not validate_jwt_secret():
        logger.error("❌ Server startup aborted due to weak JWT secret")
        logger.error("   Fix the SUPABASE_JWT_SECRET environment variable and restart")
        exit(1)

    app.run(host='0.0.0.0', port=8000, debug=True)
