
-- Fix email_history RLS
DROP POLICY IF EXISTS "Authenticated can insert email history" ON public.email_history;
DROP POLICY IF EXISTS "Authenticated can view email history" ON public.email_history;

CREATE POLICY "Users can view own or admin all email history"
ON public.email_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Users can insert own email history"
ON public.email_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add SELECT policy for secretaire on email_templates
CREATE POLICY "Secretaires can read email templates"
ON public.email_templates FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'secretaire'));
