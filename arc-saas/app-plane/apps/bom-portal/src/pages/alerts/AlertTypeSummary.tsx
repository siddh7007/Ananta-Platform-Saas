/**
 * AlertTypeSummary Component
 *
 * Displays a summary of alerts grouped by type with icons and counts.
 * Shows alert type distribution in a visual grid format.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
import GavelIcon from '@mui/icons-material/Gavel';
import ArticleIcon from '@mui/icons-material/Article';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { alertTypeColors } from '../../theme';
import type { AlertStats, AlertType } from '../../services/alertService';

interface AlertTypeSummaryProps {
  stats: AlertStats | null;
}

// Alert type configuration for display
const ALERT_TYPE_CONFIG: Record<AlertType, { icon: React.ReactNode; label: string; color: string }> = {
  LIFECYCLE: { icon: <HistoryIcon />, label: 'Lifecycle', color: alertTypeColors.LIFECYCLE },
  RISK: { icon: <TrendingUpIcon />, label: 'Risk Score', color: alertTypeColors.RISK },
  PRICE: { icon: <AttachMoneyIcon />, label: 'Price', color: alertTypeColors.PRICE },
  AVAILABILITY: { icon: <InventoryIcon />, label: 'Availability', color: alertTypeColors.AVAILABILITY },
  COMPLIANCE: { icon: <GavelIcon />, label: 'Compliance', color: alertTypeColors.COMPLIANCE },
  PCN: { icon: <ArticleIcon />, label: 'PCN/PDN', color: alertTypeColors.PCN },
  SUPPLY_CHAIN: { icon: <LocalShippingIcon />, label: 'Supply Chain', color: alertTypeColors.SUPPLY_CHAIN },
};

export function AlertTypeSummary({ stats }: AlertTypeSummaryProps) {
  if (!stats) {
    return null;
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Alerts by Type
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(ALERT_TYPE_CONFIG).map(([type, config]) => {
            const count = stats.by_type?.[type as AlertType] || 0;
            return (
              <Grid item xs={6} sm={4} md={12 / 7} key={type}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderColor: config.color,
                    borderWidth: 2,
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: `${config.color}10`,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  {React.cloneElement(config.icon as React.ReactElement, {
                    sx: { color: config.color, fontSize: 32 },
                  })}
                  <Typography variant="h5" fontWeight={700} sx={{ color: config.color }}>
                    {count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {config.label}
                  </Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}

export default AlertTypeSummary;
