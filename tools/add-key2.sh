#!/bin/bash
TOKEN="2|1mxflVojTi1ILcjT3hZfvDCgVn9GpCkEz6yh5o1Y2484572a"
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/add-key.json \
  "http://localhost:8000/api/v1/security/private-keys"
