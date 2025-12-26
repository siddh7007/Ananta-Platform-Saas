/**
 * BomRiskOverview Component
 *
 * Displays BOM-level risk analysis with health grade filters and risk table.
 * Supports filtering by project and health grade.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Tooltip,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ListAltIcon from '@mui/icons-material/ListAlt';
import {
  riskColors as RISK_COLORS,
  gradeColors as GRADE_COLORS,
} from '../../theme';
import type { BOMRiskSummary } from '../../services/riskService';

interface BomRiskOverviewProps {
  bomRiskSummaries: BOMRiskSummary[];
  selectedHealthGrade: string;
  selectedProjectId: string;
  onHealthGradeChange: (grade: string) => void;
}

export function BomRiskOverview({
  bomRiskSummaries,
  selectedHealthGrade,
  selectedProjectId,
  onHealthGradeChange,
}: BomRiskOverviewProps) {
  // Calculate BOM grade distribution
  const gradeDistribution = bomRiskSummaries.reduce((acc, bom) => {
    acc[bom.health_grade] = (acc[bom.health_grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      {/* BOM Health Grade Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {['A', 'B', 'C', 'D', 'F'].map((grade) => (
          <Grid item xs={6} sm={4} md={2.4} key={grade}>
            <Card
              sx={{
                cursor: 'pointer',
                bgcolor: selectedHealthGrade === grade ? `${GRADE_COLORS[grade as keyof typeof GRADE_COLORS]}15` : 'background.paper',
                border: selectedHealthGrade === grade ? `2px solid ${GRADE_COLORS[grade as keyof typeof GRADE_COLORS]}` : '1px solid',
                borderColor: selectedHealthGrade === grade ? GRADE_COLORS[grade as keyof typeof GRADE_COLORS] : 'divider',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: `${GRADE_COLORS[grade as keyof typeof GRADE_COLORS]}15`,
                },
              }}
              onClick={() => onHealthGradeChange(selectedHealthGrade === grade ? 'all' : grade)}
            >
              <CardContent sx={{ py: 1.5, px: 2, textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{ color: GRADE_COLORS[grade as keyof typeof GRADE_COLORS] }}
                >
                  {gradeDistribution[grade] || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Grade {grade}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* BOM Risk Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            BOM Health Overview
          </Typography>

          {bomRiskSummaries.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>BOM Name</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell align="center">Grade</TableCell>
                    <TableCell align="center">Avg Risk</TableCell>
                    <TableCell align="center">Line Items</TableCell>
                    <TableCell>Risk Distribution</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bomRiskSummaries.map((bom) => (
                    <TableRow key={bom.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {bom.bom_name || `BOM ${bom.bom_id.slice(0, 8)}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {bom.project_name || 'No Project'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={bom.health_grade}
                          size="small"
                          sx={{
                            bgcolor: GRADE_COLORS[bom.health_grade as keyof typeof GRADE_COLORS],
                            color: 'white',
                            fontWeight: 700,
                            minWidth: 32,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            color:
                              (bom.avg_risk_score ?? 0) < 30
                                ? RISK_COLORS.low
                                : (bom.avg_risk_score ?? 0) < 60
                                ? RISK_COLORS.medium
                                : (bom.avg_risk_score ?? 0) < 85
                                ? RISK_COLORS.high
                                : RISK_COLORS.critical,
                          }}
                        >
                          {(bom.avg_risk_score ?? 0).toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {bom.total_line_items}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {Object.entries(bom.risk_distribution || {}).map(([level, count]) => (
                            count > 0 && (
                              <Tooltip key={level} title={`${count} ${level} risk components`}>
                                <Chip
                                  label={count}
                                  size="small"
                                  sx={{
                                    bgcolor: RISK_COLORS[level as keyof typeof RISK_COLORS],
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    height: 20,
                                    minWidth: 28,
                                  }}
                                />
                              </Tooltip>
                            )
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Button
                          component={RouterLink}
                          to={`/boms/${bom.bom_id}/show`}
                          size="small"
                          variant="outlined"
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ListAltIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                {selectedProjectId !== 'all' || selectedHealthGrade !== 'all'
                  ? 'No BOMs match the current filters'
                  : 'No BOM risk data available'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedProjectId !== 'all' || selectedHealthGrade !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Risk summaries will appear here once BOMs are processed'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default BomRiskOverview;
