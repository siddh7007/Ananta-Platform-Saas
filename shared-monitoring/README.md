# Shared Monitoring Stack - Ananta Platform

Centralized monitoring infrastructure for both **Control Plane (Ananta-SaaS)** and **App Plane** services.

## Components

| Component | Port | URL | Purpose |
|-----------|------|-----|---------|
| **Prometheus** | 9090 | http://localhost:9090 | Metrics collection & storage |
| **Grafana** | 3001 | http://localhost:3001 | Visualization & dashboards |
| **AlertManager** | 9093 | http://localhost:9093 | Alert routing & notifications |
| **Blackbox Exporter** | 9115 | http://localhost:9115 | HTTP/TCP endpoint probing |

## Quick Start

### Prerequisites

1. **Docker networks** must exist for cross-stack communication
2. **App Plane services** should have Redis Exporter and RabbitMQ Prometheus plugin enabled

### Using Startup Scripts (Recommended)

**PowerShell (Windows):**
```powershell
cd shared-monitoring/scripts
.\start-monitoring.ps1           # Start monitoring stack
.\start-monitoring.ps1 -Down     # Stop monitoring stack
.\start-monitoring.ps1 -Logs     # Follow logs
.\start-monitoring.ps1 -Status   # Check status
.\start-monitoring.ps1 -Help     # Show help
```

**Bash (Linux/macOS):**
```bash
cd shared-monitoring/scripts
./start-monitoring.sh            # Start monitoring stack
./start-monitoring.sh --down     # Stop monitoring stack
./start-monitoring.sh --logs     # Follow logs
./start-monitoring.sh --status   # Check status
./start-monitoring.sh --help     # Show help
```

### Manual Start

```bash
# Initialize networks (run once)
cd shared-monitoring/scripts
./init-networks.sh   # or .\init-networks.ps1 on Windows

# Start stack
cd shared-monitoring
docker-compose up -d
```

### Verify Services

```bash
# Check container status
docker-compose ps

# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].health'

# Check Grafana health
curl -s http://localhost:3001/api/health
```

## Access

### Grafana
- **URL**: http://localhost:3001
- **Username**: `admin`
- **Password**: `admin123`

Pre-loaded dashboards:
- **Ananta Platform Health** - Overall platform status

### Prometheus
- **URL**: http://localhost:9090
- **Targets**: http://localhost:9090/targets

### AlertManager
- **URL**: http://localhost:9093
- **Silences**: http://localhost:9093/#/silences

## Architecture

```
                    ┌─────────────────┐
                    │    Grafana      │
                    │   :3001         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Prometheus    │
                    │   :9090         │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│  Control Plane  │ │    App Plane    │ │    Blackbox     │
│  (Ananta-SaaS)  │ │                 │ │    Exporter     │
│                 │ │                 │ │                 │
│ tenant-mgmt     │ │ cns-service     │ │ HTTP probes     │
│ :14000          │ │ :8000           │ │ :9115           │
│                 │ │                 │ │                 │
│ /health         │ │ /health/config  │ │ All endpoints   │
│ /health/live    │ │ /health/config/ │ │                 │
│ /health/ready   │ │   dual-db       │ │                 │
└─────────────────┘ │ /api/health/    │ └─────────────────┘
                    │ /api/health/    │
                    │   detailed      │
                    │                 │
                    │ django-backend  │
                    │ redis           │
                    │ rabbitmq        │
                    │ minio           │
                    └─────────────────┘
```

## Scraped Endpoints

### Control Plane (Ananta-SaaS)

| Job | Target | Endpoint | Interval |
|-----|--------|----------|----------|
| ananta-saas-tenant-mgmt | tenant-management-service:14000 | /health | 30s |
| ananta-saas-tenant-mgmt-live | tenant-management-service:14000 | /health/live | 15s |
| ananta-saas-tenant-mgmt-ready | tenant-management-service:14000 | /health/ready | 30s |

### App Plane

| Job | Target | Endpoint | Interval |
|-----|--------|----------|----------|
| app-plane-cns-config | cns-service:8000 | /health/config | 30s |
| app-plane-cns-dual-db | cns-service:8000 | /health/config/dual-db | 60s |
| app-plane-cns-health | cns-service:8000 | /api/health/ | 30s |
| app-plane-cns-detailed | cns-service:8000 | /api/health/detailed | 60s |
| app-plane-django | django-backend:8000 | /health/ | 30s |
| app-plane-redis | redis-exporter:9121 | /metrics | 30s |
| app-plane-rabbitmq | rabbitmq:15692 | - | 60s |
| app-plane-minio | minio:9000 | /minio/v2/metrics/cluster | 60s |

## Alert Rules

Alerts are defined in `prometheus/alerts/ananta-platform.yml`:

### Critical Alerts
- **TenantManagementServiceDown** - Control Plane API unreachable
- **CNSServiceDown** - CNS Service unreachable
- **CNSDualDatabaseUnhealthy** - Dual-database routing broken
- **RedisDown** - Cache unavailable
- **RabbitMQDown** - Message broker unavailable

### Warning Alerts
- **TenantManagementNotReady** - Service not ready
- **CNSConfigUnhealthy** - Config health check failed
- **MinIODown** - Object storage unavailable
- **RedisExporterDown** - Redis metrics unavailable
- **RedisMemoryHigh** - Redis memory usage above 85%
- **RedisConnectedClientsHigh** - Too many Redis clients
- **HTTPEndpointDown** - HTTP probe failing
- **HTTPEndpointSlowResponse** - Response time > 5s

## Customization

### Add Slack Notifications

Edit `alertmanager/alertmanager.yml`:
```yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#critical-alerts'
        send_resolved: true
```

### Add Email Notifications

Edit `alertmanager/alertmanager.yml`:
```yaml
global:
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@ananta.io'
  smtp_auth_username: 'alertmanager'
  smtp_auth_password: 'password'

receivers:
  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@ananta.io'
        send_resolved: true
```

### Add New Scrape Target

Edit `prometheus/prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'my-new-service'
    static_configs:
      - targets: ['my-service:8080']
        labels:
          plane: 'app'
          service: 'my-service'
    metrics_path: /health
    scrape_interval: 30s
```

Then reload Prometheus:
```bash
curl -X POST http://localhost:9090/-/reload
```

## Troubleshooting

### Prometheus Not Scraping Targets

1. Check target health:
   ```bash
   curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, error: .lastError}'
   ```

2. Verify network connectivity:
   ```bash
   docker exec shared-prometheus wget -q --spider http://tenant-management-service:14000/health
   ```

3. Check Prometheus logs:
   ```bash
   docker logs shared-prometheus --tail 50
   ```

### Grafana Dashboard Not Loading

1. Check datasource:
   ```bash
   curl -u admin:admin123 http://localhost:3001/api/datasources
   ```

2. Check provisioning:
   ```bash
   docker logs shared-grafana 2>&1 | grep -i "provisioning"
   ```

### Alerts Not Firing

1. Check AlertManager status:
   ```bash
   curl http://localhost:9093/api/v2/status
   ```

2. Check active alerts:
   ```bash
   curl http://localhost:9093/api/v2/alerts
   ```

3. View alert rules:
   ```bash
   curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {name: .name, state: .state}'
   ```

## File Structure

```
shared-monitoring/
├── docker-compose.yml           # Main compose file
├── README.md                    # This file
├── scripts/
│   ├── init-networks.sh         # Network initialization (Bash)
│   ├── init-networks.ps1        # Network initialization (PowerShell)
│   ├── start-monitoring.sh      # Startup script (Bash)
│   └── start-monitoring.ps1     # Startup script (PowerShell)
├── prometheus/
│   ├── prometheus.yml           # Prometheus configuration
│   └── alerts/
│       └── ananta-platform.yml  # Alert rules
├── grafana/
│   └── provisioning/
│       ├── datasources/
│       │   └── datasources.yml  # Auto-configured datasources
│       └── dashboards/
│           ├── dashboards.yml   # Dashboard provisioning config
│           └── json/
│               └── ananta-platform-health.json  # Health dashboard
├── alertmanager/
│   ├── alertmanager.yml         # AlertManager configuration
│   └── templates/
│       └── ananta.tmpl          # Notification templates
└── blackbox/
    └── blackbox.yml             # Blackbox exporter config
```

## App Plane Dependencies

The monitoring stack requires the following dependencies in the App Plane:

### Redis Exporter
Added as a sidecar container in `app-plane/docker-compose.yml`:
- **Container**: `app-plane-redis-exporter`
- **Image**: `oliver006/redis_exporter:v1.55.0`
- **Port**: 27121 (host) -> 9121 (container)
- **Metrics Endpoint**: `http://redis-exporter:9121/metrics`

### RabbitMQ Prometheus Plugin
Enabled in `app-plane/docker-compose.yml`:
- **Plugin**: `rabbitmq_prometheus`
- **Port**: 27692 (host) -> 15692 (container)
- **Metrics Endpoint**: `http://rabbitmq:15692/metrics`
- **Config File**: `app-plane/rabbitmq/enabled_plugins`

## Docker Networks

The monitoring stack requires these external networks to communicate with services:

| Network | Purpose |
|---------|---------|
| `arc-saas` | Control Plane services |
| `app-plane` | App Plane services |
| `shared-monitoring` | Monitoring stack internal |
| `shared-temporal-network` | Temporal workflow engine |

Create networks manually or use the initialization scripts:
```bash
./scripts/init-networks.sh   # Bash
.\scripts\init-networks.ps1  # PowerShell
```

## Maintenance

### Backup Grafana Dashboards

```bash
# Export all dashboards
mkdir -p backups
for uid in $(curl -s -u admin:admin123 http://localhost:3001/api/search | jq -r '.[].uid'); do
  curl -s -u admin:admin123 "http://localhost:3001/api/dashboards/uid/$uid" > "backups/$uid.json"
done
```

### Update Prometheus

```bash
docker-compose pull prometheus
docker-compose up -d prometheus
```

### Clean Up Old Data

```bash
# Prometheus (automatic based on retention)
# Check current retention
curl http://localhost:9090/api/v1/status/runtimeinfo | jq '.data.storageRetention'

# Grafana - manual cleanup
docker exec shared-grafana rm -rf /var/lib/grafana/csv/*
```

## Integration with CI/CD

Add health checks to your CI pipeline:

```yaml
# GitHub Actions example
- name: Check Platform Health
  run: |
    # Wait for services
    sleep 30

    # Check Prometheus targets
    curl -sf http://localhost:9090/api/v1/targets | \
      jq -e '.data.activeTargets | map(select(.health == "up")) | length > 0'

    # Check for firing alerts
    curl -sf http://localhost:9093/api/v2/alerts | \
      jq -e 'map(select(.status.state == "active")) | length == 0'
```
