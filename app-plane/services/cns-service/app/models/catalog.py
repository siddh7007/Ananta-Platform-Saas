"""
Catalog Component Model

SQLAlchemy model for production catalog components (auto-approved, quality >= 95%)
"""

from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, Index, Boolean
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from app.models.base import Base, TimestampMixin
import uuid


class CatalogComponent(Base, TimestampMixin):
    """
    Production catalog component model

    Stores auto-approved components with quality score >= 95%.
    These are ready for customer quotes and staff use.

    Attributes:
        id: Primary key
        mpn: Manufacturer Part Number (unique)
        manufacturer: Manufacturer name
        category: Category name
        description: Component description
        datasheet_url: URL to component datasheet
        image_url: URL to component image
        lifecycle_status: Lifecycle status (Active, NRND, Obsolete, Preview)
        rohs: RoHS compliance status
        reach: REACH compliance status
        specifications: JSONB field for component specs (resistance, capacitance, etc.)
        pricing: JSONB array of pricing tiers from suppliers
        quality_score: Calculated quality score (95-100)
        enrichment_source: Source of enrichment (customer_bom, staff_expansion, api_import)
        last_enriched_at: Timestamp of last enrichment
        created_by: User ID who created/approved
        search_vector: Full-text search vector (auto-populated by trigger)
    """

    __tablename__ = "catalog_components"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core Component Information
    mpn = Column(String(255), nullable=False, index=True)
    manufacturer = Column(String(255), nullable=True)
    normalized_mpn = Column(String(255), nullable=True)
    normalized_manufacturer = Column(String(255), nullable=True)
    category = Column(String(255), nullable=True)
    subcategory = Column(String(255), nullable=True)
    category_path = Column(Text, nullable=True)
    product_family = Column(String(255), nullable=True)
    product_series = Column(String(255), nullable=True)

    # Basic Information
    description = Column(Text, nullable=True)
    datasheet_url = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)

    # Lifecycle & Packaging
    lifecycle_status = Column(String(50), nullable=True)  # 'active', 'nrnd', 'obsolete', 'preview'
    package = Column(String(100), nullable=True)

    # Pricing Information
    unit_price = Column(Numeric, nullable=True)
    currency = Column(String(10), nullable=True)
    price_breaks = Column(JSONB, nullable=True)
    moq = Column(Integer, nullable=True)  # Minimum Order Quantity
    lead_time_days = Column(Integer, nullable=True)
    stock_status = Column(String(50), nullable=True)

    # Supplier Data
    supplier_data = Column(JSONB, nullable=True)

    # Specifications (JSONB)
    # Example: {"resistance": "10kΩ", "tolerance": "1%", "power": "0.25W", "package": "0603"}
    specifications = Column(JSONB, nullable=True)
    extracted_specs = Column(JSONB, nullable=True)

    # Compliance (Boolean fields)
    rohs_compliant = Column(Boolean, nullable=True)
    reach_compliant = Column(Boolean, nullable=True)
    halogen_free = Column(Boolean, nullable=True)
    aec_qualified = Column(Boolean, nullable=True)
    eccn_code = Column(String(50), nullable=True)

    # Quality & Enrichment Metadata
    quality_score = Column(Numeric, nullable=True)
    quality_metadata = Column(JSONB, nullable=True)
    ai_metadata = Column(JSONB, nullable=True)
    enrichment_source = Column(String(50), nullable=True)  # 'customer_bom', 'staff_expansion', 'api_import'
    api_source = Column(String(50), nullable=True)  # 'mouser', 'digikey', 'element14'

    # Timestamps (DateTime with timezone)
    created_at = Column(DateTime, nullable=True, server_default='now()')
    updated_at = Column(DateTime, nullable=True, server_default='now()')

    def __repr__(self):
        return f"<CatalogComponent(id={self.id}, mpn='{self.mpn}', quality={self.quality_score})>"

    def to_dict(self):
        """
        Convert model to dictionary for JSON serialization

        Returns:
            Dictionary representation of component
        """
        return {
            "id": str(self.id) if self.id else None,
            "mpn": self.mpn,
            "manufacturer": self.manufacturer,
            "normalized_mpn": self.normalized_mpn,
            "normalized_manufacturer": self.normalized_manufacturer,
            "category": self.category,
            "subcategory": self.subcategory,
            "category_path": self.category_path,
            "product_family": self.product_family,
            "product_series": self.product_series,
            "description": self.description,
            "datasheet_url": self.datasheet_url,
            "image_url": self.image_url,
            "lifecycle_status": self.lifecycle_status,
            "package": self.package,
            "unit_price": float(self.unit_price) if self.unit_price else None,
            "currency": self.currency,
            "price_breaks": self.price_breaks,
            "moq": self.moq,
            "lead_time_days": self.lead_time_days,
            "stock_status": self.stock_status,
            "supplier_data": self.supplier_data,
            "specifications": self.specifications,
            "extracted_specs": self.extracted_specs,
            "rohs_compliant": self.rohs_compliant,
            "reach_compliant": self.reach_compliant,
            "halogen_free": self.halogen_free,
            "aec_qualified": self.aec_qualified,
            "eccn_code": self.eccn_code,
            "quality_score": float(self.quality_score) if self.quality_score else None,
            "quality_metadata": self.quality_metadata,
            "ai_metadata": self.ai_metadata,
            "enrichment_source": self.enrichment_source,
            "api_source": self.api_source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
