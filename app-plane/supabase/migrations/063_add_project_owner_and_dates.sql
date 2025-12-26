-- Migration: Add project_owner_id, visibility, and start_date to projects table
-- These columns support the Edit form fields
-- End date intentionally NOT added (not needed for BOM projects per user request)

-- Add project_owner_id column (references users table, defaults to created_by)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_owner_id uuid REFERENCES users(id);

-- Set default value for project_owner_id to match created_by for existing rows
UPDATE projects SET project_owner_id = created_by WHERE project_owner_id IS NULL;

-- Add visibility column with default 'private'
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'internal', 'public'));

-- Add start_date column with default to current date
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE;

-- Set start_date for existing projects to created_at date
UPDATE projects SET start_date = created_at::date WHERE start_date IS NULL;

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON projects TO authenticated;

-- Add index for project_owner_id lookups
CREATE INDEX IF NOT EXISTS idx_projects_project_owner_id ON projects(project_owner_id);

COMMENT ON COLUMN projects.project_owner_id IS 'User who owns this project (defaults to creator)';
COMMENT ON COLUMN projects.visibility IS 'Project visibility: private, internal, or public';
COMMENT ON COLUMN projects.start_date IS 'Project start date (auto-populated on creation)';
