output "namespace" { value = local.namespace }
output "jaeger_endpoint" { value = var.enable_jaeger ? "http://jaeger.${local.namespace}:16686" : "" }
