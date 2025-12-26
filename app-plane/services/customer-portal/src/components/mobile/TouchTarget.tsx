/**
 * TouchTarget Component
 *
 * P1-5: Reusable touch-friendly button/interactive element.
 * Ensures minimum 48px touch target size per accessibility guidelines.
 */

import React, { useMemo } from 'react';
import { Box, ButtonBase, SxProps, Theme } from '@mui/material';

export interface TouchTargetProps {
  /** Click handler */
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void;
  /** Content to display */
  children: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Minimum touch target size (default: 48px) */
  minSize?: number;
  /** Custom styles */
  sx?: SxProps<Theme>;
  /** ARIA label for accessibility */
  'aria-label'?: string;
  /** Test ID */
  'data-testid'?: string;
  /** Additional class names */
  className?: string;
  /** Component variant */
  variant?: 'default' | 'filled' | 'outlined';
  /** Color theme */
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Touch-friendly interactive element with guaranteed minimum touch target size
 */
export function TouchTarget({
  onClick,
  children,
  disabled = false,
  minSize = 48,
  sx,
  'aria-label': ariaLabel,
  'data-testid': testId,
  className,
  variant = 'default',
  color = 'primary',
  fullWidth = false,
}: TouchTargetProps) {
  // H5 Fix: Memoize variant styles computation
  const variantStyles = useMemo((): SxProps<Theme> => {
    const colorMap: Record<string, string> = {
      primary: 'primary.main',
      secondary: 'secondary.main',
      success: 'success.main',
      error: 'error.main',
      warning: 'warning.main',
      info: 'info.main',
    };

    const bgColorMap: Record<string, string> = {
      primary: 'primary.50',
      secondary: 'secondary.50',
      success: 'success.50',
      error: 'error.50',
      warning: 'warning.50',
      info: 'info.50',
    };

    switch (variant) {
      case 'filled':
        return {
          bgcolor: colorMap[color],
          color: 'white',
          '&:hover': {
            bgcolor: `${color}.dark`,
          },
          '&:active': {
            bgcolor: `${color}.dark`,
            transform: 'scale(0.98)',
          },
        };
      case 'outlined':
        return {
          border: '2px solid',
          borderColor: colorMap[color],
          color: colorMap[color],
          bgcolor: 'transparent',
          '&:hover': {
            bgcolor: bgColorMap[color],
          },
          '&:active': {
            bgcolor: bgColorMap[color],
            transform: 'scale(0.98)',
          },
        };
      default:
        return {
          bgcolor: 'transparent',
          '&:hover': {
            bgcolor: 'action.hover',
          },
          '&:active': {
            bgcolor: 'action.selected',
            transform: 'scale(0.98)',
          },
        };
    }
  }, [variant, color]);

  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
      sx={{
        minWidth: minSize,
        minHeight: minSize,
        width: fullWidth ? '100%' : 'auto',
        borderRadius: 2,
        padding: 1.5,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        transition: 'all 0.15s ease-in-out',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...variantStyles,
        ...sx,
      }}
    >
      {children}
    </ButtonBase>
  );
}

/**
 * Wrapper component that adds touch-target padding to any content
 * while keeping the visual size the same
 */
export interface TouchTargetWrapperProps {
  /** Content to wrap */
  children: React.ReactNode;
  /** Minimum touch target size (default: 48px) */
  minSize?: number;
  /** Click handler (optional - makes the wrapper interactive) */
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void;
  /** ARIA label */
  'aria-label'?: string;
  /** Test ID */
  'data-testid'?: string;
}

export function TouchTargetWrapper({
  children,
  minSize = 48,
  onClick,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: TouchTargetWrapperProps) {
  const Wrapper = onClick ? ButtonBase : Box;

  return (
    <Wrapper
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: minSize,
        minHeight: minSize,
        WebkitTapHighlightColor: 'transparent',
        touchAction: onClick ? 'manipulation' : 'auto',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </Wrapper>
  );
}

export default TouchTarget;
