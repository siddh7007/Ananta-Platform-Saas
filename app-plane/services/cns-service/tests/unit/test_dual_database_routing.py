"""
Tests for CRITICAL-4: Dual Database Routing Type Safety

Verifies that database routing is strict and secure, with no silent fallbacks
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from app.models.dual_database import (
    DualDatabaseManager,
    DatabaseType,
    UploadSource
)


class TestDualDatabaseRouting:
    """Test dual database routing logic"""
    
    def test_upload_source_enum_values(self):
        """Test that UploadSource enum has correct values"""
        assert UploadSource.CUSTOMER.value == "customer"
        assert UploadSource.STAFF.value == "staff"
    
    def test_database_type_literal_values(self):
        """Test database type literals"""
        customer_type: DatabaseType = "supabase"
        staff_type: DatabaseType = "components"
        assert customer_type == "supabase"
        assert staff_type == "components"
    
    def test_manager_initialization(self):
        """Test that DualDatabaseManager initializes correctly"""
        manager = DualDatabaseManager()
        assert manager is not None
        assert hasattr(manager, 'supabase_engine')
        assert hasattr(manager, 'components_engine')
    
    def test_manager_has_session_makers(self):
        """Test that manager has session makers for both databases"""
        manager = DualDatabaseManager()
        assert hasattr(manager, 'SupabaseSession')
        assert hasattr(manager, 'ComponentsSession')


class TestDatabaseSessionValidation:
    """Test database session routing validation"""
    
    def test_supabase_session_routing(self):
        """Test that supabase session can be retrieved"""
        manager = DualDatabaseManager()
        
        # Mock the session creation
        with patch.object(manager, 'SupabaseSession') as mock_session:
            mock_session_instance = MagicMock()
            mock_session.return_value = mock_session_instance
            
            # Should not raise
            gen = manager.get_session("supabase")
            session = next(gen)
            assert session is not None
    
    def test_components_session_routing(self):
        """Test that components session can be retrieved"""
        manager = DualDatabaseManager()
        
        # Mock the session creation
        with patch.object(manager, 'ComponentsSession') as mock_session:
            mock_session_instance = MagicMock()
            mock_session.return_value = mock_session_instance
            
            # Should not raise
            gen = manager.get_session("components")
            session = next(gen)
            assert session is not None
    
    def test_invalid_db_type_raises_error(self):
        """Test that invalid database type raises ValueError"""
        manager = DualDatabaseManager()
        
        with pytest.raises(ValueError) as exc_info:
            list(manager.get_session("postgresql"))
        
        assert "Invalid database type" in str(exc_info.value)
    
    def test_session_closure_on_exit(self):
        """Test that session is properly closed"""
        manager = DualDatabaseManager()
        
        mock_session = MagicMock()
        with patch.object(manager, 'SupabaseSession') as mock_session_factory:
            mock_session_factory.return_value = mock_session
            
            gen = manager.get_session("supabase")
            next(gen)
            
            # Close the generator
            try:
                next(gen)
            except StopIteration:
                pass
            
            # Verify session.close() was called
            mock_session.close.assert_called_once()


class TestRouterIntegration:
    """Test database routing in FastAPI router context"""
    
    def test_customer_upload_source_routing(self):
        """Test customer upload is routed correctly"""
        manager = DualDatabaseManager()
        db_type = manager.get_db_type_for_source("customer")
        assert db_type == "supabase"
    
    def test_staff_upload_source_routing(self):
        """Test staff upload is routed correctly"""
        manager = DualDatabaseManager()
        db_type = manager.get_db_type_for_source("staff")
        assert db_type == "components"
    
    def test_injection_attempt_customer_field(self):
        """Test SQL injection in source field is rejected"""
        manager = DualDatabaseManager()
        
        with pytest.raises(ValueError):
            manager.get_db_type_for_source("customer'; DROP TABLE bom_items; --")
    
    def test_injection_attempt_union_select(self):
        """Test UNION SELECT injection is rejected"""
        manager = DualDatabaseManager()
        
        with pytest.raises(ValueError):
            manager.get_db_type_for_source("customer' UNION SELECT * FROM components --")


class TestUploadSourceEnum:
    """Test UploadSource enum"""
    
    def test_enum_values_match(self):
        """Test enum values"""
        assert UploadSource.CUSTOMER.value == "customer"
        assert UploadSource.STAFF.value == "staff"
    
    def test_enum_members(self):
        """Test enum has expected members"""
        assert len(UploadSource) == 2
        assert "CUSTOMER" in UploadSource.__members__
        assert "STAFF" in UploadSource.__members__


class TestDataIsolation:
    """Test data isolation between databases"""
    
    def test_customer_data_routes_to_supabase(self):
        """Test customer data operations use supabase database"""
        manager = DualDatabaseManager()
        
        # Customer uploads should use supabase
        db_type = manager.get_db_type_for_source("customer")
        assert db_type == "supabase"
        
        # Verify session is from correct database
        with patch.object(manager, 'SupabaseSession') as mock_supabase:
            with patch.object(manager, 'ComponentsSession') as mock_components:
                mock_supabase_instance = MagicMock()
                mock_supabase.return_value = mock_supabase_instance
                
                gen = manager.get_session(db_type)
                next(gen)
                
                # Verify supabase session was created, not components
                mock_supabase.assert_called_once()
                mock_components.assert_not_called()
    
    def test_staff_data_routes_to_components(self):
        """Test staff data operations use components database"""
        manager = DualDatabaseManager()
        
        # Staff uploads should use components
        db_type = manager.get_db_type_for_source("staff")
        assert db_type == "components"
        
        # Verify session is from correct database
        with patch.object(manager, 'SupabaseSession') as mock_supabase:
            with patch.object(manager, 'ComponentsSession') as mock_components:
                mock_components_instance = MagicMock()
                mock_components.return_value = mock_components_instance
                
                gen = manager.get_session(db_type)
                next(gen)
                
                # Verify components session was created, not supabase
                mock_components.assert_called_once()
                mock_supabase.assert_not_called()


class TestErrorMessages:
    """Test error messages are informative"""
    
    def test_unknown_source_error_message(self):
        """Test error message for unknown source"""
        manager = DualDatabaseManager()
        
        with pytest.raises(ValueError) as exc_info:
            manager.get_db_type_for_source("unknown_source")
        
        error_msg = str(exc_info.value)
        assert "Unknown source" in error_msg
        assert "unknown_source" in error_msg
        assert "customer" in error_msg.lower()
        assert "staff" in error_msg.lower()
    
    def test_invalid_type_error_message(self):
        """Test error message for invalid type"""
        manager = DualDatabaseManager()
        
        with pytest.raises(ValueError) as exc_info:
            manager.get_db_type_for_source(123)
        
        error_msg = str(exc_info.value)
        assert "Source must be string" in error_msg
        assert "int" in error_msg


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
