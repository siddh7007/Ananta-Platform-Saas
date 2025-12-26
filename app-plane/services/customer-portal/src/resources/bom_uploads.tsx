import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  NumberField,
  Show,
  SimpleShowLayout,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  DatagridConfigurable,
  EditButton,
  useRecordContext,
  required,
  TabbedShowLayout,
  Tab,
  ReferenceManyField,
  useNotify,
  useRefresh,
  TopToolbar,
  Button as RaButton,
  FunctionField,
  ShowButton,
  ListContextProvider,
  useGetList,
  Loading,
  ResourceContextProvider,
} from 'react-admin';
import { Chip, Box, Card, CardContent, Typography, Grid, Button, IconButton, Tooltip, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress, TextField as MuiTextField, LinearProgress } from '@mui/material';
import { getCnsBaseUrl, getAuthHeaders } from '../services/cnsApi';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import ArchiveIcon from '@mui/icons-material/Archive';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TableChartIcon from '@mui/icons-material/TableChart';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { supabase } from '../providers/dataProvider';

// ============================================================================
// Workflow Step Configuration
// ============================================================================

interface WorkflowStep {
  step: number;
  total: number;
  label: string;
  description: string;
  canContinue: boolean;
  resumeHash: string; // URL hash for button click
  workflowHash?: string; // URL hash for row click (full workflow view)
}

/**
 * Map bom_uploads.status to workflow step
 * Upload → Parse → Map Columns → Save BOM → Enrich → Analyze → Complete
 */
function getWorkflowStep(record: any): WorkflowStep {
  const status = record?.status?.toLowerCase() || 'uploaded';
  const bomId = record?.bom_id;
  const uploadId = record?.id;

  // Status flow: uploaded → parsing → parsed → mapping_pending → ready_for_enrichment → processing → completed/failed
  switch (status) {
    case 'uploaded':
    case 'parsing':
      return {
        step: 1,
        total: 5,
        label: 'Parsing',
        description: 'File being parsed',
        canContinue: false,
        resumeHash: '',
      };
    case 'parsed':
    case 'mapping_pending':
      return {
        step: 2,
        total: 5,
        label: 'Column Mapping',
        description: 'Confirm column mappings',
        canContinue: true,
        resumeHash: `#/bom/upload?resume=${uploadId}&step=mapping`,
      };
    case 'ready_for_enrichment':
      return {
        step: 3,
        total: 5,
        label: 'Ready to Enrich',
        description: 'Start enrichment',
        canContinue: true,
        resumeHash: bomId ? `#/bom/upload?resume=${uploadId}&bomId=${bomId}&step=enrich` : `#/bom/upload?resume=${uploadId}&step=enrich`,
      };
    case 'processing':
      return {
        step: 4,
        total: 5,
        label: 'Enriching',
        description: 'Enrichment in progress',
        canContinue: true,
        resumeHash: bomId ? `#/bom/upload?resume=${uploadId}&bomId=${bomId}&step=enriching` : '',
      };
    case 'completed':
      return {
        step: 5,
        total: 5,
        label: 'Complete',
        description: 'View summary',
        canContinue: true,
        resumeHash: `#/bom_uploads/${uploadId}/show`,  // View button → Show page
        workflowHash: bomId ? `#/bom/upload?resume=${uploadId}&bomId=${bomId}&step=results` : '',  // Row click → Workflow page
      };
    case 'failed':
      return {
        step: 0,
        total: 5,
        label: 'Failed',
        description: 'Workflow failed',
        canContinue: true,
        resumeHash: `#/bom/upload?resume=${uploadId}&step=retry`,
      };
    default:
      return {
        step: 1,
        total: 5,
        label: 'Unknown',
        description: status,
        canContinue: false,
        resumeHash: '',
      };
  }
}

// ============================================================================
// Workflow Step Field (for List view)
// ============================================================================

const WorkflowStepField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const workflowStep = getWorkflowStep(record);

  // Step colors
  const stepColors: Record<string, { bg: string; fg: string }> = {
    'Parsing': { bg: '#e0e7ff', fg: '#3730a3' },
    'Column Mapping': { bg: '#fef3c7', fg: '#92400e' },
    'Ready to Enrich': { bg: '#dbeafe', fg: '#1e40af' },
    'Enriching': { bg: '#e0f2fe', fg: '#0369a1' },
    'Complete': { bg: '#22c55e', fg: '#000000' },
    'Failed': { bg: '#fee2e2', fg: '#991b1b' },
    'Unknown': { bg: '#f3f4f6', fg: '#6b7280' },
  };

  const colors = stepColors[workflowStep.label] || stepColors['Unknown'];

  const isComplete = workflowStep.label === 'Complete';

  return (
    <Tooltip title={workflowStep.description}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={`${workflowStep.step}/${workflowStep.total}`}
          size="small"
          sx={(theme) => ({
            bgcolor: colors.bg,
            color: isComplete && theme.palette.mode === 'dark' ? '#ffffff' : colors.fg,
            fontWeight: 600,
            fontSize: 10,
            minWidth: 40,
          })}
        />
        <Typography variant="caption" sx={(theme) => ({
          color: isComplete && theme.palette.mode === 'dark' ? '#ffffff' : colors.fg,
          fontWeight: 500
        })}>
          {workflowStep.label}
        </Typography>
      </Box>
    </Tooltip>
  );
};

// ============================================================================
// Continue Workflow Button (for List view)
// ============================================================================

const ContinueWorkflowButton: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const workflowStep = getWorkflowStep(record);

  if (!workflowStep.canContinue || !workflowStep.resumeHash) {
    return null;
  }

  const handleContinue = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.hash = workflowStep.resumeHash;
  };

  // Show "View" for completed, "Continue" for in-progress
  const isComplete = workflowStep.label === 'Complete';
  const buttonLabel = isComplete ? 'View' : 'Continue';
  const buttonColor = isComplete ? 'success' : 'primary';

  return (
    <Tooltip title={workflowStep.description}>
      <Button
        size="small"
        variant={isComplete ? 'outlined' : 'contained'}
        color={buttonColor}
        onClick={handleContinue}
        sx={{ fontSize: 11, py: 0.5, px: 1.5, minWidth: 'auto' }}
      >
        {buttonLabel}
      </Button>
    </Tooltip>
  );
};

// ============================================================================
// Enrichment & Risk Data Types
// ============================================================================

interface BOMEnrichmentData {
  enrichment_status: string | null;
  risk_score: number | null;
  risk_grade: string | null;
  risk_factors: Record<string, any> | null;
  enrichment_completed_at: string | null;
}

interface LineItemCounts {
  total: number;
  enriched: number;
  failed: number;
  pending: number;
  not_found: number;
}

interface ComponentStatusCounts {
  production_ready: number;
  at_risk: number;
  obsolete: number;
  unknown: number;
}

// ============================================================================
// Custom Hook: Fetch BOM Enrichment Data
// ============================================================================

function useBOMEnrichmentData(bomId: string | null) {
  const [data, setData] = React.useState<BOMEnrichmentData | null>(null);
  const [lineItemCounts, setLineItemCounts] = React.useState<LineItemCounts | null>(null);
  const [componentStatus, setComponentStatus] = React.useState<ComponentStatusCounts | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!bomId) {
      setData(null);
      setLineItemCounts(null);
      setComponentStatus(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch BOM enrichment data
        const { data: bomData, error: bomError } = await supabase
          .from('boms')
          .select('enrichment_status, risk_score, risk_grade, risk_factors, enrichment_completed_at')
          .eq('id', bomId)
          .single();

        if (bomError) {
          console.error('[BOMEnrichment] Error fetching BOM:', bomError);
        } else {
          setData(bomData);
        }

        // Fetch line item counts
        const { data: lineItems, error: lineError } = await supabase
          .from('bom_line_items')
          .select('enrichment_status, specifications, lifecycle_status')
          .eq('bom_id', bomId);

        if (lineError) {
          console.error('[BOMEnrichment] Error fetching line items:', lineError);
        } else if (lineItems) {
          // Calculate enrichment counts
          const counts: LineItemCounts = {
            total: lineItems.length,
            enriched: lineItems.filter(li => li.enrichment_status === 'enriched').length,
            failed: lineItems.filter(li => li.enrichment_status === 'failed').length,
            pending: lineItems.filter(li => !li.enrichment_status || li.enrichment_status === 'pending').length,
            not_found: lineItems.filter(li => li.enrichment_status === 'not_found').length,
          };
          setLineItemCounts(counts);

          // Calculate component status counts
          const statusCounts: ComponentStatusCounts = {
            production_ready: 0,
            at_risk: 0,
            obsolete: 0,
            unknown: 0,
          };

          for (const li of lineItems) {
            const lifecycle = li.lifecycle_status?.toLowerCase() || '';
            const enriched = li.enrichment_status === 'enriched';

            if (!enriched) {
              statusCounts.unknown++;
            } else if (lifecycle.includes('obsolete') || lifecycle.includes('eol') || lifecycle.includes('discontinued')) {
              statusCounts.obsolete++;
            } else if (lifecycle.includes('nrnd') || lifecycle.includes('not recommended')) {
              statusCounts.at_risk++;
            } else if (lifecycle.includes('active') || lifecycle.includes('production')) {
              statusCounts.production_ready++;
            } else {
              // Default enriched but unknown lifecycle to production ready
              statusCounts.production_ready++;
            }
          }
          setComponentStatus(statusCounts);
        }
      } catch (err) {
        console.error('[BOMEnrichment] Exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bomId]);

  return { data, lineItemCounts, componentStatus, loading };
}

// ============================================================================
// Enrichment Summary Field (for List view)
// ============================================================================

const EnrichmentSummaryField: React.FC = () => {
  const record = useRecordContext();
  const { lineItemCounts, loading } = useBOMEnrichmentData(record?.bom_id);

  if (!record?.bom_id) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }

  if (loading) {
    return <CircularProgress size={16} />;
  }

  if (!lineItemCounts) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }

  const { total, enriched, failed, pending } = lineItemCounts;
  const percentComplete = total > 0 ? Math.round(((enriched + failed) / total) * 100) : 0;

  // Show progress if still processing
  if (pending > 0) {
    return (
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" sx={{ display: 'block' }}>
          {enriched}/{total} ({percentComplete}%)
        </Typography>
        <LinearProgress
          variant="determinate"
          value={percentComplete}
          sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
        />
      </Box>
    );
  }

  // Show final counts
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title={`${enriched} enriched`}>
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          label={enriched}
          size="small"
          sx={(theme) => ({
            bgcolor: '#22c55e',
            color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
            fontSize: 11
          })}
        />
      </Tooltip>
      {failed > 0 && (
        <Tooltip title={`${failed} failed`}>
          <Chip
            icon={<ErrorIcon sx={{ fontSize: 14 }} />}
            label={failed}
            size="small"
            sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontSize: 11 }}
          />
        </Tooltip>
      )}
    </Stack>
  );
};

// ============================================================================
// Risk Score Field (for List view)
// ============================================================================

const RISK_GRADE_COLORS: Record<string, { bg: string; fg: string }> = {
  'A': { bg: '#22c55e', fg: '#000000' },
  'B': { bg: '#10b981', fg: '#000000' },
  'C': { bg: '#fef3c7', fg: '#92400e' },
  'D': { bg: '#fed7aa', fg: '#9a3412' },
  'F': { bg: '#fee2e2', fg: '#991b1b' },
  'N/A': { bg: '#f3f4f6', fg: '#6b7280' },
};

const RiskScoreField: React.FC = () => {
  const record = useRecordContext();
  const { data, loading } = useBOMEnrichmentData(record?.bom_id);

  if (!record?.bom_id) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }

  if (loading) {
    return <CircularProgress size={16} />;
  }

  if (!data || data.risk_score === null) {
    // Check if enrichment is still in progress
    if (data?.enrichment_status === 'enriching' || data?.enrichment_status === 'processing') {
      return (
        <Typography variant="caption" color="text.secondary">
          Analyzing...
        </Typography>
      );
    }
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }

  const grade = data.risk_grade || 'N/A';
  const colors = RISK_GRADE_COLORS[grade] || RISK_GRADE_COLORS['N/A'];
  const isGreenGrade = grade === 'A' || grade === 'B';

  return (
    <Tooltip title={`Risk Score: ${data.risk_score}`}>
      <Chip
        label={`${grade} (${data.risk_score})`}
        size="small"
        sx={(theme) => ({
          fontWeight: 600,
          bgcolor: colors.bg,
          color: isGreenGrade && theme.palette.mode === 'dark' ? '#ffffff' : colors.fg,
          fontSize: 11,
        })}
      />
    </Tooltip>
  );
};

// ============================================================================
// Component Status Field (for List view)
// ============================================================================

const ComponentStatusField: React.FC = () => {
  const record = useRecordContext();
  const { componentStatus, loading } = useBOMEnrichmentData(record?.bom_id);

  if (!record?.bom_id) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }

  if (loading) {
    return <CircularProgress size={16} />;
  }

  if (!componentStatus) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }

  const { production_ready, at_risk, obsolete } = componentStatus;

  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {production_ready > 0 && (
        <Tooltip title={`${production_ready} Production Ready`}>
          <Chip
            label={production_ready}
            size="small"
            sx={(theme) => ({ bgcolor: '#22c55e', color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000', fontSize: 11, minWidth: 24 })}
          />
        </Tooltip>
      )}
      {at_risk > 0 && (
        <Tooltip title={`${at_risk} At Risk (NRND)`}>
          <Chip
            label={at_risk}
            size="small"
            sx={{ bgcolor: '#fef3c7', color: '#92400e', fontSize: 11, minWidth: 24 }}
          />
        </Tooltip>
      )}
      {obsolete > 0 && (
        <Tooltip title={`${obsolete} Obsolete/EOL`}>
          <Chip
            label={obsolete}
            size="small"
            sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontSize: 11, minWidth: 24 }}
          />
        </Tooltip>
      )}
    </Stack>
  );
};

// ============================================================================
// Workflow Summary Card (for Show page)
// ============================================================================

interface WorkflowSummaryCardProps {
  bomId: string | null;
}

const WorkflowSummaryCard: React.FC<WorkflowSummaryCardProps> = ({ bomId }) => {
  const { data, lineItemCounts, componentStatus, loading } = useBOMEnrichmentData(bomId);

  if (!bomId) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Workflow Summary</Typography>
          <Alert severity="info">
            No BOM linked to this upload yet. Complete the upload workflow to see enrichment results.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {/* Enrichment Results Card */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              Enrichment Results
            </Typography>
            {lineItemCounts ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Total Items</Typography>
                  <Typography variant="body2" fontWeight={600}>{lineItemCounts.total}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Enriched</Typography>
                  <Chip
                    label={lineItemCounts.enriched}
                    size="small"
                    sx={(theme) => ({ bgcolor: '#22c55e', color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000' })}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Failed</Typography>
                  <Chip
                    label={lineItemCounts.failed}
                    size="small"
                    sx={{ bgcolor: lineItemCounts.failed > 0 ? '#fee2e2' : '#f3f4f6', color: lineItemCounts.failed > 0 ? '#991b1b' : '#6b7280' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Not Found</Typography>
                  <Chip
                    label={lineItemCounts.not_found}
                    size="small"
                    sx={{ bgcolor: lineItemCounts.not_found > 0 ? '#fef3c7' : '#f3f4f6', color: lineItemCounts.not_found > 0 ? '#92400e' : '#6b7280' }}
                  />
                </Box>
                {lineItemCounts.pending > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {lineItemCounts.pending} items still pending...
                    </Typography>
                    <LinearProgress sx={{ mt: 1 }} />
                  </Box>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No data available</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Risk Analysis Card */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              Risk Analysis
            </Typography>
            {data?.risk_score !== null && data?.risk_score !== undefined ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Risk Grade</Typography>
                  <Chip
                    label={`${data.risk_grade || 'N/A'} (${data.risk_score})`}
                    size="medium"
                    sx={{
                      fontWeight: 700,
                      fontSize: 14,
                      bgcolor: RISK_GRADE_COLORS[data.risk_grade || 'N/A']?.bg || '#f3f4f6',
                      color: RISK_GRADE_COLORS[data.risk_grade || 'N/A']?.fg || '#6b7280',
                    }}
                  />
                </Box>
                {data.risk_factors && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Risk Factors
                    </Typography>
                    {Object.entries(data.risk_factors).slice(0, 3).map(([key, value]) => (
                      <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          {key.replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="caption" fontWeight={600}>
                          {typeof value === 'number' ? value : String(value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              <Box>
                {data?.enrichment_status === 'enriching' || data?.enrichment_status === 'processing' ? (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <CircularProgress size={24} sx={{ mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing risks...
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Risk analysis not available yet
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Component Status Card */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableChartIcon color="primary" />
              Component Status
            </Typography>
            {componentStatus ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Production Ready</Typography>
                  <Chip
                    label={componentStatus.production_ready}
                    size="small"
                    sx={(theme) => ({ bgcolor: '#22c55e', color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000' })}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">At Risk (NRND)</Typography>
                  <Chip
                    label={componentStatus.at_risk}
                    size="small"
                    sx={{ bgcolor: componentStatus.at_risk > 0 ? '#fef3c7' : '#f3f4f6', color: componentStatus.at_risk > 0 ? '#92400e' : '#6b7280' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Obsolete/EOL</Typography>
                  <Chip
                    label={componentStatus.obsolete}
                    size="small"
                    sx={{ bgcolor: componentStatus.obsolete > 0 ? '#fee2e2' : '#f3f4f6', color: componentStatus.obsolete > 0 ? '#991b1b' : '#6b7280' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Unknown Status</Typography>
                  <Chip
                    label={componentStatus.unknown}
                    size="small"
                    sx={{ bgcolor: '#f3f4f6', color: '#6b7280' }}
                  />
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No data available</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

/**
 * BOM Uploads Resource
 *
 * Shows uploaded BOM files before enrichment processing.
 * Status flow: uploaded → parsing → parsed → mapping_pending → ready_for_enrichment → processing → completed/failed
 */

// Status configuration matching the database schema
const STATUS_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  uploaded: { bg: '#9ca3af', fg: '#ffffff', label: 'Uploaded' },
  parsing: { bg: '#60a5fa', fg: '#ffffff', label: 'Parsing' },
  parsed: { bg: '#3b82f6', fg: '#ffffff', label: 'Parsed' },
  mapping_pending: { bg: '#f59e0b', fg: '#ffffff', label: 'Mapping Pending' },
  ready_for_enrichment: { bg: '#8b5cf6', fg: '#ffffff', label: 'Ready' },
  processing: { bg: '#3b82f6', fg: '#ffffff', label: 'Processing' },
  completed: { bg: '#22c55e', fg: '#ffffff', label: 'Completed' },
  failed: { bg: '#ef4444', fg: '#ffffff', label: 'Failed' },
  archived: { bg: '#6b7280', fg: '#ffffff', label: 'Archived' },
  deleted: { bg: '#4b5563', fg: '#ffffff', label: 'Deleted' },
};

/**
 * Status Badge Component
 */
const StatusBadge: React.FC<{ source?: string }> = ({ source = 'status' }) => {
  const record = useRecordContext();
  if (!record) return null;

  const status = String(record[source] || 'uploaded').toLowerCase();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.uploaded;

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.fg,
      }}
    />
  );
};

/**
 * Download Raw BOM Button
 */
const DownloadRawBOMButton: React.FC = () => {
  const record = useRecordContext();
  const notify = useNotify();

  if (!record?.s3_key) return null;

  const handleDownload = async () => {
    try {
      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();

      // Fetch the file with auth headers
      const downloadUrl = `${cnsBaseUrl}/api/files/download?s3_key=${encodeURIComponent(record.s3_key)}&bucket=${encodeURIComponent(record.s3_bucket || 'bulk-uploads')}`;

      const response = await fetch(downloadUrl, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or use original filename
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = record.filename || 'download';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      // Create blob and download
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      notify('Download started', { type: 'info' });
    } catch (error: any) {
      console.error('[Download] Error:', error);
      notify(`Failed to download: ${error.message}`, { type: 'error' });
    }
  };

  return (
    <Tooltip title="Download original BOM file">
      <IconButton
        size="small"
        color="primary"
        onClick={(e) => {
          e.stopPropagation(); // Prevent row click
          handleDownload();
        }}
      >
        <DownloadIcon />
      </IconButton>
    </Tooltip>
  );
};

/**
 * View BOM Button (opens linked BOM if exists)
 */
const ViewBOMButton: React.FC = () => {
  const record = useRecordContext();

  if (!record?.bom_id) {
    return (
      <Tooltip title="No BOM linked yet">
        <span>
          <IconButton size="small" disabled>
            <OpenInNewIcon />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip title="View BOM Details">
      <IconButton
        size="small"
        color="primary"
        onClick={(e) => {
          e.stopPropagation(); // Prevent row click
          window.location.hash = `#/boms/${record.bom_id}/show`;
        }}
      >
        <OpenInNewIcon />
      </IconButton>
    </Tooltip>
  );
};

/**
 * Actions Column Component - Styled like BOMEnrichment page
 * Actions: Delete, View Details, View Line Items (table), View Events
 */
const ActionsColumn: React.FC = () => {
  const record = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pending, setPending] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'archive' | 'delete' | null>(null);
  const [actionReason, setActionReason] = React.useState('');

  if (!record) return null;

  const userId = localStorage.getItem('user_id') || undefined;
  const userEmail = localStorage.getItem('user_email') || undefined;
  const userName = localStorage.getItem('user_name') || undefined;
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  const handleAction = async () => {
    if (!confirmAction) return;

    // Validate actor_id - session must be active
    if (!userId) {
      notify('Session expired. Please log in again.', { type: 'error' });
      setConfirmAction(null);
      return;
    }

    // Require reason for permanent deletion (audit compliance)
    if (confirmAction === 'delete' && !actionReason.trim()) {
      notify('Reason is required for permanent deletion', { type: 'warning' });
      return;
    }

    try {
      setPending(true);
      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();
      const endpoint =
        confirmAction === 'archive'
          ? `${cnsBaseUrl}/api/customer/upload/${record.id}/archive`
          : `${cnsBaseUrl}/api/customer/upload/${record.id}`;

      const response = await fetch(endpoint, {
        method: confirmAction === 'archive' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          reason: actionReason || undefined,
          actor_id: userId,
          actor_email: userEmail,
          actor_name: userName,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.detail || payload.message || 'Request failed');
      }

      // Surface any warnings from backend (e.g., MinIO cleanup issues)
      if (payload.warnings && payload.warnings.length > 0) {
        payload.warnings.forEach((warning: string) => {
          notify(warning, { type: 'warning' });
        });
      }

      notify(payload.message || `Upload ${confirmAction === 'archive' ? 'archived' : 'deleted'}`, { type: 'success' });
      refresh();
    } catch (error: any) {
      console.error('[Upload Action] Error:', error);
      notify(error.message || 'Failed to process upload action', { type: 'error' });
    } finally {
      setPending(false);
      setConfirmAction(null);
      setActionReason('');
    }
  };

  const handleDownload = async () => {
    if (!record.s3_key && !record.id) {
      notify('No file available for download', { type: 'warning' });
      return;
    }
    try {
      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();

      // Use the new presigned URL endpoint
      const response = await fetch(
        `${cnsBaseUrl}/api/customer/download/${record.id}`,
        { headers: authHeaders }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to get download URL');
      }

      const data = await response.json();

      // Open the presigned URL
      const link = document.createElement('a');
      link.href = data.download_url;
      link.download = data.filename || record.filename || 'bom_file';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notify('Download started', { type: 'info' });
    } catch (error: any) {
      console.error('[Download] Error:', error);
      notify(`Failed to download: ${error.message}`, { type: 'error' });
    }
  };

  return (
    <>
      <Stack direction="row" spacing={0.5} justifyContent="center">
        {/* Archive Button */}
        <Tooltip title="Archive Upload">
          <IconButton
            size="small"
            color="default"
            onClick={(e) => {
              e.stopPropagation();
              setActionReason('');
              setConfirmAction('archive');
            }}
          >
            <ArchiveIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Delete Button (Admins only) */}
        {isAdmin && (
          <Tooltip title="Delete Upload">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                setActionReason('');
                setConfirmAction('delete');
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* View Details Button */}
        <Tooltip title="View Details">
          <IconButton
            size="small"
            color="info"
            onClick={(e) => {
              e.stopPropagation();
              window.location.hash = `#/bom_uploads/${record.id}/show`;
            }}
          >
            <VisibilityIcon />
          </IconButton>
        </Tooltip>

        {/* View Line Items / Components Button */}
        <Tooltip title="View Line Items">
          <span>
            <IconButton
              size="small"
              color="success"
              onClick={(e) => {
                e.stopPropagation();
                if (record.bom_id) {
                  window.location.hash = `#/boms/${record.bom_id}/show`;
                } else {
                  window.location.hash = `#/bom_uploads/${record.id}/show`;
                }
              }}
            >
              <TableChartIcon />
            </IconButton>
          </span>
        </Tooltip>

        {/* Download Raw File Button */}
        {record.s3_key && (
          <Tooltip title="Download Original File">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* View BOM (if linked) */}
        {record.bom_id && (
          <Tooltip title="View Linked BOM">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                window.location.hash = `#/boms/${record.bom_id}/show`;
              }}
            >
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!confirmAction}
        onClose={() => {
          if (!pending) {
            setConfirmAction(null);
            setActionReason('');
          }
        }}
        maxWidth="sm"
        fullWidth
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>
          {confirmAction === 'archive' ? 'Archive Upload' : 'Delete Upload'}
        </DialogTitle>
        <DialogContent>
          {confirmAction === 'archive' ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              The upload will be hidden from day-to-day lists but the data and file will be retained for reference.
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This permanently deletes the upload, linked BOM data, and stored files. This cannot be undone.
            </Alert>
          )}
          <Typography sx={{ mb: 2 }}>
            {confirmAction === 'archive'
              ? `Archive upload "${record.filename}"?`
              : `Delete upload "${record.filename}" and associated data?`}
          </Typography>
          <MuiTextField
            label={confirmAction === 'delete' ? 'Reason (required)' : 'Reason (optional)'}
            placeholder="e.g., Duplicate upload"
            fullWidth
            multiline
            minRows={2}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            disabled={pending}
            required={confirmAction === 'delete'}
            error={confirmAction === 'delete' && !actionReason.trim()}
            helperText={confirmAction === 'delete' && !actionReason.trim() ? 'Reason is required for permanent deletion' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!pending) {
                setConfirmAction(null);
                setActionReason('');
              }
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAction}
            color={confirmAction === 'archive' ? 'primary' : 'error'}
            variant="contained"
            disabled={pending}
            startIcon={pending ? <CircularProgress size={20} /> : confirmAction === 'archive' ? <ArchiveIcon /> : <DeleteIcon />}
          >
            {pending
              ? confirmAction === 'archive' ? 'Archiving...' : 'Deleting...'
              : confirmAction === 'archive' ? 'Archive' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * BOM Uploads List
 */
export const BOMUploadList: React.FC = () => {
  // Get current project ID from localStorage for filtering
  const currentProjectId = localStorage.getItem('current_project_id');

  // Custom row click handler: completed → workflow page, others → show page
  const handleRowClick = (id: any, resource: string, record: any) => {
    const workflowStep = getWorkflowStep(record);
    // For completed items with workflow hash, go to full workflow view
    if (workflowStep.workflowHash) {
      window.location.hash = workflowStep.workflowHash;
      return false; // Prevent default navigation
    }
    // Default: go to show page
    return 'show';
  };

  return (
    <List
      sort={{ field: 'created_at', order: 'DESC' }}
      perPage={25}
      filter={{ project_id: currentProjectId, archived: false }}
      filterDefaultValues={{ project_id: currentProjectId, archived: false }}
    >
      <DatagridConfigurable
        rowClick={handleRowClick}
        bulkActionButtons={false}
        sx={(theme) => ({
          '& .RaDatagrid-headerCell': {
            fontWeight: 600,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
            color: theme.palette.mode === 'dark' ? '#fff' : 'inherit',
            borderBottom: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : undefined,
          },
        })}
      >
        <TextField source="filename" label="File Name" />
        <FunctionField
          label="Workflow"
          render={() => <WorkflowStepField />}
        />
        <NumberField
          source="total_rows"
          label="Rows"
          options={{ maximumFractionDigits: 0 }}
        />
        <FunctionField
          label="Enrichment"
          render={() => <EnrichmentSummaryField />}
        />
        <FunctionField
          label="Risk"
          render={() => <RiskScoreField />}
        />
        <FunctionField
          label="Components"
          render={() => <ComponentStatusField />}
        />
        <DateField source="created_at" label="Uploaded" showTime />
        <FunctionField
          label=""
          render={() => <ContinueWorkflowButton />}
        />
        <FunctionField
          label="Actions"
          render={() => <ActionsColumn />}
        />
      </DatagridConfigurable>
    </List>
  );
};

/**
 * Re-Enrich Failed Items Button
 * Triggers enrichment workflow for failed/pending line items
 */
const ReEnrichFailedButton: React.FC = () => {
  const record = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [isLoading, setIsLoading] = React.useState(false);
  const [bomId, setBomId] = React.useState<string | null>(null);

  // Fetch BOM ID when component mounts or record changes
  React.useEffect(() => {
    const fetchBomId = async () => {
      if (!record?.id) return;

      try {
        // Find the BOM record that was created from this upload
        const { data, error } = await supabase
          .from('boms')
          .select('id')
          .eq('metadata->>upload_id', record.id)
          .maybeSingle();

        if (error) {
          console.error('[Re-Enrich] Error fetching BOM ID:', error);
        } else if (data) {
          setBomId(data.id);
        }
      } catch (error) {
        console.error('[Re-Enrich] Error:', error);
      }
    };

    fetchBomId();
  }, [record?.id, supabase]);

  if (!record) return null;

  // Don't show button if no BOM ID found yet
  if (!bomId) return null;

  const handleReEnrich = async () => {
    setIsLoading(true);
    try {
      console.log(`[Re-Enrich] Starting enrichment for BOM: ${bomId}`);

      // Call CNS API to re-enrich failed items
      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${cnsBaseUrl}/api/boms/${bomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          organization_id: localStorage.getItem('organization_id'),
          project_id: localStorage.getItem('current_project_id'),
          priority: 7, // High priority
          failed_only: true, // Only re-enrich failed items
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to start enrichment');
      }

      notify('Re-enrichment started for failed components!', { type: 'success' });
      refresh();
    } catch (error: any) {
      console.error('[Re-Enrich] Error:', error);
      notify(`Failed to start re-enrichment: ${error.message}`, { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={<RefreshIcon />}
      onClick={handleReEnrich}
      disabled={isLoading}
      sx={{ ml: 1 }}
    >
      {isLoading ? 'Starting...' : 'Re-Enrich Failed Items'}
    </Button>
  );
};

/**
 * Line Items Tab Wrapper
 * Extracts record from context and passes to LineItemsTabContent
 */
const LineItemsTabWrapper: React.FC = () => {
  const record = useRecordContext();

  console.log('[Line Items Wrapper] 🔍 Record context:', {
    hasRecord: !!record,
    recordId: record?.id,
    bomId: record?.bom_id,
    recordKeys: record ? Object.keys(record) : []
  });

  return (
    <LineItemsTabContent
      uploadId={record?.id ? String(record.id) : undefined}
      bomIdProp={record?.bom_id ? String(record.bom_id) : undefined}
    />
  );
};

/**
 * Line Items Tab Content
 * Fetches the BOM ID associated with this upload and displays line items
 */
interface LineItemsTabContentProps {
  uploadId?: string;
  bomIdProp?: string;
}

const LineItemsTabContent: React.FC<LineItemsTabContentProps> = ({ uploadId, bomIdProp }) => {
  console.log('[Line Items] 🔍 Component mounted with props:', {
    uploadId,
    bomIdProp,
  });

  // All hooks must be at the top before any conditional returns
  const [bomId, setBomId] = React.useState<string | null>(bomIdProp || null);
  const [loading, setLoading] = React.useState(!bomIdProp);
  const [sort, setSort] = React.useState<{ field: string; order: 'ASC' | 'DESC' }>({ field: 'line_number', order: 'ASC' });

  console.log('[Line Items] 📊 Initial state:', { bomId, loading });

  // Fetch line items using useGetList hook
  const { data: lineItems, isLoading: lineItemsLoading, error: lineItemsError } = useGetList(
    'bom_line_items',
    {
      filter: { bom_id: bomId || '' },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: 'line_number', order: 'ASC' },
    },
    {
      enabled: !!bomId, // Only fetch if we have a bomId
    }
  );

  console.log('[Line Items] 📊 Query result:', {
    bomId,
    lineItemsCount: lineItems?.length || 0,
    lineItemsLoading,
    hasError: !!lineItemsError,
  });

  React.useEffect(() => {
    console.log('[Line Items] ⚡ useEffect triggered with:', { uploadId, bomIdProp, currentBomId: bomId });

    // If bom_id was passed directly, use it and skip the lookup
    if (bomIdProp) {
      console.log('[Line Items] ✅ Using bomIdProp directly:', bomIdProp);
      setBomId(bomIdProp);
      setLoading(false);
      return;
    }

    console.log('[Line Items] 🔄 No bomIdProp, attempting to fetch from metadata...');

    const fetchBomId = async () => {
      if (!uploadId) {
        console.log('[Line Items] ⚠️ No uploadId provided, cannot fetch BOM ID');
        setLoading(false);
        return;
      }

      console.log('[Line Items] 🔍 Querying boms table with uploadId:', uploadId);

      try {
        // Find the BOM record that was created from this upload
        // The BOM's metadata contains upload_id
        const { data, error } = await supabase
          .from('boms')
          .select('id')
          .eq('metadata->>upload_id', uploadId)
          .maybeSingle();

        console.log('[Line Items] 📥 Supabase query result:', { data, error });

        if (error) {
          console.error('[Line Items] ❌ Error fetching BOM ID:', error);
        } else if (data) {
          console.log('[Line Items] ✅ Found BOM ID:', data.id);
          setBomId(data.id);
        } else {
          console.log('[Line Items] ⚠️ No BOM record found for uploadId:', uploadId);
        }
      } catch (error) {
        console.error('[Line Items] ❌ Exception during fetch:', error);
      } finally {
        console.log('[Line Items] 🏁 Fetch complete, setting loading=false');
        setLoading(false);
      }
    };

    fetchBomId();
  }, [uploadId, bomIdProp]);

  if (loading || lineItemsLoading) {
    console.log('[Line Items] ⏳ Rendering loading state');
    return <Loading />;
  }

  if (lineItemsError) {
    console.error('[Line Items] ❌ Error loading line items:', lineItemsError);
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="error">
          Error loading line items: {lineItemsError.message || 'Unknown error'}
        </Typography>
      </Box>
    );
  }

  if (!bomId) {
    console.log('[Line Items] ❌ Rendering "no BOM found" message (bomId is:', bomId, ')');
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No BOM record found for this upload. The upload may not be completed yet.
        </Typography>
      </Box>
    );
  }

  console.log('[Line Items] ✅ Rendering line items datagrid with', lineItems?.length || 0, 'items');

  return (
    <>
      <Box sx={(theme) => ({ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderRadius: 2, mb: 2 })}>
        <Typography variant="body2" color="text.secondary">
          💡 <strong>Tip:</strong> Click any line item to edit component details (MPN, Manufacturer, etc.).
          After editing, use the "Re-Enrich Failed Items" button above to re-process updated components.
        </Typography>
      </Box>

      <ResourceContextProvider value="bom_line_items">
        <ListContextProvider
          value={{
            data: lineItems || [],
            total: lineItems?.length || 0,
            isLoading: lineItemsLoading,
            isFetching: lineItemsLoading,
            resource: 'bom_line_items',
            filterValues: { bom_id: bomId },
            sort: sort,
            setSort: setSort,
            page: 1,
            perPage: 1000,
            setPage: () => {},
            setPerPage: () => {},
            setFilters: () => {},
            displayedFilters: {},
            showFilter: () => {},
            hideFilter: () => {},
            selectedIds: [],
            onSelect: () => {},
            onToggleItem: () => {},
            onUnselectItems: () => {},
            refetch: () => {},
            hasNextPage: false,
            hasPreviousPage: false,
          }}
        >
          <Datagrid
            rowClick="edit"
            bulkActionButtons={false}
            sx={(theme) => ({
              '& .RaDatagrid-headerCell': {
                fontWeight: 600,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                color: theme.palette.mode === 'dark' ? '#fff' : 'inherit',
                borderBottom: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : undefined,
              },
            })}
          >
            <NumberField source="line_number" label="#" />
            <TextField source="manufacturer_part_number" label="Part Number (MPN)" />
            <TextField source="manufacturer" label="Manufacturer" />
            <NumberField source="quantity" label="Qty" />
            <TextField source="reference_designator" label="Reference" />
            <TextField source="description" label="Description" />
            <TextField source="enrichment_status" label="Status" />
            <EditButton label="Edit" />
          </Datagrid>
        </ListContextProvider>
      </ResourceContextProvider>
    </>
  );
};

/**
 * BOM Upload Show Page Actions
 */
const BOMUploadShowActions: React.FC = () => (
  <TopToolbar>
    <EditButton label="Edit Mappings" icon={<EditIcon />} />
    <ReEnrichFailedButton />
  </TopToolbar>
);

/**
 * Wrapper to display WorkflowSummaryCard with record context
 */
const WorkflowSummaryWrapper: React.FC = () => {
  const record = useRecordContext();
  return <WorkflowSummaryCard bomId={record?.bom_id || null} />;
};

/**
 * BOM Upload Show Page with Line Items Tab
 */
export const BOMUploadShow: React.FC = () => {
  const record = useRecordContext();

  return (
    <Show actions={<BOMUploadShowActions />}>
      <TabbedShowLayout>
        {/* Overview Tab */}
        <Tab label="Overview">
          {/* Workflow Summary Cards - Enrichment, Risk, Component Status */}
          <WorkflowSummaryWrapper />

          <Card>
            <CardContent>
              <Grid container spacing={3}>
                {/* File Information */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    File Information
                  </Typography>
                  <TextField source="filename" label="File Name" />
                  <NumberField source="file_size" label="File Size (bytes)" />
                  <TextField source="file_type" label="File Type" />
                  <TextField source="raw_file_url" label="Storage URL" emptyText="Not stored" />
                </Grid>

                {/* Status & Progress */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    Status
                  </Typography>
                  <StatusBadge source="status" />
                  <NumberField
                    source="total_rows"
                    label="Total Rows"
                    options={{ maximumFractionDigits: 0 }}
                  />
                  <Box sx={{ mt: 1 }}>
                    {record?.mapping_confirmed ? (
                      <Chip
                        label="Mapping Confirmed"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        label="Mapping Pending"
                        color="warning"
                        size="small"
                      />
                    )}
                  </Box>
                </Grid>

                {/* Column Mappings */}
                <Grid item xs={12}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    Column Mappings
                  </Typography>
                  {record?.detected_columns && (
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Auto-detected:
                      </Typography>
                      <pre style={{
                        background: '#f3f4f6',
                        padding: '12px',
                        borderRadius: '8px',
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(record.detected_columns, null, 2)}
                      </pre>
                    </Box>
                  )}
                  {record?.column_mappings && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="textSecondary">
                        Confirmed mappings:
                      </Typography>
                      <pre style={{
                        background: '#f3f4f6',
                        padding: '12px',
                        borderRadius: '8px',
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(record.column_mappings, null, 2)}
                      </pre>
                    </Box>
                  )}
                  {record?.unmapped_columns && record.unmapped_columns.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="error">
                        Unmapped columns:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        {record.unmapped_columns.map((col: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={col}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Grid>

                {/* Event Tracking */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    Event Processing
                  </Typography>
                  <Box>
                    {record?.rabbitmq_event_published ? (
                      <Chip
                        label="Event Published"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        label="Event Pending"
                        color="default"
                        size="small"
                      />
                    )}
                  </Box>
                  <DateField source="rabbitmq_event_published_at" label="Published At" showTime emptyText="Not published" />
                  <TextField source="temporal_workflow_id" label="Workflow ID" emptyText="No workflow" />
                  <TextField source="temporal_workflow_status" label="Workflow Status" emptyText="Pending" />
                </Grid>

                {/* Error Information */}
                {record?.error_message && (
                  <Grid item xs={12}>
                    <Typography variant="h6" color="error" gutterBottom>
                      Error Details
                    </Typography>
                    <Box sx={{
                      background: '#fee2e2',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      padding: '12px'
                    }}>
                      <Typography variant="body2" color="error">
                        {record.error_message}
                      </Typography>
                      {record.error_details && (
                        <pre style={{
                          marginTop: '8px',
                          fontSize: '12px',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(record.error_details, null, 2)}
                        </pre>
                      )}
                    </Box>
                  </Grid>
                )}

                {/* Timestamps */}
                <Grid item xs={12}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    Timeline
                  </Typography>
                  <DateField source="created_at" label="Uploaded At" showTime />
                  <DateField source="mapping_confirmed_at" label="Mapping Confirmed" showTime emptyText="Not confirmed" />
                  <DateField source="updated_at" label="Last Updated" showTime />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Tab>

        {/* Line Items Tab - Edit and Re-Enrich */}
        <Tab label="Line Items">
          <LineItemsTabWrapper />
        </Tab>
      </TabbedShowLayout>
    </Show>
  );
};

/**
 * BOM Upload Edit Page
 * Used for confirming/modifying column mappings
 */
export const BOMUploadEdit: React.FC = () => (
  <Edit>
    <SimpleForm>
      <Typography variant="h6" gutterBottom>
        Column Mapping Review
      </Typography>

      <TextInput source="filename" label="File Name" disabled fullWidth />

      <SelectInput
        source="status"
        label="Status"
        choices={[
          { id: 'uploaded', name: 'Uploaded' },
          { id: 'parsing', name: 'Parsing' },
          { id: 'parsed', name: 'Parsed' },
          { id: 'mapping_pending', name: 'Mapping Pending' },
          { id: 'ready_for_enrichment', name: 'Ready for Enrichment' },
          { id: 'processing', name: 'Processing' },
          { id: 'completed', name: 'Completed' },
          { id: 'failed', name: 'Failed' },
        ]}
        fullWidth
        validate={[required()]}
      />

      <TextInput
        source="column_mappings"
        label="Column Mappings (JSON)"
        multiline
        rows={10}
        fullWidth
        helperText="Edit the column mappings as JSON. Example: {&quot;Part Number&quot;: &quot;mpn&quot;, &quot;Quantity&quot;: &quot;quantity&quot;}"
      />

      <Box sx={{ mt: 2, p: 2, bgcolor: '#f3f4f6', borderRadius: 2 }}>
        <Typography variant="caption" color="textSecondary">
          After confirming mappings, set status to &quot;ready_for_enrichment&quot; to trigger the enrichment workflow.
        </Typography>
      </Box>
    </SimpleForm>
  </Edit>
);
