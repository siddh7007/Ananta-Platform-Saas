# Customer Portal (CBP) - Settings and Configuration Report

**Analysis Date:** December 14, 2024
**Location:** `e:\Work\Ananta-Platform-Saas\app-plane\services\customer-portal`

---

## Table of Contents

1. [Settings Overview](#settings-overview)
2. [User Settings](#user-settings)
3. [Organization Settings](#organization-settings)
4. [Alert Preferences](#alert-preferences)
5. [Risk Profile Settings](#risk-profile-settings)
6. [Feature Flags and Toggles](#feature-flags-and-toggles)
7. [Menu Structure](#menu-structure)
8. [Environment Configuration](#environment-configuration)
9. [Authentication Configuration](#authentication-configuration)
10. [Permissions and Access Control](#permissions-and-access-control)

---

## Settings Overview

The Customer Portal provides three main categories of settings:

1. **User-Level Settings** (accessible to all users)
   - Account Settings (Profile, Security, Preferences, Activity)
   - Theme Preferences
   - Alert Preferences

2. **Organization-Level Settings** (admin-only)
   - Organization Profile
   - Security Policies
   - Billing & Subscription
   - API Access & Webhooks
   - Data Retention
   - SSO Configuration

3. **Risk Configuration** (admin-only)
   - Risk Factor Weights
   - Risk Level Thresholds
   - BOM Health Grading
   - Contextual Scoring

---

## User Settings

### 1. Account Settings

**Location:** `src/pages/AccountSettings.tsx`
**Route:** `/account/settings`
**Access:** All authenticated users

#### Tabs Structure

| Tab | Icon | Content | Access |
|-----|------|---------|--------|
| Control Center | Dashboard | Security completeness, onboarding progress | All users |
| Profile | Person | Name, email, avatar, linked accounts | All users |
| Security | Security | Password, MFA, API keys | All users |
| Preferences | Palette | Theme, notifications | All users |
| Activity | History | Login history | All users |
| Danger Zone | Warning | Account deletion | Owner/Admin only |

#### Profile Settings

| Setting | Type | Default | Editable | Description | File Line |
|---------|------|---------|----------|-------------|-----------|
| Full Name | String | - | Yes | User's full name | 740-744 |
| Nickname | String | - | Yes | Optional display name | 748-754 |
| Email | Email | - | No | Managed by identity provider | 728-737 |
| Profile Picture | Image URL | - | Yes (via Auth0) | Avatar image | 710-726 |

#### Security Settings

| Setting | Type | Default | Editable | Description | File Line |
|---------|------|---------|----------|-------------|-----------|
| Password | - | - | Via email reset | Password change via Auth0 | 496-517 |
| MFA Devices | Array | [] | Yes | Two-factor authentication devices | 236-257, 894-967 |
| MFA Enrollment | - | - | Via Auth0 | Add/remove MFA devices | 954-966 |
| API Keys | Array | [] | Yes | User API keys (placeholder) | 154-159, 971-1034 |

**MFA Types Supported:**
- TOTP (Authenticator App)
- SMS
- WebAuthn (Security Key)
- Platform Biometrics

#### Notification Preferences

| Setting | Type | Default | Editable | Description | File Line |
|---------|------|---------|----------|-------------|-----------|
| BOM Completion Notifications | Boolean | true | Yes | Notify when BOM enrichment completes | 214, 1157 |
| Alert Notifications | Boolean | true | Yes | Component alerts | 214, 1165 |
| Email Digest | Boolean | true | Yes | Daily email summary | 214, 1173 |

**Storage:** Auth0 `user_metadata.notifications`

#### Theme Preferences

| Setting | Type | Options | Default | Editable | Description | File Line |
|---------|------|---------|---------|----------|-------------|-----------|
| Theme Mode | Select | light, light-dim, dark-soft, dark | light | Yes | Visual theme | 1052-1087 |

**Theme Options:**

| Theme | Background | Description | Preview |
|-------|-----------|-------------|---------|
| Light | #f9fafb | Clean white background | Standard light mode |
| Light Dim | #f0ede6 | Warm off-white, easier on eyes | Sepia-toned light |
| Dark Soft | #2d3748 | Slate-based dark mode | Softer dark colors |
| Dark | #121212 | Pure dark mode | OLED-friendly black |

**Storage:**
- localStorage: `app_theme`
- Auth0: `user_metadata.theme`

#### Login History

| Field | Type | Description | File Line |
|-------|------|-------------|-----------|
| Event Type | String | Login/logout/failure events | 1256-1259 |
| Date | DateTime | Event timestamp | 1262 |
| IP Address | String | Client IP | 1264 |
| Location | String | City, Country | 1265-1269 |

**Requires:** Auth0 Management API with `read:logs` scope

#### Linked Accounts

| Field | Type | Description | File Line |
|-------|------|-------------|-----------|
| Provider | String | google-oauth2, windowslive, auth0 | 817-849 |
| Connection | String | Connection name | 832 |
| Primary | Boolean | Primary login method | 834 |

**Actions:**
- Unlink Account (except primary): Line 838-847

#### Account Deletion (Danger Zone)

| Setting | Type | Access | Description | File Line |
|---------|------|--------|-------------|-----------|
| Deletion Reason | Select | Owner/Admin | Why leaving | 1448-1459 |
| Additional Feedback | Text | Owner/Admin | Optional comments | 1462-1471 |
| Confirmation Text | String | Owner/Admin | Must type "DELETE" | 1476-1490 |
| Deletion Scheduled | DateTime | Owner/Admin | 30-day grace period | 1329-1356 |

**Deletion Reasons:**
- Loaded via `accountService.getDeletionReasons()`
- GDPR compliant with 30-day retention

---

## Organization Settings

**Location:** `src/pages/OrganizationSettings.tsx`
**Route:** `/organization/settings`
**Access:** Owner, Admin, Billing Admin only

### Organization Profile

| Setting | Type | Validation | Default | Description | File Line |
|---------|------|------------|---------|-------------|-----------|
| Organization Name | String | Min 3 chars | - | Organization display name | 673-678 |
| Organization Slug | String | Min 3 chars, unique | Auto-generated | URL-friendly identifier | 681-712 |
| Email | Email | Valid email | - | Primary contact email | 714-723 |
| Phone | String | - | - | Contact phone | 726-732 |
| Address | Text | - | - | Organization address | 734-743 |
| Logo | Image | Max 2MB | - | Organization logo (512x512 recommended) | 633-668 |
| Billing Email | Email | Valid email | - | Invoice recipient | 769-778 |
| Organization Type | String | Read-only | - | Plan tier type | 629, 782-786 |

**Slug Features:**
- Auto-normalization: lowercase, alphanumeric, hyphens
- Real-time availability check
- Suggested alternatives if taken
- Used in URLs: `/org/{slug}`

**Logo Validation:**
- Max size: 2MB
- Formats: JPEG, PNG, GIF, WebP
- Recommended: 512x512px

### Security Policies

| Setting | Type | Options | Default | Description | File Line |
|---------|------|---------|---------|-------------|-----------|
| Require MFA | Boolean | - | false | Enforce 2FA for all users | 870-878 |
| Session Timeout | Select | 15/30/60/120/240/480 min | 30 | Auto-logout after inactivity | 881-896 |
| Password Policy | Select | basic/strong/enterprise | strong | Password requirements | 898-910 |

**Password Policy Levels:**

| Level | Requirements |
|-------|-------------|
| Basic | 8 characters |
| Strong | 12 characters + special characters |
| Enterprise | 16 characters + rotation policy |

### Billing & Subscription

| Setting | Type | Access | Description | File Line |
|---------|------|--------|-------------|-----------|
| Billing Email | Email | Admin | Invoice recipient | 770-778 |
| Organization Type | Display | Read-only | Current plan tier | 780-787 |
| Manage Billing | Link | Admin | Redirect to /billing | 789-796 |

### API Access & Webhooks

| Setting | Type | Default | Description | File Line |
|---------|------|---------|-------------|-----------|
| API Access Enabled | Boolean | true | Enable API access | 936-945 |
| Webhooks Enabled | Boolean | false | Enable webhook notifications | 947-958 |
| Webhook URL | URL | - | Endpoint for webhook delivery | 961-971 |

### Data Retention

| Setting | Type | Range | Default | Description | File Line |
|---------|------|-------|---------|-------------|-----------|
| Data Retention Days | Number | 30-3650 | 365 | BOM/component data retention | 995-1005 |
| Audit Log Retention Days | Number | 30-365 | 90 | Audit trail retention | 1007-1017 |

### SSO Configuration

| Setting | Type | Options | Default | Description | File Line |
|---------|------|---------|---------|-------------|-----------|
| SSO Enabled | Boolean | - | false | Enable SSO/SAML | 810-820 |
| SSO Provider | Select | saml/okta/azure/google | saml | Identity provider | 823-842 |

**SSO Providers:**
- SAML 2.0
- Okta
- Azure AD
- Google Workspace

**Note:** SSO configuration requires support contact (Line 839-841)

---

## Alert Preferences

**Location:** `src/pages/AlertPreferences.tsx`
**Route:** `/alerts/preferences`
**Access:** All authenticated users

### Alert Types

| Alert Type | Icon | Default Active | Description | File Line |
|------------|------|----------------|-------------|-----------|
| Lifecycle | History | true | Component end-of-life status | 86, 82 |
| Risk | TrendingUp | true | Risk score changes | 87, 83 |
| Price | AttachMoney | true | Price change alerts | 88, 84 |
| Availability | Inventory | true | Stock availability changes | 89, 85 |
| Compliance | Gavel | true | RoHS, REACH compliance | 90, 86 |
| PCN | Article | true | Product Change Notices | 91, 87 |
| Supply Chain | LocalShipping | true | Supply chain disruptions | 92, 88 |

### Alert Delivery Channels

| Channel | Type | Description | File Line |
|---------|------|-------------|-----------|
| In-App | Boolean | Notification bell in app | 240-248 |
| Email | Boolean | Email notifications | 249-257 |
| Webhook | Boolean | HTTP webhook delivery | 258-267 |

### Alert Thresholds (Per Alert Type)

Thresholds are dynamic and loaded from backend via `alertApi.getThresholdOptions()`.

**Threshold Control Types:**

| Type | Input | Example | File Line |
|------|-------|---------|-----------|
| Boolean | Checkbox | Enable/disable feature | 104-124 |
| Number | Slider | Numeric value with min/max | 148-175 |
| Percent | Slider | Percentage (0-100%) | 148-175 |
| Select | Dropdown | Predefined options | 126-145 |

**Example Thresholds:**

| Alert Type | Threshold Example | Default | Range |
|------------|------------------|---------|-------|
| Risk | Risk score change % | 10% | 1-50% |
| Price | Price change % | 5% | 1-100% |
| Availability | Stock level % | 20% | 1-100% |

### Component Watch List

| Field | Type | Description | File Line |
|-------|------|-------------|-----------|
| Component ID | UUID | Component to watch | 750-756 |
| MPN | String | Manufacturer part number (display) | 683-686 |
| Manufacturer | String | Manufacturer name (display) | 688-689 |
| Watch Lifecycle | Boolean | Monitor lifecycle status | 692 |
| Watch Risk | Boolean | Monitor risk score | 693 |
| Watch Price | Boolean | Monitor pricing | 694 |
| Watch Availability | Boolean | Monitor stock | 695 |
| Watch Compliance | Boolean | Monitor compliance | 696 |
| Watch Supply Chain | Boolean | Monitor supply chain | 697 |
| Notes | Text | Custom notes | 701-703 |
| Created At | DateTime | When watch was added | 706-708 |

**Actions:**
- Add Watch: Line 743-768
- Remove Watch: Line 711-720

---

## Risk Profile Settings

**Location:** `src/pages/RiskProfileSettings.tsx`
**Route:** `/risk/profile-settings`
**Access:** Admin only

### Risk Factor Weights

| Factor | Default Weight | Range | Color | Description | File Line |
|--------|---------------|-------|-------|-------------|-----------|
| Lifecycle Risk | 30% | 0-100% | #2196f3 | Component end-of-life status | 74, 82 |
| Supply Chain Risk | 25% | 0-100% | #ff9800 | Stock availability and lead times | 75, 83 |
| Compliance Risk | 20% | 0-100% | #4caf50 | RoHS, REACH, regulations | 76, 84 |
| Obsolescence Risk | 15% | 0-100% | #f44336 | Predicted obsolescence | 77, 85 |
| Single Source Risk | 10% | 0-100% | #9c27b0 | Limited supplier diversity | 78, 86 |

**Validation:** Total must equal 100%
**Auto-balance:** Proportional adjustment available (Line 188-215)

### Risk Level Thresholds

| Level | Range | Default Max | Color | Description | File Line |
|-------|-------|-------------|-------|-------------|-----------|
| Low | 0 - low_max | 30 | #4caf50 | Minimal risk | 463-472 |
| Medium | low_max+1 - medium_max | 60 | #ff9800 | Moderate risk | 474-486 |
| High | medium_max+1 - high_max | 85 | #f44336 | Significant risk | 488-498 |
| Critical | high_max+1 - 100 | - | #9c27b0 | Severe risk | 500-515 |

**Adjustable Ranges:**
- Low: 10-50
- Medium: low_max+10 to 80
- High: medium_max+5 to 95

### BOM Health Grade Thresholds

| Grade | Color | Default Max High % | Range | Description | File Line |
|-------|-------|-------------------|-------|-------------|-----------|
| A | #4caf50 | 5% | 0-50% | Excellent health | 561 |
| B | #8bc34a | 10% | 0-50% | Good health | 562 |
| C | #ff9800 | 20% | 0-50% | Fair health | 563 |
| D | #f44336 | 35% | 0-50% | Poor health | 564 |
| F | - | >D | - | Failing (auto-assigned) | 589-593 |

**Metric:** Maximum percentage of high+critical risk components allowed

### Contextual Scoring

| Setting | Type | Default | Range | Description | File Line |
|---------|------|---------|-------|-------------|-----------|
| Enable Contextual Scoring | Boolean | true | - | Apply context-based adjustments | 609-621 |
| Quantity Impact Weight | Percent | 20% | 0-50% | Higher quantities increase risk | 625-643 |
| Lead Time Impact Weight | Percent | 15% | 0-50% | Longer lead times increase risk | 645-663 |
| Criticality Impact Weight | Percent | 30% | 0-50% | Critical components get higher weighting | 665-683 |

### Industry Presets

| Industry | Icon | Description | File Line |
|----------|------|-------------|-----------|
| Automotive | DirectionsCar | Optimized for automotive | 91, 724 |
| Medical | LocalHospital | Medical device requirements | 92, 724 |
| Aerospace | Flight | Aerospace/defense standards | 93, 724 |
| Consumer | Devices | Consumer electronics | 94, 724 |
| Industrial | PrecisionManufacturing | Industrial equipment | 95, 724 |
| Default | Business | Generic balanced profile | 96, 724 |

**Preset Application:**
- Loads predefined weights for industry
- Loads industry-specific thresholds
- Can be customized after application
- Applied via: `riskApi.applyRiskPreset(industry)` (Line 291)

---

## Feature Flags and Toggles

### Environment-Based Flags (.env)

| Flag | Variable | Type | Default | Description | File Line (.env) |
|------|----------|------|---------|-------------|------------------|
| Auth Mode | VITE_AUTH_MODE | production/development | production | Authentication mode | 21 |
| Dev Bypass | VITE_DEV_BYPASS_ENABLED | boolean | false | Skip auth (dev only) | 26 |
| Dev Session Duration | VITE_DEV_SESSION_DURATION | number (min) | 60 | Dev session length | 29 |
| Auth Logging | VITE_AUTH_LOGGING | boolean | true | Log auth events | 36 |
| Gate Logging | VITE_ENABLE_GATE_LOGGING | boolean | true | Critical checkpoint logs | 41 |
| Dev Default Email | VITE_DEV_DEFAULT_EMAIL | email | - | Pre-fill login form | 49 |
| Dev Default Password | VITE_DEV_DEFAULT_PASSWORD | string | - | Pre-fill password | 50 |
| Auth Provider | VITE_AUTH_PROVIDER | auth0/keycloak/supabase | keycloak | Active auth provider | 56 |
| Use Direct Auth0 JWT | VITE_USE_DIRECT_AUTH0_JWT | boolean | true | Auth0 JWT to PostgREST | 116 |
| Use Scoped Upload | VITE_USE_SCOPED_UPLOAD | boolean | true | Project-scoped BOM uploads | 95 |

### Backend URLs

| Service | Variable | Default | Description | File Line (.env) |
|---------|----------|---------|-------------|------------------|
| Backend API | VITE_BACKEND_URL | http://localhost:27200 | CNS service | 74 |
| Supabase | VITE_SUPABASE_URL | http://localhost:27540 | Customer data (Kong) | 79 |
| CNS API | VITE_CNS_API_URL | http://localhost:27800 | Component service | 88 |
| Novu Backend | VITE_NOVU_BACKEND_URL | http://localhost:27850 | Notifications | 103 |

### Authentication Configuration

| Service | Variable | Default | Description | File Line (.env) |
|---------|----------|---------|-------------|------------------|
| Auth0 Domain | VITE_AUTH0_DOMAIN | dev-mtecvjcsrleq25y7.us.auth0.com | Auth0 tenant | 58 |
| Auth0 Client ID | VITE_AUTH0_CLIENT_ID | - | OAuth client ID | 59 |
| Auth0 Audience | VITE_AUTH0_AUDIENCE | https://api.components-platform.com | API audience | 60 |
| Auth0 Namespace | VITE_AUTH0_NAMESPACE | https://ananta.component.platform | Custom claims namespace | 109 |
| Keycloak URL | VITE_KEYCLOAK_URL | http://localhost:8180 | Keycloak server | 67 |
| Keycloak Realm | VITE_KEYCLOAK_REALM | cbp-users | Keycloak realm | 68 |
| Keycloak Client ID | VITE_KEYCLOAK_CLIENT_ID | customer-portal | Keycloak client | 69 |

### Notification Configuration

| Setting | Variable | Default | Description | File Line (.env) |
|---------|----------|---------|-------------|------------------|
| Novu App Identifier | VITE_NOVU_APP_IDENTIFIER | components-platform | Novu application | 101 |
| Novu Backend URL | VITE_NOVU_BACKEND_URL | http://localhost:27850 | Subscriber auth | 103 |

### Production Build (.env.production)

| Setting | Variable | Default | Description | File Line |
|---------|----------|---------|-------------|-----------|
| Base Path | VITE_BASE_PATH | /customer-portal | Traefik routing | 5 |
| Public URL | PUBLIC_URL | /customer-portal | Asset path | 6 |
| Backend URL | VITE_BACKEND_URL | http://localhost:27500/backend | Via Traefik | 14 |

---

## Menu Structure

### Main Navigation (Sidebar)

#### Section: Main

| Label | Route | Icon | Badge | Access | File Line (App.tsx) |
|-------|-------|------|-------|--------|---------------------|
| Dashboard | /dashboard | Dashboard | - | All | - |
| Portfolio | /portfolio | ViewInAr | - | All | - |
| Projects | /projects | Folder | Nested submenu | All | 392-550 |
| BOMs | /boms | ListAlt | - | All | - |
| Components | /components/search | Memory | - | All | - |
| Alerts | /alerts | Notifications | Count badge | All | 338-375 |

#### Section: Projects (Nested Menu)

**Dynamic menu generated from user's projects**

| Item | Type | Description | File Line (App.tsx) |
|------|------|-------------|---------------------|
| Project Name | Button | Project selector | 438-550 |
| BOM Upload | Link | Upload new BOM | 473-481 |
| BOM Enrichment | Link | Enrich existing BOM | 482-490 |
| Audit Stream | Link | View audit logs | 491-499 |
| Component Catalog | Link | Project components | 500-508 |

**Project Status Indicators:**
- Active: Green check circle
- On Hold: Yellow pause
- Archived: Gray archive
- Completed: Green check
- In Progress: Blue dot

**Project Type Colors:**
- New Product: #3b82f6 (blue)
- Redesign: #8b5cf6 (purple)
- Maintenance: #10b981 (green)
- Compliance: #f59e0b (amber)
- Cost Reduction: #06b6d4 (cyan)
- EOL: #ef4444 (red)
- Other: #6b7280 (gray)

#### Section: Team

| Label | Route | Icon | Access | File Line |
|-------|-------|------|--------|-----------|
| Users | /users | People | Admin | - |
| Organizations | /organizations | Business | Admin | - |

#### Section: Settings

| Label | Route | Icon | Access | File Line |
|-------|-------|------|--------|-----------|
| Account | /account/settings | Settings | All | - |
| Organization | /organization/settings | Business | Admin | - |
| Alert Preferences | /alerts/preferences | Notifications | All | - |
| Risk Profile | /risk/profile-settings | Security | Admin | - |
| Billing | /billing | Payment | Owner/Admin | - |

#### Section: Tools

| Label | Route | Icon | Access | File Line |
|-------|-------|------|--------|-----------|
| Column Mapper | /bom/column-mapper | SwapHoriz | All | - |
| Admin Console | /admin/console | AdminPanelSettings | Super Admin | - |

### User Menu (Top Right)

**Location:** `src/components/CustomUserMenu.tsx`

| Label | Route | Icon | Description | File Line |
|-------|-------|------|-------------|-----------|
| My Profile | /profile | Person | User profile | 98-103 |
| Account Settings | /account/settings | Settings | Account configuration | 105-110 |
| Notifications | /notifications | Notifications | Notification inbox | 112-117 |
| Theme | /theme | Palette | Theme selection | 119-124 |
| Logout | - | Logout | Sign out | 128-133 |

### Context Menus

**BOM List:**
- View Details
- Edit BOM
- Enrich BOM
- Delete BOM
- Download BOM

**Component List:**
- View Details
- Add to Watch List
- View Suppliers
- View Datasheets

**Project List:**
- Open Project
- Edit Project
- Archive Project
- Delete Project

### Top Bar Features

| Feature | Shortcut | Description | File Line (App.tsx) |
|---------|----------|-------------|---------------------|
| Command Palette | Cmd+K / Ctrl+K | Quick navigation | 289-306 |
| Keyboard Shortcuts | ? | Show keyboard shortcuts | 307-323 |
| Notification Bell | - | Novu notifications | 324 |
| Admin Mode Toggle | - | Switch admin view | 325 |

---

## Environment Configuration

### Core Services

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 27510 | Customer portal port |
| VITE_BACKEND_URL | http://localhost:27200 | CNS service |
| VITE_SUPABASE_URL | http://localhost:27540 | Supabase (Kong gateway) |
| VITE_CNS_API_URL | http://localhost:27800 | CNS direct |

### Authentication

#### Keycloak (Default)

| Variable | Default | Description |
|----------|---------|-------------|
| VITE_KEYCLOAK_URL | http://localhost:8180 | Keycloak server |
| VITE_KEYCLOAK_REALM | cbp-users | Realm name |
| VITE_KEYCLOAK_CLIENT_ID | customer-portal | Client ID |

#### Auth0 (Alternative)

| Variable | Default | Description |
|----------|---------|-------------|
| VITE_AUTH0_DOMAIN | dev-mtecvjcsrleq25y7.us.auth0.com | Auth0 tenant |
| VITE_AUTH0_CLIENT_ID | - | OAuth client ID |
| VITE_AUTH0_AUDIENCE | https://api.components-platform.com | API audience |
| VITE_AUTH0_NAMESPACE | https://ananta.component.platform | Custom claims |

### Supabase Keys

| Variable | Purpose | Usage |
|----------|---------|-------|
| VITE_SUPABASE_ANON_KEY | Public API key | Client-side queries |
| VITE_SUPABASE_SERVICE_KEY | Admin API key | Dev bypass only (NEVER in production) |

### Development Flags

| Variable | Default | Safe for Production | Description |
|----------|---------|---------------------|-------------|
| VITE_AUTH_MODE | production | Yes | Auth mode |
| VITE_DEV_BYPASS_ENABLED | false | NO | Skip authentication |
| VITE_DEV_SESSION_DURATION | 60 | N/A | Dev session length |
| VITE_DEV_DEFAULT_EMAIL | - | NO | Pre-fill email |
| VITE_DEV_DEFAULT_PASSWORD | - | NO | Pre-fill password |
| VITE_AUTH_LOGGING | true | Yes | Log auth events |
| VITE_ENABLE_GATE_LOGGING | true | Optional | Checkpoint logs |

---

## Authentication Configuration

**Location:** `src/config/authConfig.ts`

### Auth Modes

| Mode | Description | When Active | Safety |
|------|-------------|-------------|--------|
| Production | Full authentication required | Default, always in NODE_ENV=production | Secure |
| Development | Reduced security, optional bypass | NODE_ENV=development AND VITE_AUTH_MODE=development | Unsafe for production |

### Safety Mechanisms

**Multiple layers prevent dev bypass from reaching production:**

1. **Mode Enforcement** (Line 29-46)
   - SAFE DEFAULT: Always production unless explicitly set
   - Validates NODE_ENV matches VITE_AUTH_MODE
   - Logs warnings if mismatch detected

2. **Dev Bypass Lockout** (Line 49-65)
   - CRITICAL: Dev bypass NEVER enabled if mode=production
   - Logs security violation if attempted
   - Ignores VITE_DEV_BYPASS_ENABLED in production

3. **Session Duration Caps** (Line 67-89)
   - Max: 120 minutes
   - Min: 5 minutes
   - Logs warnings if out of bounds

4. **IP Restrictions** (Line 91-106)
   - Default: localhost only (127.0.0.1, ::1)
   - Configurable via VITE_DEV_ALLOWED_IPS
   - Empty defaults to localhost

### Auth Configuration Object

```typescript
export interface AuthConfig {
  mode: 'production' | 'development';
  devBypassEnabled: boolean;
  sessionDurationMinutes: number;
  allowedDevIPs?: string[];
  logAuthEvents: boolean;
}
```

**Current Config (Line 108-114):**
- mode: Auto-detected (production or development)
- devBypassEnabled: Conditional (only if dev mode)
- sessionDurationMinutes: Range-validated
- allowedDevIPs: localhost by default
- logAuthEvents: true (unless VITE_AUTH_LOGGING=false)

### Auth Logging (Line 120-137)

**Logged on module load:**
- Auth mode (PRODUCTION or DEVELOPMENT)
- Dev bypass status (ENABLED or DISABLED)
- Session duration
- Allowed IPs
- Security warnings if dev bypass enabled

---

## Permissions and Access Control

### Role Hierarchy

| Role Level | Role Name | Description | Access |
|------------|-----------|-------------|--------|
| 5 | super_admin | Platform staff | Platform-wide access |
| 4 | owner | Organization owner | Billing, delete org, all admin |
| 3 | admin | Organization admin | User management, org settings |
| 2 | engineer | Technical user | Manage BOMs, components |
| 1 | analyst | Read-only user | View data, reports (lowest) |

### Role Checks (OrganizationSettings.tsx)

```typescript
// Line 66-68
const roleIsAdmin = ['owner', 'admin', 'super_admin', 'billing_admin'].includes(permissions);
const flagIsAdmin = localStorage.getItem('is_admin') === 'true';
const isOrgAdmin = roleIsAdmin || flagIsAdmin;
```

### Settings Access Matrix

| Setting Page | Minimum Role | View-Only Access | Edit Access |
|--------------|--------------|------------------|-------------|
| Account Settings | All | All | All (own account) |
| Alert Preferences | All | All | All (own preferences) |
| Risk Profile | All | All | Admin+ |
| Organization Settings | All | All | Admin+ |
| Billing | All | Owner/Admin | Owner/Admin |
| Admin Console | Super Admin | Super Admin | Super Admin |

### Permission Gates

**Organization Settings Gates:**

| Action | Check | File Line |
|--------|-------|-----------|
| Edit Org Profile | isOrgAdmin | 286-291 |
| Edit Security | isOrgAdmin | 388-393 |
| Edit API Settings | isOrgAdmin | 446-451 |
| Edit Retention | isOrgAdmin | 476-479 |
| Edit SSO | isOrgAdmin | 515-518 |

**Account Deletion Gates:**

| Check | Condition | File Line |
|-------|-----------|-----------|
| Show Delete Button | isOwner OR can_be_deleted | 1377-1392 |
| Can Delete | Backend flag | 1394 |

### Feature Visibility

**Menu Items:**

| Item | Role Required | File |
|------|---------------|------|
| Users | Admin | App.tsx |
| Organizations | Admin | App.tsx |
| Organization Settings | Admin | App.tsx |
| Risk Profile | Admin | App.tsx |
| Billing | Owner/Admin | App.tsx |
| Admin Console | Super Admin | App.tsx |

---

## API Services

### Service Overview

| Service | File | Purpose |
|---------|------|---------|
| Account Service | accountService.ts | Account deletion, status |
| Alert Service | alertService.ts | Alert preferences, thresholds |
| CNS API | cnsApi.ts | Component normalization |
| Column Mapping | column-mapping.service.ts | Smart BOM column mapping |
| Event Publisher | eventPublisher.ts | Audit event publishing |
| Onboarding Service | onboardingService.ts | Welcome notifications |
| Organization Service | organizationService.ts | Org settings CRUD |
| Portfolio Service | portfolio.service.ts | Portfolio analytics |
| Risk Service | riskService.ts | Risk profiles, presets |
| Stripe Service | stripeService.ts | Billing integration |
| Team Service | teamService.ts | Team management |
| Workspace Service | workspaceService.ts | Workspace management |
| WebSocket Client | websocketClient.ts | Real-time updates |

### Key Service Methods

#### Account Service (accountService.ts)

```typescript
getAccountStatus(): Promise<AccountStatus>
getDeletionReasons(): Promise<DeletionReason[]>
getDeletionStatus(): Promise<DeletionStatus>
scheduleAccountDeletion(data): Promise<{message: string}>
cancelAccountDeletion(): Promise<{message: string}>
```

#### Alert Service (alertService.ts)

```typescript
getPreferencesWithThresholds(): Promise<AlertPreferenceWithThresholds[]>
getThresholdOptions(): Promise<AlertTypeConfig[]>
updateThresholds(alertType, config): Promise<void>
updateAlertTypePreference(update): Promise<void>
getWatches(): Promise<ComponentWatch[]>
addWatch(data): Promise<ComponentWatch>
removeWatch(watchId): Promise<void>
```

#### Organization Service (organizationService.ts)

```typescript
getSettings(): Promise<OrganizationSettings>
updateProfile(data): Promise<void>
updateSecuritySettings(data): Promise<void>
updateApiSettings(data): Promise<void>
updateDataRetention(data): Promise<void>
updateSsoSettings(data): Promise<void>
checkSlugAvailability(slug): Promise<{available: boolean, suggested?: string}>
```

#### Risk Service (riskService.ts)

```typescript
getRiskProfile(): Promise<RiskProfile>
updateRiskProfile(data): Promise<RiskProfile>
resetRiskProfile(): Promise<RiskProfile>
getRiskPresets(): Promise<RiskPreset[]>
applyRiskPreset(industry): Promise<RiskProfile>
```

---

## Data Models

### User Settings Models

#### AccountStatus
```typescript
{
  organization_id: string;
  organization_name: string;
  plan_tier: string;
  subscription_status: string;
  is_suspended: boolean;
  org_type: string;
  deletion_scheduled: boolean;
  can_be_deleted: boolean;
}
```

#### DeletionStatus
```typescript
{
  deletion_scheduled: boolean;
  deletion_scheduled_at?: DateTime;
  days_remaining: number;
  reason?: string;
  can_cancel: boolean;
}
```

### Organization Settings Models

#### OrganizationSettings
```typescript
{
  profile: {
    id: string;
    name: string;
    slug: string;
    email?: string;
    phone?: string;
    address?: string;
    logo_url?: string;
    billing_email?: string;
    org_type: string;
  };
  security: {
    require_mfa: boolean;
    session_timeout_minutes: number;
    password_policy: 'basic' | 'strong' | 'enterprise';
  };
  api: {
    api_access_enabled: boolean;
    webhooks_enabled: boolean;
    webhook_url?: string;
  };
  data_retention: {
    data_retention_days: number;
    audit_log_retention_days: number;
  };
  sso: {
    sso_enabled: boolean;
    sso_provider: 'saml' | 'okta' | 'azure' | 'google';
  };
}
```

### Risk Profile Models

#### RiskProfile
```typescript
{
  weights: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  thresholds: {
    low_max: number;
    medium_max: number;
    high_max: number;
  };
  bom_health_thresholds: {
    a_grade_max_high_pct: number;
    b_grade_max_high_pct: number;
    c_grade_max_high_pct: number;
    d_grade_max_high_pct: number;
  };
  enable_contextual_scoring: boolean;
  quantity_impact_weight: number;
  lead_time_impact_weight: number;
  criticality_impact_weight: number;
}
```

#### RiskPreset
```typescript
{
  id: string;
  industry: string;
  name: string;
  description: string;
  weights: RiskWeights;
  thresholds: RiskThresholds;
}
```

### Alert Preference Models

#### AlertPreferenceWithThresholds
```typescript
{
  alert_type: AlertType;
  description: string;
  is_active: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  webhook_enabled: boolean;
  threshold_config?: Record<string, number | boolean | string>;
}
```

#### ThresholdOption
```typescript
{
  key: string;
  label: string;
  description: string;
  type: 'number' | 'percent' | 'boolean' | 'select';
  default_value: number | boolean | string;
  min_value?: number;
  max_value?: number;
  unit?: string;
  options?: {value: string; label: string}[];
}
```

---

## Storage Mechanisms

### LocalStorage

| Key | Type | Purpose | Set By |
|-----|------|---------|--------|
| app_theme | ThemeMode | Theme preference | ThemeModeContext |
| user_role | String | User role | authProvider |
| is_admin | String | Admin flag | authProvider |
| user_name | String | User display name | AccountSettings |
| user_email | String | User email | authProvider |
| user_avatar | String | Avatar URL | authProvider |
| current_project_id | UUID | Selected project | NestedProjectsMenu |
| project_id | UUID | Active project | NestedProjectsMenu |
| welcome_triggered_session | String | Welcome notification flag | WelcomeTrigger |

### SessionStorage

| Key | Type | Purpose | Set By |
|-----|------|---------|--------|
| welcome_triggered_session | String | Prevent duplicate welcome | WelcomeTrigger |

### Auth0 user_metadata

| Field | Type | Purpose | Set By |
|-------|------|---------|--------|
| theme | ThemeMode | Cross-device theme sync | AccountSettings |
| notifications.bom_complete | Boolean | BOM notification pref | AccountSettings |
| notifications.alerts | Boolean | Alert notification pref | AccountSettings |
| notifications.email_digest | Boolean | Email digest pref | AccountSettings |

---

## Configuration Files

### Environment Files

| File | Purpose | Used When |
|------|---------|-----------|
| .env | Local development | npm run dev |
| .env.local | Local overrides | npm run dev (gitignored) |
| .env.production | Production build | npm run build |

### TypeScript Config

| File | Purpose |
|------|---------|
| tsconfig.json | TypeScript compiler options |
| tsconfig.node.json | Node.js TypeScript config |
| vite.config.ts | Vite build configuration |

### Build Configuration

**Vite Config:** `vite.config.ts`
- Port: 27555
- Proxy: Backend API, Supabase, CNS
- Base path: Configurable via env

---

## Keyboard Shortcuts

**Implemented via KeyboardShortcuts component**

| Shortcut | Action | Description |
|----------|--------|-------------|
| Cmd+K / Ctrl+K | Open command palette | Quick navigation |
| ? | Show shortcuts | Help modal |
| Esc | Close modals | Dismiss overlays |
| / | Focus search | Jump to search |

---

## Notification System

### Novu Integration

**Configuration:**
- App Identifier: VITE_NOVU_APP_IDENTIFIER
- Backend URL: VITE_NOVU_BACKEND_URL
- Subscriber ID: Auth0 sub or Supabase user ID

**Notification Types:**
- Welcome notification (first login)
- BOM enrichment complete
- Component alerts
- Price changes
- Lifecycle updates
- System announcements

**Features:**
- In-app notification bell (top bar)
- Real-time WebSocket updates
- Persistent notification history
- Mark as read/unread
- Notification preferences

---

## Theme System

**Location:** `src/contexts/ThemeModeContext.tsx`

### Theme Modes

| Mode | Background | Paper | Text Primary | Text Secondary |
|------|-----------|-------|--------------|----------------|
| light | #f9fafb | #ffffff | #111827 | #6b7280 |
| light-dim | #f0ede6 | #faf8f5 | #2d3748 | #4a5568 |
| dark-soft | #2d3748 | #3d4a5c | #e2e8f0 | #a0aec0 |
| dark | #121212 | #1e1e1e | #ffffff | #a1a1aa |

### Color Palette

**Primary:**
- Main: #3b82f6 (blue-500)
- Light: #60a5fa (blue-400)
- Dark: #2563eb (blue-600)

**Secondary:**
- Main: #8b5cf6 (purple-500)
- Light: #a78bfa (purple-400)
- Dark: #7c3aed (purple-600)

**Semantic Colors:**
- Success: #22c55e (green-500)
- Warning: #f59e0b (amber-500)
- Error: #ef4444 (red-500)
- Info: #3b82f6 (blue-500)

### Theme Application

1. **MUI Components:** Automatic via ThemeProvider
2. **CSS Variables:** Set on document.documentElement
3. **Body Background:** Applied directly
4. **Transitions:** 0.3s ease for smooth switching

---

## Security Features

### Authentication Security

1. **Multi-Provider Support:**
   - Keycloak SSO (default)
   - Auth0 (social login)
   - Supabase (direct signups)

2. **Session Management:**
   - Configurable timeouts (15-480 min)
   - Automatic logout on inactivity
   - Token refresh handling

3. **MFA Support:**
   - TOTP (Authenticator apps)
   - SMS verification
   - WebAuthn (Security keys)
   - Platform biometrics

### API Security

1. **JWT Validation:**
   - Token signature verification
   - Expiration checking
   - Role extraction

2. **Request Authentication:**
   - Bearer token headers
   - API key support (future)
   - Webhook signature verification

### Data Security

1. **Tenant Isolation:**
   - Organization-scoped queries
   - Row-level security (RLS)
   - Multi-tenant filtering

2. **Audit Logging:**
   - User activity tracking
   - Login history
   - Settings changes
   - Data access logs

### Production Safeguards

1. **Dev Mode Lockout:**
   - Cannot enable in production NODE_ENV
   - Multiple validation layers
   - Security violation logging

2. **Secret Management:**
   - Service keys never in client bundle
   - Environment variable validation
   - CORS policy enforcement

---

## Performance Optimization

### Code Splitting

- Route-based lazy loading
- Component-level dynamic imports
- Vendor bundle separation

### Caching

- localStorage for theme
- SessionStorage for transient data
- Auth0 user_metadata for cloud sync

### API Optimization

- Request batching (Promise.all)
- Debounced search
- Pagination (default: 20, max: 100)
- Real-time WebSocket (not polling)

---

## Accessibility (a11y)

### WCAG 2.1 Compliance

1. **Color Contrast:**
   - All themes meet AA standards
   - High contrast options available

2. **Keyboard Navigation:**
   - Full keyboard support
   - Focus indicators
   - Logical tab order

3. **Screen Reader Support:**
   - ARIA labels
   - Semantic HTML
   - Role attributes

4. **Form Accessibility:**
   - Label associations
   - Error messages
   - Required field indicators

---

## Localization (i18n)

**Current Status:** English only

**Future Support:**
- Multi-language detection
- User language preference
- Date/time localization
- Number formatting

---

## Error Handling

### User-Facing Errors

1. **Validation Errors:**
   - Inline field errors
   - Form-level validation
   - Clear error messages

2. **API Errors:**
   - Network failure handling
   - Timeout detection
   - Retry mechanisms
   - User-friendly messages

3. **Authentication Errors:**
   - Session expiration
   - Permission denied
   - Invalid credentials

### Developer Errors

1. **Console Logging:**
   - Structured log messages
   - Error stack traces
   - Gate checkpoint logging

2. **Error Boundaries:**
   - Component error catching
   - Graceful degradation
   - Error reporting

---

## Testing

**Test Files Found:**
- `src/services/analytics.test.ts`
- `src/components/layout/ResponsiveTable.test.tsx`
- `src/components/shared/ContextualBanner.test.tsx`

**Testing Strategy:**
- Unit tests: Service layer
- Component tests: React Testing Library
- Integration tests: User flows
- E2E tests: Critical paths

---

## Deployment

### Build Process

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Environment Checklist

Before deploying to production:

- [ ] VITE_AUTH_MODE is NOT set (defaults to 'production')
- [ ] VITE_DEV_BYPASS_ENABLED=false (or not set)
- [ ] All URLs use HTTPS
- [ ] Keycloak is properly configured
- [ ] service_role key is NOT exposed in client bundle
- [ ] CORS policies are configured correctly

---

## Support and Maintenance

### Logging

**Gate Logging (VITE_ENABLE_GATE_LOGGING=true):**
- [GATE: Auth] Authentication checkpoints
- [GATE: DataProvider] API requests
- [GATE: WebSocket] Real-time connections
- [GATE: BOM] BOM upload workflow
- [GATE: Risk] Risk calculations

**Auth Logging (VITE_AUTH_LOGGING=true):**
- Auth mode decisions
- Token refresh events
- Login/logout events
- Permission checks

### Debugging

**Browser DevTools:**
- React Developer Tools
- Redux DevTools (if applicable)
- Network tab for API inspection
- Console for gate logs

**Common Issues:**

1. **Authentication Fails:**
   - Check VITE_AUTH_PROVIDER setting
   - Verify Keycloak/Auth0 configuration
   - Check token expiration

2. **Settings Not Saving:**
   - Verify user has admin role
   - Check API endpoint availability
   - Review validation errors

3. **Theme Not Applying:**
   - Clear localStorage
   - Check ThemeModeContext provider
   - Verify CSS variable application

---

## File Reference

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| src/pages/AccountSettings.tsx | 1521 | User account settings |
| src/pages/OrganizationSettings.tsx | 1176 | Organization settings |
| src/pages/AlertPreferences.tsx | 774 | Alert preferences |
| src/pages/RiskProfileSettings.tsx | 808 | Risk profile configuration |
| src/components/CustomUserMenu.tsx | 137 | User menu component |
| src/contexts/ThemeModeContext.tsx | 302 | Theme system |
| src/config/authConfig.ts | 184 | Auth configuration |
| .env | 131 | Environment variables |
| .env.production | 20 | Production config |

---

## Summary

The Customer Portal provides a comprehensive settings and configuration system with:

- **3 Settings Pages:** Account, Organization, Risk Profile
- **52+ Individual Settings:** User preferences to org policies
- **4 Theme Modes:** Light, Light-dim, Dark-soft, Dark
- **7 Alert Types:** Configurable thresholds and delivery
- **5 Risk Factors:** Weighted scoring system
- **6 Industry Presets:** Pre-configured risk profiles
- **Multi-Role Access:** Owner, Admin, Engineer, Analyst
- **3 Auth Providers:** Keycloak, Auth0, Supabase
- **Real-time Notifications:** Novu integration
- **Production Safeguards:** Multiple security layers

All settings are persisted across sessions with a mix of localStorage, Auth0 user_metadata, and backend database storage.

---

**Report Generated:** December 14, 2024
**Analyzed By:** Claude Code (Frontend Developer Agent)
**Version:** Customer Portal v1.0
