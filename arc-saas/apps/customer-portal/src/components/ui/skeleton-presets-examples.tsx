/**
 * Skeleton Presets - Usage Examples
 *
 * Practical examples demonstrating how to use skeleton presets
 * in real-world scenarios throughout the application.
 *
 * @module components/ui/skeleton-presets-examples
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
 * Example: Loading Dashboard Page
 *
 * Complete dashboard loading state with navbar, stats, and content cards.
 */
export function DashboardPageSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <NavbarSkeleton animation="wave" />

      {/* Page Header */}
      <div className="p-6 space-y-4 border-b">
        <TextSkeleton lines={1} className="w-1/4" animation="wave" />
        <TextSkeleton lines={2} className="w-2/3" animation="wave" />
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
        </div>
      </div>

      {/* Content Cards with Stagger */}
      <div className="p-6">
        <SkeletonGroup stagger={100} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
        </SkeletonGroup>
      </div>
    </div>
  );
}

/**
 * Example: Loading Data Table
 *
 * Table with loading rows showing column structure.
 */
export function DataTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="rounded-lg border">
      {/* Table Header (static) */}
      <div className="flex items-center border-b px-4 py-3 bg-muted/50 font-medium text-sm">
        <div className="flex-1 px-2">Name</div>
        <div className="w-24 px-2">Status</div>
        <div className="w-32 px-2">Progress</div>
        <div className="w-28 px-2">Date</div>
        <div className="w-16 px-2">Actions</div>
      </div>

      {/* Loading Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={5} animation="wave" />
      ))}
    </div>
  );
}

/**
 * Example: Loading User List
 *
 * List of users with avatars and action buttons.
 */
export function UserListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <SkeletonGroup stagger={80} className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <ListItemSkeleton key={i} hasAvatar hasAction animation="wave" />
        ))}
      </SkeletonGroup>
    </div>
  );
}

/**
 * Example: Loading Product Grid
 *
 * Grid of product cards with images.
 */
export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <SkeletonGroup stagger={100} className="contents">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-3">
            <ImageSkeleton aspectRatio="1/1" animation="wave" />
            <TextSkeleton lines={1} className="w-3/4" />
            <TextSkeleton lines={1} className="w-1/2" />
            <div className="flex items-center justify-between">
              <TextSkeleton lines={1} className="w-20" />
              <ButtonSkeleton size="sm" />
            </div>
          </div>
        ))}
      </SkeletonGroup>
    </div>
  );
}

/**
 * Example: Loading Form
 *
 * Multi-field form with different input types.
 */
export function FormSkeleton() {
  return (
    <div className="space-y-6">
      <FormFieldSkeleton hasLabel fieldType="input" animation="wave" />
      <FormFieldSkeleton hasLabel fieldType="input" animation="wave" />
      <FormFieldSkeleton hasLabel fieldType="select" animation="wave" />
      <FormFieldSkeleton hasLabel fieldType="textarea" animation="wave" />

      <div className="grid grid-cols-2 gap-4">
        <FormFieldSkeleton hasLabel fieldType="input" animation="wave" />
        <FormFieldSkeleton hasLabel fieldType="input" animation="wave" />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <ButtonSkeleton size="default" />
        <ButtonSkeleton size="default" />
      </div>
    </div>
  );
}

/**
 * Example: Loading Profile Page
 *
 * User profile with header, stats, and content sections.
 */
export function ProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <ProfileHeaderSkeleton animation="wave" />

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <StatSkeleton animation="wave" />
        <StatSkeleton animation="wave" />
        <StatSkeleton animation="wave" />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <CardSkeleton animation="wave" />
          <div className="space-y-3">
            <TextSkeleton lines={1} className="w-1/3" />
            <ListItemSkeleton hasAvatar={false} hasAction={false} animation="wave" />
            <ListItemSkeleton hasAvatar={false} hasAction={false} animation="wave" />
            <ListItemSkeleton hasAvatar={false} hasAction={false} animation="wave" />
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
        </div>
      </div>
    </div>
  );
}

/**
 * Example: Loading Analytics Dashboard
 *
 * Analytics page with charts and metrics.
 */
export function AnalyticsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <TextSkeleton lines={1} className="w-1/4" />
        <div className="flex gap-2">
          <ButtonSkeleton size="default" />
          <ButtonSkeleton size="default" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatSkeleton showTrend animation="wave" />
        <StatSkeleton showTrend animation="wave" />
        <StatSkeleton showTrend animation="wave" />
        <StatSkeleton showTrend animation="wave" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <TextSkeleton lines={1} className="w-1/3" />
          </div>
          <ChartSkeleton variant="line" animation="wave" />
        </div>
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <TextSkeleton lines={1} className="w-1/3" />
          </div>
          <ChartSkeleton variant="bar" animation="wave" />
        </div>
      </div>

      {/* Full Width Chart */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <TextSkeleton lines={1} className="w-1/4" />
            <div className="flex gap-2">
              <BadgeSkeleton />
              <BadgeSkeleton />
              <BadgeSkeleton />
            </div>
          </div>
        </div>
        <ChartSkeleton variant="area" animation="wave" />
      </div>
    </div>
  );
}

/**
 * Example: Loading Search Results
 *
 * Search results page with filters and result cards.
 */
export function SearchResultsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-4">
        <FormFieldSkeleton hasLabel={false} className="flex-1" />
        <ButtonSkeleton size="default" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <TextSkeleton lines={1} className="w-16" />
        <div className="flex gap-2">
          <BadgeSkeleton animation="wave" />
          <BadgeSkeleton animation="wave" />
          <BadgeSkeleton animation="wave" />
        </div>
      </div>

      {/* Results Count */}
      <TextSkeleton lines={1} className="w-32" />

      {/* Results List */}
      <SkeletonGroup stagger={80} className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
            <ImageSkeleton aspectRatio="1/1" className="w-24 h-24" animation="wave" />
            <div className="flex-1 space-y-2">
              <TextSkeleton lines={1} className="w-3/4" />
              <TextSkeleton lines={2} className="w-full" />
              <div className="flex gap-2">
                <BadgeSkeleton />
                <BadgeSkeleton />
              </div>
            </div>
            <ButtonSkeleton size="default" />
          </div>
        ))}
      </SkeletonGroup>
    </div>
  );
}

/**
 * Example: Loading Settings Page
 *
 * Settings page with multiple sections.
 */
export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <TextSkeleton lines={1} className="w-1/4 mb-2" />
        <TextSkeleton lines={1} className="w-1/2" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <ButtonSkeleton size="default" />
        <ButtonSkeleton size="default" />
        <ButtonSkeleton size="default" />
        <ButtonSkeleton size="default" />
      </div>

      {/* Settings Form */}
      <div className="space-y-8">
        {/* Section 1 */}
        <div className="space-y-4">
          <TextSkeleton lines={1} className="w-1/5" />
          <div className="grid grid-cols-2 gap-4">
            <FormFieldSkeleton hasLabel animation="wave" />
            <FormFieldSkeleton hasLabel animation="wave" />
          </div>
        </div>

        {/* Section 2 */}
        <div className="space-y-4">
          <TextSkeleton lines={1} className="w-1/5" />
          <FormFieldSkeleton hasLabel fieldType="textarea" animation="wave" />
        </div>

        {/* Section 3 */}
        <div className="space-y-4">
          <TextSkeleton lines={1} className="w-1/5" />
          <div className="space-y-3">
            <ListItemSkeleton hasAvatar={false} hasAction animation="wave" />
            <ListItemSkeleton hasAvatar={false} hasAction animation="wave" />
            <ListItemSkeleton hasAvatar={false} hasAction animation="wave" />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <ButtonSkeleton size="default" />
        </div>
      </div>
    </div>
  );
}

/**
 * Example: Loading Comment Thread
 *
 * Comment thread with nested replies.
 */
export function CommentThreadSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          {/* Main Comment */}
          <div className="flex gap-3">
            <AvatarSkeleton size="md" animation="wave" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <TextSkeleton lines={1} className="w-32" />
                <TextSkeleton lines={1} className="w-20" />
              </div>
              <TextSkeleton lines={2} />
              <div className="flex gap-2">
                <ButtonSkeleton size="sm" />
                <ButtonSkeleton size="sm" />
              </div>
            </div>
          </div>

          {/* Nested Reply (every 3rd comment) */}
          {i % 3 === 0 && (
            <div className="ml-12 flex gap-3">
              <AvatarSkeleton size="sm" animation="wave" />
              <div className="flex-1 space-y-2">
                <TextSkeleton lines={1} className="w-24" />
                <TextSkeleton lines={1} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
