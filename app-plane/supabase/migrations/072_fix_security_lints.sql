-- Migration: Fix Supabase Security Lints
-- Date: 2025-11-30
-- Description:
--   1. Set search_path = '' on all application functions to prevent schema poisoning attacks
--   2. Move pgcrypto extension to 'extensions' schema
-- Reference: https://supabase.com/docs/guides/database/database-linter

-- ============================================================================
-- PART 1: Create extensions schema and move pgcrypto
-- ============================================================================

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to roles
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- Note: Moving pgcrypto requires dropping and recreating, which may break dependent objects.
-- For safety, we'll leave pgcrypto in public but document this as a known issue.
-- In a fresh deployment, pgcrypto should be created in extensions schema from the start.

-- If you want to move pgcrypto (DESTRUCTIVE - run manually in a maintenance window):
-- DROP EXTENSION IF EXISTS pgcrypto CASCADE;
-- CREATE EXTENSION pgcrypto SCHEMA extensions;


-- ============================================================================
-- PART 2: Fix search_path on all application functions
-- Using DO blocks to handle cases where functions may not exist
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- BOM Upload Functions
    FOR func_record IN
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN (
            'mark_bom_upload_event_published',
            'update_bom_upload_workflow_status',
            'update_bom_uploads_updated_at',
            'update_bom_items_updated_at',
            'update_cns_bulk_uploads_updated_at',
            'archive_cns_bulk_upload',
            'mark_cns_bulk_upload_event_published',
            'update_cns_bulk_upload_job_status',
            'calculate_lifecycle_risk',
            'calculate_compliance_risk',
            'calculate_weighted_risk_score',
            'calculate_total_risk_score',
            'classify_risk_level',
            'classify_risk_level_custom',
            'auto_update_component_risk',
            'get_or_create_risk_profile',
            'update_risk_profile_timestamp',
            'calculate_bom_health_grade',
            'update_bom_risk_summary_timestamp',
            'create_default_alert_preferences',
            'queue_alert_delivery',
            'current_user_role',
            'current_user_organization_id',
            'current_user_tenant_id',
            'current_user_id',
            'current_user_email',
            'is_super_admin',
            'is_admin',
            'is_engineer',
            'is_analyst',
            'is_developer',
            'is_viewer',
            'is_org_admin',
            'is_platform_admin',
            'is_platform_user',
            'has_minimum_role',
            'get_role_level',
            'has_org_features',
            'get_organization_type',
            'get_organization_tier',
            'get_organization_limit',
            'check_organization_limit',
            'enforce_max_members_limit',
            'is_organization_active',
            'organization_has_feature',
            'update_organization_settings',
            'schedule_organization_deletion',
            'cancel_organization_deletion',
            'is_deletion_pending',
            'get_deletion_grace_days_remaining',
            'generate_slug_from_name',
            'check_slug_availability',
            'trigger_set_timestamp',
            'trigger_update_billing_timestamp',
            'update_bom_jobs_updated_at',
            'generate_invoice_number',
            'trigger_set_invoice_number',
            'debug_jwt_claims',
            'debug_request_context',
            'get_user_novu_channels',
            'slugify',
            'auto_generate_tenant_slug',
            'auto_generate_project_slug',
            'generate_s3_key',
            'update_search_vector',
            'set_authenticated_role',
            'update_updated_at_column',
            'create_risk_threshold_alert',
            'create_lifecycle_change_alert',
            'trigger_risk_level_alert',
            'trigger_lifecycle_alert',
            'update_bom_enrichment_from_queue',
            'get_latest_enrichment_state',
            'get_enrichment_summary',
            'update_cns_job_status',
            'archive_bom_upload',
            'mark_bom_upload_ready_for_enrichment'
        )
    LOOP
        BEGIN
            IF func_record.args = '' OR func_record.args IS NULL THEN
                EXECUTE format('ALTER FUNCTION public.%I() SET search_path = ''''', func_record.proname);
            ELSE
                EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''''', func_record.proname, func_record.args);
            END IF;
            RAISE NOTICE 'Fixed search_path for: %.%(%)', 'public', func_record.proname, COALESCE(func_record.args, '');
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not alter function %.%: %', 'public', func_record.proname, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- PART 3: Verification
-- ============================================================================

-- Log functions that still need search_path set (extension functions excluded)
DO $$
DECLARE
    unfixed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unfixed_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND (p.proconfig IS NULL OR NOT 'search_path=' = ANY(p.proconfig))
    AND p.proname NOT IN (
        -- pgcrypto functions
        'armor', 'dearmor', 'crypt', 'gen_salt', 'encrypt', 'decrypt',
        'encrypt_iv', 'decrypt_iv', 'gen_random_bytes', 'gen_random_uuid',
        'digest', 'hmac', 'pgp_sym_encrypt', 'pgp_sym_decrypt',
        'pgp_sym_encrypt_bytea', 'pgp_sym_decrypt_bytea',
        'pgp_pub_encrypt', 'pgp_pub_decrypt', 'pgp_pub_encrypt_bytea',
        'pgp_pub_decrypt_bytea', 'pgp_key_id', 'pgp_armor_headers',
        -- pg_trgm functions
        'similarity', 'show_trgm', 'show_limit', 'set_limit',
        'word_similarity', 'strict_word_similarity',
        'similarity_dist', 'word_similarity_dist_op', 'strict_word_similarity_dist_op',
        'similarity_op', 'word_similarity_op', 'strict_word_similarity_op',
        'word_similarity_commutator_op', 'strict_word_similarity_commutator_op',
        'word_similarity_dist_commutator_op', 'strict_word_similarity_dist_commutator_op',
        'gin_extract_value_trgm', 'gin_extract_query_trgm', 'gin_trgm_consistent', 'gin_trgm_triconsistent',
        'gtrgm_in', 'gtrgm_out', 'gtrgm_consistent', 'gtrgm_compress',
        'gtrgm_decompress', 'gtrgm_penalty', 'gtrgm_picksplit',
        'gtrgm_union', 'gtrgm_same', 'gtrgm_distance', 'gtrgm_options'
    );

    IF unfixed_count > 0 THEN
        RAISE NOTICE 'WARNING: % application functions still without search_path setting', unfixed_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All application functions have search_path set';
    END IF;
END $$;

COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions (pgcrypto, pg_trgm, etc.)';
