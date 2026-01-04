# Coolify Full-Platform Deployment

This folder is a Coolify-friendly deployment bundle for the entire Ananta Platform (control plane + app plane + all portals).

## How to deploy in Coolify
1) Create a new **Docker Compose** app.
2) Set the **Compose file path** to `coolify/docker-compose.yml`.
3) Set the **Project root** to the repo root.
4) Add environment variables from `coolify/.env.example` (copy to Coolify envs and replace values).
5) Assign domains in Coolify for each service with `coolify.port` labels (admin, customer, CNS dashboard, Keycloak, etc.).
6) Deploy.

## Notes
- All build contexts are root-relative and will work when Coolify builds from the repo root.
- `depends_on` uses simple service lists to avoid unsupported health conditions in Coolify.
- The `migrate-and-seed` job runs once and writes `/state/migrate-and-seed.done` in the `migrate-seed-state` volume. To re-run, delete that volume in Coolify or remove the file from the job container.
- If you want to disable any service, comment it out in the compose file before deploy.

## Public domain mapping (Coolify)
Assign these in Coolify and set the matching env vars:

| Service | Env var | Example domain |
| --- | --- | --- |
| Keycloak | `KEYCLOAK_URL` / `KEYCLOAK_HOSTNAME` | `https://auth.example.com` |
| Tenant API | `CONTROL_PLANE_API_URL` | `https://api.example.com` |
| CNS API | `CNS_API_URL` | `https://cns.example.com` |
| Django API | `DJANGO_API_URL` | `https://django.example.com` |
| Supabase API | `SUPABASE_API_URL` | `https://supabase.example.com` |
| Novu API | `NOVU_API_URL` | `https://novu-api.example.com` |
| Novu Web | `NOVU_WEB_URL` | `https://novu.example.com` |
| Novu WS | `NOVU_WS_URL` | `wss://novu-ws.example.com` |
| Directus | `DIRECTUS_PUBLIC_URL` | `https://cms.example.com` |
