/**
 * WorkflowStatsCards Component
 *
 * Display summary statistics for BOM workflows at the top of the BOM Jobs tab.
 * Shows counts for Total, Enriching, Completed, and Failed workflows.
 */

import { Box, Card, CardActionArea, CardContent, Grid, Skeleton, Typography } from '@mui/material';
import ListIcon from '@mui/icons-material/List';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { keyframes } from '@mui/system';

export interface WorkflowStats {
  total: number;
  enriching: number;
  completed: number;
  failed: number;
}

export interface WorkflowStatsCardsProps {
  stats: WorkflowStats | null;
  selectedStatus: string | null;
  onStatusClick: (status: string | null) => void;
  loading?: boolean;
}

// Spinning animation for enriching icon
const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

interface StatCardConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  getValue: (stats: WorkflowStats) => number;
}

const STAT_CARDS: StatCardConfig[] = [
  {
    key: 'total',
    label: 'Total BOMs',
    description: 'All uploads',
    icon: <ListIcon />,
    bgColor: '#f3f4f6',
    textColor: '#6b7280',
    getValue: (stats) => stats.total,
  },
  {
    key: 'enriching',
    label: 'Enriching',
    description: 'In progress',
    icon: (
      <AutorenewIcon
        sx={{
          animation: `${spin} 2s linear infinite`,
        }}
      />
    ),
    bgColor: '#dbeafe',
    textColor: '#1d4ed8',
    getValue: (stats) => stats.enriching,
  },
  {
    key: 'completed',
    label: 'Completed',
    description: 'Success',
    icon: <CheckCircleIcon />,
    bgColor: '#dcfce7',
    textColor: '#166534',
    getValue: (stats) => stats.completed,
  },
  {
    key: 'failed',
    label: 'Failed',
    description: 'Errors',
    icon: <ErrorIcon />,
    bgColor: '#fee2e2',
    textColor: '#dc2626',
    getValue: (stats) => stats.failed,
  },
];

function StatCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Skeleton variant="text" width={80} height={24} />
          <Skeleton variant="circular" width={24} height={24} />
        </Box>
        <Skeleton variant="text" width={60} height={40} />
        <Skeleton variant="text" width={100} height={16} />
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  config: StatCardConfig;
  value: number;
  isSelected: boolean;
  onClick: () => void;
}

function StatCard({ config, value, isSelected, onClick }: StatCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        bgcolor: config.bgColor,
        border: isSelected ? '2px solid' : '1px solid transparent',
        borderColor: isSelected ? config.textColor : 'transparent',
        boxShadow: isSelected ? 4 : 1,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography
              variant="subtitle2"
              sx={{
                color: config.textColor,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {config.label}
            </Typography>
            <Box sx={{ color: config.textColor }}>{config.icon}</Box>
          </Box>

          <Typography
            variant="h3"
            sx={{
              color: config.textColor,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {value.toLocaleString()}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: config.textColor,
              opacity: 0.8,
            }}
          >
            {config.description}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function WorkflowStatsCards({
  stats,
  selectedStatus,
  onStatusClick,
  loading = false,
}: WorkflowStatsCardsProps) {
  const handleCardClick = (status: string) => {
    // Toggle off if already selected, otherwise select
    if (selectedStatus === status) {
      onStatusClick(null);
    } else {
      onStatusClick(status);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {STAT_CARDS.map((config) => (
          <Grid item xs={6} sm={6} md={3} key={config.key}>
            {loading || !stats ? (
              <StatCardSkeleton />
            ) : (
              <StatCard
                config={config}
                value={config.getValue(stats)}
                isSelected={selectedStatus === config.key}
                onClick={() => handleCardClick(config.key)}
              />
            )}
          </Grid>
        ))}
      </Grid>

      {selectedStatus && (
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
            onClick={() => onStatusClick(null)}
          >
            Clear filter: showing {selectedStatus} BOMs
          </Typography>
        </Box>
      )}
    </Box>
  );
}
