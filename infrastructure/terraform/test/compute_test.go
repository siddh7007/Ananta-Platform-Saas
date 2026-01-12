// =============================================================================
// Compute Module Tests
// =============================================================================
// Tests for AWS ECS, GCP GKE, and Kubernetes compute modules
// =============================================================================

package test

import (
	"fmt"
	"os"
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// AWS ECS Compute Tests
// =============================================================================

func TestAWSECSModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "ecs")

	vars := map[string]interface{}{
		"name_prefix":  fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":  "test",
		"vpc_id":       "vpc-12345678",
		"subnet_ids":   []string{"subnet-1", "subnet-2"},
		"tags":         config.Tags,
	}

	options := &terraform.Options{
		TerraformDir: modulePath,
		Vars:         vars,
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": config.AWSRegion,
		},
		NoColor: true,
	}

	// CRITICAL FIX: Add cleanup defer immediately after options creation
	defer func() {
		if os.Getenv("SKIP_CLEANUP") != "true" {
			if err := terraform.DestroyE(t, options); err != nil {
				t.Logf("Error during cleanup: %v", err)
			}
		}
	}()

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains expected resources
	assert.Contains(t, planOutput, "aws_ecs_cluster", "Plan should create ECS cluster")
}

// =============================================================================
// GCP GKE Compute Tests
// =============================================================================

func TestGCPGKEModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "compute/gcp")

	vars := map[string]interface{}{
		"name_prefix":           fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":           "test",
		"project_id":            config.GCPProjectID,
		"region":                config.GCPRegion,
		"vpc_network_id":        fmt.Sprintf("projects/%s/global/networks/test-vpc", config.GCPProjectID),
		"subnet_id":             fmt.Sprintf("projects/%s/regions/%s/subnetworks/test-subnet", config.GCPProjectID, config.GCPRegion),
		"pods_range_name":       "pods",
		"services_range_name":   "services",
		"cluster_size":          "small",
		"enable_private_nodes":  true,
		"master_ipv4_cidr_block": "172.16.0.0/28",
		"release_channel":       "REGULAR",
		"labels":                config.Tags,
	}

	options := CreateComputeOptions(t, config, "gcp", modulePath, vars)

	// CRITICAL FIX: Add cleanup defer immediately after options creation
	defer func() {
		if os.Getenv("SKIP_CLEANUP") != "true" {
			if err := terraform.DestroyE(t, options); err != nil {
				t.Logf("Error during cleanup: %v", err)
			}
		}
	}()

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains expected resources
	assert.Contains(t, planOutput, "google_container_cluster", "Plan should create GKE cluster")
	assert.Contains(t, planOutput, "google_container_node_pool", "Plan should create node pool")
	assert.Contains(t, planOutput, "google_service_account", "Plan should create service account")
}

func TestGCPGKEModuleWithAdditionalNodePools(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	modulePath := GetModulePath(config.ModulesRootDir, "compute/gcp")

	vars := map[string]interface{}{
		"name_prefix":           fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":           "test",
		"project_id":            config.GCPProjectID,
		"region":                config.GCPRegion,
		"vpc_network_id":        fmt.Sprintf("projects/%s/global/networks/test-vpc", config.GCPProjectID),
		"subnet_id":             fmt.Sprintf("projects/%s/regions/%s/subnetworks/test-subnet", config.GCPProjectID, config.GCPRegion),
		"pods_range_name":       "pods",
		"services_range_name":   "services",
		"cluster_size":          "small",
		"enable_private_nodes":  true,
		"master_ipv4_cidr_block": "172.16.0.0/28",
		"additional_node_pools": map[string]interface{}{
			"high-memory": map[string]interface{}{
				"machine_type":   "e2-highmem-4",
				"disk_size_gb":   100,
				"disk_type":      "pd-ssd",
				"min_node_count": 1,
				"max_node_count": 5,
				"auto_upgrade":   true,
				"use_spot":       false,
				"labels": map[string]string{
					"workload-type": "memory-intensive",
				},
				"taints": []map[string]string{
					{
						"key":    "workload",
						"value":  "memory",
						"effect": "NO_SCHEDULE",
					},
				},
			},
		},
		"labels": config.Tags,
	}

	options := CreateComputeOptions(t, config, "gcp", modulePath, vars)

	// CRITICAL FIX: Add cleanup defer immediately after options creation
	defer func() {
		if os.Getenv("SKIP_CLEANUP") != "true" {
			if err := terraform.DestroyE(t, options); err != nil {
				t.Logf("Error during cleanup: %v", err)
			}
		}
	}()

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains additional node pool
	assert.Contains(t, planOutput, "google_container_node_pool.additional", "Plan should create additional node pool")
}

// =============================================================================
// Kubernetes Compute Tests
// =============================================================================

func TestKubernetesComputeModulePlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	modulePath := GetModulePath(config.ModulesRootDir, "compute/kubernetes")

	vars := map[string]interface{}{
		"name_prefix":  fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
		"environment":  "test",
		"namespace":    config.K8sNamespace,
		"instance_size": "small",
		"services": map[string]interface{}{
			"tenant-management-service": map[string]interface{}{
				"image":      "arc-saas/tenant-management-service:latest",
				"component":  "api",
				"replicas":   1,
				"ports": []map[string]interface{}{
					{
						"name":     "http",
						"port":     14000,
						"protocol": "TCP",
					},
				},
				"env_vars": map[string]string{
					"NODE_ENV": "test",
				},
				"create_service":     true,
				"service_type":       "ClusterIP",
				"ingress_enabled":    false,
				"autoscaling_enabled": false,
				"strategy_type":      "RollingUpdate",
				"max_surge":          "25%",
				"max_unavailable":    "25%",
				"liveness_probe": map[string]interface{}{
					"type":                  "http",
					"path":                  "/ping",
					"port":                  14000,
					"scheme":                "HTTP",
					"initial_delay_seconds": 30,
					"period_seconds":        10,
					"timeout_seconds":       5,
					"failure_threshold":     3,
					"success_threshold":     1,
				},
			},
		},
		"labels": config.Tags,
	}

	options := CreateComputeOptions(t, config, "kubernetes", modulePath, vars)

	// CRITICAL FIX: Add cleanup defer immediately after options creation
	defer func() {
		if os.Getenv("SKIP_CLEANUP") != "true" {
			if err := terraform.DestroyE(t, options); err != nil {
				t.Logf("Error during cleanup: %v", err)
			}
		}
	}()

	terraform.Init(t, options)
	planOutput := terraform.Plan(t, options)

	// Validate plan contains expected resources
	assert.Contains(t, planOutput, "kubernetes_deployment", "Plan should create deployment")
	assert.Contains(t, planOutput, "kubernetes_service", "Plan should create service")
}

// =============================================================================
// Integration Tests - Full Stack
// =============================================================================

func TestGCPFullStackPlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)
	if config.GCPProjectID == "" {
		t.Skip("GCP_PROJECT_ID not set")
	}

	// Test that all GCP modules can be planned together
	modules := []string{
		"network/gcp",
		"database/gcp",
		"cache/gcp",
		"secrets/gcp",
		"compute/gcp",
	}

	for _, module := range modules {
		modulePath := GetModulePath(config.ModulesRootDir, module)
		t.Run(module, func(t *testing.T) {
			// Basic vars that should work for validation
			vars := map[string]interface{}{
				"name_prefix":  fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
				"environment":  "test",
				"project_id":   config.GCPProjectID,
				"region":       config.GCPRegion,
				"labels":       config.Tags,
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

			// CRITICAL FIX: Add cleanup defer immediately after options creation
			defer func() {
				if os.Getenv("SKIP_CLEANUP") != "true" {
					if err := terraform.DestroyE(t, options); err != nil {
						t.Logf("Error during cleanup for %s: %v", module, err)
					}
				}
			}()

			// Just validate - don't plan (may need more vars)
			terraform.Init(t, options)
			_, err := terraform.ValidateE(t, options)
			assert.NoError(t, err, "Module %s should validate successfully", module)
		})
	}
}

func TestAWSFullStackPlanOnly(t *testing.T) {
	t.Parallel()

	config := NewTestConfig(t)

	// Test that all AWS modules can be validated
	modules := []string{
		"network/aws",
		"database/aws",
		"cache/aws",
		"secrets/aws",
		"ecs",
	}

	for _, module := range modules {
		modulePath := GetModulePath(config.ModulesRootDir, module)
		t.Run(module, func(t *testing.T) {
			vars := map[string]interface{}{
				"name_prefix": fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
				"environment": "test",
				"tags":        config.Tags,
			}

			options := &terraform.Options{
				TerraformDir: modulePath,
				Vars:         vars,
				EnvVars: map[string]string{
					"AWS_DEFAULT_REGION": config.AWSRegion,
				},
				NoColor: true,
			}

			// CRITICAL FIX: Add cleanup defer immediately after options creation
			defer func() {
				if os.Getenv("SKIP_CLEANUP") != "true" {
					if err := terraform.DestroyE(t, options); err != nil {
						t.Logf("Error during cleanup for %s: %v", module, err)
					}
				}
			}()

			terraform.Init(t, options)
			_, err := terraform.ValidateE(t, options)
			assert.NoError(t, err, "Module %s should validate successfully", module)
		})
	}
}
