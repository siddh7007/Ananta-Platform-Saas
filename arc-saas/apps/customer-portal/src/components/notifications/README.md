# Novu Notification Center Integration

This directory contains the Novu notification center integration for the Customer Portal.

## Installation

The Novu React SDK is installed:

```bash
cd arc-saas/apps/customer-portal
npm install @novu/react
# or
bun add @novu/react
```

> **Note:** We use the new `@novu/react` SDK (v3.x) which provides the `<Inbox />` component.

## Configuration

Add the following environment variables to your `.env` file (already added to `.env.example`):

```env
VITE_NOVU_APP_IDENTIFIER=6931905380e6f7e26e0ddaad
VITE_NOVU_API_URL=http://localhost:13100
```

## Components

### NotificationCenter

The main wrapper component that integrates Novu's `<Inbox />` notification center.

- Uses the authenticated user's ID as the subscriber ID
- Automatically hides when user is not authenticated
- Displays a bell icon with unread count badge
- Styled to match the Tailwind theme using CSS variables

### NotificationBell

A standalone bell icon component with badge for unread count.

- Can be used independently or as part of NotificationCenter
- Includes accessible aria labels
- Styled to match the existing Tailwind/Radix theme

### ConfiguredNotificationCenter

A pre-configured version that reads environment variables automatically.

## Usage

The notification center is already integrated into the Layout component's header. It will:

1. Show a bell icon in the header
2. Display a badge with unread count when there are unseen notifications
3. Open a popover when clicked to show notification list
4. Automatically fetch notifications and user preferences
5. Support real-time updates via WebSocket

## Available Triggers

The following notification triggers are configured in Novu:

- `user-invitation` - When a user is invited to join a team
- `tenant-welcome` - Welcome message for new tenants
- `payment-failed` - Payment failure alerts
- `subscription-created` - Subscription creation confirmation
- `trial-ending-soon` - Trial period ending reminder

## Testing

Once the package is installed and Novu is running:

1. Ensure Novu API is running at `http://localhost:13100`
2. Log in to the customer portal
3. The bell icon should appear in the header
4. Send a test notification through Novu dashboard (http://localhost:14200)
5. The bell icon should show the unread count badge

## Architecture

```
Layout (header)
  └── NotificationCenter
      └── Inbox (@novu/react)
          ├── Bell icon with badge
          └── Popover notification list
```

The integration uses:
- Novu's built-in `<Inbox />` component from `@novu/react`
- Theme customization via `appearance` prop
- User ID from `AuthContext` as the subscriber ID
- Environment variables for configuration

## Styling

The component uses CSS variables that match the shadcn/ui theme:

```typescript
appearance={{
  variables: {
    colorPrimary: 'hsl(var(--primary))',
    colorBackground: 'hsl(var(--background))',
    colorForeground: 'hsl(var(--foreground))',
    colorSecondary: 'hsl(var(--muted))',
    borderRadius: '8px',
  },
}}
```
