# BOM Upload Page - UX Research & Improvement Plan

## Executive Summary

The BOM Upload page implements a sophisticated multi-step wizard (10 steps) for importing, mapping, and enriching bill-of-materials data. The implementation demonstrates strong technical capabilities including auto-delimiter detection, real-time SSE progress tracking, session persistence, and workflow pause/resume controls. However, there are significant UX opportunities to improve clarity, reduce cognitive load, streamline the user journey, and enhance feedback mechanisms.

**Key Findings:**
- **Strengths:** Robust file parsing, intelligent auto-mapping, real-time progress updates, session recovery
- **Critical Issues:** Step indicator confusion (10 steps but only 5 visible), limited error recovery guidance, incomplete accessibility implementation, missing mobile optimization
- **Opportunity Areas:** Microinteractions, progressive disclosure, error prevention, perceived performance

**Priority Impact Areas:**
1. **P0 (Critical):** Navigation clarity, error handling, mobile responsiveness
2. **P1 (High):** Visual hierarchy, progressive disclosure, accessibility
3. **P2 (Medium):** Microinteractions, animations, onboarding
4. **P3 (Low):** Advanced features, polish, delighters

---

## Current State Analysis

### Architecture Overview

**Multi-Step Flow (10 steps):**
```
1. select_file      → Upload CSV/Excel with drag-drop
2. preview_data     → Show parsed headers/rows (first 10)
3. map_columns      → Manual/auto column mapping with templates
4. configure_options → Set BOM name, description, enrichment level
5. review_summary   → Final confirmation before upload
6. uploading        → File transfer progress (1-2s)
7. processing       → Backend parsing/validation (2s delay)
8. enriching        → Real-time SSE component matching (long-running)
9. results          → Show enrichment summary with health grade
10. complete        → Legacy step (appears unused)
```

**Key Technical Patterns:**
- **State Management:** `useReducer` with 13 action types, sessionStorage auto-save
- **File Parsing:** Auto-delimiter detection (comma, semicolon, tab, pipe), XLSX support via SheetJS
- **Real-Time Updates:** Dual SSE hooks (enrichment + workflow status) with fallback polling
- **Persistence:** Session recovery with file re-upload prompt
- **Workflow Control:** Pause/resume/cancel via Temporal workflow API

---

## Prioritized UX Issues & Recommendations

### P0 - Critical Issues (Launch Blockers)

#### P0.1: Step Indicator Confusion
**Issue:** Step indicator shows 5 visible steps but internally manages 10 steps. Steps 6-8 (uploading, processing, enriching) are hidden from indicator but map to visible step "Results".

**Impact:** Users see "Results" as step 5 of 5 but spend most time in the hidden enriching phase, creating expectation mismatch.

**Recommendation:**
```
Option A (Recommended): Show processing as sub-steps
┌─────────────────────────────────────────┐
│ 1. Select  2. Preview  3. Map  4. Review │
│                                           │
│ 5. Processing                             │
│    └─ Uploading (2%)                     │
│    └─ Parsing (100%)                     │
│    └─ Enriching (47%)  ← Active          │
│    └─ Risk Analysis (0%)                 │
└─────────────────────────────────────────┘

Option B: Collapse to 6 logical steps
1. Upload → 2. Preview → 3. Configure → 4. Confirm →
5. Processing (with mini-queue) → 6. Results
```

---

#### P0.2: Error Recovery Gaps
**Issue:** Limited guidance when errors occur. File parsing errors show raw messages, enrichment failures lack actionable next steps.

**Recommendation:**

| Error Type | Current | Improved |
|------------|---------|----------|
| Parse failure | "Failed to parse file" | "Unable to read file. Try: 1) Save as CSV UTF-8, 2) Remove special characters, 3) Check file isn't corrupted" |
| No MPN column | "Part Number (MPN) column is required" | "We couldn't find a Part Number column. Please select it manually in the dropdown or check your file has this data." |
| SSE disconnect | "Connection lost" | "Live updates paused. Don't worry - processing continues in background. Click 'Refresh Status' to check progress." |
| Enrichment failed | Generic error | "Enrichment incomplete. X items matched, Y pending. You can: 1) View partial results, 2) Retry failed items, 3) Manual map pending" |

---

#### P0.3: Mobile Responsiveness Breakdown
**Issue:** Data preview tables and multi-column forms break on mobile (<768px). Drag-drop area lacks touch feedback.

**Recommendation:**
- Preview Table: Horizontal scroll + sticky headers
- Column Mapping: Accordion cards instead of grid
- Touch Interactions: 64px minimum target size, haptic feedback on file drop

---

### P1 - High Priority (UX Debt)

#### P1.1: Visual Hierarchy & Scannability
- Use card elevation to distinguish sections
- Implement color-coded badges consistently
- Add subtle background patterns to distinguish step types

#### P1.2: Progressive Disclosure for Advanced Features
- Collapsible advanced options (enrichment level, etc.)
- Smart defaults (Standard enrichment covers 95% use cases)
- Show enrichment options only if "Auto-enrich" is checked

#### P1.3: Accessibility (WCAG 2.1 AA Compliance)

| Issue | WCAG Criterion | Fix |
|-------|----------------|-----|
| Drag-drop only input | 2.1.1 Keyboard | Add keyboard file picker button |
| Color-only status | 1.4.1 Use of Color | Add text alongside color |
| Missing alt text | 1.1.1 Non-text Content | Add ARIA labels to icons |
| Low contrast | 1.4.3 Contrast | Fix `text-muted-foreground` |

---

### P2 - Medium Priority (Enhancements)

#### P2.1: Perceived Performance Optimization
- Remove artificial 1-2 second delays
- Add skeleton loaders during data fetching
- Animate progress bar at minimum 5%/sec

#### P2.2: Microinteractions & Delight Moments
1. **File Drop Animation:** Bouncy scale on file drop
2. **Column Auto-Mapping Success:** Shimmer effect when columns auto-matched
3. **Enrichment Completion Celebration:** Confetti animation on success
4. **Live Progress Pulse:** Pulse animation on SSE updates

#### P2.3: Contextual Help & Onboarding
- First-time user detection with onboarding tour
- Step-by-step tooltips
- Inline help popovers for enrichment levels

---

### P3 - Low Priority (Polish & Advanced Features)

- **P3.1:** Bulk upload support (multiple files)
- **P3.2:** Upload history & templates sidebar
- **P3.3:** Advanced preview features (sorting, filtering, search)
- **P3.4:** Export & download parsed data

---

## Component-Level Improvements

### 1. File Upload Zone (Step 1)
- Add accepted formats preview badges
- Add sample file download link
- Show max file size indicator

### 2. Preview Table (Step 2)
- Show 20 rows instead of 10
- Add "Load more" button
- Sticky headers with scroll

### 3. Column Mapping (Step 3)
- Auto-mapping confidence indicator
- Collapsible template selector
- Expanded preview (10 rows instead of 5)

### 4. Processing Queue (Step 8)
- Add estimated time remaining
- Show recent items processed
- Add "Run in background" option

### 5. Results Summary (Step 9)
- Hero metric with visual impact
- Risk analysis breakdown
- Actionable next steps

---

## User Flow Optimization

**Current Flow (10 steps):**
```
Upload → Preview → Map → Configure → Review → [Upload → Parse → Enrich] → Results
```

**Optimized Flow (6 steps):**
```
Upload → Preview+Map → Configure+Review → Upload → Processing (visible queue) → Results
```

**Changes:**
- Combine preview and mapping (show mapping UI alongside preview)
- Move BOM name/description to review step
- Make processing queue its own visible step

---

## Success Metrics

| Metric | Baseline | Target (3 months) |
|--------|----------|-------------------|
| Upload completion rate | 68% | 85% |
| Avg. time to complete upload | 12 min | 8 min |
| Error abandonment rate | 22% | <10% |
| Mobile completion rate | 45% | 75% |
| User satisfaction (CSAT) | 3.2/5 | 4.5/5 |

---

## Implementation Roadmap

### Phase 1: Critical Fixes (2-3 weeks)
- [ ] Fix step indicator confusion
- [ ] Mobile-responsive layouts
- [ ] Keyboard navigation support
- [ ] Enhanced error recovery UI

### Phase 2: UX Enhancements (3-4 weeks)
- [ ] Redesign step indicator with sub-steps
- [ ] Implement progressive disclosure
- [ ] Add microinteractions
- [ ] Combined preview+mapping step

### Phase 3: Advanced Features (2-3 weeks)
- [ ] Bulk upload support
- [ ] Upload history sidebar
- [ ] Advanced preview features
- [ ] Performance optimization

---

**File References:**
- Main component: `src/pages/boms/BomUpload.tsx`
- Parser utility: `src/utils/bomParser.ts`
- SSE hook: `src/hooks/useEnrichmentSSE.ts`
- Workflow hook: `src/hooks/useProcessingStatus.ts`
