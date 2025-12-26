/**
 * Skeleton Presets - Type Validation
 *
 * This file validates that all skeleton preset components
 * have correct TypeScript types and can be imported properly.
 */

import {
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

/**
 * Type validation - ensures all components are correctly typed
 */
function TypeValidation() {
  return (
    <div>
      {/* Text Skeleton */}
      <TextSkeleton lines={3} animation="wave" />

      {/* Avatar Skeleton */}
      <AvatarSkeleton size="md" animation="pulse" />

      {/* Card Skeleton */}
      <CardSkeleton hasFooter animation="wave" />

      {/* Table Row Skeleton */}
      <TableRowSkeleton columns={5} animation="wave" />

      {/* List Item Skeleton */}
      <ListItemSkeleton hasAvatar hasAction animation="pulse" />

      {/* Stat Skeleton */}
      <StatSkeleton showTrend animation="wave" />

      {/* Form Field Skeleton */}
      <FormFieldSkeleton hasLabel fieldType="input" animation="wave" />

      {/* Button Skeleton */}
      <ButtonSkeleton size="default" animation="pulse" />

      {/* Image Skeleton */}
      <ImageSkeleton aspectRatio="16/9" animation="wave" />

      {/* Badge Skeleton */}
      <BadgeSkeleton animation="pulse" />

      {/* Chart Skeleton */}
      <ChartSkeleton variant="bar" animation="wave" />

      {/* Navbar Skeleton */}
      <NavbarSkeleton animation="wave" />

      {/* Profile Header Skeleton */}
      <ProfileHeaderSkeleton animation="wave" />

      {/* Skeleton Group */}
      <SkeletonGroup stagger={100} className="space-y-3">
        <CardSkeleton animation="wave" />
        <CardSkeleton animation="wave" />
      </SkeletonGroup>
    </div>
  );
}

export default TypeValidation;
