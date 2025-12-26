# CBP Refine - UI Component Catalog

**Portal**: Customer Business Portal (CBP) - Refine.dev Version
**Location**: `arc-saas/apps/customer-portal`
**Date**: 2025-12-14
**Framework**: Refine.dev 4.x + React 18 + TypeScript

---

## Executive Summary

This document catalogs all UI components in the new CBP Refine Customer Portal, documenting the design system, component library, patterns, and usage guidelines.

**Key Statistics**:
- **Total Source Files**: 61 TypeScript/TSX files
- **UI Components**: 18 core shadcn/ui components
- **Feature Components**: 40+ domain-specific components
- **Design System**: Tailwind CSS + CSS Variables
- **Icon Library**: Lucide React (200+ icons)

---

## Table of Contents

1. [Design System Overview](#1-design-system-overview)
2. [UI Libraries & Dependencies](#2-ui-libraries--dependencies)
3. [Core UI Components](#3-core-ui-components)
4. [Feature Components](#4-feature-components)
5. [Layout Components](#5-layout-components)
6. [Form Components](#6-form-components)
7. [Data Display Components](#7-data-display-components)
8. [Feedback Components](#8-feedback-components)
9. [Design Patterns](#9-design-patterns)
10. [Accessibility Guidelines](#10-accessibility-guidelines)
11. [Component Usage Examples](#11-component-usage-examples)

---

## 1. Design System Overview

### 1.1 Color System

The portal uses CSS custom properties for theming, enabling multiple theme modes.

**Source**: `tailwind.config.js`

```javascript
// CSS Variable-based color tokens
colors: {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive))',
    foreground: 'hsl(var(--destructive-foreground))',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))',
  },
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
  },
  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))',
  },
}
```

### 1.2 Theme Modes

**Supported Themes** (4 modes):
| Mode | Description | Use Case |
|------|-------------|----------|
| `light` | Standard light mode | Default, office environments |
| `dark` | Full dark mode | Low-light, developer preference |
| `mid-light` | Softer light | Reduced eye strain |
| `mid-dark` | Softer dark | Night mode alternative |

**Theme Toggle**: `src/components/ui/theme-selector.tsx`

### 1.3 Typography Scale

```css
/* Font Family */
font-sans: ['Inter', 'system-ui', 'sans-serif']
font-mono: ['JetBrains Mono', 'Fira Code', 'monospace']

/* Font Sizes (Tailwind defaults) */
text-xs: 0.75rem (12px)
text-sm: 0.875rem (14px)
text-base: 1rem (16px)
text-lg: 1.125rem (18px)
text-xl: 1.25rem (20px)
text-2xl: 1.5rem (24px)
text-3xl: 1.875rem (30px)

/* Font Weights */
font-normal: 400
font-medium: 500
font-semibold: 600
font-bold: 700
```

### 1.4 Spacing System

```css
/* Tailwind spacing scale */
spacing-0: 0
spacing-1: 0.25rem (4px)
spacing-2: 0.5rem (8px)
spacing-3: 0.75rem (12px)
spacing-4: 1rem (16px)
spacing-5: 1.25rem (20px)
spacing-6: 1.5rem (24px)
spacing-8: 2rem (32px)
spacing-10: 2.5rem (40px)
spacing-12: 3rem (48px)
spacing-16: 4rem (64px)
```

### 1.5 Border Radius

```javascript
borderRadius: {
  lg: 'var(--radius)',      // 0.5rem default
  md: 'calc(var(--radius) - 2px)',
  sm: 'calc(var(--radius) - 4px)',
}
```

### 1.6 Shadows

```css
/* Component shadows */
shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
shadow: 0 1px 3px rgba(0,0,0,0.1)
shadow-md: 0 4px 6px rgba(0,0,0,0.1)
shadow-lg: 0 10px 15px rgba(0,0,0,0.1)
```

---

## 2. UI Libraries & Dependencies

### 2.1 Primary UI Framework

| Library | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/*` | Latest | Accessible UI primitives |
| `shadcn/ui` | Custom | Pre-built Radix components |
| `tailwindcss` | 3.x | Utility-first CSS |
| `class-variance-authority` | 0.7+ | Component variants |
| `clsx` | 2.x | Conditional classes |
| `tailwind-merge` | 2.x | Class merging |

### 2.2 Icon Library

**Library**: Lucide React
**Import Pattern**:
```typescript
import { Home, FileText, Users, Settings, Bell } from 'lucide-react';
```

**Usage**:
```tsx
<Home className="h-5 w-5" />
<FileText className="h-4 w-4 text-muted-foreground" />
```

### 2.3 Animation Library

**Library**: Tailwind CSS Animate
**Common Animations**:
- `animate-in` / `animate-out`
- `fade-in` / `fade-out`
- `slide-in-from-*` / `slide-out-to-*`
- `zoom-in` / `zoom-out`
- `spin` (loading indicators)

---

## 3. Core UI Components

### 3.1 Button Component

**Location**: `src/components/ui/button.tsx`

**Variants**:
| Variant | Use Case | Appearance |
|---------|----------|------------|
| `default` | Primary actions | Solid primary color |
| `destructive` | Delete, remove | Red/danger color |
| `outline` | Secondary actions | Bordered, transparent |
| `secondary` | Tertiary actions | Muted background |
| `ghost` | Subtle actions | No background |
| `link` | Navigation | Underlined text |

**Sizes**:
| Size | Dimensions | Use Case |
|------|------------|----------|
| `default` | h-10 px-4 py-2 | Standard buttons |
| `sm` | h-9 px-3 | Compact spaces |
| `lg` | h-11 px-8 | Hero/CTA buttons |
| `icon` | h-10 w-10 | Icon-only buttons |

**Implementation**:
```tsx
import { Button } from '@/components/ui/button';

// Primary action
<Button variant="default">Save Changes</Button>

// Destructive action
<Button variant="destructive">Delete BOM</Button>

// Icon button
<Button variant="ghost" size="icon">
  <Settings className="h-4 w-4" />
</Button>
```

### 3.2 Card Component

**Location**: `src/components/ui/card.tsx`

**Sub-components**:
- `Card` - Container
- `CardHeader` - Header section
- `CardTitle` - Title text
- `CardDescription` - Subtitle/description
- `CardContent` - Main content area
- `CardFooter` - Footer with actions

**Usage**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>BOM Summary</CardTitle>
    <CardDescription>Overview of your bill of materials</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>
```

### 3.3 Badge Component

**Location**: `src/components/ui/badge.tsx`

**Variants**:
| Variant | Use Case | Color |
|---------|----------|-------|
| `default` | Standard labels | Primary |
| `secondary` | Muted labels | Gray |
| `destructive` | Errors, warnings | Red |
| `outline` | Subtle labels | Bordered |

**Status Badges** (Custom):
```tsx
// BOM Status badges
<Badge variant="default">Active</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Error</Badge>
<Badge className="bg-yellow-500">Pending</Badge>
<Badge className="bg-green-500">Complete</Badge>
```

### 3.4 Input Component

**Location**: `src/components/ui/input.tsx`

**Features**:
- Focus ring with primary color
- Disabled state styling
- Error state (via wrapper)
- Placeholder styling

**Usage**:
```tsx
<Input
  type="email"
  placeholder="Enter email"
  className="w-full"
/>
```

### 3.5 Select Component

**Location**: `src/components/ui/select.tsx`

**Based on**: Radix UI Select

**Sub-components**:
- `Select` - Root
- `SelectTrigger` - Clickable trigger
- `SelectValue` - Selected value display
- `SelectContent` - Dropdown content
- `SelectItem` - Individual option
- `SelectGroup` - Option grouping
- `SelectLabel` - Group label

### 3.6 Dialog Component

**Location**: `src/components/ui/dialog.tsx`

**Based on**: Radix UI Dialog

**Features**:
- Modal overlay with backdrop blur
- Keyboard navigation (Escape to close)
- Focus trapping
- Animated entrance/exit

**Sub-components**:
- `Dialog` - Root provider
- `DialogTrigger` - Open trigger
- `DialogContent` - Modal content
- `DialogHeader` - Header section
- `DialogTitle` - Accessible title
- `DialogDescription` - Description text
- `DialogFooter` - Action buttons

### 3.7 Dropdown Menu Component

**Location**: `src/components/ui/dropdown-menu.tsx`

**Based on**: Radix UI DropdownMenu

**Features**:
- Keyboard navigation
- Sub-menus support
- Checkable items
- Radio groups
- Separators

### 3.8 Table Component

**Location**: `src/components/ui/table.tsx`

**Sub-components**:
- `Table` - Container
- `TableHeader` - Header row container
- `TableBody` - Body rows container
- `TableFooter` - Footer row container
- `TableRow` - Individual row
- `TableHead` - Header cell
- `TableCell` - Body cell
- `TableCaption` - Table caption

### 3.9 Tabs Component

**Location**: `src/components/ui/tabs.tsx`

**Based on**: Radix UI Tabs

**Sub-components**:
- `Tabs` - Root container
- `TabsList` - Tab buttons container
- `TabsTrigger` - Individual tab button
- `TabsContent` - Tab panel content

### 3.10 Tooltip Component

**Location**: `src/components/ui/tooltip.tsx`

**Based on**: Radix UI Tooltip

**Features**:
- Delay on show (prevent flicker)
- Multiple placement options
- Arrow indicator

### 3.11 Additional Core Components

| Component | File | Purpose |
|-----------|------|---------|
| `Alert` | `alert.tsx` | Status messages |
| `Avatar` | `avatar.tsx` | User avatars |
| `Checkbox` | `checkbox.tsx` | Boolean inputs |
| `Label` | `label.tsx` | Form labels |
| `Progress` | `progress.tsx` | Progress bars |
| `Separator` | `separator.tsx` | Visual dividers |
| `Sheet` | `sheet.tsx` | Side panels |
| `Skeleton` | `skeleton.tsx` | Loading placeholders |
| `Switch` | `switch.tsx` | Toggle switches |
| `Textarea` | `textarea.tsx` | Multi-line input |

---

## 4. Feature Components

### 4.1 Authentication Components

**Location**: `src/components/auth/`

| Component | Purpose |
|-----------|---------|
| `LoginForm` | Keycloak login redirect |
| `LogoutButton` | Session termination |
| `ProtectedRoute` | Route guard wrapper |
| `RoleGuard` | Role-based access control |

### 4.2 BOM Components

**Location**: `src/components/bom/`

| Component | Purpose |
|-----------|---------|
| `BomList` | Table of all BOMs |
| `BomCard` | BOM summary card |
| `BomUpload` | CSV/Excel upload |
| `BomLineItems` | Line item table |
| `EnrichmentStatus` | Enrichment progress |
| `BomActions` | Action buttons |

### 4.3 Component Catalog Components

**Location**: `src/components/catalog/`

| Component | Purpose |
|-----------|---------|
| `ComponentSearch` | Search interface |
| `ComponentCard` | Component details card |
| `ComponentTable` | Tabular listing |
| `ComponentFilters` | Filter sidebar |
| `ComponentCompare` | Side-by-side comparison |

### 4.4 Team Components

**Location**: `src/components/team/`

| Component | Purpose |
|-----------|---------|
| `TeamList` | Team member table |
| `InviteForm` | User invitation form |
| `RoleSelector` | Role dropdown |
| `MemberCard` | Member details card |

### 4.5 Billing Components

**Location**: `src/components/billing/`

| Component | Purpose |
|-----------|---------|
| `PlanCard` | Subscription plan card |
| `UsageChart` | Usage metrics chart |
| `InvoiceList` | Invoice history |
| `PaymentMethod` | Payment details |
| `UpgradeModal` | Plan upgrade dialog |

### 4.6 Notification Components

**Location**: `src/components/notifications/`

| Component | Purpose |
|-----------|---------|
| `NotificationCenter` | Bell icon dropdown |
| `NotificationItem` | Individual notification |
| `NotificationBadge` | Unread count badge |

### 4.7 Settings Components

**Location**: `src/components/settings/`

| Component | Purpose |
|-----------|---------|
| `ProfileForm` | User profile editor |
| `SecuritySettings` | Password, 2FA |
| `NotificationPrefs` | Email preferences |
| `ApiKeys` | API key management |

---

## 5. Layout Components

### 5.1 Main Layout

**Location**: `src/components/layout/Layout.tsx`

**Structure**:
```
+-------------------------------------------------------------+
| Header (fixed)                                              |
| +-------------+---------------------------------------------+
| |             |                                             |
| |  Sidebar    |           Main Content                      |
| |  (fixed)    |           (scrollable)                      |
| |             |                                             |
| |             |                                             |
| |             |                                             |
| +-------------+---------------------------------------------+
+-------------------------------------------------------------+
```

**Sub-components**:
- `Header` - Top navigation bar
- `Sidebar` - Left navigation
- `MainContent` - Page content area
- `Footer` - Optional footer

### 5.2 Header Component

**Features**:
- Logo/branding
- Global search
- Notification center
- Theme selector
- Tenant selector (multi-tenant)
- User menu

### 5.3 Sidebar Component

**Features**:
- Collapsible navigation
- Role-based menu items
- Active state indicators
- Nested menu support
- Quick actions

### 5.4 Page Components

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Page title, breadcrumbs, actions |
| `PageContent` | Main page body |
| `PageSection` | Content sections |
| `PageActions` | Floating action buttons |

---

## 6. Form Components

### 6.1 Form Patterns

**Library**: React Hook Form + Zod

**Pattern**:
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}
```

### 6.2 Form Components

| Component | Purpose |
|-----------|---------|
| `Form` | Form context provider |
| `FormField` | Field wrapper |
| `FormItem` | Field container |
| `FormLabel` | Field label |
| `FormControl` | Input wrapper |
| `FormDescription` | Help text |
| `FormMessage` | Error message |

### 6.3 File Upload Components

| Component | Purpose |
|-----------|---------|
| `FileDropzone` | Drag-and-drop area |
| `FileInput` | Traditional file input |
| `FilePreview` | File preview display |
| `UploadProgress` | Upload progress bar |

---

## 7. Data Display Components

### 7.1 Data Table

**Library**: TanStack Table (React Table v8)

**Features**:
- Sorting (single/multi-column)
- Filtering (global/column)
- Pagination
- Row selection
- Column visibility toggle
- Resizable columns

**Pattern**:
```tsx
import { useTable } from '@tanstack/react-table';

const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status', cell: StatusBadge },
  { accessorKey: 'actions', header: '', cell: ActionButtons },
];

<DataTable columns={columns} data={boms} />
```

### 7.2 Charts

**Library**: Recharts (or similar)

**Chart Types**:
- Line charts (trends)
- Bar charts (comparisons)
- Pie/Donut charts (distributions)
- Area charts (cumulative data)

### 7.3 Stats Cards

**Pattern**:
```tsx
<StatsCard
  title="Total BOMs"
  value="1,234"
  change="+12%"
  trend="up"
  icon={<FileText />}
/>
```

### 7.4 Empty States

**Pattern**:
```tsx
<EmptyState
  icon={<FileText />}
  title="No BOMs yet"
  description="Upload your first BOM to get started"
  action={<Button>Upload BOM</Button>}
/>
```

---

## 8. Feedback Components

### 8.1 Loading States

| Component | Use Case |
|-----------|----------|
| `Spinner` | Inline loading |
| `Skeleton` | Content placeholder |
| `PageLoader` | Full page loading |
| `ButtonLoader` | Button loading state |

**Skeleton Pattern**:
```tsx
// Loading state
<Skeleton className="h-4 w-[250px]" />
<Skeleton className="h-4 w-[200px]" />

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-[180px]" />
    <Skeleton className="h-4 w-[240px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-32 w-full" />
  </CardContent>
</Card>
```

### 8.2 Toast Notifications

**Library**: Sonner (or similar)

**Types**:
- `success` - Green, checkmark
- `error` - Red, X icon
- `warning` - Yellow, warning icon
- `info` - Blue, info icon

**Usage**:
```tsx
import { toast } from 'sonner';

toast.success('BOM uploaded successfully');
toast.error('Failed to upload BOM');
toast.warning('File size exceeds limit');
toast.info('Processing in background');
```

### 8.3 Alert Banners

**Variants**:
- `default` - Informational
- `destructive` - Error/warning
- `success` - Success confirmation

**Usage**:
```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Your session has expired. Please log in again.
  </AlertDescription>
</Alert>
```

### 8.4 Confirmation Dialogs

**Pattern**:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 9. Design Patterns

### 9.1 Layout Patterns

**Page Layout**:
```tsx
<div className="container mx-auto py-6 space-y-6">
  <PageHeader title="BOMs" />
  <PageContent>
    {/* Content */}
  </PageContent>
</div>
```

**Card Grid**:
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => <ItemCard key={item.id} {...item} />)}
</div>
```

**Split View**:
```tsx
<div className="flex gap-6">
  <aside className="w-64 shrink-0">
    {/* Sidebar/filters */}
  </aside>
  <main className="flex-1">
    {/* Main content */}
  </main>
</div>
```

### 9.2 Form Patterns

**Inline Form**:
```tsx
<form className="flex items-center gap-2">
  <Input placeholder="Search..." />
  <Button type="submit">Search</Button>
</form>
```

**Stacked Form**:
```tsx
<form className="space-y-4">
  <FormField>
    <FormLabel>Name</FormLabel>
    <Input />
  </FormField>
  <FormField>
    <FormLabel>Email</FormLabel>
    <Input type="email" />
  </FormField>
  <Button type="submit">Submit</Button>
</form>
```

### 9.3 Loading Patterns

**Button Loading**:
```tsx
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

**Async Data**:
```tsx
{isLoading && <Skeleton className="h-32" />}
{error && <Alert variant="destructive">{error.message}</Alert>}
{data && <DataDisplay data={data} />}
```

### 9.4 Empty State Patterns

**No Data**:
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold">No BOMs found</h3>
  <p className="text-muted-foreground mb-4">
    Get started by uploading your first BOM.
  </p>
  <Button>
    <Plus className="mr-2 h-4 w-4" />
    Upload BOM
  </Button>
</div>
```

### 9.5 Responsive Patterns

**Breakpoints**:
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

**Responsive Grid**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Items */}
</div>
```

**Responsive Sidebar**:
```tsx
// Mobile: Sheet/drawer
// Desktop: Fixed sidebar
<Sheet open={isMobile && sidebarOpen}>
  <Navigation />
</Sheet>
<aside className="hidden lg:block w-64">
  <Navigation />
</aside>
```

---

## 10. Accessibility Guidelines

### 10.1 Keyboard Navigation

**Requirements**:
- All interactive elements focusable via Tab
- Visible focus indicators
- Escape closes modals/dropdowns
- Arrow keys for menu navigation
- Enter/Space for activation

### 10.2 Screen Reader Support

**ARIA Labels**:
```tsx
// Buttons with icons only
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// Form fields
<Label htmlFor="email">Email</Label>
<Input id="email" aria-describedby="email-help" />
<p id="email-help" className="text-sm text-muted-foreground">
  We'll never share your email.
</p>
```

### 10.3 Color Contrast

**Requirements**:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

**Implementation**:
- Use semantic color tokens (`foreground`, `muted-foreground`)
- Test with color blindness simulators
- Don't rely solely on color for meaning

### 10.4 Motion Preferences

```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Component Usage Examples

### 11.1 BOM List Page

```tsx
function BomListPage() {
  const { data: boms, isLoading } = useList({ resource: 'boms' });

  return (
    <div className="container py-6 space-y-6">
      <PageHeader title="Bills of Materials">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Upload BOM
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : boms?.data.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No BOMs yet"
          description="Upload your first BOM to get started"
          action={<Button>Upload BOM</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boms?.data.map(bom => (
            <BomCard key={bom.id} bom={bom} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 11.2 Settings Form

```tsx
function ProfileSettingsForm() {
  const form = useForm({
    resolver: zodResolver(profileSchema),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>
                    This email is used for notifications
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button type="submit">Save Changes</Button>
      </CardFooter>
    </Card>
  );
}
```

### 11.3 Data Table with Actions

```tsx
const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Last Updated',
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleView(row.original)}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleEdit(row.original)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => handleDelete(row.original)}
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
```

---

## Appendix A: Component File Structure

```
src/components/
|-- ui/                    # Core shadcn/ui components
|   |-- button.tsx
|   |-- card.tsx
|   |-- dialog.tsx
|   |-- dropdown-menu.tsx
|   |-- input.tsx
|   |-- select.tsx
|   |-- table.tsx
|   |-- tabs.tsx
|   +-- ...
|-- layout/                # Layout components
|   |-- Layout.tsx
|   |-- Header.tsx
|   |-- Sidebar.tsx
|   +-- Footer.tsx
|-- auth/                  # Authentication components
|-- bom/                   # BOM-related components
|-- catalog/               # Component catalog
|-- team/                  # Team management
|-- billing/               # Billing components
|-- settings/              # Settings components
+-- shared/                # Shared/common components
    |-- EmptyState.tsx
    |-- PageHeader.tsx
    |-- DataTable.tsx
    +-- ...
```

---

## Appendix B: CSS Class Utilities

### Spacing Utilities
```css
/* Padding */
p-{0-12}    /* All sides */
px-{0-12}   /* Horizontal */
py-{0-12}   /* Vertical */
pt/pr/pb/pl /* Individual sides */

/* Margin */
m-{0-12}    /* All sides */
mx-{0-12}   /* Horizontal */
my-{0-12}   /* Vertical */
mt/mr/mb/ml /* Individual sides */

/* Gap (Flexbox/Grid) */
gap-{0-12}  /* All */
gap-x/gap-y /* Axis-specific */
```

### Display Utilities
```css
hidden / block / inline / inline-block
flex / inline-flex / grid / inline-grid
```

### Flexbox Utilities
```css
flex-row / flex-col
items-start / items-center / items-end
justify-start / justify-center / justify-end / justify-between
flex-1 / flex-auto / flex-none
shrink-0 / grow
```

### Typography Utilities
```css
text-xs / text-sm / text-base / text-lg / text-xl
font-normal / font-medium / font-semibold / font-bold
text-left / text-center / text-right
truncate / line-clamp-{1-6}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-14
**Maintainer**: Platform Team
