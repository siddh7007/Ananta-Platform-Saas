#!/bin/bash
echo "Testing with identifier: tGSrzvVXp4mm"
curl -v 'http://localhost:13100/v1/widgets/session/initialize' \
  -H 'Content-Type: application/json' \
  -d "{\"applicationIdentifier\":\"tGSrzvVXp4mm\",\"subscriberId\":\"admin\",\"email\":\"admin@arc-saas.local\",\"firstName\":\"Admin\",\"lastName\":\"User\"}" 2>&1 | grep -A 5 "HTTP\|error\|data"
