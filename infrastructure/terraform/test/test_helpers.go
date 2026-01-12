// =============================================================================
// Terratest Helper Functions
// =============================================================================
// Common utilities for Terraform module testing across AWS, GCP, and Kubernetes
// =============================================================================

package test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/terraform"
	test_structure "github.com/gruntwork-io/terratest/modules/test-structure"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Constants
// =============================================================================

const (
	// Default timeouts
	DefaultApplyTimeout   = 30 * time.Minute
	DefaultDestroyTimeout = 30 * time.Minute

	// Test prefixes
	TestPrefix = "terratest"

	// AWS regions for testing
	DefaultAWSRegion = "us-east-1"

	// GCP regions for testing
	DefaultGCPRegion  = "us-central1"
	DefaultGCPProject = "" // Set via TF_VAR_project_id or GCP_PROJECT_ID env var

	// Kubernetes
	DefaultK8sNamespace = "terratest"
)

// =============================================================================
// Test Configuration
// =============================================================================

// TestConfig holds common test configuration
type TestConfig struct {
	UniqueID       string
	AWSRegion      string
	GCPRegion      string
	GCPProjectID   string
	K8sNamespace   string
	Tags           map[string]string
	SkipCleanup    bool
	ModulesRootDir string
}

// NewTestConfig creates a new test configuration with defaults
func NewTestConfig(t *testing.T) *TestConfig {
	uniqueID := strings.ToLower(random.UniqueId())

	return &TestConfig{
		UniqueID:       uniqueID,
		AWSRegion:      getEnvOrDefault("AWS_DEFAULT_REGION", DefaultAWSRegion),
		GCPRegion:      getEnvOrDefault("GCP_REGION", DefaultGCPRegion),
		GCPProjectID:   getEnvOrDefault("GCP_PROJECT_ID", getEnvOrDefault("TF_VAR_project_id", DefaultGCPProject)),
		K8sNamespace:   fmt.Sprintf("%s-%s", DefaultK8sNamespace, uniqueID),
		SkipCleanup:    os.Getenv("SKIP_CLEANUP") == "true",
		ModulesRootDir: getModulesRootDir(),
		Tags: map[string]string{
			"Environment": "test",
			"ManagedBy":   "terratest",
			"TestID":      uniqueID,
		},
	}
}

// =============================================================================
// Terraform Options Builders
// =============================================================================

// CreateAWSNetworkOptions creates Terraform options for AWS network module testing
func CreateAWSNetworkOptions(t *testing.T, config *TestConfig, modulePath string, vars map[string]interface{}) *terraform.Options {
	defaultVars := map[string]interface{}{
		"name_prefix":        fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"vpc_cidr":           "10.99.0.0/16",
		"availability_zones": []string{config.AWSRegion + "a", config.AWSRegion + "b"},
		"public_subnet_cidrs": []string{"10.99.1.0/24", "10.99.2.0/24"},
		"private_subnet_cidrs": []string{"10.99.11.0/24", "10.99.12.0/24"},
		"database_subnet_cidrs": []string{"10.99.21.0/24", "10.99.22.0/24"},
		"enable_nat_gateway":   true,
		"single_nat_gateway":   true,
		"enable_vpc_endpoints": false, // Disable to speed up tests
		"aws_region":           config.AWSRegion,
		"tags":                 config.Tags,
	}

	mergedVars := mergeVars(defaultVars, vars)

	return &terraform.Options{
		TerraformDir: modulePath,
		Vars:         mergedVars,
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": config.AWSRegion,
		},
		NoColor: true,
		Logger:  getLogger(t),
	}
}

// CreateGCPNetworkOptions creates Terraform options for GCP network module testing
func CreateGCPNetworkOptions(t *testing.T, config *TestConfig, modulePath string, vars map[string]interface{}) *terraform.Options {
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set, skipping GCP tests")
	}

	defaultVars := map[string]interface{}{
		"name_prefix":            fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":            "test",
		"project_id":             config.GCPProjectID,
		"regions":                []string{config.GCPRegion},
		"vpc_octet":              99,
		"enable_nat_gateway":     true,
		"create_gke_subnets":     true,
		"enable_private_service_access": false, // Faster tests
		"labels":                 config.Tags,
	}

	mergedVars := mergeVars(defaultVars, vars)

	return &terraform.Options{
		TerraformDir: modulePath,
		Vars:         mergedVars,
		EnvVars: map[string]string{
			"GOOGLE_PROJECT": config.GCPProjectID,
			"GOOGLE_REGION":  config.GCPRegion,
		},
		NoColor: true,
		Logger:  getLogger(t),
	}
}

// CreateDatabaseOptions creates Terraform options for database module testing
func CreateDatabaseOptions(t *testing.T, config *TestConfig, provider string, modulePath string, vars map[string]interface{}) *terraform.Options {
	// Generate secure random password
	masterPassword := random.UniqueId()

	defaultVars := map[string]interface{}{
		"name_prefix":    fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":    "test",
		"instance_size":  "micro",
		"engine_version": "15",
		"database_name":  "testdb",
		"master_username": "testuser",
		"master_password": masterPassword,
	}

	mergedVars := mergeVars(defaultVars, vars)

	envVars := map[string]string{}
	if provider == "aws" {
		envVars["AWS_DEFAULT_REGION"] = config.AWSRegion
	} else if provider == "gcp" {
		envVars["GOOGLE_PROJECT"] = config.GCPProjectID
		envVars["GOOGLE_REGION"] = config.GCPRegion
	}

	return &terraform.Options{
		TerraformDir: modulePath,
		Vars:         mergedVars,
		EnvVars:      envVars,
		NoColor:      true,
		Logger:       getLogger(t),
	}
}

// CreateCacheOptions creates Terraform options for cache module testing
func CreateCacheOptions(t *testing.T, config *TestConfig, provider string, modulePath string, vars map[string]interface{}) *terraform.Options {
	defaultVars := map[string]interface{}{
		"name_prefix":       fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":       "test",
		"instance_size":     "micro",
		"engine_version":    "7.0",
		"high_availability": false,
		"replica_count":     0,
	}

	mergedVars := mergeVars(defaultVars, vars)

	envVars := map[string]string{}
	if provider == "aws" {
		envVars["AWS_DEFAULT_REGION"] = config.AWSRegion
	} else if provider == "gcp" {
		envVars["GOOGLE_PROJECT"] = config.GCPProjectID
		envVars["GOOGLE_REGION"] = config.GCPRegion
	}

	return &terraform.Options{
		TerraformDir: modulePath,
		Vars:         mergedVars,
		EnvVars:      envVars,
		NoColor:      true,
		Logger:       getLogger(t),
	}
}

// CreateComputeOptions creates Terraform options for compute module testing
func CreateComputeOptions(t *testing.T, config *TestConfig, provider string, modulePath string, vars map[string]interface{}) *terraform.Options {
	defaultVars := map[string]interface{}{
		"name_prefix":   fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":   "test",
		"cluster_size":  "small",
	}

	mergedVars := mergeVars(defaultVars, vars)

	envVars := map[string]string{}
	if provider == "aws" {
		envVars["AWS_DEFAULT_REGION"] = config.AWSRegion
	} else if provider == "gcp" {
		envVars["GOOGLE_PROJECT"] = config.GCPProjectID
		envVars["GOOGLE_REGION"] = config.GCPRegion
	}

	return &terraform.Options{
		TerraformDir: modulePath,
		Vars:         mergedVars,
		EnvVars:      envVars,
		NoColor:      true,
		Logger:       getLogger(t),
	}
}

// CreateSecretsOptions creates Terraform options for secrets module testing
func CreateSecretsOptions(t *testing.T, config *TestConfig, provider string, modulePath string, vars map[string]interface{}) *terraform.Options {
	defaultVars := map[string]interface{}{
		"name_prefix": fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment": "test",
		"secrets": map[string]interface{}{
			"test-secret": map[string]interface{}{
				"description": "Test secret for Terratest",
				"value":       map[string]string{"key": "test-value"},
			},
		},
	}

	mergedVars := mergeVars(defaultVars, vars)

	envVars := map[string]string{}
	if provider == "aws" {
		envVars["AWS_DEFAULT_REGION"] = config.AWSRegion
	} else if provider == "gcp" {
		envVars["GOOGLE_PROJECT"] = config.GCPProjectID
		envVars["GOOGLE_REGION"] = config.GCPRegion
	}

	return &terraform.Options{
		TerraformDir: modulePath,
		Vars:         mergedVars,
		EnvVars:      envVars,
		NoColor:      true,
		Logger:       getLogger(t),
	}
}

// =============================================================================
// Test Lifecycle Helpers
// =============================================================================

// RunTerraformTest runs a complete Terraform test lifecycle with stage support
func RunTerraformTest(t *testing.T, options *terraform.Options, testName string, validateFunc func(*testing.T, *terraform.Options)) {
	// CRITICAL FIX: Setup cleanup FIRST - BEFORE any stages run
	// This ensures cleanup runs even if validation or other stages fail
	defer test_structure.RunTestStage(t, "cleanup", func() {
		if os.Getenv("SKIP_CLEANUP") != "true" {
			// Use DestroyE to capture errors instead of panicking
			if err := terraform.DestroyE(t, options); err != nil {
				t.Logf("Error during cleanup in %s: %v", options.TerraformDir, err)
			}
		} else {
			t.Logf("SKIP_CLEANUP=true, resources in %s not destroyed", options.TerraformDir)
		}
	})

	// Stage: Deploy
	test_structure.RunTestStage(t, "deploy", func() {
		terraform.InitAndApply(t, options)
	})

	// Stage: Validate
	test_structure.RunTestStage(t, "validate", func() {
		if validateFunc != nil {
			validateFunc(t, options)
		}
	})
}

// =============================================================================
// Validation Helpers
// =============================================================================

// ValidateOutputNotEmpty ensures a Terraform output is not empty
func ValidateOutputNotEmpty(t *testing.T, options *terraform.Options, outputName string) string {
	output := terraform.Output(t, options, outputName)
	require.NotEmpty(t, output, "Output '%s' should not be empty", outputName)
	return output
}

// ValidateOutputEquals ensures a Terraform output equals expected value
func ValidateOutputEquals(t *testing.T, options *terraform.Options, outputName string, expected string) {
	output := terraform.Output(t, options, outputName)
	require.Equal(t, expected, output, "Output '%s' should equal '%s'", outputName, expected)
}

// ValidateOutputListLength ensures a Terraform output list has expected length
func ValidateOutputListLength(t *testing.T, options *terraform.Options, outputName string, expectedLen int) []string {
	output := terraform.OutputList(t, options, outputName)
	require.Len(t, output, expectedLen, "Output '%s' should have %d items", outputName, expectedLen)
	return output
}

// ValidateOutputMapHasKey ensures a Terraform output map contains a key
func ValidateOutputMapHasKey(t *testing.T, options *terraform.Options, outputName string, key string) map[string]string {
	output := terraform.OutputMap(t, options, outputName)
	_, exists := output[key]
	require.True(t, exists, "Output map '%s' should contain key '%s'", outputName, key)
	return output
}

// =============================================================================
// Utility Functions
// =============================================================================

// getEnvOrDefault returns environment variable value or default
func getEnvOrDefault(envVar, defaultValue string) string {
	if value := os.Getenv(envVar); value != "" {
		return value
	}
	return defaultValue
}

// getModulesRootDir returns the root directory of Terraform modules
func getModulesRootDir() string {
	// Find the modules directory relative to test directory
	testDir, err := os.Getwd()
	if err != nil {
		return "../modules"
	}
	return filepath.Join(testDir, "..", "modules")
}

// mergeVars merges two variable maps, with overrides taking precedence
func mergeVars(defaults, overrides map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range defaults {
		result[k] = v
	}
	for k, v := range overrides {
		result[k] = v
	}
	return result
}

// GetModulePath returns the full path to a module
func GetModulePath(modulesRoot, moduleName string) string {
	return filepath.Join(modulesRoot, moduleName)
}

// SkipIfMissingEnvVar skips test if required environment variable is not set
func SkipIfMissingEnvVar(t *testing.T, envVar string) {
	if os.Getenv(envVar) == "" {
		t.Skipf("Required environment variable %s not set, skipping test", envVar)
	}
}

// SkipIfMissingAWSCredentials skips test if AWS credentials are not configured
func SkipIfMissingAWSCredentials(t *testing.T) {
	if os.Getenv("AWS_ACCESS_KEY_ID") == "" && os.Getenv("AWS_PROFILE") == "" && os.Getenv("AWS_ROLE_ARN") == "" {
		t.Skip("AWS credentials not configured, skipping AWS tests")
	}
}

// SkipIfMissingGCPCredentials skips test if GCP credentials are not configured
func SkipIfMissingGCPCredentials(t *testing.T) {
	if os.Getenv("GOOGLE_APPLICATION_CREDENTIALS") == "" && os.Getenv("GOOGLE_CREDENTIALS") == "" {
		t.Skip("GCP credentials not configured, skipping GCP tests")
	}
}

// getLogger returns conditional logger based on environment variables
func getLogger(t *testing.T) *logger.Logger {
	if os.Getenv("TF_LOG") == "1" || os.Getenv("TERRATEST_LOG") == "1" {
		return logger.Default
	}
	return logger.Discard
}

// WaitForResource waits for a condition to be true with timeout
// Returns error instead of calling t.Fatalf to allow recovery
func WaitForResource(t *testing.T, timeout time.Duration, checkFunc func() bool, description string) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// CRITICAL FIX: Check immediately first before starting ticker
	if checkFunc() {
		return nil
	}

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for %s", description)
		case <-ticker.C:
			// Add error handling with recovery
			func() {
				defer func() {
					if r := recover(); r != nil {
						t.Logf("Panic during resource check for %s: %v", description, r)
					}
				}()

				if checkFunc() {
					cancel() // Signal success
				} else {
					t.Logf("Still waiting for %s...", description)
				}
			}()

			// Check if context was cancelled (success case)
			if ctx.Err() == context.Canceled {
				return nil
			}
		}
	}
}
