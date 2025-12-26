-- Fix auto_generate_project_slug function
-- The function has SET search_path TO '' but references 'projects' without schema qualification
-- This causes "relation 'projects' does not exist" error on INSERT

CREATE OR REPLACE FUNCTION public.auto_generate_project_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    -- If slug is not provided or empty, generate from name
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := regexp_replace(lower(trim(NEW.name)), '[^a-z0-9]+', '-', 'g');
        NEW.slug := trim(both '-' from NEW.slug);

        -- Ensure uniqueness within organization by appending number if needed
        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM public.projects
                WHERE slug = NEW.slug
                  AND organization_id = NEW.organization_id
                  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) LOOP
                NEW.slug := base_slug || '-' || counter;
                counter := counter + 1;
            END LOOP;
        END;
    END IF;

    RETURN NEW;
END;
$function$;
