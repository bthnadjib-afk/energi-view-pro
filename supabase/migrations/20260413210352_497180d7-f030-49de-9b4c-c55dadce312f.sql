-- Restore EXECUTE on has_role for authenticated users (required by RLS policies)
-- The previous migration broke all RLS policies that depend on has_role()
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Keep revoked for anon and public (security hardening)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;