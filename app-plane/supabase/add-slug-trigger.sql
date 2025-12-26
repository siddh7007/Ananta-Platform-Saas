-- Auto-generate slug from tenant name
CREATE OR REPLACE FUNCTION public.generate_slug_from_name()
RETURNS trigger AS $$
BEGIN
    -- Only generate slug if it's NULL or empty
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(
            regexp_replace(
                regexp_replace(
                    regexp_replace(trim(NEW.name), '[^\w\s-]', '', 'g'),  -- Remove special chars
                    '\s+', '-', 'g'                                        -- Replace spaces with hyphens
                ),
                '-+', '-', 'g'                                             -- Replace multiple hyphens with single
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS generate_slug_tenants_v2 ON public.tenants_v2;
CREATE TRIGGER generate_slug_tenants_v2
BEFORE INSERT OR UPDATE ON public.tenants_v2
FOR EACH ROW
EXECUTE PROCEDURE public.generate_slug_from_name();
