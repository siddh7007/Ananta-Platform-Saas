-- Create views to map resource names to _v2 tables
-- Created: 2025-11-19
-- Purpose: Allow React Admin resources to use clean names (projects, boms, alerts)
--          while underlying tables have _v2 suffix

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.projects CASCADE;
DROP VIEW IF EXISTS public.boms CASCADE;
DROP VIEW IF EXISTS public.alerts CASCADE;
DROP VIEW IF EXISTS public.bom_line_items CASCADE;

-- Create view: projects → projects_v2
CREATE OR REPLACE VIEW public.projects AS
SELECT * FROM public.projects_v2;

-- Create view: boms → boms_v2
CREATE OR REPLACE VIEW public.boms AS
SELECT * FROM public.boms_v2;

-- Create view: alerts → alerts_v2
CREATE OR REPLACE VIEW public.alerts AS
SELECT * FROM public.alerts_v2;

-- Create view: bom_line_items → bom_line_items_v2
CREATE OR REPLACE VIEW public.bom_line_items AS
SELECT * FROM public.bom_line_items_v2;

-- Grant permissions on views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_line_items TO anon, authenticated;

-- Note: Views need INSTEAD OF triggers for INSERT/UPDATE/DELETE operations
-- Create triggers for projects
CREATE OR REPLACE FUNCTION public.projects_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.projects_v2 VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_insert_trigger
  INSTEAD OF INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_insert();

CREATE OR REPLACE FUNCTION public.projects_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.projects_v2 SET ROW = NEW.* WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_update_trigger
  INSTEAD OF UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_update();

CREATE OR REPLACE FUNCTION public.projects_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.projects_v2 WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_delete_trigger
  INSTEAD OF DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_delete();

-- Create triggers for boms
CREATE OR REPLACE FUNCTION public.boms_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.boms_v2 VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boms_insert_trigger
  INSTEAD OF INSERT ON public.boms
  FOR EACH ROW EXECUTE FUNCTION public.boms_insert();

CREATE OR REPLACE FUNCTION public.boms_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.boms_v2 SET ROW = NEW.* WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boms_update_trigger
  INSTEAD OF UPDATE ON public.boms
  FOR EACH ROW EXECUTE FUNCTION public.boms_update();

CREATE OR REPLACE FUNCTION public.boms_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.boms_v2 WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boms_delete_trigger
  INSTEAD OF DELETE ON public.boms
  FOR EACH ROW EXECUTE FUNCTION public.boms_delete();

-- Create triggers for alerts
CREATE OR REPLACE FUNCTION public.alerts_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.alerts_v2 VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_insert_trigger
  INSTEAD OF INSERT ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.alerts_insert();

CREATE OR REPLACE FUNCTION public.alerts_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.alerts_v2 SET ROW = NEW.* WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_update_trigger
  INSTEAD OF UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.alerts_update();

CREATE OR REPLACE FUNCTION public.alerts_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.alerts_v2 WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_delete_trigger
  INSTEAD OF DELETE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.alerts_delete();

-- Create triggers for bom_line_items
CREATE OR REPLACE FUNCTION public.bom_line_items_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.bom_line_items_v2 VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bom_line_items_insert_trigger
  INSTEAD OF INSERT ON public.bom_line_items
  FOR EACH ROW EXECUTE FUNCTION public.bom_line_items_insert();

CREATE OR REPLACE FUNCTION public.bom_line_items_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bom_line_items_v2 SET ROW = NEW.* WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bom_line_items_update_trigger
  INSTEAD OF UPDATE ON public.bom_line_items
  FOR EACH ROW EXECUTE FUNCTION public.bom_line_items_update();

CREATE OR REPLACE FUNCTION public.bom_line_items_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.bom_line_items_v2 WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bom_line_items_delete_trigger
  INSTEAD OF DELETE ON public.bom_line_items
  FOR EACH ROW EXECUTE FUNCTION public.bom_line_items_delete();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Created views for _v2 tables: projects, boms, alerts, bom_line_items';
    RAISE NOTICE 'React Admin resources can now use clean names without _v2 suffix';
END $$;
