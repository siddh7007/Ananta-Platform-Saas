"""
URL configuration for Components Platform V2
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from catalog import views
from catalog import api_docker_enhanced as api_docker
from catalog import api_ai_dev
from catalog import api_ai_test_gen
from catalog import catalog_api
from catalog.dev_logger_view import dev_logs_endpoint

# API Router
router = DefaultRouter()
router.register(r'components', views.ComponentViewSet, basename='component')
router.register(r'boms', views.BOMViewSet, basename='bom')
router.register(r'alerts', views.AlertViewSet, basename='alert')
router.register(r'users', views.UserViewSet, basename='user')

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Health Check (Public - No Auth Required)
    path('health', views.health_check, name='health'),
    path('ready', views.readiness_check, name='ready'),
    path('backend/ready', views.readiness_check, name='ready_prefixed'),
    path('api/supabase/health', views.supabase_health_check, name='supabase_health'),

    # Development Logging (DEBUG mode only)
    path('api/dev-logs', dev_logs_endpoint, name='dev_logs'),

    # Prometheus Metrics
    path('metrics', views.metrics_view, name='metrics'),

    # Authentication (Public - No Auth Required)
    path('api/auth/signup', views.signup, name='signup'),
    path('api/auth/login', views.login_view, name='login'),
    path('api/auth/token/refresh', TokenRefreshView.as_view(), name='token_refresh'),

    # OAuth
    path('api/auth/oauth/<str:provider>/', views.oauth_login, name='oauth_login'),
    path('api/auth/oauth/<str:provider>/callback', views.oauth_callback, name='oauth_callback'),

    # MFA (Authenticated)
    path('api/auth/mfa/setup', views.mfa_setup, name='mfa_setup'),
    path('api/auth/mfa/verify', views.mfa_verify, name='mfa_verify'),
    path('api/auth/mfa/disable', views.mfa_disable, name='mfa_disable'),

    # Docker Management API (authenticated) - Enhanced with SDK
    path('api/docker/health', api_docker.health_check, name='docker_health'),
    path('api/docker/health-summary', api_docker.health_summary, name='docker_health_summary'),
    path('api/docker/status', api_docker.container_status, name='docker_status'),
    path('api/docker/start', api_docker.start_service, name='docker_start'),
    path('api/docker/stop', api_docker.stop_service, name='docker_stop'),
    path('api/docker/restart', api_docker.restart_service, name='docker_restart'),
    path('api/docker/kill', api_docker.kill_service, name='docker_kill'),
    path('api/docker/rebuild', api_docker.rebuild_service, name='docker_rebuild'),
    path('api/docker/logs', api_docker.container_logs, name='docker_logs'),
    path('api/docker/stats', api_docker.container_stats_sdk, name='docker_stats'),

    # AI Development Cycle API (Closed-Loop AI Development)
    path('api/ai-dev/trigger', api_ai_dev.trigger_ai_dev_cycle, name='ai_dev_trigger'),
    path('api/ai-dev/status/<str:workflow_id>', api_ai_dev.get_workflow_status, name='ai_dev_status'),
    path('api/ai-dev/approve/<str:workflow_id>', api_ai_dev.approve_suggestions, name='ai_dev_approve'),
    path('api/ai-dev/apply-fixes', api_ai_dev.apply_code_fixes, name='ai_dev_apply_fixes'),
    path('api/ai-dev/workflows', api_ai_dev.list_workflows, name='ai_dev_list_workflows'),

    # AI Test Generation API (Ask AI to create tests)
    path('api/ai-dev/generate-test', api_ai_test_gen.generate_test, name='ai_generate_test'),
    path('api/ai-dev/generate-and-run', api_ai_test_gen.generate_and_run_test, name='ai_generate_and_run'),
    path('api/ai-dev/test-examples', api_ai_test_gen.test_generation_examples, name='ai_test_examples'),

    # Central Catalog API
    path('api/catalog/search', catalog_api.search_components, name='catalog_search'),
    path('api/catalog/components/<int:component_id>', catalog_api.get_component, name='catalog_component'),
    path('api/catalog/components/create', catalog_api.create_component, name='catalog_create_component'),
    path('api/catalog/manufacturers', catalog_api.list_manufacturers, name='catalog_manufacturers'),
    path('api/catalog/suppliers', catalog_api.list_suppliers, name='catalog_suppliers'),
    path('api/catalog/categories', catalog_api.list_categories, name='catalog_categories'),
    path('api/catalog/pricing/<int:component_id>', catalog_api.get_component_pricing, name='catalog_pricing'),
    path('api/catalog/compliance/<int:component_id>', catalog_api.get_component_compliance, name='catalog_compliance'),
    path('api/catalog/bulk-import', catalog_api.bulk_import_components, name='catalog_bulk_import'),
    path('api/catalog/stats', catalog_api.catalog_stats, name='catalog_stats'),

    # Main API (authenticated)
    path('api/', include(router.urls)),
]
