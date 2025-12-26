# Project Management UI/UX Improvement Plan

## Executive Summary

This document provides a comprehensive UI/UX analysis and improvement plan for the **Projects** section of the Customer Portal. Projects serve as organizational containers for BOMs within workspaces, following the hierarchy: **Organization → Workspace → Project → BOM**.

### Current State Overview

**Architecture:**
- **6 Pages Implemented:**
  - `ProjectList` - Browse all projects in current workspace
  - `ProjectDetail` - View project overview + associated BOMs
  - `ProjectCreate` - Create new project with workspace auto-selection
  - `ProjectBomUpload` - Upload BOM with project context pre-set
  - `ProjectBomList` - List BOMs filtered by project
  - `ProjectSettings` - Configure project metadata, archive, delete

**Current Pain Points:**
1. **Empty mock data** - All project pages show empty states (no API integration visible)
2. **Limited project metadata** - Missing tags, team assignment, due dates in UI
3. **No bulk operations** - Cannot move multiple BOMs, archive multiple projects
4. **Weak project→BOM relationship** - BOM upload doesn't clearly associate with project
5. **Missing project dashboard** - No visual overview of project health, progress, risks
6. **No project templates** - Users start from scratch every time
7. **Limited collaboration features** - No team assignment, notifications, or activity feeds

---

## User Journey Mapping

### Journey 1: Create First Project (New User)

**Current Flow:**
1. Click "Projects" in sidebar
2. See empty state with "No Projects Yet"
3. Click "Create Project" button
4. Fill form (name, description required; workspace auto-selected)
5. Click "Save" → Redirected to project list

**Pain Points:**
- ❌ No onboarding guidance ("What is a project?")
- ❌ Workspace selection hidden
- ❌ No examples or templates
- ❌ User doesn't know next step (upload BOM?)

**Improved Flow:**
1. Click "Projects" → See empty state with **contextual help**
2. Click "Create Project" → **Wizard-style form** with steps:
   - **Step 1:** Choose template (Blank, Hardware Design, PCB Assembly)
   - **Step 2:** Basic info (name, description, tags)
   - **Step 3:** Team & Settings (assign owner, set due date)
3. Click "Create" → **Slide-in panel** with next actions:
   - "Upload First BOM"
   - "Invite Team Member"
   - "Set Project Goal"

---

### Journey 2: Upload BOM to Project

**Current Flow:**
1. Navigate to project detail
2. Click "Upload BOM" button
3. Redirected to `/projects/:id/bom/upload`
4. localStorage sets `current_project_id`
5. Standard BOM upload flow

**Pain Points:**
- ❌ Project context lost during upload (no breadcrumb)
- ❌ localStorage hackish (should be route param or context)
- ❌ No confirmation that BOM was added to project
- ❌ Cannot upload multiple BOMs at once

**Improved Flow:**
1. Navigate to project detail
2. Click "Upload BOM" → **Modal overlay** stays on project page
3. **Drag-drop zone** with project name displayed at top
4. Upload progress shows in modal
5. After upload, **toast notification** + BOM appears in project's BOM list

---

### Journey 3: Organize Existing BOMs into Projects

**Current Flow:**
- ❌ **Not possible!** Cannot move BOM from one project to another

**Improved Flow:**
1. Navigate to "BOMs" list (global view)
2. Select BOMs (checkbox multi-select)
3. Click "Move to Project" in bulk actions
4. **Slide-over panel** with project search/filter
5. Confirm move → BOMs reassigned

---

### Journey 4: Monitor Project Progress

**Current Flow:**
1. Navigate to project detail
2. See 3 metadata cards (Status, Created, Last Updated)
3. See list of BOMs below
4. ❌ No visual dashboard or progress metrics

**Improved Flow:**
1. Navigate to project detail
2. **Dashboard section** shows:
   - **Progress ring chart** (BOMs uploaded, enriched, reviewed)
   - **Risk heatmap** (high/medium/low across all BOMs)
   - **Timeline view** (when BOMs were added)
   - **Top issues** (unenriched lines, missing data, high-risk components)
3. **Activity feed** shows recent actions

---

## Prioritized Recommendations

### P0 - Critical UX Blockers

| Item | Description | Impact | Effort |
|------|-------------|--------|--------|
| **P0-1** | **API Integration** - Replace mock data with real project API calls | High | Medium |
| **P0-2** | **Project-BOM Association** - Fix localStorage hack; use React Context | High | Low |
| **P0-3** | **Empty State Guidance** - Add contextual help and templates | Medium | Low |
| **P0-4** | **Breadcrumb Navigation** - Show hierarchy (Projects → Project Name → BOMs) | Medium | Low |

### P1 - High-Value Enhancements

| Item | Description | Impact | Effort |
|------|-------------|--------|--------|
| **P1-1** | **Project Dashboard** - Add stats cards (total components, enrichment %, risk summary) | High | Medium |
| **P1-2** | **BOM Move Operation** - Allow moving BOMs between projects | High | Medium |
| **P1-3** | **Project Templates** - Predefined templates (PCB Design, Sensor Module) | Medium | Medium |
| **P1-4** | **Advanced Filters** - Filter projects by status, date range, tags | Medium | Low |
| **P1-5** | **Grid/List Toggle** - Let users choose between card grid and table view | Low | Low |

### P2 - Quality of Life

| Item | Description | Impact | Effort |
|------|-------------|--------|--------|
| **P2-1** | **Activity Timeline** - Show project history | Medium | High |
| **P2-2** | **Bulk Operations** - Archive, delete, export multiple projects | Medium | Medium |
| **P2-3** | **Project Duplication** - Clone existing project | Medium | Low |
| **P2-4** | **Color/Icon Customization** - Personalize project appearance | Low | Low |

### P3 - Advanced Features

| Item | Description | Impact | Effort |
|------|-------------|--------|--------|
| **P3-1** | **Team Assignment** - Add/remove team members with roles | High | High |
| **P3-2** | **Notification System** - Email/in-app notifications for project events | High | High |
| **P3-3** | **Milestone Tracking** - Define and track project goals/deadlines | Medium | High |
| **P3-4** | **Project Export/Import** - Backup projects as JSON/Excel | Low | Medium |

---

## Wireframe Descriptions

### 1. Enhanced Project List Page

```
┌─────────────────────────────────────────────────────────────────┐
│ Projects                                   [Filters ▼] [+ Create]│
├─────────────────────────────────────────────────────────────────┤
│ [Search projects...]                       [Grid☑] [List]       │
│                                                                   │
│ Filter: [All Status ▼] [All Teams ▼] [Date Range ▼] [Tags ▼]   │
│                                                                   │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│ │ 🔵 PCB   │  │ 🟢 Sensor│  │ 🟣 Power │  │ 🟠 Legacy│         │
│ │ Design   │  │ Module   │  │ Supply   │  │ Products │         │
│ │          │  │          │  │          │  │          │         │
│ │ 12 BOMs  │  │ 5 BOMs   │  │ 3 BOMs   │  │ 8 BOMs   │         │
│ │ 85% ✓    │  │ 100% ✓   │  │ 40% ⚠    │  │ Archived │         │
│ │ Due: 3d  │  │ Due: 10d │  │ Due: 1d  │  │          │         │
│ │ Alice,Bob│  │ Carol    │  │ Dave     │  │ Alice    │         │
│ └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Project Detail Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Projects / PCB Design Project                  [⋮ Settings]   │
├─────────────────────────────────────────────────────────────────┤
│ 🔵 PCB Design Project                                            │
│ Next-gen IoT device PCB with integrated sensors                 │
│                                                                   │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐       │
│ │ 📊 Progress │ ⚠️ Risk     │ 👥 Team     │ 📅 Timeline │       │
│ │   [85%]     │   Medium    │   4 members │  Due in 3d  │       │
│ └─────────────┴─────────────┴─────────────┴─────────────┘       │
│                                                                   │
│ ━━ BOMs (12) ━━━━━━━━━━━━━━━━━━━━━━━━━━ [Upload] [Bulk Upload] │
│ ✓ Main PCB BOM          1,245 lines  100%  ✓ Low      2h ago    │
│ ⚡ Power Supply BOM       234 lines   85%  ⚠ Medium   5h ago    │
│ ⏸ Sensor Array BOM       456 lines   40%  ⚠️ High    1d ago    │
│                                                                   │
│ ━━ Activity ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ • Alice uploaded "Main PCB BOM" - 2 hours ago                    │
│ • Enrichment completed for "Power Supply BOM" - 5 hours ago      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration with BOM Upload Workflow

### Current Approach (localStorage)
```typescript
// ProjectBomUpload sets:
localStorage.setItem('current_project_id', projectId);

// BomUpload reads:
const projectId = localStorage.getItem('current_project_id');
```

**Issues:**
- Cleared on logout, incognito, browser crash
- No UI feedback showing project name
- Cannot change project mid-upload

### Proposed Approach (React Context)

```typescript
// src/contexts/ProjectUploadContext.tsx
interface ProjectUploadContext {
  projectId: string | null;
  projectName: string | null;
  setProject: (id: string, name: string) => void;
  clearProject: () => void;
}

// Usage in BomUpload.tsx
const { projectId, projectName } = useProjectUploadContext();

{projectName && (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-3">
    <p className="text-sm">
      Uploading to project: <strong>{projectName}</strong>
      <button onClick={clearProject}>Change</button>
    </p>
  </div>
)}
```

---

## Success Metrics

### Engagement Metrics

| Metric | Current | Target (3 months) |
|--------|---------|-------------------|
| Projects created per org | 0 (mock) | 5+ |
| BOMs per project (avg) | N/A | 8+ |
| Projects with ≥1 team member | 0% | 40% |
| Projects using templates | 0% | 60% |
| BOM move operations per week | 0 | 20+ |

### Performance Metrics

| Metric | Target |
|--------|--------|
| Time to create first project | <60s |
| Project detail page load time | <500ms |
| Project list render time (50 projects) | <200ms |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Connect project pages to real API
- [ ] Replace localStorage with React Context
- [ ] Add empty state guidance + tooltips
- [ ] Implement breadcrumb navigation

### Phase 2: Core Features (Week 3-4)
- [ ] Build project dashboard with stats cards
- [ ] Implement BOM move operation
- [ ] Create 3 project templates
- [ ] Add advanced filters

### Phase 3: Collaboration (Week 5-6)
- [ ] Team assignment UI
- [ ] Notification system
- [ ] Activity timeline
- [ ] Bulk operations

### Phase 4: Polish (Week 7-8)
- [ ] Project duplication
- [ ] Color/icon customization
- [ ] Milestone tracking
- [ ] Project export/import

---

**File Locations:**
- **Pages:** `src/pages/projects/`
- **Hooks:** `src/hooks/useProjects.ts`
- **Types:** `src/types/workspace.ts`
