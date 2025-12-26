/**
 * ContextLinks Component
 *
 * CBP-style "Quick Links" section with pipe separators between link buttons.
 * Used in queue cards to provide contextual navigation.
 */

import { Box, Button, Typography, Divider } from '@mui/material';
import type { ReactNode } from 'react';

export interface ContextLink {
  label: string;
  onClick: () => void;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ContextLinksProps {
  title?: string;
  links: ContextLink[];
}

export default function ContextLinks({ title = 'Quick Links', links }: ContextLinksProps) {
  if (!links || links.length === 0) return null;

  return (
    <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {title}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {links.map((link, index) => (
          <Box key={link.label} sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="text"
              size="small"
              onClick={link.onClick}
              disabled={link.disabled}
              startIcon={link.icon}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                py: 0.25,
                px: 0.75,
                minWidth: 'auto',
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  textDecoration: 'underline',
                },
                '&.Mui-disabled': {
                  color: 'text.disabled',
                },
              }}
            >
              {link.label}
              {link.count !== undefined && (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ ml: 0.5, color: 'inherit', fontWeight: 600 }}
                >
                  ({link.count})
                </Typography>
              )}
            </Button>
            {index < links.length - 1 && (
              <Typography
                component="span"
                variant="caption"
                sx={{ color: 'text.disabled', mx: 0.5 }}
              >
                |
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Pre-configured context links for common BOM workflow scenarios
 */
export interface BOMContextLinksProps {
  bomId: string;
  stats?: {
    total?: number;
    enriched?: number;
    pending?: number;
    failed?: number;
  };
  onViewLineItems?: () => void;
  onViewEnriched?: () => void;
  onViewPending?: () => void;
  onViewFailed?: () => void;
  onViewRiskAnalysis?: () => void;
  onExportCSV?: () => void;
}

export function BOMContextLinks({
  stats,
  onViewLineItems,
  onViewEnriched,
  onViewPending,
  onViewFailed,
  onViewRiskAnalysis,
  onExportCSV,
}: BOMContextLinksProps) {
  const links: ContextLink[] = [];

  if (onViewLineItems) {
    links.push({
      label: 'All Line Items',
      onClick: onViewLineItems,
      count: stats?.total,
    });
  }

  if (onViewEnriched && stats?.enriched !== undefined) {
    links.push({
      label: 'Enriched',
      onClick: onViewEnriched,
      count: stats.enriched,
    });
  }

  if (onViewPending && stats?.pending !== undefined && stats.pending > 0) {
    links.push({
      label: 'Pending',
      onClick: onViewPending,
      count: stats.pending,
    });
  }

  if (onViewFailed && stats?.failed !== undefined && stats.failed > 0) {
    links.push({
      label: 'Failed',
      onClick: onViewFailed,
      count: stats.failed,
    });
  }

  if (onViewRiskAnalysis) {
    links.push({
      label: 'Risk Analysis',
      onClick: onViewRiskAnalysis,
    });
  }

  if (onExportCSV) {
    links.push({
      label: 'Export CSV',
      onClick: onExportCSV,
    });
  }

  return <ContextLinks links={links} />;
}
