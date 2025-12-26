# Customer Portal - React Admin + Supabase

Standalone customer-facing application for component management.

## Features

- **React Admin** - Complete admin UI framework
- **Supabase Integration** - Auth, REST API, RLS
- **Multi-tenancy** - PostgreSQL Row-Level Security
- **Material-UI** - Modern UI components matching V1 design
- **Vite** - Fast development and build
- **TypeScript** - Type-safe code

## Architecture

```
Customer Portal (Port 27510)
    ↓
Supabase via Traefik (http://localhost:27500/supabase)
    ├─ Kong API Gateway (27540 direct)
    ├─ PostgreSQL (27701)
    ├─ Auth Service
    ├─ REST API (PostgREST)
    ├─ Realtime
    ├─ Storage
    ├─ Meta API
    └─ Studio UI (27703)
```

## Development

### Prerequisites

```bash
node >= 18
npm >= 9
```

### Install Dependencies

```bash
cd customer-portal
npm install
```

### Run Development Server

```bash
npm run dev
```

Accessible at: **http://localhost:27510**

### Build for Production

```bash
npm run build
```

## Docker Deployment

### Build and Run with Docker Compose

```bash
# From components-platform-v2 directory
docker compose -f docker-compose.customer-portal.yml up -d --build
```

### Access

- **Customer Portal**: http://localhost:27510
- **Supabase Studio**: http://localhost:27703

## Environment Variables

Create `.env` file:

```bash
VITE_SUPABASE_URL=http://localhost:27500/supabase
VITE_SUPABASE_ANON_KEY=<anon-key>

# Optional: dev-only bypass (NEVER in production)
# VITE_DEV_BYPASS_ENABLED=true
# VITE_SUPABASE_SERVICE_KEY=<service-role-key>

# CNS (Component Normalization Service) base URL
# Default in development: direct CNS service on port 27800
VITE_CNS_API_URL=http://localhost:27800
```

## Project Structure

```
customer-portal/
├── src/
│   ├── providers/
│   │   ├── dataProvider.ts       # Supabase CRUD operations
│   │   └── authProvider.ts       # Supabase authentication
│   ├── components/
│   │   └── fields/
│   │       ├── RiskLevelField.tsx
│   │       ├── LifecycleStatusField.tsx
│   │       └── ComplianceField.tsx
│   ├── resources/
│   │   ├── components.tsx        # Component CRUD
│   │   ├── boms.tsx              # BOM management
│   │   └── alerts.tsx            # Alert notifications
│   ├── App.tsx                   # React Admin root
│   └── main.tsx                  # Entry point
├── Dockerfile                    # Production build
├── nginx.conf                    # Nginx configuration
├── vite.config.ts                # Vite configuration
└── package.json
```

## Features

### Components Resource
- List view with customizable columns
- Advanced filtering (MPN, manufacturer, category, risk, lifecycle)
- Color-coded badges (Risk, Lifecycle, Compliance)
- CRUD operations
- Export functionality

### BOMs Resource
- Grade system (A-F) with color-coded badges
- Status tracking (Pending, Analyzing, Completed, Failed)
- Line items management
- Cost analysis
- Risk metrics

### Alerts Resource
- Severity levels (Critical, High, Medium, Low, Info)
- Alert types (Lifecycle, Risk, Compliance, Price, Stock, Quality)
- Read/Unread status
- Related component information

## Authentication

Uses Supabase Auth with:
- Email/password login
- Session management
- JWT tokens
- Role-based permissions

## Multi-tenancy

PostgreSQL Row-Level Security (RLS) ensures:
- Tenant data isolation
- Automatic filtering by tenant_id
- Database-level security

## Color Scheme

Matches V1 exactly:
- **Risk Levels**: GREEN (#22c55e), YELLOW (#facc15), ORANGE (#fb923c), RED (#ef4444)
- **Lifecycle**: ACTIVE (green), NRND (yellow), EOL (orange), OBSOLETE (red)
- **BOM Grades**: A-F with color progression

## Tech Stack

- **React** 18.2
- **TypeScript** 5.2
- **Vite** 5.0
- **React Admin** 4.16
- **Material-UI** 5.15
- **Supabase JS** 2.39
- **Nginx** (production)

## License

Private - Components Platform V2
