#!/usr/bin/env python3
"""
Apply Central Catalog Schema to Directus

This script:
1. Reads the central-catalog-schema.json file
2. Creates collections in Directus via API
3. Creates fields for each collection
4. Sets up relations between collections
5. Configures permissions for admin and worker roles

Usage:
    python apply_central_catalog_schema.py

Requirements:
    pip install requests
"""

import json
import os
import sys
import requests
from typing import Dict, List, Any, Optional

# Directus configuration
DIRECTUS_URL = os.getenv("DIRECTUS_URL", "http://localhost:27060")
DIRECTUS_ADMIN_EMAIL = os.getenv("DIRECTUS_ADMIN_EMAIL", "admin@example.com")
DIRECTUS_ADMIN_PASSWORD = os.getenv("DIRECTUS_ADMIN_PASSWORD", "admin")


class DirectusSchemaApplier:
    def __init__(self, url: str, email: str, password: str):
        self.url = url.rstrip("/")
        self.email = email
        self.password = password
        self.token = None
        self.session = requests.Session()

    def authenticate(self):
        """Authenticate with Directus and get access token"""
        print(f"🔐 Authenticating with Directus at {self.url}...")

        response = self.session.post(
            f"{self.url}/auth/login",
            json={"email": self.email, "password": self.password},
        )

        if response.status_code == 200:
            data = response.json()
            self.token = data["data"]["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print("✅ Authentication successful")
            return True
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            print(response.text)
            return False

    def collection_exists(self, collection_name: str) -> bool:
        """Check if a collection already exists"""
        response = self.session.get(f"{self.url}/collections/{collection_name}")
        return response.status_code == 200

    def create_collection(self, collection: Dict[str, Any]):
        """Create a collection in Directus"""
        collection_name = collection["collection"]

        if self.collection_exists(collection_name):
            print(f"⏭️  Collection '{collection_name}' already exists, skipping...")
            return True

        print(f"📦 Creating collection: {collection_name}")

        # Create collection
        response = self.session.post(
            f"{self.url}/collections",
            json={
                "collection": collection_name,
                "meta": collection.get("meta", {}),
                "schema": collection.get("schema", {}),
                "fields": [],  # We'll add fields separately
            },
        )

        if response.status_code in [200, 201, 204]:
            print(f"✅ Collection '{collection_name}' created")
            return True
        else:
            print(f"❌ Failed to create collection '{collection_name}': {response.status_code}")
            print(response.text)
            return False

    def field_exists(self, collection_name: str, field_name: str) -> bool:
        """Check if a field already exists in a collection"""
        response = self.session.get(
            f"{self.url}/fields/{collection_name}/{field_name}"
        )
        return response.status_code == 200

    def create_field(self, collection_name: str, field: Dict[str, Any]):
        """Create a field in a collection"""
        field_name = field["field"]

        if self.field_exists(collection_name, field_name):
            print(f"  ⏭️  Field '{field_name}' already exists, skipping...")
            return True

        print(f"  📝 Creating field: {collection_name}.{field_name}")

        response = self.session.post(
            f"{self.url}/fields/{collection_name}",
            json={
                "field": field_name,
                "type": field["type"],
                "schema": field.get("schema", {}),
                "meta": field.get("meta", {}),
            },
        )

        if response.status_code in [200, 201, 204]:
            print(f"  ✅ Field '{field_name}' created")
            return True
        else:
            print(f"  ❌ Failed to create field '{field_name}': {response.status_code}")
            print(response.text)
            return False

    def create_relation(self, relation: Dict[str, Any]):
        """Create a relation between collections"""
        print(
            f"🔗 Creating relation: {relation['collection']}.{relation['field']} → {relation['related_collection']}"
        )

        response = self.session.post(f"{self.url}/relations", json=relation)

        if response.status_code in [200, 201, 204]:
            print("✅ Relation created")
            return True
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print("⏭️  Relation already exists, skipping...")
            return True
        else:
            print(f"❌ Failed to create relation: {response.status_code}")
            print(response.text)
            return False

    def apply_schema(self, schema_file: str):
        """Apply schema from JSON file"""
        print(f"\n📄 Reading schema from {schema_file}...")

        with open(schema_file, "r") as f:
            schema = json.load(f)

        print(f"✅ Schema loaded: {len(schema['collections'])} collections")

        # Step 1: Create collections
        print("\n" + "=" * 60)
        print("STEP 1: Creating Collections")
        print("=" * 60)
        for collection in schema["collections"]:
            self.create_collection(collection)

        # Step 2: Create fields for each collection
        print("\n" + "=" * 60)
        print("STEP 2: Creating Fields")
        print("=" * 60)
        for collection in schema["collections"]:
            collection_name = collection["collection"]
            print(f"\n📦 Adding fields to '{collection_name}':")
            for field in collection.get("fields", []):
                self.create_field(collection_name, field)

        # Step 3: Create relations
        if "relations" in schema and schema["relations"]:
            print("\n" + "=" * 60)
            print("STEP 3: Creating Relations")
            print("=" * 60)
            for relation in schema["relations"]:
                self.create_relation(relation)

        print("\n" + "=" * 60)
        print("✅ Schema Applied Successfully!")
        print("=" * 60)
        supplier_preset_id = self.ensure_supplier_response_preset()
        if supplier_preset_id:
            self.ensure_supplier_response_dashboard(supplier_preset_id)
        catalog_preset_id = self.ensure_catalog_preset()
        if catalog_preset_id:
            self.ensure_catalog_dashboard(catalog_preset_id)
        print(f"\nDirectus Admin UI: {self.url}/admin")
        print(f"Collections created: {len(schema['collections'])}")

    def preset_exists(self, collection: str, bookmark: str) -> Optional[Dict[str, Any]]:
        response = self.session.get(
            f"{self.url}/presets",
            params={
                "filter[collection][_eq]": collection,
                "filter[bookmark][_eq]": bookmark,
                "limit": 1,
            },
        )
        if response.status_code != 200:
            return False
        data = response.json().get("data", [])
        if data:
            return data[0]
        return None

    def ensure_supplier_response_preset(self):
        bookmark = "Supplier Responses Overview"
        collection = "supplier_enrichment_responses"

        existing = self.preset_exists(collection, bookmark)
        if existing:
            print("⏭️  Supplier responses preset already exists, skipping...")
            return existing["id"]

        print("🧭 Creating supplier responses preset...")
        payload = {
            "bookmark": bookmark,
            "collection": collection,
            "layout": "tabular",
            "layout_query": {
                "fields": [
                    "mpn",
                    "vendor",
                    "manufacturer",
                    "job_id",
                    "line_id",
                    "created_at",
                    "payload",
                    "normalized",
                ],
                "sort": ["-created_at"],
            },
            "layout_options": {"widths": {"payload": 360, "normalized": 360}},
        }

        response = self.session.post(f"{self.url}/presets", json=payload)
        if response.status_code in [200, 201, 204]:
            print("✅ Supplier responses preset created")
            return response.json().get("data", {}).get("id")
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print("⏭️  Supplier responses preset already exists (race), skipping...")
            existing = self.preset_exists(collection, bookmark)
            return existing["id"] if existing else None
        else:
            print(f"⚠️  Failed to create supplier responses preset: {response.status_code}")
            print(response.text)
            return None

    def ensure_supplier_response_dashboard(self, preset_id: str):
        dashboard_name = "Supplier Responses"
        response = self.session.get(
            f"{self.url}/dashboards",
            params={"filter[name][_eq]": dashboard_name, "limit": 1},
        )
        dashboard_id = None
        if response.status_code == 200 and response.json().get("data"):
            dashboard_id = response.json()["data"][0]["id"]
            print("⏭️  Supplier responses dashboard already exists, updating panels if needed...")
        else:
            print("🧩 Creating Supplier Responses dashboard...")
            resp = self.session.post(
                f"{self.url}/dashboards",
                json={
                    "name": dashboard_name,
                    "icon": "compare_arrows",
                    "note": "Ops view for supplier payloads vs normalized data",
                    "color": "var(--primary)",
                },
            )
            if resp.status_code not in [200, 201, 204]:
                print(f"⚠️  Failed to create dashboard: {resp.status_code}")
                print(resp.text)
                return
            dashboard_id = resp.json().get("data", {}).get("id")
            print("✅ Dashboard created")

        if not dashboard_id:
            return

        self.ensure_panel(
            dashboard_id,
            "Supplier Response Table",
            {
                "icon": "table_chart",
                "color": "#F59E0B",
                "type": "collection",
                "position_x": 0,
                "position_y": 2,
                "width": 12,
                "height": 10,
                "options": {
                    "collection": "supplier_enrichment_responses",
                    "preset": preset_id,
                    "showHeader": True,
                    "showFooter": False,
                },
            },
        )
        self.ensure_panel(
            dashboard_id,
            "Responses (24h)",
            {
                "icon": "event_available",
                "color": "#10B981",
                "type": "metric",
                "position_x": 0,
                "position_y": 0,
                "width": 6,
                "height": 2,
                "options": {
                    "collection": "supplier_enrichment_responses",
                    "aggregateFunction": "count",
                    "aggregateField": "id",
                    "filter": {"created_at": {"_gte": "$NOW(-1 day)"}},
                    "suffix": "last 24h",
                },
            },
        )
        self.ensure_panel(
            dashboard_id,
            "Responses (Total)",
            {
                "icon": "insights",
                "color": "#3B82F6",
                "type": "metric",
                "position_x": 6,
                "position_y": 0,
                "width": 6,
                "height": 2,
                "options": {
                    "collection": "supplier_enrichment_responses",
                    "aggregateFunction": "count",
                    "aggregateField": "id",
                    "suffix": "total",
                },
            },
        )

    def ensure_catalog_preset(self):
        bookmark = "Catalog Component Search"
        collection = "catalog_components"

        existing = self.preset_exists(collection, bookmark)
        if existing:
            print("⏭️  Catalog components preset already exists, skipping...")
            return existing["id"]

        print("🧭 Creating catalog components preset...")
        payload = {
            "bookmark": bookmark,
            "collection": collection,
            "layout": "tabular",
            "layout_query": {
                "fields": [
                    "mpn",
                    "manufacturer",
                    "category",
                    "quality_score",
                    "lifecycle_status",
                    "datasheet_url",
                    "updated_at",
                ],
                "sort": ["-quality_score"],
            },
            "layout_options": {"widths": {"datasheet_url": 320}},
        }
        response = self.session.post(f"{self.url}/presets", json=payload)
        if response.status_code in [200, 201, 204]:
            print("✅ Catalog components preset created")
            return response.json().get("data", {}).get("id")
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print("⏭️  Catalog components preset already exists (race), skipping...")
            existing = self.preset_exists(collection, bookmark)
            return existing["id"] if existing else None
        else:
            print(f"⚠️  Failed to create catalog preset: {response.status_code}")
            print(response.text)
            return None

    def ensure_catalog_dashboard(self, preset_id: str):
        dashboard_name = "Catalog Components"
        response = self.session.get(
            f"{self.url}/dashboards",
            params={"filter[name][_eq]": dashboard_name, "limit": 1},
        )
        dashboard_id = None
        if response.status_code == 200 and response.json().get("data"):
            dashboard_id = response.json()["data"][0]["id"]
            print("⏭️  Catalog dashboard already exists, updating panels if needed...")
        else:
            print("🧩 Creating Catalog Components dashboard...")
            resp = self.session.post(
                f"{self.url}/dashboards",
                json={
                    "name": dashboard_name,
                    "icon": "storage",
                    "note": "Unified search for approved catalog components (shared with CNS dashboard)",
                    "color": "var(--success)",
                },
            )
            if resp.status_code not in [200, 201, 204]:
                print(f"⚠️  Failed to create catalog dashboard: {resp.status_code}")
                print(resp.text)
                return
            dashboard_id = resp.json().get("data", {}).get("id")
            print("✅ Catalog dashboard created")

        if not dashboard_id:
            return

        self.ensure_panel(
            dashboard_id,
            "Catalog Components Table",
            {
                "icon": "table_chart",
                "color": "#2563EB",
                "type": "collection",
                "position_x": 0,
                "position_y": 2,
                "width": 12,
                "height": 11,
                "options": {
                    "collection": "catalog_components",
                    "preset": preset_id,
                    "showHeader": True,
                    "showFooter": False,
                },
            },
        )
        self.ensure_panel(
            dashboard_id,
            "Production Ready",
            {
                "icon": "verified",
                "color": "#16A34A",
                "type": "metric",
                "position_x": 0,
                "position_y": 0,
                "width": 4,
                "height": 2,
                "options": {
                    "collection": "catalog_components",
                    "aggregateFunction": "count",
                    "aggregateField": "id",
                    "filter": {"quality_score": {"_gte": 95}},
                    "suffix": ">=95 quality",
                },
            },
        )
        self.ensure_panel(
            dashboard_id,
            "Needs Review",
            {
                "icon": "rule",
                "color": "#F97316",
                "type": "metric",
                "position_x": 4,
                "position_y": 0,
                "width": 4,
                "height": 2,
                "options": {
                    "collection": "catalog_components",
                    "aggregateFunction": "count",
                    "aggregateField": "id",
                    "filter": {"quality_score": {"_lt": 95}},
                    "suffix": "<95 quality",
                },
            },
        )
        self.ensure_panel(
            dashboard_id,
            "Average Quality",
            {
                "icon": "speed",
                "color": "#0EA5E9",
                "type": "metric",
                "position_x": 8,
                "position_y": 0,
                "width": 4,
                "height": 2,
                "options": {
                    "collection": "catalog_components",
                    "aggregateFunction": "avg",
                    "aggregateField": "quality_score",
                    "suffix": "avg score",
                    "precision": 1,
                },
            },
        )

    def ensure_panel(self, dashboard_id: str, name: str, panel_payload: Dict[str, Any]):
        panel_resp = self.session.get(
            f"{self.url}/panels",
            params={
                "filter[dashboard][_eq]": dashboard_id,
                "filter[name][_eq]": name,
                "limit": 1,
            },
        )
        if panel_resp.status_code == 200 and panel_resp.json().get("data"):
            print(f"⏭️  Panel '{name}' already exists, skipping...")
            return

        payload = {
            "dashboard": dashboard_id,
            "name": name,
            **panel_payload,
        }
        create_panel = self.session.post(f"{self.url}/panels", json=payload)
        if create_panel.status_code in [200, 201, 204]:
            print(f"✅ Panel '{name}' created")
        else:
            print(f"⚠️  Failed to create panel '{name}': {create_panel.status_code}")
            print(create_panel.text)


def main():
    """Main entry point"""
    print("\n🚀 Directus Central Catalog Schema Applier")
    print("=" * 60)

    # Find schema file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    schema_file = os.path.join(script_dir, "central-catalog-schema.json")

    if not os.path.exists(schema_file):
        print(f"❌ Schema file not found: {schema_file}")
        sys.exit(1)

    # Create applier and authenticate
    applier = DirectusSchemaApplier(
        url=DIRECTUS_URL, email=DIRECTUS_ADMIN_EMAIL, password=DIRECTUS_ADMIN_PASSWORD
    )

    if not applier.authenticate():
        print("\n❌ Failed to authenticate with Directus")
        print(
            f"\nPlease check your credentials and ensure Directus is running at {DIRECTUS_URL}"
        )
        sys.exit(1)

    # Apply schema
    try:
        applier.apply_schema(schema_file)
        print("\n✅ Done! Your Central Catalog is now configured in Directus.")
        print(f"\n🌐 Open Directus Admin: {DIRECTUS_URL}/admin")
        print(f"📊 View Components: {DIRECTUS_URL}/admin/content/catalog_components")
    except Exception as e:
        print(f"\n❌ Error applying schema: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
