#!/usr/bin/env python3
"""
Generate Master Migration SQL from DigiKey Categories JSON

Reads the DigiKey categories JSON and generates a complete SQL migration
file that can be applied to the App Plane components-v2-postgres database.

Usage:
    python generate_category_migration.py

Output:
    ../components-v2-init/03_digikey_categories.sql
"""

import json
import os
from datetime import datetime

# Paths
DIGIKEY_JSON = r"c:\components-platform\components-platform-v1\web\digikey_categories.json"
OUTPUT_SQL = os.path.join(os.path.dirname(__file__), "..", "components-v2-init", "03_digikey_categories.sql")

def escape_sql(value):
    """Escape single quotes for SQL"""
    if value is None:
        return "NULL"
    return value.replace("'", "''")

def process_categories(categories, parent_digikey_id=None, level=1, path=""):
    """
    Recursively process categories and generate INSERT statements

    Returns list of tuples: (name, parent_digikey_id, digikey_id, level, path, product_count)
    """
    result = []

    for cat in categories:
        name = cat.get("Name", "Unknown")
        digikey_id = cat.get("CategoryId")
        product_count = cat.get("ProductCount", 0)

        # Build path
        new_path = f"{path} > {name}" if path else name

        result.append({
            "name": name,
            "parent_digikey_id": parent_digikey_id,
            "digikey_id": digikey_id,
            "level": level,
            "path": new_path,
            "product_count": product_count
        })

        # Process children
        children = cat.get("Children", [])
        if children:
            result.extend(process_categories(children, digikey_id, level + 1, new_path))

    return result

def generate_sql(categories_data):
    """Generate complete SQL migration file"""

    categories = categories_data.get("Categories", [])
    all_cats = process_categories(categories)

    # Statistics
    total = len(all_cats)
    by_level = {}
    for cat in all_cats:
        level = cat["level"]
        by_level[level] = by_level.get(level, 0) + 1

    sql_lines = []

    # Header
    sql_lines.append(f"""-- =============================================================================
-- DigiKey Categories Master Migration
-- =============================================================================
-- Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
-- Total Categories: {total}
-- Level 1 (Root): {by_level.get(1, 0)}
-- Level 2: {by_level.get(2, 0)}
-- Level 3: {by_level.get(3, 0)}
-- Level 4+: {sum(v for k, v in by_level.items() if k > 3)}
-- =============================================================================

-- Transaction wrapper
BEGIN;

-- Clear existing categories
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;

""")

    # Group categories by level for proper parent_id resolution
    sql_lines.append("""-- =============================================================================
-- STEP 1: Insert Level 1 (Root) Categories
-- =============================================================================
""")

    level1_cats = [c for c in all_cats if c["level"] == 1]
    for cat in level1_cats:
        sql_lines.append(f"""INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('{escape_sql(cat["name"])}', NULL, {cat["digikey_id"]}, 1, '{escape_sql(cat["path"])}', {cat["product_count"]}, NULL);
""")

    # Level 2+
    sql_lines.append("""
-- =============================================================================
-- STEP 2: Insert Level 2+ Categories (with parent_id lookup)
-- =============================================================================
""")

    for level in range(2, max(by_level.keys()) + 1):
        level_cats = [c for c in all_cats if c["level"] == level]
        if not level_cats:
            continue

        sql_lines.append(f"""
-- Level {level} Categories ({len(level_cats)} categories)
""")

        for cat in level_cats:
            sql_lines.append(f"""INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT '{escape_sql(cat["name"])}', p.id, {cat["digikey_id"]}, {cat["level"]}, '{escape_sql(cat["path"])}', {cat["product_count"]}, NULL
FROM categories p WHERE p.digikey_id = {cat["parent_digikey_id"]};
""")

    # Commit and verify
    sql_lines.append("""
-- Commit transaction
COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
    total_count INTEGER;
    level1_count INTEGER;
    level2_count INTEGER;
    level3_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM categories;
    SELECT COUNT(*) INTO level1_count FROM categories WHERE level = 1;
    SELECT COUNT(*) INTO level2_count FROM categories WHERE level = 2;
    SELECT COUNT(*) INTO level3_count FROM categories WHERE level = 3;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'DigiKey Categories Import Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total categories: %', total_count;
    RAISE NOTICE 'Level 1 (Root): %', level1_count;
    RAISE NOTICE 'Level 2: %', level2_count;
    RAISE NOTICE 'Level 3: %', level3_count;
    RAISE NOTICE '========================================';
END $$;
""")

    return "\n".join(sql_lines)

def main():
    print("=" * 60)
    print("DigiKey Categories SQL Migration Generator")
    print("=" * 60)

    # Load JSON
    print(f"Loading: {DIGIKEY_JSON}")
    with open(DIGIKEY_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    categories = data.get("Categories", [])
    print(f"Found {len(categories)} top-level categories")

    # Process
    all_cats = process_categories(categories)
    print(f"Total categories (all levels): {len(all_cats)}")

    # Generate SQL
    print("Generating SQL migration...")
    sql = generate_sql(data)

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_SQL), exist_ok=True)
    with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
        f.write(sql)

    print(f"Output written to: {OUTPUT_SQL}")
    print(f"File size: {os.path.getsize(OUTPUT_SQL):,} bytes")
    print("=" * 60)
    print("SUCCESS! Apply migration with:")
    print(f"  cat \"{OUTPUT_SQL}\" | docker exec -i app-plane-components-v2-postgres-dev psql -U postgres -d components_v2")
    print("=" * 60)

if __name__ == "__main__":
    main()
