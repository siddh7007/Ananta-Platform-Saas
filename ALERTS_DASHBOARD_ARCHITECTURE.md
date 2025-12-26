# Alerts Dashboard - Architecture Diagram

## Component Hierarchy

```
AlertsDashboardPage (Main Container)
│
├── Header Section
│   ├── Title & Description
│   ├── Refresh Button
│   └── Configure Alerts Button → Opens AlertPreferencesDialog
│
├── AlertStatsCards
│   ├── Critical Card (red)
│   ├── High Card (orange)
│   ├── Medium Card (yellow)
│   └── Low Card (blue)
│
├── AlertFilters (Filter Bar)
│   ├── Search Input
│   ├── Status Select
│   ├── Severity Select
│   ├── Type Select
│   ├── Date Range Picker
│   └── Clear Filters Button
│
├── Bulk Actions Bar (conditional - shown when alerts selected)
│   ├── Selection Count
│   ├── Mark as Read Button
│   └── Dismiss Button
│
├── AlertsTable
│   ├── Table Header
│   │   ├── Select All Checkbox
│   │   ├── Alert Column
│   │   ├── Type Column
│   │   ├── Severity Column
│   │   ├── Date Column
│   │   └── Actions Column
│   │
│   └── Table Rows (for each alert)
│       ├── Select Checkbox
│       ├── Alert Info (title, message, component/BOM)
│       ├── AlertBadge (type)
│       ├── AlertBadge (severity)
│       ├── Relative Date
│       └── Action Buttons (view, mark read, dismiss)
│
├── Pagination Controls
│   ├── Results Info
│   ├── Previous Button
│   ├── Page Numbers (1-5)
│   └── Next Button
│
├── AlertDetailSheet (Side Panel)
│   ├── Sheet Header
│   │   ├── Alert Title
│   │   ├── Alert Message
│   │   └── Badges (severity + type)
│   │
│   ├── Details Section
│   │   ├── Created Date
│   │   ├── Read Date (if read)
│   │   ├── Component Info (if applicable)
│   │   └── BOM Info (if applicable)
│   │
│   ├── Metadata Section (if metadata exists)
│   │   └── Key-Value Pairs
│   │
│   └── Actions Section
│       ├── Mark as Read Button
│       ├── View Component Button (if applicable)
│       ├── View BOM Button (if applicable)
│       └── Dismiss Alert Button
│
└── AlertPreferencesDialog
    ├── Dialog Header
    │   ├── Title
    │   └── Description
    │
    ├── Alert Types Section
    │   ├── LIFECYCLE Checkbox
    │   ├── RISK Checkbox
    │   ├── PRICE Checkbox
    │   ├── AVAILABILITY Checkbox
    │   ├── COMPLIANCE Checkbox
    │   ├── PCN Checkbox
    │   └── SUPPLY_CHAIN Checkbox
    │
    ├── Email Frequency Select
    │   ├── Immediate
    │   ├── Daily Digest
    │   ├── Weekly Digest
    │   └── Never
    │
    ├── Thresholds Section
    │   ├── Risk Score Input
    │   ├── Price Change % Input
    │   └── Lead Time Days Input
    │
    ├── Notification Channels Section
    │   ├── Email Checkbox
    │   ├── In-App Checkbox
    │   └── Slack Checkbox
    │
    └── Dialog Footer
        ├── Cancel Button
        └── Save Button
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     AlertsDashboardPage                         │
│                                                                 │
│  State:                                                         │
│  - filters (page, limit, sort, status, severity, type, dates)  │
│  - selectedIds (Set<string>)                                   │
│  - selectedAlert (Alert | null)                                │
│  - detailSheetOpen (boolean)                                   │
│  - preferencesOpen (boolean)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Custom Hooks (useAlerts)                   │
│                                                                 │
│  Query Hooks:                                                   │
│  - useAlerts(filters) → TanStack Query                         │
│  - useAlertStats() → TanStack Query                            │
│                                                                 │
│  Mutation Hooks:                                               │
│  - useMarkAlertAsRead() → TanStack Mutation (optimistic)       │
│  - useDismissAlert() → TanStack Mutation (optimistic)          │
│  - useMarkAlertsAsRead() → TanStack Mutation                   │
│  - useDismissAlerts() → TanStack Mutation                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Alert Service (alert.service.ts)              │
│                                                                 │
│  API Calls:                                                     │
│  - getAlerts(filters) → GET /alerts                            │
│  - getAlertStats() → GET /alerts/stats                         │
│  - markAlertAsRead(id) → PATCH /alerts/:id/read                │
│  - dismissAlert(id) → DELETE /alerts/:id                       │
│  - updateAlertPreferences() → PUT /alerts/preferences          │
│                                                                 │
│  All methods use:                                              │
│  - cnsApi (axios instance)                                     │
│  - assertTenantContext() (multi-tenant isolation)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CNS API (Backend Service)                   │
│                                                                 │
│  Endpoints (TO BE IMPLEMENTED):                                │
│  - GET /alerts                                                 │
│  - GET /alerts/stats                                           │
│  - PATCH /alerts/:id/read                                      │
│  - DELETE /alerts/:id                                          │
│  - PUT /alerts/preferences                                     │
└─────────────────────────────────────────────────────────────────┘
```

## User Interaction Flow

```
1. User Visits Dashboard
   │
   ├─→ Filters Applied
   │   │
   │   ├─→ useAlerts hook fetches data
   │   │   └─→ AlertsTable displays results
   │   │
   │   └─→ useAlertStats hook fetches stats
   │       └─→ AlertStatsCards displays summary
   │
   ├─→ User Clicks Alert Row
   │   └─→ AlertDetailSheet opens with alert details
   │       │
   │       ├─→ User clicks "Mark as Read"
   │       │   └─→ useMarkAlertAsRead mutation
   │       │       ├─→ Optimistic update (instant UI)
   │       │       ├─→ API call to mark as read
   │       │       └─→ Revalidate queries on success
   │       │
   │       ├─→ User clicks "View Component"
   │       │   └─→ Navigate to /components/:id
   │       │
   │       └─→ User clicks "Dismiss"
   │           └─→ useDismissAlert mutation
   │               ├─→ Optimistic update (remove from list)
   │               ├─→ API call to dismiss
   │               └─→ Revalidate queries on success
   │
   ├─→ User Selects Multiple Alerts
   │   │
   │   ├─→ Bulk Actions Bar appears
   │   │
   │   ├─→ User clicks "Mark as Read"
   │   │   └─→ useMarkAlertsAsRead mutation
   │   │       └─→ Batch API call
   │   │
   │   └─→ User clicks "Dismiss"
   │       └─→ useDismissAlerts mutation
   │           └─→ Batch API call with confirmation
   │
   └─→ User Clicks "Configure Alerts"
       └─→ AlertPreferencesDialog opens
           │
           ├─→ useAlertPreferences fetches current settings
           │
           └─→ User modifies preferences and saves
               └─→ useUpdateAlertPreferences mutation
                   └─→ API call to save preferences
```

## Alert Types & Business Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                        Alert Types                              │
└─────────────────────────────────────────────────────────────────┘

1. LIFECYCLE
   Trigger: Component lifecycle status changes
   Examples:
   - Component marked as EOL (End of Life)
   - Component marked as NRND (Not Recommended for New Designs)
   - Component marked as obsolete

   Metadata:
   - componentId, componentMpn, manufacturer
   - oldStatus, newStatus
   - effectiveDate

2. RISK
   Trigger: Component risk score exceeds threshold
   Examples:
   - BOM risk score increased from 45 to 85
   - Component added with high risk score

   Metadata:
   - componentId, bomId
   - oldScore, newScore
   - riskFactors (array of contributing factors)

3. PRICE
   Trigger: Price change exceeds threshold percentage
   Examples:
   - Component price increased by 25%
   - Volume pricing tier changed

   Metadata:
   - componentId, supplier
   - oldPrice, newPrice
   - percentageChange
   - effectiveDate

4. AVAILABILITY
   Trigger: Stock level or lead time changes
   Examples:
   - Component stock below threshold
   - Lead time increased from 8 to 16 weeks
   - Component out of stock at preferred supplier

   Metadata:
   - componentId, supplier
   - oldStock, newStock
   - oldLeadTime, newLeadTime

5. COMPLIANCE
   Trigger: Regulatory status changes
   Examples:
   - New RoHS restriction
   - REACH compliance update
   - Export control classification changed

   Metadata:
   - componentId
   - regulationType (RoHS, REACH, ITAR, etc.)
   - changeDescription

6. PCN (Product Change Notification)
   Trigger: Manufacturer issues PCN
   Examples:
   - Package change notification
   - Material change
   - Manufacturing location change

   Metadata:
   - componentId, manufacturer
   - pcnNumber
   - changeType
   - effectiveDate
   - affectedDateCodes

7. SUPPLY_CHAIN
   Trigger: Supply chain disruptions detected
   Examples:
   - Supplier facility closure
   - Shipping delays
   - Geopolitical issues affecting supply

   Metadata:
   - affectedComponents (array)
   - disruptionType
   - estimatedImpact
   - resolution (expected or actual)
```

## Severity Classification

```
┌─────────────────────────────────────────────────────────────────┐
│                    Severity Assignment Logic                    │
└─────────────────────────────────────────────────────────────────┘

CRITICAL
- Immediate action required
- Examples:
  • Component obsolescence (already in production)
  • Stock-out of critical component
  • Compliance violation requiring immediate redesign
  • PCN requiring immediate response

HIGH
- Action required within days
- Examples:
  • Risk score > 80
  • Price increase > 50%
  • Lead time > 26 weeks
  • NRND notification (6 months to EOL)

MEDIUM
- Action required within weeks
- Examples:
  • Risk score 60-80
  • Price increase 25-50%
  • Lead time 13-26 weeks
  • PCN with 6+ months notice

LOW
- Informational, action within months
- Examples:
  • Risk score 40-60
  • Price increase 10-25%
  • Minor compliance updates
  • General supply chain updates

INFO
- No action required, for awareness
- Examples:
  • Risk score < 40
  • Price decrease
  • Improved availability
  • Datasheet updates
```

## Performance Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                    Caching & Optimization                       │
└─────────────────────────────────────────────────────────────────┘

Query Stale Times:
- Alert list: 1 minute (frequent updates expected)
- Alert stats: 2 minutes (less frequent changes)
- Alert detail: 5 minutes (individual alert stable)
- Preferences: 10 minutes (rarely changes)
- Watch list: 5 minutes (occasionally modified)

Optimistic Updates:
- Mark as read: Instant UI update, rollback on error
- Dismiss: Instant removal from list, rollback on error
- Bulk operations: Show loading state, invalidate on success

Pagination:
- Default: 20 alerts per page
- Prevents loading thousands of alerts at once
- Server-side filtering and sorting

Cache Invalidation Strategy:
- After mark as read: Invalidate all alert queries
- After dismiss: Invalidate all alert queries
- After preferences update: Invalidate preferences only
- After watch/unwatch: Invalidate watch list only
```

## Future Enhancements

1. **Real-time Updates**
   - WebSocket connection for live alert notifications
   - Toast notifications for new critical alerts
   - Badge count updates without refresh

2. **Advanced Filtering**
   - Saved filter presets
   - Custom filter combinations
   - Filter by BOM, project, or component

3. **Alert Rules Engine**
   - User-defined alert conditions
   - Custom severity thresholds
   - Alert suppression rules

4. **Analytics Dashboard**
   - Alert trends over time
   - Most common alert types
   - Response time metrics
   - Alert resolution tracking

5. **Integration Enhancements**
   - Slack notifications
   - Microsoft Teams integration
   - Email digest customization
   - Mobile push notifications

6. **Workflow Automation**
   - Auto-dismiss based on conditions
   - Auto-create tasks from alerts
   - Integration with issue tracking systems
   - Approval workflows for alert actions
