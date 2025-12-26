# Archived BOM Upload Components

**Date Archived:** 2025-11-09

## Files in This Folder

### BOMUploadSimple.tsx (15KB)
**Status:** DISABLED
**Reason:** Uses Django backend on port 27200 which doesn't exist in V2 architecture
**Backend URL:** `http://localhost:27200/api` (INCORRECT)
**Should Use:** CNS service via Traefik routing

### BOMUploadWizard.tsx (39KB)
**Status:** NOT USED
**Reason:** Not referenced in App.tsx, never imported
**Similar to:** BOMUploadWorkflow.tsx (the active component)
**Notes:** Had column mapping display UI added, but was never integrated into routing

## Active Component

**BOMUploadWorkflow.tsx** is the ONLY active BOM upload component:
- Used in App.tsx route: `/bom/upload`
- Has column mapping display UI
- Properly integrated with CNS service
- Multi-file upload support with queue management

## Safe to Delete?

Yes, both archived components can be safely deleted:
1. BOMUploadSimple.tsx - Uses non-existent backend
2. BOMUploadWizard.tsx - Not imported or used anywhere

## Export Changes

The `index.ts` file was updated to export `BOMUploadWorkflow` instead of `BOMUploadWizard`.
