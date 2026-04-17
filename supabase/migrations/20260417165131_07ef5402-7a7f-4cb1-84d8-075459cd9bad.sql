CREATE TABLE IF NOT EXISTS public.devis_relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id text NOT NULL UNIQUE,
  devis_ref text NOT NULL,
  client_email text,
  date_envoi timestamptz,
  date_relance_1 timestamptz,
  date_fin_validite timestamptz,
  statut_relance text NOT NULL DEFAULT 'envoye',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devis_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view devis_relances"
  ON public.devis_relances FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert devis_relances"
  ON public.devis_relances FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update devis_relances"
  ON public.devis_relances FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete devis_relances"
  ON public.devis_relances FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_devis_relances_devis_id ON public.devis_relances(devis_id);