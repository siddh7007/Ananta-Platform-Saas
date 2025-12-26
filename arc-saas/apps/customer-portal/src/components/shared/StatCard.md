# StatCard Component

A flexible, accessible component for displaying metrics and KPIs in the CBP customer portal.

## Features

- Multiple size variants (sm, md, lg)
- Visual variants (default, primary, success, warning, error)
- Trend indicators with direction arrows
- Loading states with skeletons
- Interactive support (onClick, href)
- Custom footer content
- Background watermark icons
- Responsive grid layouts
- Pre-configured convenience components

## Basic Usage

```tsx
import { StatCard, StatCardGrid } from '@/components/shared';
import { FileText } from 'lucide-react';

function DashboardStats() {
  return (
    <StatCardGrid columns={4}>
      <StatCard
        title="Total BOMs"
        value={42}
        icon={FileText}
      />
    </StatCardGrid>
  );
}
```

## Props

### StatCard

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Card title/label |
| `value` | `string \| number` | required | Main value to display |
| `icon` | `LucideIcon` | - | Optional icon component |
| `description` | `string` | - | Description or subtitle |
| `trend` | `TrendConfig` | - | Trend indicator configuration |
| `variant` | `StatCardVariant` | `'default'` | Visual variant |
| `size` | `StatCardSize` | `'md'` | Size variant |
| `loading` | `boolean` | `false` | Show loading skeleton |
| `onClick` | `() => void` | - | Click handler |
| `href` | `string` | - | Link destination |
| `footer` | `ReactNode` | - | Custom footer content |
| `className` | `string` | - | Additional CSS classes |

### TrendConfig

```tsx
{
  value: string | number;      // e.g., "+12%" or "+5"
  direction: 'up' | 'down' | 'neutral';
  label?: string;               // e.g., "from last month"
}
```

### Variants

- `default` - Neutral gray styling
- `primary` - Primary brand color
- `success` - Green for positive metrics
- `warning` - Yellow for caution metrics
- `error` - Red for critical metrics

### Sizes

- `sm` - Compact (icon 16px, value text-xl)
- `md` - Standard (icon 20px, value text-2xl)
- `lg` - Large (icon 24px, value text-4xl)

## Examples

### With Trend Indicator

```tsx
<StatCard
  title="Revenue"
  value="$125,432"
  icon={DollarSign}
  variant="success"
  trend={{
    value: "+12.5%",
    direction: "up",
    label: "from last month",
  }}
/>
```

### Interactive Card

```tsx
<StatCard
  title="Pending Reviews"
  value={8}
  icon={Clock}
  variant="warning"
  onClick={() => navigate('/reviews')}
  description="Click to view details"
/>
```

### With Link

```tsx
<StatCard
  title="Completed Tasks"
  value={156}
  icon={CheckCircle}
  variant="success"
  href="/tasks/completed"
/>
```

### With Footer Actions

```tsx
<StatCard
  title="Critical Alerts"
  value={3}
  icon={AlertCircle}
  variant="error"
  footer={
    <Button variant="destructive" size="sm" className="w-full">
      View Alerts
    </Button>
  }
/>
```

### Loading State

```tsx
const { data, isLoading } = useQuery(['stats']);

return (
  <StatCard
    title="Revenue"
    value={data?.revenue ?? 0}
    icon={DollarSign}
    loading={isLoading}
  />
);
```

## StatCardGrid

Responsive grid container for organizing multiple stat cards.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | StatCard components |
| `columns` | `2 \| 3 \| 4` | `4` | Number of columns on desktop |
| `className` | `string` | - | Additional CSS classes |

### Responsive Behavior

- **Mobile**: Always 1 column
- **Tablet (md)**: 2 columns
- **Desktop (lg)**: Based on `columns` prop

### Example

```tsx
<StatCardGrid columns={3}>
  <StatCard title="Users" value={100} />
  <StatCard title="Revenue" value="$50K" />
  <StatCard title="Growth" value="+23%" />
</StatCardGrid>
```

## Convenience Components

Pre-configured stat cards for common metrics:

### BOMCountStat

```tsx
<BOMCountStat count={42} trend={5} loading={false} />
```

### ComponentCountStat

```tsx
<ComponentCountStat count={1234} />
```

### RiskScoreStat

```tsx
<RiskScoreStat
  score={72}
  level="medium"  // 'low' | 'medium' | 'high'
/>
```

### CostStat

```tsx
<CostStat
  value={45678}
  currency="USD"
  trend={12.5}
/>
```

## Complete Dashboard Example

```tsx
import {
  StatCard,
  StatCardGrid,
  BOMCountStat,
  ComponentCountStat,
  RiskScoreStat,
  CostStat,
} from '@/components/shared';
import { FileText, Cpu, Users, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <StatCardGrid columns={4}>
          <BOMCountStat count={156} trend={12} />
          <ComponentCountStat count={2834} />
          <RiskScoreStat score={72} level="medium" />
          <CostStat value={234567} currency="USD" trend={8.3} />
        </StatCardGrid>
      </div>

      {/* Custom Stats Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Alerts</h2>
        <StatCardGrid columns={3}>
          <StatCard
            title="Critical Issues"
            value={3}
            icon={AlertCircle}
            variant="error"
            onClick={() => navigate('/alerts')}
            footer={
              <Button variant="destructive" size="sm" className="w-full">
                Review Now
              </Button>
            }
          />
          <StatCard
            title="Warnings"
            value={12}
            icon={AlertCircle}
            variant="warning"
          />
          <StatCard
            title="Resolved"
            value={48}
            icon={CheckCircle}
            variant="success"
            trend={{
              value: "+5",
              direction: "up",
              label: "this week",
            }}
          />
        </StatCardGrid>
      </div>
    </div>
  );
}
```

## Accessibility

- Uses semantic HTML
- Loading states include proper ARIA attributes
- Interactive cards have appropriate cursor and focus states
- Trend indicators use icons + text for clarity
- Maintains WCAG color contrast ratios

## Design Tokens

The component uses consistent spacing and sizing from the design system:

- Padding: Responsive based on size variant
- Border radius: `rounded-lg` from design tokens
- Shadows: Uses Card component elevation system
- Colors: Derived from theme CSS variables
- Typography: Uses design system font scales

## Performance

- Lightweight component with minimal re-renders
- Skeleton loading prevents layout shift
- Number formatting is memoized internally
- Icon watermarks use CSS opacity for performance

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design with mobile-first approach
- Touch-friendly interaction targets

## Related Components

- `Card` - Base card component
- `Skeleton` - Loading placeholder
- `Button` - For footer actions
- `Badge` - Can be used in footer for tags

## File Locations

- **Component**: `src/components/shared/StatCard.tsx`
- **Examples**: `src/components/shared/StatCard.example.tsx`
- **Documentation**: `src/components/shared/StatCard.md`
- **Export**: `src/components/shared/index.ts`
