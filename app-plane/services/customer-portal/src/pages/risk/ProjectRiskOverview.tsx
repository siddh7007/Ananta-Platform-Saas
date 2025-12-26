/**
 * ProjectRiskOverview Component
 *
 * Displays project-level risk cards with health grades and risk distribution.
 * Clickable cards to drill down into BOMs view.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import {
  riskColors as RISK_COLORS,
  gradeColors as GRADE_COLORS,
} from '../../theme';
import type { ProjectRiskSummary } from '../../services/riskService';

interface ProjectRiskOverviewProps {
  projectRiskSummaries: ProjectRiskSummary[];
  onProjectSelect: (projectId: string) => void;
}

export function ProjectRiskOverview({
  projectRiskSummaries,
  onProjectSelect
}: ProjectRiskOverviewProps) {
  if (projectRiskSummaries.length === 0) {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <FolderIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  No project risk data available
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Risk summaries will appear here once BOMs are processed
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={3}>
      {projectRiskSummaries.map((project) => (
        <Grid item xs={12} md={6} lg={4} key={project.id}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              },
            }}
            onClick={() => onProjectSelect(project.project_id)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    {project.project_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {project.total_boms} BOMs | {project.total_line_items} Components
                  </Typography>
                </Box>
                <Chip
                  label={`Grade ${project.worst_health_grade}`}
                  size="small"
                  sx={{
                    bgcolor: GRADE_COLORS[project.worst_health_grade as keyof typeof GRADE_COLORS],
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Average Health Score
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={100 - (project.avg_bom_health_score ?? 0)}
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 1,
                      bgcolor: 'action.disabledBackground',
                      '& .MuiLinearProgress-bar': {
                        bgcolor:
                          (project.avg_bom_health_score ?? 0) < 30
                            ? RISK_COLORS.low
                            : (project.avg_bom_health_score ?? 0) < 60
                            ? RISK_COLORS.medium
                            : RISK_COLORS.high,
                      },
                    }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {(project.avg_bom_health_score ?? 0).toFixed(1)}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {Object.entries(project.risk_distribution || {}).map(([level, count]) => (
                  count > 0 && (
                    <Chip
                      key={level}
                      label={`${count} ${level}`}
                      size="small"
                      sx={{
                        bgcolor: RISK_COLORS[level as keyof typeof RISK_COLORS],
                        color: 'white',
                        fontSize: '0.7rem',
                      }}
                    />
                  )
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default ProjectRiskOverview;
