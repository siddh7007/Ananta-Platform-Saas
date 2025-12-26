import React from 'react';
import { Box, ButtonBase } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

export type TouchTargetSize = 'sm' | 'md' | 'lg';

export interface TouchTargetProps {
  children: React.ReactNode;
  onClick?: (event?: React.MouseEvent) => void;
  size?: TouchTargetSize;
  disabled?: boolean;
  className?: string;
  sx?: SxProps<Theme>;
  component?: React.ElementType;
  ariaLabel?: string;
}

const sizeMap: Record<TouchTargetSize, { minHeight: string; minWidth: string }> = {
  sm: { minHeight: '44px', minWidth: '44px' }, // iOS minimum
  md: { minHeight: '48px', minWidth: '48px' }, // Recommended
  lg: { minHeight: '56px', minWidth: '56px' }, // Comfortable
};

/**
 * TouchTarget - Ensures minimum touch target size for accessibility
 *
 * Guarantees 48x48px minimum for comfortable touch interaction
 * on tablets and mobile devices.
 *
 * @example
 * <TouchTarget onClick={handleClick} size="md" ariaLabel="Delete item">
 *   <DeleteIcon />
 * </TouchTarget>
 */
export const TouchTarget: React.FC<TouchTargetProps> = ({
  children,
  onClick,
  size = 'md',
  disabled = false,
  className = '',
  sx = {},
  component,
  ariaLabel,
}) => {
  const { minHeight, minWidth } = sizeMap[size];

  const touchTargetSx: SxProps<Theme> = {
    minHeight,
    minWidth,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : onClick ? 'pointer' : 'default',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    '&:active': !disabled && onClick
      ? {
          transform: 'scale(0.95)',
        }
      : {},
    ...sx,
  };

  if (onClick && !disabled) {
    return (
      <ButtonBase
        component={component}
        onClick={onClick}
        disabled={disabled}
        className={`touch-target touch-target-${size} ${className}`}
        sx={touchTargetSx}
        aria-label={ariaLabel}
      >
        {children}
      </ButtonBase>
    );
  }

  return (
    <Box
      component={component}
      className={`touch-target touch-target-${size} ${className}`}
      sx={touchTargetSx}
      aria-label={ariaLabel}
    >
      {children}
    </Box>
  );
};

/**
 * TouchIconButton - Specialized TouchTarget for icon buttons
 */
export const TouchIconButton: React.FC<
  TouchTargetProps & { icon: React.ReactNode }
> = ({ icon, ...props }) => {
  return (
    <TouchTarget {...props}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
    </TouchTarget>
  );
};

export default TouchTarget;
