# =============================================================================
# GCP Secrets Module - Secret Manager Implementation
# =============================================================================
# GCP-specific implementation of the cloud-agnostic secrets interface.
# Uses Google Cloud Secret Manager.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  secret_id_prefix = replace("${var.name_prefix}", "-", "_")

  common_labels = merge(var.labels, {
    environment = var.environment
    managed-by  = "terraform"
  })
}

# -----------------------------------------------------------------------------
# Generic Secrets
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "secrets" {
  for_each = var.secrets

  project   = var.project_id
  secret_id = "${local.secret_id_prefix}_${replace(each.key, "-", "_")}"

  labels = merge(local.common_labels, {
    type = "generic"
  })

  replication {
    dynamic "auto" {
      for_each = var.replication_type == "automatic" ? [1] : []
      content {
        dynamic "customer_managed_encryption" {
          for_each = var.kms_key_name != null ? [1] : []
          content {
            kms_key_name = var.kms_key_name
          }
        }
      }
    }

    dynamic "user_managed" {
      for_each = var.replication_type == "user_managed" ? [1] : []
      content {
        dynamic "replicas" {
          for_each = var.replication_locations
          content {
            location = replicas.value
            dynamic "customer_managed_encryption" {
              for_each = var.kms_key_name != null ? [1] : []
              content {
                kms_key_name = var.kms_key_name
              }
            }
          }
        }
      }
    }
  }

  dynamic "rotation" {
    for_each = var.rotation_period != null ? [1] : []
    content {
      rotation_period    = var.rotation_period
      next_rotation_time = var.next_rotation_time
    }
  }

  dynamic "topics" {
    for_each = var.notification_topics
    content {
      name = topics.value
    }
  }

  annotations = {
    description = each.value.description
  }
}

resource "google_secret_manager_secret_version" "secrets" {
  for_each = var.secrets

  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = jsonencode(each.value.value)

  enabled = true
}

# -----------------------------------------------------------------------------
# Database Secrets
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "database" {
  for_each = var.database_secrets

  project   = var.project_id
  secret_id = "${local.secret_id_prefix}_db_${replace(each.key, "-", "_")}"

  labels = merge(local.common_labels, {
    type = "database"
  })

  replication {
    dynamic "auto" {
      for_each = var.replication_type == "automatic" ? [1] : []
      content {
        dynamic "customer_managed_encryption" {
          for_each = var.kms_key_name != null ? [1] : []
          content {
            kms_key_name = var.kms_key_name
          }
        }
      }
    }

    dynamic "user_managed" {
      for_each = var.replication_type == "user_managed" ? [1] : []
      content {
        dynamic "replicas" {
          for_each = var.replication_locations
          content {
            location = replicas.value
          }
        }
      }
    }
  }

  annotations = {
    description = "Database credentials for ${each.key}"
  }
}

resource "google_secret_manager_secret_version" "database" {
  for_each = var.database_secrets

  secret = google_secret_manager_secret.database[each.key].id
  secret_data = jsonencode({
    host              = each.value.host
    port              = each.value.port
    database          = each.value.database
    username          = each.value.username
    password          = each.value.password
    engine            = each.value.engine
    connection_string = "${each.value.engine}://${each.value.username}:${each.value.password}@${each.value.host}:${each.value.port}/${each.value.database}"
  })

  enabled = true
}

# -----------------------------------------------------------------------------
# Auto-Generated Secrets
# -----------------------------------------------------------------------------

resource "random_password" "generated" {
  for_each = var.generated_secrets

  length           = each.value.length
  special          = each.value.special
  override_special = each.value.override_special
  upper            = each.value.upper
  lower            = each.value.lower
  numeric          = each.value.numeric
}

resource "google_secret_manager_secret" "generated" {
  for_each = var.generated_secrets

  project   = var.project_id
  secret_id = "${local.secret_id_prefix}_${replace(each.key, "-", "_")}"

  labels = merge(local.common_labels, {
    type      = "generated"
    generated = "true"
  })

  replication {
    dynamic "auto" {
      for_each = var.replication_type == "automatic" ? [1] : []
      content {}
    }

    dynamic "user_managed" {
      for_each = var.replication_type == "user_managed" ? [1] : []
      content {
        dynamic "replicas" {
          for_each = var.replication_locations
          content {
            location = replicas.value
          }
        }
      }
    }
  }

  annotations = {
    description = each.value.description
  }
}

resource "google_secret_manager_secret_version" "generated" {
  for_each = var.generated_secrets

  secret      = google_secret_manager_secret.generated[each.key].id
  secret_data = random_password.generated[each.key].result

  enabled = true
}

# -----------------------------------------------------------------------------
# IAM Bindings
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret_iam_member" "secrets_accessor" {
  for_each = var.accessor_members != null ? toset(var.accessor_members) : []

  project   = var.project_id
  secret_id = google_secret_manager_secret.secrets[keys(var.secrets)[0]].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value
}

# Service account for secret access
resource "google_service_account" "secrets_accessor" {
  count = var.create_accessor_service_account ? 1 : 0

  project      = var.project_id
  account_id   = "${var.name_prefix}-secrets-accessor"
  display_name = "Secrets Accessor for ${var.name_prefix}"
  description  = "Service account for accessing secrets in ${var.environment}"
}

# Grant accessor permissions to all secrets
resource "google_secret_manager_secret_iam_member" "sa_generic_accessor" {
  for_each = var.create_accessor_service_account ? var.secrets : {}

  project   = var.project_id
  secret_id = google_secret_manager_secret.secrets[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.secrets_accessor[0].email}"
}

resource "google_secret_manager_secret_iam_member" "sa_database_accessor" {
  for_each = var.create_accessor_service_account ? var.database_secrets : {}

  project   = var.project_id
  secret_id = google_secret_manager_secret.database[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.secrets_accessor[0].email}"
}

resource "google_secret_manager_secret_iam_member" "sa_generated_accessor" {
  for_each = var.create_accessor_service_account ? var.generated_secrets : {}

  project   = var.project_id
  secret_id = google_secret_manager_secret.generated[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.secrets_accessor[0].email}"
}
