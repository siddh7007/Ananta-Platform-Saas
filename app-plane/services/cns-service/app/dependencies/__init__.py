"""
Scope Validation Dependencies

Provides FastAPI dependencies for scope validation.
"""

from .scope_deps import (
    require_workspace_context,
    require_project_context,
    require_bom_context,
    get_optional_workspace_context,
    get_optional_project_context,
)

__all__ = [
    "require_workspace_context",
    "require_project_context",
    "require_bom_context",
    "get_optional_workspace_context",
    "get_optional_project_context",
]
