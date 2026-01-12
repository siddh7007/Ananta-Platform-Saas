// =============================================================================
// Network Module Tests
// =============================================================================
// Tests for AWS VPC and GCP VPC network modules
// =============================================================================

package test

import (
	"fmt"
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// AWS Network Module Tests
// =============================================================================

func TestAWSNetworkModuleBasic(t *testing.T) {
	t.Parallel()
	SkipIfMissingAWSCredentials(t)

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "network/aws")

	options := CreateAWSNetworkOptions(t, config, modulePath, nil)
	defer terraform.Destroy(t, options)

	// Init and apply
	terraform.InitAndApply(t, options)

	// Validate outputs
	vpcID := ValidateOutputNotEmpty(t, options, "vpc_id")
	assert.Contains(t, vpcID, "vpc-", "VPC ID should have correct format")

	// Validate subnets
	publicSubnets := ValidateOutputListLength(t, options, "public_subnet_ids", 2)
	for _, subnet := range publicSubnets {
		assert.Contains(t, subnet, "subnet-", "Public subnet ID should have correct format")
	}

	privateSubnets := ValidateOutputListLength(t, options, "private_subnet_ids", 2)
	for _, subnet := range privateSubnets {
		assert.Contains(t, subnet, "subnet-", "Private subnet ID should have correct format")
	}

	databaseSubnets := ValidateOutputListLength(t, options, "database_subnet_ids", 2)
	for _, subnet := range databaseSubnets {
		assert.Contains(t, subnet, "subnet-", "Database subnet ID should have correct format")
	}

	// Validate subnet groups
	dbSubnetGroup := ValidateOutputNotEmpty(t, options, "db_subnet_group_name")
	assert.Contains(t, dbSubnetGroup, config.UniqueID, "DB subnet group should contain test ID")

	cacheSubnetGroup := ValidateOutputNotEmpty(t, options, "cache_subnet_group_name")
	assert.Contains(t, cacheSubnetGroup, config.UniqueID, "Cache subnet group should contain test ID")
}

func TestAWSNetworkModuleWithNATGateway(t *testing.T) {
	t.Parallel()
	SkipIfMissingAWSCredentials(t)

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "network/aws")

	vars := map[string]interface{}{
		"enable_nat_gateway": true,
		"single_nat_gateway": false, // One per AZ
	}

	options := CreateAWSNetworkOptions(t, config, modulePath, vars)
	defer terraform.Destroy(t, options)

	terraform.InitAndApply(t, options)

	// Validate NAT Gateway IPs (should have 2 for 2 AZs)
	natIPs := ValidateOutputListLength(t, options, "nat_gateway_ips", 2)
	for _, ip := range natIPs {
		assert.NotEmpty(t, ip, "NAT Gateway IP should not be empty")
	}
}

func TestAWSNetworkModuleWithVPCEndpoints(t *testing.T) {
	t.Parallel()
	SkipIfMissingAWSCredentials(t)

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "network/aws")

	vars := map[string]interface{}{
		"enable_vpc_endpoints": true,
	}

	options := CreateAWSNetworkOptions(t, config, modulePath, vars)
	defer terraform.Destroy(t, options)

	terraform.InitAndApply(t, options)

	// Validate VPC Endpoints
	s3Endpoint := ValidateOutputNotEmpty(t, options, "vpc_endpoint_s3_id")
	assert.Contains(t, s3Endpoint, "vpce-", "S3 endpoint should have correct format")

	dynamoEndpoint := ValidateOutputNotEmpty(t, options, "vpc_endpoint_dynamodb_id")
	assert.Contains(t, dynamoEndpoint, "vpce-", "DynamoDB endpoint should have correct format")
}

// =============================================================================
// GCP Network Module Tests
// =============================================================================

func TestGCPNetworkModuleBasic(t *testing.T) {
	t.Parallel()
	SkipIfMissingGCPCredentials(t)

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "network/gcp")

	options := CreateGCPNetworkOptions(t, config, modulePath, nil)
	defer terraform.Destroy(t, options)

	terraform.InitAndApply(t, options)

	// Validate VPC
	vpcID := ValidateOutputNotEmpty(t, options, "vpc_id")
	assert.NotEmpty(t, vpcID, "VPC ID should not be empty")

	vpcName := ValidateOutputNotEmpty(t, options, "vpc_name")
	assert.Contains(t, vpcName, config.UniqueID, "VPC name should contain test ID")

	// Validate subnets
	publicSubnets := terraform.OutputList(t, options, "public_subnet_ids")
	assert.GreaterOrEqual(t, len(publicSubnets), 1, "Should have at least one public subnet")

	privateSubnets := terraform.OutputList(t, options, "private_subnet_ids")
	assert.GreaterOrEqual(t, len(privateSubnets), 1, "Should have at least one private subnet")

	databaseSubnets := terraform.OutputList(t, options, "database_subnet_ids")
	assert.GreaterOrEqual(t, len(databaseSubnets), 1, "Should have at least one database subnet")
}

func TestGCPNetworkModuleWithGKESubnets(t *testing.T) {
	t.Parallel()
	SkipIfMissingGCPCredentials(t)

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "network/gcp")

	vars := map[string]interface{}{
		"create_gke_subnets": true,
	}

	options := CreateGCPNetworkOptions(t, config, modulePath, vars)
	defer terraform.Destroy(t, options)

	terraform.InitAndApply(t, options)

	// Validate GKE subnets
	gkeSubnets := terraform.OutputList(t, options, "gke_subnet_ids")
	assert.GreaterOrEqual(t, len(gkeSubnets), 1, "Should have at least one GKE subnet")

	// Validate pod and service ranges
	podRanges := terraform.OutputMap(t, options, "gke_pod_ranges")
	assert.NotEmpty(t, podRanges, "Should have GKE pod ranges")

	serviceRanges := terraform.OutputMap(t, options, "gke_service_ranges")
	assert.NotEmpty(t, serviceRanges, "Should have GKE service ranges")
}

func TestGCPNetworkModuleWithCloudNAT(t *testing.T) {
	t.Parallel()
	SkipIfMissingGCPCredentials(t)

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "network/gcp")

	vars := map[string]interface{}{
		"enable_nat_gateway": true,
	}

	options := CreateGCPNetworkOptions(t, config, modulePath, vars)
	defer terraform.Destroy(t, options)

	terraform.InitAndApply(t, options)

	// Validate Cloud Router and NAT
	routerIDs := terraform.OutputList(t, options, "router_ids")
	assert.GreaterOrEqual(t, len(routerIDs), 1, "Should have at least one Cloud Router")

	natIDs := terraform.OutputList(t, options, "nat_ids")
	assert.GreaterOrEqual(t, len(natIDs), 1, "Should have at least one Cloud NAT")
}

// =============================================================================
// Cloud-Agnostic Network Module Tests
// =============================================================================

func TestCloudAgnosticNetworkModuleAWS(t *testing.T) {
	t.Parallel()
	SkipIfMissingAWSCredentials(t)

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "network")

	vars := map[string]interface{}{
		"cloud_provider":       "aws",
		"name_prefix":          fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":          "test",
		"vpc_cidr":             "10.98.0.0/16",
		"availability_zones":   []string{config.AWSRegion + "a", config.AWSRegion + "b"},
		"public_subnet_cidrs":  []string{"10.98.1.0/24", "10.98.2.0/24"},
		"private_subnet_cidrs": []string{"10.98.11.0/24", "10.98.12.0/24"},
		"database_subnet_cidrs": []string{"10.98.21.0/24", "10.98.22.0/24"},
		"enable_nat_gateway":   true,
		"single_nat_gateway":   true,
		"enable_vpc_endpoints": false,
		"tags":                 config.Tags,
		"aws_config": map[string]interface{}{
			"region": config.AWSRegion,
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

	defer terraform.Destroy(t, options)
	terraform.InitAndApply(t, options)

	// Validate cloud-agnostic outputs
	vpcID := ValidateOutputNotEmpty(t, options, "vpc_id")
	assert.Contains(t, vpcID, "vpc-", "VPC ID should have AWS format")

	publicSubnets := terraform.OutputList(t, options, "public_subnet_ids")
	assert.Len(t, publicSubnets, 2, "Should have 2 public subnets")

	// Validate consolidated network config
	networkConfig := terraform.OutputMap(t, options, "network_config")
	assert.Equal(t, "aws", networkConfig["provider"], "Provider should be aws")
}

func TestCloudAgnosticNetworkModuleGCP(t *testing.T) {
	t.Parallel()
	SkipIfMissingGCPCredentials(t)

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "network")

	vars := map[string]interface{}{
		"cloud_provider":     "gcp",
		"name_prefix":        fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":        "test",
		"enable_nat_gateway": true,
		"tags":               config.Tags,
		"gcp_config": map[string]interface{}{
			"project_id":         config.GCPProjectID,
			"region":             config.GCPRegion,
			"regions":            []string{config.GCPRegion},
			"vpc_octet":          98,
			"create_gke_subnets": true,
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

	defer terraform.Destroy(t, options)
	terraform.InitAndApply(t, options)

	// Validate cloud-agnostic outputs
	vpcID := ValidateOutputNotEmpty(t, options, "vpc_id")
	assert.NotEmpty(t, vpcID, "VPC ID should not be empty")

	// Validate consolidated network config
	networkConfig := terraform.OutputMap(t, options, "network_config")
	assert.Equal(t, "gcp", networkConfig["provider"], "Provider should be gcp")
}

// =============================================================================
// Unit Tests (Plan Only - No Apply)
// =============================================================================

func TestAWSNetworkModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "network/aws")

	options := CreateAWSNetworkOptions(t, config, modulePath, nil)

	// Only run plan, don't apply
	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains expected resources
	assert.Contains(t, planOutput, "aws_vpc.main", "Plan should create VPC")
	assert.Contains(t, planOutput, "aws_subnet.public", "Plan should create public subnets")
	assert.Contains(t, planOutput, "aws_subnet.private", "Plan should create private subnets")
	assert.Contains(t, planOutput, "aws_subnet.database", "Plan should create database subnets")
}

func TestGCPNetworkModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "network/gcp")

	options := CreateGCPNetworkOptions(t, config, modulePath, nil)

	// Only run plan, don't apply
	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains expected resources
	assert.Contains(t, planOutput, "google_compute_network.main", "Plan should create VPC")
	assert.Contains(t, planOutput, "google_compute_subnetwork.public", "Plan should create public subnets")
	assert.Contains(t, planOutput, "google_compute_subnetwork.private", "Plan should create private subnets")
}
