/**
 * Breadcrumb Component Usage Examples
 *
 * Shows how to integrate the Breadcrumb component in your layout.
 */
import { Box } from '@mui/material';
import { Breadcrumb } from './Breadcrumb';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

/**
 * Example 1: Basic usage (default settings)
 */
export function BasicBreadcrumbExample() {
  return (
    <Box sx={{ p: 2 }}>
      <Breadcrumb />
    </Box>
  );
}

/**
 * Example 2: Custom separator
 */
export function CustomSeparatorExample() {
  return (
    <Box sx={{ p: 2 }}>
      <Breadcrumb 
        separator={<ArrowForwardIosIcon fontSize="small" />} 
      />
    </Box>
  );
}

/**
 * Example 3: Without home icon
 */
export function NoHomeIconExample() {
  return (
    <Box sx={{ p: 2 }}>
      <Breadcrumb showHomeIcon={false} />
    </Box>
  );
}

/**
 * Example 4: In AppBar/Toolbar
 */
export function ToolbarBreadcrumbExample() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Breadcrumb />
    </Box>
  );
}

/**
 * Example 5: With page title
 */
export function BreadcrumbWithTitleExample() {
  return (
    <Box sx={{ p: 2 }}>
      <Breadcrumb />
      <Box sx={{ mt: 1 }}>
        <h1>Current Page Title</h1>
      </Box>
    </Box>
  );
}
