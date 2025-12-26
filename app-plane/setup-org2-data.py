#!/usr/bin/env python3
"""
Setup test data for second organization (a1111111-1111-1111-1111-111111111111)
Creates BOM and line items for cross-tenant testing
"""

import psycopg2
import uuid
from datetime import datetime

# Database connection
DB_CONFIG = {
    "host": "localhost",
    "port": 27432,
    "database": "postgres",
    "user": "postgres",
    "password": "postgres"
}

# Second organization details
ORG_ID = "a1111111-1111-1111-1111-111111111111"
PROJECT_ID = "b1111111-1111-1111-1111-111111111111"

def create_bom_and_items():
    """Create BOM and line items for second organization"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        # Create BOM
        bom_id = str(uuid.uuid4())
        bom_name = "ORG2 Test BOM"
        now = datetime.utcnow()

        cur.execute("""
            INSERT INTO boms (id, project_id, name, description, version, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (bom_id, PROJECT_ID, bom_name, "BOM for cross-tenant testing", "1.0", "draft", now, now))

        print(f"Created BOM: {bom_id}")
        print(f"  Name: {bom_name}")
        print(f"  Project: {PROJECT_ID}")
        print(f"  Organization: {ORG_ID}")
        print()

        # Create line items
        components = [
            {
                "mpn": "ESP32-WROOM-32",
                "manufacturer": "Espressif",
                "quantity": 10,
                "description": "WiFi/BT SoC Module"
            },
            {
                "mpn": "BME280",
                "manufacturer": "Bosch",
                "quantity": 5,
                "description": "Environmental Sensor"
            },
            {
                "mpn": "ADS1115",
                "manufacturer": "Texas Instruments",
                "quantity": 3,
                "description": "16-bit ADC"
            }
        ]

        line_items_created = []
        for idx, comp in enumerate(components, start=1):
            item_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO bom_line_items (
                    id, bom_id, line_number,
                    manufacturer_part_number, manufacturer, quantity, description,
                    enrichment_status, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                item_id, bom_id, idx,
                comp["mpn"], comp["manufacturer"], comp["quantity"], comp["description"],
                "pending", now, now
            ))
            line_items_created.append(item_id)
            print(f"Created line item {idx}: {comp['mpn']} ({comp['manufacturer']})")

        conn.commit()
        print()
        print("=" * 70)
        print("SUCCESS! Test data created for second organization")
        print("=" * 70)
        print()
        print(f"BOM ID: {bom_id}")
        print(f"Line items: {len(line_items_created)}")
        print()
        print("This BOM belongs to:")
        print(f"  Organization: {ORG_ID} (Ananta Platform)")
        print(f"  Project: {PROJECT_ID} (Demo Project)")
        print()
        print("Use this BOM ID for cross-tenant testing!")

        return bom_id

    except Exception as e:
        conn.rollback()
        print(f"Error creating test data: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    create_bom_and_items()
