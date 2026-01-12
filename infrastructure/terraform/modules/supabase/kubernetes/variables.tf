variable "namespace" { type = string; default = "app-plane" }
variable "labels" { type = map(string); default = {} }
variable "service_type" { type = string; default = "NodePort" }
variable "postgrest_version" { type = string; default = "v11.2.2" }
variable "meta_version" { type = string; default = "v0.74.0" }
variable "studio_version" { type = string; default = "latest" }
variable "db_host" { type = string }
variable "db_password" { type = string; sensitive = true }
variable "jwt_secret" { type = string; sensitive = true }
variable "api_replicas" { type = number; default = 1 }
variable "api_node_port" { type = number; default = 31810 }
variable "studio_node_port" { type = number; default = 31800 }
