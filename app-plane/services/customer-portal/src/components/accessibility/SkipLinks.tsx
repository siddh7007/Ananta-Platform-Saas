/**
 * Skip Links Component
 *
 * Provides keyboard-accessible skip links for screen reader users
 * to bypass navigation and jump directly to main content.
 *
 * WCAG 2.1 Level A: 2.4.1 Bypass Blocks
 */

import React from 'react';
import { Box, Link } from '@mui/material';

interface SkipLink {
  id: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { id: 'main-content', label: 'Skip to main content' },
  { id: 'main-navigation', label: 'Skip to navigation' },
];

export const SkipLinks: React.FC<SkipLinksProps> = ({ links = defaultLinks }) => {
  return (
    <Box
      component="nav"
      aria-label="Skip links"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      {links.map((link) => (
        <Link
          key={link.id}
          href={`#${link.id}`}
          sx={{
            position: 'absolute',
            left: '-9999px',
            zIndex: 9999,
            padding: '1rem',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            textDecoration: 'none',
            fontWeight: 600,
            '&:focus': {
              left: 0,
              top: 0,
            },
          }}
        >
          {link.label}
        </Link>
      ))}
    </Box>
  );
};

export default SkipLinks;
