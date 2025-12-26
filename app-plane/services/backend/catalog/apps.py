from django.apps import AppConfig


class CatalogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'catalog'

    def ready(self):
        # Import signals
        # import catalog.signals  # noqa

        # Initialize OpenTelemetry tracing
        from catalog.tracing import setup_tracing
        setup_tracing()
