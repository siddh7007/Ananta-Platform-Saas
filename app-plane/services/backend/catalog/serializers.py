"""
DRF Serializers for Components Platform V2

Handles serialization/deserialization for:
- Tenant management
- User authentication
- Components
- BOMs
- Alerts
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
import stripe
from django.conf import settings

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

# =============================================================================
# TENANT & USER SERIALIZERS
# =============================================================================


class TenantSerializer(serializers.ModelSerializer):
    """Tenant serializer with subscription details"""

    usage_percentage = serializers.SerializerMethodField()
    storage_percentage = serializers.SerializerMethodField()
    users_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id",
            "name",
            "slug",
            "subscription_status",
            "subscription_end_date",
            "trial_end_date",
            "stripe_customer_id",
            "stripe_subscription_id",
            "max_users",
            "max_components",
            "max_storage_gb",
            "current_components_count",
            "current_storage_gb",
            "usage_percentage",
            "storage_percentage",
            "users_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "stripe_customer_id",
            "stripe_subscription_id",
            "current_components_count",
            "current_storage_gb",
            "created_at",
        ]

    def get_usage_percentage(self, obj):
        """Calculate component usage percentage"""
        if obj.max_components == 0:
            return 0
        return round((obj.current_components_count / obj.max_components) * 100, 2)

    def get_storage_percentage(self, obj):
        """Calculate storage usage percentage"""
        if obj.max_storage_gb == 0:
            return 0
        return round((obj.current_storage_gb / obj.max_storage_gb) * 100, 2)

    def get_users_count(self, obj):
        """Get user count for tenant"""
        return obj.user_set.count()


class UserSerializer(serializers.ModelSerializer):
    """User serializer for profile management"""

    password = serializers.CharField(write_only=True, required=False)
    password_confirm = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "mfa_enabled",
            "oauth_provider",
            "is_active",
            "last_login",
            "created_at",
            "password",
            "password_confirm",
        ]
        read_only_fields = ["id", "oauth_provider", "last_login", "created_at"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate(self, attrs):
        """Validate password confirmation"""
        if "password" in attrs:
            if attrs.get("password") != attrs.get("password_confirm"):
                raise serializers.ValidationError(
                    {"password_confirm": "Passwords do not match"}
                )
            validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        """Create user with hashed password"""
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password")
        user = User.objects.create_user(**validated_data, password=password)
        return user

    def update(self, instance, validated_data):
        """Update user with optional password change"""
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class SignupSerializer(serializers.Serializer):
    """Serializer for new tenant + user signup"""

    # Tenant fields
    tenant_name = serializers.CharField(max_length=255)
    tenant_slug = serializers.SlugField(max_length=50)

    # User fields
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=50, required=False)
    last_name = serializers.CharField(max_length=50, required=False)

    # Payment fields
    stripe_payment_method_id = serializers.CharField(required=False)
    start_trial = serializers.BooleanField(default=True)

    def validate_tenant_slug(self, value):
        """Ensure tenant slug is unique"""
        if Tenant.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This organization name is already taken")
        return value

    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already registered")
        return value

    def validate(self, attrs):
        """Validate password confirmation"""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match"}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        """
        Create tenant + user + Stripe customer + subscription

        Returns:
            dict with 'tenant', 'user', 'stripe_customer'
        """
        from datetime import timedelta
        from django.utils import timezone

        # Extract fields
        tenant_name = validated_data["tenant_name"]
        tenant_slug = validated_data["tenant_slug"]
        email = validated_data["email"]
        password = validated_data["password"]
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")
        payment_method_id = validated_data.get("stripe_payment_method_id")
        start_trial = validated_data.get("start_trial", True)

        # 1. Create Stripe customer
        stripe.api_key = settings.STRIPE_SECRET_KEY
        stripe_customer = stripe.Customer.create(
            email=email,
            name=f"{first_name} {last_name}".strip() or email,
            metadata={"tenant_slug": tenant_slug},
        )

        # 2. Create tenant
        tenant = Tenant.objects.create(
            name=tenant_name,
            slug=tenant_slug,
            stripe_customer_id=stripe_customer.id,
            subscription_status="trial" if start_trial else "active",
            trial_end_date=(
                timezone.now() + timedelta(days=settings.TRIAL_PERIOD_DAYS)
                if start_trial
                else None
            ),
        )

        # 3. Create subscription if payment method provided
        if payment_method_id:
            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                payment_method_id, customer=stripe_customer.id
            )

            # Set as default payment method
            stripe.Customer.modify(
                stripe_customer.id,
                invoice_settings={"default_payment_method": payment_method_id},
            )

            # Create subscription
            subscription = stripe.Subscription.create(
                customer=stripe_customer.id,
                items=[{"price": settings.STRIPE_PRICE_ID}],
                trial_end="now" if not start_trial else None,
                metadata={"tenant_id": str(tenant.id)},
            )

            tenant.stripe_subscription_id = subscription.id
            tenant.save()

        # 4. Create owner user
        user = User.objects.create_user(
            tenant=tenant,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role="owner",
            is_active=True,
        )

        return {"tenant": tenant, "user": user, "stripe_customer": stripe_customer}


# =============================================================================
# COMPONENT SERIALIZERS
# =============================================================================


class ComponentParameterSerializer(serializers.ModelSerializer):
    """Component parameter serializer"""

    class Meta:
        model = ComponentParameter
        fields = [
            "id",
            "parameter_name",
            "normalized_value",
            "normalized_unit",
            "original_value",
            "original_unit",
        ]


class VendorPricingSerializer(serializers.ModelSerializer):
    """Vendor pricing serializer"""

    class Meta:
        model = VendorPricing
        fields = [
            "id",
            "vendor_name",
            "vendor_part_number",
            "unit_price",
            "quantity_available",
            "minimum_order_quantity",
            "packaging",
            "lead_time_days",
            "last_updated",
        ]


class ComponentSerializer(serializers.ModelSerializer):
    """Component serializer with nested parameters and pricing"""

    parameters = ComponentParameterSerializer(
        many=True, read_only=True, source="componentparameter_set"
    )
    pricing = VendorPricingSerializer(
        many=True, read_only=True, source="vendorpricing_set"
    )
    lowest_price = serializers.SerializerMethodField()

    class Meta:
        model = Component
        fields = [
            "id",
            "mpn",
            "manufacturer_name",
            "category",
            "description",
            "datasheet_url",
            "image_url",
            "model_3d_url",
            "lifecycle_status",
            "rohs_compliant",
            "reach_compliant",
            "vendor_source",
            "raw_vendor_data",
            "normalization_confidence",
            "ai_mapped_category",
            "created_at",
            "updated_at",
            "parameters",
            "pricing",
            "lowest_price",
        ]
        read_only_fields = [
            "id",
            "normalization_confidence",
            "ai_mapped_category",
            "created_at",
            "updated_at",
        ]

    def get_lowest_price(self, obj):
        """Get lowest unit price across all vendors"""
        pricing = obj.vendorpricing_set.all()
        if not pricing:
            return None
        return min(p.unit_price for p in pricing)


# =============================================================================
# BOM SERIALIZERS
# =============================================================================


class BOMLineItemSerializer(serializers.ModelSerializer):
    """BOM line item serializer"""

    component = ComponentSerializer(read_only=True)
    extended_cost = serializers.SerializerMethodField()

    class Meta:
        model = BOMLineItem
        fields = [
            "id",
            "line_number",
            "reference_designator",
            "part_number",
            "description",
            "quantity",
            "component",
            "match_method",
            "match_confidence",
            "unit_cost",
            "extended_cost",
            "notes",
        ]

    def get_extended_cost(self, obj):
        """Calculate extended cost (quantity * unit_cost)"""
        if obj.unit_cost is None:
            return None
        return obj.quantity * obj.unit_cost


class BOMSerializer(serializers.ModelSerializer):
    """BOM serializer with nested line items"""

    line_items = BOMLineItemSerializer(
        many=True, read_only=True, source="bomlineitem_set"
    )
    total_cost = serializers.SerializerMethodField()
    match_percentage = serializers.SerializerMethodField()

    class Meta:
        model = BOM
        fields = [
            "id",
            "name",
            "description",
            "revision",
            "status",
            "total_cost",
            "match_percentage",
            "created_at",
            "updated_at",
            "line_items",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_total_cost(self, obj):
        """Calculate total BOM cost"""
        line_items = obj.bomlineitem_set.all()
        total = sum(
            (item.quantity * item.unit_cost)
            for item in line_items
            if item.unit_cost is not None
        )
        return total

    def get_match_percentage(self, obj):
        """Calculate percentage of matched line items"""
        line_items = obj.bomlineitem_set.all()
        if not line_items:
            return 0
        matched = sum(1 for item in line_items if item.component is not None)
        return round((matched / len(line_items)) * 100, 2)


# =============================================================================
# ALERT SERIALIZERS
# =============================================================================


class AlertSerializer(serializers.ModelSerializer):
    """Alert serializer"""

    component = ComponentSerializer(read_only=True)

    class Meta:
        model = Alert
        fields = [
            "id",
            "component",
            "alert_type",
            "severity",
            "message",
            "metadata",
            "is_read",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AlertPreferenceSerializer(serializers.ModelSerializer):
    """Alert preference serializer"""

    class Meta:
        model = AlertPreference
        fields = [
            "id",
            "user",
            "alert_type",
            "enabled",
            "email_enabled",
            "webhook_url",
            "threshold_settings",
        ]
        read_only_fields = ["id", "user"]
