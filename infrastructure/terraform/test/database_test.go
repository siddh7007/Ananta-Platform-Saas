// =============================================================================
// Database Module Tests
// =============================================================================
// Tests for AWS RDS, GCP Cloud SQL, and cloud-agnostic database modules
// =============================================================================

package test

import (
	"fmt"
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// AWS RDS Database Tests
// =============================================================================

func TestAWSDatabaseModuleBasic(t *testing.T) {
	t.Parallel()
	SkipIfMissingAWSCredentials(t)

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "database/aws")

	// First create a VPC for the database
	networkPath := GetModulePath(config.ModulesRootDir, "network/aws")
	networkOptions := CreateAWSNetworkOptions(t, config, networkPath, nil)

	defer terraform.Destroy(t, networkOptions)
	terraform.InitAndApply(t, networkOptions)

	vpcID := terraform.Output(t, networkOptions, "vpc_id")
	subnetGroupName := terraform.Output(t, networkOptions, "db_subnet_group_name")

	// Now test the database module
	vars := map[string]interface{}{
		"name_prefix":        fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":        "test",
		"instance_size":      "micro",
		"engine_version":     "15",
		"database_name":      "testdb",
		"master_username":    "testuser",
		"vpc_id":             vpcID,
		"db_subnet_group_name": subnetGroupName,
		"storage_gb":         20,
		"multi_az":           false,
		"backup_retention_days": 1,
		"tags":               config.Tags,
	}

	options := CreateDatabaseOptions(t, config, "aws", modulePath, vars)
	defer terraform.Destroy(t, options)

	terraform.InitAndApply(t, options)

	// Validate outputs
	endpoint := ValidateOutputNotEmpty(t, options, "endpoint")
	assert.NotEmpty(t, endpoint, "Database endpoint should not be empty")

	port := terraform.Output(t, options, "port")
	assert.Equal(t, "5432", port, "PostgreSQL port should be 5432")

	dbName := terraform.Output(t, options, "database_name")
	assert.Equal(t, "testdb", dbName, "Database name should match")
}

func TestAWSDatabaseModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "database/aws")

	vars := map[string]interface{}{
		"name_prefix":          fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":          "test",
		"instance_size":        "micro",
		"engine_version":       "15",
		"database_name":        "testdb",
		"master_username":      "testuser",
		"vpc_id":               "vpc-12345678",
		"db_subnet_group_name": "test-subnet-group",
		"storage_gb":           20,
		"tags":                 config.Tags,
	}

	options := CreateDatabaseOptions(t, config, "aws", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains expected resources
	assert.Contains(t, planOutput, "aws_db_instance", "Plan should create RDS instance")
	assert.Contains(t, planOutput, "aws_security_group", "Plan should create security group")
}

// =============================================================================
// GCP Cloud SQL Database Tests
// =============================================================================

func TestGCPDatabaseModuleBasic(t *testing.T) {
	t.Parallel()
	SkipIfMissingGCPCredentials(t)

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "database/gcp")

	// First create network
	networkPath := GetModulePath(config.ModulesRootDir, "network/gcp")
	networkOptions := CreateGCPNetworkOptions(t, config, networkPath, map[string]interface{}{
		"enable_private_service_access": true,
	})

	defer terraform.Destroy(t, networkOptions)
	terraform.InitAndApply(t, networkOptions)

	vpcID := terraform.Output(t, networkOptions, "vpc_id")

	// Test database module
	vars := map[string]interface{}{
		"name_prefix":      fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":      "test",
		"project_id":       config.GCPProjectID,
		"region":           config.GCPRegion,
		"instance_size":    "micro",
		"engine_version":   "15",
		"database_name":    "testdb",
		"master_username":  "testuser",
		"vpc_network_id":   vpcID,
		"storage_gb":       20,
		"high_availability": false,
		"backup_retention_days": 1,
		"labels":           config.Tags,
	}

	options := CreateDatabaseOptions(t, config, "gcp", modulePath, vars)
	defer terraform.Destroy(t, options)

	terraform.InitAndApply(t, options)

	// Validate outputs
	connectionName := ValidateOutputNotEmpty(t, options, "connection_name")
	assert.Contains(t, connectionName, config.GCPProjectID, "Connection name should contain project ID")

	privateIP := terraform.Output(t, options, "private_ip_address")
	assert.NotEmpty(t, privateIP, "Private IP should not be empty")
}

func TestGCPDatabaseModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "database/gcp")

	vars := map[string]interface{}{
		"name_prefix":      fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":      "test",
		"project_id":       config.GCPProjectID,
		"region":           config.GCPRegion,
		"instance_size":    "micro",
		"engine_version":   "15",
		"database_name":    "testdb",
		"master_username":  "testuser",
		"vpc_network_id":   "projects/test/global/networks/test-vpc",
		"storage_gb":       20,
		"labels":           config.Tags,
	}

	options := CreateDatabaseOptions(t, config, "gcp", modulePath, vars)

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains expected resources
	assert.Contains(t, planOutput, "google_sql_database_instance", "Plan should create Cloud SQL instance")
	assert.Contains(t, planOutput, "google_sql_database", "Plan should create database")
	assert.Contains(t, planOutput, "google_sql_user", "Plan should create user")
}

// =============================================================================
// Cloud-Agnostic Database Tests
// =============================================================================

func TestCloudAgnosticDatabaseModuleAWS(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "database")

	vars := map[string]interface{}{
		"cloud_provider":   "aws",
		"name_prefix":      fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":      "test",
		"instance_size":    "micro",
		"engine_version":   "15",
		"database_name":    "testdb",
		"master_username":  "testuser",
		"tags":             config.Tags,
		"aws_config": map[string]interface{}{
			"vpc_id":               "vpc-12345678",
			"db_subnet_group_name": "test-subnet-group",
			"storage_gb":           20,
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

func TestCloudAgnosticDatabaseModuleGCP(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "database")

	vars := map[string]interface{}{
		"cloud_provider":   "gcp",
		"name_prefix":      fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":      "test",
		"instance_size":    "micro",
		"engine_version":   "15",
		"database_name":    "testdb",
		"master_username":  "testuser",
		"tags":             config.Tags,
		"gcp_config": map[string]interface{}{
			"project_id":     config.GCPProjectID,
			"region":         config.GCPRegion,
			"vpc_network_id": "projects/test/global/networks/test-vpc",
			"storage_gb":     20,
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
