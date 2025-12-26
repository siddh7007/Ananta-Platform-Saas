"""
Configuration Management for Audit Logger Service
"""

import os
from typing import Optional


class Config:
    """
    Configuration loaded from environment variables
    """

    def __init__(self):
        # RabbitMQ Configuration
        self.RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
        self.RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', '27250'))
        self.RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'admin')
        self.RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'admin123_change_in_production')
        self.RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', '/')
        self.RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_EXCHANGE', 'platform.events')

        # PostgreSQL Direct Connection Configuration
        self.SUPABASE_DB_HOST = os.getenv('SUPABASE_DB_HOST', 'components-v2-supabase-db')
        self.SUPABASE_DB_PORT = os.getenv('SUPABASE_DB_PORT', '5432')
        self.SUPABASE_DB_NAME = os.getenv('SUPABASE_DB_NAME', 'postgres')
        self.SUPABASE_DB_USER = os.getenv('SUPABASE_DB_USER', 'postgres')
        self.SUPABASE_DB_PASSWORD = os.getenv('SUPABASE_DB_PASSWORD', 'supabase-postgres-secure-2024')

        # Validate required configuration
        self._validate()

    def _validate(self):
        """Validate that required configuration is present"""
        # All database config has defaults, so nothing strictly required
        # Just ensure RabbitMQ connection is possible
        pass

    def __repr__(self):
        """String representation (safe - doesn't expose secrets)"""
        return (
            f"Config(\n"
            f"  RABBITMQ_HOST={self.RABBITMQ_HOST},\n"
            f"  RABBITMQ_PORT={self.RABBITMQ_PORT},\n"
            f"  RABBITMQ_USER={self.RABBITMQ_USER},\n"
            f"  SUPABASE_DB_HOST={self.SUPABASE_DB_HOST},\n"
            f"  SUPABASE_DB_PORT={self.SUPABASE_DB_PORT},\n"
            f"  RABBITMQ_EXCHANGE={self.RABBITMQ_EXCHANGE}\n"
            f")"
        )
