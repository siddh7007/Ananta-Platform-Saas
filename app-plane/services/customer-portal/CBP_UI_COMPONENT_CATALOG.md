# Customer Business Portal (CBP) - UI Component Catalog

**Generated:** 2025-12-14
**Location:** `e:\Work\Ananta-Platform-Saas\app-plane\services\customer-portal`
**Version:** 1.0.0

---

## Table of Contents

1. [Design System Overview](#design-system-overview)
2. [UI Libraries & Dependencies](#ui-libraries--dependencies)
3. [Component Catalog](#component-catalog)
4. [Form Elements](#form-elements)
5. [Data Display](#data-display)
6. [Feedback Components](#feedback-components)
7. [Layout Components](#layout-components)
8. [Mobile & Accessibility](#mobile--accessibility)
9. [BOM-Specific Components](#bom-specific-components)
10. [Design Patterns](#design-patterns)

---

## Design System Overview

### Color Palette

#### Primary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Primary | `#3b82f6` (blue-500) | Main brand, CTAs, links |
| Primary Light | `#60a5fa` (blue-400) | Hover states, backgrounds |
| Primary Dark | `#2563eb` (blue-600) | Active states |
| Secondary | `#8b5cf6` (purple-500) | Accents, secondary actions |
| Secondary Light | `#a78bfa` (purple-400) | Hover backgrounds |
| Secondary Dark | `#7c3aed` (purple-600) | Active states |

#### Semantic Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Success | `#22c55e` (green-500) | Success states, positive indicators |
| Warning | `#f59e0b` (amber-500) | Warning states, medium priority |
| Error | `#ef4444` (red-500) | Error states, critical alerts |
| Info | `#3b82f6` (blue-500) | Informational messages |

#### Risk Colors (Custom Tokens)
| Risk Level | Hex | Usage |
|------------|-----|-------|
| Low | `#4caf50` (green) | Healthy/safe components |
| Medium | `#ff9800` (orange) | Attention needed |
| High | `#f44336` (red) | Significant risk |
| Critical | `#9c27b0` (purple) | Urgent action required |

#### Risk Factor Colors
| Factor | Hex | Usage |
|--------|-----|-------|
| Lifecycle | `#2196f3` (blue) | EOL/lifecycle status |
| Supply Chain | `#ff9800` (orange) | Availability/lead times |
| Compliance | `#4caf50` (green) | Regulatory compliance |
| Obsolescence | `#f44336` (red) | Obsolescence prediction |
| Single Source | `#9c27b0` (purple) | Supplier diversity |

#### Grade Colors
| Grade | Hex | Meaning |
|-------|-----|---------|
| A | `#4caf50` (green) | Excellent |
| B | `#8bc34a` (light green) | Good |
| C | `#ff9800` (orange) | Fair |
| D | `#f44336` (red) | Poor |
| F | `#9c27b0` (purple) | Critical |

#### Workflow Status Colors
| Status | Hex | Usage |
|--------|-----|-------|
| Pending | `#9E9E9E` (gray) | Awaiting action |
| Processing | `#2196F3` (blue) | In progress |
| Completed | `#4CAF50` (green) | Successfully finished |
| Failed | `#f44336` (red) | Error state |
| Cancelled | `#757575` (dark gray) | User cancelled |
| Mapping Pending | `#FFC107` (yellow) | Awaiting mapping |

#### Alert Type Colors
| Type | Hex | Usage |
|------|-----|-------|
| LIFECYCLE | `#2196f3` (blue) | Component lifecycle changes |
| RISK | `#ff9800` (orange) | Risk score changes |
| PRICE | `#4caf50` (green) | Price changes |
| AVAILABILITY | `#9c27b0` (purple) | Stock/availability |
| COMPLIANCE | `#f44336` (red) | Regulatory compliance |
| PCN | `#607d8b` (blue-grey) | PCN/PDN notices |
| SUPPLY_CHAIN | `#795548` (brown) | Supply chain disruptions |

#### Grey Scale
| Name | Hex | Usage |
|------|-----|-------|
| Grey 50 | `#f9fafb` | Background default |
| Grey 100 | `#f3f4f6` | Section backgrounds |
| Grey 200 | `#e5e7eb` | Dividers, borders |
| Grey 300 | `#d1d5db` | Disabled borders |
| Grey 400 | `#9ca3af` | Disabled text |
| Grey 500 | `#6b7280` | Secondary text |
| Grey 600 | `#4b5563` | - |
| Grey 700 | `#374151` | - |
| Grey 800 | `#1f2937` | - |
| Grey 900 | `#111827` | Primary text |

### Typography Scale

#### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

#### Headings
| Variant | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| h1 | 2.5rem (40px) | 700 | 1.2 | Page titles |
| h2 | 2rem (32px) | 700 | 1.25 | Section headers |
| h3 | 1.75rem (28px) | 600 | 1.3 | Subsection headers |
| h4 | 1.5rem (24px) | 600 | 1.35 | Card titles |
| h5 | 1.25rem (20px) | 600 | 1.4 | Small headers |
| h6 | 1.125rem (18px) | 600 | 1.4 | Smallest headers |

#### Body Text
| Variant | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| body1 | 1rem (16px) | 400 | 1.5 | Default body text |
| body2 | 0.875rem (14px) | 400 | 1.5 | Secondary text, descriptions |
| caption | 0.75rem (12px) | 400 | 1.4 | Captions, helper text |
| overline | 0.6875rem (11px) | 600 | 1.4 | Labels, uppercase |

#### Custom Typography Tokens
| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| pageTitle | 2rem (32px) | 700 | Main page titles |
| sectionTitle | 1.5rem (24px) | 600 | Section headers |
| cardTitle | 1.125rem (18px) | 600 | Card headers |
| metricValue | 2rem (32px) | 700 | Large metric numbers |
| metricLabel | 0.75rem (12px) | 600 | Metric descriptions |
| chipLabel | 0.6875rem (11px) | 600 | Chip text |
| badgeLabel | 0.625rem (10px) | 700 | Badge text |

### Spacing Scale

Based on 8px unit system:

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| xxs | 0.5 | 4px | Tight spacing within components |
| xs | 1 | 8px | Default internal padding |
| sm | 1.5 | 12px | Comfortable internal spacing |
| md | 2 | 16px | Section spacing |
| lg | 3 | 24px | Card padding |
| xl | 4 | 32px | Section gaps |
| xxl | 6 | 48px | Page section spacing |

#### Touch-Friendly Spacing (Mobile/Tablet)
| Token | Value | Usage |
|-------|-------|-------|
| touch-sm | 44px | Minimum iOS guideline |
| touch | 48px | Recommended minimum |
| touch-lg | 56px | Comfortable touch target |

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Small elements (chips, badges) |
| sm | 8px | Buttons, inputs |
| md | 12px | Cards, dialogs |
| lg | 16px | Large containers |
| xl | 24px | Hero sections |
| full | 9999px | Circular elements |

### Shadow/Elevation Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Subtle elevation |
| sm | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | Cards (default) |
| md | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | Elevated cards |
| lg | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | Modals, dialogs |
| xl | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | Dropdowns, popovers |

### Responsive Breakpoints

| Name | Value | Device |
|------|-------|--------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet portrait (iPad Mini) |
| lg | 1024px | Tablet landscape (iPad Pro 11") |
| xl | 1280px | Desktop / iPad Pro 12.9" landscape |
| 2xl | 1536px | Large desktop |
| tablet | 768px | Custom tablet breakpoint |
| tablet-lg | 1024px | Large tablet breakpoint |

---

## UI Libraries & Dependencies

### Core UI Libraries

| Library | Version | Purpose | Usage Count |
|---------|---------|---------|-------------|
| @mui/material | ^5.15.6 | Primary component library | Extensive (90%+ of components) |
| @mui/icons-material | ^5.15.6 | Icon library | 100+ icons used |
| @mui/x-data-grid | ^8.20.0 | Advanced tables | BOM tables, lists |
| @mui/x-date-pickers | ^8.19.0 | Date inputs | Alert filters, reports |
| @radix-ui/* | ^1.0.x-^2.0.x | Headless UI primitives | 5 files (dialogs, dropdowns, tooltips) |
| lucide-react | ^0.303.0 | Icon library (secondary) | Dashboard widgets, trends |
| react-admin | ^4.16.9 | Admin framework | Resource management |
| recharts | ^3.3.0 | Charts and graphs | Dashboard, analytics |
| react-dropzone | ^14.3.8 | File uploads | BOM upload |

### Design System Strategy

**Hybrid Approach:**
- **Primary:** Material-UI (MUI) - 90% of components
- **Headless Primitives:** Radix UI for specific low-level controls (5 components)
- **Icons:** MUI Icons (primary), Lucide React (dashboard/modern icons)
- **Custom:** Theme tokens extending MUI for semantic colors (risk, alerts, grades)

**No** dedicated UI component library like shadcn/ui - using **MUI + custom theme tokens**

---

## Component Catalog

### Core Shared Components

#### StatusChip
**Location:** `src/components/shared/StatusChip.tsx`

**Purpose:** Consistent status badges using theme tokens for semantic colors

**Variants:**
- Risk levels: low, medium, high, critical
- Grades: A, B, C, D, F
- Workflow status: pending, processing, completed, failed, cancelled
- Alert types: LIFECYCLE, RISK, PRICE, AVAILABILITY, COMPLIANCE, PCN, SUPPLY_CHAIN
- Alert severity: info, warning, critical
- Custom: user-defined color

**Props:**
```typescript
interface StatusChipProps {
  status: StatusType;
  label?: string;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  icon?: React.ReactElement;
  onClick?: () => void;
  chipProps?: Partial<ChipProps>;
}
```

**Convenience Components:**
- `RiskChip` - Risk level badges
- `GradeChip` - Grade badges (A-F)
- `WorkflowChip` - Workflow status
- `AlertTypeChip` - Alert category badges
- `SeverityChip` - Alert severity

**Example:**
```tsx
<StatusChip status={{ category: 'risk', value: 'high' }} />
<RiskChip level="critical" size="small" />
<WorkflowChip status="processing" icon={<ProcessingIcon />} />
```

---

#### MetricCard
**Location:** `src/components/shared/MetricCard.tsx`

**Purpose:** Reusable card for displaying metrics with optional trend indicators

**Features:**
- Semantic color support via theme tokens
- Trend indicators (up/down/neutral)
- Loading skeleton state
- Compact and standard variants
- Clickable cards with hover effects

**Props:**
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default';
  customColor?: string;
  trend?: TrendDirection;
  trendValue?: string;
  trendPositive?: boolean;
  loading?: boolean;
  compact?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: 'outlined' | 'elevation';
}
```

**Example:**
```tsx
<MetricCard
  title="High Risk Components"
  value={42}
  color="error"
  trend="up"
  trendValue="+5%"
  trendPositive={false}
/>
```

**Also in:** `src/components/dashboard/widgets/MetricCard.tsx` (CSS-based variant for dashboard)

---

#### FilterToolbar
**Location:** `src/components/shared/FilterToolbar.tsx`

**Purpose:** Unified filter bar for consistent filtering across pages

**Features:**
- Multiple filter types: select, search, date range
- Responsive layout
- Clear all filters action
- Optional refresh and export buttons
- Active filter count badge

**Props:**
```typescript
interface FilterToolbarProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (key: string, value: string) => void;
  onClear?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  refreshing?: boolean;
  showActiveCount?: boolean;
  compact?: boolean;
}
```

**Example:**
```tsx
<FilterToolbar
  filters={[
    { key: 'status', label: 'Status', type: 'select', options: statusOptions },
    { key: 'search', label: 'Search', type: 'search', placeholder: 'Search...' },
    { key: 'date', label: 'Date', type: 'date' }
  ]}
  values={filterValues}
  onChange={handleFilterChange}
  onClear={handleClearFilters}
  onRefresh={handleRefresh}
/>
```

---

#### LoadingState
**Location:** `src/components/shared/LoadingState.tsx`

**Purpose:** Consistent loading states across the application

**Variants:**
- `spinner` - Circular progress indicator
- `inline` - Small inline spinner for buttons/fields
- `skeleton` - Text skeleton rows
- `card-skeleton` - Card grid skeleton
- `table-skeleton` - Table row skeleton

**Props:**
```typescript
interface LoadingStateProps {
  variant?: LoadingVariant;
  message?: string;
  height?: string | number;
  count?: number;
  columns?: number;
  centered?: boolean;
  spinnerSize?: number;
}
```

**Convenience Exports:**
- `PageLoading` - Full page spinner (50vh height)
- `CardGridLoading` - Card grid skeleton
- `TableLoading` - Table skeleton
- `InlineSpinner` - Small inline spinner

**Example:**
```tsx
<LoadingState variant="spinner" message="Loading data..." />
<PageLoading />
<CardGridLoading count={4} columns={4} />
<InlineSpinner message="Saving..." />
```

---

#### EmptyState
**Location:** `src/components/EmptyState.tsx`

**Purpose:** Reusable empty state component with icon, message, and action

**Features:**
- Customizable icon
- Primary and secondary actions
- Card and inline variants
- Routing support with React Router

**Props:**
```typescript
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  actionOnClick?: () => void;
  secondaryActionLabel?: string;
  secondaryActionTo?: string;
  variant?: 'card' | 'inline';
}
```

**Example:**
```tsx
<EmptyState
  icon={<InboxIcon sx={{ fontSize: 64 }} />}
  title="No BOMs yet"
  description="Upload your first BOM to get started"
  actionLabel="Upload BOM"
  actionTo="/boms/upload"
  variant="card"
/>
```

---

#### ContextualBanner
**Location:** `src/components/shared/ContextualBanner.tsx`

**Purpose:** Dismissible notification banners for contextual guidance, tips, and announcements

**Features:**
- Persistent dismissal state via analytics service
- Session-based "show once" option
- Multiple variants with semantic colors
- Action buttons and links

**Variants:**
- `info` - Informational (blue)
- `tip` - Tips and guidance (yellow/amber)
- `announcement` - Announcements (primary blue)
- `feature` - New features (purple)
- `warning` - Warnings (orange)
- `success` - Success confirmations (green)

**Props:**
```typescript
interface ContextualBannerProps {
  id: string;
  variant?: BannerVariant;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  link?: { label: string; href: string; external?: boolean };
  dismissible?: boolean;
  showOnce?: boolean;
  icon?: React.ReactNode;
  compact?: boolean;
  onDismiss?: () => void;
  onActionClick?: () => void;
}
```

**Pre-configured Components:**
- `FeatureBanner` - New feature announcements
- `TipBanner` - Contextual tips (compact)
- `WarningBanner` - Important notices
- `SuccessBanner` - Success confirmations (auto-dismiss option)
- `BomUploadTipBanner` - BOM upload tips
- `SearchGuideBanner` - Search guide
- `RiskDashboardIntroBanner` - Risk scoring explanation
- `AlertConfigBanner` - Alert configuration nudge
- `TrialExpirationBanner` - Trial expiration warning
- `MfaRecommendationBanner` - MFA security recommendation

**Example:**
```tsx
<ContextualBanner
  id="onboarding_tip"
  variant="tip"
  title="Quick tip"
  description="Use keyboard shortcuts to navigate faster"
  dismissible
/>

<TrialExpirationBanner daysRemaining={3} onUpgrade={handleUpgrade} />
```

---

#### NextActionDrawer
**Location:** `src/components/shared/NextActionDrawer.tsx`

**Purpose:** Side drawer showing recommended next actions and quick links

**Features:**
- Context-aware action suggestions
- Quick navigation shortcuts
- Dismissible with animation

---

#### ConfirmCascadeDialog
**Location:** `src/components/shared/ConfirmCascadeDialog.tsx`

**Purpose:** Confirmation dialog for cascade delete operations

**Features:**
- Impact preview
- Cascade effect explanation
- Strict mode for testing

---

### Dashboard Components

#### DashboardGrid
**Location:** `src/components/dashboard/DashboardGrid.tsx`

**Purpose:** Responsive grid layout for dashboard widgets

---

#### ActivityChart
**Location:** `src/components/dashboard/widgets/ActivityChart.tsx`

**Purpose:** Time-series chart for activity data using Recharts

---

#### ActivityFeed
**Location:** `src/components/dashboard/widgets/ActivityFeed.tsx`

**Purpose:** Real-time activity feed widget

---

#### AlertsList
**Location:** `src/components/dashboard/widgets/AlertsList.tsx`

**Purpose:** Recent alerts widget for dashboard

---

#### RiskDistributionChart
**Location:** `src/components/dashboard/widgets/RiskDistributionChart.tsx`

**Purpose:** Risk level distribution pie/bar chart

---

#### ExportButton
**Location:** `src/components/dashboard/widgets/ExportButton.tsx`

**Purpose:** Reusable export button with format selection

---

### Skeleton Components

All located in `src/components/dashboard/skeletons/`:

| Component | Purpose |
|-----------|---------|
| MetricCardSkeleton | Loading placeholder for metric cards |
| ChartSkeleton | Loading placeholder for charts |
| ActivityFeedSkeleton | Loading placeholder for activity feed |
| AlertsListSkeleton | Loading placeholder for alerts list |

---

### Field Components

#### RiskLevelField
**Location:** `src/components/fields/RiskLevelField.tsx`

**Purpose:** React Admin field for displaying risk levels with color-coded badges

**Color Mapping:**
- GREEN → Success (green) - Low Risk
- YELLOW → Warning (yellow) - Medium Risk
- ORANGE → Error (orange-400) - High Risk
- RED → Error (red-500) - Critical Risk
- NONE → Default (gray) - Not Assessed

**Props:**
```typescript
interface RiskLevelFieldProps {
  source?: string;
  label?: string;
}
```

**Example:**
```tsx
<RiskLevelField source="risk_level" />
```

---

#### LifecycleStatusField
**Location:** `src/components/fields/LifecycleStatusField.tsx`

**Purpose:** React Admin field for component lifecycle status

---

#### ComplianceField
**Location:** `src/components/fields/ComplianceField.tsx`

**Purpose:** React Admin field for compliance indicators (RoHS, REACH, etc.)

---

### Dialog/Modal Components

#### ComponentDetailDialog
**Location:** `src/components/ComponentDetailDialog.tsx`

**Purpose:** Full component details dialog from Component Vault

**Features:**
- Complete component specifications
- Pricing table
- Lifecycle and compliance info
- External links (datasheet, images)
- Quality score display
- Enrichment source tracking

**Props:**
```typescript
interface ComponentDetailDialogProps {
  componentId: number | null;
  open: boolean;
  onClose: () => void;
}
```

**Sections:**
1. Basic Information (MPN, manufacturer, category, quality score)
2. Lifecycle & Compliance (lifecycle status, RoHS, REACH, enrichment source)
3. Specifications & Parameters (table format)
4. Pricing (quantity breaks)
5. Resources (datasheet, product images)

**Example:**
```tsx
<ComponentDetailDialog
  componentId={selectedComponentId}
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
/>
```

---

#### OnboardingModal
**Location:** `src/components/OnboardingModal.tsx`

**Purpose:** Initial onboarding wizard for new users

---

### User/Navigation Components

#### CustomUserMenu
**Location:** `src/components/CustomUserMenu.tsx`

**Purpose:** Custom user menu dropdown with profile, settings, logout

---

#### ProjectSwitcher
**Location:** `src/components/ProjectSwitcher.tsx`

**Purpose:** Project context switcher in header

---

#### OrganizationSwitcher
**Location:** `src/components/OrganizationSwitcher.tsx`

**Purpose:** Organization context switcher

---

#### WorkspaceSwitcher
**Location:** `src/components/WorkspaceSwitcher.tsx`

**Purpose:** Workspace context switcher

---

#### AdminModeToggle
**Location:** `src/components/AdminModeToggle.tsx`

**Purpose:** Toggle between admin and user modes

---

### Utility Components

#### KeyboardShortcuts
**Location:** `src/components/KeyboardShortcuts.tsx`

**Purpose:** Keyboard shortcut manager and overlay

---

#### CommandPalette
**Location:** `src/components/CommandPalette.tsx`

**Purpose:** Command palette (Cmd+K) for quick navigation

---

#### TrialExpirationBanner
**Location:** `src/components/TrialExpirationBanner.tsx`

**Purpose:** Trial expiration warning banner

---

#### DashboardErrorBoundary
**Location:** `src/components/dashboard/DashboardErrorBoundary.tsx`

**Purpose:** Error boundary for dashboard widgets

---

---

## Form Elements

### Input Components

**Primary Library:** Material-UI (MUI)

#### Text Inputs
- **TextField** (MUI)
  - Variants: outlined (default), filled, standard
  - Sizes: small, medium
  - States: default, focused, error, disabled
  - Adornments: start/end icons, buttons
  - Helper text support
  - Location: Used throughout (MUI component)

#### Select/Dropdown
- **Select** (MUI)
  - Native and custom variants
  - Multiple selection support
  - Grouped options
  - Location: Used throughout (MUI component)

- **Autocomplete** (MUI)
  - Searchable dropdown
  - Multiple selection
  - Free solo (custom input)
  - Async data loading
  - Location: Used throughout (MUI component)

#### Checkboxes & Radio
- **Checkbox** (MUI)
  - Checked, unchecked, indeterminate states
  - Custom icons
  - Label positioning

- **Radio** (MUI)
  - RadioGroup for grouping
  - Custom icons
  - Label positioning

#### Switches & Toggles
- **Switch** (MUI)
  - On/off toggle
  - Label positioning
  - Disabled state

#### Date/Time Pickers
- **DatePicker** (@mui/x-date-pickers)
  - Calendar popup
  - Keyboard input
  - Date range support

- **TimePicker** (@mui/x-date-pickers)
  - Time selection
  - 12/24 hour formats

#### File Upload
- **BOMDropzone** (`src/bom/intake/BOMDropzone.tsx`)
  - Drag-and-drop file upload
  - Accepts: CSV, Excel (.xlsx, .xls)
  - Multiple file support
  - Visual states: empty, files selected, processing
  - File count and row count display
  - Location: `src/bom/intake/BOMDropzone.tsx`

### Form Patterns

#### Validation
- **React Admin validation** - Built-in validators
- **MUI error states** - Red border, helper text
- **Custom validation** - Business logic validators

#### Form Layout
- **Grid-based forms** - MUI Grid for responsive layouts
- **Stepper forms** - Multi-step workflows (BOM upload)
- **Inline editing** - DataGrid inline editing

---

## Data Display

### Tables

#### DataGrid (MUI X)
**Location:** Used throughout for BOM tables, component lists, alert lists

**Features:**
- Sortable columns
- Filterable columns
- Pagination (client-side and server-side)
- Row selection (single and multiple)
- Inline editing
- Column resizing
- Column hiding/showing
- Density control (compact, standard, comfortable)
- Export (CSV, Excel)
- Custom cell renderers
- Expandable rows

**Key Usage:**
- BOM line items table
- Component catalog search results
- Alert lists
- User management
- Project lists

**Example Configuration:**
```tsx
<DataGrid
  rows={data}
  columns={columns}
  pageSize={25}
  rowsPerPageOptions={[10, 25, 50, 100]}
  checkboxSelection
  disableSelectionOnClick
  sortingMode="server"
  paginationMode="server"
  onSortModelChange={handleSort}
  onPageChange={handlePageChange}
/>
```

---

#### ResponsiveTable
**Location:** `src/components/layout/ResponsiveTable.tsx`, `src/components/mobile/ResponsiveTable.tsx`

**Purpose:** Responsive table wrapper that adapts to mobile/tablet

**Features:**
- Horizontal scroll on small screens
- Card-based layout on mobile
- Touch-friendly row selection
- Optimized for tablet gestures

---

### Lists

#### ActivityFeed
**Location:** `src/components/dashboard/widgets/ActivityFeed.tsx`

**Purpose:** Timeline-style activity list

**Features:**
- Timestamp display
- User avatars
- Action icons
- Grouped by date
- Infinite scroll support

---

#### AlertsList
**Location:** `src/pages/alerts/AlertList.tsx`, `src/components/dashboard/widgets/AlertsList.tsx`

**Purpose:** Styled list of alerts with severity indicators

**Features:**
- Severity color coding
- Alert type icons
- Dismissible alerts
- Batch actions
- Filters (type, severity, status)

---

### Cards

#### Card (MUI)
**Variants:**
- **Default** - `variant="outlined"` - 1px border, no shadow
- **Elevation** - `variant="elevation"` - Box shadow

**Border Radius:** 12px (theme.shape.borderRadius = md)

**Common Patterns:**
```tsx
<Card variant="outlined">
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardActions>
    {/* Actions */}
  </CardActions>
</Card>
```

**Custom Card Components:**
- **MetricCard** - Metric display cards (see above)
- **AnalysisQueueCard** - BOM analysis queue status
- **MappingTemplateCard** - Column mapping templates

---

### Charts (Recharts)

**Location:** `src/components/dashboard/widgets/`

#### Chart Types
- **LineChart** - Time-series data (ActivityChart)
- **BarChart** - Categorical comparisons
- **PieChart** - Distribution (RiskDistributionChart)
- **AreaChart** - Trend visualization

**Common Configuration:**
```tsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="value" stroke="#3b82f6" />
  </LineChart>
</ResponsiveContainer>
```

---

### Badges & Indicators

#### Chip (MUI)
**Usage:** Tags, categories, status indicators

**Variants:**
- `filled` (default) - Solid background
- `outlined` - Border only

**Sizes:**
- `small` - 20px height, 11px font
- `medium` - 24px height, 13px font

**Colors:** primary, secondary, success, error, warning, info, default

**Deletable:** Optional delete icon with `onDelete` callback

**Custom Chips:**
- **StatusChip** - Semantic status badges (see above)
- **ConfidenceBadge** - AI confidence scoring (`src/components/bom/ConfidenceBadge.tsx`)

#### Badge (MUI)
**Usage:** Notification counts, status dots

**Variants:**
- `standard` - Circular badge with number
- `dot` - Small dot indicator

**Colors:** primary, secondary, success, error, warning, info, default

**Positioning:** top-right, top-left, bottom-right, bottom-left

**Example:**
```tsx
<Badge badgeContent={4} color="error">
  <NotificationsIcon />
</Badge>
```

---

### Icons

#### MUI Icons (@mui/icons-material)
**Primary icon library** - 100+ icons used

**Common Icons:**
- Navigation: Home, Menu, ArrowBack, ArrowForward, ExpandMore
- Actions: Add, Edit, Delete, Save, Close, Check, Cancel
- Status: CheckCircle, Error, Warning, Info
- File: CloudUpload, FileDownload, Description, Folder
- Data: TableView, Assessment, BarChart, PieChart
- Notifications: Notifications, NotificationsActive, NotificationsOff
- User: Person, AccountCircle, Group, Settings
- Commerce: ShoppingCart, AttachMoney, TrendingUp, TrendingDown

**Usage:**
```tsx
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
<CloudUploadIcon color="primary" fontSize="large" />
```

#### Lucide React Icons
**Secondary icon library** - Modern, clean icons for dashboard

**Common Icons:**
- Trends: TrendingUp, TrendingDown, Minus
- Data: BarChart, LineChart, PieChart
- Actions: Check, X, AlertTriangle, Info

**Usage:**
```tsx
import { TrendingUp } from 'lucide-react';
<TrendingUp size={20} className="text-green-500" />
```

#### Icon Sizes
| Size | Value | Usage |
|------|-------|-------|
| inherit | 1em | Inherit from parent |
| small | 20px | Inline icons |
| medium | 24px | Default |
| large | 35px | Prominent icons |

---

## Feedback Components

### Notifications

#### Toast/Snackbar (React Admin)
**Provider:** React Admin's `useNotify` hook

**Types:**
- `success` - Green, checkmark icon
- `error` - Red, error icon
- `warning` - Orange, warning icon
- `info` - Blue, info icon

**Usage:**
```tsx
const notify = useNotify();
notify('BOM uploaded successfully', { type: 'success' });
notify('Failed to save changes', { type: 'error' });
```

**Position:** Bottom-left (default)

**Duration:** 4 seconds (auto-dismiss)

---

#### Alert (MUI)
**Purpose:** Inline alerts for page-level messages

**Variants:**
- `filled` - Solid background
- `outlined` - Border only
- `standard` - Default

**Severities:** success, error, warning, info

**Features:**
- Optional close button
- Icon display
- Action buttons
- Title support

**Example:**
```tsx
<Alert severity="warning" onClose={handleClose}>
  Your trial expires in 3 days. Upgrade now to keep access.
</Alert>
```

---

### Progress Indicators

#### CircularProgress (MUI)
**Usage:** Loading spinners

**Variants:**
- `determinate` - Progress percentage (0-100)
- `indeterminate` - Infinite spinning

**Sizes:** Custom via `size` prop (default: 40px)

**Colors:** primary, secondary, inherit

**Example:**
```tsx
<CircularProgress size={24} />
<CircularProgress variant="determinate" value={75} />
```

---

#### LinearProgress (MUI)
**Usage:** Progress bars

**Variants:**
- `determinate` - Progress percentage
- `indeterminate` - Infinite animation
- `buffer` - Buffering animation
- `query` - Query animation

**Example:**
```tsx
<LinearProgress variant="determinate" value={progress} />
```

**Custom Usage:**
- **BOMWorkflowStepper** - Enrichment progress bar
- **EnrichmentQueueItem** - Per-item progress

---

#### Skeleton (MUI)
**Usage:** Content placeholders during loading

**Variants:**
- `text` - Text line skeleton
- `rectangular` - Block skeleton
- `circular` - Avatar skeleton

**Animation:** `wave` (default), `pulse`, `false` (no animation)

**Example:**
```tsx
<Skeleton variant="text" width="60%" height={24} />
<Skeleton variant="rectangular" width={200} height={100} />
<Skeleton variant="circular" width={40} height={40} />
```

**Custom Skeletons:**
- MetricCardSkeleton
- ChartSkeleton
- ActivityFeedSkeleton
- AlertsListSkeleton

---

### Dialogs & Modals

#### Dialog (MUI)
**Usage:** Modal overlays

**Variants:**
- `paper` elevation - Default
- `fullScreen` - Full screen modal (mobile)
- `fullWidth` - Full width modal
- `maxWidth` - xs, sm, md, lg, xl

**Parts:**
- DialogTitle
- DialogContent
- DialogContentText
- DialogActions

**Border Radius:** 12px (theme md)

**Example:**
```tsx
<Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
  <DialogTitle>Component Details</DialogTitle>
  <DialogContent dividers>
    {/* Content */}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleSave} variant="contained">Save</Button>
  </DialogActions>
</Dialog>
```

**Custom Dialogs:**
- **ComponentDetailDialog** - Component vault details
- **ConfirmCascadeDialog** - Cascade delete confirmation
- **OnboardingModal** - User onboarding wizard

---

#### Drawer (MUI)
**Usage:** Side panel overlays

**Anchor:** left, right, top, bottom

**Variants:**
- `permanent` - Always visible
- `persistent` - Toggleable, pushes content
- `temporary` - Overlay, dismissible

**Example:**
```tsx
<Drawer anchor="right" open={open} onClose={handleClose}>
  <Box sx={{ width: 400, p: 3 }}>
    {/* Drawer content */}
  </Box>
</Drawer>
```

**Custom Drawers:**
- **NextActionDrawer** - Recommended actions sidebar
- **AlertDetailPanel** - Alert details sidebar
- **MitigationDrawer** - Risk mitigation suggestions
- **SendToVaultDrawer** - Send component to vault

---

#### Popover (MUI)
**Usage:** Contextual overlays

**Anchor:** Element or position

**Example:**
```tsx
<Popover
  open={open}
  anchorEl={anchorEl}
  onClose={handleClose}
  anchorOrigin={{
    vertical: 'bottom',
    horizontal: 'center',
  }}
>
  <Box sx={{ p: 2 }}>
    {/* Popover content */}
  </Box>
</Popover>
```

---

#### Tooltip (MUI)
**Usage:** Contextual help text

**Placement:** top, bottom, left, right (+ -start, -end variants)

**Font Size:** 12px (0.75rem)

**Border Radius:** 4px (xs)

**Example:**
```tsx
<Tooltip title="Delete component" placement="top">
  <IconButton>
    <DeleteIcon />
  </IconButton>
</Tooltip>
```

**Radix UI Tooltip:** Used in ConfidenceBadge for richer tooltip content

---

### Empty States

**EmptyState Component** (see above)

**Common Patterns:**
- **No data** - Inbox icon, "No items found", action to create
- **No search results** - Search icon, "No results", action to clear filters
- **No selection** - Click icon, "Select an item to view details"
- **Error state** - Error icon, error message, action to retry

---

## Layout Components

### Container Components

#### Box (MUI)
**Usage:** Generic container/wrapper

**Purpose:** Flexbox/grid layouts, spacing, styling

**Example:**
```tsx
<Box sx={{ display: 'flex', gap: 2, p: 3 }}>
  {/* Content */}
</Box>
```

---

#### Container (MUI)
**Usage:** Page-level content wrapper

**Max Width:** sm, md, lg, xl, false

**Fixed:** Center aligned with max-width

**Example:**
```tsx
<Container maxWidth="lg">
  {/* Page content */}
</Container>
```

---

#### Paper (MUI)
**Usage:** Elevated surface

**Variants:**
- `elevation` - 0-24 (default: 1)
- `outlined` - Border instead of shadow

**Border Radius:** 12px (md)

**Background:** White (#ffffff)

**Example:**
```tsx
<Paper elevation={2} sx={{ p: 3 }}>
  {/* Content */}
</Paper>
```

---

### Grid Layouts

#### Grid (MUI)
**System:** 12-column grid

**Breakpoints:** xs, sm, md, lg, xl

**Spacing:** 0-10 (multiples of 8px)

**Example:**
```tsx
<Grid container spacing={3}>
  <Grid item xs={12} md={6} lg={4}>
    <Card>Card 1</Card>
  </Grid>
  <Grid item xs={12} md={6} lg={4}>
    <Card>Card 2</Card>
  </Grid>
</Grid>
```

**Common Patterns:**
- **Dashboard metrics** - 4 columns on desktop (lg={3}), 2 on tablet (md={6}), 1 on mobile (xs={12})
- **Form layout** - 2 columns on desktop (md={6}), 1 on mobile (xs={12})
- **Card grids** - 3-4 columns responsive

---

#### Stack (MUI)
**Purpose:** Vertical or horizontal stacking with spacing

**Direction:** row, column, row-reverse, column-reverse

**Spacing:** 0-10

**Example:**
```tsx
<Stack spacing={2} direction="row" alignItems="center">
  <IconButton><EditIcon /></IconButton>
  <Typography>Edit Item</Typography>
</Stack>
```

---

### Navigation Components

#### TabletNavigation
**Location:** `src/components/layout/TabletNavigation.tsx`

**Purpose:** Touch-optimized navigation for tablets

---

#### ResponsiveContainer
**Location:** `src/components/layout/ResponsiveContainer.tsx`

**Purpose:** Responsive wrapper with breakpoint-aware layouts

---

### Page Layout Components

#### DashboardGrid
**Location:** `src/components/dashboard/DashboardGrid.tsx`

**Purpose:** Widget grid for dashboard pages

---

## Mobile & Accessibility

### Mobile-Optimized Components

#### TouchTarget
**Location:** `src/components/mobile/TouchTarget.tsx`

**Purpose:** Touch-friendly interactive element with guaranteed minimum touch target size

**Features:**
- Minimum 48px touch target (configurable)
- Variants: default, filled, outlined
- Color theming: primary, secondary, success, error, warning, info
- Full width option
- Disabled state
- Tap highlight prevention
- Touch-action optimization

**Props:**
```typescript
interface TouchTargetProps {
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void;
  children: React.ReactNode;
  disabled?: boolean;
  minSize?: number; // default: 48px
  sx?: SxProps<Theme>;
  'aria-label'?: string;
  variant?: 'default' | 'filled' | 'outlined';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  fullWidth?: boolean;
}
```

**Example:**
```tsx
<TouchTarget
  variant="filled"
  color="primary"
  minSize={48}
  onClick={handleClick}
  aria-label="Upload BOM"
>
  <CloudUploadIcon />
  <Typography>Upload</Typography>
</TouchTarget>
```

**TouchTargetWrapper:**
Non-interactive wrapper that ensures minimum touch target size while keeping visual size unchanged.

---

#### MobileBOMDropzone
**Location:** `src/components/mobile/MobileBOMDropzone.tsx`

**Purpose:** Mobile-optimized file dropzone

**Features:**
- Large touch target
- Visual feedback for drag state
- Simplified UI for small screens

---

#### MobileColumnMapper
**Location:** `src/components/mobile/MobileColumnMapper.tsx`

**Purpose:** Mobile-friendly column mapping interface

**Features:**
- Card-based layout (vs. table on desktop)
- Swipe gestures
- Large touch targets for selection

---

### Accessibility Components

All located in `src/components/accessibility/`:

#### SkipLinks
**Purpose:** Keyboard navigation skip-to-content links

**Features:**
- Hidden until focused
- Jump to main content, navigation
- WCAG 2.1 AA compliance

---

#### FocusTrap
**Purpose:** Trap keyboard focus within modal/dialog

**Usage:** Dialogs, drawers, modals

---

#### VisuallyHidden
**Purpose:** Screen reader only content

**Usage:** ARIA labels, accessible descriptions

**Example:**
```tsx
<VisuallyHidden>
  <label htmlFor="search">Search components</label>
</VisuallyHidden>
```

---

### Responsive Patterns

#### Breakpoint Usage
- **Mobile-first design** - Base styles for mobile, override for larger screens
- **Hide on mobile** - `sx={{ display: { xs: 'none', md: 'block' } }}`
- **Responsive columns** - Grid breakpoints (xs={12}, md={6}, lg={4})
- **Responsive spacing** - `sx={{ p: { xs: 2, md: 3, lg: 4 } }}`

#### Touch-Friendly Design
- **Minimum touch targets:** 48px (44px iOS minimum, 48px recommended)
- **Spacing between targets:** Minimum 8px
- **Button padding:** 12px (large), 8px (medium), 4px (small)
- **Tap highlight:** Disabled via `WebkitTapHighlightColor: 'transparent'`
- **Touch action:** Optimized via `touchAction: 'manipulation'`

---

## BOM-Specific Components

### BOM Upload Workflow

#### BOMDropzone
**Location:** `src/bom/intake/BOMDropzone.tsx`

**Purpose:** File dropzone for BOM uploads (see Form Elements above)

**Features:**
- Drag-and-drop with visual feedback
- Accepts CSV, Excel (.xlsx, .xls)
- Multiple file support
- File count and row count display
- Different states: empty, files selected

**States:**
- **Empty** - Large dropzone with icon and instructions
- **Files selected** - Compact view with file count, "Add more files" chip
- **Drag active** - Highlighted border and background

---

#### BOMWorkflowStepper
**Location:** `src/bom/intake/BOMWorkflowStepper.tsx`

**Purpose:** Vertical stepper showing unified BOM workflow stages

**Steps:**
1. Select Files - Drop or select BOM file
2. Upload & Parse - Uploading file and detecting columns
3. Map Columns - Match columns to standard fields
4. Save BOM - Creating BOM and saving line items
5. Enrich Components - Fetching pricing, stock, datasheets
6. Risk Analysis - Calculating risk scores
7. Complete - Workflow complete

**Features:**
- Step icons with loading spinners
- Completed steps with checkmarks
- Error state highlighting
- Enrichment progress bar (linear progress)
- Clickable completed steps for navigation
- Vertical and horizontal orientation

**Props:**
```typescript
interface BOMWorkflowStepperProps {
  currentStatus: BOMWorkflowStatus | null;
  isProcessing?: boolean;
  orientation?: 'vertical' | 'horizontal';
  showDescriptions?: boolean;
  enrichmentProgress?: { percent: number; enriched: number; total: number };
  onStepClick?: (stepIndex: number, stepLabel: string) => void;
  allowNavigation?: boolean;
}
```

**Status Types:**
- pending, parsing, uploading, mapping, confirming, saving
- completed (upload done), enriching, analyzing, enriched (all done)
- error

---

#### BOMColumnMapper
**Location:** `src/bom/intake/BOMColumnMapper.tsx`

**Purpose:** Column mapping interface for BOM uploads

**Features:**
- Auto-detection of common columns
- Drag-and-drop column assignment
- Preview of mapped data
- Template save/load
- Validation warnings

---

#### BOMUploadStatus
**Location:** `src/bom/intake/BOMUploadStatus.tsx`

**Purpose:** Upload status display

**Features:**
- Progress indicator
- File name and size
- Upload speed
- Cancel button

---

#### BOMResultsSummary
**Location:** `src/bom/intake/BOMResultsSummary.tsx`

**Purpose:** Summary of BOM upload results

**Features:**
- Total rows processed
- Success/failure counts
- Error details
- Next actions

---

#### BOMUploadComplete
**Location:** `src/bom/intake/BOMUploadComplete.tsx`

**Purpose:** Completion screen after upload

**Features:**
- Success message
- Summary stats
- Next steps
- View/export buttons

---

### BOM Enrichment

#### BOMEnrichmentPanel
**Location:** `src/bom/intake/BOMEnrichmentPanel.tsx`

**Purpose:** Enrichment status and controls

---

#### EnrichmentQueueMetrics
**Location:** `src/bom/intake/EnrichmentQueueMetrics.tsx`

**Purpose:** Queue metrics display (pending, processing, completed)

---

#### EnrichmentQueueItem
**Location:** `src/bom/intake/EnrichmentQueueItem.tsx`

**Purpose:** Individual enrichment queue item card

---

#### EnrichmentActivityFeed
**Location:** `src/bom/intake/EnrichmentActivityFeed.tsx`

**Purpose:** Real-time feed of enrichment activities

---

#### BOMJobProgressMonitor
**Location:** `src/components/BOMJobProgressMonitor.tsx`

**Purpose:** Real-time job progress monitoring

---

#### EnrichmentProgressMonitor
**Location:** `src/components/EnrichmentProgressMonitor.tsx`

**Purpose:** Enrichment-specific progress tracking

---

### BOM Analysis

#### BOMDetailView
**Location:** `src/components/BOMDetailView.tsx`

**Purpose:** Detailed view of a single BOM

**Features:**
- Line item table
- Summary metrics
- Risk analysis
- Export options

---

#### ComponentSpecReview
**Location:** `src/components/ComponentSpecReview.tsx`

**Purpose:** Review and approve component specifications

---

### Column Mapping

#### SmartColumnMapper
**Location:** `src/components/bom/SmartColumnMapper.tsx`

**Purpose:** AI-assisted column mapping

**Features:**
- AI confidence scoring
- Auto-suggestions
- Manual override
- Reasoning tooltips

---

#### MappingRow
**Location:** `src/components/bom/MappingRow.tsx`

**Purpose:** Single row in column mapping table

---

#### MappingTemplateCard
**Location:** `src/components/bom/MappingTemplateCard.tsx`

**Purpose:** Saved mapping template card

---

#### MappingTemplateManager
**Location:** `src/components/bom/MappingTemplateManager.tsx`

**Purpose:** Manage saved mapping templates

---

#### ConfidenceBadge
**Location:** `src/components/bom/ConfidenceBadge.tsx`

**Purpose:** AI confidence score badge (see above in Component Catalog)

---

#### AIReasoningTooltip
**Location:** `src/components/bom/AIReasoningTooltip.tsx`

**Purpose:** Tooltip explaining AI reasoning for column mapping

**Features:**
- Rich tooltip with Radix UI
- Confidence score
- Reasoning explanation
- Match factors

---

#### AcceptAllButton
**Location:** `src/components/bom/AcceptAllButton.tsx`

**Purpose:** Bulk accept all AI suggestions

---

### Queue Management

#### AnalysisQueueCard
**Location:** `src/bom/intake/AnalysisQueueCard.tsx`

**Purpose:** Analysis queue status card

---

#### BOMQueueMetrics
**Location:** `src/bom/intake/BOMQueueMetrics.tsx`

**Purpose:** BOM queue statistics

---

#### BOMProjectBanner
**Location:** `src/bom/intake/BOMProjectBanner.tsx`

**Purpose:** Project context banner for BOM uploads

---

---

## Design Patterns

### Interaction Patterns

#### Hover States
**MUI Default:**
- Buttons: Slight background darkening
- Cards: Box shadow elevation
- Links: Underline appears
- Icons: Opacity change

**Custom Hover:**
- MetricCard: `transform: translateY(-2px)` + shadow increase
- TouchTarget: Background color change (action.hover)
- FilterToolbar: Clear button appears

---

#### Focus States
**WCAG 2.1 AA Compliant:**
- Visible focus ring (2px outline)
- High contrast focus indicators
- Skip links visible on focus

---

#### Active/Pressed States
**Buttons:**
- Material ripple effect
- Slight scale down: `transform: scale(0.98)`
- Background darkening

**TouchTarget:**
- Background change to action.selected
- Scale animation (0.98)

---

#### Disabled States
**Visual:**
- Opacity: 0.5
- Cursor: not-allowed
- No hover effects
- Grey color (#9ca3af)

---

#### Error States
**Form Fields:**
- Red border (#ef4444)
- Error icon
- Helper text in red
- ARIA invalid attribute

**Validation:**
- Inline validation on blur
- Submit validation on form submit
- Clear error messages

---

### Loading Patterns

#### Page Load
- **Full page spinner** - PageLoading (50vh height)
- **Content skeleton** - Skeleton rows/cards while loading

#### Component Load
- **Inline spinner** - InlineSpinner (20px)
- **Component skeleton** - Skeleton matching component structure

#### Data Load
- **Table skeleton** - TableSkeletonLoading (5 rows)
- **Card grid skeleton** - CardSkeletonLoading (4 cards)

#### Progress Tracking
- **Linear progress** - Top of container (enrichment, uploads)
- **Circular progress** - Centered in component
- **Stepper** - Multi-step workflows (BOM upload)

---

### Responsive Patterns

#### Mobile-First
Base styles target mobile (320px+), progressively enhance for larger screens.

```tsx
<Box sx={{
  p: 2,              // 16px padding on mobile
  md: { p: 3 },      // 24px on tablet
  lg: { p: 4 },      // 32px on desktop
}}>
```

---

#### Adaptive Layouts
- **Mobile (xs)** - Single column, stack vertically
- **Tablet (md)** - 2 columns, some horizontal layouts
- **Desktop (lg)** - 3-4 columns, grid layouts
- **Large (xl)** - 4+ columns, wide layouts

---

#### Responsive Tables
- **Desktop** - Full DataGrid with all columns
- **Tablet** - Horizontal scroll, key columns visible
- **Mobile** - Card-based layout (ResponsiveTable)

---

#### Navigation
- **Desktop** - Sidebar + top bar
- **Tablet** - Collapsible sidebar + top bar
- **Mobile** - Bottom navigation + hamburger menu

---

### Animation Patterns

#### Transitions
**MUI Default:**
- Duration: 200ms-300ms
- Easing: ease-in-out
- Properties: opacity, transform, background-color

**Custom:**
```tsx
sx={{
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: 3,
  }
}}
```

---

#### Fade In/Out
- **Collapse** component for expanding/collapsing content
- **Fade** component for fade in/out
- **Slide** component for slide transitions

---

#### Loading Animations
- **Circular progress** - Infinite rotation
- **Linear progress** - Sliding bar
- **Skeleton** - Wave animation (default)

---

### Color Usage Patterns

#### Semantic Colors
- **Success (green)** - Completed actions, positive indicators
- **Warning (amber)** - Caution, medium priority
- **Error (red)** - Errors, critical issues
- **Info (blue)** - Informational messages

#### Risk Colors
- **Low (green)** - Safe components
- **Medium (orange)** - Monitor components
- **High (red)** - Action needed
- **Critical (purple)** - Urgent action

#### Status Colors
- **Active (green)** - Running, healthy
- **Processing (blue)** - In progress
- **Pending (gray)** - Waiting
- **Failed (red)** - Error state
- **Cancelled (dark gray)** - User cancelled

---

### Typography Patterns

#### Hierarchy
1. **Page title** (h2, 32px, 700) - Main page heading
2. **Section title** (h4, 24px, 600) - Section headers
3. **Card title** (h6, 18px, 600) - Card headers
4. **Body text** (body1, 16px, 400) - Main content
5. **Secondary text** (body2, 14px, 400) - Descriptions
6. **Caption** (caption, 12px, 400) - Helper text

#### Text Colors
- **Primary** (#111827) - Main text
- **Secondary** (#6b7280) - Descriptions, labels
- **Disabled** (#9ca3af) - Disabled text

---

### Spacing Patterns

#### Component Spacing
- **Internal padding** - 16px (md) or 24px (lg)
- **Between elements** - 8px (xs) or 16px (md)
- **Section gaps** - 24px (lg) or 32px (xl)

#### Page Spacing
- **Page padding** - 24px (3 units)
- **Section gap** - 24px (3 units)
- **Card gap** - 16px (2 units)

---

### Consistency Guidelines

#### Button Styles
- **Primary action** - Contained button, primary color
- **Secondary action** - Outlined button
- **Tertiary action** - Text button
- **Destructive action** - Contained button, error color

#### Card Styles
- **Default** - Outlined variant (1px border)
- **Elevated** - Elevation variant (box shadow)
- **Interactive** - Hover effect with shadow + transform

#### Form Styles
- **Labels** - Above inputs, 600 weight
- **Inputs** - Outlined variant, 8px border radius
- **Helper text** - Below inputs, secondary color
- **Error text** - Below inputs, error color

---

## File Structure

### Component Organization

```
src/
├── components/
│   ├── accessibility/          # A11y components (SkipLinks, FocusTrap, VisuallyHidden)
│   ├── bom/                    # BOM-specific components (column mapping, confidence badges)
│   ├── dashboard/              # Dashboard components
│   │   ├── skeletons/          # Loading skeletons
│   │   └── widgets/            # Dashboard widgets (ActivityChart, MetricCard, etc.)
│   ├── fields/                 # React Admin field components (RiskLevelField, etc.)
│   ├── layout/                 # Layout components (ResponsiveContainer, ResponsiveTable)
│   ├── mobile/                 # Mobile-optimized components (TouchTarget, MobileBOMDropzone)
│   ├── shared/                 # Shared components (StatusChip, MetricCard, FilterToolbar, etc.)
│   └── [misc components]       # Other components (dialogs, menus, etc.)
├── bom/
│   └── intake/                 # BOM upload workflow components
├── pages/                      # Page-level components
│   ├── account/                # Account settings pages
│   ├── admin/                  # Admin console pages
│   ├── alerts/                 # Alert management pages
│   ├── discovery/              # Component discovery pages
│   └── risk/                   # Risk management pages
├── theme/
│   └── index.ts                # Theme configuration and design tokens
└── styles/
    ├── index.css               # Global styles
    ├── dashboard.css           # Dashboard-specific styles
    └── tablet.css              # Tablet-specific styles
```

---

## Summary

### Component Count
- **Shared Components:** 10+ core reusable components
- **Dashboard Widgets:** 6+ specialized widgets
- **BOM Components:** 20+ upload/enrichment components
- **Field Components:** 3 React Admin fields
- **Dialogs/Modals:** 4 major dialogs
- **Mobile Components:** 5 touch-optimized components
- **Accessibility Components:** 3 A11y utilities
- **Loading Skeletons:** 4 skeleton variants

### Design System Maturity
- **Design tokens:** Comprehensive (colors, typography, spacing, shadows)
- **Component library:** MUI-based with custom semantic extensions
- **Consistency:** High - theme tokens enforced across all components
- **Accessibility:** WCAG 2.1 AA target, dedicated A11y components
- **Responsive:** Mobile-first, tablet-optimized (44-48px touch targets)
- **Documentation:** Well-documented component props and usage

### Key Strengths
1. **Semantic color system** - Risk, grade, alert, workflow colors in theme
2. **Consistent component API** - Similar prop patterns across components
3. **Loading states** - Comprehensive skeleton/spinner variants
4. **Mobile optimization** - Dedicated touch-friendly components
5. **Accessibility** - Dedicated A11y components and WCAG compliance
6. **BOM workflow** - Rich, specialized workflow components

### Potential Improvements
1. **Storybook documentation** - Visual component documentation
2. **Design tokens as CSS variables** - Easier theming/overrides
3. **Component library consolidation** - Reduce MUI + Radix mix (currently minimal Radix usage)
4. **Icon consolidation** - Standardize on MUI Icons or Lucide (currently mixed)

---

**End of Component Catalog**
