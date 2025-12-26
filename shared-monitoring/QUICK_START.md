# Distributed Tracing - Quick Start Guide

Get distributed tracing running in 5 minutes.

## 1. Start Monitoring Stack

```bash
cd shared-monitoring
docker-compose up -d
```

**Expected Output**:
```
Creating shared-otel-collector ... done
Creating shared-jaeger        ... done
Creating shared-prometheus    ... done
Creating shared-grafana       ... done
Creating shared-alertmanager  ... done
Creating shared-blackbox      ... done
```

## 2. Verify Services

```bash
# All services healthy
docker-compose ps

# Should show all services "Up (healthy)"
```

| Service | URL | Purpose |
|---------|-----|---------|
| Jaeger UI | http://localhost:16686 | View traces |
| Prometheus | http://localhost:9090 | Metrics |
| Grafana | http://localhost:3001 | Dashboards (admin/admin123) |
| OTel Collector Health | http://localhost:13133/health | Status check |
| OTel zPages | http://localhost:55679/debug/tracez | Debug traces |

## 3. Test Trace Generation

### Option A: Manual Test (cURL)

```bash
# Send test trace via OTLP HTTP
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [{
          "key": "service.name",
          "value": {"stringValue": "test-service"}
        }]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "12345678901234567890123456789012",
          "spanId": "1234567890123456",
          "name": "test-span",
          "startTimeUnixNano": "'$(date +%s%N)'",
          "endTimeUnixNano": "'$(( $(date +%s%N) + 1000000000 ))'",
          "kind": 1
        }]
      }]
    }]
  }'
```

View in Jaeger:
1. Open http://localhost:16686
2. Service: `test-service`
3. Click "Find Traces"

### Option B: Start CNS Service (Real Traces)

```bash
cd app-plane
docker-compose up -d cns-service

# Generate trace by calling API
curl http://localhost:27200/health
```

View in Jaeger:
1. Service: `cns-service`
2. Look for `GET /health` spans

## 4. Instrument Your Service

### Node.js

```bash
# Install dependencies
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc
```

```typescript
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

```typescript
// src/index.ts
import './tracing';  // MUST be first import
import express from 'express';

const app = express();
// ... rest of app
```

### Python (FastAPI)

CNS service already has tracing! Just set environment variable:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

Or in `docker-compose.yml`:

```yaml
services:
  my-service:
    environment:
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - OTEL_SERVICE_NAME=my-service
    networks:
      - shared-monitoring-network
```

## 5. View Your Traces

### Jaeger UI

1. Open http://localhost:16686
2. Select your service from dropdown
3. Click "Find Traces"
4. Click a trace to see waterfall view

**Service Map**: http://localhost:16686/dependencies

### Grafana

1. Open http://localhost:3001 (admin/admin123)
2. Explore → Jaeger datasource
3. Query by service, tags, or duration

## 6. Monitor OTel Collector

```bash
# View real-time trace reception
curl http://localhost:55679/debug/tracez | jq

# Check Prometheus metrics
curl http://localhost:8889/metrics | grep otelcol_receiver
```

**Expected Metrics**:
- `otelcol_receiver_accepted_spans_total`: Spans received
- `otelcol_exporter_sent_spans_total`: Spans exported
- `otelcol_processor_dropped_spans_total`: Should be 0

## Troubleshooting

### No traces appearing

```bash
# 1. Check OTel Collector is running
curl http://localhost:13133/health
# Should return: "ok"

# 2. Check your service is sending traces
docker logs <your-service> 2>&1 | grep -i otel

# 3. Check OTel Collector received spans
curl http://localhost:55679/debug/tracez

# 4. Check Jaeger received traces
curl http://localhost:16686/api/services
# Should include your service name
```

### OTel Collector not starting

```bash
# Check logs
docker logs shared-otel-collector

# Common issues:
# - Port conflict: Kill process using port 4317
# - Invalid config: Check otel-collector-config.yaml syntax
```

### Service can't reach OTel Collector

```bash
# Check network
docker network inspect shared-monitoring-network

# Verify service is on network
docker inspect <your-service> | grep -A 5 Networks

# Add service to network
docker network connect shared-monitoring-network <your-service>
```

## Next Steps

1. **Add custom spans**: See [DISTRIBUTED_TRACING.md](../docs/DISTRIBUTED_TRACING.md)
2. **Configure sampling**: Edit `otel-collector/otel-collector-config.yaml`
3. **Set up Grafana dashboards**: Import pre-built dashboards
4. **Enable AWS X-Ray**: For production deployment

## Clean Up

```bash
# Stop all services
docker-compose down

# Remove volumes (clear all data)
docker-compose down -v
```

## Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | http://localhost:4317 | OTel Collector address |
| `OTEL_SERVICE_NAME` | - | Service identifier |
| `OTEL_TRACES_SAMPLER` | parentbased_always_on | Sampling strategy |
| `OTEL_TRACES_SAMPLER_ARG` | - | Sampler argument (e.g., 0.1 for 10%) |
| `OTEL_LOG_LEVEL` | info | Log verbosity |

## Helpful Commands

```bash
# View all traces in Jaeger (CLI)
curl 'http://localhost:16686/api/traces?service=my-service&limit=10' | jq

# Export Prometheus metrics
curl http://localhost:9090/api/v1/query?query=otelcol_receiver_accepted_spans_total

# Restart OTel Collector (reload config)
docker restart shared-otel-collector

# View OTel Collector config
docker exec shared-otel-collector cat /etc/otel-collector-config.yaml

# Test OTLP gRPC endpoint
grpcurl -plaintext localhost:4317 list
```

## Support

- **Documentation**: [DISTRIBUTED_TRACING.md](../docs/DISTRIBUTED_TRACING.md)
- **X-Ray Module**: [infrastructure/terraform/modules/xray/README.md](../infrastructure/terraform/modules/xray/README.md)
- **Monitoring README**: [README.md](./README.md)
