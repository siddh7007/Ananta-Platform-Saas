# Variables for basic migrations example

variable "control_plane_db_user" {
  description = "Control Plane PostgreSQL user"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "control_plane_db_password" {
  description = "Control Plane PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "supabase_db_user" {
  description = "Supabase PostgreSQL user"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "supabase_db_password" {
  description = "Supabase PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "components_v2_db_user" {
  description = "Components-V2 PostgreSQL user"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "components_v2_db_password" {
  description = "Components-V2 PostgreSQL password"
  type        = string
  sensitive   = true
}
