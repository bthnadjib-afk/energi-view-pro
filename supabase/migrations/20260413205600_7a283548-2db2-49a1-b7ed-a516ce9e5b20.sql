-- Revoke direct RPC access to has_role from API users
-- RLS policies run as table owner (postgres) so they still have access
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO postgres;