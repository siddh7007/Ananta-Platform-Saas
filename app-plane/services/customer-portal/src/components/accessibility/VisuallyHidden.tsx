/**
 * Visually Hidden Component
 *
 * Hides content visually while keeping it accessible to screen readers.
 * Use for providing additional context that screen reader users need.
 *
 * WCAG 2.1 Level A: 1.3.1 Info and Relationships
 */

import React from 'react';
import { Box, BoxProps } from '@mui/material';

interface VisuallyHiddenProps extends Omit<BoxProps, 'sx'> {
  children: React.ReactNode;
  as?: React.ElementType;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as = 'span',
  ...props
}) => {
  return (
    <Box
      component={as}
      sx={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

export default VisuallyHidden;
