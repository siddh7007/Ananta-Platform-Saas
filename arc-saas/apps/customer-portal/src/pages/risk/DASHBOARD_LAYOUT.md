# Risk Dashboard Layout

## Visual Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RISK ANALYSIS DASHBOARD                         │
│  Portfolio-level risk assessment for [Organization Name]               │
│                                                                         │
│  [Export Report] [Configure] [Refresh]                                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┬─────────────────────────────┐
│  LEFT COLUMN (2/3 width)                │  RIGHT COLUMN (1/3 width)   │
│                                         │                             │
│  ┌───────────────────────────────────┐  │  ┌───────────────────────┐  │
│  │  RISK SUMMARY CARD                │  │  │   HEALTH GAUGE        │  │
│  │                                   │  │  │                       │  │
│  │  Portfolio Risk Summary           │  │  │       ╭───╮           │  │
│  │  [Improving ↓] Trend              │  │  │      ╱     ╲          │  │
│  │                                   │  │  │     │   B   │         │  │
│  │  ┌─────────┐                      │  │  │      ╲     ╱          │  │
│  │  │    B    │  Health Grade        │  │  │       ╰───╯           │  │
│  │  │         │  Avg: 32.5/100       │  │  │                       │  │
│  │  └─────────┘                      │  │  │  Portfolio Health     │  │
│  │                                   │  │  └───────────────────────┘  │
│  │  Total: 1,250 components          │  │                             │
│  │  • Critical: 12                   │  │  ┌───────────────────────┐  │
│  │  • High: 45                       │  │  │ RISK WEIGHTS          │  │
│  │  • Medium: 180                    │  │  │                       │  │
│  │  • Low: 1,013                     │  │  │ Lifecycle       30%   │  │
│  │                                   │  │  │ Supply Chain    25%   │  │
│  │  ⚠️ 57 components need attention  │  │  │ Compliance      20%   │  │
│  └───────────────────────────────────┘  │  │ Obsolescence    15%   │  │
│                                         │  │ Single Source   10%   │  │
│  ┌───────────────────────────────────┐  │  │                       │  │
│  │  RISK DISTRIBUTION CHART          │  │  │ [Customize Weights]   │  │
│  │                                   │  │  └───────────────────────┘  │
│  │        ╭─────────╮                │  │                             │
│  │       ╱           ╲               │  │                             │
│  │      │   Donut    │              │  │                             │
│  │       ╲  Chart   ╱               │  │                             │
│  │        ╰─────────╯                │  │                             │
│  │                                   │  │                             │
│  │  Low (81%) | Med (14%)            │  │                             │
│  │  High (4%) | Critical (1%)        │  │                             │
│  │                                   │  │                             │
│  │  Total: 1,250 | High Risk: 4.6%   │  │                             │
│  └───────────────────────────────────┘  │                             │
│                                         │                             │
│  ┌───────────────────────────────────┐  │                             │
│  │  RISK BY CATEGORY (Bar Chart)     │  │                             │
│  │                                   │  │                             │
│  │  100 ┤                            │  │                             │
│  │   80 ┤     ▆▆                     │  │                             │
│  │   60 ┤ ▆▆  ▆▆  ▆▆                 │  │                             │
│  │   40 ┤ ▆▆  ▆▆  ▆▆  ▆▆             │  │                             │
│  │   20 ┤ ▆▆  ▆▆  ▆▆  ▆▆  ▆▆         │  │                             │
│  │    0 └─┬───┬───┬───┬───┬─        │  │                             │
│  │       Lif Sup Com Obs Sin        │  │                             │
│  │                                   │  │                             │
│  │  🟢 Low  🟡 Med  🟠 High  🔴 Crit  │  │                             │
│  └───────────────────────────────────┘  │                             │
└─────────────────────────────────────────┴─────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  TOP 10 HIGH-RISK COMPONENTS TABLE                          [10 total]  │
│                                                                         │
│  MPN              │ Mfr      │ Score │ Level    │ Risk      │ Actions  │
│ ─────────────────┼──────────┼───────┼──────────┼───────────┼────────  │
│  STM32F103C8T6   │ STMicro  │  92   │ Critical │ Lifecycle │ [View]   │
│  GRM21BR71H104   │ Murata   │  78   │ High     │ Supply Ch │ [View]   │
│  ...             │ ...      │  ...  │ ...      │ ...       │ [View]   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Last updated: Dec 15, 2025 2:30 PM • Analyzing 1,250 components       │
│  Risk scores calculated from lifecycle, supply chain, compliance, etc.  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Header Section
- **Title**: "Risk Analysis"
- **Subtitle**: Organization name context
- **Actions**: Export, Configure, Refresh buttons

### Main Grid (3-column responsive)

#### Left Column (lg:col-span-2)

1. **Risk Summary Card**
   - Health grade badge (A-F)
   - Average risk score
   - Trend indicator
   - Risk level distribution
   - Action required alert

2. **Risk Distribution Chart**
   - Donut chart visualization
   - Risk level breakdown percentages
   - Total components count
   - High-risk percentage

3. **Risk Category Breakdown**
   - Bar chart by category
   - Color-coded by severity
   - Five categories displayed
   - Risk level legend

#### Right Column (lg:col-span-1)

1. **Health Gauge**
   - Circular progress indicator
   - Large health grade display
   - Numeric score
   - "Portfolio Health" label

2. **Risk Weights Panel**
   - Current calculation weights
   - Percentages per category
   - Customize weights button

### Full-Width Section

**Top Risks Table**
- 10 highest-risk components
- Sortable columns
- Risk badges
- View component action
- Total high-risk count badge

### Footer
- Last updated timestamp
- Total components analyzed
- Risk calculation methodology

## Responsive Behavior

### Desktop (lg: 1024px+)
- 3-column grid (2:1 ratio)
- Full table display
- Charts at full size

### Tablet (md: 768px - 1023px)
- Single column stack
- Compact charts
- Scrollable table

### Mobile (sm: < 768px)
- Single column stack
- Simplified charts
- Card-based table view
- Touch-optimized buttons

## Color Palette

### Risk Levels
- **Critical**: Red (#dc2626) - Requires immediate action
- **High**: Orange (#ea580c) - Significant risk
- **Medium**: Yellow (#ca8a04) - Monitor closely
- **Low**: Green (#16a34a) - Acceptable risk

### Health Grades
- **A**: Green - Excellent (0-20%)
- **B**: Blue - Good (20-40%)
- **C**: Yellow - Fair (40-60%)
- **D**: Orange - Poor (60-80%)
- **F**: Red - Critical (80-100%)

## Interactive Features

1. **Refresh Button**: Refetch all data
2. **Export Report**: Download risk analysis (PDF/CSV)
3. **Configure**: Adjust risk weights and thresholds
4. **View Component**: Navigate to component detail
5. **Customize Weights**: Open risk profile editor
6. **Chart Tooltips**: Hover for detailed breakdowns
7. **Table Sorting**: Click headers to sort

## Loading States

All components show skeleton loaders:
- Summary card: Shimmer placeholders
- Charts: Empty state with loading message
- Table: Row skeletons
- Gauge: Circular skeleton

## Error States

- API errors: Alert banner with retry
- No data: Helpful empty state
- Network issues: Offline indicator

## Data Flow

```
┌──────────────┐
│   CNS API    │
│ Risk Service │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ TanStack     │
│ Query Hooks  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Dashboard    │
│ Page         │
└──────┬───────┘
       │
       ├─────────────┬──────────────┬──────────────┐
       ▼             ▼              ▼              ▼
 ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 │Summary  │  │Distribution│  │Category  │  │  Gauge   │
 │  Card   │  │   Chart    │  │Breakdown │  │          │
 └─────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Performance

- **Initial Load**: < 1s (cached data)
- **Chart Render**: < 200ms
- **Table Pagination**: Instant
- **Refresh**: < 500ms (API dependent)

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader announcements
- High contrast support
- Focus indicators
