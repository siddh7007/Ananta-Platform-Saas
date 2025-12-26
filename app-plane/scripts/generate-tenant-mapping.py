#!/usr/bin/env python3
"""
Generate Control Plane tenant UUID mapping for Phase 2 Step 2.1.

This script queries both databases and suggests mappings based on:
1. UUID identity match (same UUID in both systems)
2. Exact slug/key match
3. Name similarity (case-insensitive)
4. Creation date proximity (within 24 hours)

Usage:
    python generate-tenant-mapping.py [--format sql|json|csv] [--output FILE]

    --format sql    Generate SQL INSERT statements (default)
    --format json   Generate JSON mapping file
    --format csv    Generate CSV mapping file
    --output FILE   Write to file instead of stdout
    --help          Show this help message

Examples:
    # Generate SQL statements to stdout
    python generate-tenant-mapping.py

    # Generate JSON mapping file
    python generate-tenant-mapping.py --format json --output mapping.json

    # Generate SQL and save to file
    python generate-tenant-mapping.py --format sql --output mapping.sql

Requirements:
    pip install psycopg2-binary  # or psycopg2

Database Connection:
    This script connects to Docker containers:
    - app-plane-supabase-db (App Plane organizations)
    - arc-saas-postgres (Control Plane tenants)

    Ensure both containers are running before executing.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import subprocess


def run_docker_query(container: str, database: str, query: str) -> List[Dict]:
    """
    Execute a SQL query in a Docker container and return results as list of dicts.

    Args:
        container: Docker container name
        database: Database name
        query: SQL query to execute

    Returns:
        List of dictionaries (one per row)
    """
    cmd = [
        'docker', 'exec', '-e', 'PGPASSWORD=postgres',
        container, 'psql', '-U', 'postgres', '-d', database,
        '-t',  # Tuples only (no headers)
        '-A',  # Unaligned output
        '-F', '|',  # Field separator
        '-c', query
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]

        if not lines:
            return []

        # Parse results - assume first query returns column names
        cmd_with_headers = cmd.copy()
        cmd_with_headers[10] = query.replace('SELECT', 'SELECT', 1)  # Keep as is, but get headers

        # Get column names from query
        col_query = query.strip()
        if 'FROM' in col_query.upper():
            select_part = col_query.split('FROM')[0].replace('SELECT', '').strip()
            columns = [col.split(' AS ')[-1].strip() for col in select_part.split(',')]
        else:
            return []

        # Parse data rows
        result_dicts = []
        for line in lines:
            values = line.split('|')
            if len(values) == len(columns):
                row_dict = {}
                for col, val in zip(columns, values):
                    # Handle NULL values
                    row_dict[col.strip()] = None if val.strip() == '' else val.strip()
                result_dicts.append(row_dict)

        return result_dicts

    except subprocess.CalledProcessError as e:
        print(f"Error executing query in {container}: {e.stderr}", file=sys.stderr)
        sys.exit(1)


def fetch_app_plane_orgs() -> List[Dict]:
    """Fetch all organizations from App Plane Supabase database."""
    query = """
        SELECT
            id,
            name,
            slug,
            subscription_status,
            created_at
        FROM organizations
        ORDER BY created_at;
    """
    return run_docker_query('app-plane-supabase-db', 'postgres', query)


def fetch_control_plane_tenants() -> List[Dict]:
    """Fetch all tenants from Control Plane PostgreSQL database."""
    query = """
        SELECT
            id,
            key,
            name,
            status,
            created_on
        FROM main.tenants
        ORDER BY created_on;
    """
    return run_docker_query('arc-saas-postgres', 'arc_saas', query)


def calculate_similarity_score(org: Dict, tenant: Dict) -> Tuple[int, str]:
    """
    Calculate similarity score between org and tenant.

    Returns:
        (score, method) tuple where higher score = better match

    Scoring:
        100 = UUID identity match
        90 = Exact slug/key match
        70 = Case-insensitive name match
        50 = Name contains match (one contains the other)
        30 = Creation within 24 hours
        10 = Creation within 7 days
        0 = No match
    """
    score = 0
    method = 'no_match'

    # UUID identity match (special case)
    if org['id'] == tenant['id']:
        return (100, 'uuid_identity')

    # Exact slug/key match
    if org['slug'] and tenant['key'] and org['slug'].lower() == tenant['key'].lower():
        score = 90
        method = 'slug_key_match'

    # Case-insensitive name match
    elif org['name'] and tenant['name'] and org['name'].lower() == tenant['name'].lower():
        score = 70
        method = 'name_exact_match'

    # Name contains match
    elif org['name'] and tenant['name']:
        org_name_lower = org['name'].lower()
        tenant_name_lower = tenant['name'].lower()
        if org_name_lower in tenant_name_lower or tenant_name_lower in org_name_lower:
            score = 50
            method = 'name_contains_match'

    # Creation date proximity (add to score)
    if org.get('created_at') and tenant.get('created_on'):
        try:
            org_date = datetime.fromisoformat(org['created_at'].replace('Z', '+00:00'))
            tenant_date = datetime.fromisoformat(tenant['created_on'].replace('Z', '+00:00'))
            delta = abs((org_date - tenant_date).total_seconds())

            if delta < 86400:  # Within 24 hours
                score += 30
                if method == 'no_match':
                    method = 'date_proximity_24h'
            elif delta < 604800:  # Within 7 days
                score += 10
                if method == 'no_match':
                    method = 'date_proximity_7d'
        except:
            pass

    return (score, method)


def generate_mappings(orgs: List[Dict], tenants: List[Dict], min_score: int = 50) -> List[Dict]:
    """
    Generate mappings between organizations and tenants.

    Args:
        orgs: List of App Plane organizations
        tenants: List of Control Plane tenants
        min_score: Minimum similarity score to consider a match (default: 50)

    Returns:
        List of mapping dictionaries
    """
    mappings = []
    used_tenants = set()

    for org in orgs:
        best_match = None
        best_score = 0
        best_method = 'no_match'

        for tenant in tenants:
            if tenant['id'] in used_tenants:
                continue

            score, method = calculate_similarity_score(org, tenant)

            if score > best_score:
                best_score = score
                best_match = tenant
                best_method = method

        if best_match and best_score >= min_score:
            mappings.append({
                'app_org_id': org['id'],
                'app_org_name': org['name'],
                'app_org_slug': org['slug'],
                'app_org_status': org['subscription_status'],
                'control_plane_tenant_id': best_match['id'],
                'control_plane_tenant_name': best_match['name'],
                'control_plane_tenant_key': best_match['key'],
                'control_plane_tenant_status': best_match['status'],
                'mapping_method': best_method,
                'similarity_score': best_score,
                'verified': best_score >= 90  # Auto-verify high-confidence matches
            })
            used_tenants.add(best_match['id'])
        else:
            # No match found - log as unmapped
            mappings.append({
                'app_org_id': org['id'],
                'app_org_name': org['name'],
                'app_org_slug': org['slug'],
                'app_org_status': org['subscription_status'],
                'control_plane_tenant_id': None,
                'control_plane_tenant_name': None,
                'control_plane_tenant_key': None,
                'control_plane_tenant_status': None,
                'mapping_method': 'unmapped',
                'similarity_score': 0,
                'verified': False
            })

    return mappings


def format_sql(mappings: List[Dict]) -> str:
    """Generate SQL INSERT statements for temp_tenant_mapping table."""
    lines = [
        "-- Generated tenant mapping SQL",
        "-- Generated at: " + datetime.now().isoformat(),
        "",
        "CREATE TEMP TABLE IF NOT EXISTS temp_tenant_mapping (",
        "    app_org_id UUID NOT NULL,",
        "    app_org_name TEXT NOT NULL,",
        "    app_org_slug TEXT NOT NULL,",
        "    control_plane_tenant_id UUID NOT NULL,",
        "    control_plane_tenant_name TEXT NOT NULL,",
        "    control_plane_tenant_key TEXT NOT NULL,",
        "    mapping_method TEXT NOT NULL,",
        "    verified BOOLEAN DEFAULT FALSE",
        ");",
        "",
        "INSERT INTO temp_tenant_mapping VALUES"
    ]

    insert_values = []
    for mapping in mappings:
        if mapping['control_plane_tenant_id']:  # Only mapped orgs
            insert_values.append(
                f"    ('{mapping['app_org_id']}', "
                f"'{mapping['app_org_name'].replace(\"'\", \"''\")}', "
                f"'{mapping['app_org_slug']}', "
                f"'{mapping['control_plane_tenant_id']}', "
                f"'{mapping['control_plane_tenant_name'].replace(\"'\", \"''\")}', "
                f"'{mapping['control_plane_tenant_key']}', "
                f"'{mapping['mapping_method']}', "
                f"{'TRUE' if mapping['verified'] else 'FALSE'})"
            )

    lines.append(',\n'.join(insert_values) + ';')

    # Add unmapped orgs as comments
    unmapped = [m for m in mappings if not m['control_plane_tenant_id']]
    if unmapped:
        lines.append("")
        lines.append("-- UNMAPPED ORGANIZATIONS (require manual mapping):")
        for m in unmapped:
            lines.append(f"-- Org: {m['app_org_name']} ({m['app_org_id']}) - slug: {m['app_org_slug']}")

    return '\n'.join(lines)


def format_json(mappings: List[Dict]) -> str:
    """Generate JSON mapping file."""
    return json.dumps({
        'generated_at': datetime.now().isoformat(),
        'total_mappings': len([m for m in mappings if m['control_plane_tenant_id']]),
        'total_unmapped': len([m for m in mappings if not m['control_plane_tenant_id']]),
        'mappings': mappings
    }, indent=2)


def format_csv(mappings: List[Dict]) -> str:
    """Generate CSV mapping file."""
    lines = [
        "app_org_id,app_org_name,app_org_slug,app_org_status,control_plane_tenant_id,control_plane_tenant_name,control_plane_tenant_key,control_plane_tenant_status,mapping_method,similarity_score,verified"
    ]

    for m in mappings:
        lines.append(
            f"{m['app_org_id']},"
            f"\"{m['app_org_name']}\","
            f"{m['app_org_slug']},"
            f"{m['app_org_status']},"
            f"{m['control_plane_tenant_id'] or ''},"
            f"\"{m['control_plane_tenant_name'] or ''}\","
            f"{m['control_plane_tenant_key'] or ''},"
            f"{m['control_plane_tenant_status'] or ''},"
            f"{m['mapping_method']},"
            f"{m['similarity_score']},"
            f"{m['verified']}"
        )

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Generate Control Plane tenant UUID mappings',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        '--format',
        choices=['sql', 'json', 'csv'],
        default='sql',
        help='Output format (default: sql)'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output file path (default: stdout)'
    )
    parser.add_argument(
        '--min-score',
        type=int,
        default=50,
        help='Minimum similarity score for auto-mapping (default: 50)'
    )

    args = parser.parse_args()

    # Fetch data from both databases
    print("Fetching App Plane organizations...", file=sys.stderr)
    orgs = fetch_app_plane_orgs()
    print(f"Found {len(orgs)} organizations", file=sys.stderr)

    print("Fetching Control Plane tenants...", file=sys.stderr)
    tenants = fetch_control_plane_tenants()
    print(f"Found {len(tenants)} tenants", file=sys.stderr)

    # Generate mappings
    print("Generating mappings...", file=sys.stderr)
    mappings = generate_mappings(orgs, tenants, min_score=args.min_score)

    mapped = len([m for m in mappings if m['control_plane_tenant_id']])
    unmapped = len([m for m in mappings if not m['control_plane_tenant_id']])

    print(f"Generated {mapped} mappings, {unmapped} unmapped", file=sys.stderr)

    # Format output
    if args.format == 'sql':
        output = format_sql(mappings)
    elif args.format == 'json':
        output = format_json(mappings)
    elif args.format == 'csv':
        output = format_csv(mappings)

    # Write output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Output written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == '__main__':
    main()
