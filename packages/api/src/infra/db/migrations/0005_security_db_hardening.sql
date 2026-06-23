-- ============================================================================
-- RentLedger — Security hardening (§2 Supabase): default-deny RLS + function locks.
--
--  * Row Level Security is ENABLED on every public table. With no permissive
--    policy this is DEFAULT-DENY: the anon/authenticated PostgREST surface can
--    read/write nothing. The NestJS backend is the only client and connects via
--    a privileged service connection; it enforces tenant isolation in app code
--    (AccessService). RLS is the net that catches a compromised query path or any
--    accidental direct browser -> Supabase call.
--  * Granular per-workspace policies for a least-privilege (non-bypass) app role
--    are the documented next step (see SECURITY.md); they require the backend to
--    set a per-transaction `app.current_user` GUC so policies can scope rows.
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Pin search_path on trigger functions (advisor 0011 — prevents search_path hijacking).
ALTER FUNCTION public.rl_prevent_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.rl_assert_entry_balanced() SET search_path = public, pg_temp;

-- Remove the internal rls_auto_enable() DDL helper from the public RPC surface
-- (advisors 0028/0029 — it was SECURITY DEFINER and callable by anon/authenticated).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    BEGIN EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon'; EXCEPTION WHEN undefined_object THEN NULL; END;
    BEGIN EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated'; EXCEPTION WHEN undefined_object THEN NULL; END;
    EXECUTE 'ALTER FUNCTION public.rls_auto_enable() SET search_path = public, pg_temp';
  END IF;
END $$;
