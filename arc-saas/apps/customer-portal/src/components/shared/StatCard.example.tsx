/**
 * StatCard Component Examples
 *
 * This file demonstrates various usage patterns for the StatCard component.
 * You can copy these examples into your pages or dashboards.
 */

import {
  FileText,
  Cpu,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  ShoppingCart,
} from 'lucide-react';
import {
  StatCard,
  StatCardGrid,
  BOMCountStat,
  ComponentCountStat,
  RiskScoreStat,
  CostStat,
} from './StatCard';
import { Button } from '@/components/ui/button';

/**
 * Example 1: Basic Stats Grid
 * Simple stat cards in a responsive grid
 */
export function BasicStatsExample() {
  return (
    <StatCardGrid columns={4}>
      <StatCard
        title="Total BOMs"
        value={42}
        icon={FileText}
      />
      <StatCard
        title="Active Components"
        value="1,234"
        icon={Cpu}
      />
      <StatCard
        title="Team Members"
        value={8}
        icon={Users}
      />
      <StatCard
        title="Monthly Cost"
        value="$45,678"
        icon={DollarSign}
      />
    </StatCardGrid>
  );
}

/**
 * Example 2: Stats with Trends
 * Show metric changes over time
 */
export function StatsWithTrendsExample() {
  return (
    <StatCardGrid columns={3}>
      <StatCard
        title="Total Revenue"
        value="$125,432"
        icon={DollarSign}
        variant="success"
        trend={{
          value: "+12.5%",
          direction: "up",
          label: "from last month",
        }}
      />
      <StatCard
        title="Active Users"
        value={1834}
        icon={Users}
        variant="primary"
        trend={{
          value: "+8.2%",
          direction: "up",
          label: "vs last week",
        }}
      />
      <StatCard
        title="Conversion Rate"
        value="3.24%"
        icon={TrendingUp}
        variant="warning"
        trend={{
          value: "-0.5%",
          direction: "down",
          label: "needs attention",
        }}
      />
    </StatCardGrid>
  );
}

/**
 * Example 3: Different Sizes
 * StatCard supports sm, md (default), and lg sizes
 */
export function DifferentSizesExample() {
  return (
    <div className="space-y-4">
      <StatCard
        title="Small Card"
        value={42}
        icon={Package}
        size="sm"
      />
      <StatCard
        title="Medium Card (Default)"
        value={1234}
        icon={ShoppingCart}
        size="md"
      />
      <StatCard
        title="Large Card"
        value="$99,999"
        icon={DollarSign}
        size="lg"
        trend={{
          value: "+15%",
          direction: "up",
        }}
      />
    </div>
  );
}

/**
 * Example 4: Interactive Stats
 * Cards can be clickable or linkable
 */
export function InteractiveStatsExample() {
  const handleClick = () => {
    console.log('Stat card clicked!');
  };

  return (
    <StatCardGrid columns={2}>
      <StatCard
        title="Pending Reviews"
        value={8}
        icon={Clock}
        variant="warning"
        onClick={handleClick}
        description="Click to view details"
      />
      <StatCard
        title="Completed Tasks"
        value={156}
        icon={CheckCircle}
        variant="success"
        href="/tasks/completed"
        description="Click to view all"
      />
    </StatCardGrid>
  );
}

/**
 * Example 5: Stats with Footer Actions
 * Add custom footer content with buttons or links
 */
export function StatsWithFooterExample() {
  return (
    <StatCardGrid columns={2}>
      <StatCard
        title="Critical Alerts"
        value={3}
        icon={AlertCircle}
        variant="error"
        description="Requires immediate attention"
        footer={
          <Button variant="destructive" size="sm" className="w-full">
            View Alerts
          </Button>
        }
      />
      <StatCard
        title="Pending Approvals"
        value={12}
        icon={Clock}
        variant="warning"
        description="Waiting for review"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              Approve All
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              Review
            </Button>
          </div>
        }
      />
    </StatCardGrid>
  );
}

/**
 * Example 6: Different Variants
 * Show different visual states
 */
export function VariantExamples() {
  return (
    <StatCardGrid columns={4}>
      <StatCard
        title="Default"
        value={100}
        icon={Package}
        variant="default"
      />
      <StatCard
        title="Primary"
        value={200}
        icon={TrendingUp}
        variant="primary"
      />
      <StatCard
        title="Success"
        value={300}
        icon={CheckCircle}
        variant="success"
      />
      <StatCard
        title="Warning"
        value={50}
        icon={AlertCircle}
        variant="warning"
      />
      <StatCard
        title="Error"
        value={5}
        icon={AlertCircle}
        variant="error"
      />
    </StatCardGrid>
  );
}

/**
 * Example 7: Loading States
 * Show skeleton placeholders while data loads
 */
export function LoadingStatsExample() {
  const isLoading = true; // Simulated loading state

  return (
    <StatCardGrid columns={4}>
      <StatCard
        title="Total BOMs"
        value={0}
        icon={FileText}
        loading={isLoading}
      />
      <StatCard
        title="Components"
        value={0}
        icon={Cpu}
        loading={isLoading}
      />
      <StatCard
        title="Users"
        value={0}
        icon={Users}
        loading={isLoading}
      />
      <StatCard
        title="Revenue"
        value={0}
        icon={DollarSign}
        loading={isLoading}
      />
    </StatCardGrid>
  );
}

/**
 * Example 8: Convenience Components
 * Pre-configured components for common metrics
 */
export function ConvenienceComponentsExample() {
  return (
    <StatCardGrid columns={4}>
      <BOMCountStat count={42} trend={5} />
      <ComponentCountStat count={1234} />
      <RiskScoreStat score={72} level="medium" />
      <CostStat value={45678} currency="USD" trend={12.5} />
    </StatCardGrid>
  );
}

/**
 * Example 9: Dashboard Layout
 * Complete dashboard example with mixed stats
 */
export function DashboardExample() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <StatCardGrid columns={4}>
          <StatCard
            title="Total BOMs"
            value={156}
            icon={FileText}
            variant="primary"
            trend={{
              value: "+12",
              direction: "up",
              label: "this month",
            }}
          />
          <StatCard
            title="Components"
            value="2,834"
            icon={Cpu}
            trend={{
              value: "+156",
              direction: "up",
              label: "this month",
            }}
          />
          <StatCard
            title="Team Members"
            value={24}
            icon={Users}
          />
          <StatCard
            title="Total Value"
            value="$234,567"
            icon={DollarSign}
            variant="success"
            trend={{
              value: "+8.3%",
              direction: "up",
            }}
          />
        </StatCardGrid>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Alerts</h2>
        <StatCardGrid columns={3}>
          <StatCard
            title="Critical Issues"
            value={3}
            icon={AlertCircle}
            variant="error"
            onClick={() => console.log('View critical issues')}
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
            onClick={() => console.log('View warnings')}
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

/**
 * Example 10: Responsive Grid Columns
 * Different column counts for different layouts
 */
export function ResponsiveGridExample() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">2 Column Grid</h3>
        <StatCardGrid columns={2}>
          <StatCard title="Metric A" value={100} icon={TrendingUp} />
          <StatCard title="Metric B" value={200} icon={TrendingUp} />
        </StatCardGrid>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">3 Column Grid</h3>
        <StatCardGrid columns={3}>
          <StatCard title="Metric A" value={100} icon={Package} />
          <StatCard title="Metric B" value={200} icon={Package} />
          <StatCard title="Metric C" value={300} icon={Package} />
        </StatCardGrid>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">4 Column Grid (Default)</h3>
        <StatCardGrid columns={4}>
          <StatCard title="Metric A" value={100} icon={Cpu} />
          <StatCard title="Metric B" value={200} icon={Cpu} />
          <StatCard title="Metric C" value={300} icon={Cpu} />
          <StatCard title="Metric D" value={400} icon={Cpu} />
        </StatCardGrid>
      </div>
    </div>
  );
}
