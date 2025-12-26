package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// TestTerraformBasicExample demonstrates a basic Terratest pattern
func TestTerraformBasicExample(t *testing.T) {
	t.Parallel()

	// Configure Terraform options
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		// Path to the Terraform code that will be tested
		TerraformDir: "../",

		// Variables to pass to Terraform
		Vars: map[string]interface{}{
			"environment": "test",
			"project":     "ananta-platform",
		},

		// Use dev.tfvars for testing
		VarFiles: []string{"environments/dev.tfvars"},

		// Disable colors in Terraform commands for easier reading of test output
		NoColor: true,
	})

	// Clean up resources with "terraform destroy" at the end of the test
	defer terraform.Destroy(t, terraformOptions)

	// Run "terraform init" and "terraform apply"
	// Fail the test if there are any errors
	terraform.InitAndApply(t, terraformOptions)

	// Validate outputs
	// Example: Verify that the VPC ID output is not empty
	// vpcID := terraform.Output(t, terraformOptions, "vpc_id")
	// assert.NotEmpty(t, vpcID, "VPC ID should not be empty")
}

// TestTerraformModuleValidation tests individual module validation
func TestTerraformModuleValidation(t *testing.T) {
	t.Parallel()

	modules := []string{
		"../modules/vpc",
		"../modules/eks",
		"../modules/rds",
		// Add more modules as needed
	}

	for _, modulePath := range modules {
		t.Run(modulePath, func(t *testing.T) {
			terraformOptions := &terraform.Options{
				TerraformDir: modulePath,
				NoColor:      true,
			}

			// Validate the module
			err := terraform.InitE(t, terraformOptions)
			assert.NoError(t, err, "Terraform init should succeed")

			err = terraform.ValidateE(t, terraformOptions)
			assert.NoError(t, err, "Terraform validate should succeed")
		})
	}
}

// TestTerraformPlanNoErrors ensures terraform plan runs without errors
func TestTerraformPlanNoErrors(t *testing.T) {
	t.Parallel()

	terraformOptions := &terraform.Options{
		TerraformDir: "../",
		VarFiles:     []string{"environments/dev.tfvars"},
		NoColor:      true,
		PlanFilePath: "./terraform.plan",
	}

	// Run terraform init
	terraform.Init(t, terraformOptions)

	// Run terraform plan and capture the output
	planExitCode := terraform.PlanExitCode(t, terraformOptions)

	// Exit code 0 means no changes, 2 means changes present
	// Both are acceptable - we just want to ensure no errors (exit code 1)
	assert.Contains(t, []int{0, 2}, planExitCode,
		"Terraform plan should succeed with exit code 0 or 2")
}
