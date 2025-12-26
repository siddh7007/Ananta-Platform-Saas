/**
 * Owner Portfolio Dashboard
 * CBP-P2-001: Portfolio Overview for Owner-Level Users
 *
 * Provides organization-wide visibility into BOMs, team activity,
 * spend analysis, and risk metrics across all engineers.
 */

import { useState } from 'react';
import { usePermissions, useNavigation } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Calendar } from 'lucide-react';
import { PortfolioStats } from './components/PortfolioStats';
import { BomsByEngineer } from './components/BomsByEngineer';
import { SpendOverview } from './components/SpendOverview';
import { RiskSummary } from './components/RiskSummary';
import { RecentActivity } from './components/RecentActivity';
import { DateRangePicker, type DateRange } from './components/DateRangePicker';

export function PortfolioPage() {
  const { data: permissions } = usePermissions<string[]>();
  const { push } = useNavigation();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    to: new Date(),
    preset: 'last30days',
  });

  // Access control: Only owner and super_admin can view
  const hasAccess = permissions?.includes('owner') || permissions?.includes('super_admin');

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            The Portfolio Dashboard requires Owner or Super Admin access.
            Please contact your administrator if you need access to organization-wide analytics.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => push('/dashboard')}
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Overview</h1>
          <p className="text-muted-foreground">
            Organization-wide BOM management and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            className="w-[280px]"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <PortfolioStats dateRange={dateRange} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BOMs by Engineer (spans 2 columns on large screens) */}
        <div className="lg:col-span-2">
          <BomsByEngineer dateRange={dateRange} />
        </div>

        {/* Risk Summary (1 column) */}
        <div>
          <RiskSummary />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendOverview dateRange={dateRange} />
        <RecentActivity limit={10} />
      </div>
    </div>
  );
}

export default PortfolioPage;
