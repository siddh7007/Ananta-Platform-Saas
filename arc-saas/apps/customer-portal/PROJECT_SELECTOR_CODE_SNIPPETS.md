# ProjectSelector Code Snippets

Quick copy-paste code examples for working with ProjectSelector.

## Basic Usage

### Import and Use in Layout

```typescript
import { ProjectSelector } from '@/components/projects/ProjectSelector';

export function Layout() {
  return (
    <header>
      <TenantSelector />
      <ProjectSelector />
      <UserAvatar />
    </header>
  );
}
```

## Reading Current Project

### In a Component

```typescript
import { useState, useEffect } from 'react';

export function BomUpload() {
  const [currentProject, setCurrentProject] = useState<{
    id: string | null;
    name: string | null;
  }>({
    id: localStorage.getItem('current_project_id'),
    name: localStorage.getItem('current_project_name'),
  });

  useEffect(() => {
    // Listen for project changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_project_id') {
        setCurrentProject({
          id: e.newValue,
          name: localStorage.getItem('current_project_name'),
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div>
      <h1>Upload BOM</h1>
      {currentProject.id ? (
        <p>Current project: {currentProject.name}</p>
      ) : (
        <p>No project selected</p>
      )}
    </div>
  );
}
```

### In a Hook

```typescript
import { useState, useEffect } from 'react';

export function useCurrentProject() {
  const [projectId, setProjectId] = useState<string | null>(
    localStorage.getItem('current_project_id')
  );
  const [projectName, setProjectName] = useState<string | null>(
    localStorage.getItem('current_project_name')
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_project_id') {
        setProjectId(e.newValue);
      } else if (e.key === 'current_project_name') {
        setProjectName(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { projectId, projectName };
}

// Usage:
function MyComponent() {
  const { projectId, projectName } = useCurrentProject();
  // ...
}
```

## Setting Current Project

### Programmatically Select Project

```typescript
export function setCurrentProject(projectId: string, projectName: string) {
  // Update localStorage
  localStorage.setItem('current_project_id', projectId);
  localStorage.setItem('current_project_name', projectName);

  // Emit event for cross-tab sync
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'current_project_id',
      newValue: projectId,
      url: window.location.href,
    })
  );

  console.log('[ProjectSelector] Project set:', { projectId, projectName });
}

// Usage:
setCurrentProject('proj-123', 'My New Project');
```

### Clear Project Selection

```typescript
export function clearCurrentProject() {
  localStorage.removeItem('current_project_id');
  localStorage.removeItem('current_project_name');

  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'current_project_id',
      newValue: null,
      url: window.location.href,
    })
  );

  console.log('[ProjectSelector] Project selection cleared');
}

// Usage:
clearCurrentProject();
```

## Validation Helpers

### Check if Project Selected

```typescript
export function isProjectSelected(): boolean {
  return !!localStorage.getItem('current_project_id');
}

// Usage:
if (!isProjectSelected()) {
  toast.error('Please select a project first');
  return;
}
```

### Require Project Selection

```typescript
export function requireProject(onError?: () => void): string | null {
  const projectId = localStorage.getItem('current_project_id');

  if (!projectId) {
    const projectName = localStorage.getItem('current_project_name');
    console.error('[requireProject] No project selected');

    if (onError) {
      onError();
    } else {
      alert('Please select a project before continuing');
    }

    return null;
  }

  return projectId;
}

// Usage:
const projectId = requireProject(() => {
  toast.error('Please select a project from the top bar');
});

if (!projectId) return;

// Proceed with projectId
```

## Form Integration

### BOM Upload Form with Project Check

```typescript
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';

export function BomUploadForm() {
  const { toast } = useToast();
  const form = useForm();

  const handleSubmit = async (data: FormData) => {
    // Check project selection
    const projectId = localStorage.getItem('current_project_id');
    const projectName = localStorage.getItem('current_project_name');

    if (!projectId) {
      toast({
        title: 'No project selected',
        description: 'Please select a project from the top bar before uploading',
        variant: 'destructive',
      });
      return;
    }

    // Confirm with user
    const confirmed = confirm(
      `Upload BOM to project "${projectName}"?`
    );

    if (!confirmed) return;

    // Proceed with upload
    try {
      await uploadBOM(data.file, projectId);
      toast({
        title: 'Success',
        description: `BOM uploaded to ${projectName}`,
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      <input type="file" {...form.register('file')} />
      <button type="submit">Upload</button>
    </form>
  );
}
```

## Display Components

### Project Badge in Header

```typescript
export function ProjectBadge() {
  const [projectName, setProjectName] = useState<string | null>(
    localStorage.getItem('current_project_name')
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_project_name') {
        setProjectName(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (!projectName) return null;

  return (
    <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-sm">
      <FolderKanban className="h-4 w-4 text-primary" />
      <span className="font-medium text-primary">{projectName}</span>
    </div>
  );
}
```

### Project Context Display

```typescript
export function ProjectContextDisplay() {
  const projectId = localStorage.getItem('current_project_id');
  const projectName = localStorage.getItem('current_project_name');

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Current Project
      </h3>
      {projectId ? (
        <div className="mt-2">
          <p className="font-semibold">{projectName}</p>
          <p className="text-xs text-muted-foreground">{projectId}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No project selected
        </p>
      )}
    </div>
  );
}
```

## API Integration

### Upload with Project Context

```typescript
import { platformApi } from '@/lib/axios';

export async function uploadBOMToCurrentProject(file: File) {
  const projectId = localStorage.getItem('current_project_id');

  if (!projectId) {
    throw new Error('No project selected');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);

  try {
    const response = await platformApi.post('/bom/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('[uploadBOMToCurrentProject] Failed:', error);
    throw error;
  }
}

// Usage:
try {
  const result = await uploadBOMToCurrentProject(file);
  console.log('BOM uploaded:', result);
} catch (error) {
  alert('Upload failed: ' + error.message);
}
```

### Fetch Project-Specific Data

```typescript
import { cnsApi } from '@/lib/axios';

export async function fetchProjectBOMs() {
  const projectId = localStorage.getItem('current_project_id');

  if (!projectId) {
    return [];
  }

  try {
    const response = await cnsApi.get(`/boms?project_id=${projectId}`);
    return response.data.items || [];
  } catch (error) {
    console.error('[fetchProjectBOMs] Failed:', error);
    return [];
  }
}
```

## React Query Integration

### Query with Project Context

```typescript
import { useQuery } from '@tanstack/react-query';
import { cnsApi } from '@/lib/axios';

export function useProjectBOMs() {
  const projectId = localStorage.getItem('current_project_id');

  return useQuery({
    queryKey: ['boms', projectId],
    queryFn: async () => {
      if (!projectId) {
        return [];
      }

      const response = await cnsApi.get(`/boms?project_id=${projectId}`);
      return response.data.items || [];
    },
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Usage:
function BOMList() {
  const { data: boms, isLoading, error } = useProjectBOMs();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!boms?.length) return <div>No BOMs found</div>;

  return (
    <ul>
      {boms.map((bom) => (
        <li key={bom.id}>{bom.name}</li>
      ))}
    </ul>
  );
}
```

## Navigation Patterns

### Navigate to Project-Specific Page

```typescript
import { useNavigate } from 'react-router-dom';

export function NavigateToProjectBOMs() {
  const navigate = useNavigate();

  const goToProjectBOMs = () => {
    const projectId = localStorage.getItem('current_project_id');

    if (!projectId) {
      alert('Please select a project first');
      return;
    }

    navigate(`/projects/${projectId}/boms`);
  };

  return <button onClick={goToProjectBOMs}>View Project BOMs</button>;
}
```

### Auto-Select Project on Creation

```typescript
import { useNavigate } from 'react-router-dom';
import { useCreateProject } from '@/hooks/useProjects';

export function CreateProjectForm() {
  const navigate = useNavigate();
  const { mutateAsync: createProject } = useCreateProject();

  const handleSubmit = async (data: ProjectInput) => {
    try {
      const newProject = await createProject(data);

      // Auto-select the new project
      localStorage.setItem('current_project_id', newProject.id);
      localStorage.setItem('current_project_name', newProject.name);

      // Navigate to project detail
      navigate(`/projects/${newProject.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Testing Utilities

### Mock Project Selection

```typescript
// For unit tests
export function mockProjectSelection(
  projectId: string = 'test-project-123',
  projectName: string = 'Test Project'
) {
  localStorage.setItem('current_project_id', projectId);
  localStorage.setItem('current_project_name', projectName);
}

export function clearMockProjectSelection() {
  localStorage.removeItem('current_project_id');
  localStorage.removeItem('current_project_name');
}

// Usage in tests:
describe('BomUpload', () => {
  beforeEach(() => {
    mockProjectSelection();
  });

  afterEach(() => {
    clearMockProjectSelection();
  });

  test('uploads BOM to selected project', () => {
    // ...
  });
});
```

### E2E Test Helpers

```typescript
// Playwright/Cypress helper
export async function selectProjectInE2E(page, projectName: string) {
  // Open dropdown
  await page.click('[aria-label*="Current project"]');

  // Search if needed
  const searchInput = await page.$('input[placeholder*="Search projects"]');
  if (searchInput) {
    await searchInput.fill(projectName);
  }

  // Select project
  await page.click(`text=${projectName}`);

  // Wait for dropdown to close
  await page.waitForSelector('[aria-label*="Current project"]', {
    state: 'visible',
  });
}
```

## TypeScript Types

### Project Selection Types

```typescript
export interface ProjectSelection {
  id: string;
  name: string;
}

export interface ProjectSelectorState {
  currentProject: ProjectSelection | null;
  isOpen: boolean;
  searchQuery: string;
}

export type ProjectStorageKeys = {
  id: 'current_project_id';
  name: 'current_project_name';
};

export const PROJECT_STORAGE_KEYS: ProjectStorageKeys = {
  id: 'current_project_id',
  name: 'current_project_name',
};
```

## Error Handling

### Robust Project Access

```typescript
export function getCurrentProject(): ProjectSelection | null {
  try {
    const id = localStorage.getItem('current_project_id');
    const name = localStorage.getItem('current_project_name');

    if (!id || !name) {
      return null;
    }

    return { id, name };
  } catch (error) {
    console.error('[getCurrentProject] localStorage error:', error);
    return null;
  }
}

// Usage:
const project = getCurrentProject();
if (!project) {
  // Handle no project case
  return;
}
// Use project.id and project.name
```

---

**Code Snippets Version:** 1.0.0
**Last Updated:** 2025-12-18
