"""
Django settings for Components Platform V2 (Multi-tenant SaaS)

Architecture:
- 100% Temporal workflows (no Celery)
- Jaeger for distributed tracing
- Loki for log aggregation
- Prometheus for metrics
- Grafana for unified dashboards
- Playwright + MCP for AI-powered testing
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-CHANGE-THIS-IN-PRODUCTION')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# Allow all hosts by default in development (Docker network + LAN access)
# In production, set ALLOWED_HOSTS env var explicitly
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',') if os.getenv('ALLOWED_HOSTS') else ['*']

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'social_django',

    # Local apps
    'catalog.apps.CatalogConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',

    # Custom middleware
    'catalog.middleware.TenantMiddleware',  # Multi-tenant context injection
    'catalog.middleware.LoggingMiddleware',  # Structured logging
]

ROOT_URLCONF = 'app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'social_django.context_processors.backends',
                'social_django.context_processors.login_redirect',
            ],
        },
    },
]

WSGI_APPLICATION = 'app.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'components_v2'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'OPTIONS': {
            'connect_timeout': 10,
        },
        'CONN_MAX_AGE': 600,  # Connection pooling
    }
}

# Custom User Model
AUTH_USER_MODEL = 'catalog.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8}
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Password hashing (Argon2 - most secure)
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =============================================================================
# DJANGO REST FRAMEWORK
# =============================================================================

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour'
    },
    # 'EXCEPTION_HANDLER': 'catalog.exceptions.custom_exception_handler',  # TODO: Create exceptions.py
}

# =============================================================================
# JWT AUTHENTICATION
# =============================================================================

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,

    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': 'components-platform-v2',

    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',

    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',

    'JTI_CLAIM': 'jti',
}

# =============================================================================
# OAUTH (Social Authentication)
# =============================================================================

AUTHENTICATION_BACKENDS = (
    'social_core.backends.google.GoogleOAuth2',
    'social_core.backends.github.GithubOAuth2',
    'django.contrib.auth.backends.ModelBackend',
)

SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = os.getenv('GOOGLE_OAUTH2_KEY', '')
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = os.getenv('GOOGLE_OAUTH2_SECRET', '')

SOCIAL_AUTH_GITHUB_KEY = os.getenv('GITHUB_OAUTH_KEY', '')
SOCIAL_AUTH_GITHUB_SECRET = os.getenv('GITHUB_OAUTH_SECRET', '')

SOCIAL_AUTH_PIPELINE = (
    'social_core.pipeline.social_auth.social_details',
    'social_core.pipeline.social_auth.social_uid',
    'social_core.pipeline.social_auth.auth_allowed',
    'social_core.pipeline.social_auth.social_user',
    'catalog.oauth_pipeline.create_tenant_and_user',  # Custom
    'social_core.pipeline.user.get_username',
    'social_core.pipeline.social_auth.associate_user',
    'social_core.pipeline.social_auth.load_extra_data',
    'social_core.pipeline.user.user_details',
)

# =============================================================================
# CORS (Cross-Origin Resource Sharing)
# =============================================================================

CORS_ALLOWED_ORIGINS = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3001,http://127.0.0.1:3001'
).split(',')

CORS_ALLOW_CREDENTIALS = True

# =============================================================================
# REDIS & CACHING
# =============================================================================

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {},  # CLIENT_CLASS removed - not needed for RedisCache backend
        'KEY_PREFIX': 'components_v2',
        'TIMEOUT': 300,  # 5 minutes
    }
}

# Session backend
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# =============================================================================
# TEMPORAL (100% Workflow Orchestration - NO CELERY)
# =============================================================================

TEMPORAL_HOST = os.getenv('TEMPORAL_HOST', 'localhost:7233')
TEMPORAL_NAMESPACE = os.getenv('TEMPORAL_NAMESPACE', 'default')
TEMPORAL_TASK_QUEUE = os.getenv('TEMPORAL_TASK_QUEUE', 'components-v2')

# Temporal replaces ALL Celery functionality:
# - Background tasks → Temporal activities
# - Periodic tasks → Temporal schedules
# - Long-running processes → Temporal workflows
# - Retries → Temporal retry policies
# - Monitoring → Temporal UI + Jaeger traces

# =============================================================================
# STORAGE (S3/MinIO)
# =============================================================================

# MinIO/S3 Configuration
AWS_ACCESS_KEY_ID = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
AWS_SECRET_ACCESS_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
AWS_STORAGE_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'components-platform')
AWS_S3_ENDPOINT_URL = os.getenv('MINIO_ENDPOINT', 'http://localhost:9000')
AWS_S3_USE_SSL = os.getenv('S3_USE_SSL', 'False') == 'True'
AWS_S3_REGION_NAME = os.getenv('S3_REGION', 'us-east-1')

# S3 Configuration
AWS_DEFAULT_ACL = 'private'
AWS_S3_FILE_OVERWRITE = False
AWS_QUERYSTRING_AUTH = True  # Generate signed URLs
AWS_QUERYSTRING_EXPIRE = 3600  # 1 hour

# =============================================================================
# MEILISEARCH (Search Engine)
# =============================================================================

MEILISEARCH_URL = os.getenv('MEILISEARCH_URL', 'http://localhost:7700')
MEILISEARCH_API_KEY = os.getenv('MEILISEARCH_API_KEY', 'masterKey')

# =============================================================================
# STRIPE (Payment Gateway)
# =============================================================================

STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY', '')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PRICE_ID = os.getenv('STRIPE_PRICE_ID', '')  # $100/month price ID

# =============================================================================
# ANTHROPIC AI (Claude)
# =============================================================================

ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')

# =============================================================================
# DIRECTUS CMS
# =============================================================================

DIRECTUS_URL = os.getenv('DIRECTUS_URL', 'http://localhost:8055')
DIRECTUS_TOKEN = os.getenv('DIRECTUS_TOKEN', '')

# =============================================================================
# N8N AUTOMATION
# =============================================================================

N8N_URL = os.getenv('N8N_URL', 'http://localhost:5678')
N8N_API_KEY = os.getenv('N8N_API_KEY', '')

# =============================================================================
# EMAIL (SendGrid)
# =============================================================================

EMAIL_BACKEND = 'sendgrid_backend.SendgridBackend'
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@components-platform.com')

# =============================================================================
# LOGGING & OBSERVABILITY
# =============================================================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'catalog.logging_config.CustomJsonFormatter',
            'format': '%(timestamp)s %(level)s %(name)s %(message)s'
        },
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json' if not DEBUG else 'verbose',
        },
        'loki': {
            'class': 'logging_loki.LokiHandler',
            'url': os.getenv('LOKI_URL', 'http://localhost:3100/loki/api/v1/push'),
            'version': '1',
        },
    },
    'root': {
        'handlers': ['console', 'loki'],
        'level': 'INFO',
    },
    'loggers': {
        'catalog': {
            'handlers': ['console', 'loki'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'temporal': {
            'handlers': ['console', 'loki'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'loki'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# =============================================================================
# JAEGER (Distributed Tracing)
# =============================================================================

# Jaeger configuration for OpenTelemetry
JAEGER_AGENT_HOST = os.getenv('JAEGER_AGENT_HOST', 'localhost')
JAEGER_AGENT_PORT = int(os.getenv('JAEGER_AGENT_PORT', '6831'))
JAEGER_COLLECTOR_ENDPOINT = os.getenv(
    'JAEGER_COLLECTOR_ENDPOINT',
    'http://localhost:14268/api/traces'
)

# OpenTelemetry Service Name
OTEL_SERVICE_NAME = 'components-platform-v2-backend'

# Trace sampling (0.0 = none, 1.0 = all)
OTEL_TRACE_SAMPLING_RATE = float(os.getenv('OTEL_TRACE_SAMPLING_RATE', '0.1'))

# =============================================================================
# PROMETHEUS (Metrics)
# =============================================================================

PROMETHEUS_METRICS_PORT = int(os.getenv('PROMETHEUS_METRICS_PORT', '8000'))

# =============================================================================
# GRAFANA (Dashboards)
# =============================================================================

GRAFANA_URL = os.getenv('GRAFANA_URL', 'http://localhost:3000')

# =============================================================================
# FRONTEND CONFIGURATION
# =============================================================================

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3001')

# =============================================================================
# MULTI-TENANT SETTINGS
# =============================================================================

# Trial period duration (days)
TRIAL_PERIOD_DAYS = 14

# Default tenant limits
DEFAULT_MAX_USERS = 5
DEFAULT_MAX_COMPONENTS = 10000
DEFAULT_MAX_STORAGE_GB = 10

# Subscription pricing
SUBSCRIPTION_MONTHLY_PRICE = 100.00  # USD

# =============================================================================
# PLAYWRIGHT TESTING
# =============================================================================

PLAYWRIGHT_HEADLESS = os.getenv('PLAYWRIGHT_HEADLESS', 'True') == 'True'
PLAYWRIGHT_BROWSER = os.getenv('PLAYWRIGHT_BROWSER', 'chromium')  # chromium, firefox, webkit
PLAYWRIGHT_SLOW_MO = int(os.getenv('PLAYWRIGHT_SLOW_MO', '0'))  # Slow down by N ms

# Test data
TEST_TENANT_EMAIL = os.getenv('TEST_TENANT_EMAIL', 'test@example.com')
TEST_TENANT_PASSWORD = os.getenv('TEST_TENANT_PASSWORD', 'TestPassword123!')

# =============================================================================
# MCP TESTING SERVER
# =============================================================================

MCP_TESTING_SERVER_URL = os.getenv('MCP_TESTING_SERVER_URL', 'http://localhost:5008')
MCP_TESTING_ENABLED = os.getenv('MCP_TESTING_ENABLED', 'True') == 'True'

# =============================================================================
# SECURITY SETTINGS
# =============================================================================

if not DEBUG:
    # HTTPS
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # HSTS
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Other security
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
