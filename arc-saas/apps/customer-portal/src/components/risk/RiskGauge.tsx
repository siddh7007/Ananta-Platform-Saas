/**
 * Risk Gauge Component
 * Visual circular gauge showing risk score with health grade
 */

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface RiskGaugeProps {
  score: number; // 0-100
  healthGrade: string; // A-F
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const GRADE_COLORS: Record<string, { stroke: string; bg: string; text: string }> = {
  A: { stroke: '#16a34a', bg: 'bg-green-50', text: 'text-green-700' },
  B: { stroke: '#2563eb', bg: 'bg-blue-50', text: 'text-blue-700' },
  C: { stroke: '#ca8a04', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  D: { stroke: '#ea580c', bg: 'bg-orange-50', text: 'text-orange-700' },
  F: { stroke: '#dc2626', bg: 'bg-red-50', text: 'text-red-700' },
};

const SIZE_CONFIG = {
  sm: { width: 120, strokeWidth: 8, fontSize: 'text-2xl' },
  md: { width: 160, strokeWidth: 10, fontSize: 'text-3xl' },
  lg: { width: 200, strokeWidth: 12, fontSize: 'text-4xl' },
};

export function RiskGauge({
  score,
  healthGrade,
  label = 'Risk Score',
  size = 'md',
  isLoading = false,
}: RiskGaugeProps) {
  if (isLoading) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center">
        <Skeleton className="rounded-full" style={{ width: SIZE_CONFIG[size].width, height: SIZE_CONFIG[size].width }} />
        <Skeleton className="h-4 w-24 mt-2" />
      </Card>
    );
  }

  const config = SIZE_CONFIG[size];
  const gradeConfig = GRADE_COLORS[healthGrade] || GRADE_COLORS.F;

  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="p-6 flex flex-col items-center justify-center">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg width={config.width} height={config.width} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            stroke={gradeConfig.stroke}
            strokeWidth={config.strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={cn('font-bold', config.fontSize, gradeConfig.text)}>
            {healthGrade}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {score.toFixed(0)}/100
          </div>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm text-muted-foreground mt-2">{label}</p>
    </Card>
  );
}

export default RiskGauge;
