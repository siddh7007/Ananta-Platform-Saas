# ProjectSelector Quick Reference

## Usage

```typescript
import { ProjectSelector } from '@/components/projects/ProjectSelector';

// In your layout/header:
<ProjectSelector />
```

## Props

**None required** - Component uses internal hooks and localStorage

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `current_project_id` | string | UUID of selected project |
| `current_project_name` | string | Display name of selected project |

## Reading Selected Project

```typescript
// Anywhere in your code:
const currentProjectId = localStorage.getItem('current_project_id');
const currentProjectName = localStorage.getItem('current_project_name');

if (currentProjectId) {
  // Use project ID for API calls
  await uploadBOM(bomFile, currentProjectId);
}
```

## Programmatic Selection

```typescript
// To set a project programmatically:
localStorage.setItem('current_project_id', projectId);
localStorage.setItem('current_project_name', projectName);

// Emit event for cross-tab sync:
window.dispatchEvent(
  new StorageEvent('storage', {
    key: 'current_project_id',
    newValue: projectId,
    url: window.location.href,
  })
);
```

## Clearing Selection

```typescript
// To clear project selection:
localStorage.removeItem('current_project_id');
localStorage.removeItem('current_project_name');
```

## Component States

| State | Visual |
|-------|--------|
| No selection | Dashed border, "Select Project" text |
| Selected | Solid border, project name |
| Loading | Skeleton with pulse animation |
| Error | Red border, alert icon |
| No projects | "Create Project" button (engineer+) |

## RBAC

- **All users**: Can view and switch projects
- **Engineer+**: Can create new projects
- **Admin+**: Can access project settings (not in selector)

## Integration Points

- **BOM Upload**: Reads `current_project_id` for uploads
- **Projects Sidebar**: Independent but uses same data source
- **Tenant Context**: Auto-reloads when workspace changes

## Hooks Used

- `useProjects()` - Fetches project list
- `useAuth()` - Role-based access control
- `useNavigate()` - Navigation to project creation

## Troubleshooting

### Project not showing after creation

```typescript
// Invalidate projects cache to refetch:
import { useInvalidateProjects } from '@/hooks/useProjects';
const invalidateProjects = useInvalidateProjects();
invalidateProjects();
```

### Selection not persisting

Check localStorage is enabled:
```typescript
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
  // localStorage works
} catch (e) {
  // localStorage blocked (private browsing, etc.)
}
```

### Stale project showing (deleted project)

Component auto-clears stale selections on mount. If you need manual clear:
```typescript
localStorage.removeItem('current_project_id');
localStorage.removeItem('current_project_name');
window.location.reload();
```

## Styling Customization

Component uses Tailwind utilities with design tokens:

```typescript
// Customize via CSS variables in your theme:
--border: ...;       // Border color
--card: ...;         // Background
--primary: ...;      // Selected state, badges
--destructive: ...;  // Error state
--muted: ...;        // Hover background
```

## Event Listeners

Listen for project selection changes:

```typescript
window.addEventListener('storage', (event) => {
  if (event.key === 'current_project_id') {
    const newProjectId = event.newValue;
    // Handle project change
    console.log('Project changed to:', newProjectId);
  }
});
```

**Note**: `storage` event only fires in OTHER tabs, not the tab that made the change.

## API Integration

Component fetches from CNS API:

```typescript
GET /api/projects?workspace_id={workspaceId}&include=uploadStats
```

Response format:
```typescript
{
  items: [
    {
      id: string,
      name: string,
      description?: string,
      uploadsCount?: number,
      status: 'active' | 'archived' | 'on_hold' | 'completed'
    }
  ],
  total: number
}
```

## File Locations

| File | Purpose |
|------|---------|
| `src/components/projects/ProjectSelector.tsx` | Main component |
| `src/components/projects/index.ts` | Barrel export |
| `src/components/layout/Layout.tsx` | Integration in AppBar |
| `src/hooks/useProjects.ts` | Data fetching hook |

## Common Patterns

### Check if project selected before action

```typescript
const currentProjectId = localStorage.getItem('current_project_id');

if (!currentProjectId) {
  toast.error('Please select a project first');
  return;
}

// Proceed with action
await performAction(currentProjectId);
```

### Navigate to project after creation

```typescript
const navigate = useNavigate();

const handleProjectCreated = (newProject) => {
  // Set as current project
  localStorage.setItem('current_project_id', newProject.id);
  localStorage.setItem('current_project_name', newProject.name);

  // Navigate to project detail
  navigate(`/projects/${newProject.id}`);
};
```

### Display current project in breadcrumbs

```typescript
const currentProjectName = localStorage.getItem('current_project_name');

<Breadcrumbs>
  <BreadcrumbItem href="/">Home</BreadcrumbItem>
  {currentProjectName && (
    <BreadcrumbItem href="/projects">
      {currentProjectName}
    </BreadcrumbItem>
  )}
  <BreadcrumbItem>Upload BOM</BreadcrumbItem>
</Breadcrumbs>
```

## Performance Tips

1. **React Query caching**: Projects cached for 2 minutes
2. **Placeholder data**: Prevents loading flicker on re-render
3. **Conditional search**: Search input only shown for 5+ projects
4. **Lazy dropdown**: Dropdown content only rendered when open
5. **Event debouncing**: Search uses native input (no external debounce)

## Accessibility

- Fully keyboard navigable (Tab, Enter, Escape)
- Screen reader friendly (proper ARIA labels)
- High contrast support
- Focus visible on all interactive elements

## Testing

### Manual Testing

1. Open app in browser
2. Look for ProjectSelector in top-right AppBar
3. Click dropdown → Should see project list
4. Select project → Name should show in selector
5. Refresh page → Selection should persist
6. Clear selection → Should return to "Select Project"

### E2E Testing

```typescript
// Playwright/Cypress example
await page.click('[aria-label*="Current project"]');
await page.click('text=PCB Design 2024');
expect(await page.textContent('.project-selector')).toContain('PCB Design 2024');
```

## Version

- **Version**: 1.0.0
- **Last Updated**: 2025-12-18
- **Status**: Production Ready ✓
