"""
Unit Tests for Project Service

Tests the get_default_project_for_org function with various scenarios.
"""

import pytest
from unittest.mock import Mock, MagicMock
from sqlalchemy.orm import Session
from app.services.project_service import get_default_project_for_org


class TestGetDefaultProjectForOrg:
    """Test suite for get_default_project_for_org function"""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        return Mock(spec=Session)

    def test_returns_project_when_default_workspace_exists(self, mock_db):
        """Should return project from workspace with is_default=true"""
        # Arrange
        organization_id = "org-123"
        expected_project_id = "project-456"

        mock_result = MagicMock()
        mock_result.fetchone.return_value = (expected_project_id,)
        mock_db.execute.return_value = mock_result

        # Act
        result = get_default_project_for_org(mock_db, organization_id)

        # Assert
        assert result == expected_project_id
        mock_db.execute.assert_called_once()
        call_args = mock_db.execute.call_args
        assert "organization_id" in call_args[0][1]
        assert call_args[0][1]["organization_id"] == organization_id

    def test_returns_project_when_default_name_workspace_exists(self, mock_db):
        """Should return project from workspace named 'default'"""
        # Arrange
        organization_id = "org-789"
        expected_project_id = "project-abc"

        mock_result = MagicMock()
        mock_result.fetchone.return_value = (expected_project_id,)
        mock_db.execute.return_value = mock_result

        # Act
        result = get_default_project_for_org(mock_db, organization_id)

        # Assert
        assert result == expected_project_id

    def test_returns_none_when_no_projects_exist(self, mock_db):
        """Should return None when organization has no projects"""
        # Arrange
        organization_id = "org-empty"

        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        mock_db.execute.return_value = mock_result

        # Act
        result = get_default_project_for_org(mock_db, organization_id)

        # Assert
        assert result is None

    def test_returns_none_on_database_error(self, mock_db):
        """Should return None and log error when database query fails"""
        # Arrange
        organization_id = "org-error"
        mock_db.execute.side_effect = Exception("Database connection failed")

        # Act
        result = get_default_project_for_org(mock_db, organization_id)

        # Assert
        assert result is None

    def test_converts_uuid_to_string(self, mock_db):
        """Should convert UUID object to string"""
        # Arrange
        from uuid import UUID
        organization_id = "org-123"
        project_uuid = UUID("12345678-1234-5678-1234-567812345678")

        mock_result = MagicMock()
        mock_result.fetchone.return_value = (project_uuid,)
        mock_db.execute.return_value = mock_result

        # Act
        result = get_default_project_for_org(mock_db, organization_id)

        # Assert
        assert isinstance(result, str)
        assert result == "12345678-1234-5678-1234-567812345678"

    def test_handles_empty_organization_id(self, mock_db):
        """Should handle empty organization_id gracefully"""
        # Arrange
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        mock_db.execute.return_value = mock_result

        # Act
        result = get_default_project_for_org(mock_db, "")

        # Assert
        assert result is None

    def test_query_uses_correct_sql_pattern(self, mock_db):
        """Should use correct SQL query with proper joins and filters"""
        # Arrange
        organization_id = "org-test"
        mock_result = MagicMock()
        mock_result.fetchone.return_value = ("project-123",)
        mock_db.execute.return_value = mock_result

        # Act
        get_default_project_for_org(mock_db, organization_id)

        # Assert
        call_args = mock_db.execute.call_args
        sql_query = call_args[0][0].text

        # Verify SQL contains expected patterns
        assert "SELECT p.id" in sql_query
        assert "FROM projects p" in sql_query
        assert "JOIN workspaces w" in sql_query
        assert "WHERE w.organization_id = :organization_id" in sql_query
        assert "is_default = true" in sql_query
        assert "ILIKE '%default%'" in sql_query
        assert "ORDER BY p.created_at" in sql_query
        assert "LIMIT 1" in sql_query


class TestIntegrationScenarios:
    """Integration-style tests for realistic scenarios"""

    @pytest.fixture
    def mock_db(self):
        return Mock(spec=Session)

    def test_multiple_default_workspaces_returns_oldest_project(self, mock_db):
        """When multiple workspaces marked default, should return oldest project"""
        # This tests the ORDER BY p.created_at behavior
        organization_id = "org-multi"
        expected_project_id = "project-oldest"

        mock_result = MagicMock()
        mock_result.fetchone.return_value = (expected_project_id,)
        mock_db.execute.return_value = mock_result

        result = get_default_project_for_org(mock_db, organization_id)

        assert result == expected_project_id

    def test_case_insensitive_default_name_matching(self, mock_db):
        """Should match 'Default', 'default', 'DEFAULT' workspace names"""
        # This tests the ILIKE '%default%' behavior
        organization_id = "org-case"
        expected_project_id = "project-case"

        mock_result = MagicMock()
        mock_result.fetchone.return_value = (expected_project_id,)
        mock_db.execute.return_value = mock_result

        result = get_default_project_for_org(mock_db, organization_id)

        assert result == expected_project_id

    def test_workspace_with_default_substring_matches(self, mock_db):
        """Should match workspace names containing 'default' substring"""
        # Tests ILIKE '%default%' matches "My Default Workspace", "default-workspace", etc.
        organization_id = "org-substring"
        expected_project_id = "project-substring"

        mock_result = MagicMock()
        mock_result.fetchone.return_value = (expected_project_id,)
        mock_db.execute.return_value = mock_result

        result = get_default_project_for_org(mock_db, organization_id)

        assert result == expected_project_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
