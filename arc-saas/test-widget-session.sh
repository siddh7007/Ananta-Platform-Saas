#!/bin/bash
curl -s 'http://localhost:13100/v1/widgets/session/initialize' \
  -H 'Content-Type: application/json' \
  -d "{\"applicationIdentifier\":\"6931905380e6f7e26e0ddaad\",\"subscriberId\":\"admin\",\"email\":\"admin@arc-saas.local\",\"firstName\":\"Admin\",\"lastName\":\"User\"}" | jq
