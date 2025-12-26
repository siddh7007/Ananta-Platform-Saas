# CBP Refine Implementation Prompts

**Version:** 1.0
**Date:** December 15, 2025
**Total Prompts:** 38
**Implementation Timeline:** 16 Weeks (4 Phases)

---

## Document Overview

This document contains 38 detailed, actionable implementation prompts for the Customer BOM Portal (CBP) UI/UX improvement initiative. Each prompt is designed to be self-contained and can be executed independently by a developer or AI assistant.

### Prompt Structure
Each prompt includes:
- **ID**: Unique identifier (CBP-P{phase}-{number})
- **Title**: Descriptive name
- **Priority**: Critical / High / Medium
- **Estimated Effort**: Time estimate
- **Dependencies**: Required prerequisites
- **Acceptance Criteria**: Definition of done
- **Technical Specifications**: Implementation details
- **Testing Requirements**: Verification steps

### Phase Summary

| Phase | Weeks | Focus Area | Prompts | Priority |
|-------|-------|------------|---------|----------|
| 1 | 1-4 | Critical UX & Security Foundations | 10 | Critical |
| 2 | 5-8 | Role-Based Features & Search | 10 | High |
| 3 | 9-12 | Mobile/Tablet & Performance | 10 | High |
| 4 | 13-16 | Polish & Excellence | 8 | Medium |

---

# Phase 1: Critical UX & Security Foundations (Weeks 1-4)

## CBP-P1-001: Form Label Association & ARIA Roles

**Priority:** Critical
**Estimated Effort:** 2-3 days
**Dependencies:** None
**Category:** Accessibility (WCAG 2.1 AA)

### Objective
Implement proper form label associations and ARIA roles across all CBP forms to achieve WCAG 2.1 AA compliance and improve screen reader accessibility.

### Technical Specifications

#### 1. Audit Current Forms
Identify all form components in these locations:
```
src/components/bom/BomUploadForm.tsx
src/components/auth/LoginForm.tsx
src/components/settings/ProfileForm.tsx
src/components/team/InviteUserForm.tsx
src/pages/*/components/*Form.tsx
```

#### 2. Implementation Pattern
```tsx
// BEFORE (Inaccessible)
<div className="form-group">
  <span className="label">Email</span>
  <input type="email" placeholder="Enter email" />
</div>

// AFTER (Accessible)
<div className="form-group">
  <Label htmlFor="email-input" className="text-sm font-medium">
    Email
    <span className="text-destructive ml-1" aria-hidden="true">*</span>
  </Label>
  <Input
    id="email-input"
    type="email"
    aria-required="true"
    aria-describedby="email-hint email-error"
    aria-invalid={!!errors.email}
    placeholder="Enter email"
  />
  <p id="email-hint" className="text-xs text-muted-foreground mt-1">
    We'll never share your email
  </p>
  {errors.email && (
    <p id="email-error" role="alert" className="text-xs text-destructive mt-1">
      {errors.email.message}
    </p>
  )}
</div>
```

#### 3. Create Accessible Form Component Library
```tsx
// src/components/ui/accessible-form.tsx
import { forwardRef, useId } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AccessibleFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function AccessibleField({
  label,
  required,
  hint,
  error,
  children,
}: AccessibleFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
      </Label>
      {React.cloneElement(children as React.ReactElement, {
        id,
        'aria-required': required,
        'aria-describedby': describedBy,
        'aria-invalid': !!error,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

#### 4. ARIA Landmarks for Form Sections
```tsx
<form aria-labelledby="form-title" role="form">
  <h2 id="form-title" className="text-lg font-semibold">
    Upload BOM
  </h2>

  <fieldset>
    <legend className="text-sm font-medium mb-4">File Information</legend>
    {/* File input fields */}
  </fieldset>

  <fieldset>
    <legend className="text-sm font-medium mb-4">BOM Details</legend>
    {/* BOM metadata fields */}
  </fieldset>
</form>
```

### Files to Modify
1. `src/components/ui/accessible-form.tsx` (create)
2. `src/components/bom/BomUploadForm.tsx`
3. `src/components/auth/LoginForm.tsx`
4. `src/components/settings/ProfileForm.tsx`
5. `src/components/team/InviteUserForm.tsx`
6. All form components in `src/pages/`

### Acceptance Criteria
- [ ] All form inputs have associated `<label>` elements with `htmlFor`
- [ ] Required fields marked with `aria-required="true"`
- [ ] Error messages linked via `aria-describedby`
- [ ] Form groups use `<fieldset>` and `<legend>` appropriately
- [ ] All forms pass axe-core automated testing
- [ ] Screen reader testing confirms all labels announced correctly
- [ ] No duplicate IDs in DOM

### Testing Requirements
```bash
# Run accessibility audit
npm run test:a11y

# Manual testing checklist
- [ ] Test with NVDA on Windows
- [ ] Test with VoiceOver on macOS
- [ ] Verify tab order is logical
- [ ] Confirm error messages announced on validation
```

---

## CBP-P1-002: Status Indicators with Icons & Color-Blind Safe Palette

**Priority:** Critical
**Estimated Effort:** 2 days
**Dependencies:** None
**Category:** Accessibility, Visual Design

### Objective
Replace color-only status indicators with icon+color combinations and implement a color-blind safe palette to ensure status information is accessible to all users.

### Technical Specifications

#### 1. Color-Blind Safe Status Palette
```tsx
// src/lib/status-colors.ts
export const STATUS_CONFIG = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Success',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
    label: 'Warning',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: XCircle,
    label: 'Error',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    icon: Info,
    label: 'Information',
  },
  pending: {
    bg: 'bg-slate-50 dark:bg-slate-950',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    icon: Clock,
    label: 'Pending',
  },
  processing: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    icon: Loader2,
    label: 'Processing',
    animate: true,
  },
} as const;
```

#### 2. StatusBadge Component
```tsx
// src/components/ui/status-badge.tsx
import { cn } from '@/lib/utils';
import { STATUS_CONFIG } from '@/lib/status-colors';

type StatusType = keyof typeof STATUS_CONFIG;

interface StatusBadgeProps {
  status: StatusType;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({
  status,
  showLabel = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bg,
        config.border,
        config.text,
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <Icon
        className={cn(
          iconSizes[size],
          config.animate && 'animate-spin'
        )}
        aria-hidden="true"
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
```

#### 3. BOM Status Mapping
```tsx
// src/lib/bom-status.ts
export const BOM_STATUS_MAP: Record<string, StatusType> = {
  draft: 'pending',
  uploading: 'processing',
  processing: 'processing',
  enriching: 'processing',
  completed: 'success',
  partial: 'warning',
  failed: 'error',
  cancelled: 'error',
};

export function getBomStatusConfig(status: string) {
  return STATUS_CONFIG[BOM_STATUS_MAP[status] || 'pending'];
}
```

#### 4. Update BOM List Table
```tsx
// In BomListTable.tsx
import { StatusBadge } from '@/components/ui/status-badge';
import { BOM_STATUS_MAP } from '@/lib/bom-status';

// Replace color-only status
<StatusBadge status={BOM_STATUS_MAP[record.status]} />
```

### Files to Create/Modify
1. `src/lib/status-colors.ts` (create)
2. `src/components/ui/status-badge.tsx` (create)
3. `src/lib/bom-status.ts` (create)
4. `src/pages/boms/list.tsx`
5. `src/components/bom/BomStatusCell.tsx`
6. `src/components/enrichment/EnrichmentProgress.tsx`

### Acceptance Criteria
- [ ] All status indicators include icons alongside colors
- [ ] Color palette passes WCAG contrast requirements (4.5:1 for text)
- [ ] Status is understandable in grayscale (simulate with browser)
- [ ] Screen readers announce status label via `aria-label`
- [ ] Processing states show animated spinner icon
- [ ] Dark mode support with appropriate color adjustments

### Testing Requirements
```bash
# Color contrast testing
npx wcag-contrast-checker src/lib/status-colors.ts

# Visual regression test
npm run test:visual -- --filter=StatusBadge

# Grayscale simulation test (manual)
# Chrome DevTools > Rendering > Emulate vision deficiencies > Achromatopsia
```

---

## CBP-P1-003: Keyboard Navigation & Focus Management

**Priority:** Critical
**Estimated Effort:** 3-4 days
**Dependencies:** CBP-P1-001
**Category:** Accessibility

### Objective
Implement comprehensive keyboard navigation with visible focus indicators, skip links, and focus trapping for modals to ensure full keyboard accessibility.

### Technical Specifications

#### 1. Global Focus Styles
```css
/* src/styles/focus.css */
/* Enhanced focus ring for all interactive elements */
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove default outline only when focus-visible applies */
:focus:not(:focus-visible) {
  outline: none;
}

/* High contrast focus for dark backgrounds */
.dark :focus-visible {
  outline-color: hsl(var(--ring));
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
}

/* Skip link styles */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  z-index: 100;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
```

#### 2. Skip Links Component
```tsx
// src/components/layout/SkipLinks.tsx
export function SkipLinks() {
  return (
    <div className="skip-links">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <a href="#main-navigation" className="skip-link">
        Skip to navigation
      </a>
      <a href="#search" className="skip-link">
        Skip to search
      </a>
    </div>
  );
}
```

#### 3. Focus Trap Hook for Modals
```tsx
// src/hooks/useFocusTrap.ts
import { useEffect, useRef, useCallback } from 'react';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector)
    );
  }, []);

  useEffect(() => {
    if (!isActive) return;

    previousFocus.current = document.activeElement as HTMLElement;

    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [isActive, getFocusableElements]);

  return containerRef;
}
```

#### 4. Keyboard Shortcuts Manager
```tsx
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement).tagName
      )) {
        return;
      }

      for (const shortcut of shortcuts) {
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const matchesCtrl = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        const matchesShift = !!shortcut.shift === e.shiftKey;
        const matchesAlt = !!shortcut.alt === e.altKey;

        if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Global shortcuts
export const GLOBAL_SHORTCUTS: Shortcut[] = [
  { key: '/', action: () => document.getElementById('search')?.focus(), description: 'Focus search' },
  { key: 'n', ctrl: true, action: () => {/* navigate to new BOM */}, description: 'New BOM' },
  { key: 'h', ctrl: true, action: () => {/* navigate home */}, description: 'Go to dashboard' },
  { key: '?', shift: true, action: () => {/* show shortcuts modal */}, description: 'Show shortcuts' },
];
```

#### 5. Update Dialog Component
```tsx
// src/components/ui/dialog.tsx (enhance existing)
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function DialogContent({ children, ...props }) {
  const trapRef = useFocusTrap(true);

  return (
    <DialogPrimitive.Content
      ref={trapRef}
      onOpenAutoFocus={(e) => {
        // Focus first focusable element
        e.preventDefault();
        const firstFocusable = trapRef.current?.querySelector<HTMLElement>(
          'button, input, select, textarea, a[href]'
        );
        firstFocusable?.focus();
      }}
      onCloseAutoFocus={(e) => {
        // Return focus to trigger
        e.preventDefault();
      }}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  );
}
```

### Files to Create/Modify
1. `src/styles/focus.css` (create)
2. `src/components/layout/SkipLinks.tsx` (create)
3. `src/hooks/useFocusTrap.ts` (create)
4. `src/hooks/useKeyboardShortcuts.ts` (create)
5. `src/components/ui/dialog.tsx` (modify)
6. `src/components/layout/Layout.tsx` (add skip links)
7. `src/App.tsx` (import focus styles)

### Acceptance Criteria
- [ ] All interactive elements have visible focus indicators
- [ ] Skip links appear on Tab and navigate correctly
- [ ] Modal dialogs trap focus until closed
- [ ] Focus returns to trigger element after modal close
- [ ] Keyboard shortcuts work globally (/, Ctrl+N, Ctrl+H, Shift+?)
- [ ] Tab order follows visual reading order
- [ ] Escape key closes modals and dropdowns

### Testing Requirements
```bash
# Keyboard-only navigation test
# Unplug mouse and navigate entire app with keyboard

# Automated testing
npm run test:a11y -- --keyboard-only

# Focus order verification
npm run test:e2e -- --spec=keyboard-navigation.spec.ts
```

---

## CBP-P1-004: Remove Unsafe-Inline from Content Security Policy

**Priority:** Critical
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Category:** Security

### Objective
Eliminate `unsafe-inline` from the Content Security Policy by implementing nonce-based script execution and extracting all inline styles to CSS modules, achieving a strict CSP without breaking functionality.

### Technical Specifications

#### 1. Vite Plugin for CSP Nonces
```ts
// vite-plugins/csp-nonce.ts
import { Plugin } from 'vite';
import crypto from 'crypto';

export function cspNoncePlugin(): Plugin {
  return {
    name: 'csp-nonce',
    transformIndexHtml: {
      enforce: 'post',
      transform(html, ctx) {
        const nonce = crypto.randomBytes(16).toString('base64');

        // Add nonce to all script tags
        html = html.replace(
          /<script/g,
          `<script nonce="${nonce}"`
        );

        // Add CSP meta tag with nonce
        const csp = [
          "default-src 'self'",
          `script-src 'self' 'nonce-${nonce}'`,
          "style-src 'self' 'unsafe-inline'", // Will be fixed in style extraction
          "img-src 'self' data: https:",
          "font-src 'self'",
          "connect-src 'self' https://api.* wss://*",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');

        html = html.replace(
          '</head>',
          `<meta http-equiv="Content-Security-Policy" content="${csp}">\n</head>`
        );

        return html;
      },
    },
  };
}
```

#### 2. Extract Inline Styles to CSS Modules
```tsx
// BEFORE: Inline styles
<div style={{ backgroundColor: status === 'active' ? 'green' : 'red' }}>
  {content}
</div>

// AFTER: CSS classes with data attributes
// styles/status.module.css
.statusIndicator {
  &[data-status="active"] {
    background-color: var(--color-success);
  }
  &[data-status="inactive"] {
    background-color: var(--color-error);
  }
}

// Component
import styles from './status.module.css';

<div className={styles.statusIndicator} data-status={status}>
  {content}
</div>
```

#### 3. Tailwind Configuration for Dynamic Classes
```ts
// tailwind.config.ts
export default {
  safelist: [
    // Safelist dynamic classes that can't be detected at build time
    { pattern: /bg-(red|green|blue|yellow|gray)-(50|100|200|500|700)/ },
    { pattern: /text-(red|green|blue|yellow|gray)-(50|100|200|500|700)/ },
    { pattern: /border-(red|green|blue|yellow|gray)-(200|500)/ },
  ],
};
```

#### 4. Replace Dynamic Style Computation
```tsx
// BEFORE: Dynamic inline styles
const getProgressStyle = (percent: number) => ({
  width: `${percent}%`,
  backgroundColor: percent > 80 ? 'green' : percent > 50 ? 'yellow' : 'red',
});

<div style={getProgressStyle(progress)} />

// AFTER: CSS custom properties + classes
// styles/progress.css
.progressBar {
  width: var(--progress-width);
  transition: width 0.3s ease;
}

.progressBar[data-level="high"] { background-color: var(--color-success); }
.progressBar[data-level="medium"] { background-color: var(--color-warning); }
.progressBar[data-level="low"] { background-color: var(--color-error); }

// Component
const getProgressLevel = (percent: number) =>
  percent > 80 ? 'high' : percent > 50 ? 'medium' : 'low';

<div
  className="progressBar"
  data-level={getProgressLevel(progress)}
  style={{ '--progress-width': `${progress}%` } as React.CSSProperties}
/>
```

#### 5. CSP Violation Reporting
```ts
// src/lib/csp-reporter.ts
export function setupCSPReporting() {
  document.addEventListener('securitypolicyviolation', (e) => {
    const violation = {
      blockedURI: e.blockedURI,
      violatedDirective: e.violatedDirective,
      originalPolicy: e.originalPolicy,
      sourceFile: e.sourceFile,
      lineNumber: e.lineNumber,
      columnNumber: e.columnNumber,
    };

    // Send to monitoring endpoint
    fetch('/api/csp-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(violation),
    }).catch(() => {
      // Silently fail if reporting endpoint is down
      console.warn('CSP violation:', violation);
    });
  });
}
```

#### 6. Nginx CSP Headers (Production)
```nginx
# nginx/security-headers.conf
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self';
  style-src 'self';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.ananta.com wss://api.ananta.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  report-uri /api/csp-report;
" always;
```

### Files to Create/Modify
1. `vite-plugins/csp-nonce.ts` (create)
2. `vite.config.ts` (add plugin)
3. `src/lib/csp-reporter.ts` (create)
4. `tailwind.config.ts` (add safelist)
5. All components with inline `style={}` props
6. `nginx/security-headers.conf` (create)
7. `index.html` (remove inline scripts)

### Acceptance Criteria
- [ ] No `unsafe-inline` in script-src directive
- [ ] All scripts load with valid nonce
- [ ] No inline event handlers (onclick, onload, etc.)
- [ ] Dynamic styles use CSS custom properties or data attributes
- [ ] CSP violation reporting captures any violations
- [ ] All functionality works with strict CSP
- [ ] Production nginx config enforces CSP

### Testing Requirements
```bash
# CSP validation
npm run build
npx csp-evaluator --file dist/index.html

# Browser console check (no CSP violations)
# Open DevTools Console, filter by "Content Security Policy"

# E2E tests with strict CSP
CSP_STRICT=true npm run test:e2e
```

---

## CBP-P1-005: Token Revocation on Logout & Cross-Tab Sync

**Priority:** Critical
**Estimated Effort:** 2-3 days
**Dependencies:** None
**Category:** Security

### Objective
Implement secure logout that revokes tokens at the IdP (Keycloak), clears all local storage, and synchronizes logout across browser tabs using BroadcastChannel API.

### Technical Specifications

#### 1. Token Revocation Service
```ts
// src/services/auth/token-revocation.ts
import { authConfig } from '@/config/auth';

export async function revokeTokens(accessToken: string, refreshToken?: string) {
  const revocationEndpoint = `${authConfig.authority}/protocol/openid-connect/revoke`;

  const requests: Promise<Response>[] = [];

  // Revoke access token
  requests.push(
    fetch(revocationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: authConfig.clientId,
        token: accessToken,
        token_type_hint: 'access_token',
      }),
    })
  );

  // Revoke refresh token if present
  if (refreshToken) {
    requests.push(
      fetch(revocationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: authConfig.clientId,
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      })
    );
  }

  await Promise.allSettled(requests);
}
```

#### 2. Cross-Tab Session Sync
```ts
// src/services/auth/session-sync.ts
const CHANNEL_NAME = 'cbp-auth-channel';
const SESSION_STORAGE_KEY = 'cbp-session-id';

type AuthMessage =
  | { type: 'LOGOUT' }
  | { type: 'SESSION_REFRESH'; sessionId: string }
  | { type: 'TOKEN_UPDATED'; timestamp: number };

class SessionSync {
  private channel: BroadcastChannel;
  private sessionId: string;
  private onLogout: () => void;
  private onTokenUpdate: () => void;

  constructor(onLogout: () => void, onTokenUpdate: () => void) {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.sessionId = this.getOrCreateSessionId();
    this.onLogout = onLogout;
    this.onTokenUpdate = onTokenUpdate;

    this.channel.onmessage = this.handleMessage.bind(this);

    // Listen for storage events (fallback for browsers without BroadcastChannel)
    window.addEventListener('storage', this.handleStorageEvent.bind(this));
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  }

  private handleMessage(event: MessageEvent<AuthMessage>) {
    switch (event.data.type) {
      case 'LOGOUT':
        this.onLogout();
        break;
      case 'TOKEN_UPDATED':
        this.onTokenUpdate();
        break;
    }
  }

  private handleStorageEvent(event: StorageEvent) {
    if (event.key === 'cbp-logout-event') {
      this.onLogout();
    }
  }

  broadcastLogout() {
    this.channel.postMessage({ type: 'LOGOUT' });
    // Fallback for browsers without BroadcastChannel
    localStorage.setItem('cbp-logout-event', Date.now().toString());
    localStorage.removeItem('cbp-logout-event');
  }

  broadcastTokenUpdate() {
    this.channel.postMessage({
      type: 'TOKEN_UPDATED',
      timestamp: Date.now()
    });
  }

  destroy() {
    this.channel.close();
    window.removeEventListener('storage', this.handleStorageEvent.bind(this));
  }
}

export const sessionSync = new SessionSync(
  () => window.location.href = '/login?reason=session_ended',
  () => window.location.reload()
);
```

#### 3. Secure Logout Handler
```ts
// src/services/auth/logout.ts
import { revokeTokens } from './token-revocation';
import { sessionSync } from './session-sync';
import { authConfig } from '@/config/auth';

export async function secureLogout(reason?: string) {
  // Get current tokens
  const accessToken = sessionStorage.getItem('access_token');
  const refreshToken = sessionStorage.getItem('refresh_token');

  // Broadcast logout to other tabs first
  sessionSync.broadcastLogout();

  // Revoke tokens at IdP
  if (accessToken) {
    try {
      await revokeTokens(accessToken, refreshToken || undefined);
    } catch (error) {
      console.error('Token revocation failed:', error);
      // Continue with logout even if revocation fails
    }
  }

  // Clear all local storage
  clearAllStorage();

  // Redirect to Keycloak end session endpoint
  const logoutUrl = new URL(
    `${authConfig.authority}/protocol/openid-connect/logout`
  );
  logoutUrl.searchParams.set('client_id', authConfig.clientId);
  logoutUrl.searchParams.set(
    'post_logout_redirect_uri',
    `${window.location.origin}/login${reason ? `?reason=${reason}` : ''}`
  );

  window.location.href = logoutUrl.toString();
}

function clearAllStorage() {
  // Clear session storage
  sessionStorage.clear();

  // Clear specific localStorage items (preserve user preferences)
  const keysToRemove = [
    'access_token',
    'refresh_token',
    'id_token',
    'user_profile',
    'tenant_id',
    'oidc.',
  ];

  for (const key of Object.keys(localStorage)) {
    if (keysToRemove.some(k => key.startsWith(k))) {
      localStorage.removeItem(key);
    }
  }

  // Clear cookies (if any auth cookies exist)
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    if (name.includes('auth') || name.includes('session')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}
```

#### 4. Update Auth Provider
```ts
// src/providers/auth-provider.ts
import { secureLogout } from '@/services/auth/logout';
import { sessionSync } from '@/services/auth/session-sync';

export const authProvider: AuthProvider = {
  logout: async () => {
    await secureLogout();
    return { success: true };
  },

  // ... other methods
};

// Initialize session sync on app load
sessionSync; // Module instantiation starts listening
```

### Files to Create/Modify
1. `src/services/auth/token-revocation.ts` (create)
2. `src/services/auth/session-sync.ts` (create)
3. `src/services/auth/logout.ts` (create)
4. `src/providers/auth-provider.ts` (modify)
5. `src/config/auth.ts` (ensure revocation endpoint configured)

### Acceptance Criteria
- [ ] Logout revokes access token at Keycloak
- [ ] Logout revokes refresh token at Keycloak
- [ ] All local storage cleared on logout
- [ ] All session storage cleared on logout
- [ ] Auth cookies cleared on logout
- [ ] Logout in one tab triggers logout in all tabs
- [ ] User redirected to Keycloak end-session endpoint
- [ ] Post-logout redirect returns to login page

### Testing Requirements
```bash
# Manual testing
1. Login in Tab A
2. Open Tab B (same user)
3. Logout in Tab A
4. Verify Tab B redirects to login

# Verify token revocation
1. Copy access token before logout
2. Logout
3. Try to use token against API - should fail with 401

# E2E test
npm run test:e2e -- --spec=auth/logout.spec.ts
```

---

## CBP-P1-006: Sidebar Navigation Restructure with Role-Based Visibility

**Priority:** High
**Estimated Effort:** 2-3 days
**Dependencies:** CBP-P1-003
**Category:** UX, Navigation

### Objective
Restructure the sidebar navigation to follow role-based hierarchy with clear groupings, collapsible sections, and contextual visibility based on user permissions.

### Technical Specifications

#### 1. Navigation Configuration
```ts
// src/config/navigation.ts
import {
  LayoutDashboard,
  FileSpreadsheet,
  Search,
  Users,
  Settings,
  CreditCard,
  Shield,
  BarChart3,
  Package,
  Bell,
} from 'lucide-react';

export type NavItemRole = 'analyst' | 'engineer' | 'admin' | 'owner' | 'super_admin';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  minRole: NavItemRole;
  children?: NavItem[];
  badge?: () => number | null;
  featureFlag?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const navigationConfig: NavGroup[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/',
        minRole: 'analyst',
      },
    ],
  },
  {
    id: 'bom-management',
    label: 'BOM Management',
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'boms',
        label: 'My BOMs',
        icon: FileSpreadsheet,
        path: '/boms',
        minRole: 'analyst',
        badge: () => usePendingBomsCount(),
      },
      {
        id: 'upload',
        label: 'Upload BOM',
        icon: Upload,
        path: '/boms/upload',
        minRole: 'engineer',
      },
      {
        id: 'portfolio',
        label: 'Portfolio',
        icon: Briefcase,
        path: '/portfolio',
        minRole: 'owner',
      },
    ],
  },
  {
    id: 'components',
    label: 'Components',
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'search',
        label: 'Component Search',
        icon: Search,
        path: '/components/search',
        minRole: 'analyst',
      },
      {
        id: 'catalog',
        label: 'Component Catalog',
        icon: Package,
        path: '/components/catalog',
        minRole: 'engineer',
      },
      {
        id: 'compare',
        label: 'Compare',
        icon: GitCompare,
        path: '/components/compare',
        minRole: 'engineer',
      },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    collapsible: true,
    defaultExpanded: false,
    items: [
      {
        id: 'team',
        label: 'Team Members',
        icon: Users,
        path: '/team',
        minRole: 'admin',
      },
      {
        id: 'billing',
        label: 'Billing',
        icon: CreditCard,
        path: '/billing',
        minRole: 'owner',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        path: '/settings',
        minRole: 'admin',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    collapsible: true,
    defaultExpanded: false,
    items: [
      {
        id: 'audit',
        label: 'Audit Logs',
        icon: Shield,
        path: '/admin/audit',
        minRole: 'admin',
        featureFlag: 'audit_logs',
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        path: '/admin/analytics',
        minRole: 'owner',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        path: '/admin/notifications',
        minRole: 'super_admin',
      },
    ],
  },
];
```

#### 2. Role-Based Navigation Filter
```ts
// src/lib/navigation-utils.ts
import { navigationConfig, NavGroup, NavItem, NavItemRole } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const ROLE_HIERARCHY: Record<NavItemRole, number> = {
  analyst: 1,
  engineer: 2,
  admin: 3,
  owner: 4,
  super_admin: 5,
};

export function hasMinRole(userRole: NavItemRole, requiredRole: NavItemRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function useFilteredNavigation(): NavGroup[] {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();

  const userRole = user?.role || 'analyst';

  return navigationConfig
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Check role
        if (!hasMinRole(userRole, item.minRole)) return false;

        // Check feature flag
        if (item.featureFlag && !isEnabled(item.featureFlag)) return false;

        // Filter children recursively
        if (item.children) {
          item.children = item.children.filter(child =>
            hasMinRole(userRole, child.minRole) &&
            (!child.featureFlag || isEnabled(child.featureFlag))
          );
        }

        return true;
      }),
    }))
    .filter(group => group.items.length > 0);
}
```

#### 3. Sidebar Component
```tsx
// src/components/layout/Sidebar.tsx
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFilteredNavigation } from '@/lib/navigation-utils';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function Sidebar() {
  const navigation = useFilteredNavigation();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(navigation.filter(g => g.defaultExpanded).map(g => g.id))
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <nav
      id="main-navigation"
      aria-label="Main navigation"
      className="w-64 bg-card border-r h-full overflow-y-auto"
    >
      <div className="p-4 space-y-6">
        {navigation.map(group => (
          <div key={group.id} className="space-y-1">
            {group.collapsible ? (
              <Collapsible
                open={expandedGroups.has(group.id)}
                onOpenChange={() => toggleGroup(group.id)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                  {group.label}
                  {expandedGroups.has(group.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {group.items.map(item => (
                    <NavLink key={item.id} item={item} isActive={location.pathname === item.path} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map(item => (
                  <NavLink key={item.id} item={item} isActive={location.pathname === item.path} />
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  const badgeCount = item.badge?.();

  return (
    <Link
      to={item.path || '#'}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {badgeCount != null && badgeCount > 0 && (
        <Badge variant="secondary" className="ml-auto">
          {badgeCount > 99 ? '99+' : badgeCount}
        </Badge>
      )}
    </Link>
  );
}
```

### Files to Create/Modify
1. `src/config/navigation.ts` (create/update)
2. `src/lib/navigation-utils.ts` (create)
3. `src/components/layout/Sidebar.tsx` (create/replace)
4. `src/hooks/useFeatureFlags.ts` (create if not exists)

### Acceptance Criteria
- [ ] Navigation grouped by functional area
- [ ] Collapsible sections for organization and admin
- [ ] Active page highlighted with aria-current
- [ ] Badge counts for pending items
- [ ] Role-based filtering hides unauthorized items
- [ ] Feature flags can hide specific nav items
- [ ] Keyboard navigable with arrow keys
- [ ] Screen reader announces navigation structure

### Testing Requirements
```bash
# Role visibility test matrix
| Role         | Dashboard | Upload | Portfolio | Billing | Audit |
|--------------|-----------|--------|-----------|---------|-------|
| analyst      | Yes       | No     | No        | No      | No    |
| engineer     | Yes       | Yes    | No        | No      | No    |
| admin        | Yes       | Yes    | No        | No      | Yes   |
| owner        | Yes       | Yes    | Yes       | Yes     | Yes   |
| super_admin  | Yes       | Yes    | Yes       | Yes     | Yes   |

# E2E test
npm run test:e2e -- --spec=navigation/sidebar.spec.ts
```

---

## CBP-P1-007: BOM Upload with AI-Assisted Column Mapping

**Priority:** High
**Estimated Effort:** 4-5 days
**Dependencies:** None
**Category:** UX, AI Enhancement

### Objective
Implement intelligent column mapping during BOM upload that uses pattern recognition and AI suggestions to automatically detect and map spreadsheet columns to system fields, reducing manual configuration time by 80%.

### Technical Specifications

#### 1. Column Detection Service
```ts
// src/services/bom/column-detector.ts
export interface ColumnMapping {
  sourceColumn: string;
  targetField: BomField;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'pattern' | 'ai';
}

export interface BomField {
  id: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date';
  aliases: string[];
  patterns?: RegExp[];
}

export const BOM_FIELDS: BomField[] = [
  {
    id: 'mpn',
    label: 'Manufacturer Part Number',
    required: true,
    type: 'string',
    aliases: ['mpn', 'mfr part', 'mfr pn', 'manufacturer part', 'part number', 'pn', 'mfg part'],
    patterns: [/^[A-Z0-9]{4,}[-]?[A-Z0-9]*$/i],
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer',
    required: true,
    type: 'string',
    aliases: ['manufacturer', 'mfr', 'mfg', 'vendor', 'brand', 'make'],
  },
  {
    id: 'quantity',
    label: 'Quantity',
    required: true,
    type: 'number',
    aliases: ['quantity', 'qty', 'count', 'amount', 'qty req', 'quantity required'],
    patterns: [/^\d+$/],
  },
  {
    id: 'description',
    label: 'Description',
    required: false,
    type: 'string',
    aliases: ['description', 'desc', 'item description', 'part description', 'name'],
  },
  {
    id: 'reference',
    label: 'Reference Designator',
    required: false,
    type: 'string',
    aliases: ['reference', 'ref', 'ref des', 'designator', 'reference designator'],
    patterns: [/^[A-Z]+\d+/i],
  },
  {
    id: 'value',
    label: 'Value',
    required: false,
    type: 'string',
    aliases: ['value', 'val', 'component value'],
    patterns: [/^\d+(\.\d+)?[kKmMuUnNpP]?[FfHhRrΩ]?$/],
  },
  {
    id: 'footprint',
    label: 'Footprint/Package',
    required: false,
    type: 'string',
    aliases: ['footprint', 'package', 'pkg', 'case', 'size'],
    patterns: [/^(0201|0402|0603|0805|1206|1210|SOT|QFP|BGA|SOIC)/i],
  },
];

export function detectColumnMappings(
  headers: string[],
  sampleData: string[][]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();

    // Try exact match first
    for (const field of BOM_FIELDS) {
      if (field.aliases.some(alias => normalizedHeader === alias.toLowerCase())) {
        mappings.push({
          sourceColumn: header,
          targetField: field,
          confidence: 1.0,
          method: 'exact',
        });
        break;
      }
    }

    // If no exact match, try fuzzy matching
    if (!mappings.find(m => m.sourceColumn === header)) {
      const fuzzyMatch = findFuzzyMatch(normalizedHeader, BOM_FIELDS);
      if (fuzzyMatch && fuzzyMatch.confidence > 0.7) {
        mappings.push({
          sourceColumn: header,
          targetField: fuzzyMatch.field,
          confidence: fuzzyMatch.confidence,
          method: 'fuzzy',
        });
      }
    }

    // If still no match, analyze sample data patterns
    if (!mappings.find(m => m.sourceColumn === header)) {
      const columnIndex = headers.indexOf(header);
      const columnData = sampleData.map(row => row[columnIndex]).filter(Boolean);
      const patternMatch = analyzeDataPatterns(columnData, BOM_FIELDS);
      if (patternMatch && patternMatch.confidence > 0.6) {
        mappings.push({
          sourceColumn: header,
          targetField: patternMatch.field,
          confidence: patternMatch.confidence,
          method: 'pattern',
        });
      }
    }
  }

  return mappings;
}
```

#### 2. Column Mapping UI Component
```tsx
// src/components/bom/ColumnMappingWizard.tsx
import { useState, useMemo } from 'react';
import { Check, AlertCircle, HelpCircle, Sparkles } from 'lucide-react';
import { detectColumnMappings, BOM_FIELDS, ColumnMapping } from '@/services/bom/column-detector';

interface ColumnMappingWizardProps {
  headers: string[];
  sampleData: string[][];
  onMappingComplete: (mappings: Record<string, string>) => void;
}

export function ColumnMappingWizard({
  headers,
  sampleData,
  onMappingComplete,
}: ColumnMappingWizardProps) {
  const autoMappings = useMemo(
    () => detectColumnMappings(headers, sampleData),
    [headers, sampleData]
  );

  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const mapping of autoMappings) {
      initial[mapping.sourceColumn] = mapping.targetField.id;
    }
    return initial;
  });

  const unmappedRequired = BOM_FIELDS
    .filter(f => f.required)
    .filter(f => !Object.values(mappings).includes(f.id));

  const getConfidenceIcon = (mapping: ColumnMapping | undefined) => {
    if (!mapping) return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    if (mapping.confidence >= 0.9) return <Check className="h-4 w-4 text-green-500" />;
    if (mapping.confidence >= 0.7) return <Sparkles className="h-4 w-4 text-amber-500" />;
    return <AlertCircle className="h-4 w-4 text-orange-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <Sparkles className="h-5 w-5 text-blue-500" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          We automatically detected {autoMappings.length} column mappings. Review and adjust as needed.
        </p>
      </div>

      {unmappedRequired.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Required fields not mapped: {unmappedRequired.map(f => f.label).join(', ')}
          </p>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Your Column</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Sample Data</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Maps To</th>
              <th className="px-4 py-3 text-center text-sm font-medium w-16">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {headers.map((header, idx) => {
              const autoMapping = autoMappings.find(m => m.sourceColumn === header);
              const sampleValues = sampleData.slice(0, 3).map(row => row[idx]).filter(Boolean);

              return (
                <tr key={header} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{header}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {sampleValues.slice(0, 2).join(', ')}
                    {sampleValues.length > 2 && '...'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mappings[header] || ''}
                      onChange={(e) => setMappings(prev => ({
                        ...prev,
                        [header]: e.target.value,
                      }))}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      aria-label={`Map ${header} to field`}
                    >
                      <option value="">-- Skip this column --</option>
                      {BOM_FIELDS.map(field => (
                        <option key={field.id} value={field.id}>
                          {field.label} {field.required ? '*' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getConfidenceIcon(autoMapping)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => {
            const reset: Record<string, string> = {};
            for (const mapping of autoMappings) {
              reset[mapping.sourceColumn] = mapping.targetField.id;
            }
            setMappings(reset);
          }}
        >
          Reset to Auto-Detected
        </Button>
        <Button
          onClick={() => onMappingComplete(mappings)}
          disabled={unmappedRequired.length > 0}
        >
          Continue with Mapping
        </Button>
      </div>
    </div>
  );
}
```

### Files to Create/Modify
1. `src/services/bom/column-detector.ts` (create)
2. `src/components/bom/ColumnMappingWizard.tsx` (create)
3. `src/pages/boms/upload.tsx` (integrate wizard)
4. `src/services/bom/fuzzy-match.ts` (create)

### Acceptance Criteria
- [ ] Auto-detects MPN, Manufacturer, Quantity with >90% accuracy
- [ ] Shows confidence indicator for each mapping
- [ ] Sample data preview helps user verify mapping
- [ ] Required fields validation before proceeding
- [ ] Reset button restores auto-detected mappings
- [ ] Handles various column naming conventions
- [ ] Stores successful mappings for future uploads

### Testing Requirements
```bash
# Test with various BOM formats
npm run test:unit -- --spec=column-detector.spec.ts

# Test files:
- Standard BOM (MPN, Mfr, Qty headers)
- Abbreviated headers (PN, Mfg, Q)
- Non-standard naming (Part Number, Vendor, Amount)
- Extra columns (should be skipped)
```

---

## CBP-P1-008: Color Contrast Compliance (WCAG AA 4.5:1)

**Priority:** Critical
**Estimated Effort:** 2 days
**Dependencies:** None
**Category:** Accessibility

### Objective
Audit and fix all color combinations to meet WCAG AA minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text, ensuring readability for users with visual impairments.

### Technical Specifications

#### 1. Contrast Utility Functions
```ts
// src/lib/color-contrast.ts
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAGAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}
```

#### 2. Updated Color Palette
```css
/* src/styles/colors.css */
:root {
  /* Primary - Blue scale (adjusted for contrast) */
  --primary-50: 239 246 255;   /* #eff6ff */
  --primary-100: 219 234 254;  /* #dbeafe */
  --primary-500: 59 130 246;   /* #3b82f6 - main brand */
  --primary-600: 37 99 235;    /* #2563eb - hover */
  --primary-700: 29 78 216;    /* #1d4ed8 - active */
  --primary-900: 30 58 138;    /* #1e3a8a - dark mode text */

  /* Text colors with guaranteed contrast */
  --text-primary: 15 23 42;       /* #0f172a - 16:1 on white */
  --text-secondary: 71 85 105;    /* #475569 - 7:1 on white */
  --text-muted: 100 116 139;      /* #64748b - 4.6:1 on white */
  --text-on-primary: 255 255 255; /* white on primary-500 = 4.5:1 */

  /* Status colors (adjusted for contrast) */
  --success-text: 22 101 52;      /* #166534 - 7:1 on success-50 */
  --warning-text: 133 77 14;      /* #854d0e - 7:1 on warning-50 */
  --error-text: 153 27 27;        /* #991b1b - 7:1 on error-50 */
  --info-text: 30 64 175;         /* #1e40af - 7:1 on info-50 */

  /* Dark mode overrides */
  .dark {
    --text-primary: 248 250 252;    /* #f8fafc */
    --text-secondary: 203 213 225;  /* #cbd5e1 */
    --text-muted: 148 163 184;      /* #94a3b8 */
    --text-on-primary: 255 255 255;
  }
}
```

#### 3. Tailwind Config Update
```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Ensure all text colors meet contrast requirements
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
      },
    },
  },
  plugins: [
    // Custom plugin to warn about low-contrast combinations
    function({ addUtilities }) {
      addUtilities({
        '.contrast-safe': {
          'color': 'rgb(var(--text-primary))',
        },
        '.contrast-safe-secondary': {
          'color': 'rgb(var(--text-secondary))',
        },
      });
    },
  ],
};
```

#### 4. Contrast Audit Script
```ts
// scripts/audit-contrast.ts
import { getContrastRatio } from '../src/lib/color-contrast';

const COLOR_PAIRS_TO_CHECK = [
  // Text on backgrounds
  { fg: '#0f172a', bg: '#ffffff', context: 'Primary text on white' },
  { fg: '#475569', bg: '#ffffff', context: 'Secondary text on white' },
  { fg: '#64748b', bg: '#ffffff', context: 'Muted text on white' },
  { fg: '#ffffff', bg: '#3b82f6', context: 'White on primary button' },
  { fg: '#166534', bg: '#f0fdf4', context: 'Success text on success bg' },
  { fg: '#991b1b', bg: '#fef2f2', context: 'Error text on error bg' },
  // Dark mode
  { fg: '#f8fafc', bg: '#0f172a', context: 'Primary text on dark' },
  { fg: '#cbd5e1', bg: '#0f172a', context: 'Secondary text on dark' },
];

function auditContrast() {
  console.log('Color Contrast Audit Report\n');
  console.log('WCAG AA Requirements: 4.5:1 (normal text), 3:1 (large text)\n');

  let failures = 0;

  for (const pair of COLOR_PAIRS_TO_CHECK) {
    const ratio = getContrastRatio(pair.fg, pair.bg);
    const passes = ratio >= 4.5;
    const status = passes ? '✓ PASS' : '✗ FAIL';

    console.log(`${status} | ${ratio.toFixed(2)}:1 | ${pair.context}`);

    if (!passes) failures++;
  }

  console.log(`\n${failures} failures found.`);
  process.exit(failures > 0 ? 1 : 0);
}

auditContrast();
```

### Files to Create/Modify
1. `src/lib/color-contrast.ts` (create)
2. `src/styles/colors.css` (update)
3. `tailwind.config.ts` (update)
4. `scripts/audit-contrast.ts` (create)
5. All components using custom colors

### Acceptance Criteria
- [ ] All normal text meets 4.5:1 contrast ratio
- [ ] All large text (18px+ or 14px bold) meets 3:1 ratio
- [ ] Primary button text readable on all button states
- [ ] Status colors readable on their backgrounds
- [ ] Dark mode colors meet same requirements
- [ ] Automated contrast audit passes in CI

### Testing Requirements
```bash
# Run contrast audit
npm run audit:contrast

# Visual testing
npm run test:visual -- --filter=contrast

# Browser DevTools
# Chrome: DevTools > Rendering > Emulate vision deficiencies
```

---

## CBP-P1-009: Error Messages & Inline Form Validation

**Priority:** High
**Estimated Effort:** 2-3 days
**Dependencies:** CBP-P1-001
**Category:** UX, Forms

### Objective
Implement consistent, helpful error messaging with inline validation that provides immediate feedback, clear error descriptions, and recovery suggestions.

### Technical Specifications

#### 1. Error Message Component
```tsx
// src/components/ui/form-error.tsx
import { AlertCircle, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormErrorProps {
  message: string;
  type?: 'error' | 'warning' | 'success' | 'info';
  suggestion?: string;
  id?: string;
}

export function FormError({
  message,
  type = 'error',
  suggestion,
  id,
}: FormErrorProps) {
  const icons = {
    error: AlertCircle,
    warning: AlertCircle,
    success: CheckCircle,
    info: Info,
  };

  const colors = {
    error: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-green-600 dark:text-green-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const Icon = icons[type];

  return (
    <div
      id={id}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={cn('flex items-start gap-2 text-sm mt-1.5', colors[type])}
    >
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div>
        <p>{message}</p>
        {suggestion && (
          <p className="text-muted-foreground mt-0.5 text-xs">{suggestion}</p>
        )}
      </div>
    </div>
  );
}
```

#### 2. Validation Rules with Error Messages
```ts
// src/lib/validation/rules.ts
import { z } from 'zod';

export const validationMessages = {
  required: (field: string) => `${field} is required`,
  email: {
    invalid: 'Please enter a valid email address',
    suggestion: 'Format: name@example.com',
  },
  password: {
    tooShort: 'Password must be at least 8 characters',
    noUppercase: 'Password must contain at least one uppercase letter',
    noLowercase: 'Password must contain at least one lowercase letter',
    noNumber: 'Password must contain at least one number',
    noSpecial: 'Password must contain at least one special character (!@#$%^&*)',
  },
  mpn: {
    invalid: 'Invalid part number format',
    suggestion: 'Part numbers typically contain letters and numbers (e.g., LM358N, RC0805FR-071K)',
  },
  quantity: {
    invalid: 'Quantity must be a positive number',
    min: 'Quantity must be at least 1',
  },
};

export const emailSchema = z
  .string()
  .min(1, validationMessages.required('Email'))
  .email(validationMessages.email.invalid);

export const passwordSchema = z
  .string()
  .min(8, validationMessages.password.tooShort)
  .regex(/[A-Z]/, validationMessages.password.noUppercase)
  .regex(/[a-z]/, validationMessages.password.noLowercase)
  .regex(/[0-9]/, validationMessages.password.noNumber)
  .regex(/[!@#$%^&*]/, validationMessages.password.noSpecial);

export const mpnSchema = z
  .string()
  .min(1, validationMessages.required('Part number'))
  .regex(/^[A-Z0-9][-A-Z0-9/]*$/i, validationMessages.mpn.invalid);

export const quantitySchema = z
  .number({ invalid_type_error: validationMessages.quantity.invalid })
  .min(1, validationMessages.quantity.min);
```

#### 3. Form Field with Inline Validation
```tsx
// src/components/forms/ValidatedInput.tsx
import { useState, useCallback } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/ui/form-error';
import { cn } from '@/lib/utils';
import { debounce } from '@/lib/utils/debounce';

interface ValidatedInputProps {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  validateOnChange?: boolean;
  showSuccessState?: boolean;
}

export function ValidatedInput({
  name,
  label,
  type = 'text',
  required,
  hint,
  validateOnChange = true,
  showSuccessState = false,
}: ValidatedInputProps) {
  const {
    control,
    formState: { errors, dirtyFields },
    trigger,
  } = useFormContext();

  const [isValidating, setIsValidating] = useState(false);
  const error = errors[name];
  const isDirty = dirtyFields[name];
  const isValid = isDirty && !error;

  const debouncedValidate = useCallback(
    debounce(() => {
      setIsValidating(true);
      trigger(name).finally(() => setIsValidating(false));
    }, 300),
    [name, trigger]
  );

  const inputId = `field-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
      </Label>

      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="relative">
            <Input
              {...field}
              id={inputId}
              type={type}
              aria-required={required}
              aria-invalid={!!error}
              aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(' ') || undefined}
              className={cn(
                error && 'border-destructive focus-visible:ring-destructive',
                isValid && showSuccessState && 'border-green-500 focus-visible:ring-green-500'
              )}
              onChange={(e) => {
                field.onChange(e);
                if (validateOnChange) {
                  debouncedValidate();
                }
              }}
              onBlur={(e) => {
                field.onBlur();
                trigger(name);
              }}
            />
            {isValidating && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {isValid && showSuccessState && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                <CheckCircle className="h-4 w-4" />
              </div>
            )}
          </div>
        )}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}

      {error && (
        <FormError
          id={errorId}
          message={error.message as string}
          suggestion={getErrorSuggestion(name, error.type as string)}
        />
      )}
    </div>
  );
}

function getErrorSuggestion(field: string, errorType: string): string | undefined {
  const suggestions: Record<string, Record<string, string>> = {
    email: {
      invalid: 'Format: name@example.com',
    },
    mpn: {
      invalid: 'Example: LM358N, RC0805FR-071K',
    },
  };

  return suggestions[field]?.[errorType];
}
```

### Files to Create/Modify
1. `src/components/ui/form-error.tsx` (create)
2. `src/lib/validation/rules.ts` (create)
3. `src/components/forms/ValidatedInput.tsx` (create)
4. All form components to use new validation

### Acceptance Criteria
- [ ] Errors display immediately on blur
- [ ] Debounced validation on change (300ms)
- [ ] Clear, human-readable error messages
- [ ] Suggestions for common errors
- [ ] Screen readers announce errors with role="alert"
- [ ] Visual success state for valid fields
- [ ] Error icon distinguishes from hint text

### Testing Requirements
```bash
# Unit tests for validation rules
npm run test:unit -- --spec=validation.spec.ts

# Component tests
npm run test:component -- --spec=ValidatedInput.spec.tsx

# E2E validation flow
npm run test:e2e -- --spec=form-validation.spec.ts
```

---

## CBP-P1-010: Toast Notifications with ARIA Live Regions

**Priority:** High
**Estimated Effort:** 1-2 days
**Dependencies:** None
**Category:** Accessibility, UX

### Objective
Implement an accessible toast notification system with ARIA live regions that announces messages to screen readers, supports keyboard dismissal, and provides consistent feedback across the application.

### Technical Specifications

#### 1. Toast Store with Zustand
```ts
// src/stores/toast-store.ts
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = crypto.randomUUID();
    const newToast: Toast = {
      id,
      duration: toast.type === 'error' ? 8000 : 5000,
      dismissible: true,
      ...toast,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-dismiss non-error toasts
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));
```

#### 2. Toast Component
```tsx
// src/components/ui/toast.tsx
import { useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toast as ToastType, useToastStore } from '@/stores/toast-store';
import { Button } from './button';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  error: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
  warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
  info: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
};

const iconStyles = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
};

interface ToastItemProps {
  toast: ToastType;
}

function ToastItem({ toast }: ToastItemProps) {
  const { removeToast } = useToastStore();
  const toastRef = useRef<HTMLDivElement>(null);
  const Icon = icons[toast.type];

  useEffect(() => {
    // Focus the toast for keyboard users
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toast.dismissible) {
        removeToast(toast.id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toast.id, toast.dismissible, removeToast]);

  return (
    <div
      ref={toastRef}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        'animate-in slide-in-from-right-full duration-300',
        styles[toast.type]
      )}
    >
      <Icon
        className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconStyles[toast.type])}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-muted-foreground mt-1">{toast.message}</p>
        )}
        {toast.action && (
          <Button
            variant="link"
            size="sm"
            className="mt-2 h-auto p-0"
            onClick={toast.action.onClick}
          >
            {toast.action.label}
          </Button>
        )}
      </div>

      {toast.dismissible && (
        <button
          onClick={() => removeToast(toast.id)}
          className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
```

#### 3. Toast Hook
```ts
// src/hooks/useToast.ts
import { useCallback } from 'react';
import { useToastStore, ToastType } from '@/stores/toast-store';

export function useToast() {
  const { addToast, removeToast, clearAll } = useToastStore();

  const toast = useCallback(
    (title: string, options?: { message?: string; type?: ToastType; duration?: number; action?: { label: string; onClick: () => void } }) => {
      return addToast({
        title,
        type: options?.type || 'info',
        message: options?.message,
        duration: options?.duration,
        action: options?.action,
      });
    },
    [addToast]
  );

  const success = useCallback(
    (title: string, message?: string) => addToast({ title, message, type: 'success' }),
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string) => addToast({ title, message, type: 'error', duration: 8000 }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => addToast({ title, message, type: 'warning' }),
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string) => addToast({ title, message, type: 'info' }),
    [addToast]
  );

  return {
    toast,
    success,
    error,
    warning,
    info,
    dismiss: removeToast,
    clearAll,
  };
}
```

### Files to Create/Modify
1. `src/stores/toast-store.ts` (create)
2. `src/components/ui/toast.tsx` (create)
3. `src/hooks/useToast.ts` (create)
4. `src/App.tsx` (add ToastContainer)

### Acceptance Criteria
- [ ] Toasts announce to screen readers via aria-live
- [ ] Error toasts use assertive, others use polite
- [ ] Escape key dismisses focused toast
- [ ] Error toasts stay longer (8s vs 5s)
- [ ] Action buttons support callbacks
- [ ] Toasts stack without overlapping
- [ ] Animation on enter/exit
- [ ] Dark mode support

### Testing Requirements
```bash
# Component tests
npm run test:component -- --spec=Toast.spec.tsx

# Screen reader test (manual)
- Verify VoiceOver/NVDA announces toast content
- Verify error toasts interrupt current announcement
```

---

# Phase 2: Role-Based Features & Search Enhancements (Weeks 5-8)

## CBP-P2-001: Owner Portfolio Dashboard

**Priority:** High
**Estimated Effort:** 4-5 days
**Dependencies:** CBP-P1-006
**Category:** Role-Based Features

### Objective
Create a comprehensive portfolio dashboard for Owner-level users that provides organization-wide visibility into all BOMs, team activity, spend analysis, and risk metrics across multiple engineers.

### Technical Specifications

#### 1. Portfolio Dashboard Layout
```tsx
// src/pages/portfolio/index.tsx
import { usePermissions } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortfolioStats } from './components/PortfolioStats';
import { BomsByEngineer } from './components/BomsByEngineer';
import { SpendOverview } from './components/SpendOverview';
import { RiskSummary } from './components/RiskSummary';
import { RecentActivity } from './components/RecentActivity';

export function PortfolioPage() {
  const { data: permissions } = usePermissions();

  if (!permissions?.includes('owner') && !permissions?.includes('super_admin')) {
    return <AccessDenied message="Portfolio requires Owner access" />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio Overview</h1>
          <p className="text-muted-foreground">
            Organization-wide BOM management and analytics
          </p>
        </div>
        <DateRangePicker
          defaultRange="last30days"
          onChange={setDateRange}
        />
      </div>

      {/* Key Metrics */}
      <PortfolioStats dateRange={dateRange} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BOMs by Engineer (2 cols) */}
        <div className="lg:col-span-2">
          <BomsByEngineer dateRange={dateRange} />
        </div>

        {/* Risk Summary (1 col) */}
        <div>
          <RiskSummary />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendOverview dateRange={dateRange} />
        <RecentActivity limit={10} />
      </div>
    </div>
  );
}
```

#### 2. Portfolio Stats Component
```tsx
// src/pages/portfolio/components/PortfolioStats.tsx
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Users, DollarSign, AlertTriangle } from 'lucide-react';

interface PortfolioStatsProps {
  dateRange: DateRange;
}

export function PortfolioStats({ dateRange }: PortfolioStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['portfolio-stats', dateRange],
    queryFn: () => fetchPortfolioStats(dateRange),
  });

  const metrics = [
    {
      label: 'Total BOMs',
      value: stats?.totalBoms ?? 0,
      change: stats?.bomGrowth ?? 0,
      icon: FileSpreadsheet,
      color: 'text-blue-500',
    },
    {
      label: 'Active Engineers',
      value: stats?.activeEngineers ?? 0,
      change: null,
      icon: Users,
      color: 'text-green-500',
    },
    {
      label: 'Total Spend (Est.)',
      value: formatCurrency(stats?.totalSpend ?? 0),
      change: stats?.spendChange ?? 0,
      icon: DollarSign,
      color: 'text-amber-500',
    },
    {
      label: 'At-Risk Items',
      value: stats?.atRiskItems ?? 0,
      change: stats?.riskChange ?? 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      invertChange: true, // negative is good
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-bold mt-1">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : metric.value}
                </p>
                {metric.change !== null && (
                  <ChangeIndicator
                    value={metric.change}
                    invert={metric.invertChange}
                  />
                )}
              </div>
              <div className={cn('p-3 rounded-full bg-muted', metric.color)}>
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

#### 3. BOMs by Engineer Component
```tsx
// src/pages/portfolio/components/BomsByEngineer.tsx
import { useState } from 'react';
import { useList } from '@refinedev/core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

export function BomsByEngineer({ dateRange }: { dateRange: DateRange }) {
  const [sortBy, setSortBy] = useState<'boms' | 'spend' | 'risk'>('boms');

  const { data, isLoading } = useList({
    resource: 'portfolio/engineers',
    filters: [
      { field: 'dateFrom', operator: 'gte', value: dateRange.from },
      { field: 'dateTo', operator: 'lte', value: dateRange.to },
    ],
    sorters: [{ field: sortBy, order: 'desc' }],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>BOMs by Engineer</CardTitle>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="boms">Sort by BOMs</SelectItem>
            <SelectItem value="spend">Sort by Spend</SelectItem>
            <SelectItem value="risk">Sort by Risk</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Engineer</TableHead>
              <TableHead className="text-right">BOMs</TableHead>
              <TableHead className="text-right">Est. Spend</TableHead>
              <TableHead>Enrichment</TableHead>
              <TableHead className="text-right">At Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data.map((engineer) => (
              <TableRow
                key={engineer.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/portfolio/engineer/${engineer.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={engineer.avatar} />
                      <AvatarFallback>
                        {engineer.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{engineer.name}</p>
                      <p className="text-xs text-muted-foreground">{engineer.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {engineer.bomCount}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(engineer.estimatedSpend)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={engineer.enrichmentRate} className="w-20" />
                    <span className="text-sm text-muted-foreground">
                      {engineer.enrichmentRate}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {engineer.atRiskCount > 0 ? (
                    <Badge variant="destructive">{engineer.atRiskCount}</Badge>
                  ) : (
                    <Badge variant="outline">0</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### API Endpoints Required
```yaml
GET /api/portfolio/stats:
  params: { dateFrom, dateTo }
  response: { totalBoms, activeEngineers, totalSpend, atRiskItems, bomGrowth, spendChange, riskChange }

GET /api/portfolio/engineers:
  params: { dateFrom, dateTo, sortBy, sortOrder }
  response: [{ id, name, email, avatar, bomCount, estimatedSpend, enrichmentRate, atRiskCount }]

GET /api/portfolio/spend:
  params: { dateFrom, dateTo, groupBy: 'day' | 'week' | 'month' }
  response: { series: [{ date, value }], total, average }

GET /api/portfolio/risks:
  response: { obsolete, singleSource, longLead, priceVolatile, counterfeit }
```

### Files to Create
1. `src/pages/portfolio/index.tsx`
2. `src/pages/portfolio/components/PortfolioStats.tsx`
3. `src/pages/portfolio/components/BomsByEngineer.tsx`
4. `src/pages/portfolio/components/SpendOverview.tsx`
5. `src/pages/portfolio/components/RiskSummary.tsx`
6. `src/pages/portfolio/components/RecentActivity.tsx`

### Acceptance Criteria
- [ ] Only visible to owner and super_admin roles
- [ ] Shows aggregated stats across all engineers
- [ ] Filterable by date range
- [ ] Sortable engineer list by BOMs/spend/risk
- [ ] Click-through to engineer detail view
- [ ] Real-time spend estimates
- [ ] Risk categorization (obsolete, single-source, etc.)

---

## CBP-P2-002: Parametric Component Search UI

**Priority:** High
**Estimated Effort:** 4-5 days
**Dependencies:** None
**Category:** Search Enhancement

### Objective
Build an advanced parametric search interface that allows users to filter components by technical specifications (capacitance, resistance, voltage rating, package size) with real-time results and faceted navigation.

### Technical Specifications

#### 1. Search Interface Layout
```tsx
// src/pages/components/search.tsx
import { useState, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { SearchInput } from './components/SearchInput';
import { FilterPanel } from './components/FilterPanel';
import { SearchResults } from './components/SearchResults';
import { useComponentSearch } from '@/hooks/useComponentSearch';

export function ComponentSearchPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const debouncedQuery = useDebounce(query, 300);

  const {
    data: results,
    isLoading,
    facets,
    totalCount,
  } = useComponentSearch({
    query: debouncedQuery,
    filters,
    page: 1,
    pageSize: 50,
  });

  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Filter Sidebar */}
      <aside className="w-72 border-r bg-card overflow-y-auto p-4">
        <FilterPanel
          facets={facets}
          filters={filters}
          onChange={handleFilterChange}
          onClear={() => setFilters({})}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Search Header */}
          <div className="flex items-center gap-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by MPN, manufacturer, description..."
              className="flex-1"
            />
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {/* Results Count & Sort */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount.toLocaleString()} components found
            </p>
            <SortSelect
              options={SORT_OPTIONS}
              value={filters.sortBy}
              onChange={(v) => handleFilterChange('sortBy', v)}
            />
          </div>

          {/* Results */}
          <SearchResults
            results={results}
            isLoading={isLoading}
            viewMode={viewMode}
            onCompare={(ids) => navigate(`/components/compare?ids=${ids.join(',')}`)}
          />
        </div>
      </main>
    </div>
  );
}
```

#### 2. Filter Panel with Facets
```tsx
// src/pages/components/components/FilterPanel.tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

interface FilterPanelProps {
  facets: SearchFacets;
  filters: SearchFilters;
  onChange: (key: string, value: any) => void;
  onClear: () => void;
}

export function FilterPanel({ facets, filters, onChange, onClear }: FilterPanelProps) {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all ({activeFilterCount})
          </Button>
        )}
      </div>

      <Accordion type="multiple" defaultValue={['category', 'manufacturer']}>
        {/* Category Filter */}
        <AccordionItem value="category">
          <AccordionTrigger>
            Category
            {filters.categories?.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filters.categories.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {facets.categories?.map((cat) => (
                <label
                  key={cat.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={filters.categories?.includes(cat.value)}
                    onCheckedChange={(checked) => {
                      const current = filters.categories || [];
                      onChange(
                        'categories',
                        checked
                          ? [...current, cat.value]
                          : current.filter((c) => c !== cat.value)
                      );
                    }}
                  />
                  <span className="text-sm flex-1">{cat.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {cat.count.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Manufacturer Filter */}
        <AccordionItem value="manufacturer">
          <AccordionTrigger>Manufacturer</AccordionTrigger>
          <AccordionContent>
            <Input
              placeholder="Search manufacturers..."
              value={filters.manufacturerSearch || ''}
              onChange={(e) => onChange('manufacturerSearch', e.target.value)}
              className="mb-2"
            />
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {facets.manufacturers
                ?.filter((m) =>
                  !filters.manufacturerSearch ||
                  m.label.toLowerCase().includes(filters.manufacturerSearch.toLowerCase())
                )
                .map((mfr) => (
                  <label
                    key={mfr.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.manufacturers?.includes(mfr.value)}
                      onCheckedChange={(checked) => {
                        const current = filters.manufacturers || [];
                        onChange(
                          'manufacturers',
                          checked
                            ? [...current, mfr.value]
                            : current.filter((m) => m !== mfr.value)
                        );
                      }}
                    />
                    <span className="text-sm flex-1">{mfr.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {mfr.count.toLocaleString()}
                    </span>
                  </label>
                ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Parametric Filters */}
        <AccordionItem value="capacitance">
          <AccordionTrigger>Capacitance</AccordionTrigger>
          <AccordionContent>
            <RangeFilter
              min={0}
              max={1000}
              unit="µF"
              value={filters.capacitanceRange}
              onChange={(v) => onChange('capacitanceRange', v)}
              presets={['1pF-100pF', '100pF-1µF', '1µF-100µF', '100µF+']}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="resistance">
          <AccordionTrigger>Resistance</AccordionTrigger>
          <AccordionContent>
            <RangeFilter
              min={0}
              max={10000000}
              unit="Ω"
              value={filters.resistanceRange}
              onChange={(v) => onChange('resistanceRange', v)}
              presets={['0-100Ω', '100Ω-10kΩ', '10kΩ-1MΩ', '1MΩ+']}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="package">
          <AccordionTrigger>Package/Footprint</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {COMMON_PACKAGES.map((pkg) => (
                <Button
                  key={pkg}
                  variant={filters.packages?.includes(pkg) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const current = filters.packages || [];
                    onChange(
                      'packages',
                      current.includes(pkg)
                        ? current.filter((p) => p !== pkg)
                        : [...current, pkg]
                    );
                  }}
                >
                  {pkg}
                </Button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Stock Status */}
        <AccordionItem value="stock">
          <AccordionTrigger>Stock Status</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={filters.inStockOnly}
                  onCheckedChange={(v) => onChange('inStockOnly', v)}
                />
                <span className="text-sm">In stock only</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={filters.excludeObsolete}
                  onCheckedChange={(v) => onChange('excludeObsolete', v)}
                />
                <span className="text-sm">Exclude obsolete</span>
              </label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
```

### Files to Create
1. `src/pages/components/search.tsx`
2. `src/pages/components/components/FilterPanel.tsx`
3. `src/pages/components/components/SearchResults.tsx`
4. `src/pages/components/components/RangeFilter.tsx`
5. `src/hooks/useComponentSearch.ts`

### Acceptance Criteria
- [ ] Free-text search with debouncing
- [ ] Faceted filtering with counts
- [ ] Parametric range filters (capacitance, resistance, voltage)
- [ ] Package/footprint filter with common presets
- [ ] Stock status filter
- [ ] Manufacturer search within filter
- [ ] Clear all filters button
- [ ] URL reflects current filters (shareable)
- [ ] Grid and list view modes

---

## CBP-P2-003: Saved Searches & Search History

**Priority:** Medium
**Estimated Effort:** 2-3 days
**Dependencies:** CBP-P2-002
**Category:** Search Enhancement

### Objective
Allow users to save frequently used search queries and filters, and maintain a history of recent searches for quick access.

### Technical Specifications

#### 1. Saved Searches Store
```ts
// src/stores/saved-searches.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: string;
  lastUsed: string;
  useCount: number;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  filters: SearchFilters;
  timestamp: string;
  resultCount: number;
}

interface SavedSearchesState {
  savedSearches: SavedSearch[];
  searchHistory: SearchHistoryItem[];
  addSavedSearch: (name: string, query: string, filters: SearchFilters) => void;
  removeSavedSearch: (id: string) => void;
  updateSavedSearch: (id: string, updates: Partial<SavedSearch>) => void;
  addToHistory: (query: string, filters: SearchFilters, resultCount: number) => void;
  clearHistory: () => void;
  useSavedSearch: (id: string) => SavedSearch | undefined;
}

export const useSavedSearchesStore = create<SavedSearchesState>()(
  persist(
    (set, get) => ({
      savedSearches: [],
      searchHistory: [],

      addSavedSearch: (name, query, filters) => {
        const newSearch: SavedSearch = {
          id: crypto.randomUUID(),
          name,
          query,
          filters,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          useCount: 0,
        };
        set((state) => ({
          savedSearches: [...state.savedSearches, newSearch],
        }));
      },

      removeSavedSearch: (id) => {
        set((state) => ({
          savedSearches: state.savedSearches.filter((s) => s.id !== id),
        }));
      },

      updateSavedSearch: (id, updates) => {
        set((state) => ({
          savedSearches: state.savedSearches.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      addToHistory: (query, filters, resultCount) => {
        const historyItem: SearchHistoryItem = {
          id: crypto.randomUUID(),
          query,
          filters,
          timestamp: new Date().toISOString(),
          resultCount,
        };
        set((state) => ({
          searchHistory: [historyItem, ...state.searchHistory].slice(0, 50), // Keep last 50
        }));
      },

      clearHistory: () => {
        set({ searchHistory: [] });
      },

      useSavedSearch: (id) => {
        const search = get().savedSearches.find((s) => s.id === id);
        if (search) {
          set((state) => ({
            savedSearches: state.savedSearches.map((s) =>
              s.id === id
                ? { ...s, lastUsed: new Date().toISOString(), useCount: s.useCount + 1 }
                : s
            ),
          }));
        }
        return search;
      },
    }),
    {
      name: 'cbp-saved-searches',
      version: 1,
    }
  )
);
```

#### 2. Save Search Dialog
```tsx
// src/components/search/SaveSearchDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSavedSearchesStore } from '@/stores/saved-searches';

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  filters: SearchFilters;
}

export function SaveSearchDialog({
  open,
  onOpenChange,
  query,
  filters,
}: SaveSearchDialogProps) {
  const [name, setName] = useState('');
  const { addSavedSearch } = useSavedSearchesStore();

  const handleSave = () => {
    if (!name.trim()) return;
    addSavedSearch(name.trim(), query, filters);
    setName('');
    onOpenChange(false);
  };

  const filterSummary = Object.entries(filters)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' | ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 0603 Capacitors"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Search Query</Label>
            <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
              {query || '(no query)'}
            </p>
          </div>

          {filterSummary && (
            <div className="space-y-2">
              <Label>Active Filters</Label>
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded break-words">
                {filterSummary}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save Search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3. Search History Dropdown
```tsx
// src/components/search/SearchHistoryDropdown.tsx
import { Clock, Star, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useSavedSearchesStore } from '@/stores/saved-searches';
import { formatRelativeTime } from '@/lib/utils/date';

interface SearchHistoryDropdownProps {
  onSelect: (query: string, filters: SearchFilters) => void;
}

export function SearchHistoryDropdown({ onSelect }: SearchHistoryDropdownProps) {
  const { savedSearches, searchHistory, useSavedSearch, clearHistory } =
    useSavedSearchesStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Clock className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Saved Searches
            </DropdownMenuLabel>
            {savedSearches.slice(0, 5).map((search) => (
              <DropdownMenuItem
                key={search.id}
                onClick={() => {
                  const s = useSavedSearch(search.id);
                  if (s) onSelect(s.query, s.filters);
                }}
              >
                <div className="flex-1 truncate">
                  <p className="font-medium">{search.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Used {search.useCount} times
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Recent Searches */}
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Searches
          </span>
          {searchHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                clearHistory();
              }}
            >
              Clear
            </Button>
          )}
        </DropdownMenuLabel>

        {searchHistory.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No recent searches
          </div>
        ) : (
          searchHistory.slice(0, 10).map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onSelect(item.query, item.filters)}
            >
              <div className="flex-1 truncate">
                <p className="truncate">{item.query || '(filters only)'}</p>
                <p className="text-xs text-muted-foreground">
                  {item.resultCount} results · {formatRelativeTime(item.timestamp)}
                </p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Files to Create
1. `src/stores/saved-searches.ts`
2. `src/components/search/SaveSearchDialog.tsx`
3. `src/components/search/SearchHistoryDropdown.tsx`
4. `src/components/search/SavedSearchesList.tsx`

### Acceptance Criteria
- [ ] Save current search with custom name
- [ ] View and manage saved searches
- [ ] Recent search history (last 50)
- [ ] Click to re-apply saved search
- [ ] Usage count tracking
- [ ] Clear history option
- [ ] Persisted in localStorage

---

## CBP-P2-004: Bulk Line Item Operations

**Priority:** High
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Category:** BOM Management

### Objective
Enable users to perform bulk operations on BOM line items including selection, editing common fields, triggering enrichment, and exporting selected items.

### Technical Specifications

#### 1. Bulk Selection Hook
```ts
// src/hooks/useBulkSelection.ts
import { useState, useCallback, useMemo } from 'react';

interface UseBulkSelectionOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
}

export function useBulkSelection<T>({ items, getItemId }: UseBulkSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => items.map(getItemId), [items, getItemId]);

  const isAllSelected = useMemo(
    () => allIds.length > 0 && allIds.every((id) => selectedIds.has(id)),
    [allIds, selectedIds]
  );

  const isPartiallySelected = useMemo(
    () => allIds.some((id) => selectedIds.has(id)) && !isAllSelected,
    [allIds, selectedIds, isAllSelected]
  );

  const selectedCount = selectedIds.size;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(getItemId(item))),
    [items, selectedIds, getItemId]
  );

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [isAllSelected, allIds]);

  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = allIds.indexOf(fromId);
      const toIndex = allIds.indexOf(toId);
      const [start, end] = [Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex)];
      const rangeIds = allIds.slice(start, end + 1);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    },
    [allIds]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount,
    selectedItems,
    isAllSelected,
    isPartiallySelected,
    toggleItem,
    toggleAll,
    selectRange,
    clearSelection,
    isSelected,
  };
}
```

#### 2. Bulk Actions Toolbar
```tsx
// src/components/bom/BulkActionsToolbar.tsx
import { useState } from 'react';
import { X, Edit, Zap, Download, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BulkEditDialog } from './BulkEditDialog';
import { useToast } from '@/hooks/useToast';

interface BulkActionsToolbarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onBulkEnrich: (ids: string[]) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkExport: (ids: string[]) => void;
}

export function BulkActionsToolbar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onBulkEnrich,
  onBulkDelete,
  onBulkExport,
}: BulkActionsToolbarProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { success, error } = useToast();

  if (selectedCount === 0) return null;

  const handleBulkEnrich = async () => {
    setIsProcessing(true);
    try {
      await onBulkEnrich(selectedIds);
      success('Enrichment started', `Processing ${selectedCount} items`);
      onClearSelection();
    } catch (e) {
      error('Enrichment failed', 'Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedCount} items? This cannot be undone.`)) return;

    setIsProcessing(true);
    try {
      await onBulkDelete(selectedIds);
      success('Items deleted', `Removed ${selectedCount} items`);
      onClearSelection();
    } catch (e) {
      error('Delete failed', 'Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-2 flex items-center gap-4 rounded-t-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-primary-foreground hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>

        <span className="text-sm font-medium">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
            disabled={isProcessing}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleBulkEnrich}
            disabled={isProcessing}
          >
            <Zap className="h-4 w-4 mr-1" />
            Enrich
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onBulkExport(selectedIds)}
            disabled={isProcessing}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" disabled={isProcessing}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={handleBulkDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <BulkEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        selectedIds={selectedIds}
        onSuccess={onClearSelection}
      />
    </>
  );
}
```

#### 3. Bulk Edit Dialog
```tsx
// src/components/bom/BulkEditDialog.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUpdateMany } from '@refinedev/core';

interface BulkEditFormValues {
  updateQuantity: boolean;
  quantity?: number;
  updateFootprint: boolean;
  footprint?: string;
  updateNotes: boolean;
  notes?: string;
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkEditDialogProps) {
  const { register, handleSubmit, watch, reset } = useForm<BulkEditFormValues>();
  const { mutate: updateMany, isLoading } = useUpdateMany();

  const watchedFields = watch();

  const onSubmit = (data: BulkEditFormValues) => {
    const updates: Record<string, any> = {};

    if (data.updateQuantity && data.quantity !== undefined) {
      updates.quantity = data.quantity;
    }
    if (data.updateFootprint && data.footprint) {
      updates.footprint = data.footprint;
    }
    if (data.updateNotes) {
      updates.notes = data.notes || '';
    }

    if (Object.keys(updates).length === 0) return;

    updateMany(
      {
        resource: 'bom-line-items',
        ids: selectedIds,
        values: updates,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
          onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {selectedIds.length} Items</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Quantity Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updateQuantity"
              {...register('updateQuantity')}
              className="mt-1"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="quantity" className="text-sm font-medium">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                disabled={!watchedFields.updateQuantity}
                {...register('quantity', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Footprint Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updateFootprint"
              {...register('updateFootprint')}
              className="mt-1"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="footprint" className="text-sm font-medium">
                Footprint
              </Label>
              <Input
                id="footprint"
                disabled={!watchedFields.updateFootprint}
                placeholder="e.g., 0603, SOIC-8"
                {...register('footprint')}
              />
            </div>
          </div>

          {/* Notes Field */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="updateNotes"
              {...register('updateNotes')}
              className="mt-1"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notes
              </Label>
              <Input
                id="notes"
                disabled={!watchedFields.updateNotes}
                placeholder="Add notes to selected items"
                {...register('notes')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : `Update ${selectedIds.length} Items`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Files to Create
1. `src/hooks/useBulkSelection.ts`
2. `src/components/bom/BulkActionsToolbar.tsx`
3. `src/components/bom/BulkEditDialog.tsx`
4. Update `src/pages/boms/show.tsx` to integrate bulk operations

### Acceptance Criteria
- [ ] Checkbox selection for individual items
- [ ] Select all / deselect all
- [ ] Shift+click for range selection
- [ ] Sticky toolbar appears when items selected
- [ ] Bulk edit common fields (quantity, footprint, notes)
- [ ] Bulk trigger enrichment
- [ ] Bulk export selected items
- [ ] Bulk delete with confirmation
- [ ] Clear selection button
- [ ] Selection count display

---

## CBP-P2-005: Organization Management Console

**Priority:** High
**Estimated Effort:** 4-5 days
**Dependencies:** CBP-P1-006
**Category:** Admin Features

### Objective
Build a comprehensive organization management interface for admin/owner roles to manage team members, view invitations, configure settings, and monitor usage.

### Technical Specifications

#### 1. Organization Settings Page
```tsx
// src/pages/settings/organization.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamMembers } from './components/TeamMembers';
import { Invitations } from './components/Invitations';
import { OrganizationProfile } from './components/OrganizationProfile';
import { UsageStats } from './components/UsageStats';
import { usePermissions } from '@refinedev/core';

export function OrganizationSettingsPage() {
  const { data: permissions } = usePermissions();
  const isOwner = permissions?.includes('owner') || permissions?.includes('super_admin');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your team and organization preferences
        </p>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          {isOwner && <TabsTrigger value="profile">Profile</TabsTrigger>}
          {isOwner && <TabsTrigger value="usage">Usage</TabsTrigger>}
        </TabsList>

        <TabsContent value="team" className="mt-6">
          <TeamMembers />
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          <Invitations />
        </TabsContent>

        {isOwner && (
          <TabsContent value="profile" className="mt-6">
            <OrganizationProfile />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="usage" className="mt-6">
            <UsageStats />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
```

#### 2. Team Members Component
```tsx
// src/pages/settings/components/TeamMembers.tsx
import { useState } from 'react';
import { useList, useUpdate, useDelete } from '@refinedev/core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserMinus, Shield, Mail } from 'lucide-react';
import { InviteUserDialog } from './InviteUserDialog';
import { ChangeRoleDialog } from './ChangeRoleDialog';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  analyst: 'Analyst',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  owner: 'bg-amber-100 text-amber-700',
  admin: 'bg-blue-100 text-blue-700',
  engineer: 'bg-green-100 text-green-700',
  analyst: 'bg-gray-100 text-gray-700',
};

export function TeamMembers() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<TeamMember | null>(null);

  const { data, isLoading, refetch } = useList<TeamMember>({
    resource: 'team-members',
    sorters: [{ field: 'role', order: 'desc' }],
  });

  const { mutate: removeMember } = useDelete();

  const handleRemoveMember = (user: TeamMember) => {
    if (!confirm(`Remove ${user.name} from the organization?`)) return;

    removeMember({
      resource: 'team-members',
      id: user.id,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} members in your organization
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <Mail className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>BOMs</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>
                        {member.name.split(' ').map((n) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={ROLE_COLORS[member.role]}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.lastActive ? formatRelativeTime(member.lastActive) : 'Never'}
                </TableCell>
                <TableCell>{member.bomCount}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setChangeRoleUser(member)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Change role
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRemoveMember(member)}
                        className="text-destructive"
                        disabled={member.role === 'owner'}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={refetch}
      />

      <ChangeRoleDialog
        user={changeRoleUser}
        onOpenChange={(open) => !open && setChangeRoleUser(null)}
        onSuccess={refetch}
      />
    </div>
  );
}
```

#### 3. Invite User Dialog
```tsx
// src/pages/settings/components/InviteUserDialog.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreate } from '@refinedev/core';
import { useToast } from '@/hooks/useToast';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['analyst', 'engineer', 'admin']),
  message: z.string().optional(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) {
  const { success, error } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'engineer' },
  });

  const { mutate: createInvitation, isLoading } = useCreate();

  const onSubmit = (data: InviteFormValues) => {
    createInvitation(
      {
        resource: 'user-invitations',
        values: data,
      },
      {
        onSuccess: () => {
          success('Invitation sent', `Invited ${data.email} as ${data.role}`);
          reset();
          onOpenChange(false);
          onSuccess();
        },
        onError: (err) => {
          error('Failed to send invitation', err.message);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              defaultValue="engineer"
              onValueChange={(v) => setValue('role', v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analyst">
                  <div>
                    <p className="font-medium">Analyst</p>
                    <p className="text-xs text-muted-foreground">View-only access</p>
                  </div>
                </SelectItem>
                <SelectItem value="engineer">
                  <div>
                    <p className="font-medium">Engineer</p>
                    <p className="text-xs text-muted-foreground">Create and manage BOMs</p>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div>
                    <p className="font-medium">Admin</p>
                    <p className="text-xs text-muted-foreground">Manage team and settings</p>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Input
              id="message"
              placeholder="Welcome to the team!"
              {...register('message')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Files to Create
1. `src/pages/settings/organization.tsx`
2. `src/pages/settings/components/TeamMembers.tsx`
3. `src/pages/settings/components/Invitations.tsx`
4. `src/pages/settings/components/InviteUserDialog.tsx`
5. `src/pages/settings/components/ChangeRoleDialog.tsx`
6. `src/pages/settings/components/OrganizationProfile.tsx`
7. `src/pages/settings/components/UsageStats.tsx`

### Acceptance Criteria
- [ ] List all team members with roles
- [ ] Invite new members by email
- [ ] Change member roles (admin only)
- [ ] Remove members (cannot remove owner)
- [ ] View pending invitations
- [ ] Resend/cancel invitations
- [ ] Organization profile editing
- [ ] Usage statistics display

---

## CBP-P2-006: Advanced Component Comparison

**Priority:** Medium
**Estimated Effort:** 3-4 days
**Dependencies:** CBP-P2-002
**Category:** Components

### Objective
Build a side-by-side component comparison tool that highlights differences in specifications, pricing, availability, and lifecycle status to help engineers make informed sourcing decisions.

### Technical Specifications

#### 1. Comparison Page Layout
```tsx
// src/pages/components/compare.tsx
import { useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { X, Plus, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ComparisonTable } from './components/ComparisonTable';
import { ComponentSelector } from './components/ComponentSelector';

const MAX_COMPARE = 4;

export function ComponentComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const componentIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const componentQueries = useQueries({
    queries: componentIds.map((id) => ({
      queryKey: ['component', id],
      queryFn: () => fetchComponent(id),
    })),
  });

  const components = componentQueries
    .map((q) => q.data)
    .filter(Boolean) as Component[];

  const isLoading = componentQueries.some((q) => q.isLoading);

  const addComponent = (id: string) => {
    if (componentIds.length >= MAX_COMPARE) return;
    if (componentIds.includes(id)) return;
    setSearchParams({ ids: [...componentIds, id].join(',') });
  };

  const removeComponent = (id: string) => {
    setSearchParams({ ids: componentIds.filter((i) => i !== id).join(',') });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6" />
            Compare Components
          </h1>
          <p className="text-muted-foreground">
            Compare up to {MAX_COMPARE} components side by side
          </p>
        </div>

        {componentIds.length < MAX_COMPARE && (
          <ComponentSelector
            excludeIds={componentIds}
            onSelect={addComponent}
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Component
              </Button>
            }
          />
        )}
      </div>

      {componentIds.length === 0 ? (
        <EmptyCompareState onAddComponent={addComponent} />
      ) : (
        <>
          {/* Component Headers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {components.map((component) => (
              <Card key={component.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-semibold">{component.mpn}</p>
                      <p className="text-sm text-muted-foreground">
                        {component.manufacturer}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeComponent(component.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm line-clamp-2">{component.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <LifecycleStatus status={component.lifecycleStatus} />
                    <StockIndicator stock={component.stockQuantity} />
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty slots */}
            {Array.from({ length: MAX_COMPARE - components.length }).map((_, i) => (
              <Card key={`empty-${i}`} className="border-dashed">
                <CardContent className="flex items-center justify-center h-40">
                  <ComponentSelector
                    excludeIds={componentIds}
                    onSelect={addComponent}
                    trigger={
                      <Button variant="ghost" className="text-muted-foreground">
                        <Plus className="h-4 w-4 mr-2" />
                        Add component
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison Table */}
          <ComparisonTable components={components} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
```

#### 2. Comparison Table
```tsx
// src/pages/components/components/ComparisonTable.tsx
import { useMemo } from 'react';
import { Check, X, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonTableProps {
  components: Component[];
  isLoading: boolean;
}

const COMPARISON_SECTIONS = [
  {
    title: 'Basic Information',
    rows: [
      { key: 'category', label: 'Category' },
      { key: 'subcategory', label: 'Subcategory' },
      { key: 'package', label: 'Package' },
      { key: 'mountingType', label: 'Mounting Type' },
    ],
  },
  {
    title: 'Electrical Specifications',
    rows: [
      { key: 'value', label: 'Value' },
      { key: 'tolerance', label: 'Tolerance' },
      { key: 'voltageRating', label: 'Voltage Rating' },
      { key: 'powerRating', label: 'Power Rating' },
      { key: 'temperatureRange', label: 'Temperature Range' },
    ],
  },
  {
    title: 'Availability & Pricing',
    rows: [
      { key: 'stockQuantity', label: 'Stock', format: 'number' },
      { key: 'unitPrice', label: 'Unit Price', format: 'currency' },
      { key: 'leadTime', label: 'Lead Time' },
      { key: 'moq', label: 'MOQ', format: 'number' },
    ],
  },
  {
    title: 'Lifecycle & Compliance',
    rows: [
      { key: 'lifecycleStatus', label: 'Lifecycle Status' },
      { key: 'rohsCompliant', label: 'RoHS Compliant', format: 'boolean' },
      { key: 'reachCompliant', label: 'REACH Compliant', format: 'boolean' },
      { key: 'countryOfOrigin', label: 'Country of Origin' },
    ],
  },
];

export function ComparisonTable({ components, isLoading }: ComparisonTableProps) {
  const highlightDifferences = useMemo(() => {
    const differences: Record<string, boolean> = {};

    COMPARISON_SECTIONS.flatMap((s) => s.rows).forEach((row) => {
      const values = components.map((c) => c[row.key as keyof Component]);
      const uniqueValues = new Set(values.map((v) => String(v)));
      differences[row.key] = uniqueValues.size > 1;
    });

    return differences;
  }, [components]);

  const formatValue = (value: any, format?: string) => {
    if (value === null || value === undefined) return <Minus className="h-4 w-4 text-muted-foreground" />;

    switch (format) {
      case 'boolean':
        return value ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-red-500" />
        );
      case 'currency':
        return `$${Number(value).toFixed(4)}`;
      case 'number':
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  };

  if (isLoading) {
    return <ComparisonTableSkeleton />;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {COMPARISON_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="bg-muted px-4 py-2 font-semibold text-sm">
            {section.title}
          </div>
          <table className="w-full">
            <tbody>
              {section.rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    'border-b last:border-0',
                    highlightDifferences[row.key] && 'bg-amber-50 dark:bg-amber-950/20'
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium w-40">
                    {row.label}
                    {highlightDifferences[row.key] && (
                      <AlertTriangle className="h-3 w-3 inline ml-1 text-amber-500" />
                    )}
                  </td>
                  {components.map((component) => (
                    <td
                      key={component.id}
                      className="px-4 py-3 text-sm text-center"
                    >
                      {formatValue(component[row.key as keyof Component], row.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
```

### Files to Create
1. `src/pages/components/compare.tsx`
2. `src/pages/components/components/ComparisonTable.tsx`
3. `src/pages/components/components/ComponentSelector.tsx`
4. `src/pages/components/components/EmptyCompareState.tsx`

### Acceptance Criteria
- [ ] Compare up to 4 components side by side
- [ ] Add/remove components from comparison
- [ ] Highlight differences between components
- [ ] Organized by specification category
- [ ] Boolean values shown as icons
- [ ] Currency and number formatting
- [ ] Empty slot placeholders
- [ ] URL reflects current comparison (shareable)

---

## CBP-P2-007: Real-Time Enrichment Status Updates

**Priority:** High
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Category:** BOM Management

### Objective
Implement real-time WebSocket-based status updates for BOM enrichment progress, allowing users to see live updates without manual refresh.

### Technical Specifications

#### 1. WebSocket Connection Manager
```ts
// src/services/websocket/connection-manager.ts
import { EventEmitter } from 'events';

export type WebSocketMessage =
  | { type: 'enrichment.progress'; data: EnrichmentProgress }
  | { type: 'enrichment.complete'; data: EnrichmentComplete }
  | { type: 'enrichment.error'; data: EnrichmentError }
  | { type: 'bom.updated'; data: BomUpdate };

class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(url: string) {
    super();
    this.url = url;
  }

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = new URL(this.url);
    wsUrl.searchParams.set('token', token);

    this.ws = new WebSocket(wsUrl.toString());

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.emit(message.type, message.data);
        this.emit('message', message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.ws.onclose = (event) => {
      this.stopHeartbeat();
      this.emit('disconnected', event);

      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect(token);
      }
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }

  private scheduleReconnect(token: string) {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect(token);
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  subscribe(bomId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        resource: 'bom',
        id: bomId,
      }));
    }
  }

  unsubscribe(bomId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        resource: 'bom',
        id: bomId,
      }));
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }
}

export const wsManager = new WebSocketManager(
  import.meta.env.VITE_WS_URL || 'wss://api.ananta.com/ws'
);
```

#### 2. Enrichment Progress Hook
```ts
// src/hooks/useEnrichmentProgress.ts
import { useState, useEffect, useCallback } from 'react';
import { wsManager } from '@/services/websocket/connection-manager';
import { useAuth } from './useAuth';

interface EnrichmentProgress {
  bomId: string;
  totalItems: number;
  processedItems: number;
  enrichedItems: number;
  errorItems: number;
  currentItem?: {
    mpn: string;
    status: 'processing' | 'enriched' | 'error';
    message?: string;
  };
  estimatedTimeRemaining?: number;
}

export function useEnrichmentProgress(bomId: string) {
  const { token } = useAuth();
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !bomId) return;

    wsManager.connect(token);

    const handleProgress = (data: EnrichmentProgress) => {
      if (data.bomId === bomId) {
        setProgress(data);
      }
    };

    const handleComplete = (data: { bomId: string }) => {
      if (data.bomId === bomId) {
        setIsComplete(true);
      }
    };

    const handleError = (data: { bomId: string; message: string }) => {
      if (data.bomId === bomId) {
        setError(data.message);
      }
    };

    wsManager.on('enrichment.progress', handleProgress);
    wsManager.on('enrichment.complete', handleComplete);
    wsManager.on('enrichment.error', handleError);

    wsManager.subscribe(bomId);

    return () => {
      wsManager.off('enrichment.progress', handleProgress);
      wsManager.off('enrichment.complete', handleComplete);
      wsManager.off('enrichment.error', handleError);
      wsManager.unsubscribe(bomId);
    };
  }, [token, bomId]);

  const progressPercent = progress
    ? Math.round((progress.processedItems / progress.totalItems) * 100)
    : 0;

  return {
    progress,
    progressPercent,
    isComplete,
    error,
    isProcessing: progress !== null && !isComplete && !error,
  };
}
```

#### 3. Enrichment Progress UI
```tsx
// src/components/bom/EnrichmentProgressPanel.tsx
import { useEnrichmentProgress } from '@/hooks/useEnrichmentProgress';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Loader2, Clock } from 'lucide-react';
import { formatDuration } from '@/lib/utils/date';

interface EnrichmentProgressPanelProps {
  bomId: string;
  onComplete?: () => void;
}

export function EnrichmentProgressPanel({
  bomId,
  onComplete,
}: EnrichmentProgressPanelProps) {
  const { progress, progressPercent, isComplete, error, isProcessing } =
    useEnrichmentProgress(bomId);

  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  if (!progress && !isComplete && !error) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
          {error && <AlertCircle className="h-4 w-4 text-red-500" />}
          Enrichment Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{progressPercent}% complete</span>
            {progress?.estimatedTimeRemaining && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(progress.estimatedTimeRemaining)}
              </span>
            )}
          </div>
          <Progress value={progressPercent} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">
              {progress?.enrichedItems ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Enriched</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">
              {(progress?.totalItems ?? 0) - (progress?.processedItems ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {progress?.errorItems ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
        </div>

        {/* Current Item */}
        {progress?.currentItem && (
          <div className="border rounded-lg p-3 bg-muted/50">
            <p className="text-sm font-medium">
              Processing: <span className="font-mono">{progress.currentItem.mpn}</span>
            </p>
            {progress.currentItem.message && (
              <p className="text-xs text-muted-foreground mt-1">
                {progress.currentItem.message}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="border border-red-200 bg-red-50 dark:bg-red-950 rounded-lg p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Completion Message */}
        {isComplete && (
          <div className="border border-green-200 bg-green-50 dark:bg-green-950 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-300">
              Enrichment complete! {progress?.enrichedItems} items enriched.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Files to Create
1. `src/services/websocket/connection-manager.ts`
2. `src/hooks/useEnrichmentProgress.ts`
3. `src/components/bom/EnrichmentProgressPanel.tsx`

### Acceptance Criteria
- [ ] WebSocket connection with auto-reconnect
- [ ] Real-time progress percentage updates
- [ ] Shows current item being processed
- [ ] Displays enriched/remaining/error counts
- [ ] Estimated time remaining
- [ ] Connection status indicator
- [ ] Graceful degradation if WebSocket unavailable
- [ ] Complete/error state handling

---

## CBP-P2-008: Dashboard Analytics Widgets

**Priority:** Medium
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Category:** Dashboard

### Objective
Add customizable analytics widgets to the main dashboard showing key metrics, trends, and actionable insights for BOM management.

### Technical Specifications

#### 1. Widget Configuration
```ts
// src/config/dashboard-widgets.ts
export interface DashboardWidget {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<WidgetProps>;
  minRole: Role;
  defaultSize: 'small' | 'medium' | 'large';
  refreshInterval?: number; // ms
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: 'bom-summary',
    title: 'BOM Summary',
    description: 'Overview of your BOMs by status',
    component: BomSummaryWidget,
    minRole: 'analyst',
    defaultSize: 'medium',
  },
  {
    id: 'recent-activity',
    title: 'Recent Activity',
    description: 'Latest BOM uploads and updates',
    component: RecentActivityWidget,
    minRole: 'analyst',
    defaultSize: 'medium',
  },
  {
    id: 'enrichment-stats',
    title: 'Enrichment Statistics',
    description: 'Component enrichment success rates',
    component: EnrichmentStatsWidget,
    minRole: 'engineer',
    defaultSize: 'small',
  },
  {
    id: 'risk-alerts',
    title: 'Risk Alerts',
    description: 'Components with supply chain risks',
    component: RiskAlertsWidget,
    minRole: 'engineer',
    defaultSize: 'large',
  },
  {
    id: 'spend-trend',
    title: 'Spend Trend',
    description: 'BOM cost trends over time',
    component: SpendTrendWidget,
    minRole: 'admin',
    defaultSize: 'large',
    refreshInterval: 60000,
  },
  {
    id: 'team-activity',
    title: 'Team Activity',
    description: 'Team member contributions',
    component: TeamActivityWidget,
    minRole: 'owner',
    defaultSize: 'medium',
  },
];
```

#### 2. BOM Summary Widget
```tsx
// src/components/dashboard/widgets/BomSummaryWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { FileSpreadsheet } from 'lucide-react';

const STATUS_COLORS = {
  completed: '#22c55e',
  processing: '#8b5cf6',
  draft: '#6b7280',
  failed: '#ef4444',
};

export function BomSummaryWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'bom-summary'],
    queryFn: fetchBomSummary,
  });

  if (isLoading) return <WidgetSkeleton />;

  const chartData = Object.entries(data?.byStatus ?? {}).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{data?.total ?? 0}</p>
          <p className="text-sm text-muted-foreground">Total BOMs</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={60}
              innerRadius={40}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

#### 3. Risk Alerts Widget
```tsx
// src/components/dashboard/widgets/RiskAlertsWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, TrendingDown, Ban, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const RISK_ICONS = {
  obsolete: Ban,
  end_of_life: Clock,
  single_source: ShieldAlert,
  price_increase: TrendingDown,
  long_lead: Clock,
};

const RISK_COLORS = {
  high: 'text-red-500 bg-red-50 dark:bg-red-950',
  medium: 'text-amber-500 bg-amber-50 dark:bg-amber-950',
  low: 'text-blue-500 bg-blue-50 dark:bg-blue-950',
};

export function RiskAlertsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'risk-alerts'],
    queryFn: fetchRiskAlerts,
  });

  if (isLoading) return <WidgetSkeleton />;

  const alerts = data?.alerts ?? [];

  if (alerts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div>
          <ShieldAlert className="h-12 w-12 mx-auto text-green-500 mb-2" />
          <p className="font-medium">No Risk Alerts</p>
          <p className="text-sm text-muted-foreground">
            All components are in good standing
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3">
        {alerts.map((alert, index) => {
          const Icon = RISK_ICONS[alert.type as keyof typeof RISK_ICONS] ?? AlertTriangle;
          const colorClass = RISK_COLORS[alert.severity as keyof typeof RISK_COLORS];

          return (
            <div
              key={index}
              className={`p-3 rounded-lg border ${colorClass}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{alert.mpn}</p>
                  <p className="text-sm opacity-80">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {alert.bomName}
                    </Badge>
                    <span className="text-xs opacity-70">
                      {alert.affectedCount} items
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
```

#### 4. Dashboard Layout with Widgets
```tsx
// src/pages/dashboard/index.tsx
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DASHBOARD_WIDGETS } from '@/config/dashboard-widgets';
import { useAuth } from '@/hooks/useAuth';
import { hasMinRole } from '@/lib/role-utils';

const SIZE_CLASSES = {
  small: 'col-span-1',
  medium: 'col-span-1 md:col-span-2',
  large: 'col-span-1 md:col-span-2 lg:col-span-3',
};

export function DashboardPage() {
  const { user } = useAuth();

  const visibleWidgets = useMemo(() => {
    return DASHBOARD_WIDGETS.filter((widget) =>
      hasMinRole(user?.role, widget.minRole)
    );
  }, [user?.role]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.firstName}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleWidgets.map((widget) => {
          const WidgetComponent = widget.component;

          return (
            <Card
              key={widget.id}
              className={SIZE_CLASSES[widget.defaultSize]}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{widget.title}</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <WidgetComponent />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

### Files to Create
1. `src/config/dashboard-widgets.ts`
2. `src/components/dashboard/widgets/BomSummaryWidget.tsx`
3. `src/components/dashboard/widgets/RecentActivityWidget.tsx`
4. `src/components/dashboard/widgets/EnrichmentStatsWidget.tsx`
5. `src/components/dashboard/widgets/RiskAlertsWidget.tsx`
6. `src/components/dashboard/widgets/SpendTrendWidget.tsx`
7. `src/components/dashboard/widgets/TeamActivityWidget.tsx`
8. `src/pages/dashboard/index.tsx`

### Acceptance Criteria
- [ ] BOM summary pie chart by status
- [ ] Recent activity timeline
- [ ] Enrichment success rate metrics
- [ ] Risk alerts with severity levels
- [ ] Spend trend line chart
- [ ] Team activity breakdown (owner only)
- [ ] Role-based widget visibility
- [ ] Loading skeletons
- [ ] Error states with retry

---

## CBP-P2-009: Export Functionality Enhancement

**Priority:** Medium
**Estimated Effort:** 2-3 days
**Dependencies:** None
**Category:** BOM Management

### Objective
Enhance BOM export capabilities with multiple format options, field selection, and template support.

### Technical Specifications

#### 1. Export Dialog
```tsx
// src/components/bom/ExportDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, FileSpreadsheet, FileJson, FileCode } from 'lucide-react';

type ExportFormat = 'xlsx' | 'csv' | 'json' | 'xml';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bomId: string;
  bomName: string;
}

const EXPORT_FORMATS = [
  { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { value: 'csv', label: 'CSV (.csv)', icon: FileSpreadsheet },
  { value: 'json', label: 'JSON (.json)', icon: FileJson },
  { value: 'xml', label: 'XML (.xml)', icon: FileCode },
];

const EXPORTABLE_FIELDS = [
  { id: 'lineNumber', label: 'Line Number', default: true },
  { id: 'mpn', label: 'MPN', default: true },
  { id: 'manufacturer', label: 'Manufacturer', default: true },
  { id: 'description', label: 'Description', default: true },
  { id: 'quantity', label: 'Quantity', default: true },
  { id: 'reference', label: 'Reference Designator', default: false },
  { id: 'footprint', label: 'Footprint', default: false },
  { id: 'value', label: 'Value', default: false },
  { id: 'unitPrice', label: 'Unit Price', default: false },
  { id: 'extendedPrice', label: 'Extended Price', default: false },
  { id: 'stock', label: 'Stock Quantity', default: false },
  { id: 'leadTime', label: 'Lead Time', default: false },
  { id: 'lifecycle', label: 'Lifecycle Status', default: false },
  { id: 'datasheet', label: 'Datasheet URL', default: false },
];

export function ExportDialog({
  open,
  onOpenChange,
  bomId,
  bomName,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(EXPORTABLE_FIELDS.filter((f) => f.default).map((f) => f.id))
  );
  const [includeEnrichment, setIncludeEnrichment] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFields(new Set(EXPORTABLE_FIELDS.map((f) => f.id)));
  };

  const selectDefault = () => {
    setSelectedFields(
      new Set(EXPORTABLE_FIELDS.filter((f) => f.default).map((f) => f.id))
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/boms/${bomId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          fields: Array.from(selectedFields),
          includeEnrichment,
        }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bomName}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export BOM
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_FORMATS.map((f) => (
                  <label
                    key={f.value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                      format === f.value ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <RadioGroupItem value={f.value} />
                    <f.icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">{f.label}</span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fields to Export</Label>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectDefault}>
                  Default
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {EXPORTABLE_FIELDS.map((field) => (
                <label
                  key={field.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedFields.has(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <span className="text-sm">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includeEnrichment}
                onCheckedChange={(v) => setIncludeEnrichment(!!v)}
              />
              <span className="text-sm">Include enrichment data (pricing, stock, lifecycle)</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedFields.size === 0}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Files to Create
1. `src/components/bom/ExportDialog.tsx`
2. `src/services/export/export-service.ts`

### Acceptance Criteria
- [ ] Export to Excel, CSV, JSON, XML
- [ ] Field selection with defaults
- [ ] Select all / select default buttons
- [ ] Include/exclude enrichment data option
- [ ] Download file with proper naming
- [ ] Loading state during export
- [ ] Error handling

---

## CBP-P2-010: Help Center & Documentation Integration

**Priority:** Medium
**Estimated Effort:** 2 days
**Dependencies:** None
**Category:** UX

### Objective
Integrate contextual help and documentation links throughout the application to improve user onboarding and self-service support.

### Technical Specifications

#### 1. Help Context Provider
```tsx
// src/components/help/HelpProvider.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface HelpArticle {
  id: string;
  title: string;
  url: string;
  category: string;
}

interface HelpContextType {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  relevantArticles: HelpArticle[];
  openHelp: () => void;
  openArticle: (articleId: string) => void;
}

const HelpContext = createContext<HelpContextType | null>(null);

const HELP_ARTICLES: Record<string, HelpArticle[]> = {
  'bom-upload': [
    { id: 'upload-1', title: 'How to upload a BOM', url: '/docs/upload-bom', category: 'Getting Started' },
    { id: 'upload-2', title: 'Supported file formats', url: '/docs/file-formats', category: 'Reference' },
    { id: 'upload-3', title: 'Column mapping guide', url: '/docs/column-mapping', category: 'Guides' },
  ],
  'enrichment': [
    { id: 'enrich-1', title: 'Understanding enrichment', url: '/docs/enrichment', category: 'Concepts' },
    { id: 'enrich-2', title: 'Troubleshooting enrichment errors', url: '/docs/enrich-errors', category: 'Troubleshooting' },
  ],
  'search': [
    { id: 'search-1', title: 'Advanced search techniques', url: '/docs/search', category: 'Guides' },
    { id: 'search-2', title: 'Parametric filtering', url: '/docs/parametric', category: 'Reference' },
  ],
  // ... more pages
};

export function HelpProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const relevantArticles = HELP_ARTICLES[currentPage] ?? [];

  const openHelp = () => setHelpOpen(true);

  const openArticle = (articleId: string) => {
    const article = relevantArticles.find((a) => a.id === articleId);
    if (article) {
      window.open(article.url, '_blank');
    }
  };

  return (
    <HelpContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        relevantArticles,
        openHelp,
        openArticle,
      }}
    >
      {children}
      <HelpSidebar open={helpOpen} onOpenChange={setHelpOpen} />
    </HelpContext.Provider>
  );
}

export const useHelp = () => {
  const context = useContext(HelpContext);
  if (!context) throw new Error('useHelp must be used within HelpProvider');
  return context;
};
```

#### 2. Help Button Component
```tsx
// src/components/help/HelpButton.tsx
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useHelp } from './HelpProvider';

interface HelpButtonProps {
  topic?: string;
  inline?: boolean;
}

export function HelpButton({ topic, inline }: HelpButtonProps) {
  const { relevantArticles, openArticle } = useHelp();

  const articles = topic
    ? relevantArticles.filter((a) => a.category === topic || a.id.includes(topic))
    : relevantArticles;

  if (inline) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted hover:bg-muted/80"
            aria-label="Help"
          >
            <HelpCircle className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <p className="text-sm font-medium mb-2">Related Help</p>
          <div className="space-y-1">
            {articles.slice(0, 3).map((article) => (
              <button
                key={article.id}
                onClick={() => openArticle(article.id)}
                className="w-full text-left text-sm p-2 rounded hover:bg-muted"
              >
                {article.title}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Help">
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
```

#### 3. Contextual Help Tooltip
```tsx
// src/components/help/HelpTooltip.tsx
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HelpTooltipProps {
  content: string;
  learnMoreUrl?: string;
}

export function HelpTooltip({ content, learnMoreUrl }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-muted"
          aria-label="More information"
        >
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{content}</p>
        {learnMoreUrl && (
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline mt-1 block"
          >
            Learn more
          </a>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
```

### Files to Create
1. `src/components/help/HelpProvider.tsx`
2. `src/components/help/HelpButton.tsx`
3. `src/components/help/HelpTooltip.tsx`
4. `src/components/help/HelpSidebar.tsx`

### Acceptance Criteria
- [ ] Contextual help based on current page
- [ ] Inline help tooltips for complex fields
- [ ] Help sidebar with relevant articles
- [ ] Links to external documentation
- [ ] Keyboard shortcut to open help (?)
- [ ] Search within help articles

---

# Phase 3: Mobile/Tablet & Performance Optimization (Weeks 9-12)

## CBP-P3-001: Responsive Touch Targets (48x48px Minimum)

**Priority:** High
**Estimated Effort:** 2 days
**Dependencies:** None
**Category:** Mobile Accessibility

### Objective
Ensure all interactive elements meet the WCAG 2.1 minimum touch target size of 48x48 CSS pixels for reliable touch interaction on mobile and tablet devices.

### Technical Specifications

#### 1. Touch Target Utilities
```css
/* src/styles/touch-targets.css */
/* Base touch target class */
.touch-target {
  min-width: 48px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Expand clickable area without changing visual size */
.touch-target-expanded {
  position: relative;
}

.touch-target-expanded::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 48px;
  min-height: 48px;
}

/* Mobile-specific overrides */
@media (pointer: coarse) {
  .btn-sm {
    min-height: 44px;
    padding-left: 16px;
    padding-right: 16px;
  }

  .icon-btn {
    min-width: 44px;
    min-height: 44px;
  }

  /* Increase spacing between adjacent touch targets */
  .touch-target-group > * + * {
    margin-left: 8px;
  }
}
```

#### 2. Updated Button Component
```tsx
// src/components/ui/button.tsx (modifications)
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md',
    'text-sm font-medium ring-offset-background transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    // Touch target minimum
    'min-h-[44px] md:min-h-[36px]' // 44px on mobile, 36px on desktop
  ),
  {
    variants: {
      size: {
        default: 'h-10 px-4 py-2 md:h-9',
        sm: 'h-9 px-3 md:h-8',
        lg: 'h-12 px-8 md:h-11',
        icon: 'h-11 w-11 md:h-10 md:w-10', // Larger on touch
      },
    },
  }
);
```

#### 3. Touch Target Audit Script
```ts
// scripts/audit-touch-targets.ts
import puppeteer from 'puppeteer';

async function auditTouchTargets(url: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 }); // iPhone viewport

  await page.goto(url);

  const violations = await page.evaluate(() => {
    const interactiveSelectors = 'button, a, input, select, textarea, [role="button"], [tabindex]';
    const elements = document.querySelectorAll(interactiveSelectors);
    const issues: Array<{ element: string; width: number; height: number }> = [];

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        issues.push({
          element: el.outerHTML.slice(0, 100),
          width: rect.width,
          height: rect.height,
        });
      }
    });

    return issues;
  });

  console.log(`Found ${violations.length} touch target violations`);
  violations.forEach((v) => {
    console.log(`- ${v.width}x${v.height}px: ${v.element}`);
  });

  await browser.close();
}
```

### Acceptance Criteria
- [ ] All buttons minimum 44x44px on touch devices
- [ ] Icon buttons have sufficient padding
- [ ] Adjacent targets have 8px minimum spacing
- [ ] Form inputs meet touch target requirements
- [ ] Audit script passes with zero violations

---

## CBP-P3-002: Bottom Navigation for Tablet Portrait

**Priority:** Medium
**Estimated Effort:** 2-3 days
**Dependencies:** CBP-P1-006
**Category:** Mobile UX

### Objective
Implement a bottom navigation bar for tablet portrait mode that provides thumb-friendly access to primary navigation items.

### Technical Specifications

```tsx
// src/components/layout/BottomNavigation.tsx
import { useLocation, Link } from 'react-router-dom';
import { Home, FileSpreadsheet, Search, User, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: FileSpreadsheet, label: 'BOMs', path: '/boms' },
  { icon: Search, label: 'Search', path: '/components/search' },
  { icon: User, label: 'Profile', path: '/settings/profile' },
  { icon: MoreHorizontal, label: 'More', path: '/menu' },
];

export function BottomNavigation() {
  const location = useLocation();
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1024px)');
  const isPortrait = useMediaQuery('(orientation: portrait)');

  if (!isTablet || !isPortrait) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-inset-bottom"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full',
                'min-w-[64px] px-2 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-6 w-6" aria-hidden="true" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### Acceptance Criteria
- [ ] Visible only on tablet in portrait mode
- [ ] 5 primary navigation items
- [ ] Active state indication
- [ ] Safe area padding for notched devices
- [ ] Accessible with screen readers

---

## CBP-P3-003: Swipe Gestures for BOM Actions

**Priority:** Medium
**Estimated Effort:** 3 days
**Dependencies:** None
**Category:** Mobile UX

### Objective
Implement touch-friendly swipe gestures on BOM list items to reveal quick actions (edit, delete, share) without requiring long-press or context menus.

### Technical Specifications

```tsx
// src/components/bom/SwipeableBomRow.tsx
import { useRef, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Edit, Trash2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableBomRowProps {
  bom: Bom;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  children: React.ReactNode;
}

export function SwipeableBomRow({
  bom,
  onEdit,
  onDelete,
  onShare,
  children,
}: SwipeableBomRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 80;
  const TOTAL_ACTIONS_WIDTH = ACTION_WIDTH * 3;

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (e.dir === 'Left') {
        const offset = Math.min(e.absX, TOTAL_ACTIONS_WIDTH);
        setSwipeOffset(-offset);
      }
    },
    onSwipedLeft: () => {
      if (Math.abs(swipeOffset) > TOTAL_ACTIONS_WIDTH / 2) {
        setSwipeOffset(-TOTAL_ACTIONS_WIDTH);
        setIsRevealed(true);
      } else {
        setSwipeOffset(0);
        setIsRevealed(false);
      }
    },
    onSwipedRight: () => {
      setSwipeOffset(0);
      setIsRevealed(false);
    },
    trackMouse: false,
    trackTouch: true,
  });

  const handleAction = (action: () => void) => {
    setSwipeOffset(0);
    setIsRevealed(false);
    action();
  };

  return (
    <div className="relative overflow-hidden" {...handlers}>
      {/* Action buttons (behind the row) */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button
          onClick={() => handleAction(onShare)}
          className="w-20 h-full bg-blue-500 text-white flex flex-col items-center justify-center"
          aria-label={`Share ${bom.name}`}
        >
          <Share2 className="h-5 w-5" />
          <span className="text-xs mt-1">Share</span>
        </button>
        <button
          onClick={() => handleAction(onEdit)}
          className="w-20 h-full bg-amber-500 text-white flex flex-col items-center justify-center"
          aria-label={`Edit ${bom.name}`}
        >
          <Edit className="h-5 w-5" />
          <span className="text-xs mt-1">Edit</span>
        </button>
        <button
          onClick={() => handleAction(onDelete)}
          className="w-20 h-full bg-red-500 text-white flex flex-col items-center justify-center"
          aria-label={`Delete ${bom.name}`}
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-xs mt-1">Delete</span>
        </button>
      </div>

      {/* Main row content */}
      <div
        ref={rowRef}
        className={cn(
          'relative bg-background transition-transform',
          isRevealed ? 'duration-0' : 'duration-200'
        )}
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
```

### Acceptance Criteria
- [ ] Swipe left reveals action buttons
- [ ] Smooth animation on swipe
- [ ] Snap to revealed/hidden states
- [ ] Actions work on touch and mouse
- [ ] Accessible alternatives (keyboard, screen reader)

---

## CBP-P3-004: Camera Integration for Mobile BOM Upload

**Priority:** High
**Estimated Effort:** 4 days
**Dependencies:** None
**Category:** Mobile Features

### Objective
Enable users to capture BOM spreadsheets using their device camera, with automatic document detection and perspective correction.

### Technical Specifications

```tsx
// src/components/bom/CameraUpload.tsx
import { useRef, useState, useCallback } from 'react';
import { Camera, X, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CameraUpload({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Camera access denied:', error);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx?.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
  }, []);

  const confirmCapture = useCallback(async () => {
    if (!capturedImage) return;

    setIsProcessing(true);
    try {
      // Convert base64 to File
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'bom-capture.jpg', { type: 'image/jpeg' });

      onCapture(file);
      stopCamera();
    } finally {
      setIsProcessing(false);
    }
  }, [capturedImage, onCapture, stopCamera]);

  return (
    <div className="relative">
      {!stream && !capturedImage && (
        <Button onClick={startCamera} className="w-full h-32">
          <Camera className="h-8 w-8 mr-2" />
          Capture BOM with Camera
        </Button>
      )}

      {stream && !capturedImage && (
        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Capture guide overlay */}
          <div className="absolute inset-4 border-2 border-white/50 rounded-lg pointer-events-none">
            <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-white" />
            <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-white" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-white" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-white" />
          </div>

          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
            <Button variant="secondary" onClick={stopCamera}>
              <X className="h-5 w-5" />
            </Button>
            <Button size="lg" onClick={captureImage} className="rounded-full w-16 h-16">
              <Camera className="h-8 w-8" />
            </Button>
          </div>
        </div>
      )}

      {capturedImage && (
        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
          <img
            src={capturedImage}
            alt="Captured BOM"
            className="w-full h-full object-cover"
          />

          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
            <Button variant="secondary" onClick={() => setCapturedImage(null)}>
              <RotateCcw className="h-5 w-5 mr-2" />
              Retake
            </Button>
            <Button onClick={confirmCapture} disabled={isProcessing}>
              <Check className="h-5 w-5 mr-2" />
              {isProcessing ? 'Processing...' : 'Use Photo'}
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
```

### Acceptance Criteria
- [ ] Access device camera (prefer rear)
- [ ] Real-time preview with capture guide
- [ ] Capture and preview image
- [ ] Retake option
- [ ] Process captured image for upload
- [ ] Graceful fallback if camera unavailable

---

## CBP-P3-005: Code Splitting & Lazy Loading Routes

**Priority:** Critical
**Estimated Effort:** 2-3 days
**Dependencies:** None
**Category:** Performance

### Objective
Implement route-based code splitting to reduce initial bundle size and improve time-to-interactive, targeting < 200KB initial JS payload.

### Technical Specifications

```tsx
// src/routes/lazy-routes.tsx
import { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy load all page components
const Dashboard = lazy(() => import('@/pages/dashboard'));
const BomList = lazy(() => import('@/pages/boms/list'));
const BomDetail = lazy(() => import('@/pages/boms/show'));
const BomUpload = lazy(() => import('@/pages/boms/upload'));
const ComponentSearch = lazy(() => import('@/pages/components/search'));
const ComponentCompare = lazy(() => import('@/pages/components/compare'));
const Settings = lazy(() => import('@/pages/settings'));
const Portfolio = lazy(() => import('@/pages/portfolio'));

// Preload critical routes
export function preloadCriticalRoutes() {
  // Preload after initial render
  requestIdleCallback(() => {
    import('@/pages/boms/list');
    import('@/pages/dashboard');
  });
}

// Route wrapper with suspense
function LazyRoute({ component: Component }: { component: React.LazyExoticComponent<any> }) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        }
      >
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <LazyRoute component={Dashboard} /> },
  { path: '/boms', element: <LazyRoute component={BomList} /> },
  { path: '/boms/:id', element: <LazyRoute component={BomDetail} /> },
  { path: '/boms/upload', element: <LazyRoute component={BomUpload} /> },
  { path: '/components/search', element: <LazyRoute component={ComponentSearch} /> },
  { path: '/components/compare', element: <LazyRoute component={ComponentCompare} /> },
  { path: '/settings/*', element: <LazyRoute component={Settings} /> },
  { path: '/portfolio/*', element: <LazyRoute component={Portfolio} /> },
];
```

#### Vite Configuration for Chunking
```ts
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-refine': ['@refinedev/core', '@refinedev/react-router-v6'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],

          // Feature chunks
          'feature-bom': [
            './src/pages/boms/list.tsx',
            './src/pages/boms/show.tsx',
            './src/pages/boms/upload.tsx',
          ],
          'feature-components': [
            './src/pages/components/search.tsx',
            './src/pages/components/compare.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 250, // KB
  },
});
```

### Acceptance Criteria
- [ ] Initial JS bundle < 200KB (gzipped)
- [ ] Routes lazy loaded on navigation
- [ ] Critical routes preloaded after initial render
- [ ] Loading state during chunk loading
- [ ] Error boundary for failed chunk loads
- [ ] Vendor code in separate chunks

---

## CBP-P3-006: Client-Side Caching Strategy

**Priority:** High
**Estimated Effort:** 3 days
**Dependencies:** None
**Category:** Performance

### Objective
Implement a comprehensive client-side caching strategy using TanStack Query with appropriate stale times, cache invalidation, and offline support.

### Technical Specifications

```ts
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale time: 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache time: 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 3;
      },
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Optimistic updates enabled by default
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// Cache key factories for consistency
export const queryKeys = {
  boms: {
    all: ['boms'] as const,
    lists: () => [...queryKeys.boms.all, 'list'] as const,
    list: (filters: BomFilters) => [...queryKeys.boms.lists(), filters] as const,
    details: () => [...queryKeys.boms.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.boms.details(), id] as const,
  },
  components: {
    all: ['components'] as const,
    search: (query: string, filters: ComponentFilters) =>
      [...queryKeys.components.all, 'search', query, filters] as const,
    detail: (id: string) => [...queryKeys.components.all, 'detail', id] as const,
  },
  user: {
    current: ['user', 'current'] as const,
    profile: ['user', 'profile'] as const,
  },
};

// Custom hooks with optimized caching
export function useBomList(filters: BomFilters) {
  return useQuery({
    queryKey: queryKeys.boms.list(filters),
    queryFn: () => fetchBoms(filters),
    staleTime: 2 * 60 * 1000, // BOMs list: 2 minutes
    placeholderData: keepPreviousData, // Keep showing old data while fetching
  });
}

export function useBomDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.boms.detail(id),
    queryFn: () => fetchBom(id),
    staleTime: 5 * 60 * 1000, // BOM detail: 5 minutes
    enabled: !!id,
  });
}

export function useComponentSearch(query: string, filters: ComponentFilters) {
  return useQuery({
    queryKey: queryKeys.components.search(query, filters),
    queryFn: () => searchComponents(query, filters),
    staleTime: 10 * 60 * 1000, // Component search: 10 minutes (data changes less)
    enabled: query.length >= 2,
  });
}
```

### Acceptance Criteria
- [ ] Consistent cache key structure
- [ ] Appropriate stale times per resource
- [ ] Background refetch on window focus
- [ ] Optimistic updates for mutations
- [ ] Cache invalidation on mutations
- [ ] Placeholder data during refetch

---

## CBP-P3-007: Image & Asset Optimization

**Priority:** High
**Estimated Effort:** 2 days
**Dependencies:** None
**Category:** Performance

### Objective
Optimize image loading with lazy loading, responsive sizes, WebP/AVIF formats, and placeholder states to improve perceived performance.

### Technical Specifications

```tsx
// src/components/ui/optimized-image.tsx
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Start loading 200px before visible
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  // Generate srcset for responsive images
  const generateSrcSet = (baseSrc: string) => {
    const widths = [320, 640, 960, 1280, 1920];
    return widths
      .map((w) => `${getResizedUrl(baseSrc, w)} ${w}w`)
      .join(', ');
  };

  return (
    <div
      ref={imgRef}
      className={cn('relative overflow-hidden', className)}
      style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
    >
      {/* Blur placeholder */}
      {placeholder === 'blur' && blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110"
          aria-hidden="true"
        />
      )}

      {/* Skeleton placeholder */}
      {placeholder === 'empty' && !isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Main image */}
      {isInView && (
        <picture>
          {/* AVIF (smallest, best quality) */}
          <source
            type="image/avif"
            srcSet={generateSrcSet(src.replace(/\.[^.]+$/, '.avif'))}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* WebP (good support) */}
          <source
            type="image/webp"
            srcSet={generateSrcSet(src.replace(/\.[^.]+$/, '.webp'))}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* Fallback */}
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
          />
        </picture>
      )}
    </div>
  );
}
```

### Acceptance Criteria
- [ ] Images lazy load by default
- [ ] WebP and AVIF format support
- [ ] Responsive srcset generation
- [ ] Blur or skeleton placeholder
- [ ] Priority loading option for above-fold
- [ ] Smooth fade-in on load

---

## CBP-P3-008: First-Time User Onboarding Flow

**Priority:** High
**Estimated Effort:** 4 days
**Dependencies:** None
**Category:** UX

### Objective
Create an interactive onboarding experience for new users that guides them through key features and helps them complete their first BOM upload.

### Technical Specifications

```tsx
// src/components/onboarding/OnboardingProvider.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for highlight
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
  nextTrigger?: 'click' | 'custom';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to CBP!',
    description: 'Let\'s take a quick tour to help you get started with BOM management.',
    target: 'body',
    placement: 'bottom',
  },
  {
    id: 'upload',
    title: 'Upload Your First BOM',
    description: 'Click here to upload a BOM file. We support Excel, CSV, and more.',
    target: '[data-onboarding="upload-btn"]',
    placement: 'bottom',
    nextTrigger: 'click',
  },
  {
    id: 'enrichment',
    title: 'Automatic Enrichment',
    description: 'Once uploaded, we\'ll automatically enrich your BOM with pricing, stock, and specifications.',
    target: '[data-onboarding="enrichment-status"]',
    placement: 'left',
  },
  {
    id: 'search',
    title: 'Component Search',
    description: 'Search our database of millions of components with parametric filters.',
    target: '[data-onboarding="search-input"]',
    placement: 'bottom',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You now know the basics. Need help? Click the ? icon anytime.',
    target: '[data-onboarding="help-btn"]',
    placement: 'left',
  },
];

interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  currentStepData: OnboardingStep | null;
  startOnboarding: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('cbp-onboarding-complete');
    const isNewUser = !localStorage.getItem('cbp-has-visited');

    if (!hasCompletedOnboarding && isNewUser) {
      // Delay to let the app render first
      setTimeout(() => setIsActive(true), 1000);
    }

    localStorage.setItem('cbp-has-visited', 'true');
  }, []);

  const startOnboarding = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const skipOnboarding = () => {
    setIsActive(false);
    localStorage.setItem('cbp-onboarding-complete', 'true');
  };

  const completeOnboarding = () => {
    setIsActive(false);
    localStorage.setItem('cbp-onboarding-complete', 'true');
  };

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStep,
        currentStepData: ONBOARDING_STEPS[currentStep] || null,
        startOnboarding,
        nextStep,
        skipOnboarding,
        completeOnboarding,
      }}
    >
      {children}
      {isActive && <OnboardingOverlay />}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
};
```

### Acceptance Criteria
- [ ] Starts automatically for new users
- [ ] Highlights target elements
- [ ] Step-by-step progression
- [ ] Skip option available
- [ ] Progress indicator
- [ ] Persists completion state
- [ ] Can be restarted from settings

---

## CBP-P3-009: Skeleton Loading States

**Priority:** Medium
**Estimated Effort:** 2 days
**Dependencies:** None
**Category:** UX

### Objective
Implement content-aware skeleton loading states for all data-driven components to improve perceived performance.

### Technical Specifications

```tsx
// src/components/ui/skeleton.tsx
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: number | string;
  height?: number | string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-muted',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded',
        variant === 'rectangular' && 'rounded-md',
        animation === 'pulse' && 'animate-pulse',
        animation === 'wave' && 'animate-shimmer',
        className
      )}
      style={{ width, height }}
    />
  );
}

// Pre-built skeleton patterns
export function BomCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="h-5 w-40" />
        <Skeleton variant="circular" className="h-8 w-8" />
      </div>
      <Skeleton variant="text" className="h-4 w-full" />
      <Skeleton variant="text" className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
}

export function BomTableRowSkeleton() {
  return (
    <tr className="border-b">
      <td className="p-4"><Skeleton className="h-4 w-8" /></td>
      <td className="p-4"><Skeleton variant="text" className="h-4 w-32" /></td>
      <td className="p-4"><Skeleton variant="text" className="h-4 w-24" /></td>
      <td className="p-4"><Skeleton variant="text" className="h-4 w-full" /></td>
      <td className="p-4"><Skeleton className="h-4 w-12" /></td>
      <td className="p-4"><Skeleton className="h-6 w-20" /></td>
    </tr>
  );
}

export function DashboardWidgetSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton variant="text" className="h-6 w-20" />
          <Skeleton variant="text" className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
```

### Acceptance Criteria
- [ ] Skeleton matches content layout
- [ ] Smooth pulse animation
- [ ] Multiple pre-built patterns
- [ ] Customizable dimensions
- [ ] Proper ARIA attributes

---

## CBP-P3-010: Service Worker & Offline Caching

**Priority:** Medium
**Estimated Effort:** 3 days
**Dependencies:** CBP-P3-006
**Category:** Performance

### Objective
Implement a service worker for offline support, asset caching, and background sync capabilities.

### Technical Specifications

```ts
// src/sw.ts (Service Worker)
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cache static assets (JS, CSS, fonts)
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// Network-first for API calls with fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Background sync for failed mutations
const bgSyncPlugin = new BackgroundSyncPlugin('mutationQueue', {
  maxRetentionTime: 24 * 60, // 24 hours
});

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') && request.method !== 'GET',
  new NetworkFirst({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

// Offline fallback page
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('offline').then((cache) => cache.add(OFFLINE_URL))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL)
      )
    );
  }
});
```

### Acceptance Criteria
- [ ] Static assets cached for offline use
- [ ] API responses cached with expiration
- [ ] Background sync for failed mutations
- [ ] Offline fallback page
- [ ] Cache cleanup on update
- [ ] Update notification to user

---

# Phase 4: Polish & Excellence (Weeks 13-16)

## CBP-P4-001: Design Token System

**Priority:** Medium
**Estimated Effort:** 3 days
**Dependencies:** None
**Category:** Design System

### Objective
Establish a comprehensive design token system for colors, typography, spacing, and motion that ensures visual consistency and enables theme customization.

### Technical Specifications

```ts
// src/design-tokens/tokens.ts
export const tokens = {
  colors: {
    // Brand colors
    brand: {
      primary: {
        50: 'hsl(221 83% 97%)',
        100: 'hsl(221 83% 94%)',
        500: 'hsl(221 83% 53%)', // Main brand
        600: 'hsl(221 83% 47%)',
        700: 'hsl(221 83% 41%)',
      },
    },
    // Semantic colors
    semantic: {
      success: 'hsl(142 71% 45%)',
      warning: 'hsl(38 92% 50%)',
      error: 'hsl(0 84% 60%)',
      info: 'hsl(199 89% 48%)',
    },
    // Neutral scale
    neutral: {
      0: 'hsl(0 0% 100%)',
      50: 'hsl(210 20% 98%)',
      100: 'hsl(220 14% 96%)',
      200: 'hsl(220 13% 91%)',
      300: 'hsl(216 12% 84%)',
      400: 'hsl(218 11% 65%)',
      500: 'hsl(220 9% 46%)',
      600: 'hsl(215 14% 34%)',
      700: 'hsl(217 19% 27%)',
      800: 'hsl(215 28% 17%)',
      900: 'hsl(221 39% 11%)',
      950: 'hsl(224 71% 4%)',
    },
  },
  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, Menlo, monospace',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',  // 2px
    DEFAULT: '0.375rem', // 6px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  motion: {
    duration: {
      instant: '0ms',
      fast: '100ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};
```

### Acceptance Criteria
- [ ] Complete color token scale
- [ ] Typography system defined
- [ ] Spacing scale documented
- [ ] Motion tokens for animations
- [ ] Dark mode variants
- [ ] Tailwind config integration

---

## CBP-P4-002: Advanced Micro-Animations

**Priority:** Low
**Estimated Effort:** 2-3 days
**Dependencies:** CBP-P4-001
**Category:** UX Polish

### Objective
Add subtle micro-animations to improve user feedback and create a more polished, engaging interface.

### Technical Specifications

```tsx
// src/components/ui/animated-components.tsx
import { motion, AnimatePresence } from 'framer-motion';

// Animated button with press feedback
export function AnimatedButton({ children, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// Success checkmark animation
export function SuccessCheck() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-green-500"
      initial="hidden"
      animate="visible"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        variants={{
          hidden: { pathLength: 0 },
          visible: { pathLength: 1, transition: { duration: 0.3 } },
        }}
      />
      <motion.path
        d="M8 12l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{
          hidden: { pathLength: 0 },
          visible: { pathLength: 1, transition: { delay: 0.3, duration: 0.2 } },
        }}
      />
    </motion.svg>
  );
}

// Staggered list animation
export function AnimatedList({ children, stagger = 0.05 }) {
  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: stagger,
          },
        },
      }}
    >
      {children}
    </motion.ul>
  );
}

export function AnimatedListItem({ children }) {
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.li>
  );
}

// Number counter animation
export function AnimatedNumber({ value, duration = 1 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(displayValue, value, {
      duration,
      onUpdate: (v) => setDisplayValue(Math.round(v)),
    });
    return controls.stop;
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}
```

### Acceptance Criteria
- [ ] Button press feedback
- [ ] Success/error state animations
- [ ] Staggered list entrance
- [ ] Number count-up animation
- [ ] Page transition animations
- [ ] Respects reduced-motion preference

---

## CBP-P4-003: PWA with Offline Support

**Priority:** Medium
**Estimated Effort:** 2-3 days
**Dependencies:** CBP-P3-010
**Category:** Features

### Objective
Configure the application as a Progressive Web App with installability, app-like navigation, and enhanced offline capabilities.

### Technical Specifications

```json
// public/manifest.json
{
  "name": "Customer BOM Portal",
  "short_name": "CBP",
  "description": "Professional BOM management and component sourcing",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-1.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile-1.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "shortcuts": [
    {
      "name": "Upload BOM",
      "short_name": "Upload",
      "url": "/boms/upload",
      "icons": [{ "src": "/icons/upload-96.png", "sizes": "96x96" }]
    },
    {
      "name": "Search Components",
      "short_name": "Search",
      "url": "/components/search",
      "icons": [{ "src": "/icons/search-96.png", "sizes": "96x96" }]
    }
  ],
  "categories": ["business", "productivity"],
  "share_target": {
    "action": "/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [
        {
          "name": "bom",
          "accept": [".xlsx", ".xls", ".csv"]
        }
      ]
    }
  }
}
```

### Acceptance Criteria
- [ ] Installable on desktop and mobile
- [ ] App shortcuts for quick actions
- [ ] Share target for BOM files
- [ ] Offline page with cached data
- [ ] Update notification to user
- [ ] App icon with badge support

---

## CBP-P4-004: Push Notifications Integration

**Priority:** Low
**Estimated Effort:** 2 days
**Dependencies:** CBP-P4-003
**Category:** Features

### Objective
Implement push notifications for enrichment completion, risk alerts, and team activity updates.

### Technical Specifications

```ts
// src/services/notifications/push-service.ts
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Send subscription to server
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await subscription.unsubscribe();
    await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }
}
```

### Acceptance Criteria
- [ ] Permission request with explanation
- [ ] Subscription management
- [ ] Notification preferences UI
- [ ] Enrichment completion notifications
- [ ] Risk alert notifications
- [ ] Team activity notifications

---

## CBP-P4-005: Comprehensive Security Testing

**Priority:** Critical
**Estimated Effort:** 4 days
**Dependencies:** All Phase 1-3
**Category:** Security

### Objective
Conduct comprehensive security testing including penetration testing, vulnerability scanning, and security audit to ensure the application meets enterprise security standards.

### Technical Specifications

```yaml
# security-test-plan.yaml
security_testing:
  automated_scans:
    - tool: OWASP ZAP
      target: https://staging.cbp.ananta.com
      type: full-scan
      checks:
        - sql_injection
        - xss
        - csrf
        - broken_auth
        - sensitive_data_exposure

    - tool: npm audit
      frequency: on-commit
      severity_threshold: moderate

    - tool: Snyk
      monitors:
        - dependencies
        - docker_images
        - iac

  manual_tests:
    authentication:
      - test: Token tampering
        description: Modify JWT payload and verify rejection
      - test: Session fixation
        description: Attempt to reuse sessions across users
      - test: Password brute force
        description: Verify rate limiting on login

    authorization:
      - test: IDOR
        description: Access other users' BOMs via ID manipulation
      - test: Role escalation
        description: Attempt to access admin endpoints as user
      - test: Cross-tenant access
        description: Access data from other organizations

    input_validation:
      - test: XSS in BOM names
        description: Inject scripts via BOM metadata
      - test: SQL injection in search
        description: Attempt SQL injection in component search
      - test: File upload bypass
        description: Upload malicious file types

    api_security:
      - test: Rate limiting
        description: Verify API rate limits enforced
      - test: CORS policy
        description: Verify CORS rejects unauthorized origins
      - test: Content-Type validation
        description: Verify strict content-type enforcement

  compliance_checks:
    - OWASP Top 10 (2021)
    - CWE/SANS Top 25
    - SOC 2 Type II requirements
    - GDPR data handling

  reporting:
    format: markdown
    severity_levels: [critical, high, medium, low, info]
    include:
      - vulnerability_description
      - reproduction_steps
      - risk_assessment
      - remediation_guidance
```

### Acceptance Criteria
- [ ] OWASP ZAP scan passes with no high/critical
- [ ] npm audit shows no high+ vulnerabilities
- [ ] Manual penetration tests documented
- [ ] All OWASP Top 10 addressed
- [ ] Security report generated
- [ ] Remediation plan for findings

---

## CBP-P4-006: Load Testing & Performance Optimization

**Priority:** High
**Estimated Effort:** 3 days
**Dependencies:** All Phase 1-3
**Category:** Performance

### Objective
Conduct load testing to validate performance under expected and peak loads, identify bottlenecks, and optimize critical paths.

### Technical Specifications

```ts
// k6-load-test.ts
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    // Smoke test
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
    },
    // Load test
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 50 },   // Ramp up
        { duration: '10m', target: 50 },  // Steady state
        { duration: '5m', target: 0 },    // Ramp down
      ],
    },
    // Stress test
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
    },
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '30s', target: 500 }, // Spike!
        { duration: '1m', target: 10 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    errors: ['rate<0.01'], // Error rate < 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://staging.cbp.ananta.com';

export default function () {
  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'loadtest@example.com',
    password: 'LoadTest123!',
  });
  check(loginRes, { 'login successful': (r) => r.status === 200 });
  const token = loginRes.json('access_token');

  const headers = { Authorization: `Bearer ${token}` };

  // Get BOMs list
  const bomsRes = http.get(`${BASE_URL}/api/boms`, { headers });
  check(bomsRes, {
    'boms list status 200': (r) => r.status === 200,
    'boms list < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Search components
  const searchRes = http.get(
    `${BASE_URL}/api/components/search?q=capacitor&limit=50`,
    { headers }
  );
  check(searchRes, {
    'search status 200': (r) => r.status === 200,
    'search < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);

  errorRate.add(bomsRes.status !== 200 || searchRes.status !== 200);
}
```

### Acceptance Criteria
- [ ] API p95 latency < 500ms under load
- [ ] Error rate < 1% under normal load
- [ ] System handles 200 concurrent users
- [ ] Graceful degradation under spike
- [ ] Performance report generated
- [ ] Bottlenecks identified and documented

---

## CBP-P4-007: Documentation & Storybook

**Priority:** Medium
**Estimated Effort:** 3 days
**Dependencies:** All Components
**Category:** Documentation

### Objective
Create comprehensive component documentation using Storybook with interactive examples, accessibility notes, and usage guidelines.

### Technical Specifications

```tsx
// src/stories/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Primary interactive element for user actions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Size preset',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available button variants for different use cases.',
      },
    },
  },
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button>
        <Mail className="mr-2 h-4 w-4" />
        Login with Email
      </Button>
      <Button variant="outline" size="icon">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <Button disabled>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Please wait
    </Button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Loading state with spinner icon and disabled interaction.',
      },
    },
  },
};
```

### Acceptance Criteria
- [ ] All UI components documented
- [ ] Interactive controls for props
- [ ] Usage guidelines included
- [ ] Accessibility notes
- [ ] Dark mode preview
- [ ] Responsive preview

---

## CBP-P4-008: Final QA & Release Preparation

**Priority:** Critical
**Estimated Effort:** 4 days
**Dependencies:** All Phases
**Category:** Quality Assurance

### Objective
Conduct final quality assurance testing, prepare release documentation, and ensure production readiness.

### Technical Specifications

```yaml
# release-checklist.yaml
pre_release_checklist:
  code_quality:
    - [ ] All TypeScript strict mode errors resolved
    - [ ] ESLint passes with zero warnings
    - [ ] No console.log statements in production code
    - [ ] All TODO comments addressed or ticketed

  testing:
    - [ ] Unit test coverage > 80%
    - [ ] E2E tests pass on all browsers (Chrome, Firefox, Safari, Edge)
    - [ ] Mobile testing complete (iOS Safari, Android Chrome)
    - [ ] Accessibility audit passes (axe-core)
    - [ ] Performance audit passes (Lighthouse > 90)

  security:
    - [ ] Security scan complete with no high/critical issues
    - [ ] Dependencies up to date
    - [ ] CSP headers configured
    - [ ] HTTPS enforced

  documentation:
    - [ ] README updated
    - [ ] API documentation current
    - [ ] Storybook deployed
    - [ ] Release notes drafted

  infrastructure:
    - [ ] Environment variables documented
    - [ ] Database migrations tested
    - [ ] Rollback procedure documented
    - [ ] Monitoring dashboards configured
    - [ ] Alert thresholds set

  final_verification:
    - [ ] Smoke test on staging
    - [ ] User acceptance testing signed off
    - [ ] Performance baseline established
    - [ ] Backup verified

release_artifacts:
  - CHANGELOG.md
  - RELEASE_NOTES.md
  - migration_guide.md
  - rollback_procedure.md
```

### Acceptance Criteria
- [ ] All checklist items complete
- [ ] Zero critical/high bugs
- [ ] Stakeholder sign-off obtained
- [ ] Release notes published
- [ ] Rollback tested
- [ ] Monitoring configured

---

# Appendix

## Implementation Priority Matrix

| Priority | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|----------|---------|---------|---------|---------|
| Critical | P1-001, P1-002, P1-003, P1-004, P1-005 | - | P3-005 | P4-005, P4-008 |
| High | P1-006, P1-007, P1-008, P1-009, P1-010 | P2-001, P2-002, P2-004, P2-005, P2-007 | P3-001, P3-004, P3-006, P3-007, P3-008 | P4-006 |
| Medium | - | P2-003, P2-006, P2-008, P2-009, P2-010 | P3-002, P3-003, P3-009, P3-010 | P4-001, P4-003, P4-007 |
| Low | - | - | - | P4-002, P4-004 |

## Estimated Total Effort

| Phase | Prompts | Est. Days | Focus |
|-------|---------|-----------|-------|
| 1 | 10 | 25-30 | UX Foundations & Security |
| 2 | 10 | 30-35 | Features & Search |
| 3 | 10 | 25-30 | Mobile & Performance |
| 4 | 8 | 20-25 | Polish & Quality |
| **Total** | **38** | **100-120** | - |

## Success Metrics

- **Accessibility**: WCAG 2.1 AA compliance (100%)
- **Performance**: Lighthouse score > 90
- **Security**: Zero high/critical vulnerabilities
- **Test Coverage**: > 80% unit, > 70% integration
- **User Satisfaction**: NPS > 50 post-launch
