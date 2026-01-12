# =============================================================================
# Novu Module Outputs
# =============================================================================

output "namespace" {
  description = "Novu namespace"
  value       = kubernetes_namespace.notifications.metadata[0].name
}

output "mongodb_host" {
  description = "MongoDB host"
  value       = "novu-mongodb.${kubernetes_namespace.notifications.metadata[0].name}.svc.cluster.local"
}

output "redis_host" {
  description = "Redis host"
  value       = "novu-redis-master.${kubernetes_namespace.notifications.metadata[0].name}.svc.cluster.local"
}

output "api_endpoint" {
  description = "Novu API internal endpoint"
  value       = "http://novu-api.${kubernetes_namespace.notifications.metadata[0].name}.svc.cluster.local:3000"
}

output "ws_endpoint" {
  description = "Novu WebSocket internal endpoint"
  value       = "ws://novu-ws.${kubernetes_namespace.notifications.metadata[0].name}.svc.cluster.local:3002"
}

output "web_endpoint" {
  description = "Novu Web internal endpoint"
  value       = "http://novu-web.${kubernetes_namespace.notifications.metadata[0].name}.svc.cluster.local:4200"
}
