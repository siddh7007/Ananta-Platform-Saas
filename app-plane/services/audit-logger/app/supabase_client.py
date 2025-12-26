"""
Supabase Client for Audit Logger Service

Uses direct PostgreSQL connection to insert audit logs.
Bypasses REST API and RLS for service-to-service communication.
"""

import os
import json
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

import psycopg2
from psycopg2.extras import RealDictCursor, Json
from shared.logger_config import get_logger

logger = get_logger('supabase_client')


class SupabaseClient:
    """
    PostgreSQL client for inserting audit logs directly
    """

    def __init__(self):
        # Get database connection details
        self.db_host = os.getenv('SUPABASE_DB_HOST', 'components-v2-supabase-db')
        self.db_port = os.getenv('SUPABASE_DB_PORT', '5432')
        self.db_name = os.getenv('SUPABASE_DB_NAME', 'postgres')
        self.db_user = os.getenv('SUPABASE_DB_USER', 'postgres')
        self.db_password = os.getenv('SUPABASE_DB_PASSWORD', 'supabase-postgres-secure-2024')

        self.conn = None
        self._connect()
        logger.info(f"PostgreSQL client initialized: {self.db_host}:{self.db_port}/{self.db_name}")

    def _connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                dbname=self.db_name,
                user=self.db_user,
                password=self.db_password
            )
            self.conn.autocommit = True
            logger.info("Database connection established")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    def _ensure_connection(self):
        """Ensure database connection is active, reconnect if needed"""
        try:
            if self.conn is None or self.conn.closed:
                self._connect()
            else:
                # Test connection with a simple query
                with self.conn.cursor() as cur:
                    cur.execute("SELECT 1")
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            logger.warning("Database connection lost, reconnecting...")
            self._connect()

    def insert_audit_log(self, audit_log: Dict[str, Any]) -> Optional[Dict]:
        """
        Insert audit log record into public.audit_logs table

        Args:
            audit_log: Dictionary with audit log fields

        Returns:
            Inserted record or None on failure
        """
        try:
            self._ensure_connection()

            # Prepare the insert query
            columns = ['event_type', 'routing_key', 'timestamp', 'user_id', 'username',
                       'email', 'ip_address', 'user_agent', 'source', 'session_id',
                       'organization_id', 'event_data']

            # Build values, using None for missing fields
            values = []
            for col in columns:
                if col == 'event_data':
                    values.append(Json(audit_log.get(col, {})))
                elif col == 'timestamp':
                    ts = audit_log.get(col)
                    if isinstance(ts, str):
                        values.append(ts)
                    else:
                        values.append(datetime.utcnow().isoformat())
                else:
                    values.append(audit_log.get(col))

            # Build the INSERT query
            placeholders = ', '.join(['%s'] * len(columns))
            column_names = ', '.join(columns)
            query = f"""
                INSERT INTO audit_logs ({column_names})
                VALUES ({placeholders})
                RETURNING id, event_type, created_at
            """

            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, values)
                result = cur.fetchone()

            if result:
                logger.info(f"✓ Audit log inserted: {result['event_type']} (id={result['id']})")
                return dict(result)
            else:
                logger.warning(f"Insert returned no data: {audit_log.get('event_type')}")
                return None

        except Exception as e:
            logger.error(
                f"Failed to insert audit log: {e}\n"
                f"Event: {audit_log.get('event_type')}\n"
                f"Error type: {type(e).__name__}\n"
                f"Audit log data: {audit_log}",
                exc_info=True
            )
            return None

    def get_recent_auth_events(self, limit: int = 100) -> list:
        """
        Query recent authentication events (last 24 hours)
        """
        try:
            self._ensure_connection()
            query = """
                SELECT * FROM audit_logs
                WHERE event_type LIKE 'auth.%' OR event_type IN ('user_login', 'user_logout')
                ORDER BY created_at DESC
                LIMIT %s
            """
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (limit,))
                return [dict(row) for row in cur.fetchall()]

        except Exception as e:
            logger.error(f"Failed to query recent auth events: {e}")
            return []

    def get_user_login_history(self, email: Optional[str] = None) -> list:
        """
        Query user login history

        Args:
            email: Optional filter by specific user email
        """
        try:
            self._ensure_connection()
            if email:
                query = """
                    SELECT * FROM audit_logs
                    WHERE email = %s AND event_type IN ('user_login', 'user_logout')
                    ORDER BY created_at DESC
                """
                params = (email,)
            else:
                query = """
                    SELECT * FROM audit_logs
                    WHERE event_type IN ('user_login', 'user_logout')
                    ORDER BY created_at DESC
                    LIMIT 100
                """
                params = None

            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                if params:
                    cur.execute(query, params)
                else:
                    cur.execute(query)
                return [dict(row) for row in cur.fetchall()]

        except Exception as e:
            logger.error(f"Failed to query user login history: {e}")
            return []

    def health_check(self) -> bool:
        """
        Verify database connection by querying audit_logs table

        Returns:
            True if connection is working, False otherwise
        """
        try:
            self._ensure_connection()
            with self.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM audit_logs")
                count = cur.fetchone()[0]
            logger.info(f"Database health check: OK (audit_logs has {count} records)")
            return True

        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
