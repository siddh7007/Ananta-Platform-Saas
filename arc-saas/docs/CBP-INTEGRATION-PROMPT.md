# CBP/CNS Integration Prompt (for Claude Agents)

> Goal: Seamlessly integrate the app-plane CBP/CNS apps into `arc-saas` (Ananta SaaS) using the existing platform patterns and the 10-step rhythm from `ARC-SAAS-IMPROVEMENT-PROMPT.md`.

## Context (Read First)
- **Auth:** Keycloak-only OIDC (RS256, PKCE). Client `cbp-frontend`; scopes include `cns-api` so `aud` contains `cns-api`. Realm roles: `analyst < engineer < admin < owner < super_admin`. Validate `iss=https://auth.ananta.com/realms/ananta` and `aud=cns-api` in CNS middleware.
- **Tenant Context:** Always send `X-Tenant-Id`; enforce tenant scoping in DB queries and payload overwrite. `super_admin` is the only cross-tenant bypass and must be audited.
- **Billing:** Centralize through `subscription-service`; migrate Stripe customers/plans there; repoint webhooks/portal; disable CNS Stripe code.
- **Data Plane:** Keep existing CNS databases (same names/count); no database merges or table renames. Only evolve schema as needed to align `tenant_id` with legacy `organization_id` (via `tenant_mapping` legacy_org_id -> platform_tenant_id) and update FKs to platform tenant UUIDs. Do **not** migrate Supabase Storage at this stage; leave storage locations as-is and update only when/if a later storage migration is approved.
- **Staff Tool:** CNS Dashboard is staff-only; restrict to `super_admin`, behind VPN/IP allowlist, with cross-tenant audit logs.
- **Events/Workflows:** Use platform RabbitMQ exchange `platform.events` and Temporal queue `cns-enrichment`; stamp `tenant_id`/`user_id` on every message/task.
- **Secrets/Config:** Deliver Keycloak, JWKS, RabbitMQ, Stripe, TLS via sealed secrets/Vault; forbid inline defaults in manifests.

## 10-Step Integration Checklist
1) **Auth Alignment**
   - Create/verify Keycloak client `cbp-frontend` with scopes including `cns-api`; configure redirect/web origins for prod + local.
   - Enforce `iss` and `aud` validation in `cns-service` middleware; remove Supabase/Auth0 code paths.
   - Frontend `oidc-client-ts` config: `authority=https://auth.ananta.com/realms/ananta`, `redirect_uri=/authentication/callback`, `post_logout_redirect_uri=/login`, `scope=openid profile email roles cns-api`, `automaticSilentRenew=true`.

2) **RBAC & Roles**
   - Seed realm roles (`analyst`, `engineer`, `admin`, `owner`, `super_admin`) and map legacy roles accordingly.
   - Update CNS decorators/guards to the new hierarchy; allow explicit `super_admin` bypass with audit logging.
   - Seed Keycloak composites as needed; ensure `super_admin` is only for staff (CNS Dashboard/admin-app).

3) **Tenant Isolation**
   - Require `X-Tenant-Id` on all CNS endpoints; auto-scope DB queries to tenant_id; prevent payload overrides.
   - In admin/staff flows, allow tenant selection; default to strict single-tenant otherwise.
   - Add middleware + DB session filter; reject requests with missing/mismatched tenant vs token context.

4) **Frontend Rewrite (CBP)**
   - Build `apps/customer-portal` with Refine + Shadcn UI + Vite.
   - Providers: `oidc-client-ts` auth, axios data provider injecting `Authorization` + `X-Tenant-Id` (+ `X-Api-Audience` if needed).
   - Port BOM grid/upload, subscriptions read-only, billing portal link, team management (invites).
   - Route `tenants` -> `/platform/tenants`, `subscriptions` -> `/platform/subscriptions`, `boms` -> `/api/cns/boms` via Traefik/gateway headers.

5) **CNS Dashboard Refactor (Staff)**
   - Keep Next.js or migrate to Refine; enforce Keycloak-only auth; restrict to `super_admin`.
   - Route data via Traefik to CNS API; allow tenant selection; log all cross-tenant reads/writes.
   - Deploy internally (e.g., `admin.cns.ananta.com`) with VPN/IP allowlisting in addition to OIDC.

6) **Billing Cutover**
   - Migrate Stripe customer IDs + plan codes into `subscription-service`; map legacy price IDs to platform plan IDs.
   - Repoint Stripe webhooks to subscription-service; rotate signing secrets; disable legacy endpoints/portal links.
   - Use `tenant_mapping` to align Stripe customers to platform tenants; verify portal links point to subscription-service Customer Portal.

7) **Data & Storage Migration**
   - Map legacy org IDs to tenant UUIDs (tenant_mapping table); update FKs in CNS data.
   - Move Supabase Storage assets (BOM files) to platform S3/MinIO; update references.
   - Verify schema parity: NOT NULL tenant_id, TIMESTAMPTZ timestamps.
   - `tenant_mapping` DDL example: `legacy_org_id VARCHAR PRIMARY KEY, platform_tenant_id UUID, stripe_customer_id VARCHAR, migration_status VARCHAR`.
   - Storage script: list Supabase `boms` bucket -> download -> upload to `cns-boms/{tenant_id}/{file}` -> update DB refs.

8) **Events & Workflows**
   - Define event schema (`tenant_id`, `user_id`, `event`, `payload`); publish to `platform.events`.
   - Propagate tenant_id in Temporal headers/memo; enforce in workers/activities on `cns-enrichment` queue.
   - Reject events without tenant context; add interceptors to set/read tenant in workflows/activities.

9) **Observability & Ops**
   - Add OTel tracing/metrics to `cns-service`; dashboards/alerts for latency, error rate, auth failures, webhook failures, Temporal retries.
   - Keep Grafana/Gateway configs consistent with `arc-saas` conventions.
   - Standardize logs; add alerting for Stripe webhook failures and Keycloak auth errors.

9b) **Notifications (Novu)**
   - Use platform Novu instance for all CBP/CNS notifications (see `ARC-SAAS-IMPROVEMENT-PROMPT.md` Section: Novu Notification Service Configuration).
   - **Novu API:** `http://localhost:13100` | **Dashboard:** `http://localhost:14200`
   - **API Key:** `<your-novu-api-key>` | **App Identifier:** `<your-novu-app-id>`
   - Trigger workflows via Novu API with tenant context in subscriber data:
     ```typescript
     await novu.trigger('user-invitation', {
       to: { subscriberId: userId, email: userEmail },
       payload: { tenantId, tenantName, invitedByName, roleKey, invitationUrl, expiresAt }
     });
     ```
   - Available triggers: `user-invitation`, `tenant-welcome`, `tenant-provisioning-failed`, `payment-failed`, `subscription-created`, `trial-ending-soon`
   - Add CBP-specific workflows via `node arc-saas/create-novu-workflows-api.js` or Novu Dashboard.

10) **Cutover & Backout**
    - Parallel-run plan: DNS toggle + legacy read-only for 72h; success criteria (login, billing portal, tenant scoping, BOM CRUD, webhook reception).
    - Backout steps documented; archive legacy Supabase after acceptance.
    - Disable legacy Stripe webhooks after confirmation; keep a rollback route to legacy DNS during validation.

## CBP Refine App (Parallel Build Plan)
- **Location:** Same container stack as current CBP, but code in a new folder `apps/customer-portal/` (Refine + Shadcn + Vite). Legacy CBP remains untouched until cutover.
- **Auth:** `oidc-client-ts` with Keycloak `cbp-frontend` client; scopes include `cns-api`; PKCE enabled. Configure `redirect_uri=/authentication/callback`, `post_logout_redirect_uri=/login`.
- **Data Provider:** Axios with `Authorization: Bearer`, `X-Tenant-Id` (from tenant selection/token), optional `X-Api-Audience: cns-api`. Routes: `tenants` -> `/platform/tenants`; `subscriptions` -> `/platform/subscriptions`; `boms` -> `/api/cns/boms` via gateway.
- **UI/Features:**
  - BOM Management: Grid/table with upload (react-dropzone + Refine `useImport`), filters, and per-tenant scoping.
  - Billing: Read-only subscription page; “Manage Billing” button hitting subscription-service portal session.
  - Team: Invite/manage via `tenant-management-service` invites.
  - Navigation: MinRole-protected routes using platform role hierarchy.
- **Env/Config:** Reuse existing CBP container env wiring; add `VITE_API_URL`, Keycloak URLs/client ID, and audience headers as needed. Keep ports and Docker setup consistent with current CBP service definitions.
- **Testing:** Add integration tests for auth flow, tenant header injection, BOM CRUD, billing portal link, and role-based navigation.
- **Rollout:** Run new Refine app alongside legacy CBP (separate path/domain) until feature parity is achieved; then switch DNS/ingress. Keep rollback to legacy during validation.

## Guardrails
- No new direct Stripe/Nash/third-party auth paths in CBP/CNS.
- No cross-tenant access without `super_admin` + audit.
- Do not merge without migrations for data, storage, and roles seeded.
- Tests: prefer integration tests for auth, tenant scoping, billing cutover, and BOM flows; include Keycloak controller coverage.

## Migration Details (Reference)
- **User Migration:** Export Supabase/Auth0 users; import to Keycloak (`migrate-users.py`); set `UPDATE_PASSWORD` required action; email campaign for reset; map roles to realm roles.
- **Plan Mapping:** Legacy price IDs -> platform plan IDs (e.g., `price_legacy_basic` -> `plan_basic_v1`); store in subscription-service.
- **Webhook Cutover:** Update Stripe webhooks to subscription-service endpoint; rotate signing secrets; disable legacy CNS webhook handler to avoid double-processing.
- **Gateway Headers:** Document Traefik routes and required headers (`Authorization`, `X-Tenant-Id`, optional `X-Api-Audience`) for platform APIs vs CNS APIs to avoid 401/403 or tenant drift.

## Quick Start Commands (reference)
- `npm run migrate` (tenant-management-service) before hitting new tables.
- `bun test` / `npm test` in `apps/admin-app` and `apps/customer-portal` (when added).
- `npm test -- keycloak-roles.controller.test.ts` (backend).
