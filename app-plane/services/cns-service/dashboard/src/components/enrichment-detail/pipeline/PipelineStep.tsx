import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import SkipNextIcon from '@mui/icons-material/SkipNext';

/**
 * PipelineStep - Base Modular Component
 *
 * Reusable accordion component for pipeline steps.
 * All step components extend this for consistent UI.
 *
 * Props:
 * - stepNumber: Step number in pipeline
 * - title: Step title
 * - status: 'success' | 'error' | 'skipped' | 'info'
 * - summary: Brief summary text
 * - defaultExpanded: Initially expanded
 * - children: Step-specific content
 */

export interface PipelineStepProps {
  stepNumber: number;
  title: string;
  status: 'success' | 'error' | 'skipped' | 'info';
  summary: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  metadata?: {
    time_ms?: number;
    cost_usd?: number;
  };
}

export const PipelineStep: React.FC<PipelineStepProps> = ({
  stepNumber,
  title,
  status,
  summary,
  defaultExpanded = false,
  children,
  metadata,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />;
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main', mr: 1 }} />;
      case 'skipped':
        return <SkipNextIcon sx={{ color: 'grey.500', mr: 1 }} />;
      default:
        return <InfoIcon sx={{ color: 'info.main', mr: 1 }} />;
    }
  };

  // Get status color
  const getStatusColor = (): 'success' | 'error' | 'default' | 'info' => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'skipped':
        return 'default';
      default:
        return 'info';
    }
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      sx={{
        mb: 1,
        '&:before': { display: 'none' },
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          bgcolor: expanded ? 'action.hover' : 'background.paper',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Box display="flex" alignItems="center" width="100%">
          {getStatusIcon()}

          <Box flex={1}>
            <Typography variant="body1" fontWeight={600}>
              Step {stepNumber}: {title}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {summary}
            </Typography>
          </Box>

          <Box display="flex" gap={1} alignItems="center">
            {metadata?.time_ms && (
              <Chip
                label={`${metadata.time_ms}ms`}
                size="small"
                variant="outlined"
              />
            )}
            {metadata?.cost_usd !== undefined && metadata.cost_usd > 0 && (
              <Chip
                label={`$${metadata.cost_usd.toFixed(4)}`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            <Chip label={status} size="small" color={getStatusColor()} />
          </Box>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ p: 3, bgcolor: 'grey.50' }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * PipelineStepContent - Helper component for consistent step content layout
 */
export interface PipelineStepContentProps {
  sections: {
    title: string;
    content: React.ReactNode;
  }[];
}

export const PipelineStepContent: React.FC<PipelineStepContentProps> = ({ sections }) => {
  return (
    <Box>
      {sections.map((section, index) => (
        <Box key={index} mb={index < sections.length - 1 ? 3 : 0}>
          <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={600}>
            {section.title}
          </Typography>
          {section.content}
        </Box>
      ))}
    </Box>
  );
};
