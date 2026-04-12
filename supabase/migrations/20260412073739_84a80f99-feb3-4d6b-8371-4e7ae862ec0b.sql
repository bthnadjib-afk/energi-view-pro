DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles or admin all"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));