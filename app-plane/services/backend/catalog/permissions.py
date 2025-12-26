"""
Permission Classes for Components Platform V2

Role-based permissions:
- owner: Full access to everything in tenant
- admin: Full access except billing/subscription
- member: Read/write components, BOMs, alerts
- viewer: Read-only access
"""

from rest_framework import permissions


class IsTenantMember(permissions.BasePermission):
    """
    Permission to check if user belongs to the tenant

    Automatically enforced by TenantMiddleware for all authenticated requests
    """

    def has_permission(self, request, view):
        """Check if user is authenticated and has tenant"""
        if not request.user.is_authenticated:
            return False

        # Tenant middleware should have set request.tenant
        if not hasattr(request, "tenant"):
            return False

        return request.user.tenant == request.tenant


class IsOwner(permissions.BasePermission):
    """Permission for tenant owner only"""

    def has_permission(self, request, view):
        """Check if user is owner"""
        if not request.user.is_authenticated:
            return False

        return request.user.role == "owner"


class IsOwnerOrAdmin(permissions.BasePermission):
    """Permission for owner or admin"""

    def has_permission(self, request, view):
        """Check if user is owner or admin"""
        if not request.user.is_authenticated:
            return False

        return request.user.role in ["owner", "admin"]


class IsOwnerAdminOrMember(permissions.BasePermission):
    """Permission for owner, admin, or member (excludes viewer)"""

    def has_permission(self, request, view):
        """Check if user has write access"""
        if not request.user.is_authenticated:
            return False

        # Allow all roles for safe methods (GET, HEAD, OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            return True

        # Only owner, admin, member can modify data
        return request.user.role in ["owner", "admin", "member"]


class CanManageUsers(permissions.BasePermission):
    """
    Permission to manage users

    Only owner and admin can manage users
    """

    def has_permission(self, request, view):
        """Check if user can manage users"""
        if not request.user.is_authenticated:
            return False

        # Allow viewing users for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True

        # Only owner and admin can add/edit/delete users
        return request.user.role in ["owner", "admin"]

    def has_object_permission(self, request, view, obj):
        """Check if user can modify specific user"""
        # Allow viewing
        if request.method in permissions.SAFE_METHODS:
            return True

        # Owner can modify anyone
        if request.user.role == "owner":
            return True

        # Admin can modify non-owners
        if request.user.role == "admin" and obj.role != "owner":
            return True

        # Users can modify themselves
        return obj == request.user


class CanManageBilling(permissions.BasePermission):
    """
    Permission to manage billing and subscriptions

    Only owner can manage billing
    """

    def has_permission(self, request, view):
        """Check if user can manage billing"""
        if not request.user.is_authenticated:
            return False

        # Allow viewing subscription status for all
        if request.method in permissions.SAFE_METHODS:
            return True

        # Only owner can modify billing
        return request.user.role == "owner"


class CanDeleteComponent(permissions.BasePermission):
    """
    Permission to delete components

    Only owner and admin can delete components
    """

    def has_permission(self, request, view):
        """Check if user can delete components"""
        if not request.user.is_authenticated:
            return False

        # Allow non-delete operations for all
        if request.method != "DELETE":
            return True

        # Only owner and admin can delete
        return request.user.role in ["owner", "admin"]


class CanDeleteBOM(permissions.BasePermission):
    """
    Permission to delete BOMs

    Only owner and admin can delete BOMs
    """

    def has_permission(self, request, view):
        """Check if user can delete BOMs"""
        if not request.user.is_authenticated:
            return False

        # Allow non-delete operations for all
        if request.method != "DELETE":
            return True

        # Only owner and admin can delete
        return request.user.role in ["owner", "admin"]


class CanExportData(permissions.BasePermission):
    """
    Permission to export data

    All authenticated users can export
    """

    def has_permission(self, request, view):
        """Check if user can export data"""
        return request.user.is_authenticated


class IsActiveSubscription(permissions.BasePermission):
    """
    Permission to check if tenant has active subscription

    Allows trial and active subscriptions, blocks past_due and canceled
    """

    message = "Your subscription is not active. Please update your payment method."

    def has_permission(self, request, view):
        """Check if tenant subscription is active"""
        if not hasattr(request, "tenant"):
            return False

        # Allow if subscription is active or trial
        return request.tenant.subscription_status in ["active", "trial"]


# =============================================================================
# COMPOSITE PERMISSIONS (Common combinations)
# =============================================================================


class ComponentPermissions(permissions.BasePermission):
    """
    Standard component permissions

    - Viewers: read-only
    - Members/Admins: read/write
    - Owners/Admins: delete
    """

    def has_permission(self, request, view):
        """Check component permissions"""
        if not request.user.is_authenticated:
            return False

        # Allow viewing for all roles
        if request.method in permissions.SAFE_METHODS:
            return True

        # Allow create/update for non-viewers
        if request.method in ["POST", "PUT", "PATCH"]:
            return request.user.role in ["owner", "admin", "member"]

        # Allow delete only for owner/admin
        if request.method == "DELETE":
            return request.user.role in ["owner", "admin"]

        return False


class BOMPermissions(permissions.BasePermission):
    """
    Standard BOM permissions

    Same as ComponentPermissions
    """

    def has_permission(self, request, view):
        """Check BOM permissions"""
        if not request.user.is_authenticated:
            return False

        # Allow viewing for all roles
        if request.method in permissions.SAFE_METHODS:
            return True

        # Allow create/update for non-viewers
        if request.method in ["POST", "PUT", "PATCH"]:
            return request.user.role in ["owner", "admin", "member"]

        # Allow delete only for owner/admin
        if request.method == "DELETE":
            return request.user.role in ["owner", "admin"]

        return False


class AlertPermissions(permissions.BasePermission):
    """
    Alert permissions

    All authenticated users can view/create alerts
    Only owner/admin can delete
    """

    def has_permission(self, request, view):
        """Check alert permissions"""
        if not request.user.is_authenticated:
            return False

        # Allow viewing and creating for all
        if request.method in permissions.SAFE_METHODS or request.method == "POST":
            return True

        # Allow marking as read for all
        if request.method in ["PUT", "PATCH"]:
            return True

        # Allow delete only for owner/admin
        if request.method == "DELETE":
            return request.user.role in ["owner", "admin"]

        return False
