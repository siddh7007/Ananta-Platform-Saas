# CNS Service Tests

## Quick Start

```bash
# Run API HTTP tests (22 tests)
python tests/api/test_alerts_api_http.py

# Run unit tests
pytest tests/unit/ -v
```

## Test Fixtures Required

Before running authenticated tests, ensure fixtures exist:

```bash
PGPASSWORD=supabase-postgres-secure-2024 docker exec -i components-v2-supabase-db psql -U postgres -d supabase << 'EOF'
INSERT INTO auth.users (id, email, role, aud)
VALUES ('00000000-0000-4000-8000-000000000001', 'admin@test.local', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, slug, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000002', 'Test Organization', 'test-org', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
EOF
```

## Full Documentation

See [Alert API Test Infrastructure](../../../docs/testing/ALERT_API_TEST_INFRASTRUCTURE-CD-Nov-30-25-LED-Nov-30-25.md) for complete documentation including:

- JWT Token Generator usage
- Database schema requirements
- Troubleshooting guide
- Adding new tests
