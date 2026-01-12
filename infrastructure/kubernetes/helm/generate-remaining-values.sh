#!/bin/bash
# =============================================================================
# Generate values.yaml files for remaining Helm charts
# =============================================================================

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to create basic backend service values
create_backend_values() {
    local service_name=$1
    local port=$2
    local description=$3
    local domain_prefix=$4

    cat > "$BASE_DIR/$service_name/values.yaml" << EOF
# =============================================================================
# $description
# =============================================================================
replicaCount: 2

image:
  repository: ghcr.io/ananta-platform/$service_name
  pullPolicy: IfNotPresent
  tag: ""

fullnameOverride: "$service_name"

serviceAccount:
  create: true

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "$port"
  prometheus.io/path: "/metrics"

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true

service:
  type: ClusterIP
  port: $port
  targetPort: $port

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: ${domain_prefix}.ananta.local
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-tls
      hosts:
        - ${domain_prefix}.ananta.local

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

configMap:
  LOG_LEVEL: info
  NODE_ENV: production
  PORT: "$port"

secrets:
  existingSecret: "${service_name}-secrets"

livenessProbe:
  httpGet:
    path: /health
    port: $port
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: $port
  initialDelaySeconds: 10
  periodSeconds: 5

serviceMonitor:
  enabled: true
  interval: 30s

podDisruptionBudget:
  enabled: true
  minAvailable: 1

volumes:
  - name: tmp
    emptyDir: {}

volumeMounts:
  - name: tmp
    mountPath: /tmp

extraEnv: []
extraEnvFrom: []
initContainers: []
sidecars: []
EOF

    # Dev values
    cat > "$BASE_DIR/$service_name/values-dev.yaml" << EOF
replicaCount: 1
autoscaling:
  enabled: false
ingress:
  hosts:
    - host: ${domain_prefix}-dev.ananta.local
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-dev-tls
      hosts:
        - ${domain_prefix}-dev.ananta.local
configMap:
  LOG_LEVEL: debug
  NODE_ENV: development
podDisruptionBudget:
  enabled: false
EOF

    # Staging values
    cat > "$BASE_DIR/$service_name/values-staging.yaml" << EOF
replicaCount: 2
ingress:
  hosts:
    - host: ${domain_prefix}-staging.ananta.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-staging-tls
      hosts:
        - ${domain_prefix}-staging.ananta.io
EOF

    # Prod values
    cat > "$BASE_DIR/$service_name/values-prod.yaml" << EOF
replicaCount: 3
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 200m
    memory: 512Mi
autoscaling:
  minReplicas: 3
  maxReplicas: 20
ingress:
  hosts:
    - host: ${domain_prefix}.ananta.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-prod-tls
      hosts:
        - ${domain_prefix}.ananta.io
configMap:
  LOG_LEVEL: warn
podDisruptionBudget:
  minAvailable: 2
EOF
}

# Function to create frontend values
create_frontend_values() {
    local service_name=$1
    local description=$2
    local domain_prefix=$3

    cat > "$BASE_DIR/$service_name/values.yaml" << EOF
# =============================================================================
# $description
# =============================================================================
replicaCount: 2

image:
  repository: ghcr.io/ananta-platform/$service_name
  pullPolicy: IfNotPresent
  tag: ""

fullnameOverride: "$service_name"

serviceAccount:
  create: true

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 101
  fsGroup: 101

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true

service:
  type: ClusterIP
  port: 80
  targetPort: 80

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: ${domain_prefix}.ananta.local
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-tls
      hosts:
        - ${domain_prefix}.ananta.local

resources:
  limits:
    cpu: 200m
    memory: 128Mi
  requests:
    cpu: 50m
    memory: 64Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 6
  targetCPUUtilizationPercentage: 70

livenessProbe:
  httpGet:
    path: /health
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 5

podDisruptionBudget:
  enabled: true
  minAvailable: 1

volumes:
  - name: tmp
    emptyDir: {}
  - name: cache
    emptyDir: {}
  - name: run
    emptyDir: {}

volumeMounts:
  - name: tmp
    mountPath: /tmp
  - name: cache
    mountPath: /var/cache/nginx
  - name: run
    mountPath: /var/run

configMap: {}
secrets:
  existingSecret: ""
extraEnv: []
extraEnvFrom: []
initContainers: []
sidecars: []
EOF

    # Dev/Staging/Prod similar to backend
    cat > "$BASE_DIR/$service_name/values-dev.yaml" << EOF
replicaCount: 1
autoscaling:
  enabled: false
ingress:
  hosts:
    - host: ${domain_prefix}-dev.ananta.local
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-dev-tls
      hosts:
        - ${domain_prefix}-dev.ananta.local
podDisruptionBudget:
  enabled: false
EOF

    cat > "$BASE_DIR/$service_name/values-staging.yaml" << EOF
replicaCount: 2
ingress:
  hosts:
    - host: ${domain_prefix}-staging.ananta.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-staging-tls
      hosts:
        - ${domain_prefix}-staging.ananta.io
EOF

    cat > "$BASE_DIR/$service_name/values-prod.yaml" << EOF
replicaCount: 3
resources:
  limits:
    cpu: 300m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi
autoscaling:
  minReplicas: 3
  maxReplicas: 10
ingress:
  hosts:
    - host: ${domain_prefix}.ananta.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${service_name}-prod-tls
      hosts:
        - ${domain_prefix}.ananta.io
podDisruptionBudget:
  minAvailable: 2
EOF
}

echo "Generating values files..."

# Control Plane Services
create_backend_values "subscription-service" "14001" "Subscription and billing management" "subscription"
create_backend_values "orchestrator-service" "14002" "Orchestration service" "orchestrator"

# App Plane Services
create_frontend_values "cns-dashboard" "CNS Admin Dashboard" "cns-dashboard"
create_backend_values "audit-logger" "27300" "Audit logging service" "audit"
create_backend_values "middleware-api" "27350" "Middleware API gateway" "middleware"

echo "All values files generated successfully!"
echo ""
echo "Services with values files:"
ls -1 "$BASE_DIR" | grep -v -E '\.(sh|md)$' | sort
