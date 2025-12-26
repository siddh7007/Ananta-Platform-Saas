/**
 * BOMWorkflowCard Component
 *
 * CBP-style collapsible card displaying BOM workflow status with:
 * - Collapsed state: BOM summary with status badge
 * - Expanded state: 8-step vertical stepper + queue cards with progress grids + context links
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import FolderIcon from '@mui/icons-material/Folder';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DataObjectIcon from '@mui/icons-material/DataObject';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { keyframes } from '@mui/system';
import RiskAnalysisCard, { RiskAnalysis } from './RiskAnalysisCard';
import QueueProgressGrid, { QueueProgressStats } from './QueueProgressGrid';
import ContextLinks, { BOMContextLinks } from './ContextLinks';

// Types
export type BOMStatus =
  | 'pending'
  | 'uploading'
  | 'parsing'
  | 'mapping'
  | 'saving'
  | 'enriching'
  | 'analyzing'
  | 'completed'
  | 'failed';

export interface BOMLineItemPreview {
  id: string;
  mpn: string;
  manufacturer: string;
  status: 'enriched' | 'pending' | 'failed';
  qualityScore?: number;
}

export interface BOMWorkflow {
  id: string;
  name: string;
  status: BOMStatus;
  progress: number; // 0-100
  tenantId: string;
  tenantName: string;
  workspaceId: string;
  workspaceName: string;
  componentCount: number;
  createdAt: string;
  updatedAt: string;
  fileName?: string;
  fileSize?: number;
  enrichmentStats?: {
    total: number;
    enriched: number;
    failed: number;
    pending: number;
    avgQuality: number;
  };
  riskAnalysis?: RiskAnalysis;
  lineItems?: BOMLineItemPreview[];
  // New: Upload queue stats
  uploadStats?: {
    total: number;
    parsed: number;
    failed: number;
    pending: number;
  };
  // New: Analysis queue stats
  analysisStats?: {
    total: number;
    analyzed: number;
    failed: number;
    pending: number;
  };
  // New: Alerts stats
  alertsStats?: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface BOMWorkflowCardProps {
  workflow: BOMWorkflow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAction: (action: 'pause' | 'resume' | 'view' | 'export' | 'delete') => void;
  onViewLineItems?: () => void;
  onViewEnriched?: () => void;
  onViewPending?: () => void;
  onViewFailed?: () => void;
  onViewRiskAnalysis?: () => void;
}

// 8-Step Workflow Configuration
const WORKFLOW_STEPS = [
  { id: 'select', label: 'Select Files', description: 'Choose BOM file for upload' },
  { id: 'upload', label: 'Upload & Parse', description: 'Upload and parse file contents' },
  { id: 'map', label: 'Map Columns', description: 'Map columns to BOM schema' },
  { id: 'save', label: 'Save BOM', description: 'Persist BOM to database' },
  { id: 'enrich', label: 'Enrichment', description: 'Enrich component data' },
  { id: 'risk', label: 'Risk Analysis', description: 'Analyze supply chain risks' },
  { id: 'alerts', label: 'Alerts', description: 'Generate risk alerts' },
  { id: 'complete', label: 'Complete', description: 'Workflow finished' },
];

// Map BOM status to step index
const STATUS_TO_STEP: Record<BOMStatus, number> = {
  pending: 0,
  uploading: 1,
  parsing: 1,
  mapping: 2,
  saving: 3,
  enriching: 4,
  analyzing: 5,
  alerting: 6,
  completed: 7,
  failed: -1,
} as any;

// Status Badge Colors
const STATUS_COLORS: Record<BOMStatus, { bg: string; text: string }> = {
  pending: { bg: '#f3f4f6', text: '#6b7280' },
  uploading: { bg: '#dbeafe', text: '#1d4ed8' },
  parsing: { bg: '#dbeafe', text: '#1d4ed8' },
  mapping: { bg: '#fef3c7', text: '#d97706' },
  saving: { bg: '#fef3c7', text: '#d97706' },
  enriching: { bg: '#dbeafe', text: '#1d4ed8' },
  analyzing: { bg: '#e0e7ff', text: '#4338ca' },
  completed: { bg: '#dcfce7', text: '#166534' },
  failed: { bg: '#fee2e2', text: '#dc2626' },
};

// Animations
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Helper to format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Sub-components
function StatusBadge({ status, progress }: { status: BOMStatus; progress: number }) {
  const colors = STATUS_COLORS[status];
  const isActive = ['uploading', 'parsing', 'mapping', 'enriching', 'analyzing'].includes(status);

  return (
    <Chip
      icon={
        isActive ? (
          <AutorenewIcon sx={{ fontSize: 16, animation: `${spin} 2s linear infinite` }} />
        ) : status === 'completed' ? (
          <CheckCircleIcon sx={{ fontSize: 16 }} />
        ) : status === 'failed' ? (
          <ErrorIcon sx={{ fontSize: 16 }} />
        ) : (
          <HourglassEmptyIcon sx={{ fontSize: 16 }} />
        )
      }
      label={
        isActive && progress > 0
          ? `${status.toUpperCase()} ${progress}%`
          : status.toUpperCase()
      }
      size="small"
      sx={{
        bgcolor: colors.bg,
        color: colors.text,
        fontWeight: 600,
        '& .MuiChip-icon': { color: colors.text },
      }}
    />
  );
}

/**
 * Upload Queue Card - CBP Style with Progress Grid
 */
function UploadQueueCard({ workflow, onViewLineItems }: { workflow: BOMWorkflow; onViewLineItems?: () => void }) {
  const stats: QueueProgressStats = workflow.uploadStats
    ? {
        pending: workflow.uploadStats.pending,
        processing: 0,
        completed: workflow.uploadStats.parsed,
        failed: workflow.uploadStats.failed,
        total: workflow.uploadStats.total,
      }
    : {
        pending: 0,
        processing: ['uploading', 'parsing'].includes(workflow.status) ? 1 : 0,
        completed: ['mapping', 'saving', 'enriching', 'analyzing', 'completed'].includes(workflow.status) ? 1 : 0,
        failed: workflow.status === 'failed' && STATUS_TO_STEP[workflow.status] <= 1 ? 1 : 0,
        total: 1,
      };

  const isActive = ['uploading', 'parsing'].includes(workflow.status);

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <CloudUploadIcon sx={{ fontSize: 20, color: isActive ? '#1d4ed8' : '#6b7280' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Upload Queue
          </Typography>
          {isActive && (
            <Chip label="Processing" size="small" sx={{ ml: 'auto', bgcolor: '#dbeafe', color: '#1d4ed8' }} />
          )}
        </Box>

        {/* File Info */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">File</Typography>
            <Typography variant="body2" fontWeight={500}>{workflow.fileName || 'Unknown'}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="text.secondary">Size</Typography>
            <Typography variant="body2">{formatFileSize(workflow.fileSize)}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="text.secondary">Rows</Typography>
            <Typography variant="body2">{workflow.componentCount}</Typography>
          </Grid>
        </Grid>

        {/* Progress Grid */}
        <QueueProgressGrid stats={stats} label="Upload Progress" />

        {/* Context Links */}
        {onViewLineItems && (
          <ContextLinks
            links={[
              { label: 'View Parsed Data', onClick: onViewLineItems, count: workflow.componentCount },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Enrichment Queue Card - CBP Style with Progress Grid
 */
function EnrichmentQueueCard({
  stats,
  isActive,
  onViewEnriched,
  onViewPending,
  onViewFailed,
}: {
  stats: BOMWorkflow['enrichmentStats'];
  isActive: boolean;
  onViewEnriched?: () => void;
  onViewPending?: () => void;
  onViewFailed?: () => void;
}) {
  if (!stats) {
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <DataObjectIcon sx={{ fontSize: 20, color: '#6b7280' }} />
            <Typography variant="subtitle2" fontWeight={600}>Enrichment Queue</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Enrichment data will appear when processing begins
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const queueStats: QueueProgressStats = {
    pending: stats.pending,
    processing: isActive ? Math.min(1, stats.pending) : 0,
    completed: stats.enriched,
    failed: stats.failed,
    total: stats.total,
    successRate: stats.total > 0 ? Math.round((stats.enriched / stats.total) * 100) : 0,
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <DataObjectIcon sx={{ fontSize: 20, color: isActive ? '#1d4ed8' : '#6b7280' }} />
          <Typography variant="subtitle2" fontWeight={600}>Enrichment Queue</Typography>
          {isActive && (
            <Chip label="Processing" size="small" sx={{ ml: 'auto', bgcolor: '#dbeafe', color: '#1d4ed8' }} />
          )}
          {stats.avgQuality > 0 && (
            <Chip
              label={`Avg Quality: ${stats.avgQuality}%`}
              size="small"
              sx={{
                ml: isActive ? 1 : 'auto',
                bgcolor: stats.avgQuality >= 90 ? '#dcfce7' : stats.avgQuality >= 70 ? '#fef3c7' : '#fee2e2',
                color: stats.avgQuality >= 90 ? '#166534' : stats.avgQuality >= 70 ? '#d97706' : '#dc2626',
              }}
            />
          )}
        </Box>

        {/* Progress Grid */}
        <QueueProgressGrid stats={queueStats} label="Enrichment Progress" showSuccessRate />

        {/* Context Links */}
        <ContextLinks
          links={[
            ...(onViewEnriched ? [{ label: 'Enriched', onClick: onViewEnriched, count: stats.enriched }] : []),
            ...(onViewPending && stats.pending > 0 ? [{ label: 'Pending', onClick: onViewPending, count: stats.pending }] : []),
            ...(onViewFailed && stats.failed > 0 ? [{ label: 'Failed', onClick: onViewFailed, count: stats.failed }] : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Analysis Queue Card - CBP Style with Progress Grid
 */
function AnalysisQueueCard({
  workflow,
  onViewRiskAnalysis,
}: {
  workflow: BOMWorkflow;
  onViewRiskAnalysis?: () => void;
}) {
  const isActive = workflow.status === 'analyzing';
  const isComplete = ['completed'].includes(workflow.status) || (workflow.riskAnalysis?.score !== undefined);

  const stats: QueueProgressStats = workflow.analysisStats
    ? {
        pending: workflow.analysisStats.pending,
        processing: isActive ? 1 : 0,
        completed: workflow.analysisStats.analyzed,
        failed: workflow.analysisStats.failed,
        total: workflow.analysisStats.total,
      }
    : {
        pending: isActive || !isComplete ? 1 : 0,
        processing: isActive ? 1 : 0,
        completed: isComplete ? 1 : 0,
        failed: 0,
        total: 1,
      };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <AssessmentIcon sx={{ fontSize: 20, color: isActive ? '#4338ca' : '#6b7280' }} />
          <Typography variant="subtitle2" fontWeight={600}>Risk Analysis Queue</Typography>
          {isActive && (
            <Chip label="Analyzing" size="small" sx={{ ml: 'auto', bgcolor: '#e0e7ff', color: '#4338ca' }} />
          )}
          {workflow.riskAnalysis?.grade && (
            <Chip
              label={`Grade: ${workflow.riskAnalysis.grade}`}
              size="small"
              sx={{
                ml: isActive ? 1 : 'auto',
                bgcolor: workflow.riskAnalysis.score >= 80 ? '#dcfce7' : workflow.riskAnalysis.score >= 60 ? '#fef3c7' : '#fee2e2',
                color: workflow.riskAnalysis.score >= 80 ? '#166534' : workflow.riskAnalysis.score >= 60 ? '#d97706' : '#dc2626',
                fontWeight: 600,
              }}
            />
          )}
        </Box>

        {/* Progress Grid */}
        <QueueProgressGrid stats={stats} label="Analysis Progress" />

        {/* Context Links */}
        {onViewRiskAnalysis && isComplete && (
          <ContextLinks
            links={[
              { label: 'View Full Analysis', onClick: onViewRiskAnalysis },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Alerts Queue Card - CBP Style
 */
function AlertsQueueCard({ workflow }: { workflow: BOMWorkflow }) {
  const hasAlerts = workflow.alertsStats && workflow.alertsStats.total > 0;
  const isComplete = workflow.status === 'completed';

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <WarningAmberIcon sx={{ fontSize: 20, color: hasAlerts ? '#d97706' : '#6b7280' }} />
          <Typography variant="subtitle2" fontWeight={600}>Alerts</Typography>
          {hasAlerts && (
            <Chip
              label={`${workflow.alertsStats!.total} Alerts`}
              size="small"
              sx={{ ml: 'auto', bgcolor: '#fef3c7', color: '#d97706' }}
            />
          )}
        </Box>

        {hasAlerts ? (
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fee2e2', borderColor: '#fca5a5' }}>
                <Typography variant="h6" sx={{ color: '#dc2626', fontWeight: 700 }}>
                  {workflow.alertsStats!.high}
                </Typography>
                <Typography variant="caption" sx={{ color: '#dc2626' }}>High</Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fef3c7', borderColor: '#fcd34d' }}>
                <Typography variant="h6" sx={{ color: '#d97706', fontWeight: 700 }}>
                  {workflow.alertsStats!.medium}
                </Typography>
                <Typography variant="caption" sx={{ color: '#d97706' }}>Medium</Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fef9c3', borderColor: '#fde047' }}>
                <Typography variant="h6" sx={{ color: '#ca8a04', fontWeight: 700 }}>
                  {workflow.alertsStats!.low}
                </Typography>
                <Typography variant="caption" sx={{ color: '#ca8a04' }}>Low</Typography>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {isComplete ? 'No alerts generated for this BOM' : 'Alerts will appear after analysis completes'}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Processing Complete Summary - CBP Style
 */
function ProcessingCompleteSummary({ workflow, onAction }: { workflow: BOMWorkflow; onAction: (action: string) => void }) {
  if (workflow.status !== 'completed') return null;

  const enrichmentRate = workflow.enrichmentStats
    ? Math.round((workflow.enrichmentStats.enriched / workflow.enrichmentStats.total) * 100)
    : 0;

  return (
    <Card variant="outlined" sx={{ mb: 2, bgcolor: '#f0fdf4', borderColor: '#86efac' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <CheckCircleIcon sx={{ fontSize: 24, color: '#22c55e' }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#166534' }}>
            Processing Complete
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={3}>
            <Typography variant="caption" color="text.secondary">Components</Typography>
            <Typography variant="h6" fontWeight={600}>{workflow.componentCount}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="text.secondary">Enriched</Typography>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#22c55e' }}>
              {workflow.enrichmentStats?.enriched || 0}
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="text.secondary">Success Rate</Typography>
            <Typography variant="h6" fontWeight={600} sx={{ color: enrichmentRate >= 90 ? '#22c55e' : enrichmentRate >= 70 ? '#f59e0b' : '#ef4444' }}>
              {enrichmentRate}%
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="text.secondary">Risk Grade</Typography>
            <Typography variant="h6" fontWeight={600}>
              {workflow.riskAnalysis?.grade || '--'}
            </Typography>
          </Grid>
        </Grid>

        {/* Quick Actions */}
        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: '#86efac' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => onAction('view')}>
              View Details
            </Button>
            <Button size="small" variant="outlined" onClick={() => onAction('export')}>
              Export CSV
            </Button>
            <Button size="small" variant="outlined" color="primary">
              View Risk Report
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

function LineItemsPreviewTable({ items, onViewAll }: { items?: BOMLineItemPreview[]; onViewAll?: () => void }) {
  if (!items || items.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Line Items</Typography>
          <Typography variant="caption" color="text.secondary">
            No line items available yet
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const displayItems = items.slice(0, 5);
  const remainingCount = items.length - 5;

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" gutterBottom>Line Items Preview</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>MPN</TableCell>
                <TableCell>Manufacturer</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Quality</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{item.mpn}</Typography>
                  </TableCell>
                  <TableCell>{item.manufacturer}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {item.status === 'enriched' && <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e' }} />}
                      {item.status === 'pending' && <HourglassEmptyIcon sx={{ fontSize: 14, color: '#f59e0b' }} />}
                      {item.status === 'failed' && <ErrorIcon sx={{ fontSize: 14, color: '#ef4444' }} />}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {item.qualityScore !== undefined ? (
                      <Typography variant="body2" fontWeight={600}>{item.qualityScore}%</Typography>
                    ) : '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {remainingCount > 0 && onViewAll && (
          <Button
            variant="text"
            size="small"
            onClick={onViewAll}
            sx={{ mt: 1, textTransform: 'none' }}
          >
            View All {items.length} Items →
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Main Component
export default function BOMWorkflowCard({
  workflow,
  expanded,
  onToggleExpand,
  onAction,
  onViewLineItems,
  onViewEnriched,
  onViewPending,
  onViewFailed,
  onViewRiskAnalysis,
}: BOMWorkflowCardProps) {
  const currentStep = useMemo(() => {
    const step = STATUS_TO_STEP[workflow.status];
    return step >= 0 ? step : -1;
  }, [workflow.status]);

  const isActive = ['uploading', 'parsing', 'mapping', 'enriching', 'analyzing'].includes(workflow.status);
  const isFailed = workflow.status === 'failed';
  const isComplete = workflow.status === 'completed';
  const isEnriching = workflow.status === 'enriching';

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: expanded ? 'primary.main' : 'divider',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Collapsed Header */}
      <Box
        onClick={onToggleExpand}
        sx={{
          p: 2,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>

            <Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{ fontFamily: 'monospace', color: 'primary.main' }}
                >
                  {workflow.id.substring(0, 8).toUpperCase()}
                </Typography>
                <Typography variant="subtitle1" fontWeight={500}>
                  {workflow.name}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Tenant: {workflow.tenantName} | Workspace: {workflow.workspaceName} | {workflow.componentCount} components
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <StatusBadge status={workflow.status} progress={workflow.progress} />
            <Typography variant="caption" color="text.secondary">
              {formatRelativeTime(workflow.updatedAt)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Expanded Content */}
      <Collapse in={expanded}>
        <Divider />
        <CardContent sx={{ p: 3 }}>
          {/* Processing Complete Summary (if completed) */}
          <ProcessingCompleteSummary workflow={workflow} onAction={onAction} />

          <Grid container spacing={3}>
            {/* Left Column - Vertical Stepper */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stepper activeStep={currentStep} orientation="vertical">
                  {WORKFLOW_STEPS.map((step, index) => {
                    const isStepComplete = currentStep > index || isComplete;
                    const isStepActive = currentStep === index && isActive;
                    const isStepFailed = isFailed && currentStep === index;

                    return (
                      <Step key={step.id} completed={isStepComplete}>
                        <StepLabel
                          error={isStepFailed}
                          StepIconProps={{
                            sx: isStepActive
                              ? { animation: `${spin} 2s linear infinite` }
                              : undefined,
                          }}
                        >
                          <Typography variant="body2" fontWeight={isStepActive ? 600 : 400}>
                            {step.label}
                          </Typography>
                        </StepLabel>
                        <StepContent>
                          <Typography variant="caption" color="text.secondary">
                            {step.description}
                          </Typography>
                          {isStepActive && step.id === 'enrich' && workflow.enrichmentStats && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                              {workflow.enrichmentStats.enriched}/{workflow.enrichmentStats.total} ({workflow.progress}%)
                            </Typography>
                          )}
                        </StepContent>
                      </Step>
                    );
                  })}
                </Stepper>
              </Paper>
            </Grid>

            {/* Right Column - Queue Cards */}
            <Grid item xs={12} md={8}>
              {/* Upload Queue Card */}
              <UploadQueueCard workflow={workflow} onViewLineItems={onViewLineItems} />

              {/* Enrichment Queue Card */}
              <EnrichmentQueueCard
                stats={workflow.enrichmentStats}
                isActive={isEnriching}
                onViewEnriched={onViewEnriched}
                onViewPending={onViewPending}
                onViewFailed={onViewFailed}
              />

              {/* Analysis Queue Card */}
              <AnalysisQueueCard workflow={workflow} onViewRiskAnalysis={onViewRiskAnalysis} />

              {/* Alerts Queue Card */}
              <AlertsQueueCard workflow={workflow} />

              {/* Risk Analysis Card (Compact) */}
              {workflow.riskAnalysis && (
                <RiskAnalysisCard
                  analysis={workflow.riskAnalysis}
                  compact
                  onViewFull={onViewRiskAnalysis}
                />
              )}

              {/* Line Items Preview */}
              <LineItemsPreviewTable items={workflow.lineItems} onViewAll={onViewLineItems} />
            </Grid>
          </Grid>

          {/* Actions */}
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {isActive && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<PauseIcon />}
                onClick={() => onAction('pause')}
              >
                Pause
              </Button>
            )}
            {workflow.status === 'pending' && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={() => onAction('resume')}
              >
                Resume
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => onAction('view')}
            >
              View Full Details
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => onAction('export')}
            >
              Export CSV
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => onAction('delete')}
            >
              Delete
            </Button>
          </Stack>
        </CardContent>
      </Collapse>
    </Card>
  );
}
