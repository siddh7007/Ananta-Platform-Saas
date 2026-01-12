module github.com/ananta-platform/infrastructure-tests

go 1.21

require (
	github.com/gruntwork-io/terratest v0.46.8
	github.com/stretchr/testify v1.8.4
	github.com/aws/aws-sdk-go-v2 v1.24.0
	github.com/aws/aws-sdk-go-v2/config v1.26.1
	github.com/aws/aws-sdk-go-v2/service/ec2 v1.142.0
	github.com/aws/aws-sdk-go-v2/service/ecs v1.35.0
	github.com/aws/aws-sdk-go-v2/service/rds v1.64.0
	github.com/aws/aws-sdk-go-v2/service/elasticache v1.34.0
	github.com/aws/aws-sdk-go-v2/service/secretsmanager v1.25.0
	google.golang.org/api v0.154.0
	k8s.io/client-go v0.29.0
	k8s.io/api v0.29.0
	k8s.io/apimachinery v0.29.0
)
