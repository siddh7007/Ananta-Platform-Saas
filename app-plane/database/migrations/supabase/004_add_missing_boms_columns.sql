-- Migration: Add missing enrichment tracking columns to boms table
-- Date: 2026-01-11
-- Reason: December 27 dump was missing critical columns required by CNS service
--
-- This migration adds columns that exist in the master schema (033_master_supabase_schema_complete.sql)
-- but were missing from the December 27 database dump.

-- Fix enrichment_progress: should be JSONB, not INTEGER
-- Drop if exists (in case it was added as wrong type)
ALTER TABLE boms DROP COLUMN IF EXISTS enrichment_progress;

-- Add enrichment_progress as JSONB with default structure
ALTER TABLE boms ADD COLUMN IF NOT EXISTS enrichment_progress JSONB
    DEFAULT '{"total_items": 0, "enriched_items": 0, "failed_items": 0, "pending_items": 0, "last_updated": null}'::jsonb;

-- Add analyzed_at timestamp (when BOM analysis completed)
ALTER TABLE boms ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Verify columns were added correctly
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'boms'
  AND column_name IN ('enrichment_progress', 'analyzed_at')
ORDER BY column_name;
