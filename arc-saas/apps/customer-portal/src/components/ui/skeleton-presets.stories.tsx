/**
 * Skeleton Presets - Storybook Stories
 *
 * Visual documentation and testing for all skeleton preset components.
 * Demonstrates various use cases and animation options.
 */

import type { Meta, StoryObj } from '@storybook/react';
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

const meta = {
  title: 'UI/Skeleton Presets',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Pre-built skeleton components for common UI patterns. All components support pulse, wave (shimmer), and no animation modes. Wave animation automatically respects prefers-reduced-motion.',
      },
    },
  },
} satisfies Meta;

export default meta;

/**
 * Text Skeletons
 */
export const TextSkeletons: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Single Line</h3>
        <TextSkeleton lines={1} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Paragraph (3 lines)</h3>
        <TextSkeleton lines={3} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Long Content (5 lines, wave animation)</h3>
        <TextSkeleton lines={5} animation="wave" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Custom Last Line Width</h3>
        <TextSkeleton lines={4} lastLineWidth="40%" />
      </div>
    </div>
  ),
};

/**
 * Avatar Skeletons
 */
export const AvatarSkeletons: StoryObj = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="text-center space-y-2">
        <AvatarSkeleton size="sm" />
        <p className="text-xs text-muted-foreground">Small</p>
      </div>
      <div className="text-center space-y-2">
        <AvatarSkeleton size="md" />
        <p className="text-xs text-muted-foreground">Medium</p>
      </div>
      <div className="text-center space-y-2">
        <AvatarSkeleton size="lg" />
        <p className="text-xs text-muted-foreground">Large</p>
      </div>
      <div className="text-center space-y-2">
        <AvatarSkeleton size="xl" animation="wave" />
        <p className="text-xs text-muted-foreground">Extra Large (wave)</p>
      </div>
    </div>
  ),
};

/**
 * Card Skeletons
 */
export const CardSkeletons: StoryObj = {
  render: () => (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Basic Card</h3>
        <CardSkeleton />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Card with Footer</h3>
        <CardSkeleton hasFooter />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Wave Animation</h3>
        <CardSkeleton animation="wave" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">No Animation</h3>
        <CardSkeleton animation="none" />
      </div>
    </div>
  ),
};

/**
 * Table Skeletons
 */
export const TableSkeletons: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">4 Columns</h3>
        <div className="border rounded-lg">
          <TableRowSkeleton columns={4} />
          <TableRowSkeleton columns={4} />
          <TableRowSkeleton columns={4} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">6 Columns (wave)</h3>
        <div className="border rounded-lg">
          <TableRowSkeleton columns={6} animation="wave" />
          <TableRowSkeleton columns={6} animation="wave" />
          <TableRowSkeleton columns={6} animation="wave" />
        </div>
      </div>
    </div>
  ),
};

/**
 * List Item Skeletons
 */
export const ListItemSkeletons: StoryObj = {
  render: () => (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold mb-3">Full (Avatar + Action)</h3>
        <div className="space-y-2">
          <ListItemSkeleton hasAvatar hasAction />
          <ListItemSkeleton hasAvatar hasAction />
          <ListItemSkeleton hasAvatar hasAction />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Without Avatar</h3>
        <div className="space-y-2">
          <ListItemSkeleton hasAvatar={false} />
          <ListItemSkeleton hasAvatar={false} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Without Action (wave)</h3>
        <div className="space-y-2">
          <ListItemSkeleton hasAction={false} animation="wave" />
          <ListItemSkeleton hasAction={false} animation="wave" />
        </div>
      </div>
    </div>
  ),
};

/**
 * Stat Skeletons
 */
export const StatSkeletons: StoryObj = {
  render: () => (
    <div className="grid grid-cols-4 gap-4">
      <StatSkeleton />
      <StatSkeleton showTrend />
      <StatSkeleton animation="wave" />
      <StatSkeleton showTrend animation="wave" />
    </div>
  ),
};

/**
 * Form Field Skeletons
 */
export const FormFieldSkeletons: StoryObj = {
  render: () => (
    <div className="grid grid-cols-2 gap-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold mb-3">Input with Label</h3>
        <FormFieldSkeleton hasLabel />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Input without Label</h3>
        <FormFieldSkeleton hasLabel={false} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Textarea</h3>
        <FormFieldSkeleton fieldType="textarea" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Select (wave)</h3>
        <FormFieldSkeleton fieldType="select" animation="wave" />
      </div>
    </div>
  ),
};

/**
 * Button Skeletons
 */
export const ButtonSkeletons: StoryObj = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="text-center space-y-2">
        <ButtonSkeleton size="sm" />
        <p className="text-xs text-muted-foreground">Small</p>
      </div>
      <div className="text-center space-y-2">
        <ButtonSkeleton size="default" />
        <p className="text-xs text-muted-foreground">Default</p>
      </div>
      <div className="text-center space-y-2">
        <ButtonSkeleton size="lg" animation="wave" />
        <p className="text-xs text-muted-foreground">Large (wave)</p>
      </div>
    </div>
  ),
};

/**
 * Image Skeletons
 */
export const ImageSkeletons: StoryObj = {
  render: () => (
    <div className="grid grid-cols-3 gap-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Square (1:1)</h3>
        <ImageSkeleton aspectRatio="1/1" />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3">Video (16:9)</h3>
        <ImageSkeleton aspectRatio="16/9" />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3">Ultrawide (21:9, wave)</h3>
        <ImageSkeleton aspectRatio="21/9" animation="wave" />
      </div>
    </div>
  ),
};

/**
 * Badge Skeletons
 */
export const BadgeSkeletons: StoryObj = {
  render: () => (
    <div className="flex items-center gap-3">
      <BadgeSkeleton />
      <BadgeSkeleton />
      <BadgeSkeleton animation="wave" />
    </div>
  ),
};

/**
 * Chart Skeletons
 */
export const ChartSkeletons: StoryObj = {
  render: () => (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Bar Chart</h3>
        <div className="border rounded-lg">
          <ChartSkeleton variant="bar" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Line Chart (wave)</h3>
        <div className="border rounded-lg">
          <ChartSkeleton variant="line" animation="wave" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Pie Chart</h3>
        <div className="border rounded-lg">
          <ChartSkeleton variant="pie" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Area Chart</h3>
        <div className="border rounded-lg">
          <ChartSkeleton variant="area" animation="wave" />
        </div>
      </div>
    </div>
  ),
};

/**
 * Navbar Skeleton
 */
export const NavbarSkeleton_Story: StoryObj = {
  name: 'Navbar Skeleton',
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Default</h3>
      <NavbarSkeleton />
      <h3 className="text-lg font-semibold mt-6">Wave Animation</h3>
      <NavbarSkeleton animation="wave" />
    </div>
  ),
};

/**
 * Profile Header Skeleton
 */
export const ProfileHeaderSkeleton_Story: StoryObj = {
  name: 'Profile Header Skeleton',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Default</h3>
      <div className="border rounded-lg">
        <ProfileHeaderSkeleton />
      </div>
      <h3 className="text-lg font-semibold mt-6">Wave Animation</h3>
      <div className="border rounded-lg">
        <ProfileHeaderSkeleton animation="wave" />
      </div>
    </div>
  ),
};

/**
 * Skeleton Group
 */
export const SkeletonGroup_Story: StoryObj = {
  name: 'Skeleton Group (Staggered Animation)',
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Staggered Wave Animation (100ms delay)</h3>
        <SkeletonGroup stagger={100} className="space-y-3">
          <ListItemSkeleton animation="wave" />
          <ListItemSkeleton animation="wave" />
          <ListItemSkeleton animation="wave" />
          <ListItemSkeleton animation="wave" />
          <ListItemSkeleton animation="wave" />
        </SkeletonGroup>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Card Grid (200ms stagger)</h3>
        <SkeletonGroup stagger={200} className="grid grid-cols-3 gap-4">
          <CardSkeleton animation="wave" />
          <CardSkeleton animation="wave" />
          <CardSkeleton animation="wave" />
          <CardSkeleton animation="wave" />
          <CardSkeleton animation="wave" />
          <CardSkeleton animation="wave" />
        </SkeletonGroup>
      </div>
    </div>
  ),
};

/**
 * Complete Page Example
 */
export const CompletePageExample: StoryObj = {
  name: 'Complete Page Example',
  render: () => (
    <div className="space-y-6">
      {/* Navbar */}
      <NavbarSkeleton animation="wave" />

      {/* Page header */}
      <div className="p-6 space-y-4">
        <TextSkeleton lines={1} className="w-1/3" animation="wave" />
        <TextSkeleton lines={2} animation="wave" />
      </div>

      {/* Stats grid */}
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4">
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
        </div>
      </div>

      {/* Content cards */}
      <div className="p-6">
        <SkeletonGroup stagger={100} className="grid grid-cols-3 gap-4">
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
        </SkeletonGroup>
      </div>
    </div>
  ),
};

/**
 * Animation Comparison
 */
export const AnimationComparison: StoryObj = {
  name: 'Animation Comparison',
  render: () => (
    <div className="grid grid-cols-3 gap-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Pulse (Default)</h3>
        <CardSkeleton animation="pulse" hasFooter />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Wave (Shimmer)</h3>
        <CardSkeleton animation="wave" hasFooter />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">None</h3>
        <CardSkeleton animation="none" hasFooter />
      </div>
    </div>
  ),
};

/**
 * Theme Compatibility
 */
export const ThemeCompatibility: StoryObj = {
  name: 'Theme Compatibility',
  parameters: {
    docs: {
      description: {
        story:
          'All skeleton components automatically adapt to the current theme (light, mid-light, dark, mid-dark). The wave animation uses theme-aware CSS variables for optimal visibility in all themes.',
      },
    },
  },
  render: () => (
    <div className="space-y-6">
      <div className="p-6 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Current Theme</h3>
        <div className="space-y-4">
          <TextSkeleton lines={3} animation="wave" />
          <div className="grid grid-cols-3 gap-4">
            <CardSkeleton animation="wave" />
            <CardSkeleton animation="wave" />
            <CardSkeleton animation="wave" />
          </div>
          <ListItemSkeleton animation="wave" />
          <ListItemSkeleton animation="wave" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Toggle between themes in Storybook to see automatic adaptation.
      </p>
    </div>
  ),
};
