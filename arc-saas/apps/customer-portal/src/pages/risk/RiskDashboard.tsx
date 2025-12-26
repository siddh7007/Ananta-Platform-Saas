/**
 * Risk Analysis Dashboard
 *
 * Portfolio-level risk analysis showing aggregated risk scores
 * across all BOMs and components in the workspace.
 *
 * Features:
 * - Portfolio risk summary with health grade (A-F)
 * - Risk distribution by level (Critical, High, Medium, Low)
 * - Top high-risk components requiring attention
 * - Risk breakdown by category (lifecycle, supply chain, compliance, etc.)
 * - Historical risk trends (if data available)
 * - Active alerts with acknowledge/dismiss/snooze actions
 */

import { useState, useCallback } from 'react';
import { RefreshCw, Download, Settings, Info } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useRiskDashboard } from '@/hooks/useRisk';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RiskSummaryCard,
  RiskGauge,
  TopRisksTable,
  RiskDistributionChart,
  RiskCategoryBreakdown,
} from '@/components/risk';
import { RiskAlertsSection } from './RiskAlertsSection';

type DashboardTab = 'overview' | 'alerts';

export function RiskDashboardPage() {
  const { currentTenant } = useTenant();
  const { portfolio, statistics, highRisk, isLoading, isError, error } = useRiskDashboard();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as DashboardTab);
  }, []);

  // Handle error state
  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Risk Analysis</h1>
          <p className="mt-2 text-gray-600">
            Portfolio-level risk assessment for {currentTenant?.name || 'your workspace'}
          </p>
        </div>

        <Alert variant="destructive">
          <AlertTitle>Failed to Load Risk Data</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'An unexpected error occurred while loading risk data.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Extract data from API responses
  const portfolioData = portfolio.data;
  const statsData = statistics.data;
  const highRiskComponents = highRisk.data || [];

  // Calculate risk distribution from portfolio data
  const riskDistribution = portfolioData?.risk_distribution || {};
  const lowCount = riskDistribution['low'] || 0;
  const mediumCount = riskDistribution['medium'] || 0;
  const highCount = riskDistribution['high'] || 0;
  const criticalCount = riskDistribution['critical'] || 0;

  // Calculate health grade based on risk distribution (CNS API may provide this)
  const totalComponents = portfolioData?.total_components || 0;
  const averageRiskScore = portfolioData?.average_risk_score || 0;

  // Health grade calculation (A-F based on average risk score)
  const getHealthGrade = (score: number): string => {
    if (score < 20) return 'A';
    if (score < 40) return 'B';
    if (score < 60) return 'C';
    if (score < 80) return 'D';
    return 'F';
  };

  const healthGrade = getHealthGrade(averageRiskScore);

  // Risk trend from portfolio data
  const trend = portfolioData?.trend || 'stable';

  // Factor averages from statistics
  const factorAverages = statsData?.factor_averages || {
    lifecycle: 0,
    supply_chain: 0,
    compliance: 0,
    obsolescence: 0,
    single_source: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Risk Analysis</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Portfolio-level risk assessment for {currentTenant?.name || 'your workspace'}
          </p>
        </div>
        {activeTab === 'overview' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm" disabled={isLoading}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                portfolio.refetch();
                statistics.refetch();
                highRisk.refetch();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="overview">Risk Overview</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
        </TabsList>

        {/* Risk Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Info Alert */}
          {!isLoading && totalComponents === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Risk Data Available</AlertTitle>
              <AlertDescription>
                Upload BOMs and enrich components to start analyzing supply chain risks.
              </AlertDescription>
            </Alert>
          )}

          {/* Main Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Summary Cards */}
            <div className="lg:col-span-2 space-y-6">
              {/* Risk Summary Card */}
              <RiskSummaryCard
                totalComponents={totalComponents}
                criticalCount={criticalCount}
                highCount={highCount}
                mediumCount={mediumCount}
                lowCount={lowCount}
                healthGrade={healthGrade}
                averageRiskScore={averageRiskScore}
                trend={trend}
                isLoading={isLoading}
              />

              {/* Risk Distribution Chart */}
              <RiskDistributionChart
                lowCount={lowCount}
                mediumCount={mediumCount}
                highCount={highCount}
                criticalCount={criticalCount}
                isLoading={isLoading}
              />

              {/* Risk Category Breakdown */}
              <RiskCategoryBreakdown
                factorAverages={factorAverages}
                isLoading={isLoading}
              />
            </div>

            {/* Right Column - Health Gauge */}
            <div className="space-y-6">
              <RiskGauge
                score={averageRiskScore}
                healthGrade={healthGrade}
                label="Portfolio Health"
                size="lg"
                isLoading={isLoading}
              />

              {/* Risk Weights Info */}
              {!isLoading && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Risk Calculation Weights</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Lifecycle</span>
                      <span className="font-semibold">30%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Supply Chain</span>
                      <span className="font-semibold">25%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compliance</span>
                      <span className="font-semibold">20%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Obsolescence</span>
                      <span className="font-semibold">15%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Single Source</span>
                      <span className="font-semibold">10%</span>
                    </div>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0 text-xs"
                  >
                    Customize Weights
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Top High-Risk Components */}
          <TopRisksTable
            risks={highRiskComponents}
            isLoading={isLoading}
            onViewComponent={(componentId) => {
              console.log('View component:', componentId);
              // TODO: Navigate to component detail page
            }}
            limit={10}
          />

          {/* Footer Info */}
          {!isLoading && totalComponents > 0 && (
            <div className="text-xs text-muted-foreground text-center p-4 border-t">
              <p>
                Last updated: {new Date().toLocaleString()} • Analyzing {totalComponents.toLocaleString()} components
              </p>
              <p className="mt-1">
                Risk scores are calculated based on lifecycle status, supply chain availability, compliance data,
                obsolescence predictions, and supplier diversity.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Active Alerts Tab */}
        <TabsContent value="alerts">
          <RiskAlertsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RiskDashboardPage;
