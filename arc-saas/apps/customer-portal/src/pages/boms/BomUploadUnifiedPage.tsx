/**
 * BOM Upload Unified Page
 *
 * This is the new unified BOM upload page with vertical stepper UI.
 * Replaces the old multi-step BomUpload.tsx with a cleaner, more visual workflow.
 *
 * Route: /boms/upload-unified or /boms/upload (when fully migrated)
 *
 * Features:
 * - Vertical stepper showing 7 workflow steps on the left
 * - Progressive queue cards showing upload/enrichment/analysis/complete on the right
 * - Auto-scroll to active step
 * - Pause/resume at any point
 * - Navigate back to completed steps
 * - Real-time progress via SSE and Temporal workflow integration
 */

import { BomUploadUnified } from '@/components/bom/unified';

export function BomUploadUnifiedPage() {
  return (
    <BomUploadUnified
      onComplete={(bomId) => {
        console.log('[BomUploadUnifiedPage] Upload complete:', bomId);
      }}
    />
  );
}

export default BomUploadUnifiedPage;
