/**
 * SectionCard Component
 *
 * Reusable card wrapper for sections in the single-scroll Component Detail Page.
 * Provides consistent styling, section IDs for navigation, and collapsible support.
 */
import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  IconButton,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export interface SectionCardProps {
  /** Unique section ID for anchor navigation */
  id: string;
  /** Section title */
  title: string;
  /** Icon to display next to title */
  icon: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Whether the section is collapsible (default: false) */
  collapsible?: boolean;
  /** Default expanded state for collapsible sections */
  defaultExpanded?: boolean;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional action buttons in header */
  headerAction?: React.ReactNode;
  /** Print mode - force expand all */
  printMode?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  id,
  title,
  icon,
  children,
  collapsible = false,
  defaultExpanded = true,
  subtitle,
  headerAction,
  printMode = false,
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  // In print mode, always show expanded
  const isExpanded = printMode ? true : expanded;

  return (
    <Card
      id={id}
      sx={{
        mb: 3,
        scrollMarginTop: '80px', // Account for sticky header
        '@media print': {
          breakInside: 'avoid',
          mb: 2,
          boxShadow: 'none',
          border: '1px solid #e0e0e0',
        },
      }}
    >
      {/* Section Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 2,
          borderBottom: isExpanded ? '1px solid' : 'none',
          borderColor: 'divider',
          bgcolor: 'grey.50',
          '@media print': {
            bgcolor: 'transparent',
            py: 1.5,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 1,
              bgcolor: 'primary.light',
              color: 'primary.main',
              '@media print': {
                display: 'none',
              },
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: '1rem',
                lineHeight: 1.3,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.8rem' }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {headerAction}
          {collapsible && !printMode && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse section' : 'Expand section'}
              sx={{
                '@media print': {
                  display: 'none',
                },
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Section Content */}
      <Collapse in={isExpanded} timeout="auto" unmountOnExit={!printMode}>
        <CardContent
          sx={{
            p: 2.5,
            '&:last-child': { pb: 2.5 },
            '@media print': {
              p: 2,
            },
          }}
        >
          {children}
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default SectionCard;
