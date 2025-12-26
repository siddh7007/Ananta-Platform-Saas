# CBP Integration Technical Specification

**Version:** 5.4  
**Status:** Final  
**Date:** December 11, 2025

## 1. Executive Summary
This document specifies the technical changes required to integrate the **Customer BOM Portal (CBP)**, **Component Normalization Service (CNS)**, and the **CNS Dashboard** into the **Arc-SaaS Platform**. The primary goals are to replace legacy Supabase/Auth0 authentication with **Generic OIDC (Keycloak)**, delegate billing to the **Subscription Service**, and enforce platform-native multi-tenancy.

**Strategic Decision:**  
- CBP Frontend will be **rewritten** using **Refine + Shadcn UI** (instead of refactoring the legacy React Admin codebase).  
- CNS Dashboard (staff tool) will be **refactored** to align with platform authentication/authorization and tenant controls.

## 2. Current State Analysis

### 2.1. CBP Frontend (`app-plane/services/customer-portal`)
- **Framework:** React Admin (`react-admin`).
- **Authentication:** Dual-mode (Supabase vs. Auth0) via `SupabaseAuthProvider.tsx` and `Auth0AuthProvider.tsx`; manually parses tokens and keeps local session tied to Supabase GoTrue.
- **Billing:** Uses local `stripeService.ts` calling Stripe and CNS backend directly, bypassing platform billing.
- **Organization Management:** Reads orgs directly from Supabase, bypassing `tenant-management-service`.
- **User Settings:** Profile/security via direct calls to the auth provider.

### 2.2. CNS Backend (`app-plane/services/cns-service`)
- **Authentication:** `auth.py` validates Supabase (HS256) and Auth0 (RS256) with hardcoded logic; no generic JWKS discovery.
- **Database:** “Dual Database” (Supabase for customer data, internal DB for catalog). **Target:** consolidate into platform Postgres.
- **Roles:** `owner`, `admin`, `member`, `viewer` (mismatch with platform).
- **Billing:** `stripe_service.py` and `billing.py` duplicate platform `subscription-service`.
- **Observability:** Custom logging; lacks standard OpenTelemetry instrumentation.

### 2.3. CNS Dashboard (`app-plane/services/dashboard`)
- **Framework:** Next.js + React Admin.
- **Auth:** Hybrid (Auth0 / Keycloak / Supabase); `src/lib/keycloak.ts` exists but is not primary.
- **Purpose:** Staff-only internal catalog/global settings tool.
- **Gap:** No platform tenant integration; direct DB access bypasses new multi-tenancy controls.

## 3. Target Architecture

| Feature            | Current State (Legacy)                       | Target State (Arc-SaaS)                               |
| :----------------- | :------------------------------------------- | :---------------------------------------------------- |
| **Auth Provider**  | Supabase Auth / Auth0 (Hardcoded)            | **Generic OIDC** (Keycloak as single source of truth) |
| **Frontend**       | React Admin                                  | **Refine + Shadcn UI + Tailwind CSS**                 |
| **CNS Dashboard**  | Next.js + Hybrid Auth                        | **Next.js + Keycloak + Platform APIs** (staff only)   |
| **Tenant Context** | Local DB (`organizations`)                   | **Tenant Management Service** via `X-Tenant-Id`       |
| **Roles**          | `member`, `viewer`                           | `analyst < engineer < admin < owner < super_admin`    |
| **Billing**        | Direct Stripe (frontend/backend)             | **Subscription Service** & Billing Portal             |
| **User Profile**   | Supabase `users`                             | **Keycloak** + Platform User Service                  |
| **Notifications**  | Direct Novu / RabbitMQ                       | **Platform Events** (`platform.events` exchange)      |
| **Workflows**      | Temporal (`cns-enrichment`)                  | **Shared Temporal Cluster** (`cns-enrichment` queue)  |
| **API Gateway**    | Direct calls to CNS (`localhost:27800`)      | **Traefik / Platform Gateway**                        |

## 4. Authentication & Authorization (Generic OIDC)

### 4.1. Strategy
- Protocol: OIDC with PKCE.
- Token: JWT (RS256).
- Libraries: `oidc-client-ts` (frontend), `PyJWT` + `cryptography` (backend).
- Provider: Keycloak only (no Auth0 backup).

### 4.2. Configuration
**Keycloak Client Config (cbp-frontend):**
- Client Protocol: `openid-connect`, Access Type: `public`, Standard Flow: ON, Direct Access Grants: OFF.
- Valid Redirect URIs: `https://cbp.ananta.com/authentication/callback`, `http://localhost:5173/authentication/callback`.
- Web Origins: `https://cbp.ananta.com`, `http://localhost:5173`.
- PKCE: S256.
- Client Scopes: include `cns-api` so `aud` contains `cns-api`.

**Frontend Config (`oidc-client-ts`):**
- `authority`: `https://auth.ananta.com/realms/ananta`
- `client_id`: `cbp-frontend`
- `redirect_uri`: `window.location.origin + '/authentication/callback'`
- `post_logout_redirect_uri`: `window.location.origin + '/login'`
- `response_type`: `code`
- `scope`: `openid profile email roles cns-api`
- `automaticSilentRenew`: `true`

### 4.3. Role Mapping (RBAC)
Align to platform hierarchy: `analyst(1) < engineer(2) < admin(3) < owner(4) < super_admin(5)`
- Legacy `viewer` -> `analyst`
- Legacy `member` -> `engineer`
- Legacy `admin` -> `admin`
- Legacy `owner` -> `owner`
- `super_admin` for staff/CNS Dashboard

**Cross-Tenant Access:**  
`super_admin` can access any tenant; log all cross-tenant actions. CNS backend must explicitly allow wildcard access for `super_admin`, otherwise enforce tenant checks.

## 5. Frontend Rewrite Specification (Refine + Shadcn UI)

### 5.1. New Application Structure
- Location: `apps/customer-portal` (new).
- Stack: Refine, Shadcn UI, Tailwind, Vite, TanStack Query.
- Benefit: Consistent with admin-app; better BOM grid performance/customization.

### 5.2. Core Providers
- **Auth Provider (`src/providers/authProvider.ts`):** Implement Refine AuthProvider; use `oidc-client-ts` UserManager for signin/signout; `getPermissions` reads `realm_access.roles`.
- **Data Provider (`src/providers/dataProvider.ts`):** Axios with interceptor to add `Authorization: Bearer <token>` and `X-Tenant-Id` (from tenant selection/token claim). If gateway requires, send `X-Api-Audience: cns-api`.
  - Resources: `tenants` -> `GET /platform/tenants`; `subscriptions` -> `GET /platform/subscriptions`; `boms` -> `GET /api/cns/boms`.

### 5.3. Feature Porting & UI Components
- BOM Management: BOM grid via `useTable` + TanStack Table; “Upload BOM” via `react-dropzone` + Refine `useImport`.
- Billing: Read-only subscription page from `subscription-service`; “Manage Billing” button -> `/platform/subscriptions/portal-session`.
- Org Settings: Team management via `tenant-management-service` (`POST /invites`, etc.).

### 5.4. CNS Dashboard Refactoring (Staff Tool)
- Location: keep `app-plane/services/dashboard` but refactor internals.
- Auth: Use Keycloak only; remove Auth0/Supabase.
- Access Control: `super_admin` (or staff roles) only.
- Data: Point `ra-data-simple-rest` to `https://api.ananta.com/cns` (via Traefik).
- Tenant Context: Staff can select tenant; send `X-Tenant-Id` accordingly.
- Deployment: Internal domain (e.g., `admin.cns.ananta.com`) behind VPN/IP allowlist plus Keycloak.

## 6. Backend Refactoring Specification (`app-plane/services/cns-service`)

### 6.1. Authentication Middleware
- File: `app/auth/auth.py` — implement generic JWKS verifier.
  1. Load JWKS from `AUTH_JWKS_URL`.
  2. Verify RS256 signature.
  3. Validate `iss` = `https://auth.ananta.com/realms/ananta`.
  4. Validate `aud` contains `cns-api` (or configured audience) and `exp`.
- File: `app/auth/dependencies.py` — `get_current_user` returns standardized user from JWT; remove lazy provisioning.
- RBAC: Update decorators to new roles; check `realm_access.roles`. Allow explicit `super_admin` bypass for cross-tenant operations.

### 6.2. Tenant Isolation Enforcement
- Middleware: Require `X-Tenant-Id` (UUID) on every CNS request; store in context.
- DB Scoping: Add `tenant_id` FK on all models; enforce automatic filtering by `tenant_id` on queries (except for `super_admin`). Overwrite request payload `tenant_id` with context value.

### 6.3. Service Cleanup
- Remove `stripe_service.py` and `billing.py` (billing handled by subscription-service).
- Simplify `organization.py`: no org CRUD; read-only context from token/header.

### 6.4. Observability
- Add `opentelemetry-instrumentation-fastapi`; export traces to Jaeger/Tempo.
- Standardize logging/metrics; ship dashboards/alerts (latency, error rate, auth failures, webhook failures, Temporal retries).

### 6.5. Notifications & Workflows
- Notifications: Publish to `platform.events` with routing key `notification.cns.{event}`; payload must include `tenant_id` and `user_id`.
- Workflows (Temporal): Queue `cns-enrichment` (shared). Propagate `tenant_id` via headers/memo; workers/activities must enforce tenant context.

## 7. Infrastructure & Deployment

### 7.1. Helm Charts
- Charts: `charts/cns-service`, `charts/customer-portal`.
- `deployment.yaml`: env for `AUTH_ISSUER`, `TEMPORAL_HOST`, `RABBITMQ_URL`, etc.
- `service.yaml`: expose 8000 (backend), 80 (frontend).
- `ingress.yaml`: route `/api/cns` to backend, `/` to frontend.
- Secrets/Config: Deliver Keycloak client IDs, JWKS URL, RabbitMQ creds, Stripe secrets (during migration), TLS via sealed secrets/Vault; no inline defaults.

### 7.2. Terraform
- Add `cns-service` (DB, IAM roles, DNS).
- Add `customer-portal` infra as needed.

## 8. Data & Billing Migration

### 8.1. Tenant ID Mapping (Critical)
- Legacy org IDs (int/string) -> platform tenant UUIDs.
- Create `tenant_mapping` table:
  ```sql
  CREATE TABLE tenant_mapping (
    legacy_org_id VARCHAR(255) PRIMARY KEY,
    platform_tenant_id UUID NOT NULL,
    stripe_customer_id VARCHAR(255),
    migration_status VARCHAR(50) DEFAULT 'PENDING'
  );
  ```
- Generate UUIDs for all legacy orgs; update all FKs to use `platform_tenant_id`; ensure no duplicate `stripe_customer_id`.

### 8.2. User Migration (Supabase/Auth0 -> Keycloak)
- Export legacy users (email, id, names, roles).
- Import into Keycloak via `migrate-users.py`; set `UPDATE_PASSWORD` required action; send email campaign to reset passwords.
- Map legacy roles to Keycloak realm roles (Section 4.3).

### 8.3. Billing Migration & Plan Mapping
- Export `stripe_customer_id` and legacy plan codes.
- Map legacy price IDs to platform plan IDs (e.g., `price_legacy_basic` -> `plan_basic_v1`).
- Insert/update tenants in subscription-service with mapped `stripe_customer_id` and plan.
- Reconciliation: trigger “Sync with Stripe” to populate subscriptions.

### 8.4. Webhook & Portal Cutover
1. Update Stripe webhook endpoint to subscription-service (e.g., `https://api.ananta.com/api/v1/billing/webhooks`); rotate signing secrets.
2. Ensure subscription-service handles `customer.subscription.updated`, `invoice.paid`, etc.
3. Disable legacy CNS webhook endpoints to prevent double-processing.
4. Portal links: use subscription-service Customer Portal for billing management.

### 8.5. Supabase Storage Migration
- Move BOM files/attachments from Supabase Storage to platform S3/MinIO.
- Script `migrate-storage.ts`:
  1. List files in Supabase `boms` bucket.
  2. Download.
  3. Upload to platform bucket `cns-boms` at `{platform_tenant_id}/{file_name}`.
  4. Update DB references to new S3 URLs.

### 8.6. Schema Parity & Validation
- Enforce NOT NULL on `tenant_id`; ensure TIMESTAMPTZ for timestamps.
- Post-migration validation: row counts, FK integrity between BOMs and tenants, file reference correctness.

## 9. Migration Steps

1. **Database Migration (Supabase -> Platform Postgres):** `pg_dump` Supabase (exclude system schemas), restore to platform Postgres; run Tenant ID mapping; run storage migration; update CNS connection strings.
2. **User Migration:** Run Keycloak import; set `UPDATE_PASSWORD`.
3. **Backend Update:** Deploy CNS auth/roles/tenant enforcement.
4. **Infra:** Configure Traefik routes.
5. **Frontend:** Initialize `apps/customer-portal` (Refine).
6. **Dashboard:** Refactor CNS Dashboard to Keycloak and deploy.
7. **Dev:** Port BOM features to new frontend.
8. **Billing Migration:** Execute billing migration & webhook cutover (Section 8.3/8.4).
9. **Cutover:** Switch DNS to new portal.
10. **Data Cleanup:** Archive legacy Supabase instance.

## 10. Additional Hardening & Open Gaps

1. **Secrets & Config Delivery:** Use sealed secrets/Vault; forbid inline defaults.
2. **JWT Audience Clarity:** Declare/enforce `cns-api` audience; document gateway routing expectations.
3. **Event & Workflow Tenancy:** Enforce message schema with `tenant_id`/`user_id`; reject missing context; ensure Temporal propagation.
4. **Rollback & Parallel-Run Plan:** Maintain 72h backout (DNS toggle + legacy read-only) with success criteria (login, billing portal, tenant scoping, BOM CRUD, webhook reception).
5. **Staff (super_admin) Controls:** Restrict CNS Dashboard to `super_admin`; log all cross-tenant actions; require VPN/IP allowlisting.
6. **Observability:** Dashboards/alerts for CNS and portal; standardized logs/metrics.
7. **Gateway Paths & Headers:** Document Traefik routes and required headers (`Authorization`, `X-Tenant-Id`, optional `X-Api-Audience`) for platform vs. CNS APIs.
8. **Data Validation Post-Migration:** Verification scripts for row counts, FK integrity, file references; block cutover until checks pass.
