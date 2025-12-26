import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
  Link as MuiLink,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  ViewInAr as ViewInArIcon,
  OpenInNew as OpenInNewIcon,
  Inventory as PackageIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';

interface ComponentCardProps {
  component: {
    mpn: string;
    manufacturer: string;
    category: string;
    description: string;
    quality_score: number;
    enrichment_status: 'production' | 'staging' | 'rejected' | 'pending';
    data_sources?: string[];
    last_updated?: string;
    image_url?: string;
    datasheet_url?: string;
    model_3d_url?: string;
    rohs_compliant?: boolean;
    reach_compliant?: boolean;
    aec_qualified?: boolean;
    unit_price?: number;
    in_stock?: boolean;
    stock_status?: string;
    package_type?: string;
    lifecycle_status?: string;
  };
  onViewDetails?: (mpn: string) => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ component, onViewDetails }) => {
  const getStatusConfig = (status: string | undefined | null): { label: string; color: 'success' | 'warning' | 'error' | 'default' } => {
    const configs = {
      production: { label: 'Production', color: 'success' as const },
      staging: { label: 'Staging', color: 'warning' as const },
      rejected: { label: 'Rejected', color: 'error' as const },
      pending: { label: 'Pending', color: 'default' as const },
    };
    if (status && status in configs) {
      return configs[status as keyof typeof configs];
    }
    return configs.pending;
  };

  const getQualityColor = (score: number): string => {
    if (score >= 80) return '#4caf50'; // green
    if (score >= 60) return '#ff9800'; // orange
    if (score >= 40) return '#ff5722'; // deep orange
    return '#f44336'; // red
  };

  const statusConfig = getStatusConfig(component.enrichment_status);

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(component.mpn);
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={handleCardClick}
    >
      {/* Status Badge - Top Right */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1,
        }}
      >
        <Chip
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Header Section with Image and Basic Info */}
      <Box
        sx={{
          display: 'flex',
          p: 2,
          gap: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Component Image */}
        <Box
          sx={{
            flexShrink: 0,
            width: 100,
            height: 80,
            bgcolor: 'grey.100',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {component.image_url ? (
            <img
              src={component.image_url}
              alt={component.mpn}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <PackageIcon
            sx={{
              fontSize: 40,
              color: 'grey.400',
              display: component.image_url ? 'none' : 'flex',
            }}
          />
        </Box>

        {/* Basic Component Info */}
        <Box sx={{ flex: 1, minWidth: 0, pr: 4 }}>
          <Tooltip title={component.mpn} placement="top">
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mb: 0.5,
              }}
            >
              {component.mpn}
            </Typography>
          </Tooltip>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {component.manufacturer}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={component.category}
              size="small"
              sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontSize: '0.7rem' }}
            />
            {component.package_type && (
              <Chip
                label={component.package_type}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, pb: 1 }}>
        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.5,
            minHeight: '3em',
          }}
        >
          {component.description}
        </Typography>

        {/* Compliance, Stock, Price Row */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2,
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Compliance Badges */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {component.rohs_compliant && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="RoHS"
                size="small"
                sx={{
                  bgcolor: 'success.light',
                  color: 'success.dark',
                  fontSize: '0.65rem',
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
            {component.reach_compliant && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="REACH"
                size="small"
                sx={{
                  bgcolor: 'success.light',
                  color: 'success.dark',
                  fontSize: '0.65rem',
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
            {component.aec_qualified && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="AEC-Q"
                size="small"
                sx={{
                  bgcolor: 'secondary.light',
                  color: 'secondary.dark',
                  fontSize: '0.65rem',
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
          </Box>

          {/* Stock & Price */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {component.in_stock !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: component.in_stock ? 'success.main' : 'error.main',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: component.in_stock ? 'success.main' : 'error.main',
                  }}
                >
                  {component.in_stock ? 'In Stock' : 'Out of Stock'}
                </Typography>
              </Box>
            )}
            {component.unit_price && (
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.95rem' }}
              >
                ${component.unit_price.toFixed(2)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Quality Bar and Actions Row */}
        <Box sx={{ mt: 'auto' }}>
          {/* Quality Score Bar */}
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Quality Score
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: getQualityColor(component.quality_score),
                  fontSize: '0.75rem',
                }}
              >
                {component.quality_score}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={component.quality_score}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  bgcolor: getQualityColor(component.quality_score),
                  borderRadius: 1,
                },
              }}
            />
          </Box>

          {/* Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {component.datasheet_url && (
              <Tooltip title="View Datasheet">
                <IconButton
                  size="small"
                  component="a"
                  href={component.datasheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main', bgcolor: 'primary.light' },
                  }}
                >
                  <DescriptionIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {component.model_3d_url && (
              <Tooltip title="View 3D Model">
                <IconButton
                  size="small"
                  component="a"
                  href={component.model_3d_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'secondary.main', bgcolor: 'secondary.light' },
                  }}
                >
                  <ViewInArIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="View Details">
              <IconButton
                size="small"
                component={Link}
                to={`/component/${encodeURIComponent(component.mpn)}`}
                onClick={(e) => e.stopPropagation()}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'success.main', bgcolor: 'success.light' },
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
