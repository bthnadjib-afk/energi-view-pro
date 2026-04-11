
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  objet text NOT NULL DEFAULT '',
  corps text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  document_ref text,
  destinataire text NOT NULL,
  objet text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view email history" ON public.email_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert email history" ON public.email_history
  FOR INSERT TO authenticated WITH CHECK (true);
