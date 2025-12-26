-- Update boms table status constraint to include all statuses used by enrichment workflow
-- Created: 2025-11-14
-- Fixes: Database constraint violation when setting status to 'ANALYZING', 'paused', or 'cancelled'

-- Drop the old constraint
ALTER TABLE boms DROP CONSTRAINT IF EXISTS boms_status_check;

-- Add new constraint with all valid statuses
ALTER TABLE boms ADD CONSTRAINT boms_v2_status_check CHECK (
  status IN (
    'PENDING',      -- Initial state after upload
    'ANALYZING',    -- Enrichment in progress
    'COMPLETED',    -- Enrichment completed successfully
    'FAILED',       -- Enrichment failed
    'paused',       -- Enrichment paused by user
    'cancelled'     -- Enrichment cancelled by user
  )
);

-- Update any existing 'enriching' statuses to 'ANALYZING' (if any exist)
UPDATE boms SET status = 'ANALYZING' WHERE status = 'enriching';
