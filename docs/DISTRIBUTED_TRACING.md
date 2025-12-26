# Distributed Tracing Implementation Guide

Comprehensive guide for implementing distributed tracing across the Ananta Platform using OpenTelemetry, Jaeger, and AWS X-Ray.

## Overview

The Ananta Platform uses a **dual-backend tracing strategy**:

1. **Local Development & Staging**: Jaeger (self-hosted, free)
2. **Production**: AWS X-Ray (managed, scalable, cost-effective)

An **OpenTelemetry Collector** sits between services and backends, providing:
- Protocol translation (Jaeger, OTLP, Zipkin → X-Ray)
- Intelligent sampling
- Trace enrichment
- Multi-backend export

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                              │
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Tenant Mgmt    │  │  CNS Service   │  │ Temporal Worker│         │
│  │  (Node.js)     │  │   (Python)     │  │   (Node.js)    │         │
│  │                │  │                │  │                │         │
│  │ OTEL SDK       │  │  OTEL SDK      │  │  OTEL SDK      │         │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘         │
│          │                   │                    │                  │
└──────────┼───────────────────┼────────────────────┼──────────────────┘
           │                   │                    │
           │ OTLP/gRPC (:4317) │ Jaeger/gRPC        │
           │                   │  (:14250)          │
           └───────────────────┴────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │      OpenTelemetry Collector                 │
        │                                              │
        │  Receivers:                                  │
        │    - OTLP (gRPC/HTTP)                       │
        │    - Jaeger (gRPC/HTTP/UDP)                 │
        │                                              │
        │  Processors:                                 │
        │    - Batch (reduce API calls)               │
        │    - Memory Limiter (prevent OOM)           │
        │    - Resource (add metadata)                │
        │    - Probabilistic Sampler                  │
        │    - Span (filter sensitive data)           │
        │                                              │
        │  Exporters:                                  │
        │    - Jaeger (local dev/staging)             │
        │    - AWS X-Ray (production)                 │
        │    - Prometheus (metrics)                   │
        │    - Logging (debug)                        │
        └─────┬──────────────┬─────────────┬───────────┘
              │              │             │
              ▼              ▼             ▼
    ┌─────────────┐  ┌────────────┐  ┌──────────────┐
    │   Jaeger    │  │  AWS X-Ray │  │  Prometheus  │
    │             │  │            │  │              │
    │ UI: :16686  │  │ Console    │  │  Metrics     │
    │ Storage:    │  │ 30-day     │  │  Exporter    │
    │  Badger     │  │ retention  │  │              │
    └─────────────┘  └────────────┘  └──────────────┘
          │                 │
          ▼                 ▼
    ┌─────────────┐  ┌────────────┐
    │   Grafana   │  │  X-Ray     │
    │             │  │  Insights  │
    │ Dashboards  │  │  Anomaly   │
    │ UI: :3001   │  │  Detection │
    └─────────────┘  └────────────┘
```

## Instrumentation by Language

### Node.js (TypeScript) - Control Plane Services

**Services**: tenant-management-service, temporal-worker-service, orchestrator-service

#### 1. Install Dependencies

```bash
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc
```

#### 2. Create Tracing Module

```typescript
// src/observability/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export function initTracing() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'tenant-management-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('Tracing shut down successfully'))
      .catch((error) => console.error('Error shutting down tracing', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}
```

#### 3. Initialize in Application

```typescript
// src/index.ts
import { initTracing } from './observability/tracing';

// IMPORTANT: Initialize tracing BEFORE importing other modules
initTracing();

import { ApplicationConfig, TenantMgmtServiceApplication } from './application';

// ... rest of application code
```

#### 4. Add Custom Spans

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('tenant-management-service');

export async function provisionTenant(tenantData: any) {
  const span = tracer.startSpan('provision_tenant');

  try {
    // Add attributes
    span.setAttribute('tenant.id', tenantData.id);
    span.setAttribute('tenant.tier', tenantData.tier);

    // Your provisioning logic
    const result = await createTenantInDatabase(tenantData);

    // Add event
    span.addEvent('tenant_created', { tenant_id: result.id });

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

### Python (FastAPI) - App Plane Services

**Services**: cns-service, enrichment-service

#### 1. Install Dependencies

```bash
pip install \
  opentelemetry-api \
  opentelemetry-sdk \
  opentelemetry-exporter-otlp-proto-grpc \
  opentelemetry-instrumentation-fastapi \
  opentelemetry-instrumentation-sqlalchemy \
  opentelemetry-instrumentation-httpx
```

#### 2. Use Existing Tracing Module

CNS service already has tracing configured in `app/observability/tracing.py`. Usage:

```python
from app.observability.tracing import (
    init_tracing,
    instrument_app,
    trace_function,
    create_span,
    add_span_attributes,
)

# In main.py (already done)
tracer = init_tracing(
    service_name="cns-service",
    otlp_endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
    sampling_ratio=0.1,
)

# Instrument FastAPI app
instrument_app(app)

# Use decorator for functions
@trace_function(name="enrich_component", attributes={"component.type": "resistor"})
async def enrich_component(mpn: str, manufacturer: str):
    # Function is automatically traced
    result = await lookup_component(mpn, manufacturer)

    # Add dynamic attributes
    add_span_attributes({
        "component.mpn": mpn,
        "component.found": result is not None,
    })

    return result

# Use context manager for code blocks
async def process_bom(bom_id: str):
    with create_span("load_bom", attributes={"bom.id": bom_id}) as span:
        bom = await load_bom_from_db(bom_id)
        span.set_attribute("bom.line_count", len(bom.lines))

    with create_span("enrich_lines") as span:
        enriched = await enrich_all_lines(bom.lines)
        span.set_attribute("enrichment.matched", enriched.matched_count)
```

## Environment Configuration

### Development (.env)

```bash
# OpenTelemetry Configuration
OTEL_SERVICE_NAME=tenant-management-service
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_TRACES_SAMPLER=always_on
OTEL_LOG_LEVEL=debug

# Jaeger direct export (alternative)
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

### Docker Compose

```yaml
services:
  tenant-management-service:
    environment:
      - OTEL_SERVICE_NAME=tenant-management-service
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - OTEL_TRACES_SAMPLER=traceidratio
      - OTEL_TRACES_SAMPLER_ARG=0.1  # 10% sampling
    networks:
      - arc-saas
      - shared-monitoring-network
```

### Production (ECS Task Definition)

```json
{
  "environment": [
    {
      "name": "OTEL_SERVICE_NAME",
      "value": "tenant-management-service"
    },
    {
      "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
      "value": "http://localhost:4317"
    },
    {
      "name": "AWS_XRAY_DAEMON_ADDRESS",
      "value": "localhost:2000"
    }
  ]
}
```

## Sampling Strategies

### Always On (Development)

```yaml
# OTel Collector config
processors:
  # No sampler - accept all traces
```

Application:
```bash
OTEL_TRACES_SAMPLER=always_on
```

### Probabilistic (Staging)

```yaml
# OTel Collector config
processors:
  probabilistic_sampler:
    sampling_percentage: 50  # 50%
```

Application:
```bash
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.5  # 50%
```

### Intelligent (Production)

```yaml
# OTel Collector config
processors:
  probabilistic_sampler:
    sampling_percentage: 10  # 10% default
```

Plus AWS X-Ray sampling rules (see X-Ray module README):
- Critical APIs: 100%
- Auth APIs: 50%
- Health checks: 1%
- Default: 10%

## Trace Context Propagation

### W3C Trace Context (Recommended)

Auto-configured by OpenTelemetry SDK. Headers:
- `traceparent`: `00-{trace-id}-{span-id}-{flags}`
- `tracestate`: vendor-specific data

### Manual Propagation

```typescript
import { propagation, context } from '@opentelemetry/api';
import axios from 'axios';

// Extract context from incoming request
const extractedContext = propagation.extract(context.active(), req.headers);

// Inject context into outgoing request
context.with(extractedContext, () => {
  const headers = {};
  propagation.inject(context.active(), headers);

  axios.get('http://other-service/api', { headers });
});
```

## Viewing and Analyzing Traces

### Jaeger UI (Development)

1. Open http://localhost:16686
2. Select service: `tenant-management-service`
3. Select operation (optional): `POST /tenants`
4. Click "Find Traces"
5. Click trace to see waterfall view

**Service Map**: http://localhost:16686/dependencies
- Shows service dependencies
- Color-coded by error rate

### AWS X-Ray Console (Production)

1. AWS Console → X-Ray → Service Map
2. Time range: Last 1 hour
3. Filter by:
   - Service: `tenant-management-service`
   - HTTP Status: `5xx`
   - Response Time: `> 1s`

**Trace Groups**:
- Errors: `fault = true OR error = true`
- Slow: `duration >= 1`
- Tenant Ops: `annotation.operation = "provision"`

### Grafana (Unified View)

1. Open http://localhost:3001
2. Explore → Jaeger
3. Query by:
   - Service: `tenant-management-service`
   - Tags: `tenant.id=12345`
   - Duration: `> 1s`

**Trace-to-Metrics**: Click "View Metrics" from trace to see related Prometheus metrics

## Best Practices

### 1. Semantic Attributes

Use OpenTelemetry semantic conventions:

```typescript
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

span.setAttribute(SemanticAttributes.HTTP_METHOD, 'POST');
span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, 200);
span.setAttribute(SemanticAttributes.DB_SYSTEM, 'postgresql');
span.setAttribute(SemanticAttributes.DB_STATEMENT, 'SELECT * FROM tenants');
```

### 2. Custom Attributes for Business Logic

```typescript
// Tenant operations
span.setAttribute('tenant.id', tenantId);
span.setAttribute('tenant.tier', 'premium');
span.setAttribute('tenant.operation', 'provision');

// User operations
span.setAttribute('user.id', userId);
span.setAttribute('user.role', 'admin');

// Workflow operations
span.setAttribute('workflow.id', workflowId);
span.setAttribute('workflow.type', 'tenant_provisioning');
span.setAttribute('workflow.status', 'running');
```

### 3. Span Events for Milestones

```typescript
span.addEvent('tenant_created', { tenant_id: '123' });
span.addEvent('keycloak_user_created', { user_id: '456' });
span.addEvent('dns_configured', { domain: 'tenant.example.com' });
span.addEvent('provisioning_complete', { duration_ms: 5432 });
```

### 4. Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
  span.recordException(error);
  throw error;  // Re-throw to propagate
}
```

### 5. Sensitive Data Filtering

```yaml
# OTel Collector config
processors:
  span:
    attributes:
      - key: http.request.header.authorization
        action: delete
      - key: http.request.header.cookie
        action: delete
      - key: db.statement
        action: delete  # Or hash sensitive queries
```

## Troubleshooting

### No Traces in Jaeger

**Symptom**: Services running, but no traces in Jaeger UI

**Diagnosis**:
```bash
# 1. Check OTel Collector is receiving spans
curl http://localhost:55679/debug/tracez

# 2. Check OTel Collector logs
docker logs shared-otel-collector 2>&1 | grep "Spans received"

# 3. Check application is sending traces
docker logs <service-container> 2>&1 | grep -i "tracing\|otel"

# 4. Verify network connectivity
docker exec <service-container> nc -zv otel-collector 4317
```

**Solution**:
- Ensure `OTEL_EXPORTER_OTLP_ENDPOINT` is set correctly
- Verify service is on `shared-monitoring-network` Docker network
- Check OTel Collector health: `curl http://localhost:13133/health`

### Traces in Jaeger but not X-Ray

**Symptom**: Local dev works, but production X-Ray empty

**Diagnosis**:
```bash
# 1. Check awsxray exporter is enabled
docker logs shared-otel-collector 2>&1 | grep awsxray

# 2. Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn <task-role-arn> \
  --action-names xray:PutTraceSegments xray:PutTelemetryRecords \
  --resource-arns "*"

# 3. Check X-Ray daemon logs (if using sidecar)
aws logs tail /aws/ecs/xray --follow

# 4. Check OTel Collector X-Ray export errors
docker logs shared-otel-collector 2>&1 | grep -i "export\|x-ray\|error"
```

**Solution**:
- Attach X-Ray write policy to ECS task role
- Set `AWS_REGION` environment variable
- Enable awsxray exporter in prod OTel Collector config
- Verify X-Ray sampling rules are not rejecting traces

### High Memory Usage

**Symptom**: OTel Collector consuming > 500MB memory

**Diagnosis**:
```promql
# Prometheus query
otelcol_process_memory_rss / 1024 / 1024
```

**Solution**:
```yaml
# Reduce batch size
processors:
  batch:
    send_batch_size: 512  # Down from 1024
    timeout: 5s

# Increase memory limit trigger
  memory_limiter:
    limit_mib: 768  # Up from 512
    spike_limit_mib: 192
```

### Missing Parent-Child Relationships

**Symptom**: Spans appear as separate traces instead of one trace

**Diagnosis**: Check `traceparent` header is being propagated

**Solution**:
```typescript
// Ensure propagation is configured
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// In SDK initialization
const sdk = new NodeSDK({
  textMapPropagator: new W3CTraceContextPropagator(),
  // ... other config
});
```

## Performance Impact

### Overhead by Component

| Component | CPU Overhead | Memory Overhead | Latency Impact |
|-----------|--------------|-----------------|----------------|
| OTel SDK (auto-instrumentation) | 2-5% | 20-50 MB | < 1ms |
| OTel Collector | 50-100 MB | 100-200 MB | < 1ms |
| Sampling (10%) | < 0.5% | < 5 MB | < 0.1ms |

### Optimization Tips

1. **Use Probabilistic Sampling**: 10% captures enough data while reducing overhead by 90%
2. **Batch Span Export**: Default 1024 spans per batch reduces network calls
3. **Limit Attribute Size**: Avoid large strings in attributes
4. **Use Tail-Based Sampling** (advanced): Sample only interesting traces (errors, slow requests)

## Migration Path

### Phase 1: Local Development (Current)

- ✅ Jaeger only
- ✅ OTel Collector with Jaeger export
- ✅ 100% sampling
- ✅ CNS service instrumented

### Phase 2: Staging

- ⬜ Add probabilistic sampling (50%)
- ⬜ Instrument tenant-management-service
- ⬜ Instrument temporal-worker-service
- ⬜ Test trace propagation across services

### Phase 3: Production

- ⬜ Deploy X-Ray Terraform module
- ⬜ Enable awsxray exporter in OTel Collector
- ⬜ Configure X-Ray sampling rules
- ⬜ Add X-Ray daemon sidecars to ECS tasks
- ⬜ 10% default sampling
- ⬜ Monitor costs and adjust sampling

## Further Reading

- [OpenTelemetry Best Practices](https://opentelemetry.io/docs/concepts/instrumentation/best-practices/)
- [AWS X-Ray Developer Guide](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html)
- [Jaeger Sampling](https://www.jaegertracing.io/docs/latest/sampling/)
- [Distributed Tracing 101](https://www.honeycomb.io/blog/distributed-tracing-101)
