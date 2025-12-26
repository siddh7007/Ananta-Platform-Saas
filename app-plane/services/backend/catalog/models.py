"""
Django models for Components Platform V2 (Multi-tenant SaaS)

Models:
- Tenant: Multi-tenant master table
- User: Custom user model with tenant association
- Component: Normalized component data
- ComponentParameter: Component parameters (key-value pairs)
- VendorPricing: Vendor-specific pricing
- BOM: Bill of Materials
- BOMLineItem: Individual BOM line items
- Alert: Component alerts (lifecycle, price changes, etc.)
- AlertPreference: User alert preferences
- BillingEvent: Payment and subscription events
- CategoryMapping: AI-generated category mappings (cache)
- ParameterNormalization: Parameter normalization rules
"""

import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken


# =============================================================================
# TENANT MODELS
# =============================================================================

class Tenant(models.Model):
    """Master tenant table - one per customer organization"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, max_length=50, db_index=True)
    name = models.CharField(max_length=255)

    # Subscription
    subscription_status = models.CharField(
        max_length=20,
        choices=[
            ('trial', 'Trial'),
            ('active', 'Active'),
            ('past_due', 'Past Due'),
            ('canceled', 'Canceled'),
            ('suspended', 'Suspended')
        ],
        default='trial',
        db_index=True
    )
    stripe_customer_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    stripe_subscription_id = models.CharField(max_length=255, null=True, blank=True)

    # Limits
    max_users = models.IntegerField(default=5)
    max_components = models.IntegerField(default=10000)
    max_storage_gb = models.IntegerField(default=10)

    # Current usage
    current_users_count = models.IntegerField(default=0)
    current_components_count = models.IntegerField(default=0)
    current_storage_gb = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenants'
        indexes = [
            models.Index(fields=['subscription_status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def is_trial_expired(self):
        """Check if trial period has expired"""
        if self.subscription_status != 'trial':
            return False
        if not self.trial_ends_at:
            return False
        return timezone.now() > self.trial_ends_at

    def can_add_component(self):
        """Check if tenant can add more components"""
        return self.current_components_count < self.max_components

    def can_add_user(self):
        """Check if tenant can add more users"""
        return self.current_users_count < self.max_users


# =============================================================================
# USER MODELS
# =============================================================================

class UserManager(BaseUserManager):
    """Custom user manager"""

    def create_user(self, email, tenant, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        if not tenant:
            raise ValueError('Tenant is required')

        email = self.normalize_email(email)
        user = self.model(email=email, tenant=tenant, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        # Superusers don't need a tenant (platform admin)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'owner')

        # Create a system tenant for superuser
        tenant, _ = Tenant.objects.get_or_create(
            slug='system',
            defaults={'name': 'System Admin'}
        )

        return self.create_user(email, tenant, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with tenant association"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='users',
        db_index=True
    )

    # Profile
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    # Role-based permissions
    role = models.CharField(
        max_length=20,
        choices=[
            ('owner', 'Owner'),
            ('admin', 'Admin'),
            ('member', 'Member'),
            ('viewer', 'Viewer')
        ],
        default='member',
        db_index=True
    )

    # MFA
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=32, null=True, blank=True)

    # OAuth
    oauth_provider = models.CharField(max_length=20, null=True, blank=True)
    oauth_id = models.CharField(max_length=255, null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['tenant', 'email']),
            models.Index(fields=['oauth_provider', 'oauth_id']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"{self.email} ({self.tenant.name})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_tokens(self):
        """Generate JWT access + refresh tokens"""
        refresh = RefreshToken.for_user(self)
        refresh['tenant_id'] = str(self.tenant.id)
        refresh['tenant_slug'] = self.tenant.slug
        refresh['role'] = self.role

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }


# =============================================================================
# TENANT-AWARE BASE MODEL
# =============================================================================

class TenantAwareModel(models.Model):
    """Abstract base class for all tenant-scoped models"""

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        db_index=True
    )

    class Meta:
        abstract = True


# =============================================================================
# COMPONENT MODELS
# =============================================================================

class Component(TenantAwareModel):
    """Normalized component data from vendors"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mpn = models.CharField(max_length=255, db_index=True)
    manufacturer_name = models.CharField(max_length=255, db_index=True)

    # Normalized fields
    category = models.CharField(max_length=100, db_index=True)
    description = models.TextField()
    lifecycle_status = models.CharField(max_length=50, null=True, blank=True)

    # Media
    datasheet_s3_key = models.CharField(max_length=500, null=True, blank=True)
    datasheet_url = models.URLField(max_length=1000, null=True, blank=True)
    model_3d_s3_key = models.CharField(max_length=500, null=True, blank=True)
    image_s3_key = models.CharField(max_length=500, null=True, blank=True)

    # Source
    vendor_source = models.CharField(max_length=50)  # digikey, mouser, etc.
    raw_vendor_data = models.JSONField(default=dict)  # Audit trail

    # AI Normalization
    normalization_confidence = models.FloatField(null=True, blank=True)
    normalized_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'components'
        unique_together = [['tenant', 'mpn', 'manufacturer_name']]
        indexes = [
            models.Index(fields=['tenant', 'category']),
            models.Index(fields=['tenant', 'manufacturer_name']),
            models.Index(fields=['vendor_source']),
            models.Index(fields=['lifecycle_status']),
        ]

    def __str__(self):
        return f"{self.mpn} - {self.manufacturer_name}"


class ComponentParameter(models.Model):
    """Component parameters (key-value pairs)"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    component = models.ForeignKey(
        Component,
        on_delete=models.CASCADE,
        related_name='parameters'
    )

    # Normalized parameter
    parameter_id = models.CharField(max_length=100, db_index=True)  # e.g., "slew_rate"
    parameter_display_name = models.CharField(max_length=255)  # "Slew Rate"

    # Value
    value = models.JSONField()  # Normalized value
    unit = models.CharField(max_length=50, null=True, blank=True)
    type = models.CharField(max_length=20)  # integer, float, string, boolean

    # Original (for audit)
    original_name = models.CharField(max_length=255)
    original_value = models.CharField(max_length=500)

    # AI confidence
    normalization_confidence = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'component_parameters'
        indexes = [
            models.Index(fields=['component', 'parameter_id']),
        ]

    def __str__(self):
        return f"{self.component.mpn} - {self.parameter_display_name}: {self.value}"


class VendorPricing(models.Model):
    """Vendor-specific pricing information"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    component = models.ForeignKey(
        Component,
        on_delete=models.CASCADE,
        related_name='pricing'
    )

    vendor = models.CharField(max_length=50, db_index=True)
    currency = models.CharField(max_length=3, default='USD')

    # Pricing tiers (JSON array)
    # [{"quantity": 1, "price": 10.50}, {"quantity": 100, "price": 9.25}, ...]
    pricing_tiers = models.JSONField(default=list)

    # Availability
    in_stock = models.BooleanField(default=False)
    stock_quantity = models.IntegerField(null=True, blank=True)
    lead_time_days = models.IntegerField(null=True, blank=True)

    # Timestamps
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vendor_pricing'
        unique_together = [['component', 'vendor']]
        indexes = [
            models.Index(fields=['vendor', 'in_stock']),
        ]

    def __str__(self):
        return f"{self.component.mpn} - {self.vendor}"

    def get_price_for_quantity(self, quantity):
        """Get price for specific quantity"""
        if not self.pricing_tiers:
            return None

        # Find applicable tier
        applicable_price = None
        for tier in sorted(self.pricing_tiers, key=lambda x: x['quantity'], reverse=True):
            if quantity >= tier['quantity']:
                applicable_price = tier['price']
                break

        return applicable_price or self.pricing_tiers[0]['price']


# =============================================================================
# BOM MODELS
# =============================================================================

class BOM(TenantAwareModel):
    """Bill of Materials"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Ownership
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='boms_created'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('draft', 'Draft'),
            ('active', 'Active'),
            ('archived', 'Archived')
        ],
        default='draft'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'boms'
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['created_by']),
        ]

    def __str__(self):
        return f"{self.name} ({self.tenant.name})"

    def get_total_cost(self, quantity_multiplier=1):
        """Calculate total BOM cost"""
        total = 0
        for line_item in self.line_items.all():
            if line_item.matched_component:
                pricing = line_item.matched_component.pricing.first()
                if pricing:
                    price = pricing.get_price_for_quantity(
                        line_item.quantity * quantity_multiplier
                    )
                    if price:
                        total += price * line_item.quantity * quantity_multiplier
        return total


class BOMLineItem(models.Model):
    """Individual BOM line item"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bom = models.ForeignKey(
        BOM,
        on_delete=models.CASCADE,
        related_name='line_items'
    )

    # Original data from upload
    reference_designator = models.CharField(max_length=100)
    mpn_raw = models.CharField(max_length=255)
    manufacturer_raw = models.CharField(max_length=255, blank=True)
    description_raw = models.TextField(blank=True)
    quantity = models.IntegerField(default=1)

    # Matching
    matched_component = models.ForeignKey(
        Component,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bom_line_items'
    )
    match_confidence = models.FloatField(null=True, blank=True)
    match_method = models.CharField(
        max_length=20,
        choices=[
            ('exact', 'Exact MPN Match'),
            ('fuzzy', 'Fuzzy Match'),
            ('manual', 'Manual Override')
        ],
        null=True,
        blank=True
    )

    # User override
    manually_selected = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bom_line_items'
        indexes = [
            models.Index(fields=['bom', 'mpn_raw']),
        ]

    def __str__(self):
        return f"{self.reference_designator} - {self.mpn_raw}"


# =============================================================================
# ALERT MODELS
# =============================================================================

class Alert(TenantAwareModel):
    """Component alerts"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    component = models.ForeignKey(
        Component,
        on_delete=models.CASCADE,
        related_name='alerts'
    )

    # Alert type
    alert_type = models.CharField(
        max_length=50,
        choices=[
            ('lifecycle_change', 'Lifecycle Status Change'),
            ('price_increase', 'Price Increase'),
            ('price_decrease', 'Price Decrease'),
            ('stock_low', 'Low Stock'),
            ('stock_available', 'Stock Available'),
            ('compliance_issue', 'Compliance Issue')
        ],
        db_index=True
    )

    # Alert details
    title = models.CharField(max_length=255)
    message = models.TextField()
    severity = models.CharField(
        max_length=20,
        choices=[
            ('info', 'Info'),
            ('warning', 'Warning'),
            ('critical', 'Critical')
        ],
        default='info'
    )

    # Metadata
    old_value = models.CharField(max_length=255, null=True, blank=True)
    new_value = models.CharField(max_length=255, null=True, blank=True)
    metadata = models.JSONField(default=dict)

    # Status
    read = models.BooleanField(default=False)
    dismissed = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'alerts'
        indexes = [
            models.Index(fields=['tenant', 'alert_type', 'read']),
            models.Index(fields=['component', 'created_at']),
        ]

    def __str__(self):
        return f"{self.alert_type} - {self.component.mpn}"


class AlertPreference(TenantAwareModel):
    """User alert preferences"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='alert_preferences'
    )

    alert_type = models.CharField(max_length=50)
    enabled = models.BooleanField(default=True)

    # Channels
    email_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)

    # Thresholds
    threshold_value = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'alert_preferences'
        unique_together = [['user', 'alert_type']]

    def __str__(self):
        return f"{self.user.email} - {self.alert_type}"


# =============================================================================
# BILLING MODELS
# =============================================================================

class BillingEvent(models.Model):
    """Audit log for all billing events"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='billing_events'
    )

    event_type = models.CharField(
        max_length=50,
        choices=[
            ('subscription_created', 'Subscription Created'),
            ('subscription_updated', 'Subscription Updated'),
            ('subscription_canceled', 'Subscription Canceled'),
            ('payment_succeeded', 'Payment Succeeded'),
            ('payment_failed', 'Payment Failed'),
            ('trial_started', 'Trial Started'),
            ('trial_ending', 'Trial Ending'),
            ('trial_expired', 'Trial Expired')
        ],
        db_index=True
    )

    # Stripe
    stripe_event_id = models.CharField(max_length=255, unique=True, null=True, blank=True)

    # Amount
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')

    # Metadata
    metadata = models.JSONField(default=dict)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_events'
        indexes = [
            models.Index(fields=['tenant', 'event_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.tenant.name} - {self.event_type}"


# =============================================================================
# AI NORMALIZATION CACHE MODELS
# =============================================================================

class CategoryMapping(models.Model):
    """AI-generated category mappings (cache)"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    vendor = models.CharField(max_length=50, db_index=True)
    vendor_category = models.CharField(max_length=500, db_index=True)

    # Normalized
    standard_category = models.CharField(max_length=100)
    confidence = models.FloatField()

    # Approval
    approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_category_mappings'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'category_mappings_cache'
        unique_together = [['vendor', 'vendor_category']]

    def __str__(self):
        return f"{self.vendor}: {self.vendor_category} → {self.standard_category}"


class ParameterNormalization(models.Model):
    """Parameter normalization rules"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    parameter_id = models.CharField(max_length=100, unique=True, db_index=True)
    display_name = models.CharField(max_length=255)

    # Type
    type = models.CharField(
        max_length=20,
        choices=[
            ('integer', 'Integer'),
            ('float', 'Float'),
            ('string', 'String'),
            ('boolean', 'Boolean')
        ]
    )

    unit = models.CharField(max_length=50, null=True, blank=True)

    # Vendor aliases (JSON array)
    vendor_aliases = models.JSONField(default=list)

    # Parse patterns (regex)
    parse_patterns = models.JSONField(default=list)

    # Importance
    importance = models.CharField(
        max_length=20,
        choices=[
            ('critical', 'Critical'),
            ('high', 'High'),
            ('medium', 'Medium'),
            ('low', 'Low')
        ],
        default='medium'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'parameter_normalizations'

    def __str__(self):
        return f"{self.parameter_id} ({self.display_name})"
