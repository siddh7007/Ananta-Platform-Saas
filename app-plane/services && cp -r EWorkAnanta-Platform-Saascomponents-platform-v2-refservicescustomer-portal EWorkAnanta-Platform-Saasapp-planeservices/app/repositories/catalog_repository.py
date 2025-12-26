"""
Catalog Repository

CRUD operations for production catalog components.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.catalog import CatalogComponent


class CatalogRepository:
    """
    Repository for catalog component operations

    Usage:
        repo = CatalogRepository(db_session)
        component = repo.get_by_mpn("STM32F407VGT6")
        components = repo.search("STM32", limit=10)
    """

    def __init__(self, db: Session):
        """
        Initialize repository

        Args:
            db: SQLAlchemy database session
        """
        self.db = db

    def get_by_id(self, component_id: int) -> Optional[CatalogComponent]:
        """Get component by ID"""
        return self.db.query(CatalogComponent).filter(
            CatalogComponent.id == component_id
        ).first()

    def get_by_mpn(self, mpn: str) -> Optional[CatalogComponent]:
        """Get component by MPN (exact match)"""
        return self.db.query(CatalogComponent).filter(
            CatalogComponent.mpn == mpn
        ).first()

    def search(
        self,
        query: str,
        limit: int = 50,
        offset: int = 0,
        min_quality: float = 95.0
    ) -> List[CatalogComponent]:
        """
        Search components by MPN or description

        Args:
            query: Search query string
            limit: Maximum results
            offset: Pagination offset
            min_quality: Minimum quality score filter

        Returns:
            List of matching components
        """
        # Validate inputs
        if not query or not query.strip():
            return []
        
        if limit < 1 or limit > 1000:
            limit = 50
        
        if offset < 0:
            offset = 0
        
        if min_quality < 0 or min_quality > 100:
            min_quality = 0
        
        try:
            search_query = self.db.query(CatalogComponent).filter(
                or_(
                    CatalogComponent.mpn.ilike(f"%{query}%"),
                    CatalogComponent.description.ilike(f"%{query}%")
                ),
                CatalogComponent.quality_score >= min_quality
            ).order_by(
                CatalogComponent.quality_score.desc(),
                CatalogComponent.created_at.desc()
            ).limit(limit).offset(offset)
            
            return search_query.all()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Search failed for query '{query}': {e}")
            return []

    def create(self, component_data: Dict[str, Any]) -> CatalogComponent:
        """
        Create new catalog component

        Args:
            component_data: Component data dictionary

        Returns:
            Created component

        Raises:
            IntegrityError: If MPN already exists
            ValueError: If required fields missing
        """
        # Validate required fields
        if not component_data.get('mpn'):
            raise ValueError("Component MPN is required")
        
        if not component_data.get('manufacturer_id'):
            raise ValueError("Manufacturer ID is required")
        
        try:
            component = CatalogComponent(**component_data)
            self.db.add(component)
            self.db.commit()
            self.db.refresh(component)
            return component
        except Exception as e:
            self.db.rollback()
            raise

    def update(self, component_id: int, update_data: Dict[str, Any]) -> Optional[CatalogComponent]:
        """
        Update catalog component

        Args:
            component_id: Component ID
            update_data: Fields to update

        Returns:
            Updated component or None if not found

        Raises:
            Exception: On database error (will rollback transaction)
        """
        component = self.get_by_id(component_id)
        if not component:
            return None

        try:
            for key, value in update_data.items():
                if hasattr(component, key):
                    setattr(component, key, value)

            self.db.commit()
            self.db.refresh(component)
            return component
        except Exception as e:
            self.db.rollback()
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Update failed for component {component_id}: {e}", exc_info=True)
            raise

    def delete(self, component_id: int) -> bool:
        """
        Delete catalog component

        Args:
            component_id: Component ID

        Returns:
            True if deleted, False if not found

        Raises:
            Exception: On database error (will rollback transaction)
        """
        component = self.get_by_id(component_id)
        if not component:
            return False

        try:
            self.db.delete(component)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Delete failed for component {component_id}: {e}", exc_info=True)
            raise

    def get_by_quality_range(
        self,
        min_quality: float,
        max_quality: float = 100.0,
        limit: int = 100
    ) -> List[CatalogComponent]:
        """
        Get components by quality score range

        Args:
            min_quality: Minimum quality score
            max_quality: Maximum quality score
            limit: Maximum results

        Returns:
            List of components in quality range
        """
        return self.db.query(CatalogComponent).filter(
            CatalogComponent.quality_score >= min_quality,
            CatalogComponent.quality_score <= max_quality
        ).order_by(
            CatalogComponent.quality_score.desc()
        ).limit(limit).all()

    def count_total(self) -> int:
        """Get total count of catalog components"""
        return self.db.query(func.count(CatalogComponent.id)).scalar()

    def get_stats(self) -> Dict[str, Any]:
        """
        Get catalog statistics

        Returns:
            Dictionary with stats
        """
        total = self.count_total()
        avg_quality = self.db.query(
            func.avg(CatalogComponent.quality_score)
        ).scalar()

        lifecycle_counts = dict(
            self.db.query(
                CatalogComponent.lifecycle,
                func.count(CatalogComponent.id)
            ).group_by(CatalogComponent.lifecycle).all()
        )

        return {
            "total_components": total,
            "average_quality": float(avg_quality) if avg_quality else 0.0,
            "lifecycle_distribution": lifecycle_counts,
        }

    def bulk_create(self, components_data: List[Dict[str, Any]]) -> List[CatalogComponent]:
        """
        Bulk create catalog components

        Args:
            components_data: List of component data dictionaries

        Returns:
            List of created components
        """
        components = [CatalogComponent(**data) for data in components_data]
        self.db.bulk_save_objects(components, return_defaults=True)
        self.db.commit()
        return components
