#!/usr/bin/env python3
"""Simple authenticated API testing"""

import requests
import json

# Test data
TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJIYkxtaGtodXBlLVpyYjlLNmxxaElsX1VUSmRtTE1fQ1prR3poeFBLcXlrIn0.eyJleHAiOjE3NjU3ODM0NzMsImlhdCI6MTc2NTc3OTg3MywianRpIjoiZTllYTU2MjUtMDAxMi00NzU0LTg1MTgtZGM5NTQ2MDE0Y2U2IiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MTgwL3JlYWxtcy9hbmFudGEtc2FhcyIsInN1YiI6IjFkMDdjOTI1LTQ4YmEtNGI0ZS1iMjhmLTY2NTA0MWEwMTJjYSIsInR5cCI6IkJlYXJlciIsImF6cCI6ImFkbWluLWNsaSIsInNlc3Npb25fc3RhdGUiOiJhMzczZjMwYi0yNjY1LTQwZDktOWVjOC1lMDhmOWZjZGYzNGEiLCJhY3IiOiIxIiwic2NvcGUiOiJlbWFpbCBwcm9maWxlIiwic2lkIjoiYTM3M2YzMGItMjY2NS00MGQ5LTllYzgtZTA4ZjlmY2RmMzRhIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJDQlAgQWRtaW4iLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJjYnBhZG1pbiIsImdpdmVuX25hbWUiOiJDQlAiLCJmYW1pbHlfbmFtZSI6IkFkbWluIiwiZW1haWwiOiJhZG1pbkBjYnAubG9jYWwifQ.EOybuVf6gMfp8RgxzoFOt6UbmQjCa0LHmRbzuGO1gcQFPiGBhLa1MjubMyLc34oYOfya217TYC7_6MpkosJgTIhMOk8-m7TlUGEobI6cQnqTjjNVKXxov3-XiH7580Q4krR5nEEezKQYiRJqJ9OXmSXUbd1e5ZSu0HpbI3xUW0LiUpfn87Ap3rWKpLzonmc060uMl9ljs5DfowJv6hpKf3oJkWTlB4dDYz5mlOWwk-f4vOqUnfR8cUvbkNPUCN_eR-3MAmnOKhaB4oAi5mMI2A6XMaFAyAGoAFEuxYFRNSWygAa7Wteod2QiNJ_hi1XhAZp5ahyECttk-A69kGxrGQ"
BOM_ID = "ebea1f29-f1f2-4cf5-9444-10ae56db49ed"
WORKSPACE_ID = "c13f4caa-fee3-4e9b-805c-a8282bfd59ed"

headers = {"Authorization": f"Bearer {TOKEN}"}

print("=" * 70)
print("CNS Authenticated API Testing")
print("=" * 70)
print()

# Test 1: BOM Line Items
print("Test 1: GET /boms/{bom_id}/line_items")
url = f"http://localhost:27200/api/boms/{BOM_ID}/line_items?page=1&page_size=2"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")
print()

# Test 2: Enrichment Status
print("Test 2: GET /boms/{bom_id}/enrichment/status")
url = f"http://localhost:27200/api/boms/{BOM_ID}/enrichment/status"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")
print()

# Test 3: Components
print("Test 3: GET /boms/{bom_id}/components")
url = f"http://localhost:27200/api/boms/{BOM_ID}/components?page=1&page_size=2"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")
print()

# Test 4: Workspace
print("Test 4: GET /workspaces/{workspace_id}")
url = f"http://localhost:27200/api/workspaces/{WORKSPACE_ID}"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")
print()

print("=" * 70)
print("Testing Complete")
print("=" * 70)
