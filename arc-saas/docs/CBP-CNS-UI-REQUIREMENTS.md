# CBP/CNS UI Requirements with Novu Integration

> **Purpose:** Comprehensive UI/UX requirements for the Customer Business Portal (CBP) and Component Normalization Service (CNS) Dashboard with Novu notification integration.
> **Target:** UI Designer Agent, Frontend Developer, UX Researcher

---

## Table of Contents

1. [Design Context](#design-context)
2. [Application Overview](#application-overview)
3. [Design System Requirements](#design-system-requirements)
4. [Page-by-Page Specifications](#page-by-page-specifications)
   - [Admin Portal Pages](#admin-portal-pages) (A1-A13)
   - [CBP Customer Portal Pages](#cbp-customer-portal-pages) (1-6)
5. [Notification UI (Novu Integration)](#notification-ui-novu-integration)
6. [Component Library](#component-library)
7. [Accessibility Requirements](#accessibility-requirements)
8. [Responsive Design](#responsive-design)
9. [Dark Mode Support](#dark-mode-support)
10. [Motion & Animation](#motion--animation)
11. [Developer Handoff](#developer-handoff)

---

## Design Context

### Brand Guidelines

| Element | Value | Notes |
|---------|-------|-------|
| Primary Color | `#4F46E5` (Indigo 600) | CTAs, links, active states |
| Secondary Color | `#10B981` (Emerald 500) | Success states, positive indicators |
| Error Color | `#DC2626` (Red 600) | Errors, destructive actions |
| Warning Color | `#F59E0B` (Amber 500) | Warnings, pending states |
| Neutral | `#6B7280` (Gray 500) | Text, borders, backgrounds |
| Font Family | Inter, system-ui, sans-serif | All UI text |
| Border Radius | `6px` (default), `8px` (cards), `4px` (inputs) | Consistent rounding |

### Existing Design System

- **Framework:** Tailwind CSS + shadcn/ui components
- **Icons:** Lucide React icons
- **Charts:** Recharts or Tremor
- **Tables:** TanStack Table
- **Forms:** React Hook Form + Zod validation

### Target Users

| Persona | Role | Primary Tasks |
|---------|------|---------------|
| **BOM Analyst** | `analyst` | View BOMs, view component data, read-only access |
| **Engineer** | `engineer` | Upload BOMs, manage components, enrichment |
| **Admin** | `admin` | User management, org settings, billing |
| **Owner** | `owner` | Full org control, billing, delete org |
| **Platform Staff** | `super_admin` | Cross-tenant access, CNS Dashboard |

---

## Application Overview

### Admin Portal (Control Plane)

**Purpose:** Platform administration for tenant management, subscriptions, billing, user management, and system monitoring.

**URL:** `http://localhost:27555` (Control Plane)

**Access:** Platform staff (`super_admin`, `admin`)

**Key Modules:**
1. Dashboard (platform metrics, recent activity)
2. Tenants (list, create, provision, configure)
3. Leads (onboarding pipeline, conversion)
4. Subscriptions (manage, upgrade/downgrade)
5. Plans (pricing tiers, features)
6. Users (platform users, roles)
7. Invitations (pending, resend, revoke)
8. Billing (invoices, payments, analytics)
9. Workflows (Temporal status, restart/cancel)
10. Notifications (templates, history, analytics)
11. Audit Logs (security events, changes)
12. Settings (platform config)
13. Monitoring (health, metrics, Grafana)

### CBP (Customer Business Portal)

**Purpose:** Customer-facing portal for BOM management, team collaboration, and billing.

**URL:** `http://localhost:27100` (App Plane)

**Key Modules:**
1. Dashboard (overview, quick actions)
2. BOM Management (list, upload, detail, enrichment)
3. Component Catalog (search, compare)
4. Team Management (users, invitations)
5. Billing (subscription, invoices, payment methods)
6. Notifications (inbox, preferences)
7. Settings (org settings, profile)

### CNS Dashboard (Staff Tool)

**Purpose:** Internal tool for platform staff to manage enrichment, component catalog, and cross-tenant operations.

**URL:** `http://localhost:27250` (App Plane)

**Access:** `super_admin` only, VPN/IP restricted

**Key Modules:**
1. Component Catalog Management
2. Enrichment Pipeline Monitoring
3. Supplier Management
4. Cross-Tenant BOM Operations
5. System Health & Metrics

---

## Design System Requirements

### Typography Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 30px / 1.875rem | 700 | 1.2 |
| H2 | 24px / 1.5rem | 600 | 1.25 |
| H3 | 20px / 1.25rem | 600 | 1.3 |
| H4 | 16px / 1rem | 600 | 1.4 |
| Body | 14px / 0.875rem | 400 | 1.5 |
| Small | 12px / 0.75rem | 400 | 1.4 |
| Caption | 11px / 0.6875rem | 500 | 1.3 |

### Spacing System

```
4px (1), 8px (2), 12px (3), 16px (4), 20px (5), 24px (6), 32px (8), 48px (12), 64px (16)
```

### Elevation (Shadows)

| Level | Usage | Value |
|-------|-------|-------|
| 0 | Flat elements | none |
| 1 | Cards, dropdowns | `0 1px 3px rgba(0,0,0,0.1)` |
| 2 | Modals, popovers | `0 4px 6px rgba(0,0,0,0.1)` |
| 3 | Notifications, toasts | `0 10px 15px rgba(0,0,0,0.1)` |

---

## Page-by-Page Specifications

---

## Admin Portal Pages

### A1. Admin Dashboard

**Route:** `/dashboard`

**Layout:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Platform Overview                         [Last 7 days â–¼]  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Total       â”‚ â”‚ Active      â”‚ â”‚ MRR         â”‚ â”‚ New     â”‚â”‚
â”‚  â”‚ Tenants     â”‚ â”‚ Subscript.  â”‚ â”‚             â”‚ â”‚ Leads   â”‚â”‚
â”‚  â”‚    47       â”‚ â”‚    42       â”‚ â”‚  $12,450    â”‚ â”‚    8    â”‚â”‚
â”‚  â”‚   +3 â†‘      â”‚ â”‚   +2 â†‘      â”‚ â”‚   +8% â†‘     â”‚ â”‚  -2 â†“   â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Revenue Trend (Chart)      â”‚ â”‚ Tenant Growth (Chart)    â”‚â”‚
â”‚  â”‚ [Line chart: 30 days]      â”‚ â”‚ [Bar chart: 12 months]   â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Recent Activity                              [View All â†’]  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ â— Tenant "Acme Corp" provisioned          2 hours ago   â”‚â”‚
â”‚  â”‚ â— Lead converted: john@startup.io         5 hours ago   â”‚â”‚
â”‚  â”‚ â— Payment failed for "Beta Inc"           1 day ago     â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  System Health                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚
â”‚  â”‚ API         â”‚ â”‚ Temporal    â”‚ â”‚ Database    â”‚            â”‚
â”‚  â”‚ â— Healthy   â”‚ â”‚ â— Healthy   â”‚ â”‚ â— Healthy   â”‚            â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Components:**
- MetricCard: Value, label, trend (up/down/neutral), sparkline
- RevenueChart: Line chart with time selector
- ActivityFeed: Icon, message, timestamp, link
- HealthIndicator: Service name, status dot, optional metrics

### A2. Tenants List Page

**Route:** `/tenants`

**Features:**
- Search by name, key, domain
- Filter by status (active, provisioning, suspended, deleted)
- Filter by plan tier
- Bulk actions: Suspend, Delete, Export

**Table Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Name | Text + avatar | Tenant name with logo |
| Key | Code | Unique tenant key (max 10 chars) |
| Plan | Badge | Current plan tier |
| Status | Status badge | active/provisioning/suspended |
| Users | Number | User count |
| Created | Date | Creation date |
| Actions | Dropdown | View, Edit, Provision, Suspend |

**Status Badges:**
- `active` - Green
- `provisioning` - Blue (animated)
- `pending` - Amber
- `suspended` - Red
- `deleted` - Gray (strikethrough)

### A3. Tenant Detail Page

**Route:** `/tenants/:id`

**Tabs:**
1. **Overview** - Basic info, subscription, key metrics
2. **Users** - User list with roles
3. **Subscription** - Plan details, usage, billing
4. **Configuration** - Settings, feature flags
5. **Audit Log** - Tenant-specific events
6. **Workflows** - Provisioning history

**Overview Section:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  â† Back to Tenants                                          â”‚
â”‚  Acme Corporation                    [Edit] [Suspend] [...] â”‚
â”‚  Key: acme | Status: Active â—                               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Subscription        â”‚  â”‚ Quick Stats                    â”‚â”‚
â”‚  â”‚ Plan: Professional  â”‚  â”‚ Users: 12                      â”‚â”‚
â”‚  â”‚ Status: Active      â”‚  â”‚ BOMs: 47                       â”‚â”‚
â”‚  â”‚ Since: Jan 15, 2024 â”‚  â”‚ Components: 3,241              â”‚â”‚
â”‚  â”‚ Next Bill: $199     â”‚  â”‚ API Calls (30d): 12,450        â”‚â”‚
â”‚  â”‚ [Manage â†’]          â”‚  â”‚                                â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Contact Information                                         â”‚
â”‚  Owner: John Smith (john@acme.com)                          â”‚
â”‚  Domain: acme.example.com                                   â”‚
â”‚  Address: 123 Main St, San Francisco, CA                    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### A4. Leads Page

**Route:** `/leads`

**Pipeline View (Kanban):**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ New (5)     â”‚ â”‚ Qualified(3)â”‚ â”‚ Converting(2)â”‚ â”‚ Converted(8)â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚ â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚ â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚ â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚Jane Doe â”‚ â”‚ â”‚ â”‚Bob Smithâ”‚ â”‚ â”‚ â”‚Acme Inc â”‚ â”‚ â”‚ â”‚Beta LLC â”‚ â”‚
â”‚ â”‚jane@... â”‚ â”‚ â”‚ â”‚bob@...  â”‚ â”‚ â”‚ â”‚acme@... â”‚ â”‚ â”‚ â”‚beta@... â”‚ â”‚
â”‚ â”‚Pro plan â”‚ â”‚ â”‚ â”‚Std plan â”‚ â”‚ â”‚ â”‚Pro plan â”‚ â”‚ â”‚ â”‚Ent plan â”‚ â”‚
â”‚ â”‚2h ago   â”‚ â”‚ â”‚ â”‚1d ago   â”‚ â”‚ â”‚ â”‚3h ago   â”‚ â”‚ â”‚ â”‚2d ago   â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚ â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚ â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚ â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚ ...         â”‚ â”‚ ...         â”‚ â”‚             â”‚ â”‚ ...         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Lead Card Actions:**
- View details
- Send verification email
- Convert to tenant
- Mark as qualified/lost
- Delete

### A5. Subscriptions Page

**Route:** `/subscriptions`

**Table Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Tenant | Text + link | Tenant name |
| Plan | Badge | Plan tier |
| Status | Badge | active/trialing/past_due/cancelled |
| Amount | Currency | Monthly/annual amount |
| Started | Date | Subscription start |
| Renews | Date | Next billing date |
| Actions | Dropdown | View, Change Plan, Cancel |

**Subscription Status Badges:**
- `active` - Green
- `trialing` - Blue
- `past_due` - Red
- `cancelled` - Gray
- `paused` - Amber

### A6. Plans Page

**Route:** `/plans`

**Plan Cards Layout:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Plans                                        [+ Add Plan]  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚
â”‚  â”‚ Basic       â”‚ â”‚ Standard    â”‚ â”‚ Professionalâ”‚            â”‚
â”‚  â”‚ $29/month   â”‚ â”‚ $79/month   â”‚ â”‚ $199/month  â”‚            â”‚
â”‚  â”‚             â”‚ â”‚ â˜… Popular   â”‚ â”‚             â”‚            â”‚
â”‚  â”‚ â€¢ 5 users   â”‚ â”‚ â€¢ 25 users  â”‚ â”‚ â€¢ Unlimited â”‚            â”‚
â”‚  â”‚ â€¢ 10 BOMs   â”‚ â”‚ â€¢ 100 BOMs  â”‚ â”‚ â€¢ Unlimited â”‚            â”‚
â”‚  â”‚ â€¢ Email     â”‚ â”‚ â€¢ Priority  â”‚ â”‚ â€¢ Dedicated â”‚            â”‚
â”‚  â”‚             â”‚ â”‚             â”‚ â”‚             â”‚            â”‚
â”‚  â”‚ 12 tenants  â”‚ â”‚ 24 tenants  â”‚ â”‚ 11 tenants  â”‚            â”‚
â”‚  â”‚ [Edit]      â”‚ â”‚ [Edit]      â”‚ â”‚ [Edit]      â”‚            â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### A7. Users Page (Platform)

**Route:** `/users`

**Table Columns:**
| Column | Type | Description |
|--------|------|-------------|
| User | Avatar + name | Profile image, full name |
| Email | Text | Email address |
| Tenant | Text + link | Associated tenant (if any) |
| Role | Badge | Platform role |
| Status | Badge | Active/Disabled |
| Last Login | Relative time | Last activity |
| Actions | Dropdown | Edit, Disable, Reset Password |

### A8. Invitations Page

**Route:** `/invitations`

**Sections:**
1. **Send Invitation** - Form at top
2. **Pending Invitations** - Table with resend/revoke
3. **Expired Invitations** - Collapsed table

**Invitation Status:**
- `pending` - Amber, shows expiry countdown
- `accepted` - Green, shows acceptance date
- `expired` - Gray, shows resend button
- `revoked` - Red

### A9. Billing Analytics Page

**Route:** `/billing`

**Sections:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Billing Analytics                    [This Month â–¼] [Export]â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ MRR         â”‚ â”‚ ARR         â”‚ â”‚ Churn Rate  â”‚ â”‚ ARPU    â”‚â”‚
â”‚  â”‚ $12,450     â”‚ â”‚ $149,400    â”‚ â”‚ 2.3%        â”‚ â”‚ $89     â”‚â”‚
â”‚  â”‚ +8% â†‘       â”‚ â”‚ +12% â†‘      â”‚ â”‚ -0.5% â†“     â”‚ â”‚ +$4 â†‘   â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Revenue by Plan                                             â”‚
â”‚  [Pie chart: Basic 15%, Standard 45%, Professional 40%]     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Recent Invoices                              [View All â†’]  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Invoice    â”‚ Tenant      â”‚ Amount  â”‚ Status â”‚ Date      â”‚â”‚
â”‚  â”‚ INV-001    â”‚ Acme Corp   â”‚ $199    â”‚ Paid   â”‚ Dec 1     â”‚â”‚
â”‚  â”‚ INV-002    â”‚ Beta Inc    â”‚ $79     â”‚ Failed â”‚ Dec 1     â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### A10. Workflows Page

**Route:** `/workflows`

**Table Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Workflow ID | Code | Temporal workflow ID |
| Type | Badge | provisioning/invitation/etc |
| Tenant | Text + link | Associated tenant |
| Status | Badge | running/completed/failed/cancelled |
| Started | Datetime | Start time |
| Duration | Time | Elapsed/total time |
| Actions | Buttons | View, Restart, Cancel |

**Workflow Status Badges:**
- `running` - Blue (animated pulse)
- `completed` - Green
- `failed` - Red (with retry button)
- `cancelled` - Gray
- `timed_out` - Amber

**Workflow Detail Modal:**
- Step-by-step progress
- Activity logs
- Error details (if failed)
- Retry/Cancel actions

### A11. Notifications Admin Page

**Route:** `/notifications`

**Tabs:**
1. **Templates** - View/edit Novu templates
2. **History** - Sent notifications log
3. **Analytics** - Delivery stats

**Templates Tab:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Notification Templates                   [Open Novu Dashboard]â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Template           â”‚ Trigger ID        â”‚ Channels â”‚ Act.â”‚â”‚
â”‚  â”‚ User Invitation    â”‚ user-invitation   â”‚ Email    â”‚ â—   â”‚â”‚
â”‚  â”‚ Tenant Welcome     â”‚ tenant-welcome    â”‚ Email    â”‚ â—   â”‚â”‚
â”‚  â”‚ Payment Failed     â”‚ payment-failed    â”‚ Email    â”‚ â—   â”‚â”‚
â”‚  â”‚ Trial Ending       â”‚ trial-ending-soon â”‚ Email    â”‚ â—   â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                                              â”‚
â”‚  [Edit templates in Novu Dashboard â†’]                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### A12. Audit Logs Page

**Route:** `/audit-logs`

**Filters:**
- Date range
- Event type (auth, billing, tenant, user)
- Tenant (optional)
- User (optional)
- Severity (info, warning, error)

**Table Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Timestamp | Datetime | Event time |
| Event | Text | Event description |
| Actor | User link | Who performed action |
| Tenant | Text | Affected tenant |
| IP Address | Text | Source IP |
| Severity | Badge | info/warning/error |

### A13. Monitoring Page

**Route:** `/monitoring`

**Sections:**
1. **Service Health** - Status cards for each service
2. **Metrics** - Embedded Grafana panels
3. **Alerts** - Active/recent alerts

**Health Cards:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  System Health                            [Refresh] [Expand]â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ API        â”‚ â”‚ Database   â”‚ â”‚ Temporal   â”‚ â”‚ Novu       â”‚â”‚
â”‚  â”‚ â— Healthy  â”‚ â”‚ â— Healthy  â”‚ â”‚ â— Healthy  â”‚ â”‚ â— Healthy  â”‚â”‚
â”‚  â”‚ 45ms avg   â”‚ â”‚ 12ms avg   â”‚ â”‚ 3 running  â”‚ â”‚ 99.9%      â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Redis      â”‚ â”‚ Keycloak   â”‚ â”‚ Stripe     â”‚ â”‚ Grafana    â”‚â”‚
â”‚  â”‚ â— Healthy  â”‚ â”‚ â— Healthy  â”‚ â”‚ â— Healthy  â”‚ â”‚ â— Healthy  â”‚â”‚
â”‚  â”‚ 1ms avg    â”‚ â”‚ 89ms avg   â”‚ â”‚ Connected  â”‚ â”‚ Available  â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  [Embedded Grafana Dashboard - API Performance]             â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚                                                         â”‚â”‚
â”‚  â”‚            [Grafana iframe / charts]                    â”‚â”‚
â”‚  â”‚                                                         â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## CBP (Customer Portal) Pages

### 1. Dashboard Page

**Route:** `/dashboard`

**Layout:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Header: Welcome back, {firstName}        [Notifications] [Profile] â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Total BOMs  â”‚ â”‚ Pending     â”‚ â”‚ Enriched    â”‚ â”‚ Team    â”‚â”‚
â”‚  â”‚    24       â”‚ â”‚ Enrichment  â”‚ â”‚ Components  â”‚ â”‚ Members â”‚â”‚
â”‚  â”‚             â”‚ â”‚     3       â”‚ â”‚   1,247     â”‚ â”‚    5    â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Quick Actions                                               â”‚
â”‚  [+ Upload BOM] [Search Components] [Invite Team Member]     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Recent BOMs                              [View All â†’]       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Name          â”‚ Status    â”‚ Components â”‚ Updated        â”‚â”‚
â”‚  â”‚ PCB-2024-001  â”‚ Enriched  â”‚ 127        â”‚ 2 hours ago    â”‚â”‚
â”‚  â”‚ Assembly-Q4   â”‚ Pending   â”‚ 89         â”‚ 1 day ago      â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Recent Notifications                     [View All â†’]       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ [icon] BOM enrichment complete for PCB-2024-001  2h ago â”‚â”‚
â”‚  â”‚ [icon] New team member joined: jane@example.com   1d agoâ”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Components:**
- StatCard: Icon, value, label, optional trend indicator
- QuickActionButton: Icon + label, primary/secondary variants
- RecentBOMsTable: Sortable mini-table with status badges
- NotificationList: Icon, message, timestamp, unread indicator

### 2. BOM List Page

**Route:** `/boms`

**Features:**
- Search bar with filters (status, date range, component count)
- Sortable table columns
- Bulk actions (delete, re-enrich, export)
- Pagination (20/50/100 per page)
- Upload button (triggers BOM upload flow)

**Table Columns:**
| Column | Type | Sortable | Filter |
|--------|------|----------|--------|
| Name | Text + link | Yes | Search |
| Status | Badge | Yes | Multi-select |
| Components | Number | Yes | Range |
| Quality Score | Progress bar | Yes | Range |
| Created | Date | Yes | Date range |
| Updated | Relative time | Yes | Date range |
| Actions | Dropdown menu | No | No |

**Status Badges:**
- `draft` - Gray
- `processing` - Blue (animated pulse)
- `enriching` - Amber (animated pulse)
- `enriched` - Green
- `failed` - Red
- `stale` - Orange (>7 days since enrichment)

### 3. BOM Detail Page

**Route:** `/boms/:id`

**Layout:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  â† Back to BOMs                                              â”‚
â”‚  BOM: PCB-2024-001                        [Edit] [Re-Enrich] â”‚
â”‚  Status: Enriched â— | 127 components | Updated 2 hours ago  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Tabs: [Line Items] [Quality Report] [History] [Settings]   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Line Items Table (with enrichment data)                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ # â”‚ MPN      â”‚ Manufacturer â”‚ Qty â”‚ Match â”‚ Price     â”‚â”‚
â”‚  â”‚ 1 â”‚ RC0805.. â”‚ Yageo        â”‚ 100 â”‚ 98%   â”‚ $0.012    â”‚â”‚
â”‚  â”‚ 2 â”‚ ATMEGA.. â”‚ Microchip    â”‚ 5   â”‚ 100%  â”‚ $2.45     â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚  Showing 1-20 of 127 | [< Prev] [1] [2] [3] ... [Next >]    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Enrichment Progress Indicator:**
- Shows during enrichment (real-time updates via WebSocket or polling)
- Progress bar with percentage
- Current activity label ("Matching components...", "Fetching pricing...")
- Estimated time remaining

### 4. BOM Upload Flow

**Route:** `/boms/upload` (or modal overlay)

**Steps:**
1. **File Selection**
   - Drag-and-drop zone
   - File browser button
   - Supported formats: CSV, XLSX, XLS
   - Max file size: 10MB
   - Max rows: 10,000

2. **Column Mapping**
   - Auto-detect common column names
   - Manual mapping dropdown for each column
   - Required fields: MPN, Quantity
   - Optional fields: Manufacturer, Description, Reference Designator

3. **Preview & Validation**
   - Show first 10 rows
   - Highlight validation errors (red rows)
   - Warning for potential issues (yellow rows)
   - Row count summary

4. **Submit**
   - BOM name input
   - Optional description
   - "Upload & Enrich" button
   - Progress indicator during upload

### 5. Team Management Page

**Route:** `/team`

**Sections:**

**Team Members Table:**
| Column | Description |
|--------|-------------|
| Avatar + Name | Profile image, full name |
| Email | User email |
| Role | Badge (analyst/engineer/admin/owner) |
| Status | Active/Pending/Disabled |
| Joined | Date |
| Actions | Edit role, Remove |

**Invite Section:**
- Email input
- Role dropdown (analyst, engineer, admin)
- "Send Invitation" button
- Pending invitations list with resend/cancel actions

### 6. Billing Page

**Route:** `/billing`

**Sections:**

1. **Current Plan Card**
   - Plan name, price, billing cycle
   - Usage meters (if applicable)
   - "Manage Subscription" button â†’ Stripe Portal
   - "Change Plan" button (if allowed)

2. **Payment Methods**
   - List of saved cards (brand icon, last 4, expiry)
   - Default indicator
   - Add new card button (Stripe Elements)
   - Set default / Remove actions

3. **Invoice History**
   - Table: Date, Amount, Status (paid/pending/failed), Download PDF
   - Pagination

---

## Notification UI (Novu Integration)

### Notification Bell Component

**Location:** Header, top-right corner

**States:**
- Default: Bell icon
- Unread: Bell icon + red badge with count (max "9+")
- Active/Open: Blue highlight

**Dropdown Panel:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Notifications                [Mark all read] â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Today                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ â— [icon] BOM enrichment complete   â”‚â”‚
â”‚  â”‚   PCB-2024-001 is ready to review  â”‚â”‚
â”‚  â”‚   2 hours ago                      â”‚â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤â”‚
â”‚  â”‚   [icon] Jane Doe joined your team â”‚â”‚
â”‚  â”‚   Accepted invitation as Engineer  â”‚â”‚
â”‚  â”‚   5 hours ago                      â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Earlier                                â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚   [icon] Payment successful        â”‚â”‚
â”‚  â”‚   Invoice #INV-2024-012 paid       â”‚â”‚
â”‚  â”‚   2 days ago                       â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  [View all notifications â†’]            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Notification Types & Icons

| Trigger ID | Icon | Color | Category |
|------------|------|-------|----------|
| `user-invitation` | UserPlus | Blue | Team |
| `tenant-welcome` | PartyPopper | Green | System |
| `tenant-provisioning-failed` | AlertTriangle | Red | System |
| `payment-failed` | CreditCard | Red | Billing |
| `subscription-created` | CheckCircle | Green | Billing |
| `trial-ending-soon` | Clock | Amber | Billing |
| `bom-enrichment-complete` | Sparkles | Green | BOM |
| `bom-enrichment-failed` | XCircle | Red | BOM |

### Notification Preferences Page

**Route:** `/settings/notifications`

**Layout:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Notification Preferences                                    â”‚
â”‚  Choose how you want to be notified                          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Category          â”‚ In-App â”‚ Email â”‚ Push  â”‚               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Team Updates       â”‚  [âœ“]  â”‚  [âœ“]  â”‚  [ ]  â”‚               â”‚
â”‚  User joined/left   â”‚       â”‚       â”‚       â”‚               â”‚
â”‚  Role changes       â”‚       â”‚       â”‚       â”‚               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  BOM & Enrichment   â”‚  [âœ“]  â”‚  [âœ“]  â”‚  [âœ“]  â”‚               â”‚
â”‚  Enrichment completeâ”‚       â”‚       â”‚       â”‚               â”‚
â”‚  Enrichment failed  â”‚       â”‚       â”‚       â”‚               â”‚
â”‚  Stale BOM alerts   â”‚       â”‚       â”‚       â”‚               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Billing            â”‚  [âœ“]  â”‚  [âœ“]  â”‚  [ ]  â”‚               â”‚
â”‚  Payment successful â”‚       â”‚       â”‚       â”‚               â”‚
â”‚  Payment failed     â”‚       â”‚       â”‚       â”‚               â”‚
â”‚  Trial ending       â”‚       â”‚       â”‚       â”‚               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                          [Save Preferences] â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Toast Notifications

**For immediate feedback on actions:**

| Type | Style | Duration | Dismissible |
|------|-------|----------|-------------|
| Success | Green left border, check icon | 4s | Yes |
| Error | Red left border, X icon | 8s | Yes |
| Warning | Amber left border, alert icon | 6s | Yes |
| Info | Blue left border, info icon | 4s | Yes |

**Toast Anatomy:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ [Icon] Title                     [Ã—] â”‚
â”‚        Description message           â”‚
â”‚        [Action Button]               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Real-Time Notification Updates

**Implementation:**
- Novu React SDK (`@novu/notification-center`)
- WebSocket connection for real-time updates
- Fallback: Polling every 30 seconds

**Integration Points:**
```typescript
// Novu configuration
const novuConfig = {
  applicationIdentifier: '<your-novu-app-id>',
  subscriberId: userId,
  backendUrl: 'http://localhost:13100',
  socketUrl: 'http://localhost:13101',
};
```

---

## Component Library

### Core Components to Build

| Component | Priority | Variants |
|-----------|----------|----------|
| Button | P0 | primary, secondary, ghost, destructive, sizes: sm/md/lg |
| Input | P0 | text, email, password, search, with icons |
| Select | P0 | single, multi, searchable, async |
| Table | P0 | sortable, selectable, paginated, expandable |
| Card | P0 | default, interactive, stat |
| Badge | P0 | status colors, sizes |
| Modal/Dialog | P0 | sizes, with form, confirmation |
| Toast | P0 | success, error, warning, info |
| Dropdown Menu | P0 | with icons, nested |
| Tabs | P1 | horizontal, vertical, with badges |
| Progress | P1 | bar, circular, with label |
| Avatar | P1 | image, initials, with status |
| Tooltip | P1 | positions, rich content |
| Alert | P1 | info, success, warning, error |
| Skeleton | P1 | text, card, table row |
| Empty State | P1 | with icon, action |
| File Upload | P1 | drag-drop, progress |
| Date Picker | P2 | single, range |
| Charts | P2 | line, bar, pie, area |

### Compound Components

| Component | Description |
|-----------|-------------|
| PageHeader | Title, breadcrumb, actions |
| DataTable | Table with filters, pagination, bulk actions |
| FormSection | Grouped form fields with header |
| StatCard | Icon, value, label, trend |
| NotificationBell | Bell icon with badge and dropdown |
| UserMenu | Avatar with dropdown for profile/logout |
| SideNav | Collapsible navigation with icons |
| CommandPalette | Global search (Cmd/Ctrl+K) |

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color Contrast | Minimum 4.5:1 for text, 3:1 for UI components |
| Focus Indicators | 2px solid ring, visible on all interactive elements |
| Keyboard Navigation | Full keyboard access, logical tab order |
| Screen Reader | ARIA labels, landmarks, live regions |
| Motion | Respect `prefers-reduced-motion` |
| Text Scaling | Support up to 200% zoom without horizontal scroll |

### Focus States

```css
/* Default focus ring */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Skip to content link */
.skip-link:focus {
  position: fixed;
  top: 4px;
  left: 4px;
  z-index: 9999;
}
```

### ARIA Patterns

| Component | ARIA Pattern |
|-----------|--------------|
| Modal | `role="dialog"`, `aria-modal="true"`, focus trap |
| Tabs | `role="tablist"`, `role="tab"`, `role="tabpanel"` |
| Dropdown | `role="menu"`, `role="menuitem"`, `aria-expanded` |
| Toast | `role="alert"`, `aria-live="polite"` |
| Table | `role="grid"`, sortable column headers |

---

## Responsive Design

### Breakpoints

| Name | Width | Target |
|------|-------|--------|
| xs | < 640px | Mobile portrait |
| sm | 640px+ | Mobile landscape |
| md | 768px+ | Tablet |
| lg | 1024px+ | Desktop |
| xl | 1280px+ | Large desktop |
| 2xl | 1536px+ | Ultra-wide |

### Mobile Adaptations

| Desktop Feature | Mobile Adaptation |
|-----------------|-------------------|
| Side navigation | Bottom tab bar or hamburger menu |
| Data tables | Card list or horizontal scroll |
| Multi-column forms | Single column stack |
| Hover tooltips | Long-press or tap to reveal |
| Bulk actions toolbar | Floating action button |

---

## Dark Mode Support

### Theme Tokens

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` | `#ffffff` | `#0a0a1a` |
| `--bg-secondary` | `#f9fafb` | `#111827` |
| `--bg-tertiary` | `#f3f4f6` | `#1f2937` |
| `--text-primary` | `#111827` | `#f9fafb` |
| `--text-secondary` | `#6b7280` | `#9ca3af` |
| `--border` | `#e5e7eb` | `#374151` |

### Implementation

```typescript
// Theme variants (from existing admin-app)
type Theme = 'light' | 'dark' | 'mid-light' | 'mid-dark' | 'system';

// Tailwind selector
darkMode: ['selector', ':is([data-theme="dark"], [data-theme="mid-dark"])']
```

---

## Motion & Animation

### Timing Functions

| Name | Easing | Duration | Usage |
|------|--------|----------|-------|
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 150ms | Exit animations |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | 150ms | Entry animations |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 200ms | State changes |

### Animation Examples

| Element | Animation | Duration |
|---------|-----------|----------|
| Modal open | Fade in + scale up | 200ms |
| Modal close | Fade out + scale down | 150ms |
| Toast enter | Slide in from right | 200ms |
| Toast exit | Fade out | 150ms |
| Dropdown open | Fade in + slide down | 150ms |
| Skeleton pulse | Opacity 0.5 â†’ 1 â†’ 0.5 | 1500ms loop |
| Button hover | Scale 1.02 | 100ms |
| Spinner | Rotate 360deg | 1000ms loop |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Developer Handoff

### Design Tokens Export

```json
{
  "colors": {
    "primary": { "50": "#eef2ff", "600": "#4f46e5", "700": "#4338ca" },
    "success": { "500": "#10b981" },
    "error": { "500": "#ef4444", "600": "#dc2626" },
    "warning": { "500": "#f59e0b" }
  },
  "spacing": { "1": "4px", "2": "8px", "4": "16px", "6": "24px", "8": "32px" },
  "borderRadius": { "sm": "4px", "md": "6px", "lg": "8px", "full": "9999px" },
  "fontSize": { "xs": "12px", "sm": "14px", "base": "16px", "lg": "18px" }
}
```

### Component Specification Template

```markdown
## ComponentName

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | 'primary' \| 'secondary' | 'primary' | Visual style |
| size | 'sm' \| 'md' \| 'lg' | 'md' | Component size |

### States
- Default
- Hover
- Active/Pressed
- Focus
- Disabled
- Loading

### Accessibility
- Keyboard: [Tab] to focus, [Enter/Space] to activate
- ARIA: role="button", aria-disabled, aria-busy

### Usage
\`\`\`tsx
<Button variant="primary" size="md" onClick={handleClick}>
  Click me
</Button>
\`\`\`
```

---

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Set up design tokens in Tailwind config
- [ ] Implement core components (Button, Input, Card, Badge)
- [ ] Build layout components (PageHeader, SideNav)
- [ ] Create theme system with dark mode

### Phase 2: Data Display (Week 3-4)
- [ ] Build DataTable component with pagination
- [ ] Implement form components (Select, DatePicker)
- [ ] Create modal/dialog system
- [ ] Add toast notification system

### Phase 3: Features (Week 5-6)
- [ ] Dashboard page
- [ ] BOM list and detail pages
- [ ] BOM upload flow
- [ ] Team management page

### Phase 4: Notifications & Polish (Week 7-8)
- [ ] Novu notification center integration
- [ ] Notification preferences page
- [ ] Command palette (global search)
- [ ] Accessibility audit and fixes
- [ ] Performance optimization

---

## Novu Quick Reference

| Item | Value |
|------|-------|
| **API URL** | http://localhost:13100 |
| **WebSocket URL** | http://localhost:13101 |
| **Dashboard URL** | http://localhost:14200 |
| **App Identifier** | <your-novu-app-id> |
| **API Key** | <your-novu-api-key> |

### Available Triggers
- `user-invitation` - User invited to tenant
- `tenant-welcome` - Tenant provisioned
- `tenant-provisioning-failed` - Provisioning error
- `payment-failed` - Payment failed
- `subscription-created` - New subscription
- `trial-ending-soon` - Trial expiry reminder

---

*Document Version: 1.1*
*Created: December 14, 2024*
*Updated: December 14, 2024*
*For: UI Designer Agent / Frontend Development Team*
*Change Log: v1.1 - Added Admin Portal (A1-A13) page specifications*
