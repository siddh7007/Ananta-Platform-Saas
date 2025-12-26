-- Migration: Add automatic BOM counter updates for projects
-- Date: 2025-11-06
-- Purpose: Automatically update total_boms, completed_boms, and in_progress_boms counters

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS bom_project_counters ON boms_v2;
DROP FUNCTION IF EXISTS update_project_bom_counters();

-- Create trigger function to update project BOM counters
CREATE OR REPLACE FUNCTION update_project_bom_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: New BOM added to project
  IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL THEN
    UPDATE projects_v2 SET
      total_boms = total_boms + 1,
      completed_boms = completed_boms + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
      in_progress_boms = in_progress_boms + CASE WHEN NEW.status IN ('analyzing', 'pending') THEN 1 ELSE 0 END,
      last_activity_at = NOW()
    WHERE id = NEW.project_id;

    RETURN NEW;
  END IF;

  -- UPDATE: BOM status changed or project reassigned
  IF TG_OP = 'UPDATE' THEN
    -- Case 1: Status changed (same project)
    IF OLD.project_id = NEW.project_id AND OLD.project_id IS NOT NULL AND OLD.status != NEW.status THEN
      UPDATE projects_v2 SET
        completed_boms = completed_boms + CASE
          WHEN NEW.status = 'completed' AND OLD.status != 'completed' THEN 1
          WHEN NEW.status != 'completed' AND OLD.status = 'completed' THEN -1
          ELSE 0 END,
        in_progress_boms = in_progress_boms + CASE
          WHEN NEW.status IN ('analyzing', 'pending') AND OLD.status NOT IN ('analyzing', 'pending') THEN 1
          WHEN NEW.status NOT IN ('analyzing', 'pending') AND OLD.status IN ('analyzing', 'pending') THEN -1
          ELSE 0 END,
        last_activity_at = NOW()
      WHERE id = OLD.project_id;
    END IF;

    -- Case 2: Project changed (reassignment)
    IF (OLD.project_id IS DISTINCT FROM NEW.project_id) THEN
      -- Decrement old project counters
      IF OLD.project_id IS NOT NULL THEN
        UPDATE projects_v2 SET
          total_boms = GREATEST(total_boms - 1, 0),
          completed_boms = GREATEST(completed_boms - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END, 0),
          in_progress_boms = GREATEST(in_progress_boms - CASE WHEN OLD.status IN ('analyzing', 'pending') THEN 1 ELSE 0 END, 0)
        WHERE id = OLD.project_id;
      END IF;

      -- Increment new project counters
      IF NEW.project_id IS NOT NULL THEN
        UPDATE projects_v2 SET
          total_boms = total_boms + 1,
          completed_boms = completed_boms + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
          in_progress_boms = in_progress_boms + CASE WHEN NEW.status IN ('analyzing', 'pending') THEN 1 ELSE 0 END,
          last_activity_at = NOW()
        WHERE id = NEW.project_id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- DELETE: BOM removed from project
  IF TG_OP = 'DELETE' AND OLD.project_id IS NOT NULL THEN
    UPDATE projects_v2 SET
      total_boms = GREATEST(total_boms - 1, 0),
      completed_boms = GREATEST(completed_boms - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END, 0),
      in_progress_boms = GREATEST(in_progress_boms - CASE WHEN OLD.status IN ('analyzing', 'pending') THEN 1 ELSE 0 END, 0)
    WHERE id = OLD.project_id;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on boms_v2 table
CREATE TRIGGER bom_project_counters
  AFTER INSERT OR UPDATE OR DELETE ON boms_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_project_bom_counters();

-- Recalculate all existing project counters
UPDATE projects_v2 p SET
  total_boms = COALESCE((SELECT COUNT(*) FROM boms_v2 WHERE project_id = p.id), 0),
  completed_boms = COALESCE((SELECT COUNT(*) FROM boms_v2 WHERE project_id = p.id AND status = 'completed'), 0),
  in_progress_boms = COALESCE((SELECT COUNT(*) FROM boms_v2 WHERE project_id = p.id AND status IN ('analyzing', 'pending')), 0);

-- Verify trigger was created
SELECT
  tgname as trigger_name,
  tgtype as trigger_type,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'bom_project_counters';
