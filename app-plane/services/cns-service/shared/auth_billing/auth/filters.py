"""
Tenant Filtering (App-Layer RLS)

This module provides functions for filtering queries by tenant/organization.
It implements App-Layer Row-Level Security as an alternative to database-level RLS.
"""

import logging
from typing import List, Optional, Type, TypeVar

from sqlalchemy.orm import Query

logger = logging.getLogger(__name__)

# Type variable for generic model type
T = TypeVar('T')


def apply_tenant_filter(
    query: Query,
    model: Type[T],
    auth,  # AuthContext - avoid circular import
    org_column: str = "organization_id",
    log_action: str = "query"
) -> Query:
    """
    Apply tenant filtering to a SQLAlchemy query (App-Layer RLS).

    Super admins bypass tenant filtering and can see all data.
    Regular users only see data from their organization.

    Args:
        query: SQLAlchemy query to filter
        model: SQLAlchemy model class (for column reference)
        auth: Authorization context (AuthContext instance)
        org_column: Name of the organization_id column
        log_action: Description for logging

    Returns:
        Filtered query

    Example:
        query = db.query(Bom)
        query = apply_tenant_filter(query, Bom, auth)
        results = query.all()
    """
    if auth.is_super_admin:
        logger.info(
            f"[Auth] Tenant filter BYPASSED (super_admin): "
            f"user={auth.user_id} action={log_action} model={model.__name__}"
        )
        return query

    # Get the column from the model
    if hasattr(model, org_column):
        column = getattr(model, org_column)
        filtered_query = query.filter(column == auth.organization_id)

        logger.info(
            f"[Auth] Tenant filter APPLIED: user={auth.user_id} "
            f"org={auth.organization_id} action={log_action} model={model.__name__}"
        )

        return filtered_query
    else:
        logger.warning(
            f"[Auth] Model {model.__name__} has no '{org_column}' column, "
            f"skipping tenant filter"
        )
        return query


def apply_tenant_filter_raw(
    base_query: str,
    auth,  # AuthContext
    org_column: str = "organization_id",
    table_alias: Optional[str] = None,
    log_action: str = "raw_query"
) -> tuple[str, dict]:
    """
    Apply tenant filtering to a raw SQL query.

    Returns the WHERE clause and parameters to add to the query.

    Args:
        base_query: The base SQL query (for logging only)
        auth: Authorization context
        org_column: Name of the organization_id column
        table_alias: Optional table alias prefix (e.g., "t" for "t.organization_id")
        log_action: Description for logging

    Returns:
        Tuple of (WHERE clause string, parameters dict)

    Example:
        where_clause, params = apply_tenant_filter_raw("SELECT * FROM boms", auth)
        full_query = f"SELECT * FROM boms WHERE {where_clause}"
        db.execute(text(full_query), params)
    """
    column_ref = f"{table_alias}.{org_column}" if table_alias else org_column

    if auth.is_super_admin:
        logger.info(
            f"[Auth] Raw tenant filter BYPASSED (super_admin): "
            f"user={auth.user_id} action={log_action}"
        )
        return "1=1", {}  # No filtering

    logger.info(
        f"[Auth] Raw tenant filter APPLIED: user={auth.user_id} "
        f"org={auth.organization_id} action={log_action}"
    )

    return f"{column_ref} = :auth_org_id", {"auth_org_id": auth.organization_id}


def build_tenant_where_clause(
    auth,  # AuthContext
    org_column: str = "organization_id",
    table_alias: Optional[str] = None,
    explicit_org_filter: Optional[str] = None,
    log_action: str = "admin_query"
) -> tuple[List[str], dict]:
    """
    Build WHERE clause conditions and params for tenant filtering in admin endpoints.

    This is a convenience helper for admin endpoints that build raw SQL queries
    with multiple WHERE conditions. It handles the common pattern of:
    - Super admins see all data (optionally filtered by explicit org param)
    - Regular admins only see their own organization's data

    Args:
        auth: Authorization context
        org_column: Name of the organization_id column
        table_alias: Optional table alias prefix (e.g., "b" for "b.organization_id")
        explicit_org_filter: Optional explicit organization_id filter from query params
                            (only applies to super_admins, regular admins ignore this)
        log_action: Description for logging

    Returns:
        Tuple of (list of WHERE clause conditions, parameters dict)
        The conditions list can be joined with " AND " and added to existing conditions.

    Example:
        # In admin endpoint:
        conditions = []
        params = {"limit": limit}

        # Add tenant filter
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth,
            table_alias="b",
            explicit_org_filter=organization_id,  # from query param
            log_action="list_boms"
        )
        conditions.extend(tenant_conditions)
        params.update(tenant_params)

        # Add other filters
        if search:
            conditions.append("b.name ILIKE :pattern")
            params["pattern"] = f"%{search}%"

        where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    """
    column_ref = f"{table_alias}.{org_column}" if table_alias else org_column
    conditions: List[str] = []
    params: dict = {}

    if auth.is_super_admin:
        # Super admins can optionally filter by org, but aren't forced to
        if explicit_org_filter:
            conditions.append(f"{column_ref} = :filter_org_id")
            params["filter_org_id"] = explicit_org_filter
            logger.debug(
                f"[Auth] Super admin with explicit org filter: "
                f"user={auth.user_id} filter_org={explicit_org_filter} action={log_action}"
            )
        else:
            logger.debug(
                f"[Auth] Super admin no filter: user={auth.user_id} action={log_action}"
            )
    else:
        # Non-super_admins always filtered to their own org
        # Validate organization_id is not empty to prevent PostgreSQL UUID parse errors
        if not auth.organization_id:
            logger.error(
                f"[Auth] Missing organization_id for non-super_admin: user={auth.user_id} "
                f"role={auth.role} action={log_action}"
            )
            raise ValueError(
                f"Organization context required. User {auth.user_id} has no organization_id. "
                "Please ensure user is properly linked to an organization."
            )
        conditions.append(f"{column_ref} = :auth_org_id")
        params["auth_org_id"] = auth.organization_id
        logger.debug(
            f"[Auth] Tenant filter applied: user={auth.user_id} "
            f"org={auth.organization_id} action={log_action}"
        )

    return conditions, params
