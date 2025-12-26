# =============================================================================
# ARC-SaaS Database Module - Cloud-Agnostic
# =============================================================================
# This module provides a cloud-agnostic interface for PostgreSQL databases.
# Actual implementation is selected via the 'provider' variable.
# Supports: aws, gcp, oracle, kubernetes (in-cluster)
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Random Password Generation (Cloud-Agnostic)
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  count   = var.db_password == null ? 1 : 0
  length  = 32
  special = false
}

locals {
  db_password = var.db_password != null ? var.db_password : random_password.db_password[0].result

  # Construct connection string from provided components
  connection_string = var.external_database_url != null ? var.external_database_url : "postgresql://${var.db_username}:${local.db_password}@${var.db_host}:${var.db_port}/${var.db_name}"
}

# -----------------------------------------------------------------------------
# Outputs - Provider-Independent Interface
# -----------------------------------------------------------------------------
# The actual database provisioning happens in provider-specific modules.
# This base module provides common outputs that all providers must supply.
# -----------------------------------------------------------------------------

# For cloud-managed databases, use provider-specific modules in:
# - providers/aws/database
# - providers/gcp/database
# - providers/oracle/database
# - providers/kubernetes/database

# This module serves as the interface contract that all providers implement.
