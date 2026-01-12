# Ananta Platform - Installation Checklist

## Pre-Installation Checklist

### 1. Kubernetes Cluster Requirements

- [ ] Kubernetes version 1.25 or higher
- [ ] kubectl configured and connected to cluster
- [ ] Sufficient cluster resources:
  - [ ] Development: 4 CPU, 8GB RAM minimum
  - [ ] Staging: 8 CPU, 16GB RAM minimum
  - [ ] Production: 16+ CPU, 32+ GB RAM minimum
- [ ] Storage class configured for persistent volumes
- [ ] Load balancer support (for ingress)

### 2. Required Tools Installed

- [ ] kubectl 1.25+
- [ ] helm 3.10+
- [ ] git (for cloning repository)
- [ ] Optional: argocd CLI (for GitOps)
- [ ] Optional: k9s (for cluster management)

### 3. Required Operators/Controllers

- [ ] nginx-ingress-controller installed
- [ ] cert-manager installed
- [ ] ClusterIssuer configured (letsencrypt-prod)
- [ ] prometheus-operator installed (optional, for monitoring)
- [ ] external-secrets-operator installed (recommended)

### 4. External Services Ready

- [ ] PostgreSQL database accessible
  - [ ] Database: arc_saas (control plane)
  - [ ] Database: postgres (supabase)
  - [ ] Database: components_v2 (CNS)
  - [ ] Database: backstage (if using backstage)
  - [ ] Database: temporal (workflow engine)
- [ ] Redis instance accessible
- [ ] RabbitMQ instance accessible
- [ ] MinIO/S3 storage accessible
- [ ] MongoDB instance (for Novu, if self-hosting)
- [ ] Elasticsearch (for Temporal visibility, optional)

### 5. DNS Configuration

- [ ] DNS records created for ingresses:
  - [ ] Development: *.ananta.local (local testing) OR *.dev.ananta.io
  - [ ] Staging: *.staging.ananta.io
  - [ ] Production: *.ananta.io
- [ ] Wildcard certificate available OR cert-manager configured

### 6. Secrets Prepared

Create all required secrets before deployment.

#### Control Plane Secrets

- [ ] tenant-management-secrets
  ```bash
  kubectl create secret generic tenant-management-secrets \
    --namespace ananta-dev \
    --from-literal=db-user=postgres \
    --from-literal=db-password=<DB_PASSWORD> \
    --from-literal=redis-password=<REDIS_PASSWORD> \
    --from-literal=jwt-secret=<JWT_SECRET> \
    --from-literal=keycloak-client-secret=<KEYCLOAK_SECRET> \
    --from-literal=novu-api-key=<NOVU_KEY>
  ```

- [ ] temporal-worker-secrets
  ```bash
  kubectl create secret generic temporal-worker-secrets \
    --namespace ananta-dev \
    --from-literal=db-user=postgres \
    --from-literal=db-password=<DB_PASSWORD> \
    --from-literal=keycloak-admin-password=<KEYCLOAK_ADMIN_PASSWORD>
  ```

- [ ] subscription-secrets
  ```bash
  kubectl create secret generic subscription-secrets \
    --namespace ananta-dev \
    --from-literal=db-user=postgres \
    --from-literal=db-password=<DB_PASSWORD> \
    --from-literal=stripe-api-key=<STRIPE_KEY> \
    --from-literal=paddle-api-key=<PADDLE_KEY>
  ```

- [ ] orchestrator-secrets
  ```bash
  kubectl create secret generic orchestrator-secrets \
    --namespace ananta-dev \
    --from-literal=db-user=postgres \
    --from-literal=db-password=<DB_PASSWORD> \
    --from-literal=rabbitmq-password=<RABBITMQ_PASSWORD>
  ```

#### App Plane Secrets

- [ ] cns-service-secrets
  ```bash
  kubectl create secret generic cns-service-secrets \
    --namespace ananta-dev \
    --from-literal=supabase-db-user=postgres \
    --from-literal=supabase-db-password=<SUPABASE_DB_PASSWORD> \
    --from-literal=components-db-user=postgres \
    --from-literal=components-db-password=<COMPONENTS_DB_PASSWORD> \
    --from-literal=redis-password=<REDIS_PASSWORD> \
    --from-literal=rabbitmq-password=<RABBITMQ_PASSWORD>
  ```

- [ ] backstage-secrets (if using backstage)
  ```bash
  kubectl create secret generic backstage-secrets \
    --namespace ananta-dev \
    --from-literal=db-user=postgres \
    --from-literal=db-password=<DB_PASSWORD> \
    --from-literal=github-token=<GITHUB_TOKEN>
  ```

- [ ] audit-logger-secrets
- [ ] middleware-secrets
- [ ] novu-consumer-secrets

#### Infrastructure Secrets

- [ ] temporal-db-secrets
- [ ] temporal-es-secrets (if using Elasticsearch)
- [ ] supabase-db-secrets
- [ ] supabase-jwt-secrets
- [ ] novu-secrets
- [ ] novu-mongodb-secrets
- [ ] novu-redis-secrets

### 7. Image Registry Access

- [ ] Container registry accessible (ghcr.io)
- [ ] Image pull secrets created (if private registry)
  ```bash
  kubectl create secret docker-registry ghcr-secret \
    --namespace ananta-dev \
    --docker-server=ghcr.io \
    --docker-username=<USERNAME> \
    --docker-password=<TOKEN>
  ```

### 8. Network Policies (Optional but Recommended)

- [ ] Network policies configured for:
  - [ ] Database access restrictions
  - [ ] Redis access restrictions
  - [ ] RabbitMQ access restrictions
  - [ ] Inter-service communication

## Installation Steps

### Phase 1: Infrastructure Services

- [ ] Install Temporal
  ```bash
  helm install temporal ./temporal \
    --namespace temporal-system \
    --create-namespace \
    --values ./temporal/values-dev.yaml
  ```

- [ ] Verify Temporal is running
  ```bash
  kubectl get pods -n temporal-system
  ```

- [ ] Install Supabase (if self-hosting)
  ```bash
  helm install supabase ./supabase \
    --namespace database-system \
    --create-namespace \
    --values ./supabase/values-dev.yaml
  ```

- [ ] Install Novu (if self-hosting)
  ```bash
  helm install novu ./novu \
    --namespace ananta-dev \
    --values ./novu/values-dev.yaml
  ```

### Phase 2: Control Plane Services

- [ ] Install tenant-management-service
  ```bash
  helm install tenant-management-service ./tenant-management-service \
    --namespace ananta-dev \
    --values ./tenant-management-service/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Verify tenant-management-service health
  ```bash
  kubectl port-forward -n ananta-dev svc/tenant-management-service 14000:14000
  curl http://localhost:14000/health
  ```

- [ ] Run database migrations
  ```bash
  kubectl exec -n ananta-dev deployment/tenant-management-service -- npm run migrate
  ```

- [ ] Install temporal-worker-service
  ```bash
  helm install temporal-worker-service ./temporal-worker-service \
    --namespace ananta-dev \
    --values ./temporal-worker-service/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Install subscription-service
  ```bash
  helm install subscription-service ./subscription-service \
    --namespace ananta-dev \
    --values ./subscription-service/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Install orchestrator-service
  ```bash
  helm install orchestrator-service ./orchestrator-service \
    --namespace ananta-dev \
    --values ./orchestrator-service/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Install admin-app
  ```bash
  helm install admin-app ./admin-app \
    --namespace ananta-dev \
    --values ./admin-app/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

### Phase 3: App Plane Services

- [ ] Install cns-service
  ```bash
  helm install cns-service ./cns-service \
    --namespace ananta-dev \
    --values ./cns-service/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Run CNS database migrations
  ```bash
  kubectl exec -n ananta-dev deployment/cns-service -- alembic upgrade head
  ```

- [ ] Install customer-portal
  ```bash
  helm install customer-portal ./customer-portal \
    --namespace ananta-dev \
    --values ./customer-portal/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Install cns-dashboard
  ```bash
  helm install cns-dashboard ./cns-dashboard \
    --namespace ananta-dev \
    --values ./cns-dashboard/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Install backstage-portal (optional)
  ```bash
  helm install backstage-portal ./backstage-portal \
    --namespace ananta-dev \
    --values ./backstage-portal/values-dev.yaml \
    --set image.tag=v1.0.0
  ```

- [ ] Install audit-logger
- [ ] Install middleware-api
- [ ] Install novu-consumer

## Post-Installation Verification

### 1. Check All Pods Running

```bash
kubectl get pods -n ananta-dev
```

All pods should be in `Running` state with `READY 1/1` or `2/2`.

### 2. Check Services

```bash
kubectl get svc -n ananta-dev
```

Verify all services have ClusterIP assigned.

### 3. Check Ingresses

```bash
kubectl get ingress -n ananta-dev
```

Verify all ingresses have addresses assigned.

### 4. Test Health Endpoints

- [ ] tenant-management-service: `https://api-dev.ananta.local/health`
- [ ] subscription-service: `https://subscription-dev.ananta.local/health`
- [ ] orchestrator-service: `https://orchestrator-dev.ananta.local/health`
- [ ] cns-service: `https://cns-dev.ananta.local/health`
- [ ] admin-app: `https://admin-dev.ananta.local`
- [ ] customer-portal: `https://portal-dev.ananta.local`

### 5. Check Logs

```bash
# Check for errors in control plane services
kubectl logs -n ananta-dev deployment/tenant-management-service --tail=50
kubectl logs -n ananta-dev deployment/temporal-worker-service --tail=50

# Check for errors in app plane services
kubectl logs -n ananta-dev deployment/cns-service --tail=50
kubectl logs -n ananta-dev deployment/customer-portal --tail=50
```

### 6. Verify Database Connections

```bash
# Test PostgreSQL connection
kubectl run -it --rm psql --image=postgres:15 --restart=Never -- \
  psql -h <DB_HOST> -U postgres -d arc_saas -c "SELECT version();"

# Test Redis connection
kubectl run -it --rm redis --image=redis:7 --restart=Never -- \
  redis-cli -h <REDIS_HOST> ping
```

### 7. Test Temporal Workflows

```bash
# Access Temporal UI
kubectl port-forward -n temporal-system svc/temporal-web 8080:8080

# Open http://localhost:8080 and verify namespace "arc-saas" exists
```

### 8. Test API Functionality

```bash
# Test tenant creation flow
curl -X POST https://api-dev.ananta.local/leads \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "firstName": "Test", "lastName": "User"}'

# Test authentication
curl https://api-dev.ananta.local/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

### 9. Verify Monitoring

- [ ] Prometheus scraping metrics:
  ```bash
  kubectl get servicemonitors -n ananta-dev
  ```

- [ ] Grafana dashboards accessible (if installed)

### 10. Check Autoscaling

```bash
kubectl get hpa -n ananta-dev
```

Verify HPA resources are created and tracking metrics.

## Troubleshooting Checklist

If issues occur:

- [ ] Check pod logs: `kubectl logs -n ananta-dev <pod-name>`
- [ ] Describe pod: `kubectl describe pod -n ananta-dev <pod-name>`
- [ ] Check events: `kubectl get events -n ananta-dev --sort-by='.lastTimestamp'`
- [ ] Verify secrets exist: `kubectl get secrets -n ananta-dev`
- [ ] Test database connectivity
- [ ] Check ingress controller logs
- [ ] Verify DNS resolution
- [ ] Check certificate status: `kubectl get certificates -n ananta-dev`

## Performance Tuning Checklist (Production)

- [ ] Adjust resource limits based on load testing
- [ ] Tune autoscaling thresholds
- [ ] Configure connection pool sizes
- [ ] Enable caching layers
- [ ] Set up CDN for static assets
- [ ] Configure database indexes
- [ ] Enable query caching
- [ ] Set up Redis sentinel/cluster
- [ ] Configure RabbitMQ clustering
- [ ] Enable database read replicas

## Security Hardening Checklist (Production)

- [ ] Enable network policies
- [ ] Use Pod Security Standards (restricted)
- [ ] Scan all container images
- [ ] Rotate all secrets
- [ ] Enable audit logging
- [ ] Set up RBAC properly
- [ ] Use External Secrets Operator
- [ ] Enable mTLS between services (service mesh)
- [ ] Set up WAF rules on ingress
- [ ] Enable DDoS protection
- [ ] Configure rate limiting
- [ ] Set up security scanning (Falco, etc.)

## Backup and Disaster Recovery Checklist

- [ ] Set up automated database backups
- [ ] Test database restore procedure
- [ ] Backup all secrets to secure vault
- [ ] Document recovery procedures
- [ ] Set up cross-region replication
- [ ] Test failover procedures
- [ ] Configure PVC snapshots
- [ ] Set up Velero for cluster backups
- [ ] Document RTO/RPO requirements
- [ ] Create runbooks for common failures

## Sign-Off

- [ ] All services deployed successfully
- [ ] All health checks passing
- [ ] All tests passing
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Team trained on operations
- [ ] Runbooks created
- [ ] On-call rotation established
- [ ] Go-live approval obtained

---

**Deployment Date**: ______________
**Deployed By**: ______________
**Environment**: ______________
**Version**: ______________
