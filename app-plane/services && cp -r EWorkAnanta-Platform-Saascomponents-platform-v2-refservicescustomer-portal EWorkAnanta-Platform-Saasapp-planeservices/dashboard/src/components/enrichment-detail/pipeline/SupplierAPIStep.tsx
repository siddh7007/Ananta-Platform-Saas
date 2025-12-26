import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { PipelineStep, PipelineStepContent } from './PipelineStep';
import { SupplierAPIStep as SupplierAPIStepType } from '../types';

interface SupplierAPIStepComponentProps {
  data: SupplierAPIStepType;
}

/**
 * SupplierAPIStep - Modular Component
 *
 * Displays supplier API enrichment results:
 * - Mouser, DigiKey, Element14 responses
 * - Confidence scores
 * - Response times
 * - Selected source
 */
export const SupplierAPIStepComponent: React.FC<SupplierAPIStepComponentProps> = ({ data }) => {
  const suppliers = ['mouser', 'digikey', 'element14'] as const;
  const foundCount = suppliers.filter(s => data[s]?.found).length;

  // Determine step status
  const status = foundCount > 0 ? 'success' : 'error';
  const summary = `${foundCount}/3 suppliers found | Best: ${data.selected || 'None'} (${data.best_confidence}% confidence)`;

  const sections = [
    {
      title: '📊 Parallel API Queries',
      content: (
        <Grid container spacing={2}>
          {suppliers.map((supplier) => {
            const response = data[supplier];
            if (!response) return null;

            return (
              <Grid item xs={12} md={4} key={supplier}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderColor: response.found ? 'success.main' : 'error.main',
                    borderWidth: 2,
                    bgcolor: response.found ? 'success.lighter' : 'error.lighter',
                  }}
                >
                  <Box display="flex" alignItems="center" mb={1}>
                    {response.found ? (
                      <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
                    ) : (
                      <ErrorIcon sx={{ color: 'error.main', mr: 1 }} />
                    )}
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {supplier}
                    </Typography>
                  </Box>

                  {response.found ? (
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="Confidence"
                          secondary={
                            <Chip
                              label={`${response.confidence}%`}
                              size="small"
                              color={response.confidence >= 95 ? 'success' : 'warning'}
                            />
                          }
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Response Time"
                          secondary={`${response.response_time_ms}ms`}
                        />
                      </ListItem>
                      {response.data && (
                        <>
                          <ListItem>
                            <ListItemText
                              primary="Category"
                              secondary={response.data.category || 'N/A'}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Datasheet"
                              secondary={response.data.datasheet_url ? '✓ Available' : '❌ Missing'}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Pricing"
                              secondary={response.data.pricing ? `$${response.data.pricing}` : 'N/A'}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Stock"
                              secondary={response.data.stock || 'N/A'}
                            />
                          </ListItem>
                        </>
                      )}
                    </List>
                  ) : (
                    <Typography variant="body2" color="error">
                      {response.error || 'Not found'}
                    </Typography>
                  )}

                  {data.selected === supplier && (
                    <Chip
                      label="SELECTED"
                      color="primary"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      ),
    },
    {
      title: '🎯 Selection Criteria',
      content: (
        <Box>
          <Typography variant="body2" color="textSecondary" paragraph>
            Best match selected based on highest confidence score.
          </Typography>
          {data.selected && (
            <Chip
              label={`${data.selected} selected with ${data.best_confidence}% confidence`}
              color="primary"
            />
          )}
        </Box>
      ),
    },
  ];

  return (
    <PipelineStep
      stepNumber={3}
      title="Supplier API Enrichment"
      status={status}
      summary={summary}
      defaultExpanded={foundCount > 0}
      metadata={{
        time_ms: Math.max(
          data.mouser?.response_time_ms || 0,
          data.digikey?.response_time_ms || 0,
          data.element14?.response_time_ms || 0
        ),
      }}
    >
      <PipelineStepContent sections={sections} />
    </PipelineStep>
  );
};
