### Mapping Gap Report Event
When `CATEGORY_GAP_REPORT_NOTIFY=1`, the service publishes a high-priority event `admin.category.mapping_gap` to the event bus when the mapping gap report contains rows. The event includes `rows_count`, `report_path`, and a `sample_rows` array. Subscribe to `admin.category.mapping_gap` in your alerting system to notify the Normalization team.

API endpoints:
- `GET /api/admin/mapping-gaps` — return the last mapping gap report summary and sample rows (admin token required). Useful to integrate into the CNS dashboard UI, e.g., the Enrichment Audit Trail viewer or Workflow admin sections.

# Component Normalization Service (CNS) Service

**Version:** 1.0.0
**Status:** Phase 1 - Foundation (In Development)

## Overview

Component Normalization Service (CNS) is a dual-purpose component data normalization service that provides:

1. **Customer-Facing:** Self-service BOM upload with instant quotes and simple progress tracking
2. **Staff-Facing:** Full technical dashboard for catalog expansion, quality review queue, and AI-assisted data enhancement

## Features

### Phase 1 (Current - Weeks 1-3)
- ✅ FastAPI service skeleton
- ✅ Configuration management with environment variables
- ✅ Health check endpoints
- ⏳ Core normalization engine (in progress)
- ⏳ Tier 1 supplier API integration (Mouser, DigiKey, Element14)
- ⏳ Quality scoring and routing

### Planned Features
- 🔜 Temporal workflow orchestration
- 🔜 AI-powered category suggestions (Ollama, Claude, OpenAI, Perplexity)
- 🔜 WebSocket real-time progress updates
- 🔜 Staff review queue UI
- 🔜 Customer BOM upload UI
- 🔜 4-tier data source fallback (Tier 1-4 suppliers)

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Redis 7+
- Temporal Server (optional for workflows)
- Ollama (optional for local AI)

### Installation

1. **Clone the repository and navigate to CNS service:**
   ```bash
   cd components-platform-v2/cns-service
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt  # For development
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys and configuration
   ```

5. **Run database migrations:**
   ```bash
   # TODO: Add migration commands when Alembic is set up
   ```

### Running the Service

#### Development Mode (with hot reload)
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 27800
```

#### Production Mode
```bash
uvicorn app.main:app --host 0.0.0.0 --port 27800 --workers 4
```

#### Using Docker
```bash
docker-compose -f docker-compose.cip.yml up --build
```

### Accessing the Service

- **Service Info:** http://localhost:27800
- **Swagger UI:** http://localhost:27800/docs
- **ReDoc:** http://localhost:27800/redoc
- **Health Check:** http://localhost:27800/health
- **Detailed Health:** http://localhost:27800/api/health/detailed

## Frontend Integration (CNS Dashboard & Portals)

Frontend applications (Customer Portal, Backstage Portal, CNS Dashboard) talk to this service via a configurable base URL exposed as a Vite env variable:

```bash
VITE_CNS_API_URL=http://localhost:27800
```

- In development, `http://localhost:27800` points directly at the CNS service container.
- In production, set `VITE_CNS_API_URL` in each frontend to the appropriate internal or gateway URL.

## Project Structure

```
cns-service/
├── app/
│   ├── api/                    # API route handlers
│   │   ├── health.py          # Health check endpoints
│   │   ├── bom.py             # BOM upload & enrichment (TODO)
│   │   ├── catalog.py         # Catalog CRUD (TODO)
│   │   ├── queue.py           # Review queue (TODO)
│   │   └── ai.py              # AI suggestions (TODO)
│   ├── database/              # Database layer (TODO)
│   ├── normalization/         # Data normalization (TODO)
│   ├── suppliers/             # Supplier API clients (TODO)
│   ├── ai/                    # AI integration (TODO)
│   ├── workflows/             # Temporal workflows (TODO)
│   ├── websockets/            # WebSocket handlers (TODO)
│   ├── main.py                # FastAPI app entry point
│   └── config.py              # Configuration management
├── migrations/                # Database migrations (TODO)
├── tests/                     # Test suite (TODO)
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Docker image (TODO)
└── README.md                  # This file
```

See [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) for detailed project structure documentation.

## Configuration

All configuration is managed through environment variables. See `.env.example` for all available options.

### Key Configuration Sections

#### Dual-Database Architecture

CNS service uses a **dual-database architecture** to separate customer data from internal catalog data:

| Database | Purpose | Local Port | Container Name |
|----------|---------|------------|----------------|
| **Supabase** | Customer data (BOMs, organizations, users) | 27432 | supabase-db |
| **Components-V2** | Internal catalog (components, manufacturers, categories) | 27010 | components-v2-postgres |

**Environment Variables:**

```bash
# Primary database URL (Components-V2 for catalog data)
DATABASE_URL=postgresql://postgres:postgres@localhost:27010/components_v2

# Supabase database (customer/tenant business data)
SUPABASE_DATABASE_URL=postgresql://postgres:postgres@localhost:27432/postgres

# Components-V2 database (internal catalog - same as DATABASE_URL for CNS)
COMPONENTS_V2_DATABASE_URL=postgresql://postgres:postgres@localhost:27010/components_v2
```

**Important:** When running inside Docker (via `docker-compose up`), these URLs are automatically injected with internal container names. The `.env` file values are for **local development outside Docker**.

#### App-Plane Service Ports Reference

| Service | Container Name | Host Port | Purpose |
|---------|---------------|-----------|---------|
| Supabase DB | app-plane-supabase-db | 27432 | PostgreSQL for tenant data |
| Components-V2 DB | app-plane-components-v2-postgres | 27010 | PostgreSQL for catalog |
| Redis | app-plane-redis | 27012 | Cache |
| RabbitMQ | app-plane-rabbitmq | 27672/27673 | Message broker |
| Temporal | shared-temporal | 27020 | Workflow orchestration |
| Temporal UI | shared-temporal-ui | 27021 | Workflow dashboard |
| CNS Service | app-plane-cns-service | 27200 | This service |
| CNS Dashboard | app-plane-cns-dashboard | 27250 | Admin UI |
| Supabase API | app-plane-supabase-api | 27810 | PostgREST |
| Supabase Studio | app-plane-supabase-studio | 27800 | DB Admin UI |

#### Database & Cache (Legacy Single-DB Reference)
```bash
# Deprecated - use dual-database config above
DATABASE_URL=postgresql://user:pass@localhost:27010/components_v2
REDIS_URL=redis://localhost:27012/0
```

#### AI Providers
```bash
# Ollama (Local, Free)
OLLAMA_ENABLED=true
OLLAMA_URL=http://localhost:27260

# OpenAI (Fallback)
OPENAI_ENABLED=true
OPENAI_API_KEY=sk-...

# Claude (Fallback)
CLAUDE_ENABLED=true
CLAUDE_API_KEY=sk-ant-...
```

#### Supplier APIs (Tier 1)
```bash
# Mouser
MOUSER_ENABLED=true
MOUSER_API_KEY=your-key

# DigiKey
DIGIKEY_ENABLED=true
DIGIKEY_CLIENT_ID=your-client-id
DIGIKEY_CLIENT_SECRET=your-secret

# Element14
ELEMENT14_ENABLED=true
ELEMENT14_API_KEY=your-key
```

#### Quality Thresholds
```bash
QUALITY_REJECT_THRESHOLD=70      # < 70% = reject
QUALITY_STAGING_THRESHOLD=94     # 70-94% = staging review
QUALITY_AUTO_APPROVE_THRESHOLD=95  # >= 95% = auto-approve
```

### Category Snapshot Auto-Refresh (in-container)

This service uses the enrichment workflow to keep the DigiKey category snapshot up to date inside the container (preferred over OS-level cron/PowerShell scripts).

Configure these env vars to enable and tune behavior:

```bash
# Enable snapshot auto-refresh via enrichment workflow
CATEGORY_SNAPSHOT_AUTO_REFRESH=1
# Frequency in minutes to check staleness
CATEGORY_SNAPSHOT_CHECK_INTERVAL_MINUTES=30
# Consider snapshot stale after this many minutes
CATEGORY_SNAPSHOT_MAX_STALENESS_MINUTES=1440
# Run mapping gap report after successful snapshot
CATEGORY_SNAPSHOT_GENERATE_GAP_REPORT=1
# Output path written inside the container (repo-relative)
CATEGORY_GAP_REPORT_OUTPUT=docs/data-processing/normalizer_mapping_gap_report.csv
```

How to test locally (without Temporal):
```bash
# Run the Temporal worker/activities locally and then trigger via test runner
python scripts/test_run_snapshot_and_gap.py
```

Note: PowerShell-based scheduling scripts have been removed from active scripts and archived under `scripts/deprecated/`. Use Temporal/in-container automation instead.
## API Documentation

### Available Endpoints (Phase 1)

#### Root & Health
- `GET /` - Service information
- `GET /health` - Basic health check
- `GET /api/health/` - Simple health check
- `GET /api/health/detailed` - Detailed health check with dependency status
- `GET /api/health/db` - Database health check
- `GET /api/health/redis` - Redis health check
- `GET /api/health/temporal` - Temporal health check
- `GET /api/health/suppliers` - Supplier APIs health check
- `GET /api/health/ai` - AI providers health check

#### Configuration Diagnostics (Ops/Monitoring)
- `GET /health/config` - Configuration diagnostics with dual-database status
- `GET /health/config/dual-db` - Dedicated dual-database connectivity test with latency

### Planned Endpoints (Phase 2+)

#### BOM Endpoints
- `POST /api/bom/upload` - Upload BOM file
- `POST /api/bom/enrich` - Trigger enrichment workflow
- `GET /api/bom/{job_id}/status` - Get enrichment status
- `GET /api/bom/{job_id}/results` - Get enrichment results

#### Catalog Endpoints
- `GET /api/catalog/components` - List components
- `GET /api/catalog/components/{id}` - Get component details
- `POST /api/catalog/components` - Create component
- `PUT /api/catalog/components/{id}` - Update component

#### Review Queue Endpoints (Staff Only)
- `GET /api/queue` - List staged components
- `GET /api/queue/{id}` - Get component with AI suggestions
- `POST /api/queue/{id}/approve` - Approve component
- `POST /api/queue/{id}/reject` - Reject component
- `POST /api/queue/batch-approve` - Batch approve

## Development

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/unit/test_normalization.py

# Run with verbose output
pytest -v
```

### Code Quality

```bash
# Format code with Black
black app/

# Sort imports with isort
isort app/

# Lint with flake8
flake8 app/

# Type checking with mypy
mypy app/
```

### Database Migrations

```bash
# TODO: Add Alembic migration commands
# alembic revision --autogenerate -m "Description"
# alembic upgrade head
```

## Architecture

### Data Flow

```
Customer/Staff → FastAPI → Temporal Workflows → Supplier APIs
                              ↓
                         Normalization
                              ↓
                        Quality Scoring
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
             catalog_components   enrichment_queue
            (auto-approved ≥95%)   (review 70-94%)
```

### Quality Routing

- **Quality Score < 70%:** Reject → `enrichment_history` (audit log)
- **Quality Score 70-94%:** Staging → `enrichment_queue` (staff review)
- **Quality Score ≥ 95%:** Auto-approve → `catalog_components` (production)

### AI Provider Fallback

1. **Ollama** (local, free) - Try first
2. **Claude** (API, paid) - Fallback if confidence < 80%
3. **OpenAI** (API, paid) - Second fallback
4. **Perplexity** (API, web search) - Last resort

### Supplier API Fallback (4-Tier)

1. **Tier 1:** Distributor APIs (Mouser, DigiKey, Element14)
2. **Tier 2:** Aggregate APIs (Octopart, SiliconExpert)
3. **Tier 3:** OEM APIs (TI, ST, Microchip)
4. **Tier 4:** Web Scraping + Perplexity search

## Monitoring & Observability

### Health Checks

The service provides multiple health check endpoints for monitoring:

- **Load Balancer:** Use `GET /health` for simple up/down check
- **Monitoring:** Use `GET /api/health/detailed` for dependency status
- **Specific Services:** Use individual endpoints (`/api/health/db`, `/api/health/redis`, etc.)

### Logging

Logs are output to:
- **Console:** Structured JSON logs
- **Loki:** Centralized log aggregation (if configured)

### Metrics

Prometheus metrics exposed on port 27701 (if `ENABLE_METRICS=true`)

## Deployment

### Docker Compose

```bash
# Start CNS service with all dependencies
docker-compose -f docker-compose.cip.yml up -d

# View logs
docker-compose -f docker-compose.cip.yml logs -f cns-service

# Stop service
docker-compose -f docker-compose.cip.yml down
```

### Environment-Specific Deployment

```bash
# Development
ENVIRONMENT=development uvicorn app.main:app --reload

# Staging
ENVIRONMENT=staging uvicorn app.main:app --workers 2

# Production
ENVIRONMENT=production uvicorn app.main:app --workers 4 --proxy-headers
```

## Security

### Authentication

- Keycloak SSO integration
- JWT token validation
- Role-based access control (RBAC)

### API Keys

All supplier API keys and AI provider keys should be stored securely:
- Use `.env` file (never commit to git)
- Use environment variables in production
- Consider using secret management (AWS Secrets Manager, HashiCorp Vault, etc.)

### Input Validation

- All inputs validated with Pydantic models
- File upload size limits enforced
- SQL injection prevention with SQLAlchemy ORM
- XSS prevention with input sanitization

## Troubleshooting

### Service Won't Start

1. **Check dual-database environment variables:**
   ```bash
   # Ensure all three database URLs are set correctly
   echo $DATABASE_URL              # Should point to components_v2 on port 27010
   echo $SUPABASE_DATABASE_URL     # Should point to postgres on port 27432
   echo $COMPONENTS_V2_DATABASE_URL # Should point to components_v2 on port 27010
   echo $REDIS_URL                 # Should point to Redis on port 27012
   ```

2. **Check database connectivity (both databases):**
   ```bash
   # Components-V2 database
   psql "postgresql://postgres:postgres@localhost:27010/components_v2" -c "SELECT 1"

   # Supabase database
   psql "postgresql://postgres:postgres@localhost:27432/postgres" -c "SELECT 1"
   ```

3. **Check Redis connectivity:**
   ```bash
   redis-cli -h localhost -p 27012 ping
   ```

4. **Verify containers are running:**
   ```bash
   docker ps | grep -E "supabase-db|components-v2-postgres|redis"
   ```

### Health Checks Failing

1. **Database issues:**
   - Verify PostgreSQL is running
   - Check connection string
   - Verify database exists

2. **Redis issues:**
   - Verify Redis is running
   - Check connection string

3. **Temporal issues:**
   - Verify Temporal server is running on port 7233
   - Check network connectivity

### Import Errors

If you see import errors:
```bash
# Ensure you're in the virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

## Roadmap

See [CNS-IMPLEMENTATION-ROADMAP.md](../../../CNS-IMPLEMENTATION-ROADMAP.md) for the complete 12-week implementation plan.

### Phase 1: Foundation (Weeks 1-3) - **Current**
- ✅ Week 1: Project setup & infrastructure
- ⏳ Week 2: Core normalization engine
- ⏳ Week 3: Supplier API integration (Tier 1)

### Phase 2: Workflow Orchestration (Weeks 4-6)
- 🔜 Week 4: Temporal workflow setup
- 🔜 Week 5: AI integration (Ollama)
- 🔜 Week 6: Database operations & quality routing

### Phase 3: Customer & Staff UX (Weeks 7-9)
- 🔜 Week 7: WebSocket progress updates
- 🔜 Week 8: Staff dashboard (review queue)
- 🔜 Week 9: Customer BOM upload UI

### Phase 4: Advanced Features (Weeks 10-12)
- 🔜 Week 10: Multi-AI provider support
- 🔜 Week 11: Data source expansion (Tier 2-4)
- 🔜 Week 12: Testing, documentation, deployment

## Contributing

### Development Workflow

1. Create a feature branch
2. Make changes
3. Run tests and linting
4. Submit pull request

### Code Style

- Follow PEP 8 guidelines
- Use type hints
- Write docstrings for all functions/classes
- Keep functions focused and small

## Related Documentation

- [COMPONENT-INTELLIGENCE-PORTAL-COMPLETE-SPEC.md](../../../COMPONENT-INTELLIGENCE-PORTAL-COMPLETE-SPEC.md) - Complete technical specification
- [CNS-IMPLEMENTATION-ROADMAP.md](../../../CNS-IMPLEMENTATION-ROADMAP.md) - 12-week implementation plan
- [CNS-DATA-SOURCES-AND-EXPANSION.md](../../../CNS-DATA-SOURCES-AND-EXPANSION.md) - Data source strategy
- [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) - Detailed project structure

## Support

For questions or issues:
- Check the documentation
- Review health check endpoints
- Check logs: `docker-compose logs -f cns-service`
- Open an issue on GitHub

## License

Proprietary - Components Platform

---

**Last Updated:** 2025-11-02
**Status:** Phase 1 - Foundation
