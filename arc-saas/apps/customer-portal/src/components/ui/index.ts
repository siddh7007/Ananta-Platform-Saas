/**
 * UI Components - Central Export
 *
 * Barrel export file for all UI components in the design system.
 * Import components from this file for cleaner import statements.
 *
 * @example
 * ```tsx
 * // Instead of multiple imports:
 * import { Button } from '@/components/ui/button';
 * import { Card } from '@/components/ui/card';
 * import { Skeleton } from '@/components/ui/skeleton';
 *
 * // Use single import:
 * import { Button, Card, Skeleton } from '@/components/ui';
 * ```
 */

// Base skeleton component
export { Skeleton } from './skeleton';
export type { SkeletonProps } from './skeleton';

// General-purpose skeleton presets
export {
  TextSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  TableRowSkeleton,
  ListItemSkeleton,
  StatSkeleton,
  FormFieldSkeleton,
  ButtonSkeleton,
  ImageSkeleton,
  BadgeSkeleton,
  ChartSkeleton,
  SkeletonGroup,
  NavbarSkeleton,
  ProfileHeaderSkeleton,
} from './skeleton-presets';

// Other UI components can be added here as needed
export { Button } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Badge } from './badge';
export { Input } from './input';
export { Label } from './label';
export { Textarea } from './textarea';
export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select';
export { StatusBadge } from './status-badge';
export { Toaster } from './toaster';
export { useToast } from './toast-notifications';
