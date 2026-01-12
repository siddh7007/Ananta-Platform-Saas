// =============================================================================
// Cache and Secrets Module Tests
// =============================================================================
// Tests for Redis cache and secrets management modules
// =============================================================================

package test

import (
	"fmt"
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// AWS ElastiCache Tests
// =============================================================================

func TestAWSCacheModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "cache/aws")

	vars := map[string]interface{}{
		"name_prefix":       fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":       "test",
		"instance_size":     "micro",
		"engine_version":    "7.0",
		"high_availability": false,
		"replica_count":     0,
		"vpc_id":            "vpc-12345678",
		"subnet_ids":        []string{"subnet-1", "subnet-2"},
		"tags":              config.Tags,
	}

	options := CreateCacheOptions(t, config, "aws", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "aws_elasticache_replication_group", "Plan should create ElastiCache replication group")
}

func TestAWSCacheModuleWithHA(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "cache/aws")

	vars := map[string]interface{}{
		"name_prefix":       fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":       "test",
		"instance_size":     "small",
		"engine_version":    "7.0",
		"high_availability": true,
		"replica_count":     2,
		"vpc_id":            "vpc-12345678",
		"subnet_ids":        []string{"subnet-1", "subnet-2", "subnet-3"},
		"tags":              config.Tags,
	}

	options := CreateCacheOptions(t, config, "aws", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "aws_elasticache_replication_group", "Plan should create ElastiCache replication group")
	assert.Contains(t, planOutput, "automatic_failover_enabled", "Plan should enable automatic failover")
}

// =============================================================================
// GCP Memorystore Tests
// =============================================================================

func TestGCPCacheModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "cache/gcp")

	vars := map[string]interface{}{
		"name_prefix":       fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":       "test",
		"project_id":        config.GCPProjectID,
		"region":            config.GCPRegion,
		"instance_size":     "micro",
		"engine_version":    "7.0",
		"high_availability": false,
		"vpc_network_id":    fmt.Sprintf("projects/%s/global/networks/test-vpc", config.GCPProjectID),
		"labels":            config.Tags,
	}

	options := CreateCacheOptions(t, config, "gcp", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "google_redis_instance", "Plan should create Memorystore instance")
}

func TestGCPCacheModuleWithHA(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "cache/gcp")

	vars := map[string]interface{}{
		"name_prefix":       fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":       "test",
		"project_id":        config.GCPProjectID,
		"region":            config.GCPRegion,
		"instance_size":     "small",
		"engine_version":    "7.0",
		"high_availability": true,
		"replica_count":     2,
		"vpc_network_id":    fmt.Sprintf("projects/%s/global/networks/test-vpc", config.GCPProjectID),
		"labels":            config.Tags,
	}

	options := CreateCacheOptions(t, config, "gcp", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "google_redis_instance", "Plan should create Memorystore instance")
	assert.Contains(t, planOutput, "STANDARD_HA", "Plan should use HA tier")
}

// =============================================================================
// Cloud-Agnostic Cache Tests
// =============================================================================

func TestCloudAgnosticCacheModuleAWS(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "cache")

	vars := map[string]interface{}{
		"cloud_provider":    "aws",
		"name_prefix":       fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":       "test",
		"instance_size":     "micro",
		"engine_version":    "7.0",
		"high_availability": false,
		"tags":              config.Tags,
		"aws_config": map[string]interface{}{
			"vpc_id":     "vpc-12345678",
			"subnet_ids": []string{"subnet-1", "subnet-2"},
		},
	}

	options := &terraform.Options{
		TerraformDir: modulePath,
		Vars:         vars,
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": config.AWSRegion,
		},
		NoColor: true,
	}

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "module.aws", "Plan should use AWS module")
}

func TestCloudAgnosticCacheModuleGCP(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "cache")

	vars := map[string]interface{}{
		"cloud_provider":    "gcp",
		"name_prefix":       fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":       "test",
		"instance_size":     "micro",
		"engine_version":    "7.0",
		"high_availability": false,
		"tags":              config.Tags,
		"gcp_config": map[string]interface{}{
			"project_id":     config.GCPProjectID,
			"region":         config.GCPRegion,
			"vpc_network_id": fmt.Sprintf("projects/%s/global/networks/test-vpc", config.GCPProjectID),
		},
	}

	options := &terraform.Options{
		TerraformDir: modulePath,
		Vars:         vars,
		EnvVars: map[string]string{
			"GOOGLE_PROJECT": config.GCPProjectID,
			"GOOGLE_REGION":  config.GCPRegion,
		},
		NoColor: true,
	}

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "module.gcp", "Plan should use GCP module")
}

// =============================================================================
// AWS Secrets Manager Tests
// =============================================================================

func TestAWSSecretsModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "secrets/aws")

	vars := map[string]interface{}{
		"name_prefix": fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment": "test",
		"secrets": map[string]interface{}{
			"test-secret": map[string]interface{}{
				"description": "Test secret",
				"value": map[string]string{
					"username": "testuser",
					"password": "testpass",
				},
			},
		},
		"tags": config.Tags,
	}

	options := CreateSecretsOptions(t, config, "aws", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "aws_secretsmanager_secret", "Plan should create secret")
}

func TestAWSSecretsModuleWithDatabaseCredentials(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "secrets/aws")

	vars := map[string]interface{}{
		"name_prefix": fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment": "test",
		"database_secrets": map[string]interface{}{
			"control-plane-db": map[string]interface{}{
				"host":     "db.example.com",
				"port":     5432,
				"database": "control_plane",
				"username": "admin",
				"password": "secretpass",
				"engine":   "postgresql",
			},
		},
		"tags": config.Tags,
	}

	options := CreateSecretsOptions(t, config, "aws", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "aws_secretsmanager_secret", "Plan should create database secret")
}

// =============================================================================
// GCP Secret Manager Tests
// =============================================================================

func TestGCPSecretsModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "secrets/gcp")

	vars := map[string]interface{}{
		"name_prefix": fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment": "test",
		"project_id":  config.GCPProjectID,
		"secrets": map[string]interface{}{
			"test-secret": map[string]interface{}{
				"description": "Test secret",
				"value": map[string]string{
					"username": "testuser",
					"password": "testpass",
				},
			},
		},
		"labels": config.Tags,
	}

	options := CreateSecretsOptions(t, config, "gcp", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "google_secret_manager_secret", "Plan should create secret")
}

func TestGCPSecretsModuleWithDatabaseCredentials(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "secrets/gcp")

	vars := map[string]interface{}{
		"name_prefix": fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment": "test",
		"project_id":  config.GCPProjectID,
		"database_secrets": map[string]interface{}{
			"control-plane-db": map[string]interface{}{
				"host":     "db.example.com",
				"port":     5432,
				"database": "control_plane",
				"username": "admin",
				"password": "secretpass",
				"engine":   "postgresql",
			},
		},
		"labels": config.Tags,
	}

	options := CreateSecretsOptions(t, config, "gcp", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "google_secret_manager_secret.database", "Plan should create database secret")
}

// =============================================================================
// Cloud-Agnostic Secrets Tests
// =============================================================================

func TestCloudAgnosticSecretsModuleAWS(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "secrets")

	vars := map[string]interface{}{
		"cloud_provider": "aws",
		"name_prefix":    fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":    "test",
		"secrets": map[string]interface{}{
			"test-secret": map[string]interface{}{
				"description": "Test secret",
				"value": map[string]string{
					"key": "value",
				},
			},
		},
		"tags": config.Tags,
	}

	options := &terraform.Options{
		TerraformDir: modulePath,
		Vars:         vars,
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": config.AWSRegion,
		},
		NoColor: true,
	}

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "module.aws", "Plan should use AWS module")
}

func TestCloudAgnosticSecretsModuleGCP(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "secrets")

	vars := map[string]interface{}{
		"cloud_provider": "gcp",
		"name_prefix":    fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":    "test",
		"secrets": map[string]interface{}{
			"test-secret": map[string]interface{}{
				"description": "Test secret",
				"value": map[string]string{
					"key": "value",
				},
			},
		},
		"tags": config.Tags,
		"gcp_config": map[string]interface{}{
			"project_id": config.GCPProjectID,
		},
	}

	options := &terraform.Options{
		TerraformDir: modulePath,
		Vars:         vars,
		EnvVars: map[string]string{
			"GOOGLE_PROJECT": config.GCPProjectID,
		},
		NoColor: true,
	}

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	assert.Contains(t, planOutput, "module.gcp", "Plan should use GCP module")
}
