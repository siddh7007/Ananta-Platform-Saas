-- Migration: Fix boms status check constraint
-- Date: 2025-12-03
-- Description: Add missing status values to boms_status_check constraint

-- Drop the existing constraint
ALTER TABLE boms DROP CONSTRAINT IF EXISTS boms_status_check;

-- Add the updated constraint with all valid status values
ALTER TABLE boms ADD CONSTRAINT boms_status_check
CHECK (status IN (
    'pending',
    'analyzing',
    'completed',
    'failed',
    'processing',
    'cancelled',
    'enriching',
    'mapping_pending'
));

COMMENT ON CONSTRAINT boms_status_check ON boms IS 'Valid BOM status values including cancelled for stop functionality';
