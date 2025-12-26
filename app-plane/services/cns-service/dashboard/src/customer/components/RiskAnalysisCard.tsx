/**
 * RiskAnalysisCard Component
 *
 * Display risk analysis summary for a BOM.
 * Used inside expanded BOMWorkflowCard and in the Risk & Alerts tab.
 */

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export interface RiskAnalysis {
  grade: string; // A+, A, B+, B, C+, C, D, F
  score: number; // 0-100
  lifecycle: {
    eolCount: number;
    nrndCount: number;
    obsoleteCount: number;
  };
  supplyChain: {
    singleSourceCount: number;
    limitedAvailability: number;
  };
  compliance: {
    rohsIssues: number;
    reachIssues: number;
    otherIssues: number;
  };
}

export interface RiskAnalysisCardProps {
  analysis: RiskAnalysis | null;
  loading?: boolean;
  compact?: boolean; // For embedded use in BOMWorkflowCard
  onViewFull?: () => void;
}

// Grade color mapping
const GRADE_COLORS: Record<string, string> = {
  'A+': '#22c55e',
  A: '#22c55e',
  'B+': '#84cc16',
  B: '#84cc16',
  'C+': '#eab308',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

function getGradeColor(grade: string): string {
  return GRADE_COLORS[grade] || '#6b7280';
}

function RiskCategory({
  label,
  count,
  details,
}: {
  label: string;
  count: number;
  details: string;
}) {
  const hasIssues = count > 0;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        {hasIssues ? (
          <WarningIcon sx={{ fontSize: 18, color: count > 3 ? '#ef4444' : '#f59e0b' }} />
        ) : (
          <CheckCircleIcon sx={{ fontSize: 18, color: '#22c55e' }} />
        )}
        <Typography variant="body2" fontWeight={500}>
          {label}
        </Typography>
        <Chip
          label={`${count} ${count === 1 ? 'issue' : 'issues'}`}
          size="small"
          sx={{
            ml: 'auto',
            height: 20,
            fontSize: '0.7rem',
            bgcolor: hasIssues ? (count > 3 ? '#fee2e2' : '#fef3c7') : '#dcfce7',
            color: hasIssues ? (count > 3 ? '#dc2626' : '#d97706') : '#166534',
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5 }}>
        {details}
      </Typography>
    </Box>
  );
}

function LoadingSkeleton({ compact }: { compact?: boolean }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: compact ? 1.5 : 2 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Skeleton variant="circular" width={48} height={48} />
          <Box flex={1}>
            <Skeleton variant="text" width={80} height={24} />
            <Skeleton variant="text" width={60} height={16} />
          </Box>
        </Box>
        <Skeleton variant="rectangular" height={4} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="80%" height={20} />
      </CardContent>
    </Card>
  );
}

function EmptyState({ compact }: { compact?: boolean }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent
        sx={{
          p: compact ? 1.5 : 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: compact ? 120 : 180,
        }}
      >
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No risk analysis available
        </Typography>
        <Typography variant="caption" color="text.disabled" textAlign="center" mt={0.5}>
          Risk analysis will appear after enrichment completes
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function RiskAnalysisCard({
  analysis,
  loading = false,
  compact = false,
  onViewFull,
}: RiskAnalysisCardProps) {
  if (loading) {
    return <LoadingSkeleton compact={compact} />;
  }

  if (!analysis) {
    return <EmptyState compact={compact} />;
  }

  const { grade, score, lifecycle, supplyChain, compliance } = analysis;
  const gradeColor = getGradeColor(grade);

  // Calculate totals for each category
  const lifecycleTotal = lifecycle.eolCount + lifecycle.nrndCount + lifecycle.obsoleteCount;
  const supplyChainTotal = supplyChain.singleSourceCount + supplyChain.limitedAvailability;
  const complianceTotal = compliance.rohsIssues + compliance.reachIssues + compliance.otherIssues;

  // Build detail strings
  const lifecycleDetails =
    lifecycleTotal > 0
      ? [
          lifecycle.eolCount > 0 && `${lifecycle.eolCount} EOL`,
          lifecycle.nrndCount > 0 && `${lifecycle.nrndCount} NRND`,
          lifecycle.obsoleteCount > 0 && `${lifecycle.obsoleteCount} obsolete`,
        ]
          .filter(Boolean)
          .join(', ')
      : 'All components active';

  const supplyChainDetails =
    supplyChainTotal > 0
      ? [
          supplyChain.singleSourceCount > 0 && `${supplyChain.singleSourceCount} single-source`,
          supplyChain.limitedAvailability > 0 &&
            `${supplyChain.limitedAvailability} limited availability`,
        ]
          .filter(Boolean)
          .join(', ')
      : 'No supply risks identified';

  const complianceDetails =
    complianceTotal > 0
      ? [
          compliance.rohsIssues > 0 && `${compliance.rohsIssues} RoHS`,
          compliance.reachIssues > 0 && `${compliance.reachIssues} REACH`,
          compliance.otherIssues > 0 && `${compliance.otherIssues} other`,
        ]
          .filter(Boolean)
          .join(', ')
      : 'All compliant';

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: compact ? 1.5 : 2 }}>
        {/* Header with Grade and Score */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {/* Grade Circle */}
          <Box
            sx={{
              width: compact ? 40 : 48,
              height: compact ? 40 : 48,
              borderRadius: '50%',
              bgcolor: gradeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant={compact ? 'body1' : 'h6'}
              sx={{ color: 'white', fontWeight: 700 }}
            >
              {grade}
            </Typography>
          </Box>

          <Box flex={1}>
            <Typography variant={compact ? 'subtitle2' : 'subtitle1'} fontWeight={600}>
              Risk Analysis
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Score: {score}/100
            </Typography>
          </Box>
        </Box>

        {/* Score Progress Bar */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={score}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: '#e5e7eb',
              '& .MuiLinearProgress-bar': {
                bgcolor: gradeColor,
                borderRadius: 3,
              },
            }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Risk Categories */}
        <Stack spacing={0}>
          <RiskCategory label="Lifecycle" count={lifecycleTotal} details={lifecycleDetails} />
          <RiskCategory label="Supply Chain" count={supplyChainTotal} details={supplyChainDetails} />
          <RiskCategory label="Compliance" count={complianceTotal} details={complianceDetails} />
        </Stack>

        {/* View Full Analysis Button */}
        {onViewFull && (
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button
              size="small"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={onViewFull}
              sx={{ textTransform: 'none' }}
            >
              View Full Analysis
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
