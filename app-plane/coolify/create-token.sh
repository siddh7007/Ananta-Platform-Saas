#!/bin/bash
# Generate a random token and its hash
PLAIN_TOKEN=$(openssl rand -hex 32)
HASHED_TOKEN=$(echo -n "$PLAIN_TOKEN" | sha256sum | cut -d' ' -f1)

echo "Plain token for .mcp.json: 1|$PLAIN_TOKEN"

# Insert the token
docker exec coolify-db psql -U coolify -d coolify -c "
INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, token, team_id, abilities, created_at, updated_at)
VALUES ('App\Models\User', 1, 'API Token', '$HASHED_TOKEN', '0', '[\"*\"]', NOW(), NOW());
"