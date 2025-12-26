"""
API Views for Components Platform V2

Includes:
- Authentication (signup, login, OAuth, MFA)
- Components CRUD
- BOM CRUD
- Alerts CRUD
- User management
- Billing/subscription
- Metrics endpoint
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate
from django.db.models import Q
from django.shortcuts import redirect
from django.conf import settings
from django.http import HttpResponse
from django_prometheus.exports import ExportToDjangoView
from django.db import connection

import pyotp
import qrcode
import io
import requests
from datetime import datetime, timedelta

from .models import (
    Tenant,
    User,
    Component,
    ComponentParameter,
    VendorPricing,
    BOM,
    BOMLineItem,
    Alert,
    AlertPreference,
)
from .serializers import (
    TenantSerializer,
    UserSerializer,
    SignupSerializer,
    ComponentSerializer,
    BOMSerializer,
    BOMLineItemSerializer,
    AlertSerializer,
    AlertPreferenceSerializer,
)
from .permissions import (
    IsTenantMember,
    IsOwner,
    IsOwnerOrAdmin,
    IsOwnerAdminOrMember,
    CanManageUsers,
    CanManageBilling,
    ComponentPermissions,
    BOMPermissions,
    AlertPermissions,
    IsActiveSubscription,
)
from .tracing import trace_function, add_span_attributes
from .logging_config import api_logger
from .metrics import (
    track_component_created,
    track_vendor_api_call,
    login_attempts_counter,
    mfa_verifications_counter,
)


# =============================================================================
# PROMETHEUS METRICS ENDPOINT
# =============================================================================


@api_view(["GET"])
@permission_classes([AllowAny])
def metrics_view(request):
    """
    Expose Prometheus metrics endpoint

    GET /metrics
    """
    return ExportToDjangoView(request)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Simple health check endpoint for infrastructure monitoring

    GET /health

    Returns:
        200 OK with JSON status if Django is running
    """
    return Response({
        "status": "healthy",
        "service": "components-platform-v2-backend",
        "timestamp": datetime.now().isoformat()
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def readiness_check(request):
    """
    Lightweight readiness probe exposed without tenant requirements.

    GET /ready
    """
    checks = {}
    status_code = status.HTTP_200_OK

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = "ok"
    except Exception as exc:  # pragma: no cover - readiness degradation
        checks["database"] = f"error: {exc}"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return Response(
        {
            "status": "ready" if status_code == status.HTTP_200_OK else "degraded",
            "timestamp": datetime.now().isoformat(),
            "checks": checks,
        },
        status=status_code,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def supabase_health_check(request):
    """
    Check Supabase services health

    GET /api/supabase/health

    Returns:
        200 OK with status of all Supabase services
    """
    supabase_url = getattr(settings, 'SUPABASE_URL', 'http://localhost:27540')

    services = {
        "kong": {"url": f"{supabase_url}/", "status": "unknown"},
        "auth": {"url": f"{supabase_url}/auth/v1/health", "status": "unknown"},
        "rest": {"url": f"{supabase_url}/rest/v1/", "status": "unknown"},
        "realtime": {"url": f"{supabase_url}/realtime/v1/", "status": "unknown"},
        "storage": {"url": f"{supabase_url}/storage/v1/status", "status": "unknown"},
    }

    overall_status = "healthy"

    for service_name, service_info in services.items():
        try:
            response = requests.get(service_info['url'], timeout=5)
            if response.status_code in [200, 201, 204]:
                service_info['status'] = 'healthy'
            else:
                service_info['status'] = f'unhealthy (HTTP {response.status_code})'
                overall_status = "degraded"
        except requests.exceptions.Timeout:
            service_info['status'] = 'timeout'
            overall_status = "degraded"
        except requests.exceptions.ConnectionError:
            service_info['status'] = 'unreachable'
            overall_status = "degraded"
        except Exception as e:
            service_info['status'] = f'error: {str(e)}'
            overall_status = "degraded"

    return Response({
        "status": overall_status,
        "timestamp": datetime.now().isoformat(),
        "services": services
    })


# =============================================================================
# AUTHENTICATION VIEWS
# =============================================================================


@api_view(["POST"])
@permission_classes([AllowAny])
@trace_function("signup")
def signup(request):
    """
    Sign up new tenant + user

    POST /api/auth/signup
    {
        "tenant_name": "Acme Corp",
        "tenant_slug": "acme",
        "email": "owner@acme.com",
        "password": "SecurePassword123!",
        "password_confirm": "SecurePassword123!",
        "first_name": "John",
        "last_name": "Doe",
        "stripe_payment_method_id": "pm_xxx",  // Optional
        "start_trial": true
    }

    Returns:
        {
            "tenant": {...},
            "user": {...},
            "access": "jwt_access_token",
            "refresh": "jwt_refresh_token"
        }
    """
    serializer = SignupSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = serializer.save()
        tenant = result["tenant"]
        user = result["user"]

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        refresh["tenant_id"] = str(tenant.id)

        api_logger.info(
            "New tenant signup",
            extra={
                "tenant_id": str(tenant.id),
                "user_id": str(user.id),
                "email": user.email,
            },
        )

        return Response(
            {
                "tenant": TenantSerializer(tenant).data,
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        api_logger.error(f"Signup failed: {str(e)}", exc_info=True)
        return Response(
            {"error": "Signup failed. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
@trace_function("login")
def login_view(request):
    """
    Login with email + password

    POST /api/auth/login
    {
        "email": "user@example.com",
        "password": "password123",
        "mfa_code": "123456"  // Optional, required if MFA enabled
    }

    Returns:
        {
            "user": {...},
            "tenant": {...},
            "access": "jwt_access_token",
            "refresh": "jwt_refresh_token",
            "mfa_required": false
        }
    """
    email = request.data.get("email")
    password = request.data.get("password")
    mfa_code = request.data.get("mfa_code")

    if not email or not password:
        return Response(
            {"error": "Email and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Authenticate user
    user = authenticate(request, username=email, password=password)

    if not user:
        login_attempts_counter.labels(status="failed", method="password").inc()
        return Response(
            {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
        )

    # Check if MFA is enabled
    if user.mfa_enabled:
        if not mfa_code:
            return Response(
                {"mfa_required": True, "message": "MFA code required"},
                status=status.HTTP_200_OK,
            )

        # Verify MFA code
        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(mfa_code, valid_window=1):
            mfa_verifications_counter.labels(status="failed").inc()
            return Response(
                {"error": "Invalid MFA code"}, status=status.HTTP_401_UNAUTHORIZED
            )

        mfa_verifications_counter.labels(status="success").inc()

    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    refresh["tenant_id"] = str(user.tenant.id)

    login_attempts_counter.labels(status="success", method="password").inc()

    api_logger.info(
        "User login",
        extra={"tenant_id": str(user.tenant.id), "user_id": str(user.id)},
    )

    return Response(
        {
            "user": UserSerializer(user).data,
            "tenant": TenantSerializer(user.tenant).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "mfa_required": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@trace_function("mfa_setup")
def mfa_setup(request):
    """
    Set up MFA (TOTP) for user

    POST /api/auth/mfa/setup

    Returns:
        {
            "secret": "BASE32_SECRET",
            "qr_code_url": "data:image/png;base64,..."
        }
    """
    user = request.user

    # Generate new TOTP secret
    secret = pyotp.random_base32()

    # Generate QR code
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.email, issuer_name="Components Platform V2"
    )

    # Create QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_code_data = buffer.getvalue()

    # Encode to base64
    import base64

    qr_code_base64 = base64.b64encode(qr_code_data).decode()

    # Save secret to user (but don't enable MFA yet)
    user.mfa_secret = secret
    user.save(update_fields=["mfa_secret"])

    return Response(
        {"secret": secret, "qr_code_url": f"data:image/png;base64,{qr_code_base64}"},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@trace_function("mfa_verify")
def mfa_verify(request):
    """
    Verify and enable MFA

    POST /api/auth/mfa/verify
    {
        "code": "123456"
    }
    """
    user = request.user
    code = request.data.get("code")

    if not code:
        return Response(
            {"error": "MFA code is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    if not user.mfa_secret:
        return Response(
            {"error": "MFA not set up. Call /mfa/setup first."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify code
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(code, valid_window=1):
        mfa_verifications_counter.labels(status="failed").inc()
        return Response(
            {"error": "Invalid MFA code"}, status=status.HTTP_401_UNAUTHORIZED
        )

    # Enable MFA
    user.mfa_enabled = True
    user.save(update_fields=["mfa_enabled"])

    mfa_verifications_counter.labels(status="success").inc()

    return Response({"message": "MFA enabled successfully"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_disable(request):
    """
    Disable MFA

    POST /api/auth/mfa/disable
    {
        "password": "user_password"
    }
    """
    user = request.user
    password = request.data.get("password")

    if not password:
        return Response(
            {"error": "Password is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    # Verify password
    if not user.check_password(password):
        return Response(
            {"error": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED
        )

    # Disable MFA
    user.mfa_enabled = False
    user.mfa_secret = ""
    user.save(update_fields=["mfa_enabled", "mfa_secret"])

    return Response(
        {"message": "MFA disabled successfully"}, status=status.HTTP_200_OK
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def oauth_login(request, provider):
    """
    Initiate OAuth login

    GET /api/auth/oauth/{provider}/  (provider: google, github)
    """
    if provider == "google":
        redirect_uri = f"{settings.BACKEND_URL}/api/auth/oauth/google/callback"
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={settings.GOOGLE_OAUTH2_KEY}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope=openid email profile"
        )
        return redirect(auth_url)

    elif provider == "github":
        redirect_uri = f"{settings.BACKEND_URL}/api/auth/oauth/github/callback"
        auth_url = (
            f"https://github.com/login/oauth/authorize?"
            f"client_id={settings.GITHUB_OAUTH_KEY}&"
            f"redirect_uri={redirect_uri}&"
            f"scope=user:email"
        )
        return redirect(auth_url)

    return Response(
        {"error": "Invalid OAuth provider"}, status=status.HTTP_400_BAD_REQUEST
    )


@api_view(["GET"])
@permission_classes([AllowAny])
@trace_function("oauth_callback")
def oauth_callback(request, provider):
    """
    OAuth callback handler

    GET /api/auth/oauth/{provider}/callback?code=xxx
    """
    code = request.GET.get("code")

    if not code:
        return Response(
            {"error": "Authorization code not provided"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        if provider == "google":
            # Exchange code for access token
            token_response = requests.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_OAUTH2_KEY,
                    "client_secret": settings.GOOGLE_OAUTH2_SECRET,
                    "redirect_uri": f"{settings.BACKEND_URL}/api/auth/oauth/google/callback",
                    "grant_type": "authorization_code",
                },
            )
            token_data = token_response.json()
            access_token = token_data.get("access_token")

            # Get user info
            user_response = requests.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_response.json()
            email = user_data.get("email")
            first_name = user_data.get("given_name", "")
            last_name = user_data.get("family_name", "")

        elif provider == "github":
            # Exchange code for access token
            token_response = requests.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "code": code,
                    "client_id": settings.GITHUB_OAUTH_KEY,
                    "client_secret": settings.GITHUB_OAUTH_SECRET,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_response.json()
            access_token = token_data.get("access_token")

            # Get user info
            user_response = requests.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_response.json()
            email = user_data.get("email")

            # If email is null, get primary email
            if not email:
                emails_response = requests.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                emails = emails_response.json()
                email = next(
                    (e["email"] for e in emails if e["primary"]), emails[0]["email"]
                )

            name_parts = user_data.get("name", "").split(" ", 1)
            first_name = name_parts[0] if name_parts else ""
            last_name = name_parts[1] if len(name_parts) > 1 else ""

        else:
            return Response(
                {"error": "Invalid OAuth provider"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Find or create user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # For OAuth, we require tenant context - redirect to signup
            return redirect(
                f"{settings.FRONTEND_URL}/signup?email={email}&oauth_provider={provider}"
            )

        # Update OAuth provider if not set
        if not user.oauth_provider:
            user.oauth_provider = provider
            user.save(update_fields=["oauth_provider"])

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        refresh["tenant_id"] = str(user.tenant.id)

        login_attempts_counter.labels(status="success", method=f"oauth_{provider}").inc()

        # Redirect to frontend with tokens
        return redirect(
            f"{settings.FRONTEND_URL}/auth/callback?"
            f"access={str(refresh.access_token)}&"
            f"refresh={str(refresh)}"
        )

    except Exception as e:
        api_logger.error(f"OAuth callback failed: {str(e)}", exc_info=True)
        return Response(
            {"error": "OAuth authentication failed"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# =============================================================================
# COMPONENT VIEWSET
# =============================================================================


class ComponentViewSet(viewsets.ModelViewSet):
    """
    Component CRUD operations

    List: GET /api/components/
    Create: POST /api/components/
    Retrieve: GET /api/components/{id}/
    Update: PUT /api/components/{id}/
    Delete: DELETE /api/components/{id}/
    Search: GET /api/components/search/?q=ATmega328
    """

    serializer_class = ComponentSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, ComponentPermissions]

    def get_queryset(self):
        """
        Filter components by tenant and user access permissions

        If user.can_view_all_tenant_components = True:
            User can see all components in their tenant
        If user.can_view_all_tenant_components = False:
            User can only see components they created
        """
        queryset = Component.objects.filter(tenant=self.request.tenant)

        # Check user's component access permission
        user = self.request.user
        if hasattr(user, 'can_view_all_tenant_components'):
            if not user.can_view_all_tenant_components:
                # User can only see their own components
                queryset = queryset.filter(created_by=user)

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        """Create component with tenant context and creator tracking"""
        component = serializer.save(
            tenant=self.request.tenant,
            created_by=self.request.user
        )

        # Track metric
        track_component_created(
            tenant_id=str(self.request.tenant.id),
            category=component.category,
            vendor=component.vendor_source,
        )

        api_logger.info(
            f"Component created: {component.mpn}",
            extra={
                "tenant_id": str(self.request.tenant.id),
                "component_id": str(component.id),
                "created_by": str(self.request.user.id),
            },
        )

    @action(detail=False, methods=["get"])
    def search(self, request):
        """
        Search components by MPN, manufacturer, or description

        GET /api/components/search/?q=ATmega
        """
        query = request.query_params.get("q", "")

        if not query:
            return Response(
                {"error": "Query parameter 'q' is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        components = self.get_queryset().filter(
            Q(mpn__icontains=query)
            | Q(manufacturer_name__icontains=query)
            | Q(description__icontains=query)
        )

        serializer = self.get_serializer(components, many=True)
        return Response(serializer.data)


# =============================================================================
# BOM VIEWSET
# =============================================================================


class BOMViewSet(viewsets.ModelViewSet):
    """
    BOM CRUD operations

    List: GET /api/boms/
    Create: POST /api/boms/
    Retrieve: GET /api/boms/{id}/
    Update: PUT /api/boms/{id}/
    Delete: DELETE /api/boms/{id}/
    Upload: POST /api/boms/upload/
    """

    serializer_class = BOMSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, BOMPermissions]

    def get_queryset(self):
        """Filter BOMs by tenant"""
        return BOM.objects.filter(tenant=self.request.tenant).order_by("-created_at")

    def perform_create(self, serializer):
        """Create BOM with tenant context"""
        bom = serializer.save(tenant=self.request.tenant)

        api_logger.info(
            f"BOM created: {bom.name}",
            extra={"tenant_id": str(self.request.tenant.id), "bom_id": str(bom.id)},
        )

    @action(detail=False, methods=["post"])
    def upload(self, request):
        """
        Upload BOM file (CSV/Excel) and create BOM with line items

        POST /api/boms/upload/
        - file: BOM file (CSV or Excel)
        - name: BOM name (optional, defaults to filename)
        - description: BOM description (optional)
        """
        import csv
        import pandas as pd
        from io import StringIO, BytesIO

        file = request.FILES.get('file')
        if not file:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        bom_name = request.data.get('name', file.name)
        bom_description = request.data.get('description', '')

        try:
            # Parse file based on extension
            if file.name.endswith('.csv'):
                content = file.read().decode('utf-8')
                reader = csv.DictReader(StringIO(content))
                rows = list(reader)
            elif file.name.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(BytesIO(file.read()))
                rows = df.to_dict('records')
            else:
                return Response(
                    {"error": "Unsupported file format. Use CSV or Excel"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create BOM
            bom = BOM.objects.create(
                tenant=request.tenant,
                name=bom_name,
                description=bom_description,
                status='pending_enrichment'
            )

            # Create line items
            line_items_created = 0
            for row in rows:
                # Try to map common column names
                ref = row.get('Reference') or row.get('Designator') or row.get('RefDes') or ''
                qty = row.get('Quantity') or row.get('Qty') or 1
                mpn = row.get('MPN') or row.get('Part Number') or row.get('PartNumber') or ''
                mfr = row.get('Manufacturer') or row.get('Mfr') or ''
                desc = row.get('Description') or row.get('Desc') or ''

                if mpn:  # Only create if we have at least an MPN
                    BOMLineItem.objects.create(
                        bom=bom,
                        reference_designator=str(ref),
                        quantity=int(qty) if str(qty).isdigit() else 1,
                        mpn_raw=str(mpn),
                        manufacturer_raw=str(mfr),
                        description_raw=str(desc),
                        manually_selected=False
                    )
                    line_items_created += 1

            # Update BOM component count
            bom.component_count = line_items_created
            bom.save(update_fields=['component_count'])

            api_logger.info(
                f"[GATE: BOM Upload] BOM uploaded: {bom.name} with {line_items_created} items",
                extra={"tenant_id": str(request.tenant.id), "bom_id": str(bom.id)}
            )

            # Trigger Temporal workflow for BOM enrichment
            workflow_id = None
            try:
                from cns_integration import trigger_bom_enrichment_workflow

                api_logger.info(
                    f"[GATE: Temporal] Triggering BOM enrichment workflow for BOM {bom.id}",
                    extra={"bom_id": str(bom.id), "line_items": line_items_created}
                )

                workflow_id = trigger_bom_enrichment_workflow(
                    bom_id=str(bom.id),
                    tenant_id=str(request.tenant.id),
                    total_items=line_items_created
                )

                api_logger.info(
                    f"[GATE: Temporal] ✅ Workflow started: {workflow_id}",
                    extra={"bom_id": str(bom.id), "workflow_id": workflow_id}
                )

            except Exception as e:
                api_logger.error(
                    f"[GATE: Temporal] ❌ Failed to start workflow: {str(e)}",
                    extra={"bom_id": str(bom.id)},
                    exc_info=True
                )
                # Don't fail the upload if workflow fails, just log it

            return Response({
                "id": str(bom.id),
                "name": bom.name,
                "status": bom.status,
                "component_count": line_items_created,
                "workflow_id": workflow_id,
                "message": f"BOM uploaded successfully with {line_items_created} line items" +
                          (f" - Workflow {workflow_id} started" if workflow_id else " - Workflow not started")
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            api_logger.error(f"BOM upload failed: {str(e)}", exc_info=True)
            return Response(
                {"error": f"Failed to process BOM file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# =============================================================================
# ALERT VIEWSET
# =============================================================================


class AlertViewSet(viewsets.ModelViewSet):
    """
    Alert CRUD operations

    List: GET /api/alerts/
    Retrieve: GET /api/alerts/{id}/
    Mark as read: PATCH /api/alerts/{id}/
    Delete: DELETE /api/alerts/{id}/
    """

    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, AlertPermissions]

    def get_queryset(self):
        """Filter alerts by tenant"""
        return Alert.objects.filter(component__tenant=self.request.tenant).order_by(
            "-created_at"
        )

    @action(detail=False, methods=["get"])
    def unread(self, request):
        """Get unread alerts only"""
        alerts = self.get_queryset().filter(is_read=False)
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)


# =============================================================================
# USER MANAGEMENT VIEWSET
# =============================================================================


class UserViewSet(viewsets.ModelViewSet):
    """
    User management (tenant-scoped)

    List: GET /api/users/
    Create: POST /api/users/
    Retrieve: GET /api/users/{id}/
    Update: PUT /api/users/{id}/
    Delete: DELETE /api/users/{id}/
    """

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, CanManageUsers]

    def get_queryset(self):
        """Filter users by tenant"""
        return User.objects.filter(tenant=self.request.tenant).order_by("-created_at")

    def perform_create(self, serializer):
        """Create user with tenant context"""
        user = serializer.save(tenant=self.request.tenant)

        api_logger.info(
            f"User created: {user.email}",
            extra={"tenant_id": str(self.request.tenant.id), "user_id": str(user.id)},
        )
