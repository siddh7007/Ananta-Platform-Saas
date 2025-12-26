/**
 * CollapsibleJsonViewer Component
 *
 * Accordion-based JSON display with field count badge.
 * Used for displaying raw supplier data, metadata, and other JSON objects.
 */
import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
  Paper,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DataObjectIcon from '@mui/icons-material/DataObject';

export interface CollapsibleJsonViewerProps {
  /** Title for the accordion */
  title: string;
  /** JSON data to display */
  data: Record<string, any> | null | undefined;
  /** Whether to start expanded (default: false) */
  defaultExpanded?: boolean;
  /** Maximum height before scrolling (default: 300) */
  maxHeight?: number;
  /** Optional icon override */
  icon?: React.ReactNode;
  /** Print mode - force expand */
  printMode?: boolean;
  /** Optional brand color for supplier accordions */
  brandColor?: string;
}

export const CollapsibleJsonViewer: React.FC<CollapsibleJsonViewerProps> = ({
  title,
  data,
  defaultExpanded = false,
  maxHeight = 300,
  icon,
  printMode = false,
  brandColor,
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  // Count fields in the data
  const fieldCount = data ? Object.keys(data).length : 0;

  // In print mode, always expand
  const isExpanded = printMode ? true : expanded;

  if (!data || fieldCount === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">
          No {title.toLowerCase()} available
        </Typography>
      </Paper>
    );
  }

  return (
    <Accordion
      expanded={isExpanded}
      onChange={(_, exp) => !printMode && setExpanded(exp)}
      sx={{
        '&:before': { display: 'none' },
        boxShadow: 'none',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px !important',
        overflow: 'hidden',
        '@media print': {
          border: '1px solid #ccc',
        },
      }}
    >
      <AccordionSummary
        expandIcon={!printMode && <ExpandMoreIcon />}
        sx={{
          bgcolor: brandColor ? `${brandColor}10` : 'grey.50',
          borderBottom: isExpanded ? '1px solid' : 'none',
          borderColor: 'divider',
          minHeight: '48px !important',
          '& .MuiAccordionSummary-content': {
            my: 1,
          },
          '@media print': {
            minHeight: '40px !important',
            bgcolor: 'transparent',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            width: '100%',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: brandColor || 'text.secondary',
              '@media print': { display: 'none' },
            }}
          >
            {icon || <DataObjectIcon fontSize="small" />}
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              flex: 1,
              color: brandColor || 'text.primary',
            }}
          >
            {title}
          </Typography>
          <Chip
            label={`${fieldCount} field${fieldCount !== 1 ? 's' : ''}`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: brandColor ? `${brandColor}20` : 'grey.200',
              color: brandColor || 'text.secondary',
              '@media print': { display: 'none' },
            }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          p: 0,
          '@media print': {
            maxHeight: 'none !important',
          },
        }}
      >
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            bgcolor: 'grey.900',
            color: 'grey.100',
            maxHeight: printMode ? 'none' : maxHeight,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            '@media print': {
              bgcolor: '#f5f5f5',
              color: '#333',
              fontSize: '0.65rem',
              maxHeight: 'none',
            },
          }}
        >
          {JSON.stringify(data, null, 2)}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default CollapsibleJsonViewer;
